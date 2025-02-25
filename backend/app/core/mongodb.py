from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import DATABASE_URL


class MongoDB:
    client: AsyncIOMotorClient = None


async def get_mongodb() -> AsyncIOMotorClient:
    return MongoDB.client


async def connect_to_mongo():
    MongoDB.client = AsyncIOMotorClient(DATABASE_URL)


async def close_mongo_connection():
    if MongoDB.client:
        MongoDB.client.close()
