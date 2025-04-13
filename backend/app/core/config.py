import configparser
from pathlib import Path
import logging
import json
from pydantic_settings import BaseSettings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define the path to the app.ini file
CONFIG_PATH = Path(__file__).parent.parent.parent / "api.ini"

# Load the configuration file
config = configparser.ConfigParser()
config.read(CONFIG_PATH)

class Settings(BaseSettings):
    # API Config
    API_STR: str = config["API"].get("API_STR", "")
    PROJECT_NAME: str = config["API"].get("PROJECT_NAME", "")

    # CORS
    CORS_ALLOWED_ORIGINS: list = json.loads(config["CORS"].get("CORS_ALLOWED_ORIGINS", '["https://masters-project-umber.vercel.app"]'))

    # Blockchain
    WEB3_PROVIDER_URL: str = config["BLOCKCHAIN"].get("WEB3_PROVIDER_URL", "")
    CONTRACT_ADDRESS: str = config["BLOCKCHAIN"].get("CONTRACT_ADDRESS", "")
    WALLET_ADDRESS: str = config["BLOCKCHAIN"].get("WALLET_ADDRESS", "")
    PRIVATE_KEY: str = config["BLOCKCHAIN"].get("PRIVATE_KEY", "")

    # Database
    DATABASE_URL: str = config["DATABASE"].get("DATABASE_URL", "")

    # Security
    SECRET_KEY: str = config["SECURITY"].get("SECRET_KEY", "")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(config["SECURITY"].get("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

    # JWT Configuration
    JWT_SECRET_KEY: str = config["JWT"].get("JWT_SECRET_KEY", "")
    ALGORITHM: str = config["JWT"].get("ALGORITHM", "")

    class Config:
        case_sensitive = True

# Create settings instance
settings = Settings()

# Keep the individual variables for backward compatibility
API_STR = settings.API_STR
PROJECT_NAME = settings.PROJECT_NAME
CORS_ALLOWED_ORIGINS = settings.CORS_ALLOWED_ORIGINS
WEB3_PROVIDER_URL = settings.WEB3_PROVIDER_URL
CONTRACT_ADDRESS = settings.CONTRACT_ADDRESS
WALLET_ADDRESS = settings.WALLET_ADDRESS
PRIVATE_KEY = settings.PRIVATE_KEY
DATABASE_URL = settings.DATABASE_URL
SECRET_KEY = settings.SECRET_KEY
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
JWT_SECRET_KEY = settings.JWT_SECRET_KEY
ALGORITHM = settings.ALGORITHM