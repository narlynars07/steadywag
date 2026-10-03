#!/usr/bin/env python3
"""Extract numeric lab results from a specialty hospital 'Patient History Report' text dump.

Usage: extract_labs.py <history.txt> <out.json>

Input is `pdftotext -layout` output. Output goes under data/private/ until the
de-identification review is done. Only lab facts are kept: no client name,
phone, address, client ID, or staff initials.
"""
import json
import re
import sys
from datetime import datetime

HEADER = re.compile(r"^\s*(\d{1,2}/\d{1,2}/\d{4})\s+(L|C|TC)\s+\S+\s+(.*)$")
# e.g. "ALT = 59 U/L   10 - 125"  /  "ALT = 133 U/L H   10 - 125"  /  "TRIG = >1000 mg/dL H*"
TEST = re.compile(
    r"^\s+(?P<name>[A-Za-z0-9/%\.\-\(\) ]{1,24}?)\s*=\s*(?P<val>[<>]?\s*[\d,]*\.?\d+)\s*"
    r"(?P<unit>[^\s\d][^\s]*)?\s*(?P<flag>H\*?|L\*?)?\s*(?P<lo>-?\d*\.?\d+)?\s*(?:-\s*(?P<hi>\d*\.?\d+))?\s*$"
)
PANEL = re.compile(r"(Chemistry|Hematology|UA/Microscopy|Lipid|Pancreatic|cPL|Triglyceride|Bile acid|[A-Za-z /]+?) results from", re.I)


def iso(d: str) -> str:
    return datetime.strptime(d, "%m/%d/%Y").strftime("%Y-%m-%d")


def parse(path: str):
    rows, cur = [], None
    for ln in open(path, encoding="utf8"):
        ln = ln.rstrip("\n")
        h = HEADER.match(ln)
        if h:
            cur = None
            if h.group(2) == "L":
                p = PANEL.search(h.group(3))
                cur = {"date": iso(h.group(1)), "panel": (p.group(1).strip() if p else "Lab")}
            continue
        if cur is None:
            continue
        m = TEST.match(ln)
        if not m:
            continue
        val = m.group("val").replace(" ", "").replace(",", "")
        rows.append({
            "date": cur["date"],
            "panel": cur["panel"],
            "test": m.group("name").strip(),
            "value": val,
            "unit": (m.group("unit") or "").strip(),
            "flag": (m.group("flag") or "").strip(),
            "refLow": m.group("lo"),
            "refHigh": m.group("hi"),
        })
    return rows


if __name__ == "__main__":
    rows = parse(sys.argv[1])
    json.dump(rows, open(sys.argv[2], "w"), indent=2)
    print(f"{len(rows)} results across {len({r['date'] for r in rows})} dates")
