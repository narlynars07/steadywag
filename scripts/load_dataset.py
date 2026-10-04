#!/usr/bin/env python3
"""Load data/private/dataset.ndjson into the Steadywag Sanity dataset.

Usage: load_dataset.py [--dry-run]

Stage 1 writes every document with createOrReplace in one transaction (conditions and
lab tests reference each other and Sanity checks references per transaction).
Stage 2 removes documents of our types that are not in the file, for example the earlier
dotted-ID copies that were private to anonymous readers. Sanity will not delete a document
that something still references, so stale documents are removed in dependency order, one
transaction per type. Safe to re-run: stale documents are recomputed each time.

Reads the project key from .env.local and never prints it.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
API_VERSION = "2026-10-01"
# Referencing documents come before the documents they reference.
DELETE_ORDER = ["recordUpdate", "familyNote", "historyPattern", "historyChapter", "historySummary", "careRoutine", "recordGap", "vetQuestion", "dietHistoryEntry", "guidance", "labResult", "weightEntry", "imagingStudy", "flareEpisode", "medication",
                "dietRule", "foodItem", "vetVisit", "dog", "labTest", "condition"]


def load_env():
    env = {}
    for line in (ROOT / ".env.local").read_text().splitlines():
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def curl(args, token, stdin_extra=""):
    # curl uses the system certificate store; the key goes in via stdin config, not argv.
    return subprocess.run(["curl", "-sS", *args, "-K", "-"], input=f'header = "Authorization: Bearer {token}"\n{stdin_extra}',
                          capture_output=True, text=True, timeout=120)


def main():
    dry = "--dry-run" in sys.argv
    env = load_env()
    project = env["NEXT_PUBLIC_SANITY_PROJECT_ID"]
    dataset = env["NEXT_PUBLIC_SANITY_DATASET"]
    token = env["SANITY_API_WRITE_TOKEN"]
    docs = [json.loads(l) for l in (ROOT / "data" / "private" / "dataset.ndjson").read_text().splitlines() if l.strip()]
    mutate_url = f"https://{project}.api.sanity.io/v{API_VERSION}/data/mutate/{dataset}?returnIds=false&visibility=sync" + ("&dryRun=true" if dry else "")
    tmp = ROOT / "data" / "private" / ".batch.json"

    def post(mutations, label):
        tmp.write_text(json.dumps({"mutations": mutations}))
        proc = curl(["-o", "-", "-w", "\n%{http_code}", "-X", "POST", mutate_url, "-H", "Content-Type: application/json", "--data-binary", f"@{tmp}"], token)
        tmp.unlink(missing_ok=True)
        out = proc.stdout.rsplit("\n", 1)
        status = out[-1].strip() if out else ""
        if proc.returncode != 0 or status != "200":
            print(f"FAILED at {label}: curl exit {proc.returncode}, HTTP {status}, {(out[0] if out else '')[:500]} {proc.stderr[:300]}")
            sys.exit(1)
        print(f"{'dry-run ok' if dry else 'done'}: {label}")

    # Stage 1: create or replace everything in the file.
    post([{"createOrReplace": d} for d in docs], f"write {len(docs)} documents")

    # Stage 2: find and remove stale documents of our types.
    new_ids = {d["_id"] for d in docs}
    types = sorted({d["_type"] for d in docs})
    q = "*[_type in [" + ",".join(f'"{t}"' for t in types) + "]]{_id,_type}"
    query_url = f"https://{project}.api.sanity.io/v{API_VERSION}/data/query/{dataset}"
    proc = curl(["-G", query_url, "--data-urlencode", f"query={q}"], token)
    existing = json.loads(proc.stdout)["result"]
    stale = [e for e in existing if e["_id"] not in new_ids and not e["_id"].startswith("drafts.")]
    print(f"existing documents of our types: {len(existing)}; stale to delete: {len(stale)}")
    if dry:
        print("dry run: stale deletions are staged one type at a time and cannot be validated until the earlier stages run.")
        return
    if not stale:
        return
    # Conditions point at lab tests and lab tests point at conditions: clear one direction first.
    conds = [e["_id"] for e in stale if e["_type"] == "condition"]
    if conds:
        post([{"patch": {"id": i, "unset": ["monitoredTests"]}} for i in conds], f"unlink {len(conds)} stale conditions from lab tests")
    for t in DELETE_ORDER:
        ids = [e["_id"] for e in stale if e["_type"] == t]
        if ids:
            post([{"delete": {"id": i}} for i in ids], f"delete {len(ids)} stale {t}")


if __name__ == "__main__":
    main()
