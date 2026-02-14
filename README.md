# MediSpeak Translator

MediSpeak is a multilingual voice translation app for medical-style conversations.
It includes:

- A React + Vite frontend (`App.tsx`)
- A FastAPI backend with mounted Gradio UI (`main.py`)

## Prerequisites

- Node.js 18+
- Python 3.10+
- `pip`

## Run Locally

1. Install frontend dependencies:

```bash
npm install
```

2. Install backend dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

3. Start the backend (port `7860`):

```bash
python main.py
```

4. Start the frontend (port `3000`):

```bash
npm run dev
```

5. Open the frontend at `http://localhost:3000`

## Configuration

All API keys are read from environment variables — no keys are shipped in the
repository.

1. Copy `.env.example` to `.env` and fill in your own values:

```bash
cp .env.example .env
```

2. Required variables:

   - `AZURE_SPEECH_KEY` — Azure Speech service key (STT/TTS)
   - `AZURE_ENDPOINT` — e.g. `https://your-resource.cognitiveservices.azure.com/`
   - `FIREWORKS_API_KEY` — LLM provider (primary)
   - `OPENROUTER_API_KEY` — LLM provider (fallback)

3. (Frontend only) The frontend `API_BASE_URL` is set in `constants.ts`
   (`API_BASE_URL`).

The backend will refuse to start if any required variable is missing.

## Backend Endpoints

- `GET /api/health`
- `GET /api/languages`
- `POST /api/transcribe`
- `POST /api/translate`
- `POST /api/synthesize`
- `POST /api/translate-audio`
- `GET /api/audio/{filename}`
