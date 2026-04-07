#!/usr/bin/env python3
"""
Génère ic_launcher_foreground / ic_launcher_background (adaptive 108dp layers)
et ic_launcher / ic_launcher_round (legacy) à partir d'une source carrée.

Zone sûre adaptive icon (~66dp sur 108dp) : le logo est redimensionné pour
occuper au plus ~54 % du côté du canvas (marge pour masques ronds / squircle).
"""
from __future__ import annotations

import os
import sys

try:
    from PIL import Image
except ImportError:
    print("Installe Pillow : python3 -m pip install Pillow", file=sys.stderr)
    sys.exit(1)

# Bleu nuit proche du fond du logo (fond de couche arrière)
NAVY = (13, 27, 61)

# Densités adaptive : taille en px du canvas 108dp équivalent
ADAPTIVE_SIZES = {
    "mipmap-ldpi": 81,
    "mipmap-mdpi": 108,
    "mipmap-hdpi": 162,
    "mipmap-xhdpi": 216,
    "mipmap-xxhdpi": 324,
    "mipmap-xxxhdpi": 432,
}

# Icônes legacy (launcher API < 26) : dp → mdpi baseline
LEGACY_SIZES = {
    "mipmap-ldpi": 36,
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}

# Part du côté canvas occupée par le logo (reste = marge anti-coupe)
LOGO_FRAC_ADAPTIVE = 0.54
LOGO_FRAC_LEGACY = 0.88

# PWA (manifest) — tailles standard
PWA_SIZES = [192, 512]
APPLE_TOUCH_SIZE = 180

# favicon.ico sizes (multi-resolution)
FAVICON_SIZES = [16, 32, 48]


def make_background(size: int) -> Image.Image:
    return Image.new("RGB", (size, size), NAVY)


def make_foreground(src: Image.Image, size: int, frac: float) -> Image.Image:
    src = src.convert("RGBA")
    w, h = src.size
    target = int(size * frac)
    scale = min(target / w, target / h)
    nw, nh = max(1, int(w * scale)), max(1, int(h * scale))
    resized = src.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    x = (size - nw) // 2
    y = (size - nh) // 2
    canvas.paste(resized, (x, y), resized)
    return canvas


def make_legacy_combined(src: Image.Image, size: int) -> Image.Image:
    """Icône plate pré-API 26 : fond + logo centré (marge pour crop launcher)."""
    bg = make_background(size)
    fg = make_foreground(src, size, LOGO_FRAC_LEGACY)
    bg_rgba = bg.convert("RGBA")
    bg_rgba.paste(fg, (0, 0), fg)
    return bg_rgba.convert("RGB")


def export_pwa_icons(src: Image.Image, public_dir: str) -> None:
    """Exporte les icônes PWA en PNG carrés, sans couper le logo."""
    os.makedirs(public_dir, exist_ok=True)
    # La source est déjà un app icon (avec marge). On conserve le cadrage et on redimensionne.
    src_rgba = src.convert("RGBA")
    for s in PWA_SIZES:
        out = src_rgba.resize((s, s), Image.Resampling.LANCZOS).convert("RGBA")
        out.save(os.path.join(public_dir, f"pwa-icon-{s}x{s}.png"), "PNG", optimize=True)
        out.save(os.path.join(public_dir, f"logo-{s}x{s}.png"), "PNG", optimize=True)


def export_apple_touch_icon(src: Image.Image, public_dir: str) -> None:
    """Exporte apple-touch-icon.png (iOS Safari)."""
    os.makedirs(public_dir, exist_ok=True)
    out = src.convert("RGBA").resize(
        (APPLE_TOUCH_SIZE, APPLE_TOUCH_SIZE), Image.Resampling.LANCZOS
    )
    out.save(os.path.join(public_dir, "apple-touch-icon.png"), "PNG", optimize=True)


def export_favicon(src: Image.Image, public_dir: str) -> None:
    """Exporte favicon.ico multi-tailles."""
    os.makedirs(public_dir, exist_ok=True)
    src_rgba = src.convert("RGBA")
    frames = [
        src_rgba.resize((s, s), Image.Resampling.LANCZOS).convert("RGBA")
        for s in FAVICON_SIZES
    ]
    frames[0].save(
        os.path.join(public_dir, "favicon.ico"),
        format="ICO",
        sizes=[(s, s) for s in FAVICON_SIZES],
    )


def main() -> None:
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src_path = os.path.join(
        root,
        "android/app/src/main/res/drawable-nodpi/bkg_launcher_source.png",
    )
    if not os.path.isfile(src_path):
        print(f"Source introuvable : {src_path}", file=sys.stderr)
        sys.exit(1)

    src = Image.open(src_path)

    res_root = os.path.join(root, "android/app/src/main/res")

    for folder, size in ADAPTIVE_SIZES.items():
        out_dir = os.path.join(res_root, folder)
        os.makedirs(out_dir, exist_ok=True)

        bg = make_background(size)
        fg = make_foreground(src, size, LOGO_FRAC_ADAPTIVE)

        bg.save(os.path.join(out_dir, "ic_launcher_background.png"), "PNG", optimize=True)
        fg.save(os.path.join(out_dir, "ic_launcher_foreground.png"), "PNG", optimize=True)

    # Legacy : même rendu visuel, tailles plus petites
    for folder, leg_size in LEGACY_SIZES.items():
        out_dir = os.path.join(res_root, folder)
        os.makedirs(out_dir, exist_ok=True)
        combined = make_legacy_combined(src, leg_size)
        legacy_path = os.path.join(out_dir, "ic_launcher.png")
        combined.save(legacy_path, "PNG", optimize=True)
        # Même asset pour round (le système applique le masque)
        round_path = os.path.join(out_dir, "ic_launcher_round.png")
        combined.save(round_path, "PNG", optimize=True)

    # PWA icons
    public_dir = os.path.join(root, "public")
    export_pwa_icons(src, public_dir)
    export_apple_touch_icon(src, public_dir)
    export_favicon(src, public_dir)

    print("OK — icônes Android + PWA + favicon + apple-touch-icon exportés.")


if __name__ == "__main__":
    main()
