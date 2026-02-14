import gradio as gr
import azure.cognitiveservices.speech as speechsdk
import requests
import json
import os
import tempfile
import base64
import uuid
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from dotenv import load_dotenv

load_dotenv()

# ── Azure Speech Config (all values from environment; no defaults shipped) ──
AZURE_SPEECH_KEY = os.getenv("AZURE_SPEECH_KEY", "")
AZURE_ENDPOINT = os.getenv("AZURE_ENDPOINT", "")
AZURE_STT_URL = (
    AZURE_ENDPOINT.rstrip("/") + "/speechtotext/transcriptions:transcribe?api-version=2025-10-15"
)

# ── Fireworks Config (primary) ──
FIREWORKS_API_KEY = os.getenv("FIREWORKS_API_KEY", "")
FIREWORKS_MODEL = "accounts/fireworks/models/deepseek-v3p2"
FIREWORKS_URL = "https://api.fireworks.ai/inference/v1/chat/completions"
FIREWORKS_TIMEOUT = 15  # seconds before falling back to OpenRouter

# ── OpenRouter Config (fallback) ──
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_MODEL = "deepseek/deepseek-v3.2"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


REQUIRED_KEYS = {
    "AZURE_SPEECH_KEY": AZURE_SPEECH_KEY,
    "AZURE_ENDPOINT": AZURE_ENDPOINT,
    "FIREWORKS_API_KEY": FIREWORKS_API_KEY,
    "OPENROUTER_API_KEY": OPENROUTER_API_KEY,
}


def validate_config():
    missing = [name for name, value in REQUIRED_KEYS.items() if not value]
    if missing:
        raise RuntimeError(
            "Missing required environment variable(s): "
            + ", ".join(missing)
            + ". Set them in your environment (see .env.example)."
        )

# ── Language mappings ──
LANGUAGES = {
    "English": {"code": "en-US", "voice": "en-US-Ava:DragonHDLatestNeural"},
    "Chinese (Mandarin)": {"code": "zh-CN", "voice": "zh-CN-XiaoxiaoMultilingualNeural"},
    "Cantonese": {"code": "zh-HK", "voice": "zh-HK-HiuGaaiNeural"},
    "Malay": {"code": "ms-MY", "voice": "ms-MY-YasminNeural"},
    "Hindi": {"code": "hi-IN", "voice": "hi-IN-SwaraNeural"},
    "Singlish": {"code": "en-SG", "voice": "en-SG-LunaNeural"},
}

SOURCE_LANGUAGES = {
    "English": "en-US",
    "Chinese (Mandarin)": "zh-CN",
    "Cantonese": "zh-HK",
    "Malay": "ms-MY",
    "Hindi": "hi-IN",
    "Singlish": "en-SG",
}


# ═══════════════════════════════════════════════
#  Core functions (shared by Gradio UI + REST API)
# ═══════════════════════════════════════════════

def transcribe_audio(audio_path, source_lang="English"):
    if audio_path is None:
        return None, "No audio provided."

    locale = SOURCE_LANGUAGES.get(source_lang, "en-US")
    definition = {
        "locales": [locale],
        "enhancedMode": {"enabled": True, "task": "transcribe"},
    }

    with open(audio_path, "rb") as f:
        files = {
            "audio": (os.path.basename(audio_path), f, "audio/wav"),
            "definition": (None, json.dumps(definition), "application/json"),
        }
        headers = {"Ocp-Apim-Subscription-Key": AZURE_SPEECH_KEY}
        resp = requests.post(AZURE_STT_URL, headers=headers, files=files, timeout=30)

    if resp.status_code != 200:
        return None, f"STT Error {resp.status_code}: {resp.text}"

    data = resp.json()
    combined = data.get("combinedPhrases", [])
    text = combined[0].get("text", "") if combined else ""

    if not text.strip():
        return None, "Could not transcribe any speech."
    return text, None


def _call_llm(messages, timeout=30):
    """
    Try Fireworks first; if it times out or errors, fall back to OpenRouter.
    Returns (response_text, error_string_or_None).
    """
    # ── Attempt 1: Fireworks ──
    try:
        resp = requests.post(
            FIREWORKS_URL,
            headers={
                "Authorization": f"Bearer {FIREWORKS_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": FIREWORKS_MODEL,
                "messages": messages,
                "max_tokens": 2048,
                "temperature": 0.3,
            },
            timeout=FIREWORKS_TIMEOUT,
        )
        if resp.status_code == 200:
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip(), None
        # Non-200 → fall through to OpenRouter
        print(f"[LLM] Fireworks returned {resp.status_code}, falling back to OpenRouter")
    except requests.exceptions.Timeout:
        print("[LLM] Fireworks timed out, falling back to OpenRouter")
    except requests.exceptions.RequestException as e:
        print(f"[LLM] Fireworks request error: {e}, falling back to OpenRouter")

    # ── Attempt 2: OpenRouter (fallback) ──
    try:
        resp = requests.post(
            OPENROUTER_URL,
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": OPENROUTER_MODEL,
                "messages": messages,
                "max_tokens": 2048,
                "temperature": 0.3,
            },
            timeout=60,
        )
        if resp.status_code != 200:
            return None, f"OpenRouter Error {resp.status_code}: {resp.text}"
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip(), None
    except requests.exceptions.RequestException as e:
        return None, f"Both Fireworks and OpenRouter failed. Last error: {e}"


def translate_text(text, source_lang, target_lang):
    if source_lang == target_lang:
        return text, None

    singlish_note = ""
    if target_lang == "Singlish":
        singlish_note = (
            " Singlish is Singaporean colloquial English — use typical Singlish particles "
            "like 'lah', 'leh', 'lor', 'meh', 'sia', and local slang."
        )
    if source_lang == "Singlish":
        source_lang = "Singlish (Singaporean colloquial English)"

    system_prompt = (
        "You are an expert multilingual translator for elderly medical center. "
        "Your tone is patient, warm, and professional"
        "You prioritize clarity and safety over literal translation"
        "Translate the following text accurately and naturally. "
        "Simplify text if necessary, but DO NOT miss out any important information. "
        "Output ONLY the translated text, nothing else."
        "Do not include any introductory remarks, explanations, or quotes"
        f"{singlish_note}"
    )
    user_prompt = f"Translate from {source_lang} to {target_lang}:\n\n{text}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    translated, err = _call_llm(messages)
    if err:
        return None, err
    return translated, None


def synthesize_speech(text, target_lang):
    lang_config = LANGUAGES.get(target_lang)
    if not lang_config:
        return None, f"Unsupported target language: {target_lang}"

    speech_config = speechsdk.SpeechConfig(
        subscription=AZURE_SPEECH_KEY, endpoint=AZURE_ENDPOINT
    )
    speech_config.speech_synthesis_voice_name = lang_config["voice"]

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    tmp_path = tmp.name
    tmp.close()

    audio_config = speechsdk.audio.AudioOutputConfig(filename=tmp_path)
    synthesizer = speechsdk.SpeechSynthesizer(
        speech_config=speech_config, audio_config=audio_config
    )
    result = synthesizer.speak_text_async(text).get()

    if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
        return tmp_path, None
    elif result.reason == speechsdk.ResultReason.Canceled:
        details = result.cancellation_details
        return None, f"TTS Canceled: {details.reason} — {details.error_details}"
    else:
        return None, f"TTS failed with reason: {result.reason}"


def process_translation(audio, source_lang, target_lang):
    """Full pipeline for Gradio UI."""
    if audio is None:
        return "Please record or upload audio.", "", "", None

    status_parts = []

    transcript, err = transcribe_audio(audio, source_lang)
    if err:
        return f"❌ Transcription failed: {err}", "", "", None
    status_parts.append(f'✅ Transcribed: "{transcript}"')

    translated, err = translate_text(transcript, source_lang, target_lang)
    if err:
        return "\n".join(status_parts) + f"\n❌ Translation failed: {err}", transcript, "", None
    status_parts.append(f'✅ Translated: "{translated}"')

    audio_path, err = synthesize_speech(translated, target_lang)
    if err:
        return "\n".join(status_parts) + f"\n❌ TTS failed: {err}", transcript, translated, None
    status_parts.append("✅ Done!")

    return "\n".join(status_parts), transcript, translated, audio_path


# ═══════════════════════════════════════════════
#  FastAPI app (REST API)
# ═══════════════════════════════════════════════

validate_config()

app = FastAPI(title="Multilingual Voice Translator API")

# CORS — allow your website to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # ⚠️ In production, replace with your actual domain(s)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.get("/api/languages")
async def get_languages():
    """Return supported languages."""
    return {
        "source_languages": list(SOURCE_LANGUAGES.keys()),
        "target_languages": list(LANGUAGES.keys()),
    }


# ── Individual endpoints ──

@app.post("/api/transcribe")
async def api_transcribe(
    audio: UploadFile = File(...),
    source_lang: str = Form("English"),
):
    """Transcribe audio → text."""
    if source_lang not in SOURCE_LANGUAGES:
        raise HTTPException(400, f"Unsupported source language: {source_lang}")

    # Save uploaded file to temp
    suffix = os.path.splitext(audio.filename or "audio.wav")[1] or ".wav"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp.write(await audio.read())
    tmp.close()

    try:
        text, err = transcribe_audio(tmp.name, source_lang)
        if err:
            raise HTTPException(500, err)
        return {"transcript": text}
    finally:
        os.unlink(tmp.name)


@app.post("/api/translate")
async def api_translate(
    text: str = Form(...),
    source_lang: str = Form("English"),
    target_lang: str = Form("Chinese (Mandarin)"),
):
    """Translate text → text."""
    translated, err = translate_text(text, source_lang, target_lang)
    if err:
        raise HTTPException(500, err)
    return {"translated": translated}


@app.post("/api/synthesize")
async def api_synthesize(
    text: str = Form(...),
    target_lang: str = Form("Chinese (Mandarin)"),
):
    """Text → speech audio (returns WAV file)."""
    if target_lang not in LANGUAGES:
        raise HTTPException(400, f"Unsupported target language: {target_lang}")

    audio_path, err = synthesize_speech(text, target_lang)
    if err:
        raise HTTPException(500, err)
    return FileResponse(audio_path, media_type="audio/wav", filename="translated.wav")


# ── Full pipeline endpoint ──

@app.post("/api/translate-audio")
async def api_translate_audio(
    audio: UploadFile = File(...),
    source_lang: str = Form("English"),
    target_lang: str = Form("Chinese (Mandarin)"),
    return_audio_as: str = Form("base64"),  # "base64" or "url"
):
    """
    Full pipeline: audio in → transcription + translation + audio out.

    Returns JSON with transcript, translation, and audio (base64 or file URL).
    """
    if source_lang not in SOURCE_LANGUAGES:
        raise HTTPException(400, f"Unsupported source language: {source_lang}")
    if target_lang not in LANGUAGES:
        raise HTTPException(400, f"Unsupported target language: {target_lang}")

    # Save uploaded audio
    suffix = os.path.splitext(audio.filename or "audio.wav")[1] or ".wav"
    tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    tmp.write(await audio.read())
    tmp.close()

    try:
        # Step 1: Transcribe
        transcript, err = transcribe_audio(tmp.name, source_lang)
        if err:
            raise HTTPException(500, f"Transcription failed: {err}")

        # Step 2: Translate
        translated, err = translate_text(transcript, source_lang, target_lang)
        if err:
            raise HTTPException(500, f"Translation failed: {err}")

        # Step 3: Synthesize
        audio_path, err = synthesize_speech(translated, target_lang)
        if err:
            raise HTTPException(500, f"TTS failed: {err}")

        # Return audio as base64 or as a downloadable reference
        if return_audio_as == "base64":
            with open(audio_path, "rb") as f:
                audio_b64 = base64.b64encode(f.read()).decode("utf-8")
            os.unlink(audio_path)
            return {
                "transcript": transcript,
                "translated": translated,
                "audio_base64": audio_b64,
                "audio_content_type": "audio/wav",
            }
        else:
            # Return a unique filename — caller can fetch via /api/audio/{filename}
            filename = f"{uuid.uuid4().hex}.wav"
            final_path = os.path.join(tempfile.gettempdir(), filename)
            os.rename(audio_path, final_path)
            return {
                "transcript": transcript,
                "translated": translated,
                "audio_url": f"/api/audio/{filename}",
            }
    finally:
        if os.path.exists(tmp.name):
            os.unlink(tmp.name)


@app.get("/api/audio/{filename}")
async def get_audio(filename: str):
    """Serve generated audio files."""
    filepath = os.path.join(tempfile.gettempdir(), filename)
    if not os.path.exists(filepath):
        raise HTTPException(404, "Audio file not found or expired.")
    return FileResponse(filepath, media_type="audio/wav")


# ═══════════════════════════════════════════════
#  Gradio UI (mounted on the same server)
# ═══════════════════════════════════════════════

with gr.Blocks(title="Multilingual Voice Translator", theme=gr.themes.Soft()) as demo:
    gr.Markdown(
        """
        # 🌏 Multilingual Voice Translator
        **Speak** in one language → get **translated audio** in another.
        Supports: **English, Singlish, Chinese (Mandarin), Cantonese, Malay, Hindi**
        """
    )

    with gr.Row():
        with gr.Column():
            source_lang = gr.Dropdown(
                choices=list(SOURCE_LANGUAGES.keys()),
                value="English",
                label="🗣️ I'm speaking in",
            )
            audio_input = gr.Audio(
                sources=["microphone", "upload"],
                type="filepath",
                label="Record or upload audio",
            )
        with gr.Column():
            target_lang = gr.Dropdown(
                choices=list(LANGUAGES.keys()),
                value="Chinese (Mandarin)",
                label="🎯 Translate to",
            )

    translate_btn = gr.Button("🚀 Translate", variant="primary", size="lg")

    with gr.Row():
        with gr.Column():
            transcript_box = gr.Textbox(label="📝 Transcription (source)", lines=3)
        with gr.Column():
            translated_box = gr.Textbox(label="📝 Translation (target)", lines=3)

    status_box = gr.Textbox(label="Status", lines=5, interactive=False)
    audio_output = gr.Audio(label="🔊 Translated Audio", type="filepath")

    translate_btn.click(
        fn=process_translation,
        inputs=[audio_input, source_lang, target_lang],
        outputs=[status_box, transcript_box, translated_box, audio_output],
    )

# Mount Gradio onto FastAPI at root path
app = gr.mount_gradio_app(app, demo, path="/")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=7860)
