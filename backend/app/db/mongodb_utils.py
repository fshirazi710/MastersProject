"""
Utilities for MongoDB connection using Motor.
"""
import motor.motor_asyncio
from app.core.config import settings
import logging

logger = logging.getLogger(__name__)

class MongoDB:
    client: motor.motor_asyncio.AsyncIOMotorClient = None
    db = None

    async def connect_to_mongo(self):
        logger.info("Connecting to MongoDB...")
        try:
            self.client = motor.motor_asyncio.AsyncIOMotorClient(settings.DATABASE_URL)
            # You might want to specify the database name directly
            # Example: self.db = self.client.your_database_name
            # If DATABASE_URL includes the db name, Motor might pick it up automatically.
            # Let's assume the DB name needs to be specified or parsed.
            # For now, let's postpone selecting the db until it's needed, 
            # or require it in DATABASE_URL format.
            # Check connection:
            await self.client.admin.command('ping') # Ping the server
            logger.info("Successfully connected to MongoDB!")
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            # Depending on the application, you might want to raise the error
            # or handle it to allow the app to start but log the failure.
            self.client = None # Ensure client is None if connection fails
            raise ConnectionError(f"Could not connect to MongoDB: {e}")

    async def close_mongo_connection(self):
        logger.info("Closing MongoDB connection...")
        if self.client:
            self.client.close()
            logger.info("MongoDB connection closed.")
            self.client = None
            self.db = None
        else:
            logger.info("No active MongoDB connection to close.")

    def get_database(self, db_name: str = "your_default_db_name"): # Replace with your actual default DB name
        """Gets the database instance. Specify db_name or ensure it's in DATABASE_URL."""
        if self.client:
            # Try to get DB name from settings.DATABASE_URL if not provided
            # This parsing logic might need refinement based on URL format
            parsed_db_name = None
            if hasattr(settings, 'DATABASE_URL') and settings.DATABASE_URL:
                try:
                    # Basic parsing assuming format mongodb://.../dbname?...
                    path = settings.DATABASE_URL.split('/')[-1]
                    parsed_db_name = path.split('?')[0]
                except Exception:
                    logger.warning("Could not automatically parse database name from DATABASE_URL.")
            
            target_db_name = db_name if db_name != "your_default_db_name" else parsed_db_name
            
            if not target_db_name:
                 logger.error("MongoDB database name not specified and could not be parsed from URL.")
                 # Decide on behavior: raise error or return None?
                 raise ValueError("MongoDB database name is required.")
                 
            self.db = self.client[target_db_name]
            logger.debug(f"Accessed database: {target_db_name}")
            return self.db
        else:
            logger.error("MongoDB client not initialized. Cannot get database.")
            return None

# Create a single instance of the MongoDB connection manager
mongodb_manager = MongoDB()

# --- Dependency for FastAPI --- 
# This provides a way to get the db instance in routers/services
# Adjust db_name as needed
async def get_mongo_db():
    db_instance = mongodb_manager.get_database(db_name="timedReleaseCryptoDB") # Example DB name
    if db_instance is None:
        # This might happen if connection failed during startup
        raise HTTPException(status_code=503, detail="Database connection not available.")
    return db_instance

# --- Event Handlers for FastAPI Startup/Shutdown --- 
# These should be registered in main.py
async def startup_db_client():
    await mongodb_manager.connect_to_mongo()

async def shutdown_db_client():
    await mongodb_manager.close_mongo_connection() 