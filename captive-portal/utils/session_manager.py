"""Utility helpers for working with Flask sessions in the captive portal."""

from datetime import datetime, timedelta
from typing import Any, Optional
from flask import current_app, session

_CODE_KEY = "code_data"
_STUDENT_KEY = "student_data"
_ATTENDANCE_KEY = "attendance_data"
_SESSION_EXPIRY_KEY = "session_expiry"


def _utc_now() -> datetime:
    return datetime.utcnow()


def configure_session(app, lifetime_minutes: int, secure_cookie: bool) -> None:
    """Apply session-related options to the Flask app instance."""
    app.permanent_session_lifetime = timedelta(minutes=lifetime_minutes)
    app.config["SESSION_COOKIE_SECURE"] = secure_cookie
    app.config["SESSION_COOKIE_SAMESITE"] = "Lax"


def _touch_session() -> None:
    session.permanent = True
    session[_SESSION_EXPIRY_KEY] = (_utc_now() + current_app.permanent_session_lifetime).isoformat()


def clear_all() -> None:
    for key in (_CODE_KEY, _STUDENT_KEY, _ATTENDANCE_KEY, _SESSION_EXPIRY_KEY):
        session.pop(key, None)


def store_code_data(data: dict[str, Any]) -> None:
    session[_CODE_KEY] = data
    _touch_session()


def get_code_data() -> Optional[dict[str, Any]]:
    return session.get(_CODE_KEY)


def store_student_data(data: dict[str, Any]) -> None:
    session[_STUDENT_KEY] = data
    _touch_session()


def get_student_data() -> Optional[dict[str, Any]]:
    return session.get(_STUDENT_KEY)


def store_attendance_data(data: dict[str, Any]) -> None:
    session[_ATTENDANCE_KEY] = data
    _touch_session()


def get_attendance_data() -> Optional[dict[str, Any]]:
    return session.get(_ATTENDANCE_KEY)
