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
args = sys.argv[1:]
mode = os.environ["PUCKLING_TEST_STATE"]
focus_log = pathlib.Path(os.environ["PUCKLING_TEST_FOCUS_LOG"])
if args == ["terminal", "list", "--limit", "10000", "--json"]:
    print(json.dumps({"ok": True, "result": {
        "truncated": False, "hostScope": {"omittedHostIds": []}, "terminals": [
            {"handle": "term_waiting", "executionHostId": "local", "worktreeId": "fixture",
             "tabId": "tab_1", "leafId": "leaf_1", "connected": True, "orphaned": False},
            {"handle": "term_blocked", "executionHostId": "local", "worktreeId": "fixture",
             "tabId": "tab_2", "leafId": "leaf_2", "connected": True, "orphaned": False},
        ],
    }}))
    sys.exit(0)
if args[:2] == ["terminal", "switch"]:
    assert args == ["terminal", "switch", "--terminal", "term_waiting", "--json"]
    focus_log.write_text("term_waiting")
    print(json.dumps({"ok": True, "result": {"focus": {"navigated": True}}}))
    sys.exit(0)
assert args == ["worktree", "ps", "--limit", "10000", "--json"]
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
agents = [{"paneKey": f"tab_{i}:leaf_{i}", "state": state, "stateStartedAt": i * 100} for i, state in enumerate(states)]
print(json.dumps({"ok": True, "result": {
    "worktrees": [{"hostId": "local", "worktreeId": "fixture", "agents": agents}],
    "truncated": False, "hostScope": {"omittedHostIds": []},
}}))
''')
        cli.chmod(0o700)
        for state in ["idle", "working", "needs_me", "just_finished", "unavailable"]:
            screenshot = output / f"{state}.png"
            screenshot.unlink(missing_ok=True)
            focus_log = directory / f"{state}-focus"
            process = subprocess.Popen(
                [sys.executable, "sim/live.py", "--screenshot", str(screenshot), "--capture-after", "2.7", "--tap-after", "1"],
                cwd=root,
                env={**os.environ, "ORCA_CLI_COMMAND": str(cli), "PUCKLING_TEST_STATE": state,
                     "PUCKLING_TEST_COUNTER": str(directory / state), "PUCKLING_TEST_FOCUS_LOG": str(focus_log)},
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
            if state == "needs_me":
                assert "tap action=focus" in stdout
                assert "Focused waiting session" in stderr, stderr
                assert focus_log.read_text() == "term_waiting"
            else:
                assert not focus_log.exists(), "A tap outside needs_me must only pet the creature"
            print(f"PASS {state}: daemon -> PTY -> simulator -> {screenshot.relative_to(root)}", flush=True)


if __name__ == "__main__":
    main()
