import os
import json
from dotenv import load_dotenv
from google import genai

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

client = genai.Client(api_key=GEMINI_API_KEY)


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
- Mark risk_level="crisis" if there are strong signs of self-harm or suicide.
- Mark risk_level="high" if there is severe hopelessness or distress.
- Keep reasoning_short brief and non-judgmental.
- reply should be warm, safe, and concise.
- Return JSON only. No extra text.
"""

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt
    )

    text = response.text.strip()

    # ✅ Safe JSON parsing with fallback
    try:
        data = json.loads(text)
    except Exception:
        data = {
            "mood": "unknown",
            "risk_level": "low",
            "confidence": 0.5,
            "needs_resources": False,
            "resource_tags": [],
            "reasoning_short": "Fallback due to parsing error",
            "reply": "I'm here with you. Do you want to share more about what's on your mind?"
        }

    return data