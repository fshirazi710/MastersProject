# Timed-Release-Crypto
This repository is the implementation of a smart contract based timed-release cryptography system. The system is presented in the paper: [Send Message to the Future? Blockchain-based Time Machines for Decentralized Reveal of Locked Information](https://arxiv.org/abs/2401.05947).

## Basic Concepts
The system is designed for clients to share a secret among multiple agents (secret holders), who are responsible for revealing the secret at a specific time. The clients and the secret holders communicate through a smart contract. To send a timed-release message, a client sends a transaction to the smart contract. The contract emits an event when it receives a message. The agents listen to the smart contract events. From that event, the agents can extract their shares of the secret and publish it to the smart contract at the client specified time.

## File structure
- `agent-script/` is the directory containing the code an agent should run in a Rust implementation. `agent-script/src/bin/main.rs` is the main entry of the code, where agents constantly listen to the smart contract events and respond to them.

- `client-script/` is the directory containing the code that a client can use to send timed release message transactions in a Rust implementation. `client-script/src/bin/main.rs` is the main entry of the code.

- `contracts/` is an implementation of the smart contract that needs to be published on a blockchain for the system to work.

- `tamarin-crypto-model/` is not part of the system implementation but a formal model of the system's cryptographic protocol in Tamarin Prover.

## Usage
Here is a step-by-step guide on how to set up a system:
1. Deploying the smart contract in `contracts/` to a blockchain. 
   - In the contract, the constants can be tuned to any desired parameters. It may require external smart contract development tools like *hardhat* or *foundry* to deploy the contract. Once deployed, keep a note of the deployed contract address.
   - Setup:
    1. Go to Remix Ethereum IDE [here](https://remix.ethereum.org/).
    2. Either upload the `TimeLockEnc.sol` file into the file explorer, or connect to Github and use the repository.
    3. Go the **Solidity Compiler** (left panel) and select the version 0.8.0 compiler.
    4. Click the **Compile TimeLockEnc.sol** button
    5. Once compiled, Navigate to the **Deploy and Run Transactions** (left panel) 
        1. if you don't have Sepolia setup, then ensure that the Environment is set to the default **Remix VM (Camcun)**
        2. if you do, then pair your MetaMask wallet to the Environment and use that.
    6. Ensure the compiled contract appears in the Contract dropdown, then click deploy.
    7. Interact with the various methods in the **Deployed Contracts** section

2. Set up multiple agents running the `agent-script` Rust code. 
    - The number of agents should be equal to the `MAX_COMMITTEE_SIZE` set in the smart contract. To run the agent code, create a `.env` file in the `agent-script` directory specifying the following environment variables:
        - `ADDRESS_SK`: the secret key of the agent's address.
        - `ADDRESS_PK`: the agent's address. Make sure there are some crypto assets in this address to pay transaction fees and additional fees or deposits defined in the smart contract.
        - `CONTRACT_ADDRESS`: the address of the deployed smart contract.
        - `API_URL`: an RPC URL of the blockchain.
        - `AGENT_PK`: agent public key (from cryptography.rs)
        - `AGENT_SK`: agent secret key (from cryptography.rs)
    - (**warning, still in progress of development**)
    - To compile and run the Rust code: documentation [here](https://doc.rust-lang.org/book/ch01-01-installation.html)
        1. Download the Cargo rust compiler [here](https://www.rust-lang.org/tools/install).
        2. Check the installation by typing `rustc --version`, you should see the version number and commit date. (If any issues you may need to update Environment variables)
        3. navigate to the **agent-script** folder and run `cargo build`. You should get a ton of warnings but it should build completely, with a **target** folder appearing under **src** folder.
        4. To get all the variables for the env file:
            - `ADDRESS_SK` : copy the secret key of your MetaMask wallet account.
            - `ADDRESS_PK` : copy the public account number of your MetaMask wallet account.
            - `CONTRACT_ADDRESS` : copy the contract address from the **Deployed Contracts** section in the RemixIDE deployment tab.
            - `API_URL` : make an app on alchemy.com ([link_here](https://www.alchemy.com/)), ensuring that the Chain is **Etherium** and the Network is **Sepolia**. Then copy the **Network URL** once you have created the app.
            - `AGENT_PK and AGENT_SK` : **(this is tricky)** open the `Cargo.toml` file and update the `default-run` variable to `cryptography`. Then run `cargo build` and then `cargo run`. You should see a log in the terminal. Where it says **sks:**, these are the secret keys generated, and where it says **pks:**, these are the public keys generated. For any pair of secret-public keys in the lists, place the secret key with `AGENT_SK` and public key with `AGENT_PK`. After this, reopen the `Cargo.toml` file and return the `default-run` to `main`, and rebuilt using `cargo-build`.
        5. place the `.env` file in the **agent-script** directory, ensuring its at the same level at the `Cargo.toml` file.
        6. Run `cargo run`, you should see a **logs** folder appear above the `src` folder (it is plausable that if the network is congested that it could take a while for the transaction to be processed)
        7. To check if the transaction was sucessful, copy your wallet address and paste it into etherscan ([link-here](https://etherscan.io/))

3. Set up multiple clients running the `agent-script` Rust code. 
    - To send a timed release transaction, run the `client-script` Rust code. Start by creating a `.env` file in the `client-script` directory specifying the same environment variables:
        - `CLIENT_SK`: the secret key of the client's address.
        - `CLIENT_ADDRESS`: the client's address. Make sure there are some crypto assets in this address to pay transaction fees and additional fees or deposits defined in the smart contract.
        - `CONTRACT_ADDRESS`: the address of the deployed smart contract.
        - `API_URL`: an RPC URL of the blockchain.
    - (**warning, still in progress of development**)
    - To compile and run the Rust code: documentation [here](https://doc.rust-lang.org/book/ch01-01-installation.html)
        1. Download the Cargo rust compiler [here](https://www.rust-lang.org/tools/install).
        2. Check the installation by typing `rustc --version`, you should see the version number and commit date. (If any issues you may need to update Environment variables)
        3. navigate to the **client-script** folder and run `cargo build`. You should get a ton of warnings but it should build completely, with a **target** folder appearing under **src** folder.
        4. To get all the variables for the env file:
            - `CLIENT_SK` : copy the secret key of your MetaMask wallet account.
            - `CLIENT_ADDRESS` : copy the public account number of your MetaMask wallet account.
            - `CONTRACT_ADDRESS` : copy the contract address from the **Deployed Contracts** section in the RemixIDE deployment tab.
            - `API_URL` : make an app on alchemy.com ([link_here](https://www.alchemy.com/)), ensuring that the Chain is **Etherium** and the Network is **Sepolia**. Then copy the **Network URL** once you have created the app.
        5. place the `.env` file in the **client-script** directory, ensuring its at the same level at the `Cargo.toml` file.
        6. Then modify the `client-script/src/bin/main.rs` file to specify the secret and the time to reveal the secret.
        7. Run `cargo run`, you should see a **logs** folder appear above the `src` folder (it is plausable that if the network is congested that it could take a while for the transaction to be processed)
        8. To check if the transaction was sucessful, copy your wallet address and paste it into etherscan ([link-here](https://etherscan.io/))