"""Backend regression + rates/currency feature tests for Nakit app."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to frontend/.env
    import pathlib, re
    env = pathlib.Path("/app/frontend/.env").read_text()
    m = re.search(r"REACT_APP_BACKEND_URL=(\S+)", env)
    BASE_URL = m.group(1).rstrip("/") if m else ""

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@nakit.app")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin1234!")


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def token(api):
    r = api.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "token" in data and data["email"] == ADMIN_EMAIL
    return data["token"]


@pytest.fixture(scope="session")
def auth(api, token):
    api.headers.update({"Authorization": f"Bearer {token}"})
    return api


# ------------------ auth basics (regression) ------------------
class TestAuth:
    def test_me(self, auth):
        r = auth.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL

    def test_me_unauth(self, api):
        r = requests.get(f"{BASE_URL}/api/auth/me")
        assert r.status_code == 401


# ------------------ rates endpoints ------------------
class TestRates:
    def test_get_rates(self, auth):
        r = auth.get(f"{BASE_URL}/api/rates")
        # network may fail — mark degraded but do not skip since backend warmed up on startup
        assert r.status_code in (200, 502), r.text
        if r.status_code == 502:
            pytest.skip("Upstream rates provider unavailable (502) — acceptable degradation")
        doc = r.json()
        assert "rates_to_try" in doc
        rt = doc["rates_to_try"]
        assert rt.get("TRY") == 1.0
        for c in ("USD", "EUR", "XAU", "XAG"):
            assert c in rt, f"missing {c} in rates_to_try"
            assert rt[c] is None or isinstance(rt[c], (int, float))
        # sanity ranges (given Jan 2026 spec: USD~47, EUR~53, XAU/g~6000, XAG/g~90)
        if rt["USD"]:
            assert 10 < rt["USD"] < 200, f"USD/TRY unrealistic: {rt['USD']}"
        if rt["EUR"]:
            assert 10 < rt["EUR"] < 300, f"EUR/TRY unrealistic: {rt['EUR']}"
        if rt["XAU"]:
            assert 500 < rt["XAU"] < 30000, f"XAU/g unrealistic: {rt['XAU']}"
        if rt["XAG"]:
            assert 5 < rt["XAG"] < 500, f"XAG/g unrealistic: {rt['XAG']}"

    def test_refresh_rates(self, auth):
        r = auth.post(f"{BASE_URL}/api/rates/refresh")
        assert r.status_code in (200, 502)
        if r.status_code == 502:
            pytest.skip("Upstream rates provider unavailable — refresh 502")
        doc = r.json()
        assert doc["rates_to_try"]["TRY"] == 1.0
        assert doc.get("fetched_at")

    def test_rates_requires_auth(self, api):
        r = requests.get(f"{BASE_URL}/api/rates")
        assert r.status_code == 401


# ------------------ dashboard summary with currency conversion ------------------
class TestDashboardConversion:
    """Add a 100 USD receivable, verify total_receivable_pending increases by 100 * USD/TRY."""

    created_ids = {"receivable": None, "expense": None, "bank": None}

    def test_currency_receivable_persistence_and_conversion(self, auth):
        # get current rates
        rr = auth.get(f"{BASE_URL}/api/rates")
        if rr.status_code != 200:
            pytest.skip("rates unavailable")
        rates = rr.json().get("rates_to_try", {})
        usd_try = rates.get("USD")
        if not usd_try:
            pytest.skip("USD rate missing")

        # baseline
        r0 = auth.get(f"{BASE_URL}/api/dashboard/summary").json()
        base = r0["total_receivable_pending"]

        # create USD receivable
        payload = {
            "debtor": "TEST_USD_Customer",
            "amount": 100,
            "due_date": "2026-06-01",
            "currency": "USD",
            "status": "pending",
        }
        c = auth.post(f"{BASE_URL}/api/receivables", json=payload)
        assert c.status_code == 200, c.text
        item = c.json()
        assert item["currency"] == "USD"
        assert item["amount"] == 100
        assert "id" in item and "_id" not in item
        TestDashboardConversion.created_ids["receivable"] = item["id"]

        # verify persistence via list
        lst = auth.get(f"{BASE_URL}/api/receivables").json()
        assert any(x["id"] == item["id"] and x.get("currency") == "USD" for x in lst)

        # dashboard reflects the conversion
        r1 = auth.get(f"{BASE_URL}/api/dashboard/summary").json()
        delta = r1["total_receivable_pending"] - base
        expected = 100 * usd_try
        # allow 1% tolerance in case rates shift between calls
        assert abs(delta - expected) / expected < 0.02, (
            f"expected ~{expected}, got delta {delta} (rate={usd_try})"
        )

    def test_currency_expense_eur(self, auth):
        rr = auth.get(f"{BASE_URL}/api/rates")
        if rr.status_code != 200:
            pytest.skip("rates unavailable")
        rates = rr.json().get("rates_to_try", {})
        eur_try = rates.get("EUR")
        if not eur_try:
            pytest.skip("EUR rate missing")

        r0 = auth.get(f"{BASE_URL}/api/dashboard/summary").json()
        base = r0["total_expense_pending"]

        payload = {"payee": "TEST_EUR_Supplier", "amount": 50, "due_date": "2026-06-01",
                   "currency": "EUR", "status": "pending"}
        c = auth.post(f"{BASE_URL}/api/expenses", json=payload)
        assert c.status_code == 200, c.text
        item = c.json()
        assert item["currency"] == "EUR"
        TestDashboardConversion.created_ids["expense"] = item["id"]

        r1 = auth.get(f"{BASE_URL}/api/dashboard/summary").json()
        delta = r1["total_expense_pending"] - base
        expected = 50 * eur_try
        assert abs(delta - expected) / expected < 0.02

    def test_currency_bank_xau(self, auth):
        rr = auth.get(f"{BASE_URL}/api/rates")
        if rr.status_code != 200:
            pytest.skip("rates unavailable")
        rates = rr.json().get("rates_to_try", {})
        xau = rates.get("XAU")
        if not xau:
            pytest.skip("XAU rate missing")

        r0 = auth.get(f"{BASE_URL}/api/dashboard/summary").json()
        base = r0["total_bank_balance"]

        payload = {"bank_name": "TEST_GOLD_BANK", "account_name": "Kasa Altın",
                   "iban": "", "balance": 10, "currency": "XAU"}
        c = auth.post(f"{BASE_URL}/api/bank-accounts", json=payload)
        assert c.status_code == 200, c.text
        item = c.json()
        assert item["currency"] == "XAU"
        TestDashboardConversion.created_ids["bank"] = item["id"]

        r1 = auth.get(f"{BASE_URL}/api/dashboard/summary").json()
        delta = r1["total_bank_balance"] - base
        expected = 10 * xau
        assert abs(delta - expected) / expected < 0.02

    def test_zzz_cleanup(self, auth):
        rid = TestDashboardConversion.created_ids["receivable"]
        eid = TestDashboardConversion.created_ids["expense"]
        bid = TestDashboardConversion.created_ids["bank"]
        if rid:
            assert auth.delete(f"{BASE_URL}/api/receivables/{rid}").status_code == 200
        if eid:
            assert auth.delete(f"{BASE_URL}/api/expenses/{eid}").status_code == 200
        if bid:
            assert auth.delete(f"{BASE_URL}/api/bank-accounts/{bid}").status_code == 200


# ------------------ regression: previously working endpoints ------------------
class TestRegression:
    def test_dashboard_summary_shape(self, auth):
        r = auth.get(f"{BASE_URL}/api/dashboard/summary")
        assert r.status_code == 200
        d = r.json()
        for k in ("total_receivable_pending", "total_expense_pending",
                  "total_bank_balance", "net_position", "counts"):
            assert k in d

    def test_upcoming(self, auth):
        r = auth.get(f"{BASE_URL}/api/dashboard/upcoming?days=30")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_analytics_monthly(self, auth):
        r = auth.get(f"{BASE_URL}/api/analytics/monthly?months=6")
        assert r.status_code == 200
        assert len(r.json()) == 6

    def test_todos_crud(self, auth):
        payload = {"title": "TEST_regression_todo", "priority": "low"}
        c = auth.post(f"{BASE_URL}/api/todos", json=payload)
        assert c.status_code == 200
        tid = c.json()["id"]
        d = auth.delete(f"{BASE_URL}/api/todos/{tid}")
        assert d.status_code == 200

    def test_notifications_status(self, auth):
        r = auth.get(f"{BASE_URL}/api/notifications/status")
        assert r.status_code == 200
        assert "email_enabled" in r.json()

    def test_export_csv(self, auth):
        r = auth.get(f"{BASE_URL}/api/export/receivables")
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
