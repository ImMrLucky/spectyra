#!/usr/bin/env python3
"""
Merge Supabase login JSON + Spectyra org API key / license into ~/.spectyra/desktop/config.json.
Used by setup.sh — matches tools/local-companion desktopSession.saveSupabaseSession shape.

Env (optional): SPECTYRA_ACCOUNT_EMAIL, SPECTYRA_ORG_API_KEY, SPECTYRA_LICENSE_KEY
Stdin: JSON body from Supabase password grant or signup (access_token, refresh_token, expires_in).
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: persist_spectyra_desktop_config.py <config.json path>", file=sys.stderr)
        sys.exit(2)
    cfg_path = Path(os.path.expanduser(sys.argv[1])).resolve()
    login_raw = sys.stdin.read()
    if not login_raw.strip():
        print("Expected Supabase token JSON on stdin", file=sys.stderr)
        sys.exit(1)
    login = json.loads(login_raw)

    cfg: dict = {}
    if cfg_path.exists():
        try:
            cfg = json.loads(cfg_path.read_text(encoding="utf-8"))
        except Exception:
            cfg = {}

    access = login.get("access_token")
    if access:
        ei = int(login.get("expires_in") or 3600)
        cfg["supabaseSession"] = {
            "access_token": access,
            "refresh_token": login.get("refresh_token"),
            "expires_at": int(time.time() * 1000) + ei * 1000 - 30_000,
        }

    email = os.environ.get("SPECTYRA_ACCOUNT_EMAIL", "").strip()
    if email:
        cfg["accountEmail"] = email

    ak = os.environ.get("SPECTYRA_ORG_API_KEY", "").strip()
    if ak:
        cfg["apiKey"] = ak

    lk = os.environ.get("SPECTYRA_LICENSE_KEY", "").strip()
    if lk:
        cfg["licenseKey"] = lk

    cfg_path.parent.mkdir(parents=True, exist_ok=True)
    cfg_path.write_text(json.dumps(cfg, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
