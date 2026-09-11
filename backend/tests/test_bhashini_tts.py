"""
Unit tests for Bhashini service and /tts router.
"""

import os
import sys
import unittest
from unittest.mock import patch, AsyncMock
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(backend_dir))

import httpx
from httpx import ASGITransport
from app.main import app
from app.services import bhashini_service
from app.services.bhashini_service import BhashiniError, text_to_speech


class TestBhashiniTTS(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        transport = ASGITransport(app=app)
        self.client = httpx.AsyncClient(transport=transport, base_url="http://test")

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_tts_endpoint_validation_unsupported_language(self):
        """Requesting an unsupported language should return 422 Unprocessable Entity."""
        resp = await self.client.post("/tts", json={"text": "Hello world", "language": "fr"})
        self.assertEqual(resp.status_code, 422)

    async def test_tts_endpoint_unconfigured_bhashini_returns_503(self):
        """When Bhashini credentials are not configured, /tts should return 503 so client falls back."""
        with patch.dict(os.environ, {"BHASHINI_USER_ID": "", "BHASHINI_API_KEY": ""}, clear=True):
            resp = await self.client.post("/tts", json={"text": "Hello world", "language": "hi"})
            self.assertEqual(resp.status_code, 503)

    @patch("app.services.bhashini_service.text_to_speech", new_callable=AsyncMock)
    async def test_tts_endpoint_success_streams_audio(self, mock_tts):
        """When text_to_speech succeeds, /tts streams audio with proper headers."""
        fake_wav = b"RIFF" + b"\x00" * 100
        mock_tts.return_value = fake_wav

        resp = await self.client.post("/tts", json={"text": "Test recommendation", "language": "hi"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.headers.get("content-type"), "audio/wav")
        self.assertEqual(resp.content, fake_wav)

    async def test_text_to_speech_unconfigured_raises_error(self):
        """Calling text_to_speech without credentials raises BhashiniError."""
        with patch.dict(os.environ, {"BHASHINI_USER_ID": "", "BHASHINI_API_KEY": ""}, clear=True):
            with self.assertRaises(BhashiniError):
                await text_to_speech("Sample text", language="hi")

    async def test_text_to_speech_unsupported_lang_raises_value_error(self):
        """Calling text_to_speech with unsupported language raises ValueError."""
        with patch.dict(os.environ, {"BHASHINI_USER_ID": "uid", "BHASHINI_API_KEY": "key"}):
            with self.assertRaises(ValueError):
                await text_to_speech("Sample text", language="de")

    @patch("app.services.bhashini_service._discover_pipeline", new_callable=AsyncMock)
    @patch("app.services.bhashini_service._compute", new_callable=AsyncMock)
    async def test_text_to_speech_pipeline_flow(self, mock_compute, mock_discover):
        """Verifies discover -> inject serviceId -> compute flow."""
        mock_discover.return_value = (
            "https://test-compute.bhashini.gov.in/compute",
            {"Authorization": "test-key", "Content-Type": "application/json"},
            {"translation": "ai4bharat/indictrans", "tts": "ai4bharat/indic-tts"},
        )
        fake_audio = b"FAKE_AUDIO_BYTES"
        mock_compute.return_value = fake_audio

        with patch.dict(os.environ, {"BHASHINI_USER_ID": "uid", "BHASHINI_API_KEY": "key"}):
            result = await text_to_speech("Test wheat price", language="hi")
            self.assertEqual(result, fake_audio)
            mock_discover.assert_called_once()
            mock_compute.assert_called_once()

    def test_extract_service_id_nested_list(self):
        """Tests extracting serviceId from Bhashini response structure with nested list."""
        pipeline_cfg = [
            {
                "taskType": "translation",
                "config": [
                    {
                        "serviceId": "ai4bharat/indictrans-v2-all-gpu--t4",
                        "language": {"sourceLanguage": "en", "targetLanguage": "hi"},
                    },
                    {
                        "serviceId": "ai4bharat/indictrans-mr",
                        "language": {"sourceLanguage": "en", "targetLanguage": "mr"},
                    },
                ],
            },
            {
                "taskType": "tts",
                "config": [
                    {
                        "serviceId": "ai4bharat/indic-tts-hi",
                        "language": {"sourceLanguage": "hi"},
                    }
                ],
            },
        ]
        nmt_id = bhashini_service._extract_service_id(pipeline_cfg, "translation", "hi")
        self.assertEqual(nmt_id, "ai4bharat/indictrans-v2-all-gpu--t4")

        tts_id = bhashini_service._extract_service_id(pipeline_cfg, "tts", "hi")
        self.assertEqual(tts_id, "ai4bharat/indic-tts-hi")


if __name__ == "__main__":
    unittest.main()
