from datetime import datetime, timezone
from io import BytesIO

from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from app.database import chat_session_collection, resource_collection
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
from app.services.grounded_chat_service import generate_grounded_reply
from app.services.mood_service import assess_mood_with_gemini
from app.services.rag_service import retrieve_relevant_chunks
from app.services.resource_service import get_matching_resources

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


def serialize_resource(item):
    return {
        "id": str(item["_id"]),
        "title": item.get("title", ""),
        "type": item.get("type", item.get("source_type", "resource")),
        "url": item.get("url", item.get("source_url", "")),
        "file_name": item.get("file_name", ""),
        "description": item.get("description", ""),
        "moods": item.get("moods", item.get("topic_tags", [])),
        "risk_levels": item.get("risk_levels", item.get("risk_tags", [])),
    }


def get_resources_by_titles(titles: list[str]):
    if not titles:
        return []

    seen = set()
    ordered_titles = []

    for title in titles:
        if title and title not in seen:
            seen.add(title)
            ordered_titles.append(title)

    results = []
    cursor = resource_collection.find({"title": {"$in": ordered_titles}})

    docs_by_title = {}
    for doc in cursor:
        docs_by_title[doc.get("title")] = serialize_resource(doc)

    for title in ordered_titles:
        if title in docs_by_title:
            results.append(docs_by_title[title])

    return results


def summarize_retrieved_chunks(chunks: list[dict]):
    results = []

    for chunk in chunks:
        results.append({
            "title": chunk.get("title", ""),
            "chunk_index": chunk.get("chunk_index"),
            "score": chunk.get("score"),
            "text_preview": (chunk.get("text", "")[:250] + "...") if chunk.get("text") else ""
        })

    return results


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

    # Step 1: mood + risk assessment
    try:
        mood_result = assess_mood_with_gemini(message)

        final_emotion = mood_result.mood
        final_intensity = mood_result.intensity
        final_risk = mood_result.risk_level
        final_reasoning = mood_result.reasoning
        final_reply = mood_result.reply

        # safety override from keyword analyzer
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
        "timestamp": timestamp
    }

    # Step 4: save to session
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
        "timestamp": timestamp.isoformat()
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