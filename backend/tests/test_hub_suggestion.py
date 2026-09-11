import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.database import SessionLocal
from app.models import User, UserRole, Lot, Hub


class HubSuggestionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()
        # Find or create a test farmer
        cls.farmer = cls.db.query(User).filter(User.role == UserRole.farmer).first()
        if not cls.farmer:
            cls.farmer = User(
                name="Test Farmer Hub",
                phone="9999988888",
                password_hash="testpasshash",
                role=UserRole.farmer,
                phone_verified=True,
            )
            cls.db.add(cls.farmer)
            cls.db.commit()
            cls.db.refresh(cls.farmer)

        # Ensure test hubs exist for matching
        test_hubs = [
            ("Nashik APMC", "Nashik", "Maharashtra"),
            ("Pune Market Yard", "Pune", "Maharashtra"),
            ("Mumbai APMC", "Mumbai City", "Maharashtra"),
        ]
        for name, district, state in test_hubs:
            existing = cls.db.query(Hub).filter(Hub.name == name).first()
            if not existing:
                cls.db.add(Hub(name=name, district=district, state=state))
        cls.db.commit()

    @classmethod
    def tearDownClass(cls):
        cls.db.close()

    def test_suggest_hub_maharashtra_direct_match(self):
        """Nashik in Maharashtra should match Nashik APMC directly."""
        resp = self.client.get("/lots/suggest-hub?district=Nashik&state=Maharashtra")
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertTrue(data["matched"])
        self.assertEqual(data["hub_name"], "Nashik APMC")
        self.assertEqual(data["district"], "Nashik")
        self.assertFalse(data["is_regional_fallback"])
        self.assertIn("Nearest Hub: Nashik APMC", data["message"])
        self.assertIn("you'll drop off produce here", data["message"])

    def test_suggest_hub_maharashtra_pune_match(self):
        """Pune in Maharashtra should match Pune Market Yard."""
        resp = self.client.get("/lots/suggest-hub?district=Pune&state=Maharashtra")
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertTrue(data["matched"])
        self.assertEqual(data["hub_name"], "Pune Market Yard")
        self.assertFalse(data["is_regional_fallback"])

    def test_suggest_hub_maharashtra_suffix_cleaned(self):
        """Mumbai (clean of 'City') should match Mumbai APMC."""
        resp = self.client.get("/lots/suggest-hub?district=Mumbai&state=Maharashtra")
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertTrue(data["matched"])
        self.assertEqual(data["hub_name"], "Mumbai APMC")

    def test_suggest_hub_maharashtra_state_fallback(self):
        """A district with no direct hub (e.g. Satara) should fall back to a Maharashtra hub."""
        resp = self.client.get("/lots/suggest-hub?district=Satara&state=Maharashtra")
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertTrue(data["matched"])
        self.assertTrue(data["is_regional_fallback"])
        self.assertEqual(data["state"], "Maharashtra")
        self.assertIn("Nearest Hub:", data["message"])

    def test_suggest_hub_pincode_resolution(self):
        """Pincode starting with 422 (Nashik) should match Nashik APMC."""
        resp = self.client.get("/lots/suggest-hub?pincode=422001")
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertTrue(data["matched"])
        self.assertEqual(data["hub_name"], "Nashik APMC")

    def test_suggest_hub_no_match_graceful(self):
        """Completely unknown district and state should return matched=False with graceful note."""
        resp = self.client.get("/lots/suggest-hub?district=AtlantisCity&state=Narnia")
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertFalse(data["matched"])
        self.assertIsNone(data["hub_id"])
        self.assertEqual(
            data["message"],
            "No nearby Hub yet — direct buyer pickup only for this lot",
        )

    def test_lot_creation_auto_assigns_hub(self):
        """Creating a lot in Maharashtra without passing hub_id auto-assigns the nearest hub."""
        from app.auth import create_access_token
        token = create_access_token(data={"sub": str(self.farmer.id)})
        headers = {"Authorization": f"Bearer {token}"}

        payload = {
            "commodity": "Onion",
            "variety": "Nashik Red",
            "quantity_kg": 500.0,
            "quality_grade": "A",
            "asking_price_per_kg": 25.0,
            "district": "Nashik",
            "state": "Maharashtra",
        }
        resp = self.client.post("/lots", json=payload, headers=headers)
        self.assertEqual(resp.status_code, 200, resp.text)
        data = resp.json()
        self.assertIsNotNone(data["hub_id"])
        self.assertEqual(data["hub_name"], "Nashik APMC")
        self.assertEqual(data["district"], "Nashik")
        self.assertEqual(data["state"], "Maharashtra")

        # Verify lot detail also returns hub_name
        lot_id = data["id"]
        detail_resp = self.client.get(f"/lots/{lot_id}")
        self.assertEqual(detail_resp.status_code, 200)
        detail_data = detail_resp.json()
        self.assertEqual(detail_data["hub_name"], "Nashik APMC")
        self.assertEqual(detail_data["hub_id"], data["hub_id"])


if __name__ == "__main__":
    unittest.main()
