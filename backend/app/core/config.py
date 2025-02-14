import configparser
from pathlib import Path
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define the path to the app.ini file
CONFIG_PATH = Path(__file__).parent.parent.parent / "api.ini"

# Load the configuration file
config = configparser.ConfigParser()
config.read(CONFIG_PATH)

logger.info(CONFIG_PATH)


# API Config
API_STR = config["API"].get("API_STR", "")
PROJECT_NAME = config["API"].get("PROJECT_NAME", "")

# CORS
CORS_ALLOWED_ORIGINS = config["CORS"].get("CORS_ALLOWED_ORIGINS", "*")

# Blockchain
WEB3_PROVIDER_URL = config["BLOCKCHAIN"].get("WEB3_PROVIDER_URL", "")
CONTACT_ADDRESS = config["BLOCKCHAIN"].get("CONTACT_ADDRESS", "")
PRIVATE_KEY = config["BLOCKCHAIN"].get("PRIVATE_KEY", "")

# Database
DATABASE_URL = config["DATABASE"].get("DATABASE_URL", "")

# Security
SECRET_KEY = config["SECURITY"].get("SECRET_KEY", "")
ACCESS_TOKEN_EXPIRE_MINUTES = config["SECURITY"].get("ACCESS_TOKEN_EXPIRE_MINUTES", "")
