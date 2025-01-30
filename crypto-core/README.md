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
1. Deploy the smart contract in `contracts/` to a blockchain. In the contract, the constants can be tuned to any desired parameters. It may require external smart contract development tools like *hardhat* or *foundry* to deploy the contract. Once deployed, keep a note of the deployed contract address.
2. Set up multiple agents running the `agent-script` Rust code. The number of agents should be equal to the `MAX_COMMITTEE_SIZE` set in the smart contract. To run the agent code, create a `.env` file in the `agent-script` directory specifying the following environment variables:
    - `ADDRESS_SK`: the secret key of the agent's address.
    - `ADDRESS_PK`: the agent's address. Make sure there are some crypto assets in this address to pay transaction fees and additional fees or deposits defined in the smart contract.
    - `CONTRACT_ADDRESS`: the address of the deployed smart contract.
    - `API_URL`: an RPC URL of the blockchain.

3. To send a timed release transaction, run the `client-script` Rust code. Start by creating a `.env` file in the `client-script` directory specifying the same environment variables:
    - `CLIENT_SK`: the secret key of the client's address.
    - `CLIENT_ADDRESS`: the client's address. Make sure there are some crypto assets in this address to pay transaction fees and additional fees or deposits defined in the smart contract.
    - `CONTRACT_ADDRESS`: the address of the deployed smart contract.
    - `API_URL`: an RPC URL of the blockchain.
Then modify the `client-script/src/bin/main.rs` file to specify the secret and the time to reveal the secret. Run the code to send a timed release transaction.