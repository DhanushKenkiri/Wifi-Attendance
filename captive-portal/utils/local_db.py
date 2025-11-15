"""SQLite-backed persistence helpers for the captive portal and teacher dashboard."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from werkzeug.security import check_password_hash, generate_password_hash

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS attendance_codes (
	id TEXT PRIMARY KEY,
	code TEXT NOT NULL,
	subject TEXT,
	teacher_name TEXT,
	expiry_time INTEGER,
	department TEXT,
	duration INTEGER,
	generated_by INTEGER,
	created_at INTEGER,
	FOREIGN KEY (generated_by) REFERENCES teachers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS students (
	id TEXT PRIMARY KEY,
	name TEXT,
	email TEXT,
	department TEXT,
	batch TEXT,
	password TEXT
);

CREATE TABLE IF NOT EXISTS attendance (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	class_id TEXT NOT NULL,
	student_id TEXT NOT NULL,
	timestamp INTEGER NOT NULL,
	marked_at TEXT NOT NULL,
	date TEXT NOT NULL,
	subject TEXT,
	code TEXT,
	manual_entry INTEGER DEFAULT 0,
	teacher_name TEXT,
	department TEXT,
	marked_via TEXT,
	email TEXT,
	name TEXT,
	UNIQUE(class_id, student_id, date)
);

CREATE TABLE IF NOT EXISTS teachers (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	email TEXT UNIQUE NOT NULL,
	name TEXT NOT NULL,
	password_hash TEXT NOT NULL,
	class_id TEXT NOT NULL,
	department TEXT,
	created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS timetable (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	teacher_id INTEGER NOT NULL,
	subject TEXT NOT NULL,
	day TEXT NOT NULL,
	start_time TEXT NOT NULL,
	end_time TEXT NOT NULL,
	credits INTEGER DEFAULT 0,
	created_at TEXT NOT NULL,
	updated_at TEXT NOT NULL,
	FOREIGN KEY (teacher_id) REFERENCES teachers(id) ON DELETE CASCADE
);
"""

_OPTIONAL_COLUMNS: Dict[str, Dict[str, str]] = {
	"attendance_codes": {
		"duration": "INTEGER",
		"generated_by": "INTEGER",
		"created_at": "INTEGER",
	},
	"students": {
		"email": "TEXT",
		"department": "TEXT",
		"batch": "TEXT",
		"password": "TEXT",
		"class_id": "TEXT",
	},
	"attendance": {
		"marked_via": "TEXT",
		"email": "TEXT",
		"name": "TEXT",
		"device_fingerprint": "TEXT",
	},
}

SAMPLE_CODE = {
	"id": "sample-class",
	"code": "123456",
	"subject": "Sample Session",
	"teacher_name": "Admin",
	"expiry_time": int(datetime.now(tz=timezone.utc).timestamp() * 1000) + 3_600_000,
	"department": "General",
	"duration": 60,
	"created_at": int(datetime.now(tz=timezone.utc).timestamp() * 1000),
}

SAMPLE_STUDENT = {
	"id": "22mc123",
	"name": "Sample Student",
	"email": "22mc123@uohyd.ac.in",
	"department": "CSE",
	"batch": "2022",
	"password": "password123",
	"class_id": SAMPLE_CODE["id"],
}

SAMPLE_TEACHER = {
	"email": "teacher@example.edu",
	"name": "Demo Teacher",
	"password": "teachpass123",
	"class_id": "sample-class",
	"department": "General",
}


class LocalDatabaseError(RuntimeError):
	"""Raised when an SQLite operation fails."""


def _connect(db_path: Path) -> sqlite3.Connection:
	db_path.parent.mkdir(parents=True, exist_ok=True)
	conn = sqlite3.connect(db_path)
	conn.row_factory = sqlite3.Row
	conn.execute("PRAGMA foreign_keys = ON;")
	return conn


def _ensure_optional_columns(conn: sqlite3.Connection) -> None:
	for table, columns in _OPTIONAL_COLUMNS.items():
		existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})")}
		for column, definition in columns.items():
			if column not in existing:
				conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def _ensure_indexes(conn: sqlite3.Connection) -> None:
	conn.execute(
		"CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON attendance(class_id, date)"
	)
	conn.execute(
		"CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id)"
	)
	conn.execute(
		"CREATE INDEX IF NOT EXISTS idx_timetable_teacher_day ON timetable(teacher_id, day)"
	)


def _ensure_schema(conn: sqlite3.Connection) -> None:
	conn.executescript(SCHEMA_SQL)
	_ensure_optional_columns(conn)
	_ensure_indexes(conn)


def _now_ts_ms() -> int:
	return int(datetime.now(tz=timezone.utc).timestamp() * 1000)


def initialize_database(db_path: Path, seed_sample: bool = False) -> None:
	db_path = Path(db_path)
	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			if seed_sample:
				conn.execute(
					"""
					INSERT OR IGNORE INTO attendance_codes (
						id, code, subject, teacher_name, expiry_time, department, duration, created_at
					) VALUES (:id, :code, :subject, :teacher_name, :expiry_time, :department, :duration, :created_at)
					""",
					SAMPLE_CODE,
				)
				conn.execute(
					"""
					INSERT OR IGNORE INTO students (id, name, email, department, batch, password, class_id)
					VALUES (:id, :name, :email, :department, :batch, :password, :class_id)
					""",
					SAMPLE_STUDENT,
				)
				hashed = generate_password_hash(SAMPLE_TEACHER["password"])
				conn.execute(
					"""
					INSERT OR IGNORE INTO teachers (email, name, password_hash, class_id, department, created_at)
					VALUES (?, ?, ?, ?, ?, ?)
					""",
					(
						SAMPLE_TEACHER["email"].lower(),
						SAMPLE_TEACHER["name"],
						hashed,
						SAMPLE_TEACHER["class_id"],
						SAMPLE_TEACHER["department"],
						datetime.now(tz=timezone.utc).isoformat(),
					),
				)
			conn.commit()
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def verify_attendance_code(db_path: Path, code: str) -> Optional[Dict[str, Any]]:
	db_path = Path(db_path)
	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			row = conn.execute(
				"SELECT * FROM attendance_codes WHERE code = ? COLLATE NOCASE LIMIT 1",
				(str(code).strip(),),
			).fetchone()
			if not row:
				return None
			expiry_time = row["expiry_time"]
			if expiry_time and expiry_time < _now_ts_ms():
				conn.execute("DELETE FROM attendance_codes WHERE id = ?", (row["id"],))
				conn.commit()
				return None
			return {
				"classId": row["id"],
				"code": row["code"],
				"subject": row["subject"],
				"teacherName": row["teacher_name"],
				"expiryTime": row["expiry_time"],
				"department": row["department"],
				"duration": row["duration"],
			}
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def save_attendance_code(
	db_path: Path,
	*,
	class_id: str,
	code: str,
	subject: Optional[str],
	teacher_name: Optional[str],
	expiry_time: int,
	department: Optional[str],
	duration_minutes: int,
	teacher_id: Optional[int] = None,
) -> Dict[str, Any]:
	db_path = Path(db_path)
	payload = {
		"class_id": class_id,
		"code": code,
		"subject": subject,
		"teacher_name": teacher_name,
		"expiry_time": expiry_time,
		"department": department,
		"duration": duration_minutes,
		"generated_by": teacher_id,
		"created_at": _now_ts_ms(),
	}
	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			conn.execute(
				"""
				INSERT INTO attendance_codes (
					id, code, subject, teacher_name, expiry_time, department, duration, generated_by, created_at
				) VALUES (:class_id, :code, :subject, :teacher_name, :expiry_time, :department, :duration, :generated_by, :created_at)
				ON CONFLICT(id) DO UPDATE SET
					code=excluded.code,
					subject=excluded.subject,
					teacher_name=excluded.teacher_name,
					expiry_time=excluded.expiry_time,
					department=excluded.department,
					duration=excluded.duration,
					generated_by=excluded.generated_by,
					created_at=excluded.created_at
				""",
				payload,
			)
			conn.commit()
			row = conn.execute(
				"SELECT * FROM attendance_codes WHERE id = ?",
				(class_id,),
			).fetchone()
			return dict(row) if row else {}
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def get_attendance_code(db_path: Path, class_id: str) -> Optional[Dict[str, Any]]:
	db_path = Path(db_path)
	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			row = conn.execute(
				"SELECT * FROM attendance_codes WHERE id = ?",
				(class_id,),
			).fetchone()
			if not row:
				return None
			if row["expiry_time"] and row["expiry_time"] < _now_ts_ms():
				conn.execute("DELETE FROM attendance_codes WHERE id = ?", (class_id,))
				conn.commit()
				return None
			return dict(row)
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def clear_attendance_code(db_path: Path, class_id: str) -> None:
	db_path = Path(db_path)
	try:
		with _connect(db_path) as conn:
			conn.execute("DELETE FROM attendance_codes WHERE id = ?", (class_id,))
			conn.commit()
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def fetch_student(db_path: Path, student_id: str) -> Optional[Dict[str, Any]]:
	db_path = Path(db_path)
	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			row = conn.execute(
				"SELECT * FROM students WHERE id = ? COLLATE NOCASE LIMIT 1",
				(student_id.strip().lower(),),
			).fetchone()
			return dict(row) if row else None
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def add_or_update_student(db_path: Path, data: Dict[str, Any]) -> Dict[str, Any]:
	db_path = Path(db_path)
	student_id = data.get("studentId") or data.get("id")
	if not student_id:
		raise LocalDatabaseError("Student ID is required")
	payload = {
		"id": student_id.strip().lower(),
		"name": data.get("name"),
		"email": data.get("email"),
		"department": data.get("department"),
		"batch": data.get("batch"),
		"password": data.get("password"),
		"class_id": data.get("classId") or data.get("class_id"),
	}
	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			conn.execute(
				"""
				INSERT INTO students (id, name, email, department, batch, password, class_id)
				VALUES (:id, :name, :email, :department, :batch, :password, :class_id)
				ON CONFLICT(id) DO UPDATE SET
					name=COALESCE(excluded.name, students.name),
					email=COALESCE(excluded.email, students.email),
					department=COALESCE(excluded.department, students.department),
					batch=COALESCE(excluded.batch, students.batch),
					password=COALESCE(excluded.password, students.password),
					class_id=COALESCE(excluded.class_id, students.class_id)
				""",
				payload,
			)
			conn.commit()
			row = conn.execute(
				"SELECT * FROM students WHERE id = ?",
				(payload["id"],),
			).fetchone()
			return dict(row) if row else {}
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def list_students(db_path: Path, class_id: Optional[str] = None) -> List[Dict[str, Any]]:
	db_path = Path(db_path)
	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			if class_id:
				cursor = conn.execute(
					"SELECT * FROM students WHERE class_id = ? OR class_id IS NULL ORDER BY id",
					(class_id,),
				)
			else:
				cursor = conn.execute("SELECT * FROM students ORDER BY id")
			return [dict(row) for row in cursor.fetchall()]
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def load_existing_attendance(db_path: Path, class_id: str, student_id: str) -> Optional[Dict[str, Any]]:
	db_path = Path(db_path)
	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			row = conn.execute(
				"""
				SELECT * FROM attendance
				WHERE class_id = ? AND student_id = ?
				ORDER BY id DESC
				LIMIT 1
				""",
				(class_id, student_id),
			).fetchone()
			return dict(row) if row else None
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def mark_attendance(db_path: Path, class_id: str, student_id: str, payload: Dict[str, Any]) -> None:
	db_path = Path(db_path)
	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			fingerprint = (payload.get("deviceFingerprint") or "").strip()
			if fingerprint and payload.get("date"):
				existing_device = conn.execute(
					"SELECT 1 FROM attendance WHERE device_fingerprint = ? AND date = ?",
					(fingerprint, payload.get("date")),
				).fetchone()
				if existing_device:
					raise LocalDatabaseError("This device has already been used to mark attendance today.")
			conn.execute(
				"""
				INSERT INTO attendance (
					class_id, student_id, timestamp, marked_at, date, subject, code,
					manual_entry, teacher_name, department, marked_via, email, name, device_fingerprint
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				""",
				(
					class_id,
					student_id,
					int(payload.get("timestamp", _now_ts_ms())),
					payload.get("markedAt", datetime.now(tz=timezone.utc).isoformat()),
					payload.get("date"),
					payload.get("subject"),
					payload.get("code"),
					1 if payload.get("manualEntry") else 0,
					payload.get("teacherName"),
					payload.get("department"),
					payload.get("markedVia"),
					payload.get("email"),
					payload.get("name"),
					fingerprint or None,
				),
			)
			conn.commit()
	except sqlite3.IntegrityError as err:
		raise LocalDatabaseError("Attendance already recorded for today.") from err
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def list_attendance_records(db_path: Path, class_id: str) -> List[Dict[str, Any]]:
	db_path = Path(db_path)
	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			cursor = conn.execute(
				"SELECT * FROM attendance WHERE class_id = ? ORDER BY timestamp DESC",
				(class_id,),
			)
			return [dict(row) for row in cursor.fetchall()]
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def create_teacher(db_path: Path, data: Dict[str, Any]) -> Dict[str, Any]:
	db_path = Path(db_path)
	required = {"email", "password", "name", "classId"}
	missing = required - set(data.keys())
	if missing:
		raise LocalDatabaseError(f"Missing fields: {', '.join(sorted(missing))}")

	email = str(data["email"]).strip().lower()
	hashed = generate_password_hash(str(data["password"]))
	now_iso = datetime.now(tz=timezone.utc).isoformat()
	payload = (
		email,
		data.get("name"),
		hashed,
		data.get("classId"),
		data.get("department"),
		now_iso,
	)

	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			conn.execute(
				"""
				INSERT INTO teachers (email, name, password_hash, class_id, department, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
				""",
				payload,
			)
			conn.commit()
			row = conn.execute(
				"SELECT id, email, name, class_id, department FROM teachers WHERE email = ?",
				(email,),
			).fetchone()
			if not row:
				raise LocalDatabaseError("Unable to load teacher profile after creation.")
			return dict(row)
	except sqlite3.IntegrityError as err:
		raise LocalDatabaseError("Teacher already exists with this email.") from err
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def get_teacher_by_email(db_path: Path, email: str) -> Optional[Dict[str, Any]]:
	db_path = Path(db_path)
	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			row = conn.execute(
				"SELECT id, email, name, class_id, department FROM teachers WHERE email = ?",
				(email.strip().lower(),),
			).fetchone()
			return dict(row) if row else None
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def get_teacher_with_secret(db_path: Path, teacher_id: int) -> Optional[Dict[str, Any]]:
	db_path = Path(db_path)
	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			row = conn.execute(
				"SELECT * FROM teachers WHERE id = ?",
				(teacher_id,),
			).fetchone()
			return dict(row) if row else None
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def verify_teacher_credentials(db_path: Path, email: str, password: str) -> Optional[Dict[str, Any]]:
	db_path = Path(db_path)
	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			row = conn.execute(
				"SELECT * FROM teachers WHERE email = ?",
				(email.strip().lower(),),
			).fetchone()
			if not row:
				return None
			if not check_password_hash(row["password_hash"], password):
				return None
			return {
				"id": row["id"],
				"email": row["email"],
				"name": row["name"],
				"class_id": row["class_id"],
				"department": row["department"],
			}
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def get_teacher_by_id(db_path: Path, teacher_id: int) -> Optional[Dict[str, Any]]:
	db_path = Path(db_path)
	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			row = conn.execute(
				"SELECT id, email, name, class_id, department FROM teachers WHERE id = ?",
				(teacher_id,),
			).fetchone()
			return dict(row) if row else None
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def list_timetable_entries(db_path: Path, teacher_id: int) -> List[Dict[str, Any]]:
	db_path = Path(db_path)
	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			rows = conn.execute(
				"""
				SELECT id, subject, day, start_time, end_time, credits, created_at, updated_at
				FROM timetable
				WHERE teacher_id = ?
				ORDER BY day, start_time
				""",
				(teacher_id,),
			).fetchall()
			return [dict(row) for row in rows]
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def create_timetable_entry(db_path: Path, teacher_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
	db_path = Path(db_path)
	now = datetime.now(tz=timezone.utc).isoformat()
	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			conn.execute(
				"""
				INSERT INTO timetable (teacher_id, subject, day, start_time, end_time, credits, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
				""",
				(
					teacher_id,
					data.get("subject"),
					data.get("day"),
					data.get("start_time"),
					data.get("end_time"),
					int(data.get("credits", 0)),
					now,
					now,
				),
			)
			conn.commit()
			row = conn.execute(
				"SELECT id, subject, day, start_time, end_time, credits, created_at, updated_at FROM timetable WHERE rowid = last_insert_rowid()",
			).fetchone()
			return dict(row) if row else {}
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def update_timetable_entry(db_path: Path, teacher_id: int, entry_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
	db_path = Path(db_path)
	now = datetime.now(tz=timezone.utc).isoformat()
	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			cursor = conn.execute(
				"""
				UPDATE timetable
				SET subject = ?, day = ?, start_time = ?, end_time = ?, credits = ?, updated_at = ?
				WHERE id = ? AND teacher_id = ?
				""",
				(
					data.get("subject"),
					data.get("day"),
					data.get("start_time"),
					data.get("end_time"),
					int(data.get("credits", 0)),
					now,
					entry_id,
					teacher_id,
				),
			)
			if cursor.rowcount == 0:
				raise LocalDatabaseError("Timetable entry not found.")
			conn.commit()
			row = conn.execute(
				"SELECT id, subject, day, start_time, end_time, credits, created_at, updated_at FROM timetable WHERE id = ?",
				(entry_id,),
			).fetchone()
			return dict(row) if row else {}
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err


def delete_timetable_entry(db_path: Path, teacher_id: int, entry_id: int) -> None:
	db_path = Path(db_path)
	try:
		with _connect(db_path) as conn:
			_ensure_schema(conn)
			cursor = conn.execute(
				"DELETE FROM timetable WHERE id = ? AND teacher_id = ?",
				(entry_id, teacher_id),
			)
			if cursor.rowcount == 0:
				raise LocalDatabaseError("Timetable entry not found.")
			conn.commit()
	except sqlite3.Error as err:
		raise LocalDatabaseError(str(err)) from err
