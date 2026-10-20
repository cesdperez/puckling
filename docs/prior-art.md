# Prior art

Projects for this board, and what to take from each. Check the license before copying code.

| Project | Stack | License | Take |
|---|---|---|---|
| [Watt](https://github.com/gizmofalcon/watt-puck) | Arduino-ESP32 3.3, Arduino_GFX, BLE (Nordic UART) to a Mac app | None, binaries only | Product ideas: Claude Code approve/deny face, Mac notch app, turning by dragging round the ring. No code. |
| [dialkit-watt](https://github.com/gizmofalcon/dialkit-watt) | TypeScript | MIT | Pattern for a localhost WebSocket bridge that only accepts `localhost` origins. |
| [TamaPoke](https://github.com/socquique/TamaPoke) | Arduino `.ino`, U8g2, XPowersLib, SensorLib (PCF85063 RTC), ES8311, SD_MMC | MIT (sprites CC BY-NC) | Closest to the pet POC. Pet state machine (`pet.cpp`), stat decay tuning, offline catch-up via RTC, anti-burn-in, browser web installer, CI that builds the firmware. Targets plain 1.75, so pins differ. |
| [CustomOS / AmoledSmartWatchOS](https://github.com/MikeCheek/CustomOS-ESP32-S3-1.75) | PlatformIO, Arduino, Arduino_GFX, no LVGL | None found | Ideas only: host simulator (`tools/watch_sim`) that renders the real UI code on a desktop, documented companion protocol (`COMPANION_PROTOCOL.md`), OTA over Wi-Fi with rollback. |
| [Round-ESP32](https://github.com/SidUParis/Round-ESP32) | ESP-IDF 5.5.4, LVGL, patches over Waveshare Brookesia | Apache-2.0 | Expressive character on LVGL (blink, gaze, poses), circular control center, USB screenshots. Its browser prototype simulates Claude Code and Codex quota providers. |
| [Waveshare 1.75C examples](https://github.com/waveshareteam/ESP32-S3-Touch-AMOLED-1.75C) | ESP-IDF and Arduino | Apache-2.0 | Board bring-up for every peripheral. Starting point for the firmware. |
| [HA voice for 1.75](https://github.com/abramosphere/Home-Assistant-Voice-for-ESP32-S3-Touch-AMOLED-1.75) | ESPHome | | Reference if voice comes back. |
