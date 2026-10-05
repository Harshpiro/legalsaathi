from motor.motor_asyncio import AsyncIOMotorClient
from config import settings

_client: AsyncIOMotorClient | None = None
_db = None


async def connect_db() -> None:
    global _client, _db
    _client = AsyncIOMotorClient(settings.MONGODB_URI)
    _db = _client[settings.MONGODB_DB]
    await _db.command("ping")
    print(f"MongoDB connected: {settings.MONGODB_DB}")


async def close_db() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
        print("MongoDB connection closed")


def get_db():
    if _db is None:
        raise RuntimeError("Database not connected — call connect_db() first")
    return _db


def get_documents_col():
    return get_db().documents


def get_chats_col():
    return get_db().chats
