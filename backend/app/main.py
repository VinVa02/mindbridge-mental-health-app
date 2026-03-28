from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="MindBridge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    message: str


@app.get("/")
def health_check():
    return {"message": "MindBridge backend is running"}


def analyze_message(message: str):
    text = message.lower()

    # High-risk keywords
    if any(word in text for word in ["suicide", "kill myself", "end my life", "self-harm", "hurt myself"]):
        return {
            "emotion": "crisis",
            "risk_level": "high",
            "reply": "I'm really sorry you're feeling this way. You deserve immediate support. Please contact a trusted person or crisis helpline right now."
        }

    # Medium-risk keywords
    elif any(word in text for word in ["hopeless", "can't go on", "worthless", "empty", "alone"]):
        return {
            "emotion": "distress",
            "risk_level": "medium",
            "reply": "I'm sorry you're going through this. You are not alone. It may help to talk to someone you trust today."
        }

    # Emotion detection
    elif any(word in text for word in ["stress", "stressed", "overwhelmed", "pressure"]):
        return {
            "emotion": "stress",
            "risk_level": "low",
            "reply": "It sounds like you're under a lot of pressure. Want to share what's making things feel overwhelming?"
        }

    elif any(word in text for word in ["sad", "down", "upset", "crying", "depressed"]):
        return {
            "emotion": "sadness",
            "risk_level": "low",
            "reply": "I'm sorry you're feeling this way. I'm here with you. Do you want to talk about what happened?"
        }

    elif any(word in text for word in ["anxious", "anxiety", "nervous", "worried", "panic"]):
        return {
            "emotion": "anxiety",
            "risk_level": "low",
            "reply": "That sounds really difficult. Take a slow breath. What has been making you feel anxious?"
        }

    elif any(word in text for word in ["angry", "mad", "frustrated", "annoyed"]):
        return {
            "emotion": "anger",
            "risk_level": "low",
            "reply": "It sounds like something really frustrated you. Want to tell me what happened?"
        }

    else:
        return {
            "emotion": "unknown",
            "risk_level": "low",
            "reply": "I'm here with you. Tell me a little more about what’s been weighing on you."
        }


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