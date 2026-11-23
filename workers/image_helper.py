#!/usr/bin/env python3
"""
Cross-platform image processing helper for dsh-nai5-studio.
Provides Pillow-based resizing (stretch / contain_white / cover),
mask normalization or geometric mask synthesis, V4.5 Precise Reference aspect padding,
and PNG/JPG/WebP metadata/dimension inspection.
Uses stdio/file paths so Node >=22 needs zero native image dependencies.
"""

import argparse
import base64
import io
import json
import os
import sys
from PIL import Image, ImageDraw

DIRECTOR_REFERENCE_SIZES = [(1024, 1536), (1472, 1472), (1536, 1024)]


def _load_image_from_args(args):
    if args.input:
        with open(args.input, "rb") as f:
            raw = f.read()
    else:
        raw = sys.stdin.buffer.read()
    return Image.open(io.BytesIO(raw)), raw


def cmd_resize(args):
    img, _ = _load_image_from_args(args)
    target_w = int(args.width)
    target_h = int(args.height)
    mode = args.mode or "stretch"
    img_mode = img.mode

    if args.flatten_white:
        if img_mode in ("RGBA", "LA") or (img_mode == "P" and "transparency" in img.info):
            rgba = img.convert("RGBA")
            bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
            img = Image.alpha_composite(bg, rgba).convert("RGB")
        else:
            img = img.convert("RGB")
    elif args.grayscale:
        img = img.convert("L")
    elif img_mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")

    src_w, src_h = img.size
    if mode == "contain_white":
        scale = min(target_w / max(1, src_w), target_h / max(1, src_h))
        new_w = max(1, int(round(src_w * scale)))
        new_h = max(1, int(round(src_h * scale)))
        resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (target_w, target_h), (255, 255, 255))
        offset_x = (target_w - new_w) // 2
        offset_y = (target_h - new_h) // 2
        if resized.mode == "RGBA":
            canvas.paste(resized, (offset_x, offset_y), resized)
        else:
            canvas.paste(resized.convert("RGB"), (offset_x, offset_y))
        out_img = canvas
    elif mode == "cover":
        scale = max(target_w / max(1, src_w), target_h / max(1, src_h))
        new_w = max(1, int(round(src_w * scale)))
        new_h = max(1, int(round(src_h * scale)))
        resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
        left = max(0, (new_w - target_w) // 2)
        top = max(0, (new_h - target_h) // 2)
        out_img = resized.crop((left, top, left + target_w, top + target_h))
    else:
        if (src_w, src_h) != (target_w, target_h):
            out_img = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
        else:
            out_img = img

    if args.binary_mask:
        out_img = out_img.convert("L").point(lambda p: 255 if p >= 128 else 0, mode="L")

    buf = io.BytesIO()
    out_img.save(buf, format="PNG")
    out_bytes = buf.getvalue()

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "wb") as f:
            f.write(out_bytes)
        print(json.dumps({"ok": True, "width": target_w, "height": target_h, "bytes": len(out_bytes)}))
    else:
        print(json.dumps({
            "ok": True,
            "width": target_w,
            "height": target_h,
            "base64": base64.b64encode(out_bytes).decode("ascii")
        }))


def cmd_rect_mask(args):
    w = int(args.width)
    h = int(args.height)
    regions = json.loads(args.regions or "[]")
    canvas = Image.new("L", (w, h), 0)
    draw = ImageDraw.Draw(canvas)
    for r in regions:
        rx = float(r.get("x", 0))
        ry = float(r.get("y", 0))
        rw = float(r.get("w", r.get("width", 1)))
        rh = float(r.get("h", r.get("height", 1)))
        if 0.0 <= rx <= 1.0 and 0.0 <= ry <= 1.0 and 0.0 < rw <= 1.0 and 0.0 < rh <= 1.0:
            x0 = int(round(rx * w))
            y0 = int(round(ry * h))
            x1 = int(round((rx + rw) * w))
            y1 = int(round((ry + rh) * h))
        else:
            x0 = int(round(rx))
            y0 = int(round(ry))
            x1 = int(round(rx + rw))
            y1 = int(round(ry + rh))
        x0 = max(0, min(w, x0))
        y0 = max(0, min(h, y0))
        x1 = max(x0 + 1, min(w, x1))
        y1 = max(y0 + 1, min(h, y1))
        shape = str(r.get("shape", "rect")).lower()
        if shape == "ellipse":
            draw.ellipse([x0, y0, x1, y1], fill=255)
        else:
            draw.rectangle([x0, y0, x1, y1], fill=255)

    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    out_bytes = buf.getvalue()
    print(json.dumps({
        "ok": True,
        "width": w,
        "height": h,
        "base64": base64.b64encode(out_bytes).decode("ascii")
    }))


def cmd_prepare_ref(args):
    img, _ = _load_image_from_args(args)
    src_w, src_h = img.size
    if src_w <= 0 or src_h <= 0:
        raise ValueError("Invalid reference image dimensions")

    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        rgba = img.convert("RGBA")
        bg = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        img = Image.alpha_composite(bg, rgba).convert("RGB")
    elif img.mode != "RGB":
        img = img.convert("RGB")

    src_aspect = src_w / max(1, src_h)
    target_w, target_h = min(
        DIRECTOR_REFERENCE_SIZES,
        key=lambda sz: abs((sz[0] / sz[1]) - src_aspect),
    )

    scale = min(target_w / src_w, target_h / src_h)
    fit_w = max(1, int(round(src_w * scale)))
    fit_h = max(1, int(round(src_h * scale)))
    resized = img.resize((fit_w, fit_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (target_w, target_h), (255, 255, 255))
    offset_x = (target_w - fit_w) // 2
    offset_y = (target_h - fit_h) // 2
    canvas.paste(resized, (offset_x, offset_y))

    buf = io.BytesIO()
    canvas.save(buf, format="PNG")
    out_bytes = buf.getvalue()
    print(json.dumps({
        "ok": True,
        "width": target_w,
        "height": target_h,
        "srcWidth": src_w,
        "srcHeight": src_h,
        "base64": base64.b64encode(out_bytes).decode("ascii")
    }))


def cmd_inspect(args):
    img, _ = _load_image_from_args(args)
    w, h = img.size
    info = {}
    if isinstance(img.info, dict):
        for k, v in img.info.items():
            if isinstance(v, (str, int, float, bool)):
                info[str(k)] = v
            elif isinstance(v, bytes):
                try:
                    info[str(k)] = v.decode("utf-8", errors="ignore")
                except Exception:
                    pass
    comment_raw = info.get("Comment") or info.get("comment") or ""
    parsed_comment = None
    if isinstance(comment_raw, str) and comment_raw.strip().startswith("{"):
        try:
            parsed_comment = json.loads(comment_raw)
        except Exception:
            parsed_comment = None
    print(json.dumps({
        "ok": True,
        "width": w,
        "height": h,
        "format": img.format,
        "mode": img.mode,
        "text": info,
        "comment": parsed_comment
    }, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description="dsh-nai5-studio Image Helper")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_resize = sub.add_parser("resize")
    p_resize.add_argument("--input", default="")
    p_resize.add_argument("--output", default="")
    p_resize.add_argument("--width", required=True, type=int)
    p_resize.add_argument("--height", required=True, type=int)
    p_resize.add_argument("--mode", default="stretch", choices=["stretch", "contain_white", "cover"])
    p_resize.add_argument("--flatten-white", action="store_true")
    p_resize.add_argument("--grayscale", action="store_true")
    p_resize.add_argument("--binary-mask", action="store_true")
    p_resize.set_defaults(func=cmd_resize)

    p_mask = sub.add_parser("rect-mask")
    p_mask.add_argument("--width", required=True, type=int)
    p_mask.add_argument("--height", required=True, type=int)
    p_mask.add_argument("--regions", required=True)
    p_mask.set_defaults(func=cmd_rect_mask)

    p_inspect = sub.add_parser("inspect")
    p_inspect.add_argument("--input", default="")
    p_inspect.set_defaults(func=cmd_inspect)

    p_prep_ref = sub.add_parser("prepare-ref")
    p_prep_ref.add_argument("--input", default="")
    p_prep_ref.set_defaults(func=cmd_prepare_ref)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
