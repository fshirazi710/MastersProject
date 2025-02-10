import configparser
from pathlib import Path

# Define the path to the app.ini file
CONFIG_PATH = Path(__file__).parent.parent / "api.ini"

# Load the configuration file
config = configparser.ConfigParser()
config.read(CONFIG_PATH)

# Extract values
CORS_ALLOWED_ORIGINS = config["CORS"].get("CORS_ALLOWED_ORIGINS", "*")
