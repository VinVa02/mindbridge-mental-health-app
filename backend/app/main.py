from datetime import datetime, timezone
from io import BytesIO

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from app.services.resource_service import get_matching_resources
from app.services.mood_service import assess_mood_with_gemini
from app.database import chat_collection, resource_collection
from app.schemas import ChatRequest
from app.services.analyzer import analyze_message
from app.services.elevenlabs_service import (
    generate_tts_audio,
    transcribe_audio,
    convert_speech_to_speech,
)

print("DEBUG: main.py loaded")

app = FastAPI(title="MindBridge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
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

    fallback = analyze_message(message)

    try:
        mood_result = assess_mood_with_gemini(message)

        final_emotion = mood_result.mood
        final_intensity = mood_result.intensity
        final_risk = mood_result.risk_level
        final_reasoning = mood_result.reasoning
        final_reply = mood_result.reply

        if fallback["risk_level"] == "high":
            final_emotion = fallback["emotion"]
            final_intensity = 5
            final_risk = fallback["risk_level"]
            final_reasoning = "Keyword safety override triggered."
            final_reply = fallback["reply"]

    except Exception as e:
        print("DEBUG /api/chat Gemini mood assessment failed:", repr(e))

        final_emotion = fallback["emotion"]
        final_intensity = 3
        final_risk = fallback["risk_level"]
        final_reasoning = "Fallback analyzer used."
        final_reply = fallback["reply"]

    matching_resources = get_matching_resources(final_emotion, final_risk)

    chat_document = {
        "user_message": message,
        "emotion": final_emotion,
        "intensity": final_intensity,
        "risk_level": final_risk,
        "reasoning": final_reasoning,
        "reply": final_reply,
        "resources": matching_resources,
        "created_at": datetime.now(timezone.utc)
    }

    insert_result = chat_collection.insert_one(chat_document)

    return {
        "id": str(insert_result.inserted_id),
        "user_message": message,
        "emotion": final_emotion,
        "intensity": final_intensity,
        "risk_level": final_risk,
        "reasoning": final_reasoning,
        "reply": final_reply,
        "resources": matching_resources,
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


@app.post("/api/tts")
def text_to_speech(text: str = Form(...)):
    text = text.strip()

    if not text:
        return JSONResponse(status_code=400, content={"error": "Text is required"})

    try:
        print("DEBUG /api/tts received text:", text)
        audio_bytes = generate_tts_audio(text)
        print("DEBUG /api/tts returning bytes:", len(audio_bytes))

        return StreamingResponse(
            BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=reply.mp3"}
        )
    except Exception as e:
        print("DEBUG /api/tts exception:", repr(e))
        return JSONResponse(
            status_code=500,
            content={"error": f"TTS failed: {str(e)}"}
        )


@app.post("/api/stt")
async def speech_to_text(file: UploadFile = File(...)):
    file_bytes = await file.read()

    if not file_bytes:
        return JSONResponse(status_code=400, content={"error": "Audio file is required"})

    try:
        transcript = transcribe_audio(file.filename or "audio.webm", file_bytes)
        return {"transcript": transcript}
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"STT failed: {str(e)}"}
        )


@app.post("/api/sts")
async def speech_to_speech(file: UploadFile = File(...)):
    file_bytes = await file.read()

    if not file_bytes:
        return JSONResponse(status_code=400, content={"error": "Audio file is required"})

    try:
        audio_bytes = convert_speech_to_speech(file.filename or "audio.webm", file_bytes)
        return StreamingResponse(
            BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=converted.mp3"}
        )
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"STS failed: {str(e)}"}
        )

@app.get("/api/resources")
def get_resources():
    resources = []

    for item in resource_collection.find():
        resources.append({
            "id": str(item["_id"]),
            "title": item["title"],
            "type": item["type"],
            "url": item["url"],
            "description": item.get("description", ""),
            "moods": item.get("moods", []),
            "risk_levels": item.get("risk_levels", [])
        })

    return {"resources": resources}