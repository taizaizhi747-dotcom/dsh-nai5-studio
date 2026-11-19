#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Persistent concurrent JSON-lines stdin/stdout worker for fast WebP thumbnail generation."""
from concurrent.futures import ThreadPoolExecutor
import json
import sys
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from make_thumbnail import make_thumbnail

stdout_lock = threading.Lock()


def write_resp(payload: dict):
    line = json.dumps(payload, ensure_ascii=False) + "\n"
    with stdout_lock:
        sys.stdout.write(line)
        sys.stdout.flush()


def process_job(raw_line: str):
    req_id = None
    try:
        job = json.loads(raw_line)
        req_id = job.get("id")
        src = job["src"]
        dst = job["dst"]
        max_w = int(job.get("maxW", 320))
        ok = bool(make_thumbnail(src, dst, max_w=max_w))
        resp = {"id": req_id, "ok": ok}
    except Exception as exc:
        resp = {"id": req_id, "ok": False, "error": str(exc)}
    write_resp(resp)


def main():
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    with ThreadPoolExecutor(max_workers=4) as pool:
        for raw in sys.stdin:
            line = raw.strip()
            if not line:
                continue
            pool.submit(process_job, line)


if __name__ == "__main__":
    main()
