#!/usr/bin/env python3
"""Apply tools/profile_calls.json to the Lyra bot via the telegram helper.
Agent: Rick"""
import json
import subprocess
import sys
from pathlib import Path

HELPER = Path.home() / "workspace/custom-connectors/custom.telegram-lyra-bot/bin/telegram_lyra_bot.py"
CALLS = Path(__file__).with_name("profile_calls.json")

ok = fail = 0
for call in json.loads(CALLS.read_text()):
    out = subprocess.run(
        ["python3", str(HELPER), "api", call["method"], "--data-stdin"],
        input=json.dumps(call["params"]), capture_output=True, text=True,
    )
    try:
        res = json.loads(out.stdout)
        good = res.get("ok") is True
    except Exception:
        good = False
    lang = call["params"].get("language_code", "default")
    print(("OK " if good else "FAIL ") + call["method"] + " [" + lang + "]")
    if good:
        ok += 1
    else:
        fail += 1
        print(out.stdout[:300], out.stderr[:200])
print(f"done: {ok} ok, {fail} failed")
sys.exit(1 if fail else 0)
