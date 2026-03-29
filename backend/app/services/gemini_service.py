import os
from dotenv import load_dotenv
from google import genai

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

client = genai.Client(api_key=GEMINI_API_KEY)


def generate_support_reply(user_message: str, emotion: str, risk_level: str) -> str:
    prompt = f"""
You are a calm, supportive mental wellness assistant for a hackathon MVP called MindBridge.

User message: "{user_message}"
Detected emotion: {emotion}
Detected risk level: {risk_level}

Instructions:
- Respond with empathy and emotional support.
- Keep the response short: 2 to 4 sentences.
- Do not sound robotic.
- Do not diagnose medical conditions.
- Do not mention being an AI model.
- Encourage the user to share more if appropriate.
- If risk level is high, encourage immediate support from a trusted person or crisis helpline.
"""

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt
    )

    return response.text.strip()