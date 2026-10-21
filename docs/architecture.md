# Architecture

```
 Claude Code transcripts ─┐
 Codex sessions ──────────┤                         ┌──────────────┐
 orca worktree ps --json ─┼──> daemon (Mac) <──────>│ puck firmware │
 orca terminal ... ───────┘    owns all state  link └──────────────┘
                                                    renders, sends input
```

## Rules

- **The daemon owns state.** The creature, agent list and everything else live on the Mac. The puck renders what it receives and reports input events. This keeps firmware small and lets most changes ship without a reflash.
- **The creature can be rebuilt from history.** Its state derives from the token log plus a few stored choices (name, seed). If the state file is lost, replay the transcripts.
- **The protocol is small JSON messages.** Daemon to puck: `state` snapshots. Puck to daemon: `input` events (`tap`, `long_press`, `turn` with degrees, `swipe`, `shake`). Version every message.

## Decisions

- **UI is reviewed on the Mac before it is flashed.** Three stages:
  1. Clickable HTML mockups on a 466x466 round canvas to pick a direction. Throwaway code, limited to what LVGL can draw on this chip (flat shapes, arcs, sprites, simple tweens).
  2. The simulator in `sim/`: the firmware's drawing and world code compiled for macOS against a small Arduino and Arduino_GFX shim, shown with raylib. Mouse and keys stand in for touch and the IMU. The real daemon drives it over a raw pseudo-terminal created by `sim/live.py`, using Python's standard library. Approval happens here.
  3. Flash approved builds only. Check on the device what the simulator cannot show: AMOLED color, touch and IMU feel, frame rate.

  Reason: design iteration is minutes in a browser and slow on hardware. The simulator runs the same C code as the puck, so what gets approved is what gets flashed. Only hardware access (`display.cpp`, `sensors.cpp`) stays out of the simulator, so keep drawing and behaviour out of those files. Full ESP32-S3 emulators (Wokwi, Espressif QEMU) were rejected because neither emulates the CO5300 display or CST9217 touch.

- **The first link is USB serial.** The puck sits on the desk plugged in, so no pairing or credentials are needed. The simulator validates the state protocol over a pseudo-terminal. The physical puck uses the same protocol over USB Serial/JTAG, with a Python standard-library bridge to the daemon. Firmware reads snapshots, applies the shared expressions, and reports touch events. Wi-Fi remains a later option for battery use.

- **Firmware uses PlatformIO with Arduino-ESP32.** It matches the board examples and the working firmware. ESP-IDF is an option if the Arduino framework reaches a limit.

- **The MVP keeps raw Arduino_GFX.** The existing renderer supports the procedural pet and all four session expressions, and the simulator compiles it unchanged. LVGL can be reconsidered when widgets or navigation need it.

- **The daemon uses Bun/TypeScript.** JSON parsing, subprocess polling, and tests need no package dependencies. Swift can be reconsidered for a native Mac interface.
