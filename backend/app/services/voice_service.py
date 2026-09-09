"""
Voice service — Bhashini ASR (speech-to-text) and TTS (text-to-speech).

Both functions proxy through the backend so API keys never reach the client.
When no Bhashini credentials are configured, the service raises
VoiceServiceError with a dev-mode message so the app degrades gracefully.
"""

import os
import uuid
import base64
import logging
from pathlib import Path

import httpx

from app.services.storage_service import UPLOAD_DIR

logger = logging.getLogger(__name__)

BHASHINI_API_KEY = os.getenv("BHASHINI_API_KEY", "").strip()
BHASHINI_USER_ID = os.getenv("BHASHINI_USER_ID", "").strip()
BHASHINI_PIPELINE_URL = os.getenv(
    "BHASHINI_PIPELINE_URL",
    "https://dhruva-api.bhashini.gov.in/services/inference",
)

# Overridable service IDs (Bhashini's exact service IDs change; these are
# sensible defaults — set BHASHINI_*_SERVICE_ID in .env when they differ).
DEFAULT_ASR_SERVICES = {
    "hi": "ai4bharat/conformer-hi-gpu--t4",
    "mr": "ai4bharat/conformer-mr-gpu--t4",
    "en": "ai4bharat/conformer-en-gpu--t4",
}
DEFAULT_TTS_SERVICES = {
    "hi": "ai4bharat/indic-tts-coqui-misc-gpu--t4",
    "mr": "ai4bharat/indic-tts-coqui-misc-gpu--t4",
    "en": "ai4bharat/indic-tts-coqui-misc-gpu--t4",
}


class VoiceServiceError(Exception):
    """Raised when voice processing fails or is not configured."""


def _is_configured() -> bool:
    return bool(BHASHINI_API_KEY and BHASHINI_USER_ID)


def _extension_for_audio(content_type: str | None, filename: str | None) -> str:
    """Map a content type / filename to a Bhashini audio format identifier."""
    ct = (content_type or "").lower()
    if "flac" in ct or (filename and filename.lower().endswith(".flac")):
        return "flac", 16000
    if "mp3" in ct or (filename and filename.lower().endswith(".mp3")):
        return "mp3", 16000
    if "ogg" in ct or (filename and filename.lower().endswith(".ogg")):
        return "ogg", 16000
    # Default to WAV
    return "wav", 16000


async def transcribe_audio(
    content: bytes,
    filename: str | None = None,
    content_type: str | None = None,
    language: str = "hi",
) -> str:
    """
    Transcribe audio via Bhashini ASR.

    Args:
        content: Raw audio bytes.
        filename: Original filename (hint only).
        content_type: Client-reported MIME type (hint only).
        language: Source language code ('hi', 'mr', 'en').

    Returns:
        The transcribed text.

    Raises:
        VoiceServiceError: If ASR is unavailable or fails.
    """
    language = language.lower()
    if language not in DEFAULT_ASR_SERVICES:
        raise VoiceServiceError(f"Unsupported language: {language}")

    if not _is_configured():
        raise VoiceServiceError(
            "Speech recognition is not configured. Set BHASHINI_API_KEY "
            "and BHASHINI_USER_ID to enable voice input."
        )

    audio_format, sampling_rate = _extension_for_audio(content_type, filename)
    service_id = os.getenv(
        "BHASHINI_ASR_SERVICE_ID", DEFAULT_ASR_SERVICES[language]
    )

    payload = {
        "pipelineTasks": [
            {
                "taskType": "asr",
                "config": {
                    "language": {"sourceLanguage": language},
                    "serviceId": service_id,
                    "audioFormat": audio_format,
                    "samplingRate": sampling_rate,
                },
            }
        ],
        "inputData": {"input": [{"source": base64.b64encode(content).decode("ascii")}]},
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": BHASHINI_API_KEY,
        "userID": BHASHINI_USER_ID,
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                BHASHINI_PIPELINE_URL, headers=headers, json=payload
            )
            response.raise_for_status()
            data = response.json()
    except Exception as e:
        logger.error("[voice] ASR request failed: %s", e)
        raise VoiceServiceError("Speech recognition failed. Please try again.") from e

    try:
        # Bhashini returns transcription under either output[].source or
        # audio[].transcription depending on the service version.
        output = data["pipelineResponse"][0]["output"][0]
        text = output.get("source") or output.get("target") or ""
        if not text:
            audio = data["pipelineResponse"][0].get("audio", [{}])[0]
            text = audio.get("transcription", "")
    except (KeyError, IndexError, TypeError) as e:
        logger.error("[voice] Unexpected ASR response: %s", data)
        raise VoiceServiceError("Speech recognition returned an invalid response.") from e

    return (text or "").strip()


async def synthesize_speech(text: str, language: str = "hi") -> str:
    """
    Synthesize speech via Bhashini TTS and persist the audio.

    Returns:
        A URL path to the generated audio file (e.g. "/uploads/tts/abc.wav").

    Raises:
        VoiceServiceError: If TTS is unavailable or fails.
    """
    language = language.lower()
    if not text.strip():
        raise VoiceServiceError("No text to synthesize.")

    if language not in DEFAULT_TTS_SERVICES:
        raise VoiceServiceError(f"Unsupported language: {language}")

    if not _is_configured():
        raise VoiceServiceError(
            "Text-to-speech is not configured. Set BHASHINI_API_KEY and "
            "BHASHINI_USER_ID to enable read-aloud."
        )

    service_id = os.getenv(
        "BHASHINI_TTS_SERVICE_ID", DEFAULT_TTS_SERVICES[language]
    )

    payload = {
        "pipelineTasks": [
            {
                "taskType": "tts",
                "config": {
                    "language": {"sourceLanguage": language},
                    "serviceId": service_id,
                    "gender": "female",
                    "samplingRate": "22050",
                },
            }
        ],
        "inputData": {"input": [{"source": text}]},
    }
    headers = {
        "Content-Type": "application/json",
        "Authorization": BHASHINI_API_KEY,
        "userID": BHASHINI_USER_ID,
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                BHASHINI_PIPELINE_URL, headers=headers, json=payload
            )
            response.raise_for_status()
            data = response.json()
    except Exception as e:
        logger.error("[voice] TTS request failed: %s", e)
        raise VoiceServiceError("Text-to-speech failed. Please try again.") from e

    try:
        audio_content = data["pipelineResponse"][0]["audio"][0]["audioContent"]
    except (KeyError, IndexError, TypeError) as e:
        logger.error("[voice] Unexpected TTS response: %s", data)
        raise VoiceServiceError("Text-to-speech returned an invalid response.") from e

    try:
        raw = base64.b64decode(audio_content)
    except Exception as e:
        logger.error("[voice] TTS audio decode failed: %s", e)
        raise VoiceServiceError("Could not decode the generated audio.") from e

    # Persist audio next to the other uploads so the /uploads mount serves it
    tts_dir = UPLOAD_DIR / "tts"
    tts_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.wav"
    (tts_dir / filename).write_bytes(raw)

    return f"/uploads/tts/{filename}"