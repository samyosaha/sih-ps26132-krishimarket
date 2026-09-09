"""
Compatibility entrypoint.

Keep `backend/main.py` available for `uvicorn main:app`, but route all
runtime behavior through `backend/app/main.py` so there is only one real
application definition to maintain.
"""

from app.main import app
