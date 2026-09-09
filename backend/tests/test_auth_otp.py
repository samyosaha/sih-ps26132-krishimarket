"""End-to-end checks for the OTP-gated authentication flows."""

import os
import sys
import tempfile
import unittest
from pathlib import Path


class OtpAuthenticationFlowTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        database_path = Path(cls.temp_dir.name, "otp-flow.db").as_posix()
        os.environ["DATABASE_URL"] = f"sqlite:///{database_path}"
        os.environ["ENVIRONMENT"] = "development"
        os.environ["SMS_API_KEY"] = ""

        backend_dir = Path(__file__).resolve().parents[1]
        sys.path.insert(0, str(backend_dir))
        from fastapi.testclient import TestClient
        from app.database import engine
        from app.main import app

        cls.client = TestClient(app)
        cls.engine = engine

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        cls.engine.dispose()
        cls.temp_dir.cleanup()

    def request_signup_otp(self, phone: str, email: str) -> str:
        response = self.client.post(
            "/auth/otp/request",
            json={"phone": phone, "email": email, "purpose": "signup"},
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()["dev_otp"]

    def create_user(self, phone: str, email: str, password: str = "Password1") -> dict:
        otp = self.request_signup_otp(phone, email)
        response = self.client.post(
            "/auth/otp/verify",
            json={
                "phone": phone,
                "otp": otp,
                "purpose": "signup",
                "name": "OTP Test Farmer",
                "email": email,
                "password": password,
                "role": "farmer",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_signup_requires_a_code_and_marks_phone_verified(self):
        details = {
            "phone": "+91 98765 43210",
            "name": "OTP Test Farmer",
            "email": "signup@example.com",
            "password": "Password1",
            "role": "farmer",
        }
        unverified = self.client.post("/auth/register", json=details)
        self.assertEqual(unverified.status_code, 422)

        token = self.create_user(details["phone"], details["email"])["access_token"]
        me = self.client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        self.assertEqual(me.status_code, 200, me.text)
        self.assertTrue(me.json()["phone_verified"])
        self.assertEqual(me.json()["phone"], "9876543210")

    def test_password_login_returns_a_challenge_not_a_session(self):
        phone = "9876543211"
        email = "login@example.com"
        self.create_user(phone, email)

        challenge = self.client.post(
            "/auth/login",
            json={"email": email, "password": "Password1"},
        )
        self.assertEqual(challenge.status_code, 200, challenge.text)
        self.assertNotIn("access_token", challenge.json())
        self.assertEqual(challenge.json()["phone"], phone)

        completed = self.client.post(
            "/auth/otp/verify",
            json={
                "phone": phone,
                "otp": challenge.json()["dev_otp"],
                "purpose": "login",
            },
        )
        self.assertEqual(completed.status_code, 200, completed.text)
        self.assertIn("access_token", completed.json())


if __name__ == "__main__":
    unittest.main()
