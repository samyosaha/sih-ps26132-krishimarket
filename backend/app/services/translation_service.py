"""
Translation service — Bhashini NMT (ULCA) with Google Cloud fallback.

When no API keys are configured, translate_text() returns the original
text unchanged so the app degrades gracefully in dev/hackathon mode.
"""

import os
import hashlib
import logging

import httpx

logger = logging.getLogger(__name__)

# Supported languages on this platform (ISO-639-1 codes)
SUPPORTED_LANGUAGES = {"en", "hi", "mr"}

BHASHINI_API_KEY = os.getenv("BHASHINI_API_KEY", "").strip()
BHASHINI_USER_ID = os.getenv("BHASHINI_USER_ID", "").strip()
BHASHINI_PIPELINE_URL = os.getenv(
    "BHASHINI_PIPELINE_URL",
    "https://dhruva-api.bhashini.gov.in/services/inference",
)
NMT_SERVICE_ID = os.getenv(
    "BHASHINI_NMT_SERVICE_ID",
    "ai4bharat/indictrans-v2-all-gpu--t4",
)
GOOGLE_TRANSLATE_API_KEY = os.getenv("GOOGLE_TRANSLATE_API_KEY", "").strip()

# ── In-memory cache ──────────────────────────────────────────────────
# Simple dict keyed by hash(text + source + target).  Kept intentionally
# small; entries are dropped wholesale when the cache grows past the cap.

_CACHE: dict[str, str] = {}
_CACHE_MAX_ENTRIES = 2000


def _cache_key(text: str, source_lang: str, target_lang: str) -> str:
    return hashlib.sha256(
        f"{source_lang}|{target_lang}|{text}".encode("utf-8")
    ).hexdigest()


def _cache_get(key: str) -> str | None:
    return _CACHE.get(key)


def _cache_put(key: str, value: str) -> None:
    if len(_CACHE) >= _CACHE_MAX_ENTRIES:
        _CACHE.clear()
    _CACHE[key] = value


# ── Providers ────────────────────────────────────────────────────────


async def _bhashini_translate(text: str, source: str, target: str) -> str:
    """Translate via Bhashini NMT pipeline (ULCA)."""
    payload = {
        "pipelineTasks": [
            {
                "taskType": "translation",
                "config": {
                    "language": {
                        "sourceLanguage": source,
                        "targetLanguage": target,
                    },
                    "serviceId": NMT_SERVICE_ID,
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
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            BHASHINI_PIPELINE_URL, headers=headers, json=payload
        )
        response.raise_for_status()
        data = response.json()

    try:
        return data["pipelineResponse"][0]["output"][0]["target"]
    except (KeyError, IndexError, TypeError) as e:
        raise ValueError("Bhashini returned an unexpected response") from e


async def _google_translate(text: str, source: str, target: str) -> str:
    """Translate via Google Cloud Translation v2 (fallback)."""
    url = "https://translation.googleapis.com/language/translate/v2"
    params = {
        "key": GOOGLE_TRANSLATE_API_KEY,
        "q": text,
        "source": source,
        "target": target,
        "format": "text",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(url, params=params)
        response.raise_for_status()
        data = response.json()

    try:
        return data["data"]["translations"][0]["translatedText"]
    except (KeyError, IndexError, TypeError) as e:
        raise ValueError("Google Translate returned an unexpected response") from e


# ── Public API ───────────────────────────────────────────────────────


async def translate_text(
    text: str,
    source_lang: str,
    target_lang: str,
) -> str:
    """
    Translate `text` from `source_lang` to `target_lang`.

    Provider order: Bhashini (primary) → Google (fallback) → identity stub.
    Results are cached in memory keyed by hash(text + source + target).
    """
    source_lang = source_lang.lower()
    target_lang = target_lang.lower()

    if not text or source_lang == target_lang:
        return text

    if source_lang not in SUPPORTED_LANGUAGES or target_lang not in SUPPORTED_LANGUAGES:
        raise ValueError(
            f"Unsupported language. Choose from: {', '.join(sorted(SUPPORTED_LANGUAGES))}"
        )

    key = _cache_key(text, source_lang, target_lang)
    cached = _cache_get(key)
    if cached is not None:
        return cached

    translated = None

    if BHASHINI_API_KEY and BHASHINI_USER_ID:
        try:
            translated = await _bhashini_translate(text, source_lang, target_lang)
        except Exception as e:
            logger.warning("[translate] Bhashini failed (%s); trying Google", e)

    if translated is None and GOOGLE_TRANSLATE_API_KEY:
        try:
            translated = await _google_translate(text, source_lang, target_lang)
        except Exception as e:
            logger.warning("[translate] Google failed (%s); returning original text", e)

    if translated is None:
        # Dev/hackathon stub — return original text unchanged
        logger.info("[translate] No translation provider configured — returning original text")
        translated = text

    _cache_put(key, translated)
    return translated