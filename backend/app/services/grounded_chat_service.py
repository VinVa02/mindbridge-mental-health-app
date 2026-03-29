import os
from dotenv import load_dotenv
from google import genai
from pydantic import BaseModel, Field

load_dotenv()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY is not set in .env")

client = genai.Client(api_key=GEMINI_API_KEY)


class GroundedReply(BaseModel):
    reply: str = Field(description="Supportive grounded response")
    used_titles: list[str] = Field(description="Titles of resources used")


def generate_grounded_reply(
    user_message: str,
    mood: str,
    risk_level: str,
    retrieved_chunks: list[dict]
) -> GroundedReply:
    context_blocks = []

    for i, chunk in enumerate(retrieved_chunks, start=1):
        context_blocks.append(
            f"[Source {i}] Title: {chunk['title']}\nContent: {chunk['text']}"
        )

    context_text = "\n\n".join(context_blocks)

    prompt = f"""
You are MindBridge, a supportive mental wellness assistant.

Use only the resource context below when giving guidance.
Do not diagnose medical conditions.
Do not invent facts not present in the resources.
Keep the response empathetic and practical.
If risk is high, prioritize immediate crisis guidance.

User message:
{user_message}

Detected mood:
{mood}

Detected risk level:
{risk_level}

Resource context:
{context_text}
"""

    response = client.models.generate_content(
        model=GEMINI_MODEL,
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": GroundedReply,
        }
    )

    return response.parsed