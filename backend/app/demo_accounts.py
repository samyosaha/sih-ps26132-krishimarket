"""Create demo farmer, buyer, and admin accounts if they do not already exist."""

from app.database import SessionLocal
from app.models import User, UserRole
from app.auth import hash_password

DEMO_USERS = [
    {
        "name": "Demo Farmer",
        "phone": "9876543210",
        "email": "farmer@demo.in",
        "password": "Farmer123",
        "role": UserRole.farmer,
    },
    {
        "name": "Demo Buyer",
        "phone": "9876543211",
        "email": "buyer@demo.in",
        "password": "Buyer123",
        "role": UserRole.buyer,
    },
    {
        "name": "Demo Admin",
        "phone": "9876543212",
        "email": "admin@demo.in",
        "password": "Admin123",
        "role": UserRole.admin,
    },
]


def seed() -> None:
    db = SessionLocal()
    try:
        for item in DEMO_USERS:
            existing = (
                db.query(User)
                .filter((User.email == item["email"]) | (User.phone == item["phone"]))
                .first()
            )
            if existing:
                continue
            user = User(
                name=item["name"],
                phone=item["phone"],
                email=item["email"],
                password_hash=hash_password(item["password"]),
                role=item["role"],
            )
            db.add(user)
        db.commit()
    finally:
        db.close()
