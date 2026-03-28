from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime

from app.schemas import ChatRequest
from app.services.analyzer import analyze_message

app = FastAPI(title="MindBridge API")


# CORS configuration (IMPORTANT for frontend)
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


# Health check route
@app.get("/")
def health_check():
    return {
        "status": "ok",
        "message": "MindBridge backend is running"
    }


# Chat endpoint
@app.post("/api/chat")
def chat(payload: ChatRequest):
    message = payload.message.strip()

    if not message:
        return {
            "error": "Message is required"
        }

    # Analyze message using Phase B logic
    result = analyze_message(message)

    return {
        "user_message": message,
        "emotion": result["emotion"],
        "risk_level": result["risk_level"],
        "reply": result["reply"],
        "timestamp": datetime.utcnow().isoformat()
    }