"""Patient-token verification (spec §6.1, §8.5).

The main backend signs a short-lived HS256 JWT (5-minute expiry) with the one
shared secret COPILOT_SIGNING_SECRET and hands it to the browser; the Copilot
verifies it here. Claims: sub (patient_id), aud ("aria-copilot"), iat, exp.
"""

from __future__ import annotations

import logging

import jwt

from app.config import Settings

logger = logging.getLogger("aria.copilot.security")


class TokenError(RuntimeError):
    """Raised for any invalid/expired/malformed patient token."""


def verify_patient_token(token: str, settings: Settings) -> str:
    """Returns the patient_id on success; raises TokenError otherwise."""
    if not token or not isinstance(token, str):
        raise TokenError("Missing patient token.")
    try:
        payload = jwt.decode(
            token,
            settings.copilot_signing_secret,
            algorithms=["HS256"],
            audience=settings.copilot_token_audience,
            leeway=10,  # small clock-skew tolerance
            options={"require": ["exp", "sub", "aud"]},
        )
    except jwt.ExpiredSignatureError as error:
        raise TokenError("This link has expired. Please return to your ARIA dashboard and open Ask ARIA again.") from error
    except jwt.InvalidTokenError as error:
        logger.warning("patient token rejected: %s", error)
        raise TokenError("This link is invalid. Please return to your ARIA dashboard and open Ask ARIA again.") from error
    patient_id = str(payload.get("sub") or "").strip()
    if not patient_id:
        raise TokenError("This link is invalid (no patient reference).")
    return patient_id
