from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import logging
import uuid
import io
import csv
from datetime import datetime, timezone, timedelta, date
from typing import List, Optional, Literal

import bcrypt
import jwt
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

from reminders import (
    start_scheduler, shutdown_scheduler, send_email, build_reminder_html,
    collect_due_items_for_user, run_daily_reminders,
)

# -------------------- Config --------------------
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24h for convenience
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

app = FastAPI()
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("nakit")


# -------------------- Utils --------------------
def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": now_utc() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Kimlik doğrulaması gerekli")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Geçersiz token")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
        user.pop("_id", None)
        user.pop("password_hash", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Oturum süresi doldu")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Geçersiz token")


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


# -------------------- Models --------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: EmailStr
    name: str
    role: str = "user"


class ReceivableIn(BaseModel):
    debtor: str = Field(min_length=1)
    amount: float
    due_date: str  # ISO date YYYY-MM-DD
    category: Optional[str] = None
    note: Optional[str] = None
    status: Literal["pending", "paid"] = "pending"


class ExpenseIn(BaseModel):
    payee: str = Field(min_length=1)
    amount: float
    due_date: str
    category: Optional[str] = None
    note: Optional[str] = None
    status: Literal["pending", "paid"] = "pending"


class BankAccountIn(BaseModel):
    bank_name: str
    account_name: str
    iban: Optional[str] = None
    balance: float = 0
    currency: str = "TRY"


class CreditCardIn(BaseModel):
    bank_name: str
    card_name: str
    last_four: Optional[str] = None
    credit_limit: float = 0
    current_debt: float = 0
    statement_day: int = Field(ge=1, le=31)
    due_day: int = Field(ge=1, le=31)


class TodoIn(BaseModel):
    title: str = Field(min_length=1)
    description: Optional[str] = None
    due_date: Optional[str] = None
    priority: Literal["low", "medium", "high"] = "medium"
    completed: bool = False


# -------------------- Helpers --------------------
def clean_doc(doc: dict) -> dict:
    if not doc:
        return doc
    doc = dict(doc)
    doc.pop("_id", None)
    doc.pop("user_id", None)
    return doc


def next_credit_due_date(due_day: int, today: Optional[date] = None) -> str:
    today = today or now_utc().date()
    y, m = today.year, today.month
    # try current month
    try:
        candidate = date(y, m, min(due_day, 28))
    except Exception:
        candidate = date(y, m, 28)
    if candidate <= today:
        m += 1
        if m > 12:
            m = 1
            y += 1
        candidate = date(y, m, min(due_day, 28))
    return candidate.isoformat()


# -------------------- Auth endpoints --------------------
@api.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Bu e-posta zaten kayıtlı")
    user_doc = {
        "id": new_id(),
        "email": email,
        "name": payload.name,
        "role": "user",
        "password_hash": hash_password(payload.password),
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_doc["id"], email)
    set_auth_cookie(response, token)
    return {"id": user_doc["id"], "email": email, "name": payload.name, "role": "user", "token": token}


@api.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı")
    token = create_access_token(user["id"], email)
    set_auth_cookie(response, token)
    return {
        "id": user["id"],
        "email": user["email"],
        "name": user["name"],
        "role": user.get("role", "user"),
        "token": token,
    }


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# -------------------- Receivables --------------------
@api.get("/receivables")
async def list_receivables(user: dict = Depends(get_current_user)):
    items = await db.receivables.find({"user_id": user["id"]}).sort("due_date", 1).to_list(1000)
    return [clean_doc(x) for x in items]


@api.post("/receivables")
async def create_receivable(payload: ReceivableIn, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc.update({"id": new_id(), "user_id": user["id"], "created_at": iso(now_utc())})
    await db.receivables.insert_one(doc)
    return clean_doc(doc)


@api.put("/receivables/{item_id}")
async def update_receivable(item_id: str, payload: ReceivableIn, user: dict = Depends(get_current_user)):
    res = await db.receivables.update_one(
        {"id": item_id, "user_id": user["id"]}, {"$set": payload.model_dump()}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Kayıt bulunamadı")
    doc = await db.receivables.find_one({"id": item_id})
    return clean_doc(doc)


@api.delete("/receivables/{item_id}")
async def delete_receivable(item_id: str, user: dict = Depends(get_current_user)):
    res = await db.receivables.delete_one({"id": item_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Kayıt bulunamadı")
    return {"ok": True}


# -------------------- Expenses --------------------
@api.get("/expenses")
async def list_expenses(user: dict = Depends(get_current_user)):
    items = await db.expenses.find({"user_id": user["id"]}).sort("due_date", 1).to_list(1000)
    return [clean_doc(x) for x in items]


@api.post("/expenses")
async def create_expense(payload: ExpenseIn, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc.update({"id": new_id(), "user_id": user["id"], "created_at": iso(now_utc())})
    await db.expenses.insert_one(doc)
    return clean_doc(doc)


@api.put("/expenses/{item_id}")
async def update_expense(item_id: str, payload: ExpenseIn, user: dict = Depends(get_current_user)):
    res = await db.expenses.update_one(
        {"id": item_id, "user_id": user["id"]}, {"$set": payload.model_dump()}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Kayıt bulunamadı")
    doc = await db.expenses.find_one({"id": item_id})
    return clean_doc(doc)


@api.delete("/expenses/{item_id}")
async def delete_expense(item_id: str, user: dict = Depends(get_current_user)):
    res = await db.expenses.delete_one({"id": item_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Kayıt bulunamadı")
    return {"ok": True}


# -------------------- Bank Accounts --------------------
@api.get("/bank-accounts")
async def list_bank_accounts(user: dict = Depends(get_current_user)):
    items = await db.bank_accounts.find({"user_id": user["id"]}).to_list(1000)
    return [clean_doc(x) for x in items]


@api.post("/bank-accounts")
async def create_bank_account(payload: BankAccountIn, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc.update({"id": new_id(), "user_id": user["id"], "created_at": iso(now_utc())})
    await db.bank_accounts.insert_one(doc)
    return clean_doc(doc)


@api.put("/bank-accounts/{item_id}")
async def update_bank_account(item_id: str, payload: BankAccountIn, user: dict = Depends(get_current_user)):
    res = await db.bank_accounts.update_one(
        {"id": item_id, "user_id": user["id"]}, {"$set": payload.model_dump()}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Kayıt bulunamadı")
    doc = await db.bank_accounts.find_one({"id": item_id})
    return clean_doc(doc)


@api.delete("/bank-accounts/{item_id}")
async def delete_bank_account(item_id: str, user: dict = Depends(get_current_user)):
    res = await db.bank_accounts.delete_one({"id": item_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Kayıt bulunamadı")
    return {"ok": True}


# -------------------- Credit Cards --------------------
@api.get("/credit-cards")
async def list_credit_cards(user: dict = Depends(get_current_user)):
    items = await db.credit_cards.find({"user_id": user["id"]}).to_list(1000)
    return [clean_doc(x) for x in items]


@api.post("/credit-cards")
async def create_credit_card(payload: CreditCardIn, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc.update({"id": new_id(), "user_id": user["id"], "created_at": iso(now_utc())})
    await db.credit_cards.insert_one(doc)
    return clean_doc(doc)


@api.put("/credit-cards/{item_id}")
async def update_credit_card(item_id: str, payload: CreditCardIn, user: dict = Depends(get_current_user)):
    res = await db.credit_cards.update_one(
        {"id": item_id, "user_id": user["id"]}, {"$set": payload.model_dump()}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Kayıt bulunamadı")
    doc = await db.credit_cards.find_one({"id": item_id})
    return clean_doc(doc)


@api.delete("/credit-cards/{item_id}")
async def delete_credit_card(item_id: str, user: dict = Depends(get_current_user)):
    res = await db.credit_cards.delete_one({"id": item_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Kayıt bulunamadı")
    return {"ok": True}


# -------------------- Todos --------------------
@api.get("/todos")
async def list_todos(user: dict = Depends(get_current_user)):
    items = await db.todos.find({"user_id": user["id"]}).sort("created_at", -1).to_list(1000)
    return [clean_doc(x) for x in items]


@api.post("/todos")
async def create_todo(payload: TodoIn, user: dict = Depends(get_current_user)):
    doc = payload.model_dump()
    doc.update({"id": new_id(), "user_id": user["id"], "created_at": iso(now_utc())})
    await db.todos.insert_one(doc)
    return clean_doc(doc)


@api.put("/todos/{item_id}")
async def update_todo(item_id: str, payload: TodoIn, user: dict = Depends(get_current_user)):
    res = await db.todos.update_one(
        {"id": item_id, "user_id": user["id"]}, {"$set": payload.model_dump()}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Kayıt bulunamadı")
    doc = await db.todos.find_one({"id": item_id})
    return clean_doc(doc)


@api.delete("/todos/{item_id}")
async def delete_todo(item_id: str, user: dict = Depends(get_current_user)):
    res = await db.todos.delete_one({"id": item_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(404, "Kayıt bulunamadı")
    return {"ok": True}


# -------------------- Dashboard / Analytics / Upcoming / Export --------------------
@api.get("/dashboard/summary")
async def dashboard_summary(user: dict = Depends(get_current_user)):
    uid = user["id"]
    receivables = await db.receivables.find({"user_id": uid}).to_list(2000)
    expenses = await db.expenses.find({"user_id": uid}).to_list(2000)
    banks = await db.bank_accounts.find({"user_id": uid}).to_list(500)
    cards = await db.credit_cards.find({"user_id": uid}).to_list(500)

    total_receivable_pending = sum(r["amount"] for r in receivables if r.get("status") == "pending")
    total_receivable_paid = sum(r["amount"] for r in receivables if r.get("status") == "paid")
    total_expense_pending = sum(e["amount"] for e in expenses if e.get("status") == "pending")
    total_expense_paid = sum(e["amount"] for e in expenses if e.get("status") == "paid")
    total_bank_balance = sum(b.get("balance", 0) for b in banks)
    total_card_debt = sum(c.get("current_debt", 0) for c in cards)
    total_card_limit = sum(c.get("credit_limit", 0) for c in cards)

    net_position = total_bank_balance + total_receivable_pending - total_expense_pending - total_card_debt

    return {
        "total_receivable_pending": total_receivable_pending,
        "total_receivable_paid": total_receivable_paid,
        "total_expense_pending": total_expense_pending,
        "total_expense_paid": total_expense_paid,
        "total_bank_balance": total_bank_balance,
        "total_card_debt": total_card_debt,
        "total_card_limit": total_card_limit,
        "net_position": net_position,
        "counts": {
            "receivables": len(receivables),
            "expenses": len(expenses),
            "banks": len(banks),
            "cards": len(cards),
        },
    }


@api.get("/dashboard/upcoming")
async def upcoming_payments(days: int = 30, user: dict = Depends(get_current_user)):
    uid = user["id"]
    today = now_utc().date()
    horizon = today + timedelta(days=days)
    receivables = await db.receivables.find({"user_id": uid, "status": "pending"}).to_list(1000)
    expenses = await db.expenses.find({"user_id": uid, "status": "pending"}).to_list(1000)
    cards = await db.credit_cards.find({"user_id": uid}).to_list(500)

    items = []
    for r in receivables:
        try:
            dd = date.fromisoformat(r["due_date"])
        except Exception:
            continue
        if dd <= horizon:
            items.append({
                "id": r["id"],
                "type": "receivable",
                "title": r["debtor"],
                "amount": r["amount"],
                "due_date": r["due_date"],
                "category": r.get("category"),
                "days_left": (dd - today).days,
            })
    for e in expenses:
        try:
            dd = date.fromisoformat(e["due_date"])
        except Exception:
            continue
        if dd <= horizon:
            items.append({
                "id": e["id"],
                "type": "expense",
                "title": e["payee"],
                "amount": e["amount"],
                "due_date": e["due_date"],
                "category": e.get("category"),
                "days_left": (dd - today).days,
            })
    for c in cards:
        if c.get("current_debt", 0) <= 0:
            continue
        due = next_credit_due_date(c.get("due_day", 1), today)
        dd = date.fromisoformat(due)
        if dd <= horizon:
            items.append({
                "id": c["id"],
                "type": "credit_card",
                "title": f"{c['bank_name']} - {c['card_name']}",
                "amount": c.get("current_debt", 0),
                "due_date": due,
                "category": "Kredi Kartı",
                "days_left": (dd - today).days,
            })
    items.sort(key=lambda x: x["due_date"])
    return items


@api.get("/analytics/monthly")
async def monthly_analytics(months: int = 6, user: dict = Depends(get_current_user)):
    uid = user["id"]
    today = now_utc().date().replace(day=1)
    buckets = []
    for i in range(months - 1, -1, -1):
        y = today.year
        m = today.month - i
        while m <= 0:
            m += 12
            y -= 1
        buckets.append({"key": f"{y:04d}-{m:02d}", "label": f"{m:02d}/{y}", "receivable": 0.0, "expense": 0.0})

    receivables = await db.receivables.find({"user_id": uid}).to_list(5000)
    expenses = await db.expenses.find({"user_id": uid}).to_list(5000)

    def bump(items, key):
        for it in items:
            try:
                dd = date.fromisoformat(it["due_date"])
            except Exception:
                continue
            k = f"{dd.year:04d}-{dd.month:02d}"
            for b in buckets:
                if b["key"] == k:
                    b[key] += it.get("amount", 0)
                    break

    bump(receivables, "receivable")
    bump(expenses, "expense")
    return buckets


@api.get("/analytics/by-category")
async def category_analytics(kind: Literal["receivable", "expense"] = "expense", user: dict = Depends(get_current_user)):
    uid = user["id"]
    coll = db.expenses if kind == "expense" else db.receivables
    items = await coll.find({"user_id": uid}).to_list(5000)
    agg = {}
    for it in items:
        cat = it.get("category") or "Kategorisiz"
        agg[cat] = agg.get(cat, 0) + it.get("amount", 0)
    return [{"category": k, "amount": v} for k, v in sorted(agg.items(), key=lambda kv: -kv[1])]


@api.get("/export/{kind}")
async def export_csv(kind: str, user: dict = Depends(get_current_user)):
    uid = user["id"]
    mapping = {
        "receivables": (db.receivables, ["debtor", "amount", "due_date", "category", "status", "note"]),
        "expenses": (db.expenses, ["payee", "amount", "due_date", "category", "status", "note"]),
        "bank-accounts": (db.bank_accounts, ["bank_name", "account_name", "iban", "balance", "currency"]),
        "credit-cards": (db.credit_cards, ["bank_name", "card_name", "last_four", "credit_limit", "current_debt", "statement_day", "due_day"]),
        "todos": (db.todos, ["title", "description", "due_date", "priority", "completed"]),
    }
    if kind not in mapping:
        raise HTTPException(404, "Bilinmeyen tür")
    coll, fields = mapping[kind]
    items = await coll.find({"user_id": uid}).to_list(5000)
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(fields)
    for it in items:
        writer.writerow([it.get(f, "") for f in fields])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{kind}.csv"'},
    )


# -------------------- Startup --------------------
@app.on_event("startup")
async def on_start():
    await db.users.create_index("email", unique=True)
    await db.receivables.create_index([("user_id", 1), ("due_date", 1)])
    await db.expenses.create_index([("user_id", 1), ("due_date", 1)])
    await db.bank_accounts.create_index("user_id")
    await db.credit_cards.create_index("user_id")
    await db.todos.create_index("user_id")

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@nakit.app").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "Admin1234!")
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": new_id(),
            "email": admin_email,
            "name": "Yönetici",
            "role": "admin",
            "password_hash": hash_password(admin_password),
            "created_at": iso(now_utc()),
        })
        logger.info(f"Seeded admin: {admin_email}")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_password)}})

    start_scheduler(db)


@app.on_event("shutdown")
async def on_stop():
    shutdown_scheduler()
    client.close()


@api.get("/")
async def root():
    return {"service": "nakit-cashflow", "ok": True}


# -------------------- Notifications --------------------
@api.get("/notifications/status")
async def notif_status(user: dict = Depends(get_current_user)):
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    return {
        "email_enabled": bool(api_key),
        "sender_email": os.environ.get("SENDER_EMAIL", "onboarding@resend.dev"),
        "reminder_days_before": int(os.environ.get("REMINDER_DAYS_BEFORE", "3")),
        "reminder_hour": int(os.environ.get("REMINDER_HOUR", "9")),
    }


@api.post("/notifications/send-test")
async def notif_send_test(user: dict = Depends(get_current_user)):
    api_key = os.environ.get("RESEND_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(400, "RESEND_API_KEY .env dosyasında tanımlı değil")
    days_before = int(os.environ.get("REMINDER_DAYS_BEFORE", "3"))
    items = await collect_due_items_for_user(db, user["id"], days_before)
    if not items:
        sample = [{
            "type": "expense", "title": "Örnek Ödeme", "amount": 1250.0,
            "due_date": date.today().isoformat(), "category": "Fatura", "days_left": 0,
        }]
        html = build_reminder_html(user["name"], sample)
        subject = "Test hatırlatma — Nakit"
    else:
        html = build_reminder_html(user["name"], items)
        subject = f"Yaklaşan {len(items)} ödeme — Nakit"
    try:
        res = await send_email(user["email"], subject, html)
        return {"ok": True, "email": user["email"], "id": res.get("id"), "count": len(items)}
    except Exception as e:
        raise HTTPException(500, f"E-posta gönderilemedi: {e}")


@api.post("/notifications/run-now")
async def notif_run_now(user: dict = Depends(get_current_user)):
    return await run_daily_reminders(db)


app.include_router(api)

frontend_origins = [os.environ.get("FRONTEND_URL", "http://localhost:3000")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=frontend_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
