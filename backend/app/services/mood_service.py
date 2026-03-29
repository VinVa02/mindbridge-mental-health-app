import os
import json
import re
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY is not set in .env")

client = genai.Client(api_key=GEMINI_API_KEY)


class MoodAssessment(BaseModel):
    mood: str
    intensity: int
    risk_level: str
    reasoning: str
    reply: str


def _extract_json(text: str) -> dict:
    text = text.strip()

    try:
        return json.loads(text)
    except Exception:
        pass

    text = re.sub(r"^```json\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^```\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    try:
        return json.loads(text)
    except Exception:
        pass

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))

    raise ValueError("No valid JSON found")


def _fallback() -> MoodAssessment:
    return MoodAssessment(
        mood="unknown",
        intensity=3,
        risk_level="low",
        reasoning="Fallback mood assessment used due to Gemini parsing failure.",
        reply="I’m here with you. Would you like to share a little more about what’s been on your mind?"
    )


def assess_mood_with_gemini(user_message: str) -> MoodAssessment:
    prompt = f"""
You are a supportive mental wellness assistant for an app called MindBridge.

Return ONLY valid JSON with this shape:
{{
  "mood": "happy|calm|stress|anxiety|sadness|anger|loneliness|distress|crisis|unknown",
  "intensity": 1,
  "risk_level": "low|medium|high",
  "reasoning": "one short sentence",
  "reply": "a supportive reply in 3 to 5 sentences"
}}

Rules:
- Be empathetic, calm, warm, and natural.
- Do not diagnose medical conditions.
- Do not mention that you are an AI.
- If the message suggests self-harm, suicide, homicide, or immediate danger, set mood="crisis" and risk_level="high".
- intensity must be an integer from 1 to 5.
- Return JSON only. No markdown.

User message:
{user_message}
"""

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )

        raw_text = (response.text or "").strip()
        print("DEBUG mood_service raw text:", raw_text)

        data = _extract_json(raw_text)

        mood = str(data.get("mood", "unknown")).strip().lower()
        risk_level = str(data.get("risk_level", "low")).strip().lower()
        reasoning = str(data.get("reasoning", "")).strip()
        reply = str(data.get("reply", "")).strip()

        try:
            intensity = int(data.get("intensity", 3))
        except Exception:
            intensity = 3

        allowed_moods = {
            "happy", "calm", "stress", "anxiety", "sadness",
            "anger", "loneliness", "distress", "crisis", "unknown"
        }
        allowed_risks = {"low", "medium", "high"}

        if mood not in allowed_moods:
            mood = "unknown"
        if risk_level not in allowed_risks:
            risk_level = "low"

        intensity = max(1, min(intensity, 5))

        if not reasoning:
            reasoning = "The message suggests emotional distress and may need support."
        if not reply:
            reply = "I’m here with you. Would you like to share a little more about what’s been on your mind?"

        return MoodAssessment(
            mood=mood,
            intensity=intensity,
            risk_level=risk_level,
            reasoning=reasoning,
            reply=reply,
        )

    except Exception as e:
        print("DEBUG mood_service Gemini error:", repr(e))
        return _fallback()