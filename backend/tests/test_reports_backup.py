"""P2 feature tests: PDF report and JSON backup export/import."""
import os
import pathlib
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    env = pathlib.Path("/app/frontend/.env").read_text()
    m = re.search(r"REACT_APP_BACKEND_URL=(\S+)", env)
    BASE_URL = m.group(1).rstrip("/") if m else ""

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@nakit.app")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin1234!")


@pytest.fixture(scope="module")
def auth():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{BASE_URL}/api/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, r.text
    s.headers.update({"Authorization": f"Bearer {r.json()['token']}"})
    return s


# ------------------ PDF report ------------------
class TestPdfReport:
    def test_pdf_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/reports/pdf")
        assert r.status_code == 401

    def test_pdf_returns_valid_pdf(self, auth):
        r = auth.get(f"{BASE_URL}/api/reports/pdf")
        assert r.status_code == 200, r.text[:200]
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert len(r.content) > 500, "PDF too small"
        assert r.content.startswith(b"%PDF"), "missing PDF magic bytes"
        # Content-Disposition attachment with filename
        cd = r.headers.get("content-disposition", "")
        assert "attachment" in cd and ".pdf" in cd


# ------------------ Backup export ------------------
class TestBackupExport:
    def test_export_requires_auth(self):
        r = requests.get(f"{BASE_URL}/api/backup/export")
        assert r.status_code == 401

    def test_export_shape(self, auth):
        r = auth.get(f"{BASE_URL}/api/backup/export")
        assert r.status_code == 200
        body = r.json()
        assert body["version"] == 1
        assert "exported_at" in body
        assert "data" in body
        d = body["data"]
        for key in ("receivables", "expenses", "bank_accounts", "credit_cards", "todos"):
            assert key in d, f"missing collection {key}"
            assert isinstance(d[key], list)
        # None of the docs should leak _id or user_id
        for key, items in d.items():
            for it in items:
                assert "_id" not in it, f"_id leaked in {key}"
                assert "user_id" not in it, f"user_id leaked in {key}"


# ------------------ Backup import (append + replace + robustness) ------------------
class TestBackupImport:

    def test_import_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/backup/import", json={"data": {}, "replace": False})
        assert r.status_code == 401

    def test_import_append_inserts_records(self, auth):
        # Do NOT rely on exact count deltas — the pytest.ini enforces `-n 2 --dist loadscope`
        # so other test classes may mutate receivables/expenses/todos concurrently.
        # Instead, verify the imported records themselves are visible afterwards.

        payload = {
            "version": 1,
            "replace": False,
            "data": {
                "todos": [
                    {"title": "TEST_backup_todo_1", "priority": "low", "completed": False},
                    {"title": "TEST_backup_todo_2", "priority": "high", "completed": False},
                ],
                "receivables": [
                    {"debtor": "TEST_backup_debtor", "amount": 500, "due_date": "2026-08-01",
                     "currency": "TRY", "status": "pending"},
                ],
                # noise/robustness cases
                "unknown_collection": [{"foo": "bar"}],
                "expenses": "not-a-list",  # invalid, should be skipped
            },
        }
        r = auth.post(f"{BASE_URL}/api/backup/import", json=payload)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["replace"] is False
        ins = body["inserted"]
        assert ins.get("todos") == 2
        assert ins.get("receivables") == 1
        # unknown/invalid must NOT appear
        assert "unknown_collection" not in ins
        assert "expenses" not in ins or ins.get("expenses") == 0

        # verify data actually inserted (search by marker fields, not count deltas)
        after_todos = auth.get(f"{BASE_URL}/api/todos").json()
        after_receivables = auth.get(f"{BASE_URL}/api/receivables").json()
        titles = [t["title"] for t in after_todos]
        assert "TEST_backup_todo_1" in titles and "TEST_backup_todo_2" in titles
        assert any(r.get("debtor") == "TEST_backup_debtor" for r in after_receivables)

    def test_import_replace_wipes_and_reinserts(self, auth):
        # First, add some baseline expenses via append
        auth.post(f"{BASE_URL}/api/backup/import", json={
            "version": 1, "replace": False,
            "data": {"expenses": [
                {"payee": "TEST_pre_replace_A", "amount": 10, "due_date": "2026-07-01",
                 "currency": "TRY", "status": "pending"},
                {"payee": "TEST_pre_replace_B", "amount": 20, "due_date": "2026-07-02",
                 "currency": "TRY", "status": "pending"},
            ]},
        })
        before = auth.get(f"{BASE_URL}/api/expenses").json()
        assert len(before) >= 2

        # Now replace with a single expense
        r = auth.post(f"{BASE_URL}/api/backup/import", json={
            "version": 1, "replace": True,
            "data": {"expenses": [
                {"payee": "TEST_after_replace", "amount": 1, "due_date": "2026-07-01",
                 "currency": "TRY", "status": "pending"},
            ]},
        })
        assert r.status_code == 200
        assert r.json()["replace"] is True
        assert r.json()["inserted"]["expenses"] == 1

        after = auth.get(f"{BASE_URL}/api/expenses").json()
        assert len(after) == 1
        assert after[0]["payee"] == "TEST_after_replace"

    def test_zzz_cleanup(self, auth):
        # remove test-created todos and receivables and expenses left behind
        for kind, endpoint in [("todos", "/api/todos"),
                                ("receivables", "/api/receivables"),
                                ("expenses", "/api/expenses")]:
            items = auth.get(f"{BASE_URL}{endpoint}").json()
            for it in items:
                title = (it.get("title") or it.get("debtor") or it.get("payee") or "")
                if title.startswith("TEST_"):
                    auth.delete(f"{BASE_URL}{endpoint}/{it['id']}")


# ------------------ round-trip: export → import replace = idempotent-ish ------------------
class TestBackupRoundTrip:
    def test_export_then_import_replace(self, auth):
        # export
        exp = auth.get(f"{BASE_URL}/api/backup/export").json()
        # add a marker todo so we can verify replace removes it
        marker = auth.post(f"{BASE_URL}/api/todos", json={"title": "TEST_roundtrip_marker",
                                                          "priority": "low"}).json()
        assert marker["id"]

        # import in replace mode -> marker must disappear
        r = auth.post(f"{BASE_URL}/api/backup/import", json={
            "version": 1, "replace": True, "data": exp["data"],
        })
        assert r.status_code == 200
        assert r.json()["replace"] is True

        todos = auth.get(f"{BASE_URL}/api/todos").json()
        assert all(t["id"] != marker["id"] for t in todos)
        # ensure counts match export
        for coll_key, endpoint in [("todos", "/api/todos"),
                                    ("receivables", "/api/receivables"),
                                    ("expenses", "/api/expenses"),
                                    ("bank_accounts", "/api/bank-accounts"),
                                    ("credit_cards", "/api/credit-cards")]:
            after = auth.get(f"{BASE_URL}{endpoint}").json()
            assert len(after) == len(exp["data"][coll_key]), \
                f"{coll_key} count mismatch: after={len(after)} exported={len(exp['data'][coll_key])}"
