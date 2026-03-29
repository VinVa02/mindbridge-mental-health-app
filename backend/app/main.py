from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import chat_collection
from app.schemas import ChatRequest
from app.services.analyzer import analyze_message
from app.services.gemini_service import generate_support_reply

app = FastAPI(title="MindBridge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {
        "status": "ok",
        "message": "MindBridge backend is running"
    }


@app.post("/api/chat")
def chat(payload: ChatRequest):
    message = payload.message.strip()

    if not message:
        return {"error": "Message is required"}

    result = analyze_message(message)

    # Keep rule-based reply for high-risk cases
    if result["risk_level"] == "high":
        final_reply = result["reply"]
    else:
        try:
            final_reply = generate_support_reply(
                user_message=message,
                emotion=result["emotion"],
                risk_level=result["risk_level"]
            )
        except Exception:
            final_reply = result["reply"]

    chat_document = {
        "user_message": message,
        "emotion": result["emotion"],
        "risk_level": result["risk_level"],
        "reply": final_reply,
        "created_at": datetime.now(timezone.utc)
    }

    insert_result = chat_collection.insert_one(chat_document)

    return {
        "id": str(insert_result.inserted_id),
        "user_message": message,
        "emotion": result["emotion"],
        "risk_level": result["risk_level"],
        "reply": final_reply,
        "timestamp": chat_document["created_at"].isoformat()
    }


@app.get("/api/chats")
def get_chats():
    chats = []

    for chat in chat_collection.find().sort("created_at", -1):
        chats.append({
            "id": str(chat["_id"]),
            "user_message": chat["user_message"],
            "emotion": chat["emotion"],
            "risk_level": chat["risk_level"],
            "reply": chat["reply"],
            "timestamp": chat["created_at"].isoformat() if chat.get("created_at") else None
        })

    return {"chats": chats}