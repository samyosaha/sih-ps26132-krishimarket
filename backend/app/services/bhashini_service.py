"""
bhashini_service.py — Two-step Bhashini ULCA pipeline TTS & Translation.

Flow:
  1. POST https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline
     → discovers the callbackURL, inferenceApiKey, and serviceIds for our pipeline.
  2. POST {callbackURL}
     → executes NMT translation (if target != 'en') + TTS, returns base64-encoded audio.

Credentials (set in .env):
    BHASHINI_USER_ID   — ULCA user ID from bhashini.gov.in profile
    BHASHINI_API_KEY   — ULCA API key from bhashini.gov.in profile

Optional overrides:
    BHASHINI_PIPELINE_ID  — defaults to standard MeitY pipeline (64392f96daac500b55c543cd)
    BHASHINI_PIPELINE_CONFIG_URL — defaults to https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline
    BHASHINI_NMT_SERVICE_ID_{LANG}  — e.g. BHASHINI_NMT_SERVICE_ID_HI
    BHASHINI_TTS_SERVICE_ID_{LANG}  — e.g. BHASHINI_TTS_SERVICE_ID_HI
"""

import asyncio
import base64
import logging
import os
from typing import Optional, Tuple, Dict, Any, List

import httpx

logger = logging.getLogger(__name__)

# Default Pipeline configuration
DEFAULT_PIPELINE_ID = "64392f96daac500b55c543cd"
DEFAULT_CONFIG_URL = "https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline"

# Supported TTS languages (ISO-639-1 → Bhashini source-language code)
SUPPORTED_LANGUAGES = {
    "en": "en",
    "hi": "hi",
    "mr": "mr",
    "bn": "bn",
}

# Translation source is always English (the forecast/recommendation text is in English)
TRANSLATION_SOURCE = "en"


class BhashiniError(Exception):
    """Raised when a Bhashini API call fails or credentials are unconfigured."""


def _get_config() -> Tuple[str, str, str, str]:
    """Retrieve runtime Bhashini environment configurations."""
    user_id = os.getenv("BHASHINI_USER_ID", "").strip()
    api_key = os.getenv("BHASHINI_API_KEY", "").strip()
    pipeline_id = os.getenv("BHASHINI_PIPELINE_ID", DEFAULT_PIPELINE_ID).strip()
    config_url = os.getenv("BHASHINI_PIPELINE_CONFIG_URL", DEFAULT_CONFIG_URL).strip()
    return user_id, api_key, pipeline_id, config_url


def _is_configured() -> bool:
    user_id, api_key, _, _ = _get_config()
    return bool(user_id and api_key)


def _extract_service_id(
    pipeline_response_config: List[Any], task_type: str, target_lang: str
) -> Optional[str]:
    """
    Extract matching serviceId from Bhashini pipelineResponseConfig.
    Handles both list-of-configs and single-dict config structures.
    """
    for item in pipeline_response_config:
        if not isinstance(item, dict):
            continue
        if item.get("taskType") != task_type:
            continue
        cfg = item.get("config")
        if isinstance(cfg, list):
            for c in cfg:
                if not isinstance(c, dict):
                    continue
                lang_obj = c.get("language", {})
                if task_type == "translation":
                    if lang_obj.get("targetLanguage") == target_lang:
                        return c.get("serviceId")
                else:  # tts
                    if lang_obj.get("sourceLanguage") == target_lang:
                        return c.get("serviceId")
            # If no exact language match, fallback to first valid serviceId in list
            for c in cfg:
                if isinstance(c, dict) and c.get("serviceId"):
                    return c.get("serviceId")
        elif isinstance(cfg, dict):
            if cfg.get("serviceId"):
                return cfg.get("serviceId")
    return None


async def _discover_pipeline(
    task_types: list[str], source_language: str, target_language: str
) -> Tuple[str, Dict[str, str], Dict[str, Optional[str]]]:
    """
    Step 1 — call getModelsPipeline to obtain:
      - callbackURL  (the compute endpoint)
      - inferenceApiKey  (auth headers for the compute call)
      - serviceIds for each task (translation, tts)

    Returns: (callback_url, auth_headers, service_ids)
    """
    user_id, api_key, pipeline_id, config_url = _get_config()

    pipeline_tasks = []
    for task in task_types:
        task_cfg: dict = {"taskType": task, "config": {}}
        if task == "translation":
            task_cfg["config"] = {
                "language": {
                    "sourceLanguage": source_language,
                    "targetLanguage": target_language,
                }
            }
        else:  # tts
            task_cfg["config"] = {
                "language": {"sourceLanguage": target_language}
            }
        pipeline_tasks.append(task_cfg)

    payload = {
        "pipelineTasks": pipeline_tasks,
        "pipelineRequestConfig": {"pipelineId": pipeline_id},
    }
    headers = {
        "Content-Type": "application/json",
        "userID": user_id,
        "ulcaApiKey": api_key,
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(config_url, json=payload, headers=headers)
            if resp.status_code != 200:
                logger.warning(
                    "[bhashini] Pipeline config failed with HTTP %s: %s",
                    resp.status_code,
                    resp.text[:300],
                )
            resp.raise_for_status()
            data = resp.json()
            logger.warning(
                "[bhashini] Pipeline config succeeded language=%s tasks=%s",
                target_language,
                task_types,
            )
    except httpx.HTTPStatusError as exc:
        logger.error(
            "[bhashini] Pipeline config threw HTTP error language=%s: %s",
            target_language,
            exc,
        )
        raise BhashiniError(
            f"Bhashini config endpoint returned HTTP {exc.response.status_code}: {exc.response.text[:200]}"
        ) from exc
    except httpx.RequestError as exc:
        logger.error(
            "[bhashini] Pipeline config threw request error language=%s: %s",
            target_language,
            exc,
        )
        raise BhashiniError(f"Could not connect to Bhashini config endpoint: {exc}") from exc

    # Locate pipelineInferenceAPIEndPoint (can be at top level or nested in pipelineResponseConfig[0])
    infer_endpoint = data.get("pipelineInferenceAPIEndPoint")
    pipeline_response_config = data.get("pipelineResponseConfig", [])
    if not infer_endpoint and isinstance(pipeline_response_config, list) and pipeline_response_config:
        infer_endpoint = pipeline_response_config[0].get("pipelineInferenceAPIEndPoint")

    if not infer_endpoint or not isinstance(infer_endpoint, dict):
        logger.error("[bhashini] Missing pipelineInferenceAPIEndPoint in response: %s", data)
        raise BhashiniError("Could not parse Bhashini pipeline config: missing pipelineInferenceAPIEndPoint.")

    callback_url = infer_endpoint.get("callbackUrl")
    infer_key_obj = infer_endpoint.get("inferenceApiKey") or {}
    if not callback_url or not isinstance(infer_key_obj, dict):
        logger.error("[bhashini] Invalid callbackUrl or inferenceApiKey in config: %s", infer_endpoint)
        raise BhashiniError("Bhashini config missing callbackUrl or inferenceApiKey.")

    header_name = infer_key_obj.get("name", "Authorization")
    header_val = infer_key_obj.get("value", "")
    auth_headers = {
        header_name: header_val,
        "Content-Type": "application/json",
    }

    # Extract service IDs for each requested task
    service_ids: Dict[str, Optional[str]] = {}
    if isinstance(pipeline_response_config, list):
        for task in task_types:
            service_ids[task] = _extract_service_id(pipeline_response_config, task, target_language)

    return callback_url, auth_headers, service_ids


async def _compute(
    callback_url: str,
    auth_headers: dict,
    pipeline_tasks: list[dict],
    input_text: str,
) -> bytes:
    """
    Step 2 — call the compute endpoint and return raw decoded audio bytes.
    """
    payload = {
        "pipelineTasks": pipeline_tasks,
        "inputData": {"input": [{"source": input_text}]},
    }

    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(callback_url, json=payload, headers=auth_headers)
            if resp.status_code != 200:
                logger.warning(
                    "[bhashini] Compute failed with HTTP %s: %s",
                    resp.status_code,
                    resp.text[:300],
                )
            resp.raise_for_status()
            data = resp.json()
            logger.warning("[bhashini] Compute succeeded")
    except httpx.HTTPStatusError as exc:
        logger.error("[bhashini] Compute threw HTTP error: %s", exc)
        raise BhashiniError(
            f"Bhashini compute endpoint returned HTTP {exc.response.status_code}: {exc.response.text[:200]}"
        ) from exc
    except httpx.RequestError as exc:
        logger.error("[bhashini] Compute threw request error: %s", exc)
        raise BhashiniError(f"Could not connect to Bhashini compute endpoint: {exc}") from exc

    # Search for audioContent in pipelineResponse
    audio_content = None
    pipeline_resp = data.get("pipelineResponse", [])
    if isinstance(pipeline_resp, list):
        for item in reversed(pipeline_resp):
            if isinstance(item, dict) and item.get("audio"):
                audios = item["audio"]
                if isinstance(audios, list) and audios and isinstance(audios[0], dict):
                    audio_content = audios[0].get("audioContent")
                    if audio_content:
                        break

    if not audio_content:
        logger.error("[bhashini] No audio content found in compute response: %s", data)
        msg = data.get("message") if isinstance(data, dict) else None
        raise BhashiniError(f"Bhashini compute did not return audio: {msg or data}")

    try:
        return base64.b64decode(audio_content)
    except Exception as exc:
        raise BhashiniError("Failed to decode base64 audio content from Bhashini.") from exc


async def text_to_speech(text: str, language: str = "hi") -> bytes:
    """
    Convert English recommendation text to speech in the target language.

    When language != 'en', this executes a two-task pipeline:
        NMT (en → target) + TTS (target)
    When language == 'en', it executes a single-task pipeline:
        TTS (en)

    Args:
        text:     The English recommendation sentence to speak.
        language: Target language code — 'en', 'hi', 'mr', or 'bn'.

    Returns:
        Raw audio bytes (WAV/MP3).

    Raises:
        BhashiniError: If Bhashini is unconfigured or the API call fails.
        ValueError:    If an unsupported language is requested.
    """
    if not _is_configured():
        raise BhashiniError(
            "Bhashini TTS is not configured. Set BHASHINI_USER_ID and "
            "BHASHINI_API_KEY in your .env file."
        )

    lang = language.lower().split("-")[0]  # accept 'hi-IN' → 'hi'
    if lang not in SUPPORTED_LANGUAGES:
        raise ValueError(
            f"Unsupported language: {language!r}. Supported: {list(SUPPORTED_LANGUAGES)}"
        )

    target_lang = SUPPORTED_LANGUAGES[lang]

    # Task configuration
    if target_lang == "en":
        task_types = ["tts"]
        pipeline_tasks = [
            {
                "taskType": "tts",
                "config": {
                    "language": {"sourceLanguage": "en"},
                    "gender": "female",
                    "samplingRate": 22050,
                },
            }
        ]
    else:
        task_types = ["translation", "tts"]
        pipeline_tasks = [
            {
                "taskType": "translation",
                "config": {
                    "language": {
                        "sourceLanguage": TRANSLATION_SOURCE,
                        "targetLanguage": target_lang,
                    }
                },
            },
            {
                "taskType": "tts",
                "config": {
                    "language": {"sourceLanguage": target_lang},
                    "gender": "female",
                    "samplingRate": 22050,
                },
            },
        ]

    try:
        # Step 1: Discover pipeline endpoint, credentials, and service IDs
        try:
            callback_url, auth_headers, service_ids = await _discover_pipeline(
                task_types=task_types,
                source_language=TRANSLATION_SOURCE,
                target_language=target_lang,
            )
            logger.warning(
                "[bhashini] Pipeline config call succeeded language=%s tasks=%s",
                target_lang,
                task_types,
            )
        except Exception as exc:
            logger.error(
                "[bhashini] Pipeline config call threw language=%s: %s",
                target_lang,
                exc,
            )
            raise

        # Inject discovered or overridden service IDs into task configs
        for task_obj in pipeline_tasks:
            t_type = task_obj["taskType"]
            discovered_sid = service_ids.get(t_type)
            env_override = os.getenv(f"BHASHINI_{t_type.upper()}_SERVICE_ID_{target_lang.upper()}") or os.getenv(f"BHASHINI_{t_type.upper()}_SERVICE_ID")
            sid = env_override or discovered_sid
            if sid:
                task_obj["config"]["serviceId"] = sid

        # Step 2: Compute translation + TTS
        try:
            audio_bytes = await _compute(
                callback_url=callback_url,
                auth_headers=auth_headers,
                pipeline_tasks=pipeline_tasks,
                input_text=text,
            )
            logger.warning(
                "[bhashini] Compute call succeeded language=%s tasks=%s",
                target_lang,
                task_types,
            )
        except Exception as exc:
            logger.error(
                "[bhashini] Compute call threw language=%s: %s",
                target_lang,
                exc,
            )
            raise
    except BhashiniError:
        raise
    except Exception as exc:
        logger.error("[bhashini] TTS pipeline error: %s", exc)
        raise BhashiniError(f"Bhashini TTS failed: {exc}") from exc

    return audio_bytes
