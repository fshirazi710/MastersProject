### Instructions for how to run the simple login system

1 - To run the react frontend, first you need to make sure you have node and npm installed. 
If you are using Windows you can follow the instructions here to install node on your computer, you want to install the most recent version on their site, which when I ran it was `v22.13.1`:
https://nodejs.org/en/download/
This will also install npm for you. 

2 - cd to `LoginSystem/frontend`. Then, run `npm install` if this is your first time running it and you don't have a `frontend/node_modules` folder. Finally, run `npm start` and the react frontend app should start running.

3 - To run the fast-api backend, first you need to make sure you have a few dependencies installed.
So open a cmd prompt **with admin privileges** (otherwise the dependencies may be installed to appdata instead of sitepackages, and thus not be added to your path automatically with all the other libraries in Python's sitepackages folder). Then run:
 `pip install fastapi uvicorn sqlalchemy databases pymysql aiomysql`

4 - After you install the dependencies, cd to `LoginSystem/backend` then run `fastapi dev main.py` and this will start up the fast-api backend.