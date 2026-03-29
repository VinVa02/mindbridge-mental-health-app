import os
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


def assess_mood_with_gemini(user_message: str) -> MoodAssessment:
    prompt = f"""
You are a supportive mental wellness assistant for an app called MindBridge.

Analyze the user's message and return:
- mood: choose exactly one from [happy, calm, stress, anxiety, sadness, anger, loneliness, distress, crisis, unknown]
- intensity: integer from 1 to 5
- risk_level: choose exactly one from [low, medium, high]
- reasoning: one short sentence explaining the classification
- reply: a supportive reply in 2 to 4 sentences

Rules:
- Be empathetic and calm.
- Do not diagnose medical conditions.
- Do not mention that you are an AI.
- If the message suggests self-harm, suicide, or immediate danger, set mood=crisis and risk_level=high.
- Keep the reply supportive and natural.

User message:
{user_message}
"""

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": MoodAssessment,
        },
    )

    return response.parsed