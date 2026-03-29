import os
import json
import re
from dotenv import load_dotenv
from google import genai

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY is not set in .env")

client = genai.Client(api_key=GEMINI_API_KEY)


def extract_json_from_text(text: str) -> dict:
    """
    Safely extract JSON even if Gemini wraps it in markdown fences
    or adds extra text.
    """
    text = text.strip()

    # Try direct JSON parse
    try:
        return json.loads(text)
    except Exception:
        pass

    # Remove markdown code fences if present
    text = re.sub(r"^```json\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"^```\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    try:
        return json.loads(text)
    except Exception:
        pass

    # Try to extract first JSON object
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass

    raise ValueError("Could not extract valid JSON from Gemini response")


def analyze_message_with_gemini(user_message: str) -> dict:
    prompt = f"""
You are a mental wellness support assistant.
Analyze the user's message and return ONLY valid JSON.

User message:
"{user_message}"

Schema:
{{
  "mood": "string",
  "risk_level": "low|medium|high|crisis",
  "confidence": 0.0,
  "needs_resources": true,
  "resource_tags": ["string"],
  "reasoning_short": "short explanation",
  "reply": "empathetic supportive reply"
}}

Rules:
- Detect emotional state from tone, wording, and intensity.
- Mark risk_level="crisis" if there are strong signs of self-harm, suicide, immediate danger, or intent.
- Mark risk_level="high" if there is severe hopelessness or distress.
- Mark risk_level="medium" if the user shows sadness, stress, anxiety, loneliness, or emotional struggle.
- Mark risk_level="low" if the distress is mild or unclear.
- Keep reasoning_short brief and non-judgmental.
- reply should be warm, safe, supportive, and directly responsive to the user.
- Return JSON only. No extra text. No markdown.
"""

    fallback_data = {
        "mood": "unknown",
        "risk_level": "low",
        "confidence": 0.5,
        "needs_resources": False,
        "resource_tags": [],
        "reasoning_short": "Fallback due to parsing error.",
        "reply": "I'm here with you. Do you want to share more about what's on your mind?"
    }

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config={
                "response_mime_type": "application/json"
            }
        )

        raw_text = (response.text or "").strip()
        print("DEBUG Gemini raw response:", raw_text)

        data = extract_json_from_text(raw_text)

        # Normalize fields safely
        mood = str(data.get("mood", "unknown")).strip() or "unknown"
        risk_level = str(data.get("risk_level", "low")).strip().lower() or "low"
        confidence = data.get("confidence", 0.5)
        needs_resources = data.get("needs_resources", False)
        resource_tags = data.get("resource_tags", [])
        reasoning_short = str(data.get("reasoning_short", "Brief emotional analysis.")).strip()
        reply = str(data.get("reply", "I'm here with you. Do you want to share more about what's on your mind?")).strip()

        allowed_risk_levels = {"low", "medium", "high", "crisis"}
        if risk_level not in allowed_risk_levels:
            risk_level = "low"

        try:
            confidence = float(confidence)
            confidence = max(0.0, min(confidence, 1.0))
        except Exception:
            confidence = 0.5

        if not isinstance(needs_resources, bool):
            needs_resources = False

        if not isinstance(resource_tags, list):
            resource_tags = []

        resource_tags = [str(tag).strip() for tag in resource_tags if str(tag).strip()]

        return {
            "mood": mood,
            "risk_level": risk_level,
            "confidence": confidence,
            "needs_resources": needs_resources,
            "resource_tags": resource_tags,
            "reasoning_short": reasoning_short,
            "reply": reply
        }

    except Exception as e:
        print("DEBUG analyze_message_with_gemini failed:", repr(e))
        return fallback_data