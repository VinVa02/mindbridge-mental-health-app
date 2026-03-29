from datetime import datetime, timezone
from io import BytesIO

from bson import ObjectId
from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from app.services.rag_service import retrieve_relevant_chunks
from app.services.grounded_chat_service import generate_grounded_reply

from app.database import chat_session_collection, resource_collection
from app.services.resource_service import get_matching_resources
from app.services.mood_service import assess_mood_with_gemini
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
    session_id = getattr(payload, "session_id", None)

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
    timestamp = datetime.now(timezone.utc)

    user_message_doc = {
        "sender": "user",
        "text": message,
        "emotion": final_emotion,
        "intensity": final_intensity,
        "risk_level": final_risk,
        "reasoning": final_reasoning,
        "timestamp": timestamp
    }

    bot_message_doc = {
        "sender": "bot",
        "text": final_reply,
        "emotion": final_emotion,
        "intensity": final_intensity,
        "risk_level": final_risk,
        "reasoning": final_reasoning,
        "resources": matching_resources,
        "timestamp": timestamp
    }

    if session_id:
        try:
            session_object_id = ObjectId(session_id)
        except Exception:
            return JSONResponse(status_code=400, content={"error": "Invalid session_id"})

        existing_session = chat_session_collection.find_one({
            "_id": session_object_id,
            "archived": {"$ne": True}
        })

        if not existing_session:
            return JSONResponse(status_code=404, content={"error": "Session not found"})

        chat_session_collection.update_one(
            {"_id": session_object_id},
            {
                "$push": {
                    "messages": {
                        "$each": [user_message_doc, bot_message_doc]
                    }
                },
                "$set": {
                    "updated_at": timestamp
                }
            }
        )
        current_session_id = session_id
    else:
        session_doc = {
            "title": message[:40],
            "created_at": timestamp,
            "updated_at": timestamp,
            "archived": False,
            "messages": [user_message_doc, bot_message_doc]
        }
        insert_result = chat_session_collection.insert_one(session_doc)
        current_session_id = str(insert_result.inserted_id)

    return {
        "session_id": current_session_id,
        "user_message": message,
        "emotion": final_emotion,
        "intensity": final_intensity,
        "risk_level": final_risk,
        "reasoning": final_reasoning,
        "reply": final_reply,
        "resources": matching_resources,
        "timestamp": timestamp.isoformat()
    }


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


@app.get("/api/chat-sessions")
def get_chat_sessions():
    sessions = []

    for session in chat_session_collection.find(
        {"archived": {"$ne": True}}
    ).sort("updated_at", -1):
        sessions.append({
            "id": str(session["_id"]),
            "title": session.get("title", "New Chat"),
            "created_at": session["created_at"].isoformat() if session.get("created_at") else None,
            "updated_at": session["updated_at"].isoformat() if session.get("updated_at") else None,
            "message_count": len(session.get("messages", []))
        })

    return {"sessions": sessions}


@app.get("/api/chat-sessions/{session_id}")
def get_chat_session(session_id: str):
    try:
        session = chat_session_collection.find_one({
            "_id": ObjectId(session_id),
            "archived": {"$ne": True}
        })
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid session id"})

    if not session:
        return JSONResponse(status_code=404, content={"error": "Session not found"})

    messages = []
    for msg in session.get("messages", []):
        messages.append({
            "sender": msg["sender"],
            "text": msg["text"],
            "emotion": msg.get("emotion"),
            "intensity": msg.get("intensity"),
            "risk_level": msg.get("risk_level"),
            "reasoning": msg.get("reasoning"),
            "resources": msg.get("resources", []),
            "timestamp": msg["timestamp"].isoformat() if msg.get("timestamp") else None
        })

    return {
        "id": str(session["_id"]),
        "title": session.get("title", "New Chat"),
        "created_at": session["created_at"].isoformat() if session.get("created_at") else None,
        "updated_at": session["updated_at"].isoformat() if session.get("updated_at") else None,
        "messages": messages
    }


@app.patch("/api/chat-sessions/{session_id}/archive")
def archive_chat_session(session_id: str):
    try:
        result = chat_session_collection.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": {"archived": True, "updated_at": datetime.now(timezone.utc)}}
        )
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid session id"})

    if result.matched_count == 0:
        return JSONResponse(status_code=404, content={"error": "Session not found"})

    return {"message": "Session archived successfully"}


@app.delete("/api/chat-sessions/{session_id}")
def delete_chat_session(session_id: str):
    try:
        result = chat_session_collection.delete_one({"_id": ObjectId(session_id)})
    except Exception:
        return JSONResponse(status_code=400, content={"error": "Invalid session id"})

    if result.deleted_count == 0:
        return JSONResponse(status_code=404, content={"error": "Session not found"})

    return {"message": "Session deleted successfully"}


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