"""Read-only live metadata check. Prints counts/schema only and never focuses a session."""
import json
import os
from pathlib import Path
import plistlib
import subprocess

ROOT = Path(__file__).resolve().parents[1]
cli = os.environ.get("ORCA_CLI_COMMAND", "orca")
state = subprocess.run(["bun", "daemon/main.ts", "--once"], cwd=ROOT, capture_output=True, text=True, check=True, timeout=15)
snapshot = json.loads(state.stdout)
assert snapshot["version"] == 2 and snapshot["connected"], "Live Orca metadata unavailable"
terminals = json.loads(subprocess.run([cli, "terminal", "list", "--limit", "10000", "--json"], capture_output=True, text=True, check=True, timeout=15).stdout)
assert terminals["ok"] and terminals["result"]["truncated"] is False
assert not terminals["result"]["hostScope"]["omittedHostIds"]
info = Path("/Applications/Orca.app/Contents/Info.plist")
version = plistlib.loads(info.read_bytes()).get("CFBundleShortVersionString") if info.exists() else "unknown"
print(json.dumps({"orcaVersion":version,"protocol":snapshot["version"],"connected":True,
    "recentSessions":snapshot["total"],"windowCards":len(snapshot["sessions"]),"working":snapshot["working"],
    "monitoring":snapshot["monitoring"],"liveTerminals":len(terminals["result"]["terminals"]),
    "navigationExercised":False}, indent=2))
