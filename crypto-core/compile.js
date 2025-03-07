const fs = require('fs');
const path = require('path');
const solc = require('solc');

// Create build directory if it doesn't exist
const buildPath = path.resolve(__dirname, 'build', 'contracts');
if (!fs.existsSync(buildPath)) {
    fs.mkdirSync(buildPath, { recursive: true });
}

// Read the contract source code
const contractPath = path.resolve(__dirname, 'contracts', 'TimedReleaseVoting.sol');
const source = fs.readFileSync(contractPath, 'utf8');

// Configure compiler input
const input = {
    language: 'Solidity',
    sources: {
        'TimedReleaseVoting.sol': {
            content: source
        }
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['abi', 'evm.bytecode']
            }
        }
    }
};

// Compile the contract
console.log('Compiling contract...');
const output = JSON.parse(solc.compile(JSON.stringify(input)));

// Check for errors
if (output.errors) {
    output.errors.forEach(error => {
        console.error(error.formattedMessage);
    });
    
    // If there are severe errors, exit
    if (output.errors.some(error => error.severity === 'error')) {
        console.error('Compilation failed due to errors.');
        process.exit(1);
    }
}

// Extract contract data
const contractOutput = output.contracts['TimedReleaseVoting.sol']['TimedReleaseVoting'];
const abi = contractOutput.abi;
const bytecode = contractOutput.evm.bytecode.object;

// Write the ABI and bytecode to files
const contractBuildPath = path.resolve(buildPath, 'TimedReleaseVoting.json');
fs.writeFileSync(
    contractBuildPath,
    JSON.stringify({
        abi,
        bytecode,
        contractName: 'TimedReleaseVoting',
        sourcePath: 'contracts/TimedReleaseVoting.sol'
    }, null, 2)
);

console.log('Contract compiled successfully!');
console.log(`ABI and bytecode written to ${contractBuildPath}`); 