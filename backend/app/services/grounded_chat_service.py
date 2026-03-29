import os
import json
import re
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


def generate_grounded_reply(
    user_message: str,
    mood: str,
    risk_level: str,
    retrieved_chunks: list[dict]
) -> GroundedReply:
    if not retrieved_chunks:
        return GroundedReply(
            reply="I’m here with you. Tell me a little more about what feels hardest right now.",
            used_titles=[]
        )

    used_titles = [chunk.get("title", "Untitled Resource") for chunk in retrieved_chunks]

    context_blocks = []
    for i, chunk in enumerate(retrieved_chunks, start=1):
        title = chunk.get("title", "Untitled Resource")
        text = chunk.get("text", "")
        context_blocks.append(f"[Source {i}] Title: {title}\nContent: {text}")

    context_text = "\n\n".join(context_blocks)

    prompt = f"""
You are MindBridge, a compassionate mental wellness support assistant.

Return ONLY valid JSON:
{{
  "reply": "string",
  "used_titles": ["string"]
}}

Rules:
- Respond warmly and empathetically.
- Directly address the user's message.
- Use the provided resource context when relevant.
- Do not diagnose medical conditions.
- Do not invent facts not present in the resources.
- Keep the response to about 3 to 5 sentences.
- If risk is high, prioritize immediate support and safety.
- Return JSON only. No markdown.

User message:
{user_message}

Detected mood:
{mood}

Detected risk level:
{risk_level}

Resource context:
{context_text}
"""

    try:
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=prompt,
            config={"response_mime_type": "application/json"},
        )

        raw_text = (response.text or "").strip()
        print("DEBUG grounded_chat raw text:", raw_text)

        data = _extract_json(raw_text)

        reply = str(data.get("reply", "")).strip()
        returned_titles = data.get("used_titles", used_titles)

        if not isinstance(returned_titles, list):
            returned_titles = used_titles

        returned_titles = [str(t).strip() for t in returned_titles if str(t).strip()]

        if not reply:
            reply = "I’m here with you. Tell me a little more about what feels hardest right now."

        if not returned_titles:
            returned_titles = used_titles

        return GroundedReply(reply=reply, used_titles=returned_titles)

    except Exception as e:
        print("DEBUG grounded_chat error:", repr(e))
        return GroundedReply(
            reply="I’m here with you. Tell me a little more about what feels hardest right now.",
            used_titles=used_titles
        )