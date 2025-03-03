import configparser
from pathlib import Path
import logging
import json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define the path to the app.ini file
CONFIG_PATH = Path(__file__).parent.parent.parent / "api.ini"

# Load the configuration file
config = configparser.ConfigParser()
config.read(CONFIG_PATH)

# API Config
API_STR = config["API"].get("API_STR", "")
PROJECT_NAME = config["API"].get("PROJECT_NAME", "")

# CORS - Parse as JSON list
try:
    CORS_ALLOWED_ORIGINS = json.loads(config["CORS"].get("CORS_ALLOWED_ORIGINS", '["http://localhost:3000"]'))
except json.JSONDecodeError:
    logger.warning("Invalid CORS_ALLOWED_ORIGINS format, defaulting to localhost:3000")
    CORS_ALLOWED_ORIGINS = ["http://localhost:3000"]

# Blockchain
WEB3_PROVIDER_URL = config["BLOCKCHAIN"].get("WEB3_PROVIDER_URL", "")
CONTRACT_ADDRESS = config["BLOCKCHAIN"].get("CONTRACT_ADDRESS", "")
WALLET_ADDRESS = config["BLOCKCHAIN"].get("WALLET_ADDRESS", "")
CONTRACT_ABI = config["BLOCKCHAIN"].get("CONTRACT_ABI", "")
PRIVATE_KEY = config["BLOCKCHAIN"].get("PRIVATE_KEY", "")

# Database
DATABASE_URL = config["DATABASE"].get("DATABASE_URL", "")

# Security
SECRET_KEY = config["SECURITY"].get("SECRET_KEY", "")
ACCESS_TOKEN_EXPIRE_MINUTES = config["SECURITY"].get("ACCESS_TOKEN_EXPIRE_MINUTES", "")

# JWT Configuration
JWT_SECRET_KEY = config["JWT"].get("JWT_SECRET_KEY", "")
ALGORITHM = config["JWT"].get("ALGORITHM", "")