"""CLI: python seed_demo.py"""

from app.demo_accounts import seed

if __name__ == "__main__":
    seed()
    print("Demo accounts ready (farmer@demo.in / Farmer123, buyer@demo.in / Buyer123, admin@demo.in / Admin123)")
