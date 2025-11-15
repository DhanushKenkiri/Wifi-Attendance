"""Flask captive portal for local attendance marking."""

from __future__ import annotations

import atexit
import csv
import hashlib
import json
import secrets
from datetime import datetime, timezone
from functools import wraps
from pathlib import Path
from typing import Any, Dict, Optional

from io import StringIO

from flask import Flask, Response, g, jsonify, redirect, render_template, request
from itsdangerous import BadSignature, BadTimeSignature, SignatureExpired, URLSafeTimedSerializer

from utils import captive_dns, firewall, firebase_client, local_db, session_manager

_BASE_DIR = Path(__file__).resolve().parent
_CONFIG_DIR = _BASE_DIR / "config"

NETWORK_CONFIG = json.loads((_CONFIG_DIR / "network_settings.json").read_text(encoding="utf-8"))
_APP_SECRET = NETWORK_CONFIG.get("session", {}).get("flask_secret_key", "change-me-in-production")
_DATA_SOURCE = NETWORK_CONFIG.get("data_source", "firebase").lower()
_USING_SQLITE = _DATA_SOURCE == "sqlite"
_SQLITE_CONFIG = NETWORK_CONFIG.get("sqlite", {})
_SQLITE_DB_PATH_RAW = Path(_SQLITE_CONFIG.get("db_path", "data/portal.db"))
_SQLITE_DB_PATH = (
    _SQLITE_DB_PATH_RAW
    if _SQLITE_DB_PATH_RAW.is_absolute()
    else (_BASE_DIR / _SQLITE_DB_PATH_RAW).resolve()
)
_ALLOWED_ORIGINS = NETWORK_CONFIG.get("allowed_origins", ["*"])
if isinstance(_ALLOWED_ORIGINS, str):
    _ALLOWED_ORIGINS = [_ALLOWED_ORIGINS]
_NORMALISED_ALLOWED_ORIGINS = {origin.rstrip('/') for origin in _ALLOWED_ORIGINS}
_AUTH_TOKEN_TTL_SECONDS = int(
    NETWORK_CONFIG.get("session", {}).get("teacher_token_ttl_seconds", 12 * 60 * 60)
)
_PORTAL_IP = NETWORK_CONFIG.get("portal_ip", "192.168.137.1")
_CAPTIVE_DNS_CONFIG = NETWORK_CONFIG.get("captive_dns", {}) or {}
_DNS_HANDLE: Optional[captive_dns.DNSServerHandle] = None
if _CAPTIVE_DNS_CONFIG.get("enabled"):
    try:
        grant_url = None
        if _CAPTIVE_DNS_CONFIG.get("auto_grant_on_connect"):
            app_port = int(NETWORK_CONFIG.get("port", 8080))
            grant_url = f"http://127.0.0.1:{app_port}/api/grant-access"

        _DNS_HANDLE = captive_dns.start_dns_server(
            listen_address=_CAPTIVE_DNS_CONFIG.get("listen_address", "0.0.0.0"),
            listen_port=int(_CAPTIVE_DNS_CONFIG.get("listen_port", 53)),
            portal_ip=_CAPTIVE_DNS_CONFIG.get("portal_ip") or _PORTAL_IP,
            bypass_domains=_CAPTIVE_DNS_CONFIG.get("bypass_domains") or NETWORK_CONFIG.get("allowed_domains", []),
            force_portal_domains=_CAPTIVE_DNS_CONFIG.get("force_portal_domains", []),
            upstream_servers=_CAPTIVE_DNS_CONFIG.get("upstream_servers", []),
            log_queries=bool(_CAPTIVE_DNS_CONFIG.get("log_queries", False)),
            auto_grant=bool(_CAPTIVE_DNS_CONFIG.get("auto_grant_on_connect", False)),
            grant_url=grant_url,
        )
        atexit.register(captive_dns.stop_dns_server, _DNS_HANDLE)
    except captive_dns.CaptiveDNSError as exc:
        print(f"[Captive DNS] Disabled: {exc}")
DEFAULT_STUDENT_PASSWORD = "sest@2024"

app = Flask(__name__)
app.secret_key = _APP_SECRET if _APP_SECRET != "change-me-in-production" else secrets.token_hex(32)
session_manager.configure_session(
    app,
    lifetime_minutes=int(NETWORK_CONFIG.get("session", {}).get("lifetime_minutes", 180)),
    secure_cookie=bool(NETWORK_CONFIG.get("session", {}).get("secure_cookie", False)),
)

if _USING_SQLITE:
    local_db.initialize_database(
        _SQLITE_DB_PATH,
        seed_sample=bool(_SQLITE_CONFIG.get("seed_demo_data", False)),
    )

_token_serializer = URLSafeTimedSerializer(app.secret_key, salt="teacher-auth")


def _generate_teacher_token(teacher_id: int) -> str:
    return _token_serializer.dumps({"teacher_id": teacher_id})


def _decode_teacher_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        return _token_serializer.loads(token, max_age=_AUTH_TOKEN_TTL_SECONDS)
    except (BadSignature, BadTimeSignature, SignatureExpired):
        return None


def require_teacher_auth(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"success": False, "error": "Authentication required."}), 401
        token = auth_header.split(" ", 1)[1].strip()
        data = _decode_teacher_token(token)
        if not data or "teacher_id" not in data:
            return jsonify({"success": False, "error": "Invalid or expired token."}), 401
        try:
            teacher = local_db.get_teacher_by_id(_SQLITE_DB_PATH, int(data["teacher_id"]))
        except local_db.LocalDatabaseError as exc:
            return jsonify({"success": False, "error": str(exc)}), 500
        if not teacher:
            return jsonify({"success": False, "error": "Teacher account not found."}), 401
        g.teacher = teacher
        g.teacher_token = token
        return func(*args, **kwargs)

    return wrapper

def _is_origin_allowed(origin: Optional[str]) -> bool:
    if not origin:
        return False
    if _ALLOWED_ORIGINS == ["*"]:
        return True
    return origin.rstrip('/') in _NORMALISED_ALLOWED_ORIGINS


@app.before_request
def handle_cors_preflight():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        origin = request.headers.get("Origin")
        allow_headers = request.headers.get("Access-Control-Request-Headers", "Content-Type, Authorization")
        allow_method = request.headers.get("Access-Control-Request-Method", "GET, POST, PUT, PATCH, DELETE, OPTIONS")

        if _is_origin_allowed(origin):
            response.headers["Access-Control-Allow-Origin"] = origin
        elif _ALLOWED_ORIGINS == ["*"]:
            response.headers["Access-Control-Allow-Origin"] = origin or "*"

        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Headers"] = allow_headers
        response.headers["Access-Control-Allow-Methods"] = allow_method
        response.headers["Vary"] = "Origin"
        return response
    return None


@app.after_request
def add_cors_headers(response):
    origin = request.headers.get("Origin")
    if not origin:
        return response

    if _is_origin_allowed(origin):
        response.headers["Access-Control-Allow-Origin"] = origin
    elif _ALLOWED_ORIGINS == ["*"]:
        response.headers["Access-Control-Allow-Origin"] = origin

    if "Access-Control-Allow-Origin" in response.headers:
        response.headers["Access-Control-Allow-Credentials"] = "true"
        existing_vary = response.headers.get("Vary")
        if existing_vary:
            if "Origin" not in existing_vary:
                response.headers["Vary"] = f"{existing_vary}, Origin"
        else:
            response.headers["Vary"] = "Origin"

    return response


def _serialise_teacher(teacher: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": teacher.get("id"),
        "email": teacher.get("email"),
        "name": teacher.get("name"),
        "classId": teacher.get("class_id"),
        "department": teacher.get("department"),
    }


def _serialise_attendance_code(code: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not code:
        return None
    return {
        "classId": code.get("id") or code.get("class_id"),
        "code": code.get("code"),
        "subject": code.get("subject"),
        "teacherName": code.get("teacher_name"),
        "expiryTime": code.get("expiry_time"),
        "department": code.get("department"),
        "duration": code.get("duration"),
        "createdAt": code.get("created_at"),
    }


def _serialise_attendance_record(record: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": record.get("id"),
        "studentId": record.get("student_id"),
        "name": record.get("name"),
        "email": record.get("email"),
        "timestamp": record.get("timestamp"),
        "markedAt": record.get("marked_at"),
        "date": record.get("date"),
        "subject": record.get("subject"),
        "code": record.get("code"),
        "manualEntry": bool(record.get("manual_entry")),
        "teacherName": record.get("teacher_name"),
        "department": record.get("department"),
        "markedVia": record.get("marked_via"),
        "deviceFingerprint": record.get("device_fingerprint"),
    }


def _serialise_student(student: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "studentId": student.get("id"),
        "name": student.get("name"),
        "email": student.get("email"),
        "department": student.get("department"),
        "batch": student.get("batch"),
        "classId": student.get("class_id"),
    }


def _require_sqlite_enabled():
    if not _USING_SQLITE:
        return jsonify({"success": False, "error": "SQLite data source is not enabled."}), 400
    return None


@app.context_processor
def inject_globals() -> dict[str, Any]:
    return {"current_year": datetime.now().year}


@app.route("/generate_204")
@app.route("/generate-204")
@app.route("/.well-known/generate-204")
@app.route("/hotspot-detect.html")
@app.route("/ncsi.txt")
@app.route("/connecttest.txt")
@app.route("/success.txt")
@app.route("/library/test/success.html")
@app.route("/detectportal.html")
@app.route("/wpad.dat")
@app.route("/fwlink")
def captive_probe_redirect():
    """Force OS connectivity checks back to the login flow."""
    return redirect("/verify", code=302)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/verify", methods=["GET", "POST"])
def verify_code():
    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        code = str(payload.get("code", "")).strip()
        if len(code) != 6:
            return jsonify({"success": False, "error": "Please enter the 6-digit code."}), 400

        try:
            if _USING_SQLITE:
                code_data = local_db.verify_attendance_code(_SQLITE_DB_PATH, code)
            else:
                firebase_client.initialise()
                code_data = firebase_client.verify_attendance_code(code)
        except local_db.LocalDatabaseError as exc:
            return jsonify({"success": False, "error": str(exc)}), 500
        except firebase_client.FirebaseConfigurationError as exc:
            return jsonify({"success": False, "error": str(exc)}), 500

        if not code_data:
            return jsonify({"success": False, "error": "Invalid or expired code."}), 400

        session_manager.store_code_data(code_data)
        return jsonify({"success": True, "data": code_data})

    return render_template("verify.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    code_data = session_manager.get_code_data()
    if not code_data:
        return redirect("/verify")

    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        password = str(payload.get("password", "")).strip()

        if _USING_SQLITE:
            roll_number = (
                payload.get("rollNumber")
                or payload.get("roll_no")
                or payload.get("rollNo")
                or payload.get("studentId")
                or ""
            )
            student_id = str(roll_number).strip().lower()
            if not student_id:
                return jsonify({"success": False, "error": "Enter your roll number."}), 400
            if not password:
                return jsonify({"success": False, "error": "Password is required."}), 400
            try:
                student = local_db.fetch_student(_SQLITE_DB_PATH, student_id)
            except local_db.LocalDatabaseError as exc:
                return jsonify({"success": False, "error": str(exc)}), 500
            if not student:
                return jsonify({"success": False, "error": "Student not found."}), 404

            stored_password = str(student.get("password", ""))
            if stored_password and stored_password != password:
                return jsonify({"success": False, "error": "Invalid password."}), 401

            session_manager.store_student_data(
                {
                    "studentId": student_id,
                    "name": student.get("name", student_id),
                    "email": student.get("email"),
                    "department": student.get("department"),
                    "batch": student.get("batch"),
                }
            )
        else:
            email = str(payload.get("email", "")).strip().lower()
            if not email or "@" not in email:
                return jsonify({"success": False, "error": "Enter a valid university email."}), 400
            if not password:
                return jsonify({"success": False, "error": "Password is required."}), 400
            student_id = email.split("@")[0]
            try:
                firebase_client.initialise()
                student = firebase_client.fetch_student(student_id)
            except firebase_client.FirebaseConfigurationError as exc:
                return jsonify({"success": False, "error": str(exc)}), 500
            if not student:
                return jsonify({"success": False, "error": "Student not found."}), 404

            stored_password = str(student.get("password", ""))
            if stored_password and stored_password != password:
                return jsonify({"success": False, "error": "Invalid password."}), 401

            session_manager.store_student_data(
                {
                    "studentId": student_id,
                    "name": student.get("name", student_id),
                    "email": student.get("email") or email,
                    "department": student.get("department"),
                    "batch": student.get("batch"),
                }
            )

        return jsonify({"success": True})

    return render_template("login.html", code_data=code_data)


@app.route("/mark-attendance", methods=["GET", "POST"])
def mark_attendance():
    code_data = session_manager.get_code_data()
    student = session_manager.get_student_data()
    if not code_data or not student:
        session_manager.clear_all()
        return redirect("/verify")

    if request.method == "POST":
        today = datetime.now(tz=timezone.utc).date().isoformat()
        try:
            if _USING_SQLITE:
                existing = local_db.load_existing_attendance(
                    _SQLITE_DB_PATH, code_data["classId"], student["studentId"]
                )
            else:
                firebase_client.initialise()
                existing = firebase_client.load_existing_attendance(
                    code_data["classId"], student["studentId"]
                )
        except local_db.LocalDatabaseError as exc:
            return jsonify({"success": False, "error": str(exc)}), 500
        except firebase_client.FirebaseConfigurationError as exc:
            return jsonify({"success": False, "error": str(exc)}), 500
        if existing and existing.get("date") == today:
            return (
                jsonify({"success": False, "error": "Attendance already recorded for today."}),
                400,
            )

        timestamp = datetime.now(tz=timezone.utc)
        forwarded_for = request.headers.get("X-Forwarded-For", "")
        primary_ip = forwarded_for.split(",")[0].strip() if forwarded_for else (request.remote_addr or "unknown")
        user_agent = request.headers.get("User-Agent", "unknown")
        fingerprint_source = f"{primary_ip}|{user_agent}"
        fingerprint = hashlib.sha256(fingerprint_source.encode("utf-8", "ignore")).hexdigest()
        attendance_payload = {
            "name": student.get("name"),
            "email": student.get("email"),
            "studentId": student.get("studentId"),
            "timestamp": int(timestamp.timestamp() * 1000),
            "markedAt": timestamp.isoformat(),
            "date": today,
            "subject": code_data.get("subject", "N/A"),
            "code": code_data.get("code"),
            "manualEntry": False,
            "teacherName": code_data.get("teacherName"),
            "classId": code_data.get("classId"),
            "department": code_data.get("department", student.get("department")),
            "markedVia": "Captive Portal",
            "deviceFingerprint": fingerprint,
        }

        try:
            if _USING_SQLITE:
                local_db.mark_attendance(
                    _SQLITE_DB_PATH, code_data["classId"], student["studentId"], attendance_payload
                )
            else:
                firebase_client.mark_attendance(
                    code_data["classId"], student["studentId"], attendance_payload
                )
        except local_db.LocalDatabaseError as exc:
            message = str(exc)
            status = 400 if "already" in message.lower() or "device" in message.lower() else 500
            return jsonify({"success": False, "error": message}), status

        if NETWORK_CONFIG.get("firewall", {}).get("enabled", False):
            rule_prefix = NETWORK_CONFIG["firewall"].get("rule_prefix", "Attendance")
            firewall.grant_internet_access(request.remote_addr, student["studentId"], rule_prefix)

        session_manager.store_attendance_data(attendance_payload)
        return jsonify({"success": True, "data": attendance_payload})

    return render_template("mark-attendance.html", student=student, code_data=code_data)


@app.route("/success")
def success():
    data = session_manager.get_attendance_data()
    if not data:
        return redirect("/")
    return render_template("success.html", data=data)


@app.route("/api/client-ip")
def client_ip():
    return jsonify({"ip": request.remote_addr})


@app.route("/api/grant-access", methods=["POST"])
def grant_access_api():
    payload = request.get_json(silent=True) or {}
    student_id = payload.get("studentId") or "anonymous"
    ip_address = payload.get("ipAddress") or request.remote_addr
    rule_prefix = NETWORK_CONFIG.get("firewall", {}).get("rule_prefix", "Attendance")
    success = firewall.grant_internet_access(ip_address, student_id, rule_prefix)
    return jsonify({"success": success})


@app.route("/api/health", methods=["GET"])
def api_health():
    return jsonify({"success": True, "status": "ok", "dataSource": _DATA_SOURCE})


@app.route("/api/teachers/signup", methods=["POST"])
def api_teacher_signup():
    sqlite_guard = _require_sqlite_enabled()
    if sqlite_guard:
        return sqlite_guard

    data = request.get_json(silent=True) or {}
    teacher_payload = {
        "email": data.get("email"),
        "password": data.get("password"),
        "name": data.get("name"),
        "classId": data.get("classId"),
        "department": data.get("department"),
    }
    try:
        teacher = local_db.create_teacher(_SQLITE_DB_PATH, teacher_payload)
    except local_db.LocalDatabaseError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    token = _generate_teacher_token(int(teacher["id"]))
    return jsonify({"success": True, "token": token, "teacher": _serialise_teacher(teacher)})


@app.route("/api/teachers/login", methods=["POST"])
def api_teacher_login():
    sqlite_guard = _require_sqlite_enabled()
    if sqlite_guard:
        return sqlite_guard

    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", "")).strip()
    if not email or not password:
        return jsonify({"success": False, "error": "Email and password are required."}), 400

    try:
        teacher = local_db.verify_teacher_credentials(_SQLITE_DB_PATH, email, password)
    except local_db.LocalDatabaseError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

    if not teacher:
        return jsonify({"success": False, "error": "Invalid credentials."}), 401

    token = _generate_teacher_token(int(teacher["id"]))
    return jsonify({"success": True, "token": token, "teacher": _serialise_teacher(teacher)})


@app.route("/api/teachers/me", methods=["GET"])
@require_teacher_auth
def api_teacher_profile():
    sqlite_guard = _require_sqlite_enabled()
    if sqlite_guard:
        return sqlite_guard
    return jsonify({"success": True, "teacher": _serialise_teacher(g.teacher)})


@app.route("/api/attendance-codes/active", methods=["GET"])
@require_teacher_auth
def api_active_code():
    sqlite_guard = _require_sqlite_enabled()
    if sqlite_guard:
        return sqlite_guard

    class_id = request.args.get("classId") or g.teacher.get("classId") or g.teacher.get("class_id")
    try:
        code = local_db.get_attendance_code(_SQLITE_DB_PATH, class_id)
    except local_db.LocalDatabaseError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

    return jsonify({"success": True, "code": _serialise_attendance_code(code)})


@app.route("/api/attendance-codes", methods=["POST"])
@require_teacher_auth
def api_create_code():
    sqlite_guard = _require_sqlite_enabled()
    if sqlite_guard:
        return sqlite_guard

    data = request.get_json(silent=True) or {}
    duration = int(data.get("durationMinutes", _SQLITE_CONFIG.get("default_duration", 5)))
    duration = max(1, min(duration, 120))
    class_id = data.get("classId") or g.teacher.get("classId") or g.teacher.get("class_id")
    subject = data.get("subject")
    teacher_name = g.teacher.get("name") or g.teacher.get("email")
    department = g.teacher.get("department")
    now_ms = int(datetime.now(tz=timezone.utc).timestamp() * 1000)
    expiry = now_ms + duration * 60 * 1000
    code_value = f"{secrets.randbelow(900000) + 100000:06d}"

    try:
        saved = local_db.save_attendance_code(
            _SQLITE_DB_PATH,
            class_id=class_id,
            code=code_value,
            subject=subject,
            teacher_name=teacher_name,
            expiry_time=expiry,
            department=department,
            duration_minutes=duration,
            teacher_id=g.teacher.get("id"),
        )
    except local_db.LocalDatabaseError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

    return jsonify({"success": True, "code": _serialise_attendance_code(saved)})


@app.route("/api/attendance-codes", methods=["DELETE"])
@require_teacher_auth
def api_delete_code():
    sqlite_guard = _require_sqlite_enabled()
    if sqlite_guard:
        return sqlite_guard

    data = request.get_json(silent=True) or {}
    class_id = data.get("classId") or g.teacher.get("classId") or g.teacher.get("class_id")
    try:
        local_db.clear_attendance_code(_SQLITE_DB_PATH, class_id)
    except local_db.LocalDatabaseError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500
    return jsonify({"success": True})


@app.route("/api/attendance", methods=["GET"])
@require_teacher_auth
def api_list_attendance():
    sqlite_guard = _require_sqlite_enabled()
    if sqlite_guard:
        return sqlite_guard

    class_id = request.args.get("classId") or g.teacher.get("classId") or g.teacher.get("class_id")
    try:
        records = local_db.list_attendance_records(_SQLITE_DB_PATH, class_id)
    except local_db.LocalDatabaseError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

    serialised = [_serialise_attendance_record(record) for record in records]
    return jsonify({"success": True, "records": serialised})


@app.route("/api/attendance/export", methods=["GET"])
@require_teacher_auth
def api_export_attendance():
    sqlite_guard = _require_sqlite_enabled()
    if sqlite_guard:
        return sqlite_guard

    class_id = request.args.get("classId") or g.teacher.get("classId") or g.teacher.get("class_id")
    try:
        records = local_db.list_attendance_records(_SQLITE_DB_PATH, class_id)
    except local_db.LocalDatabaseError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

    buffer = StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "Attendance ID",
            "Student ID",
            "Name",
            "Email",
            "Date",
            "Marked At",
            "Subject",
            "Code",
            "Manual Entry",
            "Marked Via",
            "Teacher Name",
            "Department",
            "Class ID",
            "Timestamp",
        ]
    )

    for record in records:
        writer.writerow(
            [
                record.get("id"),
                record.get("student_id"),
                record.get("name") or "",
                record.get("email") or "",
                record.get("date") or "",
                record.get("marked_at") or "",
                record.get("subject") or "",
                record.get("code") or "",
                "Yes" if record.get("manual_entry") else "No",
                record.get("marked_via") or "",
                record.get("teacher_name") or "",
                record.get("department") or "",
                record.get("class_id") or "",
                record.get("timestamp") or "",
            ]
        )

    csv_content = buffer.getvalue()
    buffer.close()

    timestamp_suffix = datetime.now(tz=timezone.utc).strftime("%Y%m%d_%H%M%S")
    safe_class_id = (class_id or "class").replace(" ", "_")
    filename = f"attendance_{safe_class_id}_{timestamp_suffix}.csv"

    response = Response(csv_content, mimetype="text/csv; charset=utf-8")
    response.headers["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


@app.route("/api/attendance/manual", methods=["POST"])
@require_teacher_auth
def api_manual_attendance():
    sqlite_guard = _require_sqlite_enabled()
    if sqlite_guard:
        return sqlite_guard

    data = request.get_json(silent=True) or {}
    student_id = str(data.get("studentId", "")).strip().lower()
    student_name = data.get("studentName") or data.get("name")
    subject = data.get("subject") or "Manual entry"
    if not student_id:
        return jsonify({"success": False, "error": "Student ID is required."}), 400
    if not student_name:
        return jsonify({"success": False, "error": "Student name is required."}), 400

    class_id = data.get("classId") or g.teacher.get("classId") or g.teacher.get("class_id")
    teacher_name = g.teacher.get("name") or g.teacher.get("email")
    department = g.teacher.get("department")

    try:
        student = local_db.fetch_student(_SQLITE_DB_PATH, student_id)
        if not student:
            student = local_db.add_or_update_student(
                _SQLITE_DB_PATH,
                {
                    "studentId": student_id,
                    "name": student_name,
                    "department": department,
                    "classId": class_id,
                    "password": DEFAULT_STUDENT_PASSWORD,
                },
            )
        timestamp = datetime.now(tz=timezone.utc)
        attendance_payload = {
            "name": student_name,
            "email": student.get("email"),
            "studentId": student_id,
            "timestamp": int(timestamp.timestamp() * 1000),
            "markedAt": timestamp.isoformat(),
            "date": timestamp.date().isoformat(),
            "subject": subject,
            "code": "manual",
            "manualEntry": True,
            "teacherName": teacher_name,
            "classId": class_id,
            "department": department,
            "markedVia": "Teacher Dashboard",
        }
        local_db.mark_attendance(_SQLITE_DB_PATH, class_id, student_id, attendance_payload)
        record = local_db.load_existing_attendance(_SQLITE_DB_PATH, class_id, student_id)
    except local_db.LocalDatabaseError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    return jsonify({"success": True, "record": _serialise_attendance_record(record) if record else None})


@app.route("/api/students", methods=["GET"])
@require_teacher_auth
def api_list_students():
    sqlite_guard = _require_sqlite_enabled()
    if sqlite_guard:
        return sqlite_guard

    class_id = request.args.get("classId") or g.teacher.get("classId") or g.teacher.get("class_id")
    try:
        students = local_db.list_students(_SQLITE_DB_PATH, class_id)
    except local_db.LocalDatabaseError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

    serialised = [_serialise_student(student) for student in students]
    return jsonify({"success": True, "students": serialised, "defaultPassword": DEFAULT_STUDENT_PASSWORD})


@app.route("/api/students", methods=["POST"])
@require_teacher_auth
def api_create_student():
    sqlite_guard = _require_sqlite_enabled()
    if sqlite_guard:
        return sqlite_guard

    data = request.get_json(silent=True) or {}
    class_id = data.get("classId") or g.teacher.get("classId") or g.teacher.get("class_id")
    try:
        student = local_db.add_or_update_student(
            _SQLITE_DB_PATH,
            {
                "studentId": data.get("studentId") or data.get("id"),
                "name": data.get("name"),
                "email": data.get("email"),
                "department": data.get("department") or g.teacher.get("department"),
                "batch": data.get("batch"),
                "classId": class_id,
                "password": DEFAULT_STUDENT_PASSWORD,
            },
        )
    except local_db.LocalDatabaseError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    return jsonify({"success": True, "student": _serialise_student(student), "defaultPassword": DEFAULT_STUDENT_PASSWORD})


@app.route("/api/timetable", methods=["GET"])
@require_teacher_auth
def api_get_timetable():
    sqlite_guard = _require_sqlite_enabled()
    if sqlite_guard:
        return sqlite_guard

    try:
        entries = local_db.list_timetable_entries(_SQLITE_DB_PATH, g.teacher["id"])
    except local_db.LocalDatabaseError as exc:
        return jsonify({"success": False, "error": str(exc)}), 500

    return jsonify({"success": True, "entries": entries})


@app.route("/api/timetable", methods=["POST"])
@require_teacher_auth
def api_create_timetable_entry():
    sqlite_guard = _require_sqlite_enabled()
    if sqlite_guard:
        return sqlite_guard

    data = request.get_json(silent=True) or {}
    required_fields = {"subject", "day", "start_time", "end_time"}
    missing = {field for field in required_fields if not data.get(field)}
    if missing:
        return (
            jsonify({"success": False, "error": f"Missing fields: {', '.join(sorted(missing))}"}),
            400,
        )

    try:
        entry = local_db.create_timetable_entry(_SQLITE_DB_PATH, g.teacher["id"], data)
    except local_db.LocalDatabaseError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    return jsonify({"success": True, "entry": entry})


@app.route("/api/timetable/<int:entry_id>", methods=["PUT"])
@require_teacher_auth
def api_update_timetable_entry(entry_id: int):
    sqlite_guard = _require_sqlite_enabled()
    if sqlite_guard:
        return sqlite_guard

    data = request.get_json(silent=True) or {}
    try:
        entry = local_db.update_timetable_entry(_SQLITE_DB_PATH, g.teacher["id"], entry_id, data)
    except local_db.LocalDatabaseError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    return jsonify({"success": True, "entry": entry})


@app.route("/api/timetable/<int:entry_id>", methods=["DELETE"])
@require_teacher_auth
def api_delete_timetable_entry(entry_id: int):
    sqlite_guard = _require_sqlite_enabled()
    if sqlite_guard:
        return sqlite_guard

    try:
        local_db.delete_timetable_entry(_SQLITE_DB_PATH, g.teacher["id"], entry_id)
    except local_db.LocalDatabaseError as exc:
        return jsonify({"success": False, "error": str(exc)}), 400

    return jsonify({"success": True})


if __name__ == "__main__":
    host = NETWORK_CONFIG.get("host", "192.168.137.1")
    port = int(NETWORK_CONFIG.get("port", 8080))
    debug = bool(NETWORK_CONFIG.get("debug", False))
    use_reloader = bool(NETWORK_CONFIG.get("use_reloader", debug))
    app.run(host=host, port=port, debug=debug, use_reloader=use_reloader)
