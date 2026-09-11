"""
TTS router — streams Bhashini audio directly to the client.

POST /tts
  Body: { "text": "...", "language": "hi" }
  Response: audio/wav or audio/mpeg bytes (StreamingResponse)

Falls back gracefully: if Bhashini is unconfigured or times out, returns
HTTP 503 so the frontend can silently fall back to the browser Web Speech API.
"""

import asyncio
import io
import logging

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.rate_limiter import create_rate_limiter

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tts", tags=["tts"])

# Languages supported by the Bhashini pipeline
SUPPORTED_LANGUAGES = {"en", "hi", "mr", "bn"}


class TtsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    language: str = Field(default="hi", min_length=2, max_length=5)


@router.post("", summary="Text-to-speech via Bhashini (streams audio)")
@router.post("/", include_in_schema=False)
async def tts_stream(
    payload: TtsRequest,
    _rl=Depends(create_rate_limiter(max_calls=30, window_seconds=60)),
):
    """
    Convert text to speech using Bhashini and stream the audio bytes back.

    - language codes: 'en', 'hi', 'mr', 'bn'
    - If Bhashini is unconfigured or the call fails/times out, returns 503 so the
      frontend can silently fall back to the browser Web Speech API.
    """
    from app.services.bhashini_service import BhashiniError, text_to_speech

    lang = payload.language.lower().split("-")[0]
    logger.warning(
        "[tts] Received request language=%r normalized_language=%r",
        payload.language,
        lang,
    )
    if lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=422,
            detail=f"Unsupported language '{payload.language}'. "
                   f"Supported: {sorted(SUPPORTED_LANGUAGES)}",
        )

    try:
        audio_bytes = await asyncio.wait_for(
            text_to_speech(text=payload.text, language=lang),
            timeout=30.0,
        )
    except asyncio.TimeoutError:
        logger.warning("[tts] Bhashini TTS timed out for language=%s", lang)
        raise HTTPException(
            status_code=503,
            detail="TTS service timed out — please try again.",
        )
    except BhashiniError as exc:
        logger.warning("[tts] Bhashini TTS error: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception as exc:
        logger.error("[tts] Unexpected error during TTS processing: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="TTS service temporarily unavailable.",
        )

    # Detect audio format (WAV, MP3, OGG)
    media_type = "audio/wav"
    if audio_bytes.startswith(b"ID3") or (
        len(audio_bytes) > 2 and audio_bytes[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2")
    ):
        media_type = "audio/mpeg"
    elif audio_bytes.startswith(b"OggS"):
        media_type = "audio/ogg"

    return StreamingResponse(
        io.BytesIO(audio_bytes),
        media_type=media_type,
        headers={
            "Content-Length": str(len(audio_bytes)),
            "Cache-Control": "no-store",
            "Content-Disposition": 'inline; filename="recommendation.wav"',
        },
    )
