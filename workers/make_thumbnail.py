#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Fast on-demand and batch WebP thumbnail generator for NovelAI V5 artwork."""
import os
import sys
import threading
from pathlib import Path
from PIL import Image


def make_thumbnail(src_path: str, dst_path: str, max_w: int = 320, quality: int = 82):
    src = Path(src_path)
    dst = Path(dst_path)
    if not src.exists():
        return False
    if dst.exists() and dst.stat().st_size > 0:
        return True
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp_dst = dst.with_name(f"{dst.name}.{os.getpid()}.{threading.get_ident()}.tmp")

    try:
        with Image.open(src) as im:
            w, h = im.size
            if w <= 0 or h <= 0:
                return False
            target_w = min(max_w, w)
            target_h = max(1, int(round(h * (target_w / w))))

            # High-quality LANCZOS downsampling for crisp gallery thumbnails
            thumb = im.resize((target_w, target_h), Image.Resampling.LANCZOS)

            if thumb.mode in ("RGBA", "LA"):
                thumb.save(tmp_dst, "WEBP", quality=quality, method=3)
            else:
                thumb.convert("RGB").save(tmp_dst, "WEBP", quality=quality, method=3)
        os.replace(tmp_dst, dst)
        return True
    except Exception as e:
        try:
            if tmp_dst.exists():
                tmp_dst.unlink()
        except Exception:
            pass
        sys.stderr.write(f"Thumbnail error for {src}: {e}\n")
        return False


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(1)
    src_file = sys.argv[1]
    dst_file = sys.argv[2]
    w_size = int(sys.argv[3]) if len(sys.argv) > 3 else 320
    ok = make_thumbnail(src_file, dst_file, w_size)
    sys.exit(0 if ok else 2)
