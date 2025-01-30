use group::Curve;
use secp256k1::SecretKey;
use std::str::FromStr;
use std::convert::TryInto;
use std::time;
use std::env;
use std::time::{SystemTime, UNIX_EPOCH};
use std::collections::HashMap;
use std::fs::File;
use std::sync::Arc;
use tokio::sync::Mutex;
use dotenv::dotenv;
use web3::transports::Http;
use web3::types::{Address, H256, TransactionParameters, Bytes, U256, FilterBuilder, Log};
use web3::{Web3};
use web3::contract::{Contract, Options};
use futures::StreamExt;
use tiny_keccak::{Hasher, Keccak};
use ethabi::param_type::ParamType;
use ethabi::{self, Token, Param, Function, Uint};
use bls12_381::{G1Affine, G2Affine, G1Projective, G2Projective, Scalar};
use log::{info, error};
use log4rs::{
    config::{Appender, Config, Logger, Root},
    append::file::FileAppender,
    encode::pattern::PatternEncoder,
    append::console::ConsoleAppender,
};
use tokio::time::{sleep, Duration};
mod cryptography;

struct Share{
    x: u64,
    y: G1Projective
}
struct Task{
    id: u64,
    decryption_time: u64,
    g1r: G1Projective,
    g2r: G2Projective,
    alphas: Vec<Scalar>,
    shares: HashMap<u64, Share>,
    submitted: bool
}
struct Agent{
    id: u64,
    address: Address,
    pk: G1Projective
}
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // env::set_var("RUST_BACKTRACE", "1");
    dotenv().ok();
    setup_logger("logs/output.log").unwrap();
    let JOIN_COMMITTEE = true;

    info!("Initializing...");
    let agent_pk = cryptography::import_pk(&std::env::var("AGENT_PK").expect("AGENT_PK must be set."));
    let agent_sk = cryptography::import_sk(&std::env::var("AGENT_SK").expect("AGENT_SK must be set."));
    if !(agent_sk*G1Projective::generator() == agent_pk){
        error!("Agent public key and secret key do not match!");
    }
    let address_sk = &std::env::var("ADDRESS_SK").expect("ADDRESS_SK must be set.");
    let address_pk = &std::env::var("ADDRESS_PK").expect("ADDRESS_PK must be set.");
    let contract_address: Address = std::env::var("CONTRACT_ADDRESS").expect("CONTRACT_ADDRESS must be set.").parse()?;
    let n = 3;
    let t = 2;
    let url = std::env::var("API_URL").expect("API_URL must be set.");
    // Create web3 instance
    let web3 = Arc::new(Mutex::new(Web3::new(web3::transports::Http::new(&url)?)));
    let f = File::open("./contract_abi")?;
    let ethabi_contract = ethabi::Contract::load(f)?;
    let contract = Contract::new(web3.lock().await.eth(), contract_address, ethabi_contract);
    let mut tasks: Arc<Mutex<HashMap<u64, Task>>> = Arc::new(Mutex::new(HashMap::new()));
    info!("Populating agents list.");
    let mut agents: HashMap<u64, Agent> = get_agent_list(&contract).await;

    // Join committee if myself not in agents list
    let mut in_committee = false;
    for (_, agent) in &agents{
        if agent.pk == agent_pk{
            in_committee = true;
            break;
        }
    }
    if !in_committee{
        let deposit_ether_value = 1;
        join_committee(Arc::clone(&web3), contract_address, &agent_pk, address_sk, deposit_ether_value).await;
        info!("Joining committee.");
        while get_index(&contract, agent_pk).await.is_none(){
            sleep(Duration::from_secs(5)).await;
        }
    }
    let index = get_index(&contract, agent_pk).await.unwrap(); // Your member index

    // Create event filter
    let event1 = "transactionReceived(uint256,uint256,bytes,bytes,bytes[])";
    let event2 = "shareRecieved(uint256,uint256,bytes)";
    let event3 = "memberJoined(address,uint256,bytes)";
    let event4 = "memberExited(uint256)";
    let events = [event1, event2, event3, event4];
    let mut event_topics = vec![];
    for event in events{
        let mut hasher = Keccak::v256();
        let mut result = [0u8; 32];
        hasher.update(event.as_bytes());
        hasher.finalize(&mut result);
        event_topics.push(H256(result));
    }

    // let past_events = get_past_events(&web3, contract_address, event_topics.clone(), 3365860, 3370760).await;

    let filter = web3::types::FilterBuilder::default()
        .address(vec![contract_address])
        .topics(Some(event_topics.clone()), None, None, None)
        .build();
    // Create a stream for the event
    let filter = web3.lock().await.eth_filter().create_logs_filter(filter).await?;
    // Read every 1 sec
    let logs_stream = filter.stream(time::Duration::from_secs(1));
    futures::pin_mut!(logs_stream);
    info!("Initialization completed. Starting main loop.");
    // Secret shares submittion loop
    tokio::spawn(loop_tasks(Arc::clone(&tasks), t, index, Arc::clone(&web3), contract_address));
    // Listen to events loop
    loop{
        let log = logs_stream.next().await.unwrap();
        if let Ok(tx_log) = log {
            let raw_data = &tx_log.data.0[..];
            if tx_log.topics[0] == event_topics[0] {
                // transaction received
                let data = ethabi::decode(&[ParamType::Uint(256), ParamType::Uint(256), ParamType::Bytes, ParamType::Bytes, ParamType::Array(Box::new(ParamType::Bytes))], raw_data).unwrap();
                info!("Transaction received event detected. Transaction data: {:?}", data);
                // convert data
                let id = data[0].clone().into_uint().unwrap().as_u64();
                let decryption_time = data[1].clone().into_uint().unwrap().as_u64();
                let g1r: [u8; 48] = data[2].clone().into_bytes().unwrap()[..48].try_into().unwrap();
                let g2r: [u8; 96] = data[3].clone().into_bytes().unwrap()[..96].try_into().unwrap();
                // TODO: This (below) can go wrong. Handle exception here.
                let g1r_point = G1Projective::from(G1Affine::from_compressed(&g1r).unwrap());
                let g2r_point = G2Projective::from(G2Affine::from_compressed(&g2r).unwrap());
                let alphas: Vec<Vec<u8>> = data[4].clone().into_array().unwrap().into_iter().map(|holder| holder.into_bytes().unwrap()).collect();
                let mut alphas_bytes = vec![];
                for alpha in alphas{
                    let bytes: [u8; 32] = alpha[..32].try_into().unwrap();
                    alphas_bytes.push(Scalar::from_bytes(&bytes).unwrap());
                }
                let mut shares: HashMap<u64, Share> = HashMap::new();
                shares.insert(index, Share{x: index, y: cryptography::node_get_share(&agent_sk, &g1r_point)});
                // push task
                let task = Task{id, decryption_time, g1r: g1r_point, g2r: g2r_point, alphas: alphas_bytes, shares, submitted: false};
                let mut released_tasks = tasks.lock().await;
                released_tasks.insert(id, task);
                info!{"Task {} added to tasks list.", id};
            }
            else if tx_log.topics[0] == event_topics[1] {
                // share received
                let data = ethabi::decode(&[ParamType::Uint(256), ParamType::Uint(256), ParamType::Bytes], raw_data).unwrap();
                info!("Share received event detected. Share data: {:?}", data);
                // convert data
                let member: u64 = data[0].clone().into_uint().unwrap().as_u64();
                let tx_id = data[1].clone().into_uint().unwrap().as_u64();
                let share: [u8; 48] = data[2].clone().into_bytes().unwrap()[..48].try_into().unwrap();
                let share_point = G1Projective::from(G1Affine::from_compressed(&share).unwrap());
                // verify and save shares
                let mut released_tasks = tasks.lock().await;
                if released_tasks.get(&tx_id).is_some(){
                    if cryptography::verify_share(&share_point, &agents.get(&member).unwrap().pk, &released_tasks.get(&tx_id).unwrap().g2r){
                        let task = released_tasks.get_mut(&tx_id).unwrap();
                        task.shares.insert(member, Share{x: member, y: share_point});
                        if task.shares.len() >= t as usize{
                            info!("Task {} with decryption time {} completed at time {}.", tx_id, task.decryption_time, get_time());
                            released_tasks.remove(&tx_id);
                        }
                    }
                    else{
                        info!("Invalid share from agent number {} for task {}!", member, tx_id);
                        dispute_share(Arc::clone(&web3), contract_address, address_sk, tx_id, member).await;
                    }
                }
            }
            else if tx_log.topics[0] == event_topics[2] {
                // agent joined
                let data = ethabi::decode(&[ParamType::Address, ParamType::Uint(256), ParamType::Bytes], raw_data).unwrap();
                info!("Agent joined event detected. New agent data: {:?}.", data);
                // convert data
                let address: Address = Address::from(data[0].clone().into_address().unwrap());
                let index = data[1].clone().into_uint().unwrap().as_u64();
                let pk: [u8; 48] = data[2].clone().into_bytes().unwrap()[..48].try_into().unwrap();
                let public_key = G1Projective::from(G1Affine::from_compressed(&pk).unwrap());
                // save agent
                agents.insert(index, Agent{id: index, address: address, pk: public_key});
            }
            else if tx_log.topics[0] == event_topics[3] {
                // member exited
                let data = ethabi::decode(&[ParamType::Uint(256)], raw_data).unwrap();
                info!("Agent exited event detected. Exited agent data: {:?}.", data);
                let index = data[0].clone().into_uint().unwrap().as_u64();
                agents.remove(&index);
            }
        }
    }
    Ok(())
}
async fn loop_tasks(tasks: Arc<Mutex<HashMap<u64, Task>>>, t: i32, index: u64, web3: Arc<Mutex<Web3<Http>>>, contract_address: Address){
    let address_sk = &std::env::var("ADDRESS_SK").expect("ADDRESS_SK must be set.");
    loop{
        let time = get_time();
        let mut released_tasks = tasks.lock().await;
        let task_keys: Vec<u64> = released_tasks.keys().cloned().collect();
        for id in task_keys {
            if let Some(task) = released_tasks.get_mut(&id) {
                if time > task.decryption_time {
                    if task.shares.len() <= t as usize{
                        if !task.submitted{
                            submit_share(Arc::clone(&web3), index, contract_address, address_sk, &task).await;
                            task.submitted = true;
                            info!("Share submitted for task id {}.", id);
                        }
                    }
                    else{
                        // enough shares received
                        released_tasks.remove(&id);
                        info!("Task {} removed.", id);
                    }
                }
            }
        }
        sleep(Duration::from_secs(2)).await;
    }
}
// get 10 digit timestamp (in seconds)
fn get_time() -> u64{
    let start = SystemTime::now();
    let since_the_epoch = start.duration_since(UNIX_EPOCH).expect("Time went backwards");
    return since_the_epoch.as_secs();
}
// value unit is eth
async fn join_committee(web3: Arc<Mutex<Web3<Http>>>, contract: Address, agent_pk: &G1Projective, address_sk: &str, value: u64){
    let mut result = H256::zero();
    while result == H256::zero(){
        let public_key = Param{name: "publicKey".to_string(), kind: ParamType::Bytes, internal_type: None};
        let func = ethabi::Function{name: "joinCommittee".to_string(), inputs: vec![public_key], outputs: vec![], state_mutability: ethabi::StateMutability::NonPayable, constant: None};
        
        let pk_data = Token::Bytes(ethabi::Bytes::from(agent_pk.to_affine().to_compressed()));
        let data = make_data(&func, &vec![pk_data]);
        let web3_released = web3.lock().await;
        let tx_object = TransactionParameters{to: Some(contract), data: Bytes::from(data), value: U256::exp10(18)*value, gas: U256::from(8000000), gas_price: Some(U256::from(web3_released.eth().gas_price().await.unwrap()*15/10)), ..Default::default()};
        let prvk = SecretKey::from_str(address_sk).unwrap();
        let signed = web3_released.accounts().sign_transaction(tx_object, &prvk).await.unwrap();
        result = web3_released.eth().send_raw_transaction(signed.raw_transaction).await.unwrap_or(H256::zero());
        sleep(Duration::from_secs(1)).await;
    }
    info!("Join committee tx succeeded with hash: {:#x}", result);
}
async fn get_index(contract: &Contract<Http>, agent_pk: G1Projective) -> Option<u64>{
    let mut found_agents: u64 = 0;
    let csize_result: U256 = contract.query("committeeSize", (), None, Options::default(), None).await.unwrap();
    let committee_size = csize_result.as_u64();
    
    let mut counter: u64 = 0;
    while found_agents < committee_size{
        let address = get_agent_address(contract, counter).await;
        if !address.is_zero(){
            found_agents += 1;
            let pk = get_agent_pk(contract, &address).await;
            if pk == agent_pk{
                return Some(counter);
            }
        }
        counter += 1;
    }
    return None;
}
async fn submit_share(web3: Arc<Mutex<Web3<Http>>>, index: u64, contract: Address, sk: &str, task: &Task){
    let mut result = H256::zero();
    while result == H256::zero(){
        let tx_id = Param{name: "transactionID".to_string(), kind: ParamType::Uint(256), internal_type: None};
        let secret_share = Param{name: "secret_share".to_string(), kind: ParamType::Bytes, internal_type: None};
        let func = ethabi::Function{name: "submitShare".to_string(), inputs: vec![tx_id, secret_share], outputs: vec![], state_mutability: ethabi::StateMutability::NonPayable, constant: None};
        
        let tx_id_data = Token::Uint(Uint::from(task.id));
        let secret_share_data = Token::Bytes(ethabi::Bytes::from(get_share_bytes(task, index)));
        let data = make_data(&func, &vec![tx_id_data, secret_share_data]);
        let web3_released = web3.lock().await;
        let tx_object = TransactionParameters{to: Some(contract), data: Bytes::from(data), gas: U256::from(8000000), gas_price: Some(U256::from(web3_released.eth().gas_price().await.unwrap()*15/10)), ..Default::default()};
        let prvk = SecretKey::from_str(sk).unwrap();
        let signed = web3_released.accounts().sign_transaction(tx_object, &prvk).await.unwrap();
        result = web3_released.eth().send_raw_transaction(signed.raw_transaction).await.unwrap_or(H256::zero());
        sleep(Duration::from_secs(1)).await;
    }
    info!("Submit share tx succeeded with hash: {:#x}", result);
}
async fn dispute_share(web3: Arc<Mutex<Web3<Http>>>, contract: Address, sk: &str, tx_id: u64, member_index: u64){
    let mut result = H256::zero();
    while result == H256::zero(){
        let transaction_id = Param{name: "transactionID".to_string(), kind: ParamType::Uint(256), internal_type: None};
        let member = Param{name: "transactionID".to_string(), kind: ParamType::Uint(256), internal_type: None};
        let func = ethabi::Function{name: "disputeShare".to_string(), inputs: vec![transaction_id, member], outputs: vec![], state_mutability: ethabi::StateMutability::NonPayable, constant: None};
        let tx_id_data = Token::Uint(Uint::from(tx_id));
        let member_index_data = Token::Uint(Uint::from(member_index));
        let data = make_data(&func, &vec![tx_id_data, member_index_data]);
        let web3_released = web3.lock().await;
        let tx_object = TransactionParameters{to: Some(contract), data: Bytes::from(data), gas: U256::from(8000000), gas_price: Some(U256::from(web3_released.eth().gas_price().await.unwrap()*15/10)), ..Default::default()};
        let prvk = SecretKey::from_str(sk).unwrap();
        let signed = web3_released.accounts().sign_transaction(tx_object, &prvk).await.unwrap();
        result = web3_released.eth().send_raw_transaction(signed.raw_transaction).await.unwrap_or(H256::zero());
        sleep(Duration::from_secs(1)).await;
    }
    info!("Dispute share tx succeeded with hash: {:#x}", result);
}
async fn get_agent_list(contract: &Contract<Http>) -> HashMap<u64, Agent>{
    let mut agents: HashMap<u64, Agent> = HashMap::new();
    let csize_result: U256 = contract.query("committeeSize", (), None, Options::default(), None).await.unwrap();
    let committee_size = csize_result.as_u64();
    
    let mut counter: u64 = 0;
    while agents.len() < committee_size as usize{
        let address = get_agent_address(contract, counter).await;
        if !address.is_zero(){
            let pk = get_agent_pk(contract, &address).await;
            agents.insert(counter, Agent{id: counter, address, pk});
        }
        counter += 1;
    }
    return agents;
}
async fn get_agent_address(contract: &Contract<Http>, index: u64) -> Address{
    let result: Address = contract.query("committee", (Token::Uint(Uint::from(index)), ), None, Options::default(), None).await.unwrap();
    return result;
}
async fn get_agent_pk(contract: &Contract<Http>, address: &Address) -> G1Projective{
    let result: (Bytes, Uint) = contract.query("publicKeys", (Token::Address(*address), ), None, Options::default(), None).await.unwrap();
    let pk: [u8; 48] = result.0.0[..48].try_into().unwrap();
    let pk_point = G1Projective::from(G1Affine::from_compressed(&pk).unwrap());
    return pk_point;
}
fn make_data(func: &Function, data: &Vec<Token>) -> Bytes{
    let input = func.encode_input(&data[..]).unwrap();
    return Bytes::from(input);
}
fn get_share_bytes(task: &Task, index: u64) -> [u8; 48]{
    task.shares.get(&index).unwrap().y.to_affine().to_compressed()
}

async fn get_past_events(web3: &Web3<Http>, contract_address: Address, event_signatures: Vec<H256>, from_block: u64, to_block: u64) -> Vec<Log>{
    let filter = FilterBuilder::default()
        .address(vec![contract_address])
        .topics(Some(event_signatures), None, None, None)
        .from_block(web3::types::BlockNumber::from(from_block))
        .to_block(web3::types::BlockNumber::from(to_block))
        .build();

    let past_events: Vec<Log> = web3.eth().logs(filter).await.unwrap();
    return past_events;
}


fn setup_logger(log_file_path: &str) -> Result<(), Box<dyn std::error::Error>> {
    // Create a console appender
    let console = ConsoleAppender::builder().build();
    // Create a file appender with a custom pattern encoder
    let file = FileAppender::builder()
        .encoder(Box::new(PatternEncoder::new("{d(%Y-%m-%d %H:%M:%S)} [{t}] {l} - {m}{n}")))
        .build(log_file_path)?;

    // Create a logger configuration
    let config = Config::builder()
        .appender(Appender::builder().build("console", Box::new(console)))
        .appender(Appender::builder().build("file", Box::new(file)))
        .logger(Logger::builder().build("app::backend::db", log::LevelFilter::Info))
        .logger(Logger::builder().build("app::frontend", log::LevelFilter::Warn))
        .build(Root::builder().appender("console").appender("file").build(log::LevelFilter::Info))?;

    // Initialize the logger with the configuration
    log4rs::init_config(config)?;

    Ok(())
}