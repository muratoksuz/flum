"""Resend email + daily reminder scheduler for Nakit app."""
import os
import asyncio
import logging
from datetime import date, timedelta
from typing import Iterable

import resend
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

logger = logging.getLogger("nakit.reminders")


def _fmt_try(amount: float) -> str:
    try:
        return f"{amount:,.2f} ₺".replace(",", "X").replace(".", ",").replace("X", ".")
    except Exception:
        return f"{amount} ₺"


def _tr_date(iso: str) -> str:
    try:
        d = date.fromisoformat(iso)
        return d.strftime("%d/%m/%Y")
    except Exception:
        return iso


def build_reminder_html(user_name: str, items: list[dict]) -> str:
    rows = "".join(
        f"""
        <tr>
          <td style="padding:12px 8px;border-bottom:1px solid #eeeeee;font-family:Arial,sans-serif;font-size:14px;color:#0A0A0A;">
            <strong>{it['title']}</strong><br>
            <span style="color:#737373;font-size:12px;">{it.get('category') or 'Kategorisiz'} · {_tr_date(it['due_date'])}</span>
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid #eeeeee;font-family:Arial,sans-serif;font-size:14px;color:{'#008A5E' if it['type'] == 'receivable' else '#D32F2F'};text-align:right;font-weight:700;">
            {'+' if it['type'] == 'receivable' else '−'} {_fmt_try(it['amount'])}
          </td>
          <td style="padding:12px 8px;border-bottom:1px solid #eeeeee;font-family:Arial,sans-serif;font-size:12px;color:#525252;text-align:right;">
            {('Bugün' if it['days_left'] == 0 else (str(abs(it['days_left'])) + ' gün geçti') if it['days_left'] < 0 else str(it['days_left']) + ' gün')}
          </td>
        </tr>
        """
        for it in items
    )

    return f"""
    <!doctype html>
    <html lang="tr"><body style="margin:0;padding:0;background:#F8F9FA;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FA;padding:32px 0;">
        <tr><td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #D4D4D4;border-radius:4px;">
            <tr><td style="padding:24px 32px;border-bottom:1px solid #E5E5E5;">
              <div style="font-family:Arial,sans-serif;font-size:11px;letter-spacing:0.24em;text-transform:uppercase;color:#737373;">Nakit · Ödeme Hatırlatma</div>
              <div style="font-family:Arial,sans-serif;font-size:22px;font-weight:900;color:#0A0A0A;margin-top:6px;">Yaklaşan ödemeleriniz var</div>
            </td></tr>
            <tr><td style="padding:20px 32px;font-family:Arial,sans-serif;font-size:14px;color:#262626;line-height:1.55;">
              Merhaba <strong>{user_name}</strong>, aşağıdaki hareketler yaklaşıyor:
            </td></tr>
            <tr><td style="padding:0 24px 8px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">{rows}</table>
            </td></tr>
            <tr><td style="padding:20px 32px 28px 32px;font-family:Arial,sans-serif;font-size:12px;color:#737373;">
              Bu e-posta size Nakit uygulaması tarafından gönderildi. Ödeme takibinizi sürdürmek için uygulamayı ziyaret edin.
            </td></tr>
          </table>
        </td></tr>
      </table>
    </body></html>
    """


async def send_email(to_email: str, subject: str, html_content: str) -> dict:
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("RESEND_API_KEY tanımlı değil")
    resend.api_key = api_key
    sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    params = {"from": sender, "to": [to_email], "subject": subject, "html": html_content}
    return await asyncio.to_thread(resend.Emails.send, params)


async def collect_due_items_for_user(db, user_id: str, days_before: int) -> list[dict]:
    today = date.today()
    horizon = today + timedelta(days=days_before)
    receivables = await db.receivables.find({"user_id": user_id, "status": "pending"}).to_list(1000)
    expenses = await db.expenses.find({"user_id": user_id, "status": "pending"}).to_list(1000)
    cards = await db.credit_cards.find({"user_id": user_id}).to_list(500)

    out: list[dict] = []
    for r in receivables:
        try:
            dd = date.fromisoformat(r["due_date"])
        except Exception:
            continue
        if today <= dd <= horizon:
            out.append({
                "type": "receivable", "title": r["debtor"], "amount": r["amount"],
                "due_date": r["due_date"], "category": r.get("category"),
                "days_left": (dd - today).days,
            })
    for e in expenses:
        try:
            dd = date.fromisoformat(e["due_date"])
        except Exception:
            continue
        if today <= dd <= horizon:
            out.append({
                "type": "expense", "title": e["payee"], "amount": e["amount"],
                "due_date": e["due_date"], "category": e.get("category"),
                "days_left": (dd - today).days,
            })
    for c in cards:
        if c.get("current_debt", 0) <= 0:
            continue
        due_day = int(c.get("due_day", 1))
        y, m = today.year, today.month
        try:
            candidate = date(y, m, min(due_day, 28))
        except Exception:
            continue
        if candidate < today:
            m += 1
            if m > 12:
                m = 1; y += 1
            candidate = date(y, m, min(due_day, 28))
        if today <= candidate <= horizon:
            out.append({
                "type": "credit_card",
                "title": f"{c['bank_name']} - {c['card_name']}",
                "amount": c.get("current_debt", 0),
                "due_date": candidate.isoformat(),
                "category": "Kredi Kartı",
                "days_left": (candidate - today).days,
            })
    out.sort(key=lambda x: x["due_date"])
    return out


async def run_daily_reminders(db) -> dict:
    days_before = int(os.environ.get("REMINDER_DAYS_BEFORE", "3"))
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        logger.info("Reminder skipped: RESEND_API_KEY missing")
        return {"sent": 0, "skipped": "no_api_key"}

    sent = 0
    users = await db.users.find({}).to_list(1000)
    for u in users:
        items = await collect_due_items_for_user(db, u["id"], days_before)
        if not items:
            continue
        html = build_reminder_html(u.get("name") or "Kullanıcı", items)
        subject = f"Yaklaşan {len(items)} ödeme — Nakit"
        try:
            await send_email(u["email"], subject, html)
            sent += 1
            logger.info(f"Reminder sent to {u['email']} ({len(items)} items)")
        except Exception as e:
            logger.error(f"Reminder failed for {u['email']}: {e}")
    return {"sent": sent, "users": len(users)}


_scheduler: AsyncIOScheduler | None = None


def start_scheduler(db):
    global _scheduler
    if _scheduler and _scheduler.running:
        return _scheduler
    _scheduler = AsyncIOScheduler(timezone="Europe/Istanbul")
    hour = int(os.environ.get("REMINDER_HOUR", "9"))
    _scheduler.add_job(
        run_daily_reminders, CronTrigger(hour=hour, minute=0),
        args=[db], id="daily_reminders", replace_existing=True,
    )
    _scheduler.start()
    logger.info(f"Reminder scheduler started (daily at {hour:02d}:00 Europe/Istanbul)")
    return _scheduler


def shutdown_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
