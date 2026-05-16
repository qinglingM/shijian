"""Supabase migrations smoke test.

Reads VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from web/.env.local
and counts rows in every expected table.
"""

import os
import sys
import urllib.parse
import urllib.request
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / "web" / ".env.local"


def load_env():
    env = {}
    if not ENV_FILE.exists():
        print(f"missing env file: {ENV_FILE}")
        sys.exit(1)
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


TABLES = [
    "cities",
    "districts",
    "categories",
    "titles",
    "profiles",
    "restaurants",
    "practice_records",
    "dishes",
    "dish_reviews",
    "marks",
    "bole_records",
    "review_votes",
    "good_review_guidance_feedbacks",
    "user_titles",
    "restaurant_aliases",
    "dish_aliases",
    "image_assets",
]


def count(url, key, table):
    """Use PostgREST count-only request: prefer count=exact, head request."""
    req_url = f"{url}/rest/v1/{table}?select=*"
    req = urllib.request.Request(
        req_url,
        method="HEAD",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Prefer": "count=exact",
            "Range-Unit": "items",
            "Range": "0-0",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            content_range = r.headers.get("Content-Range", "")
            # format: "0-0/N" or "*/N" or "*/0"
            if "/" in content_range:
                total = content_range.split("/")[-1]
                return ("OK", total)
            return ("OK", "?")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        return ("FAIL", f"HTTP {e.code}: {body[:120]}")
    except Exception as e:
        return ("FAIL", str(e))


def main():
    env = load_env()
    url = env.get("VITE_SUPABASE_URL", "").rstrip("/")
    key = env.get("VITE_SUPABASE_ANON_KEY", "")
    if not url or not key:
        print("VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing in web/.env.local")
        sys.exit(1)
    print(f"Project: {url}")
    print("-" * 60)
    ok = 0
    fail = 0
    for t in TABLES:
        status, info = count(url, key, t)
        if status == "OK":
            ok += 1
            print(f"  [OK]   {t:<40} rows={info}")
        else:
            fail += 1
            print(f"  [FAIL] {t:<40} {info}")
    print("-" * 60)
    print(f"Summary: {ok} ok, {fail} fail")
    sys.exit(0 if fail == 0 else 2)


if __name__ == "__main__":
    main()
