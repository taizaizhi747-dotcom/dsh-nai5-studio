#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Standalone comic page stitcher & vector speech-bubble renderer using Pillow."""
import argparse
import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

COMIC_LAYOUTS = {"4koma", "manga-classic", "vertical-3", "grid-2x2"}


def get_default_font(size: int = 24, font_path: str | None = None):
    candidates = [
        font_path,
        os.environ.get("NAI5_COMIC_FONT"),
        # macOS
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
        # Linux
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Bold.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        # Windows
        r"C:\Windows\Fonts\msyhbd.ttc",
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\arial.ttf",
    ]
    for candidate in candidates:
        if candidate and os.path.isfile(candidate):
            try:
                return ImageFont.truetype(candidate, size)
            except Exception:
                pass
    return ImageFont.load_default()


def render_speech_bubble(draw, text: str, box_x: int, box_y: int, box_w: int, box_h: int, pos: str = "top-right", font=None):
    if not text:
        return
    if font is None:
        font = get_default_font(24)

    max_text_w = min(int(box_w * 0.45), 340)
    lines = []
    for paragraph in str(text).split("\n"):
        line = ""
        for char in paragraph:
            test_line = line + char
            bbox = draw.textbbox((0, 0), test_line, font=font)
            w = bbox[2] - bbox[0]
            if w > max_text_w and line:
                lines.append(line)
                line = char
            else:
                line = test_line
        if line:
            lines.append(line)

    try:
        ref_box = font.getbbox("Ag")
        line_h = max(16, (ref_box[3] - ref_box[1]) + 8)
    except Exception:
        line_h = 32
    text_w = max((draw.textbbox((0, 0), l, font=font)[2] - draw.textbbox((0, 0), l, font=font)[0]) for l in lines) if lines else 0
    text_h = len(lines) * line_h

    pad_x, pad_y = 20, 14
    bw = text_w + pad_x * 2
    bh = text_h + pad_y * 2

    offset = 24
    if pos in ("top-right", "tr"):
        bx = box_x + box_w - bw - offset
        by = box_y + offset
        tail = "bottom-left"
    elif pos in ("top-left", "tl"):
        bx = box_x + offset
        by = box_y + offset
        tail = "bottom-right"
    elif pos in ("bottom-right", "br"):
        bx = box_x + box_w - bw - offset
        by = box_y + box_h - bh - offset - 20
        tail = "bottom-left"
    elif pos in ("bottom-left", "bl"):
        bx = box_x + offset
        by = box_y + box_h - bh - offset - 20
        tail = "bottom-right"
    else:
        bx = box_x + (box_w - bw) // 2
        by = box_y + offset
        tail = "bottom-left"

    radius = max(4, min(bw, bh) // 3)
    draw.rounded_rectangle([bx, by, bx + bw, by + bh], radius=radius, fill=(255, 255, 255), outline=(0, 0, 0), width=3)

    tail_len = 18
    if tail == "bottom-left":
        p1 = (bx + bw * 0.2, by + bh)
        p2 = (bx + bw * 0.4, by + bh)
        p3 = (bx + bw * 0.1, by + bh + tail_len)
    else:
        p1 = (bx + bw * 0.6, by + bh)
        p2 = (bx + bw * 0.8, by + bh)
        p3 = (bx + bw * 0.9, by + bh + tail_len)

    draw.polygon([p1, p2, p3], fill=(255, 255, 255))
    draw.line([p1, p3], fill=(0, 0, 0), width=3)
    draw.line([p2, p3], fill=(0, 0, 0), width=3)
    draw.line([p1, p2], fill=(255, 255, 255), width=5)

    curr_y = by + pad_y
    for l in lines:
        l_box = draw.textbbox((0, 0), l, font=font)
        l_w = l_box[2] - l_box[0]
        curr_x = bx + (bw - l_w) / 2
        draw.text((curr_x, curr_y), l, font=font, fill=(0, 0, 0))
        curr_y += line_h


def stitch_comic_page(
    panel_image_paths,
    layout: str = "4koma",
    out_path: str = "comic_page.png",
    page_w: int = 1600,
    margin: int = 40,
    gutter: int = 16,
    border: int = 2,
    dialogues=None,
    font_path: str | None = None,
    font_size: int = 24,
) -> Path:
    paths = [Path(p).resolve() for p in panel_image_paths]
    for p in paths:
        if not p.is_file():
            raise ValueError(f"panel image not found: {p}")

    layout = layout.lower()
    if layout not in COMIC_LAYOUTS:
        raise ValueError(f"unknown layout: {layout}, allowed: {', '.join(sorted(COMIC_LAYOUTS))}")

    expected_counts = {
        "4koma": 4,
        "vertical-3": 3,
        "grid-2x2": 4,
        "manga-classic": 4,
    }
    if len(paths) != expected_counts[layout]:
        raise ValueError(f"layout '{layout}' requires exactly {expected_counts[layout]} panels, but {len(paths)} were provided")

    images = [Image.open(p).convert("RGB") for p in paths]
    panel_boxes = []

    def fit(img, box_w, box_h):
        scale = min(box_w / img.width, box_h / img.height)
        new_size = (max(1, int(img.width * scale)), max(1, int(img.height * scale)))
        return img.resize(new_size, Image.Resampling.LANCZOS)

    if layout in ("4koma", "vertical-3"):
        n = len(images)
        cell_w = page_w - 2 * margin
        aspect = images[0].height / images[0].width
        row_h = int(cell_w * aspect)
        page_h = 2 * margin + n * row_h + (n - 1) * gutter
        canvas = Image.new("RGB", (page_w, page_h), "white")
        draw = ImageDraw.Draw(canvas)
        y = margin
        for img in images:
            fitted = fit(img, cell_w, row_h)
            ox = margin + (cell_w - fitted.width) // 2
            oy = y + (row_h - fitted.height) // 2
            canvas.paste(fitted, (ox, oy))
            panel_boxes.append((ox, oy, fitted.width, fitted.height))
            if border > 0:
                draw.rectangle([ox - border, oy - border, ox + fitted.width + border - 1, oy + fitted.height + border - 1], outline=(0, 0, 0), width=border)
            y += row_h + gutter
    elif layout == "grid-2x2":
        cols, rows = 2, 2
        cell_w = (page_w - 2 * margin - gutter) // 2
        aspect = images[0].height / images[0].width
        cell_h = int(cell_w * aspect)
        page_h = 2 * margin + rows * cell_h + gutter
        canvas = Image.new("RGB", (page_w, page_h), "white")
        draw = ImageDraw.Draw(canvas)
        for idx, img in enumerate(images[:4]):
            r, c = divmod(idx, cols)
            x = margin + c * (cell_w + gutter)
            y = margin + r * (cell_h + gutter)
            fitted = fit(img, cell_w, cell_h)
            ox = x + (cell_w - fitted.width) // 2
            oy = y + (cell_h - fitted.height) // 2
            canvas.paste(fitted, (ox, oy))
            panel_boxes.append((ox, oy, fitted.width, fitted.height))
            if border > 0:
                draw.rectangle([ox - border, oy - border, ox + fitted.width + border - 1, oy + fitted.height + border - 1], outline=(0, 0, 0), width=border)
    else:  # manga-classic
        row_specs = [([images[0]], 1), ([images[1], images[2]], 2), ([images[3]], 1)]
        row_heights = []
        for p_imgs, cols in row_specs:
            cell_w = (page_w - 2 * margin - (cols - 1) * gutter) // cols
            h_candidates = [int(cell_w * im.height / im.width) for im in p_imgs]
            row_heights.append(min(h_candidates) if cols > 1 else h_candidates[0])
        page_h = 2 * margin + sum(row_heights) + (len(row_specs) - 1) * gutter
        canvas = Image.new("RGB", (page_w, page_h), "white")
        draw = ImageDraw.Draw(canvas)
        y = margin
        for (p_imgs, cols), rh in zip(row_specs, row_heights):
            cell_w = (page_w - 2 * margin - (cols - 1) * gutter) // cols
            x = margin
            for im in p_imgs:
                fitted = fit(im, cell_w, rh)
                ox = x + (cell_w - fitted.width) // 2
                oy = y + (rh - fitted.height) // 2
                canvas.paste(fitted, (ox, oy))
                panel_boxes.append((ox, oy, fitted.width, fitted.height))
                if border > 0:
                    draw.rectangle([ox - border, oy - border, ox + fitted.width + border - 1, oy + fitted.height + border - 1], outline=(0, 0, 0), width=border)
                x += cell_w + gutter
            y += rh + gutter

    if dialogues:
        bubble_font = get_default_font(size=font_size, font_path=font_path)
        for idx, box in enumerate(panel_boxes):
            if idx < len(dialogues) and dialogues[idx]:
                d_val = dialogues[idx]
                text_str = d_val if isinstance(d_val, str) else d_val.get("text", "")
                pos_str = d_val.get("pos", "top-right" if idx % 2 == 0 else "top-left") if isinstance(d_val, dict) else ("top-right" if idx % 2 == 0 else "top-left")
                render_speech_bubble(draw, text_str, box[0], box[1], box[2], box[3], pos=pos_str, font=bubble_font)

    out = Path(out_path).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(out, format="PNG")
    return out


def main():
    parser = argparse.ArgumentParser(description="Stitch panel PNGs into a manga/comic page.")
    parser.add_argument("--panels", nargs="+", required=True, help="Panel image file paths")
    parser.add_argument("--layout", default="4koma", choices=sorted(COMIC_LAYOUTS))
    parser.add_argument("--out", required=True, help="Output PNG file path")
    parser.add_argument("--dialogues", nargs="*", default=None, help="Optional dialogue lines per panel")
    parser.add_argument("--page-w", type=int, default=1600)
    parser.add_argument("--font-size", type=int, default=24)
    parser.add_argument("--font-path", default=None)
    args = parser.parse_args()

    out = stitch_comic_page(
        args.panels,
        layout=args.layout,
        out_path=args.out,
        page_w=args.page_w,
        dialogues=args.dialogues,
        font_path=args.font_path,
        font_size=args.font_size,
    )
    print(str(out))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        sys.stderr.write(f"Error: {exc}\n")
        sys.exit(1)
