from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.schemas import ChatRequest
from app.services.analyzer import analyze_message

app = FastAPI(title="MindBridge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health_check():
    return {"message": "MindBridge backend is running"}


@app.post("/api/chat")
def chat(payload: ChatRequest):
    message = payload.message.strip()

    if not message:
        return {"error": "Message is required"}

    result = analyze_message(message)

    return {
        "user_message": message,
        "emotion": result["emotion"],
        "risk_level": result["risk_level"],
        "reply": result["reply"]
    }