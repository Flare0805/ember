#!/usr/bin/env python3
"""
One-time setup for Ember's automatic Garmin sync. Run it on your PC with setup-cloud-sync.cmd.

1. Creates your personal sync key (or reuses the one you already have).
2. Saves two GitHub secrets straight from files, without printing them:
     EMBER_SYNC_KEY  - encrypts your health data before it goes online
     GARMIN_TOKENS   - your saved Garmin login (the cloud never sees your password)
3. Starts the first cloud sync and shows the key to type into Ember on your iPhone.
"""
import secrets
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TOKEN_FILE = Path.home() / ".garminconnect" / "garmin_tokens.json"
KEY_FILE = ROOT / "garmin-export" / "cloud-sync-key.txt"  # git-ignored, stays on this PC
ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # no look-alikes such as 0/o or 1/l


def run(args, **kw):
    return subprocess.run(args, text=True, capture_output=True, **kw)


def repo_name():
    url = run(["git", "-C", str(ROOT), "remote", "get-url", "origin"]).stdout.strip()
    name = url.rstrip("/").removesuffix(".git").split("github.com")[-1].lstrip(":/")
    if name.count("/") != 1:
        sys.exit("Could not work out the GitHub repository from 'git remote'.")
    return name


def main():
    if shutil.which("gh") is None:
        sys.exit("The GitHub CLI (gh) is not installed. Install it with: winget install GitHub.cli")
    if run(["gh", "auth", "status"]).returncode != 0:
        sys.exit("Sign in to GitHub first by running:  gh auth login")
    if not TOKEN_FILE.exists():
        sys.exit("There is no saved Garmin login on this PC yet.\nRun sync-garmin.cmd once, sign in, then run this setup again.")

    repo = repo_name()
    print(f"Setting up automatic Garmin sync for github.com/{repo}\n")

    if KEY_FILE.exists():
        key = KEY_FILE.read_text(encoding="utf-8").strip()
        print("Reusing your existing sync key, so your phone keeps working.")
    else:
        raw = "".join(secrets.choice(ALPHABET) for _ in range(20))
        key = "-".join(raw[i:i + 4] for i in range(0, 20, 4))
        KEY_FILE.parent.mkdir(exist_ok=True)
        KEY_FILE.write_text(key + "\n", encoding="utf-8")

    for name, value in (("EMBER_SYNC_KEY", key), ("GARMIN_TOKENS", TOKEN_FILE.read_text(encoding="utf-8"))):
        r = run(["gh", "secret", "set", name, "--repo", repo], input=value)
        if r.returncode != 0:
            sys.exit(f"Could not save the {name} secret: {r.stderr.strip()}")
        print(f"  saved GitHub secret {name}")

    # The cloud now owns this Garmin login. Move the PC copy aside so the two never renew the same one.
    TOKEN_FILE.replace(TOKEN_FILE.with_name("garmin_tokens.moved-to-cloud.json"))
    print("  this PC's Garmin login now lives in the cloud (sync-garmin.cmd will ask you to sign in if you use it)")

    r = run(["gh", "workflow", "run", "garmin-sync.yml", "--repo", repo])
    print("  started the first cloud sync (it takes a few minutes)" if r.returncode == 0 else f"  could not start the first sync: {r.stderr.strip()}")

    print("\n" + "=" * 46)
    print("  YOUR SYNC KEY:   " + key)
    print("=" * 46)
    print("\nOn your iPhone open Ember > Settings > Garmin sync and type this key once.")
    print("It is also saved on this PC in garmin-export\\cloud-sync-key.txt")
    print("Keep it private: anyone with the key could read your health data.")


if __name__ == "__main__":
    main()
