"""Send the PDF to a printer through CUPS (`lp`), which macOS and Linux both ship."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path


class PrintError(Exception):
    pass


def _lp() -> str:
    lp = shutil.which("lp")
    if lp is None:
        raise PrintError(
            "The `lp` command wasn't found. Printing needs CUPS (built into macOS; on Debian/Raspberry Pi: "
            "`sudo apt install cups-client`). On Windows, open the PDF and print it from there."
        )
    return lp


def list_printers() -> str:
    lpstat = shutil.which("lpstat")
    if lpstat is None:
        raise PrintError("`lpstat` not found; is CUPS installed?")
    result = subprocess.run([lpstat, "-p", "-d"], capture_output=True, text=True)
    return (result.stdout + result.stderr).strip() or "No printers found."


def print_pdf(pdf: Path, printer: str = "", copies: int = 1, options: list[str] | None = None, title: str = "") -> str:
    cmd = [_lp()]
    if printer:
        cmd += ["-d", printer]
    if copies > 1:
        cmd += ["-n", str(copies)]
    if title:
        cmd += ["-t", title]
    for opt in options or []:
        cmd += ["-o", opt]
    cmd.append(str(pdf))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise PrintError(f"lp failed: {(result.stderr or result.stdout).strip()}")
    return result.stdout.strip()  # e.g. "request id is Brother_HL_L2350DW-42 (1 file(s))"
