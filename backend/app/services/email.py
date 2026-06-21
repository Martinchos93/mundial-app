"""Transactional email via Resend.

If RESEND_API_KEY is empty (local dev), sends are skipped and logged instead of
failing — so the password-reset flow works end-to-end locally without a provider.
"""
import logging

import httpx

from app.config import settings

logger = logging.getLogger("email")

RESEND_ENDPOINT = "https://api.resend.com/emails"


def _send(to: str, subject: str, html: str) -> bool:
    if not settings.RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping email to %s (subject: %s)", to, subject)
        return False
    try:
        resp = httpx.post(
            RESEND_ENDPOINT,
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            json={"from": settings.RESEND_FROM, "to": [to], "subject": subject, "html": html},
            timeout=10.0,
        )
        if resp.status_code >= 400:
            logger.error("Resend error %s sending to %s: %s", resp.status_code, to, resp.text)
            return False
        return True
    except httpx.HTTPError as e:
        logger.error("Resend request failed sending to %s: %s", to, e)
        return False


def send_password_reset(to: str, first_name: str, reset_url: str) -> bool:
    name = first_name or "crack"
    html = f"""\
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937">
  <div style="text-align:center;font-size:40px">🏆</div>
  <h1 style="font-size:20px;text-align:center;margin:8px 0 4px">ProdeGoat</h1>
  <p style="font-size:15px;line-height:1.5">Hola {name}, recibimos un pedido para restablecer tu contraseña.</p>
  <p style="text-align:center;margin:24px 0">
    <a href="{reset_url}" style="background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-weight:600;font-size:15px;display:inline-block">
      Restablecer contraseña
    </a>
  </p>
  <p style="font-size:13px;color:#6b7280;line-height:1.5">
    El link vence en {settings.PASSWORD_RESET_EXPIRE_MINUTES} minutos. Si no pediste esto, ignorá este mail —
    tu contraseña no cambia hasta que entres con el link.
  </p>
  <p style="font-size:12px;color:#9ca3af;word-break:break-all">O pegá este link en tu navegador:<br>{reset_url}</p>
</div>"""
    return _send(to, "Restablecé tu contraseña · ProdeGoat", html)


def send_contact_reply(to: str, name: str, reply: str) -> bool:
    """Reply to a contact-form message. Sent from the no-reply address, so the
    footer tells the user to write back from the platform (this inbox doesn't
    receive)."""
    who = name or "crack"
    body = (reply or "").strip().replace("\n", "<br>")
    html = f"""\
<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f2937">
  <div style="text-align:center;font-size:40px">🏆</div>
  <h1 style="font-size:20px;text-align:center;margin:8px 0 4px">ProdeGoat</h1>
  <p style="font-size:15px;line-height:1.5">Hola {who}, gracias por escribirnos. Te respondemos:</p>
  <div style="background:#f3f4f6;border-radius:10px;padding:14px 16px;font-size:15px;line-height:1.55;white-space:pre-line">{body}</div>
  <p style="font-size:13px;color:#6b7280;line-height:1.5;margin-top:20px">
    📩 Este correo se envía desde una casilla que <b>no recibe respuestas</b>.
    Si necesitás escribirnos de nuevo, hacelo desde la plataforma con el botón
    <b>“?”</b> arriba a la derecha.
  </p>
</div>"""
    return _send(to, "Respuesta de ProdeGoat", html)
