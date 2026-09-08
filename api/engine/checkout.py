"""Email verification and checkout for STL downloads."""

from __future__ import annotations

import os
import random
import secrets
import time
from dataclasses import dataclass, field

CODE_TTL_SECONDS = 600
TOKEN_TTL_SECONDS = 3600
PRICE_CENTS = 2990


@dataclass
class PendingCode:
    code: str
    expires_at: float


@dataclass
class CheckoutSession:
    email: str
    verified: bool = False
    paid: bool = False
    created_at: float = field(default_factory=time.time)
    download_token: str | None = None


_codes: dict[str, PendingCode] = {}
_sessions: dict[str, CheckoutSession] = {}
_tokens: dict[str, float] = {}


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _generate_code() -> str:
    return f"{random.randint(0, 99999):05d}"


def send_verification_code(email: str) -> dict:
    email = _normalize_email(email)
    if not email or "@" not in email or "." not in email.split("@")[-1]:
        raise ValueError("Informe um e-mail válido.")

    code = _generate_code()
    _codes[email] = PendingCode(code=code, expires_at=time.time() + CODE_TTL_SECONDS)

    print(f"[checkout] Verification code for {email}: {code}")

    result: dict = {"ok": True, "message": "Código enviado para seu e-mail."}
    if os.environ.get("CHECKOUT_DEV_MODE", "1") == "1":
        result["dev_code"] = code
    return result


def verify_code(email: str, code: str) -> dict:
    email = _normalize_email(email)
    pending = _codes.get(email)
    if not pending or pending.expires_at < time.time():
        raise ValueError("Código expirado. Solicite um novo.")
    if pending.code != code.strip():
        raise ValueError("Código incorreto.")

    del _codes[email]
    session_id = secrets.token_urlsafe(24)
    _sessions[session_id] = CheckoutSession(email=email, verified=True)

    return {
        "session_id": session_id,
        "price_cents": PRICE_CENTS,
        "currency": "BRL",
    }


def process_payment(session_id: str) -> dict:
    session = _sessions.get(session_id)
    if not session or not session.verified:
        raise ValueError("Sessão inválida ou expirada.")
    if session.paid and session.download_token:
        return {"download_token": session.download_token, "paid": True}

    token = secrets.token_urlsafe(32)
    session.paid = True
    session.download_token = token
    _tokens[token] = time.time() + TOKEN_TTL_SECONDS

    return {"download_token": token, "paid": True}


def _dev_mode() -> bool:
    return os.environ.get("CHECKOUT_DEV_MODE", "1") == "1"


def validate_download_token(token: str | None) -> bool:
    # Local/dev: allow download without checkout (frontend uses "localhost" token).
    if _dev_mode() and (not token or token == "localhost"):
        return True
    if not token:
        return False
    expires = _tokens.get(token)
    if expires is None or expires < time.time():
        return False
    return True
