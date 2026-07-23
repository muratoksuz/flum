"""FX / precious-metal rates cache + refresh for Nakit."""
import asyncio
import logging
from datetime import datetime, timezone

import requests

logger = logging.getLogger("nakit.rates")

# Public no-key currency + metals API (mirror of fawazahmed0/currency-api).
BASES = [
    "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies",
    "https://latest.currency-api.pages.dev/v1/currencies",
]

TROY_OZ_IN_GRAMS = 31.1034768


def _fetch_usd_rates_sync() -> dict:
    last_err = None
    for base in BASES:
        try:
            r = requests.get(f"{base}/usd.json", timeout=8)
            r.raise_for_status()
            data = r.json()
            usd = data.get("usd") or {}
            if usd.get("try"):
                return {"date": data.get("date"), "usd": usd}
        except Exception as e:
            last_err = e
    raise RuntimeError(f"Kur verisi alınamadı: {last_err}")


async def fetch_and_store_rates(db) -> dict:
    """Fetch live USD-based rates, compute TRY cross-rates + gram gold/silver, upsert into db.rates."""
    data = await asyncio.to_thread(_fetch_usd_rates_sync)
    usd = data["usd"]
    usd_try = float(usd["try"])
    eur_try = usd_try / float(usd["eur"]) if usd.get("eur") else None
    # xau/xag are per troy ounce in USD terms; usd.xau = XAU per 1 USD (very small)
    xau_try_oz = usd_try / float(usd["xau"]) if usd.get("xau") else None
    xag_try_oz = usd_try / float(usd["xag"]) if usd.get("xag") else None
    xau_try_g = xau_try_oz / TROY_OZ_IN_GRAMS if xau_try_oz else None
    xag_try_g = xag_try_oz / TROY_OZ_IN_GRAMS if xag_try_oz else None

    doc = {
        "id": "latest",
        "source_date": data.get("date"),
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "rates_to_try": {
            "TRY": 1.0,
            "USD": usd_try,
            "EUR": eur_try,
            "XAU": xau_try_g,   # gram gold in TRY
            "XAG": xag_try_g,   # gram silver in TRY
        },
    }
    await db.rates.update_one({"id": "latest"}, {"$set": doc}, upsert=True)
    logger.info(f"Rates updated: USD={usd_try:.2f} EUR={eur_try:.2f} XAU/g={xau_try_g:.2f} XAG/g={xag_try_g:.2f}")
    return doc


async def get_cached_rates(db) -> dict | None:
    doc = await db.rates.find_one({"id": "latest"}, {"_id": 0})
    return doc


def convert_to_try(amount: float, currency: str | None, rates_to_try: dict) -> float:
    if amount is None:
        return 0.0
    cur = (currency or "TRY").upper()
    rate = rates_to_try.get(cur)
    if rate is None:
        return float(amount) if cur == "TRY" else 0.0
    return float(amount) * float(rate)
