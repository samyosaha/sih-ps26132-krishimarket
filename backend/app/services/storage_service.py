"""
File storage service with pluggable backends.

Defaults to local filesystem storage (uploads/ directory) for development
and hackathon demos.  Swap in S3/Supabase by changing the implementation
of save_file / get_file_url without touching any caller.
"""

import os
import uuid
import mimetypes
from pathlib import Path
from typing import BinaryIO

from PIL import Image

# ── Configuration ────────────────────────────────────────────────────

UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", "uploads"))

# Allowed MIME types for upload (server-side validation — never trust
# the client-supplied Content-Type alone)
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
}

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB

# Images wider/taller than this are resized before storage
IMAGE_MAX_DIMENSION = 1600


# ── Exceptions ───────────────────────────────────────────────────────

class StorageError(Exception):
    """Raised when file validation or storage fails."""


# ── Public API ───────────────────────────────────────────────────────

def save_file(
    file_content: BinaryIO,
    filename: str,
    category: str = "documents",
    content_type: str | None = None,
) -> str:
    """
    Validate, optionally compress, and save a file.

    Args:
        file_content: The raw file bytes (a file-like object).
        filename: Original filename (used only for extension detection).
        category: Storage subdirectory (e.g., "verification", "documents").
        content_type: MIME type reported by the client (treated as a hint,
                      not trusted for security).

    Returns:
        The relative path to the stored file (e.g., "verification/abc123.webp").

    Raises:
        StorageError: If the file is too large, has a disallowed type, or
                      storage fails.
    """
    # Read the full content to check size
    raw = file_content.read()
    if len(raw) > MAX_FILE_SIZE_BYTES:
        raise StorageError(
            f"File too large ({len(raw)} bytes). "
            f"Maximum allowed: {MAX_FILE_SIZE_BYTES} bytes."
        )

    # Determine MIME type from actual content (magic bytes), not from the
    # client-supplied Content-Type header.
    guessed_type = _guess_mime_type(filename, raw)
    if guessed_type not in ALLOWED_MIME_TYPES:
        raise StorageError(
            f"File type '{guessed_type}' is not allowed. "
            f"Accepted types: {', '.join(sorted(ALLOWED_MIME_TYPES))}"
        )

    # Generate a unique filename
    ext = _extension_for_mime(guessed_type)
    unique_name = f"{uuid.uuid4().hex}{ext}"

    # Ensure target directory exists
    target_dir = UPLOAD_DIR / category
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / unique_name

    # Compress images before saving
    if guessed_type.startswith("image/") and guessed_type != "application/pdf":
        _compress_and_save_image(raw, target_path)
    else:
        target_path.write_bytes(raw)

    relative_path = f"{category}/{unique_name}"
    return relative_path


def get_file_url(relative_path: str) -> str:
    """
    Return a URL for the stored file.

    For local storage, this returns a path that the backend can serve.
    For S3/Supabase, this would return a pre-signed URL.
    """
    base_url = os.getenv("FILE_STORAGE_BUCKET_URL", "").strip()
    if base_url:
        return f"{base_url.rstrip('/')}/{relative_path}"
    # Local fallback — served via a static files route
    return f"/uploads/{relative_path}"


def file_exists(relative_path: str) -> bool:
    """Check if a file exists at the given relative path."""
    return (UPLOAD_DIR / relative_path).exists()


# ── Internals ────────────────────────────────────────────────────────

def _guess_mime_type(filename: str, content: bytes) -> str:
    """Guess MIME type from filename extension and content magic bytes."""
    # Check magic bytes first (more reliable than extension)
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if content[:2] == b"\xff\xd8":
        return "image/jpeg"
    if content[:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    if content[:5] == b"%PDF-":
        return "application/pdf"
    # Fall back to extension
    mime, _ = mimetypes.guess_type(filename)
    return mime or "application/octet-stream"


def _extension_for_mime(mime_type: str) -> str:
    """Return a file extension for the given MIME type."""
    mapping = {
        "image/jpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "application/pdf": ".pdf",
    }
    return mapping.get(mime_type, ".bin")


def _compress_and_save_image(raw: bytes, target_path: Path) -> None:
    """Resize and compress an image, saving as WebP for smaller size."""
    import io
    img = Image.open(io.BytesIO(raw))

    # Convert to RGB if necessary (e.g., RGBA PNGs)
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    # Resize if too large
    if max(img.size) > IMAGE_MAX_DIMENSION:
        img.thumbnail((IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION), Image.LANCZOS)

    # Save as WebP for better compression
    webp_path = target_path.with_suffix(".webp")
    img.save(webp_path, format="WEBP", quality=80, optimize=True)

    # Update the target path in case caller used a different extension
    if target_path != webp_path and target_path.exists():
        target_path.unlink()
