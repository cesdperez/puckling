"""Run the daemon and simulator over a raw pseudo-terminal."""
import os
from pathlib import Path
import pty
import signal
import subprocess
import sys
import termios
import tty


def stop(child):
    if child.poll() is not None:
        return
    try:
        os.killpg(child.pid, signal.SIGTERM)
    except ProcessLookupError:
        child.wait()
        return
    try:
        child.wait(timeout=2)
    except subprocess.TimeoutExpired:
        os.killpg(child.pid, signal.SIGKILL)
        child.wait()


def interrupt(signum, frame):
    raise KeyboardInterrupt


def main():
    signal.signal(signal.SIGTERM, interrupt)
    root = Path(__file__).resolve().parent.parent
    master, slave = pty.openpty()
    tty.setraw(slave, termios.TCSANOW)
    children = []
    try:
        daemon = subprocess.Popen(
            ["bun", "daemon/main.ts"], cwd=root, stdout=master, start_new_session=True,
        )
        children.append(daemon)
        simulator = subprocess.Popen(
            [str(root / "sim/build/puckling-sim"), "--link", os.ttyname(slave), *sys.argv[1:]],
            cwd=root, start_new_session=True,
        )
        children.append(simulator)
        return simulator.wait()
    except KeyboardInterrupt:
        return 130
    except OSError as error:
        print(error, file=sys.stderr)
        return 1
    finally:
        for child in reversed(children):
            stop(child)
        os.close(master)
        os.close(slave)


if __name__ == "__main__":
    sys.exit(main())
