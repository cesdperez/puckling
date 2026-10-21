"""Connect the Orca daemon to the puck's USB serial port on macOS."""
import argparse
import glob
import os
from pathlib import Path
import selectors
import signal
import subprocess
import sys
import termios
import tty


ROOT = Path(__file__).resolve().parent.parent


def stop(child):
    if child.poll() is not None:
        return
    try:
        os.killpg(child.pid, signal.SIGTERM)
        child.wait(timeout=2)
    except subprocess.TimeoutExpired:
        os.killpg(child.pid, signal.SIGKILL)
        child.wait()
    except ProcessLookupError:
        child.wait()


def run(port, command=None):
    device = os.open(port, os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
    child = None
    try:
        tty.setraw(device, termios.TCSANOW)
        settings = termios.tcgetattr(device)
        settings[2] |= termios.CLOCAL | termios.CREAD
        settings[4] = settings[5] = termios.B115200
        termios.tcsetattr(device, termios.TCSANOW, settings)
        termios.tcflush(device, termios.TCIOFLUSH)
        child = subprocess.Popen(
            command or ["bun", "daemon/main.ts"], cwd=ROOT,
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, start_new_session=True,
        )
        print(f"Puck connected: {port}. Ctrl-C stops the live link.", file=sys.stderr, flush=True)
        return bridge(device, child)
    finally:
        if child is not None:
            stop(child)
            child.stdin.close()
            child.stdout.close()
        os.close(device)


def bridge(device, child):
    source = child.stdout.fileno()
    sink = child.stdin.fileno()
    os.set_blocking(source, False)
    os.set_blocking(sink, False)
    pending_device = bytearray()
    pending_daemon = bytearray()
    diagnostic = bytearray()
    with selectors.DefaultSelector() as events:
        events.register(device, selectors.EVENT_READ)
        events.register(source, selectors.EVENT_READ)
        while child.poll() is None:
            events.modify(device, selectors.EVENT_READ | (selectors.EVENT_WRITE if pending_device else 0))
            if pending_daemon and sink not in events.get_map():
                events.register(sink, selectors.EVENT_WRITE)
            elif not pending_daemon and sink in events.get_map():
                events.unregister(sink)
            for key, ready in events.select(timeout=0.5):
                fd = key.fd
                if ready & selectors.EVENT_READ:
                    try:
                        data = os.read(fd, 4096)
                    except BlockingIOError:
                        continue
                    if not data:
                        if fd == device:
                            raise OSError("Puck disconnected. Reconnect it and run make puck-live again.")
                        return child.wait()
                    if fd == device:
                        pending_daemon.extend(data)
                        for byte in data:
                            if byte == 10:
                                line = diagnostic.decode("utf-8", errors="replace").strip()
                                if line and not line.startswith("{"):
                                    print(f"[puck] {line}", file=sys.stderr, flush=True)
                                diagnostic.clear()
                            elif len(diagnostic) < 1024:
                                diagnostic.append(byte)
                    else:
                        pending_device.extend(data)
                    if len(pending_device) > 65536 or len(pending_daemon) > 65536:
                        raise OSError("USB link stalled: pending data exceeded 64 KiB")
                if ready & selectors.EVENT_WRITE:
                    pending = pending_device if fd == device else pending_daemon
                    try:
                        count = os.write(fd, pending)
                        del pending[:count]
                    except BlockingIOError:
                        pass
        return child.returncode


def interrupt(signum, frame):
    raise KeyboardInterrupt


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", help="USB serial device, for example /dev/cu.usbmodem2101")
    args = parser.parse_args()
    port = args.port
    if port is None:
        ports = sorted(glob.glob("/dev/cu.usbmodem*"))
        if len(ports) != 1:
            parser.error("Expected one USB puck. Use --port to select a device. Found: " + (", ".join(ports) or "none"))
        port = ports[0]
    signal.signal(signal.SIGTERM, interrupt)
    try:
        return run(port)
    except KeyboardInterrupt:
        return 130
    except (OSError, termios.error) as error:
        print(error, file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
