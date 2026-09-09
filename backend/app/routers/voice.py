"""
Voice router — backend-proxied ASR and TTS endpoints for low-literacy UX.
"""

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.rate_limiter import create_rate_limiter
from app.services.voice_service import (
    VoiceServiceError,
    synthesize_speech,
    transcribe_audio,
)

router = APIRouter(prefix="/voice", tags=["voice"])


class VoiceAsrResponse(BaseModel):
    text: str
    language: str


class VoiceTtsRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    language: str = Field(default="hi", min_length=2, max_length=5)


class VoiceTtsResponse(BaseModel):
    audio_url: str
    language: str


@router.post("/asr", response_model=VoiceAsrResponse)
async def asr(
    audio: UploadFile = File(...),
    language: str = Form(default="hi"),
    _rl=Depends(create_rate_limiter(max_calls=15, window_seconds=60)),
):
    """Transcribe uploaded audio using the backend voice service."""
    try:
        text = await transcribe_audio(
            await audio.read(),
            filename=audio.filename,
            content_type=audio.content_type,
            language=language,
        )
    except VoiceServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return VoiceAsrResponse(text=text, language=language)


@router.post("/tts", response_model=VoiceTtsResponse)
async def tts(
    payload: VoiceTtsRequest,
    _rl=Depends(create_rate_limiter(max_calls=20, window_seconds=60)),
):
    """Generate speech audio for the supplied text."""
    try:
        audio_url = await synthesize_speech(
            text=payload.text,
            language=payload.language,
        )
    except VoiceServiceError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return VoiceTtsResponse(audio_url=audio_url, language=payload.language)
