"""Exercise the daemon, pseudo-terminal and rendered simulator with synthetic Orca replies."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def main():
    root = Path(__file__).resolve().parent.parent
    output = root / "sim/build/validation"
    output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="puckling-validation-") as directory:
        directory = Path(directory)
        cli = directory / "orca-fixture"
        cli.write_text(f"#!{sys.executable}\n" + '''
import json, os, pathlib, sys
assert sys.argv[1:] == ["worktree", "ps", "--limit", "10000", "--json"]
mode = os.environ["PUCKLING_TEST_STATE"]
if mode == "unavailable":
    sys.exit(1)
counter = pathlib.Path(os.environ["PUCKLING_TEST_COUNTER"])
poll = int(counter.read_text()) if counter.exists() else 0
counter.write_text(str(poll + 1))
states = {
    "idle": ["done"],
    "working": ["working"],
    "needs_me": ["working", "waiting", "blocked"],
    "just_finished": ["working" if poll == 0 else "done", "working"],
}[mode]
agents = [{"paneKey": str(i), "state": state} for i, state in enumerate(states)]
print(json.dumps({"ok": True, "result": {
    "worktrees": [{"hostId": "local", "worktreeId": "fixture", "agents": agents}],
    "truncated": False, "hostScope": {"omittedHostIds": []},
}}))
''')
        cli.chmod(0o700)
        for state in ["idle", "working", "needs_me", "just_finished", "unavailable"]:
            screenshot = output / f"{state}.png"
            screenshot.unlink(missing_ok=True)
            process = subprocess.Popen(
                [sys.executable, "sim/live.py", "--screenshot", str(screenshot), "--capture-after", "2.7"],
                cwd=root,
                env={**os.environ, "ORCA_CLI_COMMAND": str(cli), "PUCKLING_TEST_STATE": state,
                     "PUCKLING_TEST_COUNTER": str(directory / state)},
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            )
            try:
                stdout, stderr = process.communicate(timeout=20)
            except (subprocess.TimeoutExpired, KeyboardInterrupt):
                process.terminate()
                process.communicate(timeout=5)
                raise
            (output / f"{state}.log").write_text(stdout + stderr)
            expected = f"session state={state} source=connected"
            if state == "unavailable":
                expected = "session state=idle source=unavailable"
            assert process.returncode == 0, stdout + stderr
            assert expected in stdout, stdout + stderr
            assert screenshot.exists() and screenshot.stat().st_size > 1000
            if state == "just_finished":
                assert stdout.index("session state=working") < stdout.index(expected)
            print(f"PASS {state}: daemon -> PTY -> simulator -> {screenshot.relative_to(root)}", flush=True)


if __name__ == "__main__":
    main()
