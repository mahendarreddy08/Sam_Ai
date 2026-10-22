#!/usr/bin/env python3
"""
Dataset Validation Script for Sam AI Voice Assistant
Checks data/intents.csv for:
- Required column headers (text, intent)
- Total rows (>= 400)
- Count per class (>= 100 each for time, open_site, search, chat)
- No empty / null fields
- No exact duplicates
- Report statistics and class distribution
"""

import csv
import sys
from collections import Counter
from pathlib import Path

DATA_FILE = Path(__file__).parent / "data" / "intents.csv"
EXPECTED_INTENTS = {"time", "open_site", "search", "chat"}
MIN_PER_INTENT = 100

def validate_dataset():
    if not DATA_FILE.exists():
        print(f"Error: Dataset file not found at {DATA_FILE}")
        sys.exit(1)

    print("=" * 60)
    print("Sam AI Voice Assistant — Dataset Validation Report")
    print("=" * 60)

    rows = []
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader, None)
        if header != ["text", "intent"]:
            print(f"FAILED: Invalid header. Expected ['text', 'intent'], got: {header}")
            sys.exit(1)

        for line_no, row in enumerate(reader, start=2):
            if len(row) != 2:
                print(f"FAILED: Line {line_no} has {len(row)} columns instead of 2: {row}")
                sys.exit(1)
            text, intent = row[0].strip(), row[1].strip()
            if not text:
                print(f"FAILED: Empty text at line {line_no}")
                sys.exit(1)
            if not intent:
                print(f"FAILED: Empty intent at line {line_no}")
                sys.exit(1)
            if intent not in EXPECTED_INTENTS:
                print(f"FAILED: Unexpected intent '{intent}' at line {line_no}")
                sys.exit(1)
            rows.append((text, intent, line_no))

    total_rows = len(rows)
    print(f"Total Rows: {total_rows}")

    # Check duplicates
    seen_texts = {}
    duplicates = []
    for text, intent, line_no in rows:
        key = text.lower()
        if key in seen_texts:
            duplicates.append((text, seen_texts[key], line_no))
        else:
            seen_texts[key] = (intent, line_no)

    if duplicates:
        print(f"FAILED: Found {len(duplicates)} exact duplicates:")
        for text, prev, curr in duplicates[:5]:
            print(f"  - '{text}' at line {curr} duplicates line {prev[1]}")
        sys.exit(1)
    else:
        print("Duplicate Check: PASSED (0 exact duplicates found)")

    # Class distribution
    intent_counts = Counter(r[1] for r in rows)
    print("\nClass Distribution:")
    for intent in sorted(EXPECTED_INTENTS):
        count = intent_counts.get(intent, 0)
        status = "PASSED" if count >= MIN_PER_INTENT else f"FAILED (< {MIN_PER_INTENT})"
        pct = (count / total_rows) * 100
        print(f"  - {intent:12s}: {count:4d} rows ({pct:5.1f}%) -> {status}")

    if any(intent_counts.get(i, 0) < MIN_PER_INTENT for i in EXPECTED_INTENTS):
        print("\nFAILED: One or more classes have fewer than 100 rows.")
        sys.exit(1)

    if total_rows < 400:
        print(f"\nFAILED: Total rows ({total_rows}) is under the 400 minimum requirement.")
        sys.exit(1)

    # Display sample rows per intent
    print("\nSample Rows per Intent:")
    for intent in sorted(EXPECTED_INTENTS):
        samples = [r[0] for r in rows if r[1] == intent][:2]
        print(f"  [{intent}]")
        for s in samples:
            print(f"    • \"{s}\"")

    print("\n" + "=" * 60)
    print("ALL DATASET CHECKS PASSED: Dataset is balanced, clean, and valid.")
    print("=" * 60)
    return True

if __name__ == "__main__":
    validate_dataset()
