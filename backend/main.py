import os
import uuid
from typing import Optional, List
from datetime import date, datetime, timedelta, timezone

import secrets
import threading
import time
from urllib.parse import quote

from fastapi import FastAPI, Header, HTTPException, Depends, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field
from dotenv import load_dotenv

from sqlalchemy import bindparam, create_engine, text
from sqlalchemy.orm import sessionmaker, Session

import bcrypt
import jwt  # PyJWT

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
if os.path.exists(".env.local"):
    load_dotenv(dotenv_path=".env.local")
else:
    load_dotenv(dotenv_path="../.env.local")

DATABASE_URL = os.getenv("DATABASE_URL")
JWT_SECRET   = os.getenv("JWT_SECRET")
JWT_ALGO     = "HS256"
JWT_HOURS    = 8
# Google OAuth client ID used by the login page. Google ID tokens must be issued
# for this client, or they are rejected.
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID") or os.getenv("NEXT_PUBLIC_GOOGLE_CLIENT_ID")
# Comma-separated browser origins allowed to call the API directly.
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
# Old default password that was seeded for admin@socd.gov.ph. Replaced on startup.
LEGACY_ADMIN_PASSWORD = "Admin123!"
# Maintenance mode: while true, only SuperAdmin accounts can sign in or use the API.
MAINTENANCE_MODE = os.getenv("MAINTENANCE_MODE", "").strip().lower() in ("1", "true", "yes")
# Optional shared secret between the website and the API. When set, the website
# passes the visitor's IP address, which the API then trusts for rate limiting.
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY") or None
# The interactive API docs (/docs) are off unless this is set.
ENABLE_API_DOCS = os.getenv("ENABLE_API_DOCS", "").strip().lower() in ("1", "true", "yes")
# Largest request body the API accepts (bulk imports are well under this).
MAX_BODY_BYTES = 2 * 1024 * 1024

if not DATABASE_URL:
    raise ValueError("Missing DATABASE_URL in environment")
if not JWT_SECRET:
    raise ValueError("Missing JWT_SECRET in environment")
if len(JWT_SECRET) < 32:
    print("WARNING: JWT_SECRET is shorter than 32 characters. Replace it with a long random value "
          "(for example: python -c \"import secrets; print(secrets.token_urlsafe(48))\").", flush=True)

# Automatically normalize any MySQL dialect scheme to mysql+pymysql://
if "://" in DATABASE_URL:
    scheme, rest = DATABASE_URL.split("://", 1)
    if scheme in ("mysql", "mysql+mysqlconnector", "mysql+mysqldb", "mysql+mariadbconnector"):
        DATABASE_URL = f"mysql+pymysql://{rest}"

# Ensure a database name is specified (prevent defaulting to MySQL internal 'sys' database)
from urllib.parse import urlparse, urlunparse
parsed = urlparse(DATABASE_URL)
if not parsed.path or parsed.path in ("/", "/sys"):
    parsed = parsed._replace(path="/test")
    DATABASE_URL = urlunparse(parsed)

connect_args = {}
if "tidbcloud.com" in DATABASE_URL:
    import ssl
    ctx = ssl.create_default_context()
    connect_args["ssl"] = ctx

engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_recycle=1800,
    pool_pre_ping=True,
    connect_args=connect_args,
)
SessionLocal = sessionmaker(bind=engine)


app = FastAPI(
    title="SOCD Portal FastAPI Backend",
    version="2.0.0",
    docs_url="/docs" if ENABLE_API_DOCS else None,
    redoc_url=None,
    openapi_url="/openapi.json" if ENABLE_API_DOCS else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,  # the API uses bearer tokens, not cookies
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
}

@app.middleware("http")
async def guard_requests(request: Request, call_next):
    """Rejects oversized bodies and adds security headers to every response."""
    length = request.headers.get("content-length")
    if length and length.isdigit() and int(length) > MAX_BODY_BYTES:
        return JSONResponse(status_code=413, content={"detail": "The request is too large."})
    response = await call_next(request)
    for name, value in SECURITY_HEADERS.items():
        response.headers.setdefault(name, value)
    return response

@app.exception_handler(RequestValidationError)
async def readable_validation_error(request: Request, exc: RequestValidationError):
    """One readable sentence instead of Pydantic's error list, so forms can show it."""
    first = exc.errors()[0] if exc.errors() else {}
    field = ".".join(str(p) for p in first.get("loc", []) if p not in ("body", "query", "path"))
    message = first.get("msg", "Invalid input.")
    return JSONResponse(status_code=422, content={"detail": f"{field}: {message}" if field else message})

@app.exception_handler(Exception)
async def hide_internal_errors(request: Request, exc: Exception):
    """Unexpected errors are logged here and reported to the browser without details."""
    import traceback
    traceback.print_exc()
    return JSONResponse(status_code=500, content={"detail": "Something went wrong on the server. Please try again."})

def server_error(message: str, exc: Exception) -> HTTPException:
    """Logs the real error; the browser only gets the plain message."""
    print(f"{message}: {exc!r}", flush=True)
    return HTTPException(status_code=500, detail=message)

@app.on_event("startup")
def init_db():
    """Create all application tables if not existing, and seed default SuperAdmin."""
    try:
        with SessionLocal() as db:
            # 1. Create tables
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS personnel (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    role VARCHAR(255) NOT NULL,
                    unit VARCHAR(255) NOT NULL,
                    office VARCHAR(255) NOT NULL,
                    portal_role VARCHAR(32) NULL,
                    email VARCHAR(255) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NULL,
                    local_ext VARCHAR(64) NULL,
                    status VARCHAR(32) NOT NULL DEFAULT 'in-office',
                    photo_url TEXT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS paps (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    name VARCHAR(255) NOT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS pap_monitoring (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    pap_id CHAR(36) NOT NULL,
                    activity_type VARCHAR(32) NOT NULL,
                    quarter VARCHAR(8) NULL,
                    month VARCHAR(32) NULL,
                    output_deliverable TEXT NOT NULL,
                    deadline DATE NOT NULL,
                    response_rate_fillable BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (pap_id) REFERENCES paps(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS pap_submissions (
                    id                CHAR(36)      NOT NULL PRIMARY KEY,
                    pap_monitoring_id CHAR(36)      NOT NULL,
                    office            VARCHAR(100)  NOT NULL,
                    actual_submission DATE          NULL,
                    pso_remarks       TEXT          NULL,
                    response_rate     DECIMAL(5,2)  NULL,
                    rsso_remarks      TEXT          NULL,
                    rating_quantity   DECIMAL(5,2)  NULL,
                    created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE KEY uq_submission (pap_monitoring_id, office),
                    FOREIGN KEY (pap_monitoring_id) REFERENCES pap_monitoring(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS pap_focal_persons (
                    pap_id       CHAR(36)     NOT NULL,
                    office       VARCHAR(100) NOT NULL,
                    focal_id     CHAR(36)     NULL,
                    alternate_id CHAR(36)     NULL,
                    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    PRIMARY KEY (pap_id, office),
                    FOREIGN KEY (pap_id) REFERENCES paps(id) ON DELETE CASCADE,
                    FOREIGN KEY (focal_id) REFERENCES personnel(id) ON DELETE SET NULL,
                    FOREIGN KEY (alternate_id) REFERENCES personnel(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS leave_requests (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    staff_id CHAR(36) NOT NULL,
                    start_date DATE NOT NULL,
                    end_date DATE NOT NULL,
                    leave_type VARCHAR(64) NOT NULL,
                    notes TEXT NULL,
                    status VARCHAR(32) NOT NULL DEFAULT 'pending',
                    approver_id CHAR(36) NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (staff_id) REFERENCES personnel(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS links (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    label VARCHAR(255) NOT NULL,
                    url TEXT NOT NULL,
                    category VARCHAR(128) NOT NULL,
                    description TEXT NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS announcements (
                    id          CHAR(36)      NOT NULL PRIMARY KEY,
                    title       VARCHAR(200)  NOT NULL,
                    body        TEXT          NOT NULL,
                    audience    VARCHAR(500)  NOT NULL DEFAULT 'ALL',
                    link_url    VARCHAR(1000) NULL,
                    pinned      BOOLEAN       NOT NULL DEFAULT FALSE,
                    created_by  CHAR(36)      NULL,
                    created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (created_by) REFERENCES personnel(id) ON DELETE SET NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS trainings (
                    id CHAR(36) NOT NULL PRIMARY KEY,
                    title VARCHAR(255) NOT NULL,
                    training_date DATE NOT NULL,
                    end_date DATE NULL,
                    mode VARCHAR(32) NOT NULL DEFAULT 'in-person',
                    venue VARCHAR(255) NULL,
                    organizer VARCHAR(255) NULL,
                    description TEXT NULL,
                    materials_url TEXT NULL,
                    created_by CHAR(36) NULL,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS training_attendees (
                    training_id CHAR(36) NOT NULL,
                    staff_id CHAR(36) NOT NULL,
                    attended BOOLEAN NOT NULL DEFAULT FALSE,
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (training_id, staff_id),
                    FOREIGN KEY (training_id) REFERENCES trainings(id) ON DELETE CASCADE,
                    FOREIGN KEY (staff_id) REFERENCES personnel(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS audit_log (
                    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
                    at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    actor_id CHAR(36) NULL,
                    actor_email VARCHAR(255) NULL,
                    action VARCHAR(64) NOT NULL,
                    target VARCHAR(255) NULL,
                    ip VARCHAR(64) NULL,
                    detail VARCHAR(1000) NULL,
                    INDEX idx_audit_action_at (action, at),
                    INDEX idx_audit_at (at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS revoked_tokens (
                    jti CHAR(32) NOT NULL PRIMARY KEY,
                    expires_at DATETIME NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
            """))
            db.commit()

            # 3. Run safe column migrations for existing tables
            migrations = [
                ("personnel", "photo_url",    "ALTER TABLE personnel ADD COLUMN photo_url TEXT NULL"),
                ("personnel", "password_hash","ALTER TABLE personnel ADD COLUMN password_hash VARCHAR(255) NULL"),
                ("paps",      "service",      "ALTER TABLE paps ADD COLUMN service VARCHAR(100) NULL"),
                ("paps",      "year",         "ALTER TABLE paps ADD COLUMN year INT NULL"),
                # Tokens issued before this time are rejected (set on password change).
                ("personnel", "sessions_valid_after", "ALTER TABLE personnel ADD COLUMN sessions_valid_after DATETIME NULL"),
            ]
            for table, column, ddl in migrations:
                exists = db.execute(text("""
                    SELECT COUNT(*) FROM information_schema.columns
                    WHERE table_schema = DATABASE()
                      AND table_name   = :table
                      AND column_name  = :column
                """), {"table": table, "column": column}).scalar()
                if not exists:
                    db.execute(text(ddl))
                    db.commit()
                    print(f"Migration applied: added {table}.{column}", flush=True)

            # Older code copied leave statuses into personnel.status and never reset them.
            # Status now follows approved leaves on the fly, so reset those leftovers: someone
            # whose stored status matches an approved leave that has already ended, with no
            # approved leave covering today, goes back to in-office.
            today_mnl = _manila_today()
            stale = db.execute(text("""
                SELECT DISTINCT p.id FROM personnel p
                JOIN leave_requests l ON l.staff_id = p.id AND l.status = 'approved' AND l.end_date < :today
                WHERE p.status IN ('on-leave', 'wfh', 'fieldwork')
                  AND p.status = CASE l.leave_type WHEN 'wfh' THEN 'wfh' WHEN 'fieldwork' THEN 'fieldwork' ELSE 'on-leave' END
                  AND NOT EXISTS (
                      SELECT 1 FROM leave_requests c
                      WHERE c.staff_id = p.id AND c.status = 'approved'
                        AND c.start_date <= :today AND c.end_date >= :today
                  )
            """), {"today": today_mnl}).fetchall()
            if stale:
                db.execute(
                    text("UPDATE personnel SET status = 'in-office' WHERE id IN :ids").bindparams(bindparam("ids", expanding=True)),
                    {"ids": [r.id for r in stale]},
                )
                db.commit()
                print(f"Reset {len(stale)} staff status(es) left over from ended leaves.", flush=True)

            # Housekeeping: drop expired token revocations and audit entries older than 2 years.
            db.execute(text("DELETE FROM revoked_tokens WHERE expires_at < UTC_TIMESTAMP()"))
            db.execute(text("DELETE FROM audit_log WHERE at < (UTC_TIMESTAMP() - INTERVAL 730 DAY)"))
            db.commit()

            # PAPs created before years existed belong to the year they were created.
            backfilled = db.execute(text("UPDATE paps SET year = YEAR(created_at) WHERE year IS NULL")).rowcount
            db.commit()
            if backfilled:
                print(f"Set the year on {backfilled} existing PAP(s) from their creation date.", flush=True)

            # 4. Ensure the SuperAdmin account exists, has the correct portal_role,
            #    and is not using the old published default password.
            initial_pw = os.getenv("ADMIN_INITIAL_PASSWORD")
            admin_row = db.execute(
                text("SELECT id, portal_role, password_hash FROM personnel WHERE email = 'admin@socd.gov.ph'")
            ).fetchone()
            if admin_row:
                if admin_row.portal_role != "SuperAdmin":
                    db.execute(text(
                        "UPDATE personnel SET portal_role = 'SuperAdmin', office = 'RSSO', unit = 'SOCD' WHERE email = 'admin@socd.gov.ph'"
                    ))
                    db.commit()
                    print("Fixed admin@socd.gov.ph -> portal_role set to SuperAdmin", flush=True)
                # One-time reset: set ADMIN_RESET_PASSWORD=true together with
                # ADMIN_INITIAL_PASSWORD, deploy, sign in, then remove ADMIN_RESET_PASSWORD.
                reset_requested = os.getenv("ADMIN_RESET_PASSWORD", "").strip().lower() in ("1", "true", "yes")
                if reset_requested:
                    if initial_pw:
                        db.execute(
                            text("UPDATE personnel SET password_hash = :h WHERE email = 'admin@socd.gov.ph'"),
                            {"h": hash_password(initial_pw)},
                        )
                        db.commit()
                        print("ADMIN_RESET_PASSWORD: admin password set to ADMIN_INITIAL_PASSWORD. Remove ADMIN_RESET_PASSWORD now.", flush=True)
                    else:
                        print("ADMIN_RESET_PASSWORD is set but ADMIN_INITIAL_PASSWORD is empty; nothing changed.", flush=True)
                elif admin_row.password_hash and check_password(LEGACY_ADMIN_PASSWORD, admin_row.password_hash):
                    new_pw = initial_pw or secrets.token_urlsafe(12)
                    db.execute(
                        text("UPDATE personnel SET password_hash = :h WHERE email = 'admin@socd.gov.ph'"),
                        {"h": hash_password(new_pw)},
                    )
                    db.commit()
                    if initial_pw:
                        print("Replaced the old default admin password with ADMIN_INITIAL_PASSWORD.", flush=True)
                    else:
                        print(f"Replaced the old default admin password. One-time password for admin@socd.gov.ph: {new_pw}", flush=True)
            else:
                # Seed the SuperAdmin account if it doesn't exist at all
                new_pw = initial_pw or secrets.token_urlsafe(12)
                db.execute(text("""
                    INSERT INTO personnel
                    (id, name, email, password_hash, role, unit, office, portal_role, status)
                    VALUES (:id, :name, :email, :password_hash, :role, :unit, :office, :portal_role, 'in-office')
                """), {
                    "id": str(uuid.uuid4()),
                    "name": "Super Admin",
                    "email": "admin@socd.gov.ph",
                    "password_hash": hash_password(new_pw),
                    "role": "Division Administrator",
                    "unit": "SOCD",
                    "office": "RSSO",
                    "portal_role": "SuperAdmin"
                })
                db.commit()
                if initial_pw:
                    print("Seeded SuperAdmin admin@socd.gov.ph with ADMIN_INITIAL_PASSWORD.", flush=True)
                else:
                    print(f"Seeded SuperAdmin admin@socd.gov.ph. One-time password: {new_pw}", flush=True)
            if initial_pw and password_problem(initial_pw, "admin@socd.gov.ph"):
                print("WARNING: ADMIN_INITIAL_PASSWORD is weak. Sign in as admin@socd.gov.ph and change the "
                      "password, then delete ADMIN_INITIAL_PASSWORD from the Render environment.", flush=True)

    except Exception as e:
        print(f"Startup DB init error: {e}", flush=True)
        import traceback
        traceback.print_exc()

@app.get("/")
def root():
    return {"status": "ok", "service": "SOCD Portal Backend API", "version": "2.0.0"}

@app.get("/health")
def health():
    return {"status": "healthy"}

@app.get("/api/health/db")
def health_db():
    """Reports only whether the database answers. No account details."""
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        return {"status": "connected"}
    except Exception as e:
        print(f"DB health check failed: {e}")
        return {"status": "error"}

# ─────────────────────────────────────────────
# DB Dependency
# ─────────────────────────────────────────────
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ─────────────────────────────────────────────
# Auth Helpers
# ─────────────────────────────────────────────
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt(rounds=12)).decode()

def check_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode(), hashed.encode())
    except ValueError:
        return False

# Compared against when an account doesn't exist, so a wrong email takes as
# long to reject as a wrong password (no account discovery by timing).
_DUMMY_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt(rounds=12)).decode()

PASSWORD_MIN_LENGTH = 10
PASSWORD_MAX_LENGTH = 128
_COMMON_PASSWORDS = {
    "admin123!", "admin123", "admin1234", "password", "password1", "password123", "p@ssw0rd",
    "qwerty123", "123456789", "1234567890", "welcome1", "welcome123", "letmein123",
    "changeme", "changeme123", "socd12345", "psa123456", "rsso11", "philippines",
}

def password_problem(pw: str, email: str = "") -> Optional[str]:
    """Why a new password is not acceptable, or None if it is."""
    if len(pw) < PASSWORD_MIN_LENGTH:
        return f"Use at least {PASSWORD_MIN_LENGTH} characters."
    if len(pw) > PASSWORD_MAX_LENGTH:
        return f"Use at most {PASSWORD_MAX_LENGTH} characters."
    lowered = pw.lower()
    if lowered in _COMMON_PASSWORDS or len(set(pw)) < 4:
        return "This password is too easy to guess. Choose another."
    local = email.split("@")[0].lower()
    if local and len(local) >= 4 and local in lowered:
        return "Don't use your email address in your password."
    return None

def create_token(email: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": email, "iat": int(now.timestamp()), "exp": now + timedelta(hours=JWT_HOURS),
         "jti": secrets.token_hex(16)},
        JWT_SECRET, algorithm=JWT_ALGO,
    )

def decode_claims(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO], options={"require": ["sub", "exp"]})
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Your session has expired. Please sign in again.")
    if not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload

def decode_token(token: str) -> str:
    return decode_claims(token)["sub"]

# ─────────────────────────────────────────────
# Audit log
# Every sign-in, failed sign-in and administrative change is recorded.
# SuperAdmin reads it at /api/audit-log (the portal's Activity log page).
# ─────────────────────────────────────────────
def client_ip(request: Optional[Request]) -> Optional[str]:
    """The visitor's IP address. Trusted from the website only when it sends INTERNAL_API_KEY;
    otherwise the address of whoever connected (the last X-Forwarded-For hop)."""
    if request is None:
        return None
    if INTERNAL_API_KEY and secrets.compare_digest(request.headers.get("x-internal-key", ""), INTERNAL_API_KEY):
        forwarded = request.headers.get("x-client-ip", "").strip()
        if forwarded:
            return forwarded[:64]
    hops = [h.strip() for h in request.headers.get("x-forwarded-for", "").split(",") if h.strip()]
    if hops:
        return hops[-1][:64]
    return request.client.host if request.client else None

def ip_is_trusted(request: Optional[Request]) -> bool:
    return bool(
        request is not None and INTERNAL_API_KEY
        and secrets.compare_digest(request.headers.get("x-internal-key", ""), INTERNAL_API_KEY)
        and request.headers.get("x-client-ip")
    )

def audit(db: Session, action: str, actor=None, target: Optional[str] = None,
          detail: Optional[str] = None, request: Optional[Request] = None,
          actor_email: Optional[str] = None) -> None:
    """Records one event. Never breaks the request it belongs to."""
    try:
        db.execute(text("""
            INSERT INTO audit_log (at, actor_id, actor_email, action, target, ip, detail)
            VALUES (:at, :actor_id, :actor_email, :action, :target, :ip, :detail)
        """), {
            "at": datetime.utcnow().replace(microsecond=0),  # UTC, whatever the DB session's time zone
            "actor_id": getattr(actor, "id", None),
            "actor_email": (getattr(actor, "email", None) or actor_email or None),
            "action": action[:64],
            "target": (target or None) and str(target)[:255],
            "ip": client_ip(request),
            "detail": (detail or None) and str(detail)[:1000],
        })
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Audit log write failed for {action}: {e!r}", flush=True)

LEAVE_DECISIONS = ("approved", "denied")

def leave_status(leave_type: str) -> str:
    """The staff status an approved leave of this type puts someone in."""
    if leave_type == "wfh":
        return "wfh"
    if leave_type == "fieldwork":
        return "fieldwork"
    return "on-leave"

def statuses_from_leaves(db: Session, today: date) -> dict:
    """staff_id → status, for everyone with an approved leave covering today."""
    rows = db.execute(text("""
        SELECT staff_id, leave_type FROM leave_requests
        WHERE status = 'approved' AND start_date <= :today AND end_date >= :today
        ORDER BY start_date
    """), {"today": today}).fetchall()
    return {r.staff_id: leave_status(r.leave_type) for r in rows}

def effective_status(stored: Optional[str], from_leave: Optional[str]) -> str:
    """An approved leave covering today wins; otherwise the status set in the directory."""
    return from_leave or stored or "in-office"

def deliverable_state(deadline, actual_submission, today: date, due_soon_days: int = 30) -> str:
    """
    A deliverable's state for one office. Same rule as lib/deliverable.ts.
    Not submitted: upcoming → due_soon (within due_soon_days) → overdue (past the deadline).
    Submitted: on_time (on or before the deadline) or late.
    """
    deadline = _to_date(deadline)
    actual = _to_date(actual_submission) if actual_submission else None
    if actual:
        return "on_time" if actual <= deadline else "late"
    if deadline < today:
        return "overdue"
    if deadline <= today + timedelta(days=due_soon_days):
        return "due_soon"
    return "upcoming"

def public_person(row) -> dict:
    """Personnel row as a dict, without the password hash."""
    d = dict(row._mapping)
    d.pop("password_hash", None)
    return d

# ─────────────────────────────────────────────
# Sign-in rate limiting
# Counted from the audit log, so limits survive restarts.
# - 10 failures for one account in 15 minutes pause that account's sign-ins
#   (per account and IP when the website passes the visitor's IP).
# - 30 failures from one IP in 15 minutes, across any accounts, pause that IP.
# Google sign-in is not limited: Google has already verified the person.
# ─────────────────────────────────────────────
LOGIN_MAX_FAILURES = 10
LOGIN_MAX_FAILURES_PER_IP = 30
LOGIN_WINDOW_MINUTES = 15

def _login_key(email: str) -> str:
    return email.strip().lower()

def _check_login_allowed(db: Session, key: str, request: Optional[Request]) -> None:
    since = datetime.utcnow() - timedelta(minutes=LOGIN_WINDOW_MINUTES)
    trusted = ip_is_trusted(request)
    ip = client_ip(request)
    params = {"since": since, "email": key, "ip": ip}
    per_account = "SELECT COUNT(*) FROM audit_log WHERE action = 'login.failed' AND at >= :since AND actor_email = :email"
    if trusted:
        per_account += " AND ip = :ip"
    if db.execute(text(per_account), params).scalar() >= LOGIN_MAX_FAILURES:
        audit(db, "login.blocked", target=key, detail="too many failed attempts for this account",
              request=request, actor_email=key)
        raise HTTPException(status_code=429, detail="Too many failed sign-in attempts. Please wait 15 minutes and try again.")
    if trusted:
        from_ip = db.execute(text(
            "SELECT COUNT(*) FROM audit_log WHERE action = 'login.failed' AND at >= :since AND ip = :ip"
        ), params).scalar()
        if from_ip >= LOGIN_MAX_FAILURES_PER_IP:
            audit(db, "login.blocked", target=key, detail="too many failed attempts from this address",
                  request=request, actor_email=key)
            raise HTTPException(status_code=429, detail="Too many failed sign-in attempts. Please wait 15 minutes and try again.")

# ─────────────────────────────────────────────
# Auth Dependencies
# ─────────────────────────────────────────────
def verify_session(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authentication token")
    claims = decode_claims(authorization.split(" ", 1)[1])
    jti = claims.get("jti")
    if jti and db.execute(text("SELECT 1 FROM revoked_tokens WHERE jti = :jti"), {"jti": jti}).fetchone():
        raise HTTPException(status_code=401, detail="You have signed out. Please sign in again.")
    row = db.execute(
        text("SELECT * FROM personnel WHERE email = :email"), {"email": claims["sub"]}
    ).fetchone()
    if not row:
        raise HTTPException(
            status_code=403,
            detail="Access Denied: You are not registered in the personnel directory. Please contact a SuperAdmin."
        )
    # Sessions started before the last password change are no longer valid.
    valid_after = getattr(row, "sessions_valid_after", None)
    issued = claims.get("iat")
    if valid_after and (issued is None or datetime.utcfromtimestamp(issued) < valid_after):
        raise HTTPException(status_code=401, detail="Your password was changed. Please sign in again.")
    if MAINTENANCE_MODE and row.portal_role != "SuperAdmin":
        raise HTTPException(status_code=503, detail="The portal is down for maintenance. Please try again later.")
    return row

def verify_superadmin(user=Depends(verify_session)):
    """Grants access to SuperAdmin or RSSO roles (RSSO manages the regional office)."""
    if user.portal_role not in ("SuperAdmin", "RSSO"):
        raise HTTPException(
            status_code=403,
            detail="Permission denied: this needs a SuperAdmin or RSSO account."
        )
    return user

def verify_true_superadmin(user=Depends(verify_session)):
    """SuperAdmin only (not RSSO): audit log, backups."""
    if user.portal_role != "SuperAdmin":
        raise HTTPException(status_code=403, detail="Permission denied: this needs a SuperAdmin account.")
    return user

PORTAL_ROLES = ("SuperAdmin", "RSSO", "PSO")

def _clean_portal_role(value: Optional[str]) -> Optional[str]:
    if value is None or not str(value).strip():
        return None
    if value not in PORTAL_ROLES:
        raise HTTPException(status_code=400, detail="Portal role must be SuperAdmin, RSSO, PSO or none.")
    return value

def _guard_account_change(db: Session, user, target_row=None, new_role: Optional[str] = None) -> None:
    """
    Privilege rules for changing accounts:
    - Only a SuperAdmin can give the SuperAdmin role.
    - Only a SuperAdmin can edit, delete or reset the password of a SuperAdmin account.
    - The last SuperAdmin account can't be demoted or deleted.
    """
    is_super = user.portal_role == "SuperAdmin"
    if new_role == "SuperAdmin" and not is_super:
        raise HTTPException(status_code=403, detail="Only a SuperAdmin can give the SuperAdmin role.")
    if target_row is not None and target_row.portal_role == "SuperAdmin":
        if not is_super:
            raise HTTPException(status_code=403, detail="Only a SuperAdmin can change a SuperAdmin account.")
        if new_role != "SuperAdmin":
            others = db.execute(text(
                "SELECT COUNT(*) FROM personnel WHERE portal_role = 'SuperAdmin' AND id <> :id"
            ), {"id": target_row.id}).scalar()
            if not others:
                raise HTTPException(status_code=400, detail="This is the last SuperAdmin account; it can't lose that role.")

# ─────────────────────────────────────────────
class GoogleLoginRequest(BaseModel):
    id_token: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=PASSWORD_MAX_LENGTH)

class SetPasswordRequest(BaseModel):
    email: EmailStr
    password: str = Field(max_length=PASSWORD_MAX_LENGTH)

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(max_length=PASSWORD_MAX_LENGTH)
    new_password: str = Field(max_length=PASSWORD_MAX_LENGTH)

class PersonnelBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    role: str = Field(max_length=200)
    office: str = Field(min_length=1, max_length=100)
    local_ext: Optional[str] = Field(default=None, max_length=64)
    portal_role: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str = Field(max_length=32)

class ActivityCreate(BaseModel):
    pap_id: str = Field(max_length=36)
    activity_type: str = Field(max_length=32)
    quarter: Optional[str] = Field(default=None, max_length=8)
    month: Optional[str] = Field(default=None, max_length=32)
    output_deliverable: str = Field(min_length=1, max_length=1000)
    deadline: date
    response_rate_fillable: bool = False

class ActivityPatch(BaseModel):
    # Activity template fields only (no per-province data)
    activity_type: Optional[str] = Field(default=None, max_length=32)
    quarter: Optional[str] = Field(default=None, max_length=8)
    month: Optional[str] = Field(default=None, max_length=32)
    output_deliverable: Optional[str] = Field(default=None, max_length=1000)
    deadline: Optional[date] = None
    response_rate_fillable: Optional[bool] = None

class SubmissionUpsert(BaseModel):
    actual_submission: Optional[str] = Field(default=None, max_length=10)  # YYYY-MM-DD, or "" to clear
    pso_remarks: Optional[str] = Field(default=None, max_length=2000)
    response_rate: Optional[float] = Field(default=None, ge=0, le=100)
    rsso_remarks: Optional[str] = Field(default=None, max_length=2000)
    rating_quantity: Optional[float] = Field(default=None, ge=0, le=5)

class FocalAssignment(BaseModel):
    focal_id: Optional[str] = None
    alternate_id: Optional[str] = None

class LinkCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    url: str = Field(max_length=2000)
    category: str = Field(max_length=100)
    description: Optional[str] = Field(default=None, max_length=1000)

class LinkPatch(BaseModel):
    title: Optional[str] = None
    url: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None

LEAVE_TYPES = ("vacation", "sick", "emergency", "official-business", "wfh", "fieldwork")

class LeaveCreate(BaseModel):
    staff_id: str = Field(max_length=36)
    start_date: date
    end_date: date
    leave_type: str
    remarks: Optional[str] = Field(default=None, max_length=1000)

class LeaveStatusUpdate(BaseModel):
    status: str

TRAINING_MODES = ("in-person", "online", "hybrid")

class TrainingCreate(BaseModel):
    title: str = Field(max_length=255)
    training_date: date
    end_date: Optional[date] = None
    mode: str = "in-person"
    venue: Optional[str] = Field(default=None, max_length=500)
    organizer: Optional[str] = Field(default=None, max_length=255)
    description: Optional[str] = Field(default=None, max_length=5000)
    materials_url: Optional[str] = Field(default=None, max_length=2000)

class AttendanceUpdate(BaseModel):
    attended: bool

class PapActivityTemplate(BaseModel):
    activity_type: str = Field(default="monthly", max_length=32)  # "monthly" | "quarterly" | "one-time"
    quarter: Optional[str] = Field(default=None, max_length=8)
    month: Optional[str] = Field(default=None, max_length=32)
    output_deliverable: str = Field(min_length=1, max_length=1000)
    deadline: date
    response_rate_fillable: bool = False

PAP_SERVICES = [
    "NATIONAL CENSUSES SERVICE",
    "MACROECONOMIC ACCOUNTS SERVICE",
    "COMMUNITY BASED STATISTICS SERVICE",
    "SOCIAL SECTOR STATISTICS SERVICE",
    "ECONOMIC SECTOR STATISTICS SERVICE",
]

def _clean_service(value: Optional[str]) -> Optional[str]:
    """Empty means 'not set'. Anything else must be one of PAP_SERVICES."""
    if value is None or not value.strip():
        return None
    value = " ".join(value.split()).upper()
    if value not in PAP_SERVICES:
        raise HTTPException(status_code=400, detail=f"Unknown service: {value}")
    return value

def _manila_today() -> date:
    return datetime.now(timezone(timedelta(hours=8))).date()

def _clean_year(value: Optional[int]) -> int:
    if value is None:
        return _manila_today().year
    if not 2000 <= int(value) <= 2100:
        raise HTTPException(status_code=400, detail="Year must be between 2000 and 2100.")
    return int(value)

def _pap_years(db: Session) -> dict:
    """Years that have PAPs, the current year, and the year pages should open on:
    the current year if it has PAPs, otherwise the latest year that does."""
    current = _manila_today().year
    years = sorted(
        {int(r[0]) for r in db.execute(text("SELECT DISTINCT year FROM paps WHERE year IS NOT NULL")).fetchall()},
        reverse=True,
    )
    if current in years or not years:
        default = current
    else:
        earlier = [y for y in years if y < current]
        default = earlier[0] if earlier else years[-1]
    return {"years": years, "current_year": current, "default_year": default}

class PapCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    service: Optional[str] = None
    year: Optional[int] = None
    outputs: List[PapActivityTemplate] = Field(default=[], max_length=500)

class PapUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    service: Optional[str] = None
    year: Optional[int] = None

class PapCopyYear(BaseModel):
    from_year: int
    to_year: int
    # Copy only these PAPs (all from from_year). Leave out to copy every PAP of the year.
    pap_ids: Optional[List[str]] = Field(default=None, max_length=1000)

class ActivityBulkCreate(BaseModel):
    pap_id: str = Field(max_length=36)
    activities: List[PapActivityTemplate] = Field(max_length=500)

# ─────────────────────────────────────────────
# Auth Endpoints
# ─────────────────────────────────────────────
def _session_response(db: Session, row, email: str, extra: Optional[dict] = None) -> dict:
    if MAINTENANCE_MODE and row.portal_role != "SuperAdmin":
        raise HTTPException(status_code=503, detail="The portal is down for maintenance. Please try again later.")
    return {"access_token": create_token(email), "token_type": "bearer", "user": public_person(row), **(extra or {})}

@app.post("/api/auth/login")
def login(body: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Email and password sign-in. Returns a JWT."""
    key = _login_key(body.email)
    _check_login_allowed(db, key, request)
    row = db.execute(text("SELECT * FROM personnel WHERE email = :email"), {"email": body.email}).fetchone()
    stored = row.password_hash if row and row.password_hash else _DUMMY_HASH
    if not check_password(body.password, stored) or not row or not row.password_hash:
        audit(db, "login.failed", target=key, request=request, actor_email=key,
              detail=None if row else "unknown email")
        # Same message whether the email exists or not.
        raise HTTPException(status_code=401, detail="Invalid email or password. Staff without a portal password sign in with Google.")
    result = _session_response(db, row, row.email, {
        # Asks the website to send the user to the change-password page.
        "password_change_required": password_problem(body.password, row.email) is not None,
    })
    audit(db, "login.success", actor=row, request=request, detail="password")
    return result

@app.post("/api/auth/google")
def google_login(body: GoogleLoginRequest, request: Request, db: Session = Depends(get_db)):
    """Google sign-in. Only for emails that are in the personnel directory."""
    import urllib.request
    import json

    if not GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google Sign-In is not configured on the server.")
    try:
        # Google's tokeninfo endpoint checks the signature and expiry.
        google_url = f"https://oauth2.googleapis.com/tokeninfo?id_token={quote(body.id_token, safe='')}"
        req = urllib.request.Request(google_url, headers={"User-Agent": "SOCD-Portal"})
        with urllib.request.urlopen(req, timeout=10) as response:
            token_data = json.loads(response.read().decode())
    except Exception as e:
        print(f"Google token check failed: {e!r}", flush=True)
        raise HTTPException(status_code=401, detail="Google sign-in failed. Please try again.")

    if token_data.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Google token was not issued for this portal.")
    if token_data.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise HTTPException(status_code=401, detail="Google token has an invalid issuer.")
    email = token_data.get("email")
    email_verified = token_data.get("email_verified")
    if not email or (email_verified is not True and str(email_verified).lower() != "true"):
        raise HTTPException(status_code=400, detail="Google account email is unverified or invalid.")

    row = db.execute(text("SELECT * FROM personnel WHERE email = :email"), {"email": email}).fetchone()
    if not row:
        audit(db, "login.denied", target=email, request=request, actor_email=email, detail="Google account not in the directory")
        raise HTTPException(
            status_code=403,
            detail="This Google account is not in the personnel directory. Ask a SuperAdmin to add your email.",
        )

    picture = token_data.get("picture")
    if picture and not row.photo_url and str(picture).startswith("https://"):
        db.execute(text("UPDATE personnel SET photo_url = :photo WHERE id = :id"), {"photo": picture, "id": row.id})
        db.commit()
        row = db.execute(text("SELECT * FROM personnel WHERE id = :id"), {"id": row.id}).fetchone()

    result = _session_response(db, row, row.email)
    audit(db, "login.success", actor=row, request=request, detail="google")
    return result

@app.post("/api/auth/logout")
def logout_endpoint(request: Request, authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Ends this session for good: the token is refused from now on, even if it was copied."""
    if not authorization or not authorization.startswith("Bearer "):
        return {"success": True}
    try:
        claims = decode_claims(authorization.split(" ", 1)[1])
    except HTTPException:
        return {"success": True}
    if claims.get("jti"):
        db.execute(text("INSERT IGNORE INTO revoked_tokens (jti, expires_at) VALUES (:jti, :exp)"), {
            "jti": claims["jti"], "exp": datetime.utcfromtimestamp(int(claims["exp"])),
        })
        db.commit()
    audit(db, "logout", request=request, actor_email=claims.get("sub"))
    return {"success": True}

def _end_other_sessions(db: Session, staff_id: str) -> None:
    """Every token issued before now stops working for this person."""
    db.execute(text("UPDATE personnel SET sessions_valid_after = :t WHERE id = :id"),
               {"t": datetime.utcnow().replace(microsecond=0), "id": staff_id})

@app.post("/api/auth/change-password")
def change_password(body: ChangePasswordRequest, request: Request, user=Depends(verify_session), db: Session = Depends(get_db)):
    """The signed-in person changes their own password. Other sessions are signed out.
    Accounts without a password (Google sign-in) can't add one here: otherwise a stolen
    session could be turned into a permanent password. A SuperAdmin or RSSO sets it instead."""
    if not user.password_hash:
        raise HTTPException(status_code=400, detail="This account signs in with Google. Ask a SuperAdmin to set a password if you need one.")
    if not check_password(body.current_password, user.password_hash):
        audit(db, "password.change_failed", actor=user, request=request, detail="wrong current password")
        raise HTTPException(status_code=400, detail="Your current password is not correct.")
    problem = password_problem(body.new_password, user.email)
    if problem:
        raise HTTPException(status_code=400, detail=problem)
    if body.new_password == body.current_password:
        raise HTTPException(status_code=400, detail="Choose a password different from your current one.")
    db.execute(text("UPDATE personnel SET password_hash = :h WHERE id = :id"),
               {"h": hash_password(body.new_password), "id": user.id})
    _end_other_sessions(db, user.id)
    db.commit()
    audit(db, "password.changed", actor=user, target=user.email, request=request)
    # A fresh token, so this browser stays signed in.
    return {"success": True, "access_token": create_token(user.email)}

@app.post("/api/auth/set-password")
def set_password(body: SetPasswordRequest, request: Request, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    """SuperAdmin or RSSO sets a staff member's password. Only a SuperAdmin can do it for a SuperAdmin."""
    target = db.execute(text("SELECT * FROM personnel WHERE email = :email"), {"email": body.email}).fetchone()
    if not target:
        raise HTTPException(status_code=404, detail="Personnel not found")
    _guard_account_change(db, user, target, new_role=target.portal_role)
    problem = password_problem(body.password, target.email)
    if problem:
        raise HTTPException(status_code=400, detail=problem)
    db.execute(text("UPDATE personnel SET password_hash = :h WHERE id = :id"),
               {"h": hash_password(body.password), "id": target.id})
    _end_other_sessions(db, target.id)
    db.commit()
    audit(db, "password.set", actor=user, target=target.email, request=request)
    return {"success": True, "message": f"Password set for {target.email}"}

# ─────────────────────────────────────────────
# Activity log and backup (SuperAdmin only)
# ─────────────────────────────────────────────
@app.get("/api/audit-log")
def get_audit_log(
    limit: int = 200,
    action: Optional[str] = None,
    user=Depends(verify_true_superadmin),
    db: Session = Depends(get_db),
):
    """The latest events, newest first. `action` filters by prefix, e.g. "login"."""
    limit = max(1, min(int(limit), 1000))
    query = "SELECT id, at, actor_email, action, target, ip, detail FROM audit_log"
    params: dict = {"limit": limit}
    if action:
        query += " WHERE action LIKE :action"
        params["action"] = action.replace("%", "").replace("_", "\\_")[:64] + "%"
    query += " ORDER BY at DESC, id DESC LIMIT :limit"
    rows = db.execute(text(query), params).fetchall()
    since = datetime.utcnow() - timedelta(hours=24)
    failed_24h = db.execute(text(
        "SELECT COUNT(*) FROM audit_log WHERE action IN ('login.failed', 'login.blocked', 'login.denied') AND at >= :since"
    ), {"since": since}).scalar()
    return {"events": [dict(r._mapping) for r in rows], "failed_sign_ins_24h": failed_24h}

BACKUP_TABLES = [
    "personnel", "paps", "pap_monitoring", "pap_submissions", "pap_focal_persons",
    "leave_requests", "links", "announcements", "trainings", "training_attendees",
]

@app.get("/api/admin/backup")
def download_backup(request: Request, user=Depends(verify_true_superadmin), db: Session = Depends(get_db)):
    """Every table as JSON, for an off-site copy. Password hashes are left out."""
    from fastapi.encoders import jsonable_encoder
    data = {}
    for table in BACKUP_TABLES:
        rows = db.execute(text(f"SELECT * FROM {table}")).fetchall()
        data[table] = [
            {k: v for k, v in dict(r._mapping).items() if k != "password_hash"}
            for r in rows
        ]
    audit(db, "backup.downloaded", actor=user, request=request,
          detail=", ".join(f"{t}: {len(v)}" for t, v in data.items()))
    return JSONResponse(
        content=jsonable_encoder({"created_at": datetime.utcnow().isoformat() + "Z", "tables": data}),
        headers={"Content-Disposition": f'attachment; filename="socd-portal-backup-{_manila_today()}.json"'},
    )

# ─────────────────────────────────────────────
# Me Endpoint
# ─────────────────────────────────────────────
@app.get("/api/me")
def get_me(user=Depends(verify_session), db: Session = Depends(get_db)):
    """Return the current authenticated user's personnel record."""
    me = public_person(user)
    me["has_password"] = bool(user.password_hash)
    me.pop("sessions_valid_after", None)
    me["status"] = effective_status(me.get("status"), statuses_from_leaves(db, _manila_today()).get(me["id"]))
    return me

# ─────────────────────────────────────────────
# Personnel Endpoints
# ─────────────────────────────────────────────
@app.get("/api/personnel")
def get_personnel(user=Depends(verify_session), db: Session = Depends(get_db)):
    """
    Return the personnel directory for the whole region, for every signed-in role.
    Only SuperAdmin and RSSO can change it (see the endpoints below).
    """
    rows = db.execute(
        text("SELECT * FROM personnel ORDER BY unit, name")
    ).fetchall()
    on_leave = statuses_from_leaves(db, _manila_today())
    people = []
    for r in rows:
        person = public_person(r)
        person["status"] = effective_status(person.get("status"), on_leave.get(person["id"]))
        people.append(person)
    return people

@app.post("/api/personnel")
def add_personnel(staff: PersonnelBase, request: Request, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    role = _clean_portal_role(staff.portal_role)
    _guard_account_change(db, user, None, new_role=role)
    new_id = str(uuid.uuid4())
    try:
        db.execute(text("""
            INSERT INTO personnel (id, name, email, role, unit, office, local_ext, portal_role, status)
            VALUES (:id, :name, :email, :role, :unit, :office, :local_ext, :portal_role, 'in-office')
        """), {
            "id": new_id, "name": staff.name, "email": staff.email,
            "role": staff.role, "unit": staff.office, "office": staff.office,
            "local_ext": staff.local_ext, "portal_role": role,
        })
        db.commit()
        row = db.execute(text("SELECT * FROM personnel WHERE id = :id"), {"id": new_id}).fetchone()
        audit(db, "personnel.added", actor=user, target=staff.email, request=request, detail=f"role: {role or 'none'}")
        return {"success": True, "data": public_person(row)}
    except Exception as e:
        db.rollback()
        if "Duplicate entry" in str(e) or "1062" in str(e):
            raise HTTPException(status_code=400, detail="A staff member with this email already exists.")
        raise server_error("Error creating staff", e)

@app.put("/api/personnel/{id}")
def update_personnel(id: str, staff: PersonnelBase, request: Request, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    current = db.execute(text("SELECT * FROM personnel WHERE id = :id"), {"id": id}).fetchone()
    if not current:
        raise HTTPException(status_code=404, detail="Personnel record not found")
    role = _clean_portal_role(staff.portal_role)
    _guard_account_change(db, user, current, new_role=role)
    try:
        result = db.execute(text("""
            UPDATE personnel
            SET name=:name, email=:email, role=:role,
                unit=:unit, office=:office, local_ext=:local_ext, portal_role=:portal_role
            WHERE id=:id
        """), {
            "name": staff.name, "email": staff.email, "role": staff.role,
            "unit": staff.office, "office": staff.office,
            "local_ext": staff.local_ext, "portal_role": role, "id": id,
        })
        # A new email or role takes effect at once: earlier sessions stop working.
        if (current.email or "").lower() != staff.email.lower() or current.portal_role != role:
            _end_other_sessions(db, id)
        db.commit()
        row = db.execute(text("SELECT * FROM personnel WHERE id = :id"), {"id": id}).fetchone()
        changes = [f"{k}: {getattr(current, k)} → {v}" for k, v in
                   (("email", staff.email), ("portal_role", role), ("office", staff.office))
                   if (getattr(current, k) or None) != (v or None)]
        audit(db, "personnel.updated", actor=user, target=current.email, request=request, detail="; ".join(changes) or None)
        return {"success": True, "data": public_person(row)}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise server_error("Error updating staff", e)

@app.patch("/api/personnel/{id}/status")
def update_status(id: str, body: StatusUpdate, request: Request, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    if body.status not in ["in-office", "wfh", "on-leave", "fieldwork"]:
        raise HTTPException(status_code=400, detail="Invalid status value")
    try:
        result = db.execute(
            text("UPDATE personnel SET status=:status WHERE id=:id"),
            {"status": body.status, "id": id}
        )
        db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Personnel record not found")
        row = db.execute(text("SELECT * FROM personnel WHERE id = :id"), {"id": id}).fetchone()
        audit(db, "personnel.status", actor=user, target=id, request=request)
        return {"success": True, "data": public_person(row)}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise server_error("Error updating status", e)

@app.delete("/api/personnel/{id}")
def delete_personnel(id: str, request: Request, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    current = db.execute(text("SELECT * FROM personnel WHERE id = :id"), {"id": id}).fetchone()
    if not current:
        raise HTTPException(status_code=404, detail="Personnel record not found")
    if current.id == user.id:
        raise HTTPException(status_code=400, detail="You can't delete your own account.")
    _guard_account_change(db, user, current, new_role=None)
    try:
        db.execute(text("DELETE FROM personnel WHERE id=:id"), {"id": id})
        db.commit()
        audit(db, "personnel.deleted", actor=user, target=current.email, request=request, detail=current.name)
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise server_error("Error deleting staff", e)

# ─────────────────────────────────────────────
# PAP Endpoints
# ─────────────────────────────────────────────
@app.get("/api/paps")
def get_paps(year: Optional[int] = None, user=Depends(verify_session), db: Session = Depends(get_db)):
    if year is not None:
        rows = db.execute(text("SELECT * FROM paps WHERE year = :year ORDER BY name"), {"year": year}).fetchall()
    else:
        rows = db.execute(text("SELECT * FROM paps ORDER BY name")).fetchall()
    return [dict(r._mapping) for r in rows]

@app.get("/api/pap-years")
def get_pap_years(user=Depends(verify_session), db: Session = Depends(get_db)):
    return _pap_years(db)

# Declared before /api/paps/{pap_id} so "overview" isn't read as a PAP id.
@app.get("/api/paps/overview")
def get_paps_overview(
    year: Optional[int] = None,
    with_activities: bool = False,
    user=Depends(verify_session),
    db: Session = Depends(get_db),
):
    """
    Everything a year page needs in one request: the year info (years with PAPs,
    current and default year), the chosen year (or the default one), and that
    year's PAPs, optionally each with its activities.
    """
    info = _pap_years(db)
    chosen = year or info["default_year"]
    paps = [dict(r._mapping) for r in db.execute(
        text("SELECT * FROM paps WHERE year = :year ORDER BY name"), {"year": chosen}
    ).fetchall()]
    if with_activities:
        acts = db.execute(text("""
            SELECT pm.*, p.name AS pap_name
            FROM pap_monitoring pm
            JOIN paps p ON p.id = pm.pap_id
            WHERE p.year = :year
            ORDER BY pm.deadline
        """), {"year": chosen}).fetchall()
        by_pap = {}
        for a in acts:
            by_pap.setdefault(a.pap_id, []).append(dict(a._mapping))
        for pap in paps:
            pap["activities"] = by_pap.get(pap["id"], [])
    return {**info, "year": chosen, "paps": paps}

@app.get("/api/paps/{pap_id}")
def get_pap(pap_id: str, user=Depends(verify_session), db: Session = Depends(get_db)):
    """Return a single PAP by ID."""
    row = db.execute(text("SELECT * FROM paps WHERE id = :id"), {"id": pap_id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="PAP not found")
    return dict(row._mapping)

@app.post("/api/paps")
def create_pap(body: PapCreate, request: Request, user=Depends(verify_session), db: Session = Depends(get_db)):
    if user.portal_role not in ("SuperAdmin", "RSSO"):
        raise HTTPException(status_code=403, detail="Only RSSO or SuperAdmin can create PAPs.")
    service = _clean_service(body.service)
    year = _clean_year(body.year)
    pap_id = str(uuid.uuid4())
    try:
        db.execute(text("INSERT INTO paps (id, name, service, year) VALUES (:id, :name, :service, :year)"),
                   {"id": pap_id, "name": body.name, "service": service, "year": year})
        for out in body.outputs:
            act_id = str(uuid.uuid4())
            db.execute(text("""
                INSERT INTO pap_monitoring
                (id, pap_id, activity_type, quarter, month, output_deliverable, deadline, response_rate_fillable)
                VALUES (:id, :pap_id, :activity_type, :quarter, :month, :output_deliverable, :deadline, :rfill)
            """), {
                "id": act_id, "pap_id": pap_id,
                "activity_type": out.activity_type,
                "quarter": out.quarter,
                "month": out.month,
                "output_deliverable": out.output_deliverable,
                "deadline": out.deadline,
                "rfill": out.response_rate_fillable,
            })
        db.commit()
        pap_row = db.execute(text("SELECT * FROM paps WHERE id = :id"), {"id": pap_id}).fetchone()
        audit(db, "pap.created", actor=user, target=body.name, request=request)
        return {"success": True, "data": dict(pap_row._mapping)}
    except Exception as e:
        db.rollback()
        raise server_error("Error creating PAP", e)

@app.put("/api/paps/{id}")
def update_pap(id: str, body: PapUpdate, request: Request, user=Depends(verify_session), db: Session = Depends(get_db)):
    if user.portal_role not in ("SuperAdmin", "RSSO"):
        raise HTTPException(status_code=403, detail="Only RSSO or SuperAdmin can edit PAPs.")
    # Only change the service when the request includes it, so a rename alone keeps it.
    fields_set = getattr(body, "model_fields_set", None) or getattr(body, "__fields_set__", set())
    try:
        updates = {"name": body.name}
        if "service" in fields_set:
            updates["service"] = _clean_service(body.service)
        if "year" in fields_set and body.year is not None:
            updates["year"] = _clean_year(body.year)
        set_clause = ", ".join(f"{k} = :{k}" for k in updates)
        result = db.execute(text(f"UPDATE paps SET {set_clause} WHERE id = :id"), {**updates, "id": id})
        db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="PAP not found")
        row = db.execute(text("SELECT * FROM paps WHERE id = :id"), {"id": id}).fetchone()
        audit(db, "pap.updated", actor=user, target=id, request=request)
        return {"success": True, "data": dict(row._mapping)}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise server_error("Error updating PAP", e)

@app.delete("/api/paps/{id}")
def delete_pap(id: str, request: Request, user=Depends(verify_session), db: Session = Depends(get_db)):
    if user.portal_role not in ("SuperAdmin", "RSSO"):
        raise HTTPException(status_code=403, detail="Only RSSO or SuperAdmin can delete PAPs.")
    try:
        # pap_monitoring rows cascade-delete via FK
        db.execute(text("DELETE FROM pap_monitoring WHERE pap_id = :id"), {"id": id})
        db.execute(text("DELETE FROM pap_focal_persons WHERE pap_id = :id"), {"id": id})
        db.execute(text("DELETE FROM paps WHERE id = :id"), {"id": id})
        db.commit()
        audit(db, "pap.deleted", actor=user, target=id, request=request)
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise server_error("Error deleting PAP", e)

# ─────────────────────────────────────────────
# PAP Monitoring Endpoints
# ─────────────────────────────────────────────
@app.get("/api/monitoring")
def get_monitoring(
    pap_id: Optional[str] = None,
    quarter: Optional[str] = None,
    month: Optional[str] = None,
    user=Depends(verify_session),
    db: Session = Depends(get_db)
):
    query  = "SELECT pm.*, p.name AS pap_name FROM pap_monitoring pm LEFT JOIN paps p ON pm.pap_id = p.id WHERE 1=1"
    params = {}
    if pap_id:
        query += " AND pm.pap_id = :pap_id";  params["pap_id"]  = pap_id
    if quarter:
        query += " AND pm.quarter = :quarter"; params["quarter"] = quarter
    if month:
        query += " AND pm.month = :month";     params["month"]   = month
    query += " ORDER BY pm.deadline"
    rows = db.execute(text(query), params).fetchall()
    return [dict(r._mapping) for r in rows]

@app.post("/api/monitoring")
def add_activity(activity: ActivityCreate, request: Request, user=Depends(verify_session), db: Session = Depends(get_db)):
    if user.portal_role not in ("SuperAdmin", "RSSO"):
        raise HTTPException(status_code=403, detail="Only SuperAdmin or RSSO can add activities.")
    new_id = str(uuid.uuid4())
    try:
        db.execute(text("""
            INSERT INTO pap_monitoring
            (id, pap_id, activity_type, quarter, month, output_deliverable, deadline, response_rate_fillable)
            VALUES (:id, :pap_id, :activity_type, :quarter, :month, :output_deliverable, :deadline, :rfill)
        """), {
            "id": new_id, "pap_id": activity.pap_id,
            "activity_type": activity.activity_type, "quarter": activity.quarter,
            "month": activity.month, "output_deliverable": activity.output_deliverable,
            "deadline": activity.deadline, "rfill": activity.response_rate_fillable,
        })
        db.commit()
        row = db.execute(text("SELECT * FROM pap_monitoring WHERE id = :id"), {"id": new_id}).fetchone()
        audit(db, "activity.added", actor=user, target=activity.pap_id, request=request)
        return {"success": True, "data": dict(row._mapping)}
    except Exception as e:
        db.rollback()
        raise server_error("Error creating activity", e)

@app.post("/api/monitoring/bulk")
def add_activities_bulk(body: ActivityBulkCreate, request: Request, user=Depends(verify_session), db: Session = Depends(get_db)):
    if user.portal_role not in ("SuperAdmin", "RSSO"):
        raise HTTPException(status_code=403, detail="Only RSSO or SuperAdmin can import activities.")
    if not body.activities:
        raise HTTPException(status_code=400, detail="No activities provided.")
    created = []
    try:
        for act in body.activities:
            act_id = str(uuid.uuid4())
            db.execute(text("""
                INSERT INTO pap_monitoring
                (id, pap_id, activity_type, quarter, month, output_deliverable, deadline, response_rate_fillable)
                VALUES (:id, :pap_id, :activity_type, :quarter, :month, :output_deliverable, :deadline, :rfill)
            """), {
                "id": act_id, "pap_id": body.pap_id,
                "activity_type": act.activity_type, "quarter": act.quarter,
                "month": act.month, "output_deliverable": act.output_deliverable,
                "deadline": act.deadline, "rfill": act.response_rate_fillable,
            })
            created.append(act_id)
        db.commit()
        rows = db.execute(text("SELECT * FROM pap_monitoring WHERE pap_id = :pap_id ORDER BY deadline"), {"pap_id": body.pap_id}).fetchall()
        audit(db, "activity.imported", actor=user, target=body.pap_id, request=request)
        return {"success": True, "count": len(created), "data": [dict(r._mapping) for r in rows]}
    except Exception as e:
        db.rollback()
        raise server_error("Error importing activities", e)

@app.patch("/api/monitoring/{id}")
def patch_activity_template(id: str, body: ActivityPatch, request: Request, user=Depends(verify_session), db: Session = Depends(get_db)):
    """Update activity template fields (RSSO/SuperAdmin only)."""
    if user.portal_role not in ("SuperAdmin", "RSSO"):
        raise HTTPException(status_code=403, detail="Only RSSO or SuperAdmin can edit activity templates.")
    fields = {k: v for k, v in {
        "output_deliverable": body.output_deliverable,
        "deadline": body.deadline,
        "response_rate_fillable": body.response_rate_fillable,
        "activity_type": body.activity_type,
        "quarter": body.quarter,
        "month": body.month,
    }.items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")
    set_clause = ", ".join(f"{k} = :{k}" for k in fields)
    fields["id"] = id
    try:
        result = db.execute(text(f"UPDATE pap_monitoring SET {set_clause} WHERE id = :id"), fields)
        db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Activity not found")
        row = db.execute(text("SELECT * FROM pap_monitoring WHERE id = :id"), {"id": id}).fetchone()
        audit(db, "activity.updated", actor=user, target=id, request=request)
        return {"success": True, "data": dict(row._mapping)}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise server_error("Error updating activity", e)

@app.delete("/api/monitoring/{id}")
def delete_activity(id: str, request: Request, user=Depends(verify_session), db: Session = Depends(get_db)):
    if user.portal_role not in ("SuperAdmin", "RSSO"):
        raise HTTPException(status_code=403, detail="Only SuperAdmin or RSSO can delete activities.")
    try:
        db.execute(text("DELETE FROM pap_monitoring WHERE id=:id"), {"id": id})
        db.commit()
        audit(db, "activity.deleted", actor=user, target=id, request=request)
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise server_error("Error deleting activity", e)

# ─────────────────────────────────────────────
# PAP Submissions Endpoints (per-province)
# ─────────────────────────────────────────────
PSO_OFFICES = [
    "Davao del Norte", "Davao del Sur", "Davao Oriental",
    "Davao de Oro", "Davao Occidental",
]

@app.get("/api/submissions")
def get_submissions(
    pap_id: str,
    user=Depends(verify_session),
    db: Session = Depends(get_db)
):
    """
    Return all pap_submissions rows for a given PAP.
    - RSSO/SuperAdmin: all offices.
    - PSO: only their own office.
    """
    if user.portal_role in ("SuperAdmin", "RSSO"):
        rows = db.execute(text("""
            SELECT ps.*
            FROM pap_submissions ps
            JOIN pap_monitoring pm ON ps.pap_monitoring_id = pm.id
            WHERE pm.pap_id = :pap_id
        """), {"pap_id": pap_id}).fetchall()
    else:
        # PSO sees only their office
        rows = db.execute(text("""
            SELECT ps.*
            FROM pap_submissions ps
            JOIN pap_monitoring pm ON ps.pap_monitoring_id = pm.id
            WHERE pm.pap_id = :pap_id AND ps.office = :office
        """), {"pap_id": pap_id, "office": user.office}).fetchall()
    return [dict(r._mapping) for r in rows]

@app.put("/api/submissions/{activity_id}/{office}")
def upsert_submission(
    activity_id: str,
    office: str,
    body: SubmissionUpsert,
    request: Request, user=Depends(verify_session),
    db: Session = Depends(get_db)
):
    """
    Create or update a province submission for one activity.
    - PSO can only update their own office, and only PSO fields.
    - RSSO/SuperAdmin can update any office and all fields.
    """
    is_rsso = user.portal_role in ("SuperAdmin", "RSSO")
    is_pso  = user.portal_role == "PSO"

    if not (is_rsso or is_pso):
        raise HTTPException(status_code=403, detail="Only PSO, RSSO or SuperAdmin accounts can record submissions.")
    if office not in PSO_OFFICES:
        raise HTTPException(status_code=400, detail="Unknown province.")
    if body.actual_submission:
        try:
            date.fromisoformat(body.actual_submission)
        except ValueError:
            raise HTTPException(status_code=400, detail="The submission date must be a valid date.")

    # PSO can only write their own office
    if is_pso and office != user.office:
        raise HTTPException(status_code=403, detail="PSO can only submit for their own office.")

    # Verify activity exists
    act = db.execute(text("SELECT id, response_rate_fillable FROM pap_monitoring WHERE id = :id"),
                     {"id": activity_id}).fetchone()
    if not act:
        raise HTTPException(status_code=404, detail="Activity not found")

    # Build the field set based on role
    fields: dict = {}
    # PSO fields
    if is_pso or is_rsso:
        if body.actual_submission is not None:
            fields["actual_submission"] = body.actual_submission or None
        if body.pso_remarks is not None:
            fields["pso_remarks"] = body.pso_remarks or None
        if act.response_rate_fillable and body.response_rate is not None:
            fields["response_rate"] = body.response_rate
    # RSSO-only fields
    if is_rsso:
        if body.rsso_remarks is not None:
            fields["rsso_remarks"] = body.rsso_remarks or None
        if body.rating_quantity is not None:
            fields["rating_quantity"] = body.rating_quantity

    try:
        existing = db.execute(
            text("SELECT id FROM pap_submissions WHERE pap_monitoring_id = :aid AND office = :office"),
            {"aid": activity_id, "office": office}
        ).fetchone()

        if existing:
            if fields:
                set_clause = ", ".join(f"{k} = :{k}" for k in fields)
                fields["aid"] = activity_id
                fields["office"] = office
                db.execute(
                    text(f"UPDATE pap_submissions SET {set_clause} WHERE pap_monitoring_id = :aid AND office = :office"),
                    fields
                )
        else:
            new_id = str(uuid.uuid4())
            fields["id"] = new_id
            fields["pap_monitoring_id"] = activity_id
            fields["office"] = office
            cols   = ", ".join(fields.keys())
            vals   = ", ".join(f":{k}" for k in fields)
            db.execute(text(f"INSERT INTO pap_submissions ({cols}) VALUES ({vals})"), fields)

        db.commit()
        row = db.execute(
            text("SELECT * FROM pap_submissions WHERE pap_monitoring_id = :aid AND office = :office"),
            {"aid": activity_id, "office": office}
        ).fetchone()
        audit(db, "submission.saved", actor=user, target=f"{activity_id}/{office}", request=request)
        return {"success": True, "data": dict(row._mapping)}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise server_error("Error upserting submission", e)

# ─────────────────────────────────────────────
# Copy a year's PAPs to another year
# ─────────────────────────────────────────────
def _shift_years(d, years: int):
    """Same day and month, `years` later. 29 February becomes 28 February."""
    if d is None:
        return None
    d = _to_date(d)
    try:
        return d.replace(year=d.year + years)
    except ValueError:
        return d.replace(year=d.year + years, day=28)

@app.post("/api/paps/copy-year")
def copy_paps_to_year(body: PapCopyYear, request: Request, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    """
    Copy PAPs of from_year into to_year, with their Service, activities and focal persons.
    With pap_ids, only those PAPs are copied; without it, every PAP of from_year is.
    Deadlines move by the number of years between the two. Submissions are not copied.
    PAPs whose name already exists in to_year are skipped, so running it twice is safe.
    """
    from_year = _clean_year(body.from_year)
    to_year = _clean_year(body.to_year)
    if from_year == to_year:
        raise HTTPException(status_code=400, detail="Choose two different years.")
    shift = to_year - from_year

    source = db.execute(text("SELECT * FROM paps WHERE year = :y ORDER BY name"), {"y": from_year}).fetchall()
    if not source:
        raise HTTPException(status_code=404, detail=f"There are no PAPs in {from_year} to copy.")
    if body.pap_ids is not None:
        wanted = set(body.pap_ids)
        if not wanted:
            raise HTTPException(status_code=400, detail="Pick at least one PAP to copy.")
        source_ids = {p.id for p in source}
        if wanted - source_ids:
            raise HTTPException(status_code=400, detail=f"Some of the selected PAPs are not in {from_year}.")
        source = [p for p in source if p.id in wanted]
    existing = {
        (r.name or "").strip().lower()
        for r in db.execute(text("SELECT name FROM paps WHERE year = :y"), {"y": to_year}).fetchall()
    }

    copied, skipped, activities_copied = [], [], 0
    try:
        for pap in source:
            if (pap.name or "").strip().lower() in existing:
                skipped.append(pap.name)
                continue
            new_pap_id = str(uuid.uuid4())
            db.execute(
                text("INSERT INTO paps (id, name, service, year) VALUES (:id, :name, :service, :year)"),
                {"id": new_pap_id, "name": pap.name, "service": pap.service, "year": to_year},
            )
            acts = db.execute(text("SELECT * FROM pap_monitoring WHERE pap_id = :pid"), {"pid": pap.id}).fetchall()
            for act in acts:
                db.execute(text("""
                    INSERT INTO pap_monitoring
                    (id, pap_id, activity_type, quarter, month, output_deliverable, deadline, response_rate_fillable)
                    VALUES (:id, :pap_id, :activity_type, :quarter, :month, :output_deliverable, :deadline, :rfill)
                """), {
                    "id": str(uuid.uuid4()),
                    "pap_id": new_pap_id,
                    "activity_type": act.activity_type,
                    "quarter": act.quarter,
                    "month": act.month,
                    "output_deliverable": act.output_deliverable,
                    "deadline": _shift_years(act.deadline, shift),
                    "rfill": act.response_rate_fillable,
                })
                activities_copied += 1
            db.execute(text("""
                INSERT INTO pap_focal_persons (pap_id, office, focal_id, alternate_id)
                SELECT :new_id, office, focal_id, alternate_id FROM pap_focal_persons WHERE pap_id = :old_id
            """), {"new_id": new_pap_id, "old_id": pap.id})
            copied.append(pap.name)
        db.commit()
    except Exception as e:
        db.rollback()
        raise server_error("Error copying PAPs", e)

    audit(db, "pap.copied", actor=user, target=f"{from_year} → {to_year}", request=request)
    return {
        "success": True,
        "from_year": from_year,
        "to_year": to_year,
        "copied": copied,
        "skipped": skipped,
        "activities_copied": activities_copied,
    }

# ─────────────────────────────────────────────
# Focal Persons (per PAP, per province)
# ─────────────────────────────────────────────
FOCAL_SELECT = """
    SELECT fp.pap_id, fp.office, fp.focal_id, fp.alternate_id,
           f.name AS focal_name, a.name AS alternate_name
    FROM pap_focal_persons fp
    LEFT JOIN personnel f ON f.id = fp.focal_id
    LEFT JOIN personnel a ON a.id = fp.alternate_id
"""

@app.get("/api/focal-persons")
def get_all_focal_persons(user=Depends(verify_session), db: Session = Depends(get_db)):
    """All focal person assignments, for every PAP and province."""
    rows = db.execute(text(FOCAL_SELECT + " ORDER BY fp.pap_id, fp.office")).fetchall()
    return [dict(r._mapping) for r in rows]

@app.get("/api/paps/{pap_id}/focal-persons")
def get_pap_focal_persons(pap_id: str, user=Depends(verify_session), db: Session = Depends(get_db)):
    """Focal and alternate for each province of one PAP. Provinces with no assignment have nulls."""
    rows = db.execute(text(FOCAL_SELECT + " WHERE fp.pap_id = :pap_id"), {"pap_id": pap_id}).fetchall()
    by_office = {r.office: dict(r._mapping) for r in rows}
    return [
        by_office.get(office, {
            "pap_id": pap_id, "office": office,
            "focal_id": None, "alternate_id": None,
            "focal_name": None, "alternate_name": None,
        })
        for office in PSO_OFFICES
    ]

@app.put("/api/paps/{pap_id}/focal-persons/{office}")
def set_pap_focal_persons(
    pap_id: str,
    office: str,
    body: FocalAssignment,
    request: Request, user=Depends(verify_superadmin),
    db: Session = Depends(get_db),
):
    """Set (or clear) the focal and alternate for one province of a PAP. SuperAdmin/RSSO only."""
    if office not in PSO_OFFICES:
        raise HTTPException(status_code=400, detail=f"Unknown province: {office}")
    if not db.execute(text("SELECT id FROM paps WHERE id = :id"), {"id": pap_id}).fetchone():
        raise HTTPException(status_code=404, detail="PAP not found")

    focal_id = body.focal_id or None
    alternate_id = body.alternate_id or None
    if focal_id and alternate_id and focal_id == alternate_id:
        raise HTTPException(status_code=400, detail="The focal and alternate must be different people.")
    for label, staff_id in (("Focal person", focal_id), ("Alternate", alternate_id)):
        if staff_id:
            staff = db.execute(
                text("SELECT office FROM personnel WHERE id = :id"), {"id": staff_id}
            ).fetchone()
            if not staff:
                raise HTTPException(status_code=400, detail=f"{label} was not found in the directory.")
            if staff.office != office:
                raise HTTPException(status_code=400, detail=f"{label} must be a staff member of {office}.")

    try:
        if not focal_id and not alternate_id:
            db.execute(
                text("DELETE FROM pap_focal_persons WHERE pap_id = :pap_id AND office = :office"),
                {"pap_id": pap_id, "office": office},
            )
        else:
            params = {"pap_id": pap_id, "office": office, "focal_id": focal_id, "alternate_id": alternate_id}
            exists = db.execute(
                text("SELECT 1 FROM pap_focal_persons WHERE pap_id = :pap_id AND office = :office"), params
            ).fetchone()
            if exists:
                db.execute(text("""
                    UPDATE pap_focal_persons SET focal_id = :focal_id, alternate_id = :alternate_id
                    WHERE pap_id = :pap_id AND office = :office
                """), params)
            else:
                db.execute(text("""
                    INSERT INTO pap_focal_persons (pap_id, office, focal_id, alternate_id)
                    VALUES (:pap_id, :office, :focal_id, :alternate_id)
                """), params)
        db.commit()
    except Exception as e:
        db.rollback()
        raise server_error("Error saving focal persons", e)

    row = db.execute(
        text(FOCAL_SELECT + " WHERE fp.pap_id = :pap_id AND fp.office = :office"),
        {"pap_id": pap_id, "office": office},
    ).fetchone()
    data = dict(row._mapping) if row else {
        "pap_id": pap_id, "office": office, "focal_id": None, "alternate_id": None,
        "focal_name": None, "alternate_name": None,
    }
    audit(db, "focal.set", actor=user, target=f"{pap_id}/{office}", request=request)
    return {"success": True, "data": data}

# ─────────────────────────────────────────────
# Year-end Ratings
# Same formulas as the province tab on the monitoring page:
#   Quantity   = entered by RSSO
#   Quality    = from response rate (>=95 -> 5, >=90 -> 4, >=80 -> 3, else 2)
#   Timeliness = on or before the deadline -> 5, late -> 3
#   Activity   = average of whichever of the three are available
# Activities past their deadline with no rating count as MISSING_ACTIVITY_RATING.
# Activities not yet due are left out.
# Project rating (per province) = average of its activity ratings.
# Province rating = average of its project ratings.
# Focal person rating = average of the project ratings they are focal for.
# Project rating (all provinces) = average of the province ratings.
# ─────────────────────────────────────────────
MISSING_ACTIVITY_RATING = 1.0
MANILA_TZ = timezone(timedelta(hours=8))

def _quality_rating(response_rate):
    if response_rate is None:
        return None
    rr = float(response_rate)
    if rr >= 95:
        return 5.0
    if rr >= 90:
        return 4.0
    if rr >= 80:
        return 3.0
    return 2.0

def _timeliness_rating(deadline, actual):
    if not actual:
        return None
    return 5.0 if actual <= deadline else 3.0

def _to_date(value):
    if value is None or isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])

def _mean(values):
    vals = [v for v in values if v is not None]
    if not vals:
        return None
    return sum(vals) / len(vals)

def _r2(value):
    return None if value is None else round(value + 1e-9, 2)

def activity_rating(deadline, submission, today):
    """Returns (rating, status). status is 'rated', 'missing' or 'pending'."""
    deadline = _to_date(deadline)
    if submission:
        qty = submission.get("rating_quantity")
        qty = float(qty) if qty is not None else None
        quality = _quality_rating(submission.get("response_rate"))
        timeliness = _timeliness_rating(deadline, _to_date(submission.get("actual_submission")))
        avg = _mean([qty, quality, timeliness])
        if avg is not None:
            return round(avg + 1e-9, 2), "rated"
    if deadline < today:
        return MISSING_ACTIVITY_RATING, "missing"
    return None, "pending"

def compute_ratings(paps, activities, submissions, focal_rows, offices, today):
    """
    paps:        [{id, name}]
    activities:  [{id, pap_id, deadline}]           (already limited to the year)
    submissions: [{pap_monitoring_id, office, actual_submission, response_rate, rating_quantity}]
    focal_rows:  [{pap_id, office, focal_id, focal_name, focal_office, alternate_id, alternate_name}]
    offices:     provinces to include
    """
    sub_by_key = {(s["pap_monitoring_id"], s["office"]): s for s in submissions}
    focal_by_key = {(f["pap_id"], f["office"]): f for f in focal_rows}
    acts_by_pap = {}
    for a in activities:
        acts_by_pap.setdefault(a["pap_id"], []).append(a)

    projects = []
    office_project_ratings = {o: [] for o in offices}
    focal_map = {}

    for pap in sorted(paps, key=lambda p: p["name"].lower()):
        pap_acts = acts_by_pap.get(pap["id"], [])
        if not pap_acts:
            continue
        office_entries = []
        raw_office_ratings = []
        for office in offices:
            counts = {"rated": 0, "missing": 0, "pending": 0}
            ratings = []
            for act in pap_acts:
                rating, status = activity_rating(act["deadline"], sub_by_key.get((act["id"], office)), today)
                counts[status] += 1
                if rating is not None:
                    ratings.append(rating)
            office_rating = _mean(ratings)
            focal = focal_by_key.get((pap["id"], office)) or {}
            entry = {
                "office": office,
                "rating": _r2(office_rating),
                "activities_total": len(pap_acts),
                "activities_rated": counts["rated"],
                "activities_missing": counts["missing"],
                "activities_pending": counts["pending"],
                "focal_id": focal.get("focal_id"),
                "focal_name": focal.get("focal_name"),
                "alternate_id": focal.get("alternate_id"),
                "alternate_name": focal.get("alternate_name"),
            }
            office_entries.append(entry)
            raw_office_ratings.append(office_rating)
            if office_rating is not None:
                office_project_ratings[office].append(office_rating)
            if entry["focal_id"]:
                person = focal_map.setdefault(entry["focal_id"], {
                    "staff_id": entry["focal_id"],
                    "name": entry["focal_name"] or "(removed staff)",
                    "office": focal.get("focal_office") or office,
                    "_ratings": [],
                    "projects": [],
                })
                person["projects"].append({
                    "pap_id": pap["id"],
                    "pap_name": pap["name"],
                    "office": office,
                    "rating": entry["rating"],
                    "activities_total": entry["activities_total"],
                    "activities_rated": entry["activities_rated"],
                    "activities_missing": entry["activities_missing"],
                    "activities_pending": entry["activities_pending"],
                })
                if office_rating is not None:
                    person["_ratings"].append(office_rating)
        projects.append({
            "pap_id": pap["id"],
            "pap_name": pap["name"],
            "rating": _r2(_mean(raw_office_ratings)),
            "offices": office_entries,
        })

    office_summary = [
        {
            "office": o,
            "rating": _r2(_mean(office_project_ratings[o])),
            "projects_rated": len(office_project_ratings[o]),
            "projects_total": len(projects),
        }
        for o in offices
    ]

    focal_persons = []
    for person in focal_map.values():
        ratings = person.pop("_ratings")
        person["rating"] = _r2(_mean(ratings))
        person["projects_rated"] = len(ratings)
        focal_persons.append(person)
    focal_persons.sort(key=lambda p: (p["office"], p["name"].lower()))

    return {"offices": office_summary, "projects": projects, "focal_persons": focal_persons}

@app.get("/api/ratings")
def get_ratings(year: Optional[int] = None, user=Depends(verify_session), db: Session = Depends(get_db)):
    """
    Year-end ratings per province, per focal person and per project.
    - SuperAdmin/RSSO: all provinces.
    - PSO: their own province only.
    """
    today = datetime.now(MANILA_TZ).date()
    year_info = _pap_years(db)
    year = year or year_info["default_year"]

    if user.portal_role in ("SuperAdmin", "RSSO"):
        offices = list(PSO_OFFICES)
    elif user.office in PSO_OFFICES:
        offices = [user.office]
    else:
        offices = []

    years = sorted(set(year_info["years"]) | {year}, reverse=True)

    # Everything in a PAP counts toward the PAP's year, whatever the deadline dates.
    paps = [dict(r._mapping) for r in db.execute(
        text("SELECT id, name FROM paps WHERE year = :year"), {"year": year}
    ).fetchall()]
    activities = [dict(r._mapping) for r in db.execute(text("""
        SELECT pm.id, pm.pap_id, pm.deadline FROM pap_monitoring pm
        JOIN paps p ON p.id = pm.pap_id
        WHERE p.year = :year
    """), {"year": year}).fetchall()]
    submissions = [dict(r._mapping) for r in db.execute(text("""
        SELECT ps.pap_monitoring_id, ps.office, ps.actual_submission, ps.response_rate, ps.rating_quantity
        FROM pap_submissions ps
        JOIN pap_monitoring pm ON pm.id = ps.pap_monitoring_id
        JOIN paps p ON p.id = pm.pap_id
        WHERE p.year = :year
    """), {"year": year}).fetchall()]
    focal_rows = [dict(r._mapping) for r in db.execute(text("""
        SELECT fp.pap_id, fp.office, fp.focal_id, fp.alternate_id,
               f.name AS focal_name, f.office AS focal_office, a.name AS alternate_name
        FROM pap_focal_persons fp
        LEFT JOIN personnel f ON f.id = fp.focal_id
        LEFT JOIN personnel a ON a.id = fp.alternate_id
    """)).fetchall()]

    result = compute_ratings(paps, activities, submissions, focal_rows, offices, today)
    result.update({
        "year": year,
        "years": years,
        "as_of": today.isoformat(),
        "missing_activity_rating": MISSING_ACTIVITY_RATING,
    })
    return result

# ─────────────────────────────────────────────
# Stats Endpoint
# ─────────────────────────────────────────────
def province_pap_stats(activities, today, days_ahead: int = 30) -> dict:
    """
    activities: [{"deadline": date, "submitted": date-or-None}] for one province and one PAP year.
    Overdue = past its deadline and not submitted. Due soon = due within days_ahead and not submitted.
    """
    states = [
        deliverable_state(a["deadline"], a["submitted"] or None, today, days_ahead)
        for a in activities
    ]
    total = len(states)
    submitted = sum(1 for st in states if st in ("on_time", "late"))
    overdue = states.count("overdue")
    due_soon = states.count("due_soon")
    return {
        "activities_total": total,
        "activities_submitted": submitted,
        "activities_overdue": overdue,
        "activities_due_soon": due_soon,
    }

@app.get("/api/stats")
def get_stats(user=Depends(verify_session), db: Session = Depends(get_db)):
    # PSO accounts get their own province's figures: its staff and its PAP progress
    # for the current PAP year.
    if user.portal_role == "PSO":
        try:
            office = user.office
            year = _pap_years(db)["default_year"]
            staff_count = db.execute(
                text("SELECT COUNT(*) FROM personnel WHERE office = :office"), {"office": office}
            ).scalar() or 0
            paps_count = db.execute(
                text("SELECT COUNT(*) FROM paps WHERE year = :year"), {"year": year}
            ).scalar() or 0
            rows = db.execute(text("""
                SELECT pm.deadline, ps.actual_submission AS submitted
                FROM pap_monitoring pm
                JOIN paps p ON p.id = pm.pap_id
                LEFT JOIN pap_submissions ps
                       ON ps.pap_monitoring_id = pm.id AND ps.office = :office
                WHERE p.year = :year
            """), {"office": office, "year": year}).fetchall()
            activities = [{"deadline": r.deadline, "submitted": r.submitted} for r in rows]
            result = {
                "scope": "province",
                "office": office,
                "year": year,
                "staff_count": staff_count,
                "paps_count": paps_count,
            }
            result.update(province_pap_stats(activities, _manila_today()))
            return result
        except Exception as e:
            raise server_error("Error calculating stats", e)

    try:
        staff_count = db.execute(text("SELECT COUNT(*) FROM personnel")).scalar() or 0
        pending_leaves = db.execute(text("SELECT COUNT(*) FROM leave_requests WHERE status = 'pending'")).scalar() or 0
        
        # Activities that no office has submitted yet
        pending_activities = db.execute(text("""
            SELECT COUNT(*) FROM pap_monitoring pm
            WHERE NOT EXISTS (
                SELECT 1 FROM pap_submissions ps
                WHERE ps.pap_monitoring_id = pm.id AND ps.actual_submission IS NOT NULL
            )
        """)).scalar() or 0
        
        upcoming_trainings = db.execute(
            text("SELECT COUNT(*) FROM trainings WHERE training_date >= CURRENT_DATE")
        ).scalar() or 0
        
        return {
            "scope": "region",
            "staff_count": staff_count,
            "pending_leaves": pending_leaves,
            "pending_activities": pending_activities,
            "upcoming_trainings": upcoming_trainings
        }
    except Exception as e:
        raise server_error("Error calculating stats", e)

# ─────────────────────────────────────────────
# Links Endpoints
# ─────────────────────────────────────────────
@app.get("/api/links")
def get_links(user=Depends(verify_session), db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM links ORDER BY category, label")).fetchall()
    return [dict(r._mapping) for r in rows]

@app.post("/api/links")
def add_link(body: LinkCreate, request: Request, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    url = _require_web_url(body.url, "Link")
    if not url:
        raise HTTPException(status_code=400, detail="Link is required.")
    new_id = str(uuid.uuid4())
    try:
        db.execute(text("""
            INSERT INTO links (id, label, url, category, description)
            VALUES (:id, :label, :url, :category, :description)
        """), {
            "id": new_id, "label": body.title, "url": url,
            "category": body.category, "description": body.description
        })
        db.commit()
        row = db.execute(text("SELECT * FROM links WHERE id = :id"), {"id": new_id}).fetchone()
        audit(db, "link.added", actor=user, target=url, request=request)
        return {"success": True, "data": dict(row._mapping)}
    except Exception as e:
        db.rollback()
        raise server_error("Error creating link", e)

@app.put("/api/links/{id}")
def update_link(id: str, body: LinkCreate, request: Request, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    url = _require_web_url(body.url, "Link")
    if not url:
        raise HTTPException(status_code=400, detail="Link is required.")
    try:
        result = db.execute(text("""
            UPDATE links
            SET label = :label, url = :url, category = :category, description = :description
            WHERE id = :id
        """), {
            "label": body.title, "url": url, "category": body.category,
            "description": body.description, "id": id
        })
        db.commit()
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Link not found")
        row = db.execute(text("SELECT * FROM links WHERE id = :id"), {"id": id}).fetchone()
        audit(db, "link.updated", actor=user, target=id, request=request)
        return {"success": True, "data": dict(row._mapping)}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise server_error("Error updating link", e)

@app.delete("/api/links/{id}")
def delete_link(id: str, request: Request, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    try:
        db.execute(text("DELETE FROM links WHERE id = :id"), {"id": id})
        db.commit()
        audit(db, "link.deleted", actor=user, target=id, request=request)
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise server_error("Error deleting link", e)

# ─────────────────────────────────────────────
# Leave & WFH Endpoints
# ─────────────────────────────────────────────
@app.get("/api/leaves")
def get_leaves(user=Depends(verify_session), db: Session = Depends(get_db)):
    """
    PSO accounts see only their own requests (the Leave page is for the regional office).
    Remarks can be personal (sick leave), so only the person and SuperAdmin/RSSO see them.
    """
    query = """
        SELECT lr.*, p.name as staff_name, p.office as staff_office
        FROM leave_requests lr
        JOIN personnel p ON lr.staff_id = p.id
    """
    params = {}
    if user.portal_role == "PSO":
        query += " WHERE lr.staff_id = :me"
        params["me"] = user.id
    rows = db.execute(text(query + " ORDER BY lr.start_date DESC"), params).fetchall()
    is_admin = user.portal_role in ("SuperAdmin", "RSSO")
    leaves = []
    for r in rows:
        d = dict(r._mapping)
        if not is_admin and d.get("staff_id") != user.id:
            d["notes"] = None
        leaves.append(d)
    return leaves

@app.post("/api/leaves")
def add_leave(body: LeaveCreate, request: Request, user=Depends(verify_session), db: Session = Depends(get_db)):
    new_id = str(uuid.uuid4())
    if user.portal_role != "SuperAdmin" and user.id != body.staff_id:
        raise HTTPException(status_code=403, detail="You can only submit leaves/schedules for yourself.")
    if body.leave_type not in LEAVE_TYPES:
        raise HTTPException(status_code=400, detail="Unknown leave type.")
    if body.end_date < body.start_date:
        raise HTTPException(status_code=400, detail="The end date can't be before the start date.")
    if (body.end_date - body.start_date).days > 366:
        raise HTTPException(status_code=400, detail="A single request can cover at most one year.")
    if not db.execute(text("SELECT 1 FROM personnel WHERE id = :id"), {"id": body.staff_id}).fetchone():
        raise HTTPException(status_code=400, detail="Staff member not found.")

    try:
        db.execute(text("""
            INSERT INTO leave_requests (id, staff_id, start_date, end_date, leave_type, notes, status)
            VALUES (:id, :staff_id, :start_date, :end_date, :leave_type, :notes, :status)
        """), {
            "id": new_id, "staff_id": body.staff_id,
            "start_date": body.start_date, "end_date": body.end_date,
            "leave_type": body.leave_type, "notes": body.remarks,
            "status": "approved" if user.portal_role == "SuperAdmin" else "pending"
        })
        db.commit()
        

        row = db.execute(text("SELECT * FROM leave_requests WHERE id = :id"), {"id": new_id}).fetchone()
        return {"success": True, "data": dict(row._mapping)}
    except Exception as e:
        db.rollback()
        raise server_error("Error logging leave", e)

@app.patch("/api/leaves/{id}/status")
def update_leave_status(id: str, body: LeaveStatusUpdate, request: Request, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    """
    A leave request goes pending → approved or pending → denied, once.
    To change a decision, delete the request and file it again.
    Staff status follows approved leaves automatically (see effective_status).
    """
    if body.status not in LEAVE_DECISIONS:
        raise HTTPException(status_code=400, detail="Status must be approved or denied.")
    row = db.execute(text("SELECT status, staff_id FROM leave_requests WHERE id = :id"), {"id": id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Leave request not found")
    if row.status != "pending":
        raise HTTPException(status_code=409, detail=f"This request was already {row.status}.")
    if row.staff_id == user.id and user.portal_role != "SuperAdmin":
        raise HTTPException(status_code=403, detail="Someone else has to decide on your own leave request.")
    try:
        db.execute(text("""
            UPDATE leave_requests
            SET status = :status, approver_id = :approver_id
            WHERE id = :id AND status = 'pending'
        """), {"status": body.status, "approver_id": user.id, "id": id})
        db.commit()
        audit(db, f"leave.{body.status}", actor=user, target=id, request=request)
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise server_error("Error updating status", e)

@app.delete("/api/leaves/{id}")
def delete_leave(id: str, request: Request, user=Depends(verify_session), db: Session = Depends(get_db)):
    row = db.execute(text("SELECT * FROM leave_requests WHERE id = :id"), {"id": id}).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Leave request not found")
    
    lr = dict(row._mapping)
    if user.portal_role != "SuperAdmin" and user.id != lr["staff_id"]:
        raise HTTPException(status_code=403, detail="You can only delete your own leave requests.")
        
    try:
        db.execute(text("DELETE FROM leave_requests WHERE id = :id"), {"id": id})
        db.commit()
        audit(db, "leave.deleted", actor=user, target=id, request=request)
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise server_error("Error deleting leave request", e)


# ─────────────────────────────────────────────
# Comms & Announcements
# Audience is "ALL" or a comma-separated list of offices.
# SuperAdmin/RSSO see and manage every announcement; everyone else sees the
# ones addressed to everyone or to their own office.
# ─────────────────────────────────────────────
ANNOUNCEMENT_OFFICES = ["ORD", "CRASD", "SOCD"] + PSO_OFFICES

class AnnouncementIn(BaseModel):
    title: str
    body: str
    audience: List[str] = []      # empty or ["ALL"] = everyone
    link_url: Optional[str] = None
    pinned: bool = False

def clean_audience(offices: List[str]) -> str:
    chosen = [o.strip() for o in offices if o and o.strip()]
    if not chosen or "ALL" in chosen:
        return "ALL"
    unknown = [o for o in chosen if o not in ANNOUNCEMENT_OFFICES]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown office: {', '.join(unknown)}")
    # Keep the official order and drop duplicates.
    return ",".join(o for o in ANNOUNCEMENT_OFFICES if o in chosen)

def announcement_visible(audience: str, portal_role: Optional[str], office: Optional[str]) -> bool:
    if portal_role in ("SuperAdmin", "RSSO"):
        return True
    if not audience or audience == "ALL":
        return True
    return bool(office) and office in audience.split(",")

def _announcement_params(body: AnnouncementIn) -> dict:
    title = (body.title or "").strip()
    text_body = (body.body or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title is required.")
    if len(title) > 200:
        raise HTTPException(status_code=400, detail="Title must be 200 characters or fewer.")
    if not text_body:
        raise HTTPException(status_code=400, detail="Message is required.")
    if len(text_body) > 5000:
        raise HTTPException(status_code=400, detail="Message must be 5,000 characters or fewer.")
    return {
        "title": title,
        "body": text_body,
        "audience": clean_audience(body.audience),
        "link_url": _require_web_url(body.link_url, "Link"),
        "pinned": bool(body.pinned),
    }

ANNOUNCEMENT_SELECT = """
    SELECT a.*, p.name AS author_name
    FROM announcements a
    LEFT JOIN personnel p ON p.id = a.created_by
"""

def _announcement_dict(row) -> dict:
    d = dict(row._mapping)
    d["audience"] = [] if d.get("audience") in (None, "", "ALL") else d["audience"].split(",")
    d["pinned"] = bool(d.get("pinned"))
    return d

@app.get("/api/announcements")
def list_announcements(limit: Optional[int] = None, user=Depends(verify_session), db: Session = Depends(get_db)):
    """Announcements the signed-in user may see, pinned first, newest first."""
    rows = db.execute(text(ANNOUNCEMENT_SELECT + " ORDER BY a.pinned DESC, a.created_at DESC")).fetchall()
    visible = [
        _announcement_dict(r) for r in rows
        if announcement_visible(r.audience, user.portal_role, user.office)
    ]
    if limit is not None and limit > 0:
        visible = visible[:limit]
    return visible

@app.post("/api/announcements")
def create_announcement(body: AnnouncementIn, request: Request, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    params = _announcement_params(body)
    new_id = str(uuid.uuid4())
    try:
        db.execute(text("""
            INSERT INTO announcements (id, title, body, audience, link_url, pinned, created_by)
            VALUES (:id, :title, :body, :audience, :link_url, :pinned, :created_by)
        """), {**params, "id": new_id, "created_by": user.id})
        db.commit()
    except Exception as e:
        db.rollback()
        raise server_error("Error posting announcement", e)
    row = db.execute(text(ANNOUNCEMENT_SELECT + " WHERE a.id = :id"), {"id": new_id}).fetchone()
    audit(db, "announcement.posted", actor=user, target=params["title"], request=request)
    return {"success": True, "data": _announcement_dict(row)}

@app.put("/api/announcements/{id}")
def update_announcement(id: str, body: AnnouncementIn, request: Request, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    params = _announcement_params(body)
    try:
        result = db.execute(text("""
            UPDATE announcements
            SET title = :title, body = :body, audience = :audience, link_url = :link_url, pinned = :pinned
            WHERE id = :id
        """), {**params, "id": id})
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Announcement not found")
        db.commit()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise server_error("Error updating announcement", e)
    row = db.execute(text(ANNOUNCEMENT_SELECT + " WHERE a.id = :id"), {"id": id}).fetchone()
    audit(db, "announcement.updated", actor=user, target=id, request=request)
    return {"success": True, "data": _announcement_dict(row)}

@app.delete("/api/announcements/{id}")
def delete_announcement(id: str, request: Request, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    try:
        result = db.execute(text("DELETE FROM announcements WHERE id = :id"), {"id": id})
        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail="Announcement not found")
        db.commit()
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise server_error("Error deleting announcement", e)
    audit(db, "announcement.deleted", actor=user, target=id, request=request)
    return {"success": True}

# ─────────────────────────────────────────────
# Trainings Endpoints
# Everyone signed in can see trainings and sign up themselves.
# SuperAdmin and RSSO add, edit and delete trainings and record attendance.
# ─────────────────────────────────────────────
def _require_web_url(value: Optional[str], label: str) -> Optional[str]:
    """Allow only http(s) links, so a saved link can't run script when clicked."""
    if not value or not value.strip():
        return None
    value = value.strip()
    if not value.lower().startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail=f"{label} must start with http:// or https://")
    return value

def _training_params(body: TrainingCreate) -> dict:
    if body.mode not in TRAINING_MODES:
        raise HTTPException(status_code=400, detail="Mode must be in-person, online or hybrid.")
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="Title is required.")
    if body.end_date and body.end_date < body.training_date:
        raise HTTPException(status_code=400, detail="End date cannot be before the start date.")
    return {
        "title": body.title.strip(),
        "training_date": body.training_date,
        "end_date": body.end_date,
        "mode": body.mode,
        "venue": body.venue or None,
        "organizer": body.organizer or None,
        "description": body.description or None,
        "materials_url": _require_web_url(body.materials_url, "Materials link"),
    }

def _training_exists(db: Session, id: str) -> None:
    if not db.execute(text("SELECT id FROM trainings WHERE id = :id"), {"id": id}).fetchone():
        raise HTTPException(status_code=404, detail="Training not found")

@app.get("/api/trainings")
def get_trainings(user=Depends(verify_session), db: Session = Depends(get_db)):
    trainings = [dict(r._mapping) for r in db.execute(
        text("SELECT * FROM trainings ORDER BY training_date DESC, title")
    ).fetchall()]
    attendees = db.execute(text("""
        SELECT ta.training_id, ta.staff_id, ta.attended, p.name, p.office
        FROM training_attendees ta
        JOIN personnel p ON ta.staff_id = p.id
        ORDER BY p.name
    """)).fetchall()
    by_training: dict = {}
    for a in attendees:
        by_training.setdefault(a.training_id, []).append({
            "staff_id": a.staff_id,
            "name": a.name,
            "office": a.office,
            "attended": bool(a.attended),
        })
    for t in trainings:
        t["attendees"] = by_training.get(t["id"], [])
    return trainings

@app.post("/api/trainings")
def add_training(body: TrainingCreate, request: Request, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    params = _training_params(body)
    params.update({"id": str(uuid.uuid4()), "created_by": user.id})
    try:
        db.execute(text("""
            INSERT INTO trainings
            (id, title, training_date, end_date, mode, venue, organizer, description, materials_url, created_by)
            VALUES (:id, :title, :training_date, :end_date, :mode, :venue, :organizer, :description, :materials_url, :created_by)
        """), params)
        db.commit()
        audit(db, "training.added", actor=user, target=params["title"], request=request)
        return {"success": True, "id": params["id"]}
    except Exception as e:
        db.rollback()
        raise server_error("Error creating training", e)

@app.put("/api/trainings/{id}")
def update_training(id: str, body: TrainingCreate, request: Request, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    _training_exists(db, id)
    params = _training_params(body)
    params["id"] = id
    try:
        db.execute(text("""
            UPDATE trainings
            SET title = :title, training_date = :training_date, end_date = :end_date, mode = :mode,
                venue = :venue, organizer = :organizer, description = :description, materials_url = :materials_url
            WHERE id = :id
        """), params)
        db.commit()
        audit(db, "training.updated", actor=user, target=id, request=request)
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise server_error("Error updating training", e)

@app.delete("/api/trainings/{id}")
def delete_training(id: str, request: Request, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    try:
        db.execute(text("DELETE FROM training_attendees WHERE training_id = :id"), {"id": id})
        db.execute(text("DELETE FROM trainings WHERE id = :id"), {"id": id})
        db.commit()
        audit(db, "training.deleted", actor=user, target=id, request=request)
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise server_error("Error deleting training", e)

@app.post("/api/trainings/{id}/register")
def register_for_training(id: str, user=Depends(verify_session), db: Session = Depends(get_db)):
    _training_exists(db, id)
    try:
        db.execute(text("""
            INSERT IGNORE INTO training_attendees (training_id, staff_id) VALUES (:tid, :sid)
        """), {"tid": id, "sid": user.id})
        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise server_error("Error signing up", e)

@app.delete("/api/trainings/{id}/register")
def withdraw_from_training(id: str, user=Depends(verify_session), db: Session = Depends(get_db)):
    try:
        db.execute(text("""
            DELETE FROM training_attendees WHERE training_id = :tid AND staff_id = :sid
        """), {"tid": id, "sid": user.id})
        db.commit()
        return {"success": True}
    except Exception as e:
        db.rollback()
        raise server_error("Error withdrawing", e)

@app.patch("/api/trainings/{id}/attendance/{staff_id}")
def set_training_attendance(id: str, staff_id: str, body: AttendanceUpdate, request: Request, user=Depends(verify_superadmin), db: Session = Depends(get_db)):
    try:
        result = db.execute(text("""
            UPDATE training_attendees SET attended = :attended
            WHERE training_id = :tid AND staff_id = :sid
        """), {"attended": body.attended, "tid": id, "sid": staff_id})
        db.commit()
        if result.rowcount == 0:
            exists = db.execute(text("""
                SELECT 1 FROM training_attendees WHERE training_id = :tid AND staff_id = :sid
            """), {"tid": id, "sid": staff_id}).fetchone()
            if not exists:
                raise HTTPException(status_code=404, detail="This person is not signed up for the training.")
        audit(db, "training.attendance", actor=user, target=f"{id}/{staff_id}", request=request)
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise server_error("Error updating attendance", e)