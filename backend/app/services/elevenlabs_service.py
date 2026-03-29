import os
from io import BytesIO
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

load_dotenv()

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID")

if not ELEVENLABS_API_KEY:
    raise ValueError("ELEVENLABS_API_KEY is not set in .env")

client = ElevenLabs(api_key=ELEVENLABS_API_KEY)


def generate_tts_audio(text: str) -> bytes:
    audio_stream = client.text_to_speech.convert(
        voice_id=ELEVENLABS_VOICE_ID,
        text=text,
        model_id="eleven_flash_v2_5",
        output_format="mp3_44100_128",
    )

    audio_bytes = b"".join(audio_stream)
    return audio_bytes


def transcribe_audio(file_name: str, file_bytes: bytes) -> str:
    audio_file = BytesIO(file_bytes)
    audio_file.name = file_name

    result = client.speech_to_text.convert(
        file=audio_file,
        model_id="scribe_v2"
    )

    # SDK result may expose either .text or dict-like text
    if hasattr(result, "text"):
        return result.text
    if isinstance(result, dict):
        return result.get("text", "")
    return str(result)


def convert_speech_to_speech(file_name: str, file_bytes: bytes) -> bytes:
    audio_file = BytesIO(file_bytes)
    audio_file.name = file_name

    audio_stream = client.speech_to_speech.convert(
        voice_id=ELEVENLABS_VOICE_ID,
        file=audio_file,
        model_id="eleven_english_sts_v2",
        output_format="mp3_44100_128",
    )

    audio_bytes = b"".join(audio_stream)
    return audio_bytes