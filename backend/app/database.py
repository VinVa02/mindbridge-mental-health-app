import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB_NAME = os.getenv("MONGODB_DB_NAME", "mindbridge")

if not MONGODB_URI:
    raise ValueError("MONGODB_URI is not set in the .env file")

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB_NAME]

chat_collection = db["chats"]