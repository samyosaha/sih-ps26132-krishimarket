"""
Input sanitization utilities to prevent XSS and injection attacks.

Usage:
    from app.sanitize import sanitize_string, sanitize_text

    clean_name = sanitize_string(raw_name, max_length=100)
    clean_msg  = sanitize_text(raw_message, max_length=500)
"""

import re
from html import escape as html_escape

# Regex to strip HTML/XML tags
_TAG_RE = re.compile(r"<[^>]+>")

# Regex to strip control characters (keep newlines/tabs for text fields)
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")

# Regex to strip control characters including newlines (for single-line fields)
_CONTROL_STRICT_RE = re.compile(r"[\x00-\x1f\x7f]")


def sanitize_string(value: str, max_length: int = 200) -> str:
    """
    Sanitize a short, single-line text field.

    - Strips HTML tags
    - Removes control characters (including newlines)
    - HTML-escapes special characters
    - Trims whitespace
    - Enforces max length
    """
    if not value:
        return value

    # Strip HTML tags first
    value = _TAG_RE.sub("", value)

    # Remove control characters
    value = _CONTROL_STRICT_RE.sub("", value)

    # HTML-escape to neutralize any remaining special chars
    value = html_escape(value, quote=True)

    # Trim and enforce length
    value = value.strip()
    if len(value) > max_length:
        value = value[:max_length]

    return value


def sanitize_text(value: str, max_length: int = 2000) -> str:
    """
    Sanitize a multi-line text field (messages, dispute reasons, etc.).

    - Strips HTML tags
    - Removes dangerous control characters (keeps \\n, \\t)
    - HTML-escapes special characters
    - Trims whitespace
    - Enforces max length
    """
    if not value:
        return value

    # Strip HTML tags
    value = _TAG_RE.sub("", value)

    # Remove control characters but keep newlines and tabs
    value = _CONTROL_RE.sub("", value)

    # HTML-escape
    value = html_escape(value, quote=True)

    # Trim and enforce length
    value = value.strip()
    if len(value) > max_length:
        value = value[:max_length]

    return value
