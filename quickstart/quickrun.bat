

@echo off
@REM These instructions assume you have installed npx, npm, and anaconda and are on Windows.
@REM That you have ran "npm install" in /frontend
@REM And that you have created a conda environment with all requirements installed like so:
@REM conda create --name masters_venv python=3.12.9
@REM cd backend && pip install -r requirements.txt
@REM And have an "api.ini" file in /backend and a ".env" file in /crypto-core

rem save the root directory
pushd ..
set ROOTDIR=%cd%
popd
echo %ROOTDIR%

rem Store the command for activating the venv
set CONDA_ENV=masters_venv
set ACTIVATE_VENV=conda activate %CONDA_ENV%

rem Run a local blockchain node
start /min cmd /c "cd %ROOTDIR%\quickstart\hardhat && npx hardhat node"

rem Run the frontend server
start /min cmd /c "cd %ROOTDIR%\frontend && npm run dev"

rem Run the backend server
start /min cmd /c "cd %ROOTDIR%\backend && %ACTIVATE_VENV% && uvicorn main:app --reload"

rem Compile and deploy the smart contract handling all blockchain interactions then close the window
start /min cmd /c "cd %ROOTDIR%\crypto-core && %ACTIVATE_VENV% && npm run compile && npm run deploy"
