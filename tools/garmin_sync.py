#!/usr/bin/env python3
"""
Ember <- Garmin Connect: download your own health data into a file Ember can import.

    python tools/garmin_sync.py               # last 30 days (180 on the first run)
    python tools/garmin_sync.py --days 365    # a whole year of history
    python tools/garmin_sync.py --onedrive    # also copy the file to OneDrive\\Ember (for your iPhone)

Your Garmin password is sent only to Garmin. After the first sign-in the login token
is kept in ~/.garminconnect, so you don't have to type it again.

This uses the unofficial `garminconnect` library (pip install garminconnect),
so it can stop working if Garmin changes their website.
"""
import argparse
import datetime as dt
import getpass
import json
import os
import shutil
import sys
import time
from pathlib import Path

try:
    from garminconnect import Garmin
except ImportError:
    sys.exit("The 'garminconnect' package is missing. Run:  pip install garminconnect")

TOKEN_DIR = Path.home() / ".garminconnect"
OUT_DIR = Path(__file__).resolve().parent.parent / "garmin-export"
LATEST = OUT_DIR / "ember-health-latest.json"


def sign_in():
    """Reuse the saved login if there is one; otherwise ask for email, password and a 2FA code if needed."""
    if TOKEN_DIR.exists():
        try:
            client = Garmin()
            client.login(str(TOKEN_DIR))
            return client
        except Exception:
            print("Your saved Garmin login has expired. Please sign in again.")

    email = input("Garmin email: ").strip()
    password = getpass.getpass("Garmin password (not shown while typing): ")
    try:
        client = Garmin(email=email, password=password, return_on_mfa=True)
    except TypeError:  # older library versions
        client = Garmin(email=email, password=password, prompt_mfa=lambda: input("Verification code from Garmin: ").strip())

    result = client.login()
    if isinstance(result, tuple) and result and result[0] == "needs_mfa":
        code = input("Verification code from Garmin (check your email or the Garmin app): ").strip()
        client.resume_login(result[1], code)

    TOKEN_DIR.mkdir(parents=True, exist_ok=True)
    client.garth.dump(str(TOKEN_DIR))
    print("Signed in. Your login is saved on this PC for next time.\n")
    return client


def num(v):
    """A usable positive number, or None (Garmin uses 0, -1 and -2 for 'no data')."""
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    return v if v > 0 else None


def dig(d, *path):
    for key in path:
        if not isinstance(d, dict):
            return None
        d = d.get(key)
    return d


def safe(fn, *args):
    try:
        return fn(*args)
    except Exception:
        return None


def day_data(client, day):
    """Sleep, stress, Body Battery, resting HR, HRV and steps for one calendar day."""
    iso = day.isoformat()
    out = {}

    stats = safe(client.get_stats, iso) or {}
    out["steps"] = num(stats.get("totalSteps"))
    out["rhr"] = num(stats.get("restingHeartRate"))
    out["stress"] = num(stats.get("averageStressLevel"))
    out["bb"] = num(stats.get("bodyBatteryHighestValue"))  # usually the morning charge

    # Garmin files a night's sleep under the date you wake up, which is what Ember expects
    sleep = safe(client.get_sleep_data, iso) or {}
    dto = sleep.get("dailySleepDTO") or {}
    secs = num(dto.get("sleepTimeSeconds"))
    out["sleep"] = secs / 60 if secs else None
    out["sleepScore"] = num(dig(dto, "sleepScores", "overall", "value"))
    if out["rhr"] is None:
        out["rhr"] = num(sleep.get("restingHeartRate"))

    hrv = safe(client.get_hrv_data, iso) or {}
    out["hrv"] = num(dig(hrv, "hrvSummary", "lastNightAvg")) or num(sleep.get("avgOvernightHrv"))

    return {k: round(v) for k, v in out.items() if v is not None}


def main():
    ap = argparse.ArgumentParser(description="Download Garmin health data for Ember.")
    ap.add_argument("--days", type=int, help="How many days back to download (default: 30, or 180 on the first run)")
    ap.add_argument("--onedrive", action="store_true", help="Also copy the file to OneDrive\\Ember so you can import it on your iPhone")
    ap.add_argument("--out", help="Also copy the file to this folder")
    args = ap.parse_args()
    days_back = args.days or (30 if LATEST.exists() else 180)

    client = sign_in()
    today = dt.date.today()
    days = {}
    print(f"Downloading {days_back} days from Garmin Connect. This takes a moment...")
    try:
        for i in range(days_back):
            day = today - dt.timedelta(days=i)
            data = day_data(client, day)
            if data:
                days[day.isoformat()] = data
            print(f"\r  {i + 1}/{days_back}  {day.isoformat()}  ({len(days)} days with data)", end="", flush=True)
            time.sleep(0.25)  # be gentle with Garmin's servers
    except KeyboardInterrupt:
        print("\nStopped. Saving what was downloaded so far.")
    print()

    if not days:
        sys.exit("No data came back from Garmin. Make sure your watch has synced with the Garmin Connect app.")

    payload = {
        "type": "ember-health",
        "version": 1,
        "source": "garmin",
        "exportedAt": dt.datetime.now().isoformat(timespec="seconds"),
        "days": dict(sorted(days.items())),
    }
    OUT_DIR.mkdir(exist_ok=True)
    LATEST.write_text(json.dumps(payload, indent=1), encoding="utf-8")
    shutil.copyfile(LATEST, OUT_DIR / f"ember-health-{today.isoformat()}.json")
    print(f"\nSaved {len(days)} days to:\n  {LATEST}")

    targets = []
    if args.onedrive:
        onedrive = os.environ.get("OneDrive") or os.environ.get("OneDriveConsumer")
        if onedrive and Path(onedrive).exists():
            targets.append(Path(onedrive) / "Ember")
        else:
            print("OneDrive was not found on this PC, so nothing was copied there.")
    if args.out:
        targets.append(Path(args.out))
    for folder in targets:
        folder.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(LATEST, folder / LATEST.name)
        print(f"Copied to:\n  {folder / LATEST.name}")

    print("\nNext: in Ember open Health > Import file and choose ember-health-latest.json")
    if args.onedrive:
        print("On iPhone: Files app > OneDrive > Ember > ember-health-latest.json")


if __name__ == "__main__":
    main()
