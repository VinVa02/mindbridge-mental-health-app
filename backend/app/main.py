from datetime import datetime, timezone
from io import BytesIO

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from app.database import chat_collection
from app.schemas import ChatRequest
from app.services.analyzer import analyze_message
from app.services.gemini_service import generate_support_reply
from app.services.elevenlabs_service import (
    generate_tts_audio,
    transcribe_audio,
    convert_speech_to_speech,
)

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

    result = analyze_message(message)

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


@app.post("/api/tts")
def text_to_speech(text: str = Form(...)):
    text = text.strip()

    if not text:
        return JSONResponse(status_code=400, content={"error": "Text is required"})

    try:
        audio_bytes = generate_tts_audio(text)
        return StreamingResponse(
            BytesIO(audio_bytes),
            media_type="audio/mpeg",
            headers={"Content-Disposition": "inline; filename=reply.mp3"}
        )
    except Exception as e:
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