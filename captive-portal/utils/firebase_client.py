"""Firebase helper functions used by the captive portal."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import firebase_admin
from firebase_admin import credentials, db

_CONFIG_DIR = Path(__file__).resolve().parent.parent / "config"
_APP: Optional[firebase_admin.App] = None


class FirebaseConfigurationError(RuntimeError):
    """Raised when Firebase cannot be initialised."""


def initialise() -> firebase_admin.App:
    """Initialise Firebase Admin SDK exactly once."""
    global _APP
    if _APP:
        return _APP

    config_path = _CONFIG_DIR / "firebase_config.json"
    if not config_path.exists():
        raise FirebaseConfigurationError(
            "firebase_config.json is missing. Download a service account JSON file and place it in config/.",
        )

    payload = json.loads(config_path.read_text(encoding="utf-8"))
    database_url = payload.get("databaseURL")
    if not database_url:
        raise FirebaseConfigurationError("databaseURL must be provided in firebase_config.json")

    cred = credentials.Certificate(payload)
    _APP = firebase_admin.initialize_app(cred, {"databaseURL": database_url})
    return _APP


def _attendance_codes_ref():
    initialise()
    return db.reference("attendance_codes")


def verify_attendance_code(code: str) -> Optional[dict[str, Any]]:
    """Return attendance metadata if the code is valid and not expired."""
    snapshot = _attendance_codes_ref().get()
    if not snapshot:
        return None

    for class_id, data in snapshot.items():
        if str(data.get("code")) != str(code).strip():
            continue

        expiry_time = data.get("expiryTime")
        if expiry_time and int(expiry_time) < int(datetime.now(tz=timezone.utc).timestamp() * 1000):
            return None

        enriched = {"classId": class_id, **data}
        return enriched

    return None


def fetch_student(student_id: str) -> Optional[dict[str, Any]]:
    initialise()
    student_ref = db.reference(f"students/{student_id}")
    snapshot = student_ref.get()
    return snapshot if snapshot else None


def load_existing_attendance(class_id: str, student_id: str) -> Optional[dict[str, Any]]:
    initialise()
    attendance_ref = db.reference(f"attendance/{class_id}/{student_id}")
    snapshot = attendance_ref.get()
    return snapshot if snapshot else None


def mark_attendance(class_id: str, student_id: str, payload: dict[str, Any]) -> None:
    initialise()
    attendance_ref = db.reference(f"attendance/{class_id}/{student_id}")
    attendance_ref.set(payload)
