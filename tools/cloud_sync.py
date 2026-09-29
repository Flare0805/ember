#!/usr/bin/env python3
"""
Ember cloud sync - runs on GitHub Actions (see .github/workflows/garmin-sync.yml).

Downloads recent Garmin data with a saved Garmin login (never a password), merges it
into data/health.enc.json and encrypts the whole file with your sync key, so the public
repository and website only ever contain unreadable ciphertext. The Ember app on your
phone decrypts it with the same key.

Environment (GitHub secrets):
    EMBER_SYNC_KEY   the sync key you typed into Ember on your phone
    GARMIN_TOKENS    your saved Garmin login (only used when there is no newer one in the cache)

Nothing personal is ever printed: workflow logs of a public repository are public.
"""
import base64
import datetime as dt
import json
import os
import sys
import time
from pathlib import Path
from zoneinfo import ZoneInfo

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

sys.path.insert(0, str(Path(__file__).resolve().parent))
import garmin_sync as gs  # noqa: E402  (reuses day_data and the rate-limit handling)
from garminconnect import Garmin  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "health.enc.json"
CACHE_FILE = ROOT / ".garmin-cache" / "login.enc.json"  # restored/saved by actions/cache
ITERATIONS = 310_000
KEEP_DAYS = 730


def normalize(key):
    """Sync keys are typed on a phone: ignore case, spaces and dashes."""
    return "".join(ch for ch in key.lower() if ch.isalnum())


def derive(key, salt, iterations):
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=iterations)
    return kdf.derive(normalize(key).encode())


def encrypt(obj, key):
    """AES-256-GCM with a PBKDF2-SHA256 key. Same format the Ember app decrypts with WebCrypto."""
    salt, iv = os.urandom(16), os.urandom(12)
    ct = AESGCM(derive(key, salt, ITERATIONS)).encrypt(iv, json.dumps(obj, separators=(",", ":")).encode(), None)
    b64 = lambda b: base64.b64encode(b).decode()  # noqa: E731
    return {"v": 1, "alg": "AES-256-GCM", "kdf": "PBKDF2-SHA256", "iter": ITERATIONS, "salt": b64(salt), "iv": b64(iv), "ct": b64(ct)}


def decrypt(env, key):
    d = base64.b64decode
    plain = AESGCM(derive(key, d(env["salt"]), env.get("iter", ITERATIONS))).decrypt(d(env["iv"]), d(env["ct"]), None)
    return json.loads(plain)


def load_login(key):
    """Newest login from the encrypted cache (Garmin may rotate it), else the GARMIN_TOKENS secret."""
    if CACHE_FILE.exists():
        try:
            return decrypt(json.loads(CACHE_FILE.read_text()), key)["tokens"], "cache"
        except Exception:
            print("Cached login could not be decrypted (sync key changed?). Using the GARMIN_TOKENS secret.")
    tokens = os.environ.get("GARMIN_TOKENS", "").strip()
    if not tokens:
        sys.exit("No Garmin login available. Run setup-cloud-sync.cmd on your PC again.")
    return tokens, "secret"


def main():
    key = os.environ.get("EMBER_SYNC_KEY", "").strip()
    if len(normalize(key)) < 12:
        sys.exit("The EMBER_SYNC_KEY secret is missing or too short. Run setup-cloud-sync.cmd on your PC.")

    tokens, source = load_login(key)
    client = Garmin()
    try:
        client.login(tokens)  # inline JSON: no password, no SSO sign-in; refreshes the token if needed
    except Exception as err:
        if gs.rate_limited(err):
            sys.exit("Garmin is rate limiting this server right now. The next scheduled run will try again.")
        sys.exit("Garmin rejected the saved login (it may have expired). Run setup-cloud-sync.cmd on your PC again.")
    print(f"Signed in with the saved login ({source}).")

    existing = {}
    if DATA.exists():
        try:
            existing = decrypt(json.loads(DATA.read_text()), key).get("days", {})
        except Exception:
            print("The existing data file could not be decrypted (new sync key?). Starting a fresh history.")

    try:  # "today" in your time zone, not the server's
        today = dt.datetime.now(ZoneInfo(os.environ.get("EMBER_TZ", "Europe/Prague"))).date()
    except Exception:  # no time-zone database (e.g. on Windows): fall back to local time
        today = dt.date.today()
    days_back = 7 if existing else 180
    fetched = {}
    try:
        for i in range(days_back):
            day = today - dt.timedelta(days=i)
            data = gs.day_data(client, day)
            if data:
                fetched[day.isoformat()] = data
            time.sleep(0.5)
    except gs.RateLimited:
        print("Garmin started limiting requests; keeping what came through.")

    merged = dict(existing)
    for k, v in fetched.items():
        merged[k] = {**existing.get(k, {}), **v}
    cutoff = (today - dt.timedelta(days=KEEP_DAYS)).isoformat()
    merged = {k: merged[k] for k in sorted(merged) if k >= cutoff}

    changed = merged != existing
    if changed:
        DATA.parent.mkdir(parents=True, exist_ok=True)
        payload = {"type": "ember-health", "source": "garmin-cloud", "syncedAt": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "days": merged}
        DATA.write_text(json.dumps(encrypt(payload, key)))
    print(f"Checked {days_back} days, {len(fetched)} with data. {'Updated' if changed else 'No changes to'} the encrypted file ({len(merged)} days).")

    # Keep the newest login for the next run (Garmin can rotate the refresh token)
    inner = getattr(client, "client", None)
    if inner is not None and hasattr(inner, "dumps"):
        CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
        CACHE_FILE.write_text(json.dumps(encrypt({"tokens": inner.dumps()}, key)))

    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as f:
            f.write(f"changed={'true' if changed else 'false'}\n")


if __name__ == "__main__":
    main()
