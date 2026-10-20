# Architecture

```
 Claude Code transcripts ─┐
 Codex sessions ──────────┤                         ┌──────────────┐
 orca worktree ps --json ─┼──> daemon (Mac) <──────>│ puck firmware │
 orca terminal ... ───────┘    owns all state  link └──────────────┘
                                                    renders, sends input
```

## Rules

- **The daemon owns state.** The pet, agent list and everything else live on the Mac. The puck renders what it receives and reports input events. This keeps firmware small and lets most changes ship without a reflash.
- **The pet can be rebuilt from history.** Pet state derives from the token log plus a few stored choices (name, seed). If the state file is lost, replay the transcripts.
- **The protocol is small JSON messages.** Daemon to puck: `state` snapshots. Puck to daemon: `input` events (`tap`, `long_press`, `turn` with degrees, `swipe`, `shake`). Version every message.

## Decisions

- **UI is reviewed on the Mac before it is flashed.** Three stages:
  1. Clickable HTML mockups on a 466x466 round canvas to pick a direction. Throwaway code, limited to what LVGL can draw on this chip (flat shapes, arcs, sprites, simple tweens).
  2. The real LVGL screen code built for macOS with SDL, driven by the real daemon over a virtual serial pair (`socat` pty). Approval happens here.
  3. Flash approved builds only. Check on the device what the simulator cannot show: AMOLED color, touch and IMU feel, frame rate.

  Reason: design iteration is minutes in a browser and slow on hardware. The simulator runs the same C code as the puck, so what gets approved is what gets flashed. Full ESP32-S3 emulators (Wokwi, Espressif QEMU) were rejected because neither emulates the CO5300 display or CST9217 touch.

## Open decisions

| Decision | Options | Lean |
|---|---|---|
| Link | USB serial, Wi-Fi WebSocket, BLE | **USB serial** for the POC: the puck sits on the desk plugged in, no pairing or credentials. Wi-Fi WebSocket next, so it works on battery. |
| Firmware framework | Arduino-ESP32 + LVGL 9 (PlatformIO), ESP-IDF + LVGL | **PlatformIO with the Arduino framework.** Builds and flashes from the CLI, matches the Waveshare Arduino examples and TamaPoke. Move to ESP-IDF only if we hit a limit. |
| Graphics | LVGL, raw Arduino_GFX | **LVGL** for widgets and animation. Sprites as LVGL images. |
| Daemon language | Bun/TypeScript, Swift | **Bun/TypeScript.** Fast to write, easy JSON and serial. Swift only if we want a menu bar or notch UI. |
