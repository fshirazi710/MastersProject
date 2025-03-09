from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import DATABASE_URL


class MongoDB:
    client: AsyncIOMotorClient = None
    db = None


async def get_mongodb():
    """
    Get the MongoDB database instance.
    Returns the database, not just the client.
    """
    return MongoDB.db


async def connect_to_mongo():
    """
    Connect to MongoDB and set up the database.
    """
    MongoDB.client = AsyncIOMotorClient(DATABASE_URL)
    MongoDB.db = MongoDB.client.get_database("auth_db")


async def close_mongo_connection():
    if MongoDB.client:
        MongoDB.client.close()
