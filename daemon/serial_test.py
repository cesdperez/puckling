import os
from pathlib import Path
import pty
import select
import subprocess
import sys
import time
import unittest


DIRECTORY = Path(__file__).resolve().parent
STATE = b'{"version":2,"type":"state","connected":true,"sessions":[]}\n'
TAP = b'{"version":2,"type":"input","event":"open","id":"1111111111111111","seq":1,"request":1}\n'
RUNNER = """
import signal, sys
from serial import interrupt, run
signal.signal(signal.SIGTERM, interrupt)
try:
    sys.exit(run(sys.argv[1], [sys.executable, '-u', '-c', sys.argv[2]]))
except KeyboardInterrupt:
    sys.exit(130)
except OSError as error:
    print(error, file=sys.stderr)
    sys.exit(1)
"""


class SerialTest(unittest.TestCase):
    def start(self, program):
        master, slave = pty.openpty()
        self.addCleanup(os.close, master)
        self.addCleanup(os.close, slave)
        child = subprocess.Popen(
            [sys.executable, "-u", "-c", RUNNER, os.ttyname(slave), program],
            cwd=DIRECTORY, stderr=subprocess.PIPE,
        )
        self.addCleanup(self.stop, child)
        return master, child

    @staticmethod
    def stop(child):
        if child.poll() is None:
            child.terminate()
            child.wait(timeout=5)
        child.stderr.close()

    def read(self, fd, count):
        result = bytearray()
        deadline = time.monotonic() + 5
        while len(result) < count:
            timeout = deadline - time.monotonic()
            self.assertGreater(timeout, 0, "serial read timed out")
            self.assertTrue(select.select([fd], [], [], timeout)[0], "serial read timed out")
            result.extend(os.read(fd, count - len(result)))
        return bytes(result)

    def test_raw_duplex_transfer_preserves_framing_and_logs_diagnostics(self):
        program = f"""
import sys
sys.stdout.buffer.write({STATE!r})
sys.stdout.buffer.flush()
assert sys.stdin.buffer.readline() == b'fps 60 sensors ok\\n'
assert sys.stdin.buffer.readline() == {TAP!r}
print('tap received', file=sys.stderr)
"""
        master, child = self.start(program)
        self.assertEqual(self.read(master, len(STATE)), STATE)
        os.write(master, b"fps 60 sensors ok\n" + TAP[:12])
        os.write(master, TAP[12:])
        _, logs = child.communicate(timeout=5)
        self.assertEqual(child.returncode, 0, logs.decode())
        self.assertIn(b"[puck] fps 60 sensors ok", logs)
        self.assertIn(b"tap received", logs)

    def test_stopping_the_bridge_stops_its_daemon(self):
        program = "import os, sys, time; print(os.getpid(), file=sys.stderr, flush=True); print('ready', flush=True); time.sleep(60)"
        master, child = self.start(program)
        self.assertEqual(self.read(master, 6), b"ready\n")
        child.terminate()
        _, logs = child.communicate(timeout=5)
        self.assertEqual(child.returncode, 130)
        daemon_pid = next(int(line) for line in logs.splitlines() if line.isdigit())
        with self.assertRaises(ProcessLookupError):
            os.kill(daemon_pid, 0)


if __name__ == "__main__":
    unittest.main()
