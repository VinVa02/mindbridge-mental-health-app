import os
from dotenv import load_dotenv
from elevenlabs.client import ElevenLabs

load_dotenv()

api_key = os.getenv("ELEVENLABS_API_KEY")
voice_id = os.getenv("ELEVENLABS_VOICE_ID")

if not api_key:
    raise ValueError("ELEVENLABS_API_KEY is missing in .env")

if not voice_id:
    raise ValueError("ELEVENLABS_VOICE_ID is missing in .env")

client = ElevenLabs(api_key=api_key)

print("\n--- TESTING CONFIG ---")
print("Voice ID from .env:", voice_id)

print("\n--- LISTING VOICES ON THIS ACCOUNT ---")
voices_response = client.voices.get_all()

# SDK response may store voices in .voices
voices = getattr(voices_response, "voices", voices_response)

found = False

for v in voices:
    current_voice_id = getattr(v, "voice_id", None) or v.get("voice_id")
    name = getattr(v, "name", None) or v.get("name")
    category = getattr(v, "category", None) or v.get("category")
    labels = getattr(v, "labels", None) or v.get("labels", {})
    description = getattr(v, "description", None) or v.get("description")

    print(f"- {name} | id={current_voice_id} | category={category}")

    if current_voice_id == voice_id:
        found = True
        print("\nMATCH FOUND:")
        print(f"  name: {name}")
        print(f"  category: {category}")
        print(f"  description: {description}")
        print(f"  labels: {labels}")

print("\n--- TTS TEST ---")
try:
    audio_stream = client.text_to_speech.convert(
        voice_id=voice_id,
        output_format="mp3_44100_128",
        text="Hello, this is a quick ElevenLabs voice test.",
        model_id="eleven_multilingual_v2",
    )

    audio_bytes = b"".join(audio_stream)

    with open("voice_test_output.mp3", "wb") as f:
        f.write(audio_bytes)

    print("SUCCESS: TTS worked.")
    print("Saved output to voice_test_output.mp3")

except Exception as e:
    print("FAILED: TTS did not work.")
    print("Error:")
    print(str(e))