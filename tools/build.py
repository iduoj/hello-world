#!/usr/bin/env python3
"""Bundle Cath Lab Atlas into one self-contained HTML file.

  python3 tools/build.py                 -> dist/cath-lab-atlas.html (everything inlined, works offline)
  python3 tools/build.py --artifact OUT  -> page fragment for hosts that wrap content in their own
                                            <html>/<body> (Three.js loaded from cdnjs instead of inlined)
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CDN_THREE = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"


def read(rel):
    return (ROOT / rel).read_text(encoding="utf-8")


def safe_js(src):
    return src.replace("</script", "<\\/script")


def build(artifact=False):
    html = read("index.html")
    title = re.search(r"<title>.*?</title>", html, re.S).group(0)
    fonts = re.search(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^"]*">', html).group(0)
    css = "".join(read(href) for href in re.findall(r'<link rel="stylesheet" href="(css/[^"]+)">', html))
    body = re.search(r"<!-- APP:BEGIN -->(.*?)<!-- APP:END -->", html, re.S).group(1)
    scripts = []
    for src in re.findall(r'<script src="([^"]+)"', html):
        if src.startswith("vendor/three"):
            if artifact:
                scripts.append(f'<script src="{CDN_THREE}"></script>')
            else:
                scripts.append("<script>" + safe_js(read(src)) + "</script>")
        else:
            scripts.append(f"<script>/* {src} */\n" + safe_js(read(src)) + "\n</script>")
    head = "\n".join([
        title,
        '<meta name="claude:viewport-fit-sides" content="cover">' if artifact else "",
        '<link rel="preconnect" href="https://fonts.googleapis.com">',
        fonts,
        "<style>\n" + css + "\n</style>",
    ])
    if artifact:
        return head + "\n" + body + "\n" + "\n".join(scripts) + "\n"
    return ("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
            + head + "\n</head>\n<body>\n" + body + "\n" + "\n".join(scripts) + "\n</body>\n</html>\n")


def main():
    args = sys.argv[1:]
    if args and args[0] == "--artifact":
        out = Path(args[1]) if len(args) > 1 else ROOT / "dist" / "cath-lab-atlas.artifact.html"
        text = build(artifact=True)
    else:
        out = ROOT / "dist" / "cath-lab-atlas.html"
        text = build(artifact=False)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding="utf-8")
    print(f"wrote {out} ({len(text) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
