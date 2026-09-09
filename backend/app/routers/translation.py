"""
Translation router — exposes the Bhashini/Google-backed translate service.
Public endpoint (works pre-login) with a rate limiter against abuse.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.rate_limiter import create_rate_limiter
from app.services.translation_service import translate_text

router = APIRouter(tags=["translation"])


class TranslateRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    source_lang: str = Field(..., min_length=2, max_length=5)
    target_lang: str = Field(..., min_length=2, max_length=5)


class TranslateResponse(BaseModel):
    translated_text: str
    source_lang: str
    target_lang: str


@router.post("/translate", response_model=TranslateResponse)
async def translate(
    payload: TranslateRequest,
    _rl=Depends(create_rate_limiter(max_calls=30, window_seconds=60)),
):
    """Translate user-generated content into the requested language."""
    try:
        result = await translate_text(
            payload.text, payload.source_lang, payload.target_lang
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return TranslateResponse(
        translated_text=result,
        source_lang=payload.source_lang,
        target_lang=payload.target_lang,
    )