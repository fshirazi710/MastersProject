
set ROOTDIR=%cd%\..

echo %ROOTDIR%

rem Run a local blockchain node
start /min cmd /c "cd %ROOTDIR%\quickstart\hardhat && npx hardhat node"

rem Run the frontend server
start /min cmd /c "cd %ROOTDIR%\frontend && npm run dev"

rem Run the backend server
start /min cmd /c "cd %ROOTDIR%\backend && conda activate masters_venv && uvicorn main:app --reload"

rem Compile and deploy the smart contract handling all blockchain interactions then close the window
start /min cmd /c "cd %ROOTDIR%\crypto-core && conda activate masters_venv && npm run compile && npm run deploy"
