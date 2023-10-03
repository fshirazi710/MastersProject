use group::Curve;
use secp256k1::SecretKey;
use std::str::FromStr;
use std::convert::TryInto;
use std::time;
use std::time::{SystemTime, UNIX_EPOCH};
use std::collections::HashMap;
use std::fs::File;
use rand8::seq::SliceRandom;
use web3::transports::Http;
use web3::types::{Address, H256, TransactionParameters, Bytes, U256};
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
use dotenv::dotenv;
mod cryptography;

struct Share{
    x: u64,
    y: G1Projective
}
struct Task{
    id: u64,
    message: Vec<u8>,
    decryption_time: u64,
    share_holders: Vec<u64>,
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
    dotenv().ok();
    let sk = &std::env::var("CLIENT_SK").expect("CLIENT_SK must be set.");
    let contract_address: Address = std::env::var("CONTRACT_ADDRESS").expect("CONTRACT_ADDRESS must be set.").parse()?;
    let url = std::env::var("API_URL").expect("API_URL must be set.");
    let web3 = Web3::new(web3::transports::Http::new(&url)?);
    let f = File::open("./contract_abi")?;
    let ethabi_contract = ethabi::Contract::load(f)?;
    let contract = Contract::new(web3.eth(), contract_address, ethabi_contract);

    let message = "Test one hour message 10";
    let decryption_time = get_time()+3600; //decrypt in two minutes
    let n = 3;
    send_time_lock_message(&web3, &contract, &contract_address, sk, message, decryption_time, n).await;
    Ok(())
}

async fn send_time_lock_message(web3: &Web3<Http>, contract: &Contract<Http>, contract_address: &Address, sk: &str, message: &str, decryption_time: u64, n: u64){
    // prepare params (cryptography)
    let t = get_threshold(n);
    let agents: HashMap<u64, Agent> = get_agent_list(&contract).await;
    let indexes: Vec<u64> = agents.keys().cloned().collect();
    let pks = indexes.iter().map(|i| agents.get(i).unwrap().pk).collect();
    let r = cryptography::gen_r();
    let g1r = cryptography::get_g1r(&r).to_affine().to_compressed().to_vec();
    let g2r = cryptography::get_g2r(&r).to_affine().to_compressed().to_vec();
    let (k, alphas) = cryptography::get_k_and_alphas(&r, &indexes, &pks, t);
    let ciphertext = cryptography::encrypt(&message.as_bytes(), &k.to_bytes(), b"000000000001");

    let decryption_time_param = Param{name: "decryptionTime".to_string(), kind: ParamType::Uint(256), internal_type: None};
    let g1r_param = Param{name: "g1r".to_string(), kind: ParamType::Bytes, internal_type: None};
    let g2r_param = Param{name: "g2r".to_string(), kind: ParamType::Bytes, internal_type: None};
    let alphas_param = Param{name: "alphas".to_string(), kind: ParamType::Array(Box::new(ParamType::Bytes)), internal_type: None};
    let func = ethabi::Function{name: "sendTimeLockTransaction".to_string(), inputs: vec![decryption_time_param, g1r_param, g2r_param, alphas_param], outputs: vec![], state_mutability: ethabi::StateMutability::NonPayable, constant: None};

    let alphas_token: Vec<Token> = alphas.iter().map(|alpha| Token::Bytes(alpha.to_bytes().to_vec())).collect();
    let data = make_data(&func, &vec![Token::Uint(Uint::from(decryption_time)), Token::Bytes(g1r), Token::Bytes(g2r), Token::Array(alphas_token)]);
    
    let tx_object = TransactionParameters{to: Some(*contract_address), data: Bytes::from(data), value: U256::exp10(16)*3, gas: U256::from(8000000), gas_price: Some(U256::from(web3.eth().gas_price().await.unwrap()*15/10)), ..Default::default()};
    let prvk = SecretKey::from_str(sk).unwrap();
    let signed = web3.accounts().sign_transaction(tx_object, &prvk).await.unwrap();
    let result = web3.eth().send_raw_transaction(signed.raw_transaction).await.unwrap();
    println!("Tx succeeded with hash: {:#x}", result);
    println!("Time Lock message: {}, key: {}, ciphertext: {:?}, decryption time: {}", message, k, ciphertext, decryption_time);
}

// get 10 digit timestamp (in seconds)
fn get_time() -> u64{
    let start = SystemTime::now();
    let since_the_epoch = start.duration_since(UNIX_EPOCH).expect("Time went backwards");
    return since_the_epoch.as_secs();
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

fn get_threshold(n: u64) -> u64{
    (((n as f32)*0.51).ceil()) as u64
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