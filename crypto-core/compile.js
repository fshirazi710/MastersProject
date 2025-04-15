const fs = require('fs');
const path = require('path');
const solc = require('solc');

// Function to handle imports, specifically from node_modules
function findImports(importPath) {
    // console.log(`Attempting to import: ${importPath}`);
    // Handle OpenZeppelin imports
    if (importPath.startsWith('@openzeppelin/')) {
        const filePath = path.resolve(__dirname, 'node_modules', importPath);
        // console.log(`Resolved OpenZeppelin path: ${filePath}`);
        if (fs.existsSync(filePath)) {
            // console.log(`Found OpenZeppelin file: ${filePath}`);
            return { contents: fs.readFileSync(filePath, 'utf8') };
        } else {
            // console.log(`OpenZeppelin file NOT found at: ${filePath}`);
        }
    }
    // Handle local imports (relative to contracts directory)
    const localPath = path.resolve(__dirname, 'contracts', importPath);
    // console.log(`Resolved local path: ${localPath}`);
    if (fs.existsSync(localPath)) {
        // console.log(`Found local file: ${localPath}`);
        return { contents: fs.readFileSync(localPath, 'utf8') };
    } else {
        //  console.log(`Local file NOT found at: ${localPath}`);
    }
    // If not found anywhere
    // console.log(`Import ${importPath} could not be resolved.`);
    return { error: 'File not found: ' + importPath };
}

// Create build directory if it doesn't exist
const buildPath = path.resolve(__dirname, 'build', 'contracts');
if (!fs.existsSync(buildPath)) {
    fs.mkdirSync(buildPath, { recursive: true });
}

// Read the main contract source code
const contractPath = path.resolve(__dirname, 'contracts', 'TimedReleaseVoting.sol');
const source = fs.readFileSync(contractPath, 'utf8');

// Configure compiler input
const input = {
    language: 'Solidity',
    sources: {
        // Provide the main contract content here
        'TimedReleaseVoting.sol': {
            content: source
        }
        // Do NOT list dependencies here, the importCallback handles them
    },
    settings: {
        outputSelection: {
            '*': {
                '*': ['abi', 'evm.bytecode']
            }
        }
    }
};

// Compile the contract using the object interface and import callback
console.log('Compiling contract...');
// Use solc.compile with the input object and the import callback
const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));

// Check for errors
let errorsFound = false;
if (output.errors) {
    output.errors.forEach(error => {
        // Ignore warnings, only show errors
        if (error.severity === 'error') {
            console.error(error.formattedMessage);
            errorsFound = true;
        }
    });
}

// If there are severe errors, exit
if (errorsFound) {
    console.error('Compilation failed due to errors.');
    process.exit(1);
}

// Ensure the main contract was compiled
if (!output.contracts || 
    !output.contracts['TimedReleaseVoting.sol'] || 
    !output.contracts['TimedReleaseVoting.sol']['TimedReleaseVoting']) {
    console.error('Compilation succeeded, but expected contract \'TimedReleaseVoting\' not found in output.');
    console.error('Compiler Output:', JSON.stringify(output, null, 2)); // Log the output for debugging
    process.exit(1);
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