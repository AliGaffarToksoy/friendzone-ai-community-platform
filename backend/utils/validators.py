"""
Validation utilities for user input.

Contains functions to validate email addresses, password strength and
other user input constraints.
"""

import re


def is_valid_edu_email(email: str) -> bool:
    """Return True if the email ends with the `.edu.tr` domain."""
    return isinstance(email, str) and email.lower().strip().endswith('.edu.tr')


def is_strong_password(password: str) -> bool:
    """Validate that the password meets minimum length requirements."""
    return isinstance(password, str) and len(password) >= 6


def sanitize_text(text: str) -> str:
    """Basic sanitization to prevent XSS by escaping angle brackets.

    Args:
        text: The raw text input from user.

    Returns:
        A sanitized string safe to display in HTML.
    """
    return text.replace('<', '&lt;').replace('>', '&gt;') if isinstance(text, str) else ''