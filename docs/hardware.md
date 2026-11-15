# Hardware

Board: **Waveshare ESP32-S3-Touch-AMOLED-1.75C**.

| Part | Chip | Bus |
|---|---|---|
| MCU | ESP32-S3, 32 MB flash, 8 MB PSRAM | |
| Display | 1.75" 466x466 round AMOLED, CO5300 | QSPI |
| Touch | CST9217 | I2C |
| Power | AXP2101 PMU, battery connector | I2C |
| IMU | QMI8658 6-axis | I2C |
| Mics | dual digital mics via ES7210 ADC | I2S |
| Speaker | ES8311 codec + amp | I2S |
| Radio | Wi-Fi 2.4 GHz, BLE 5 | |

## GeaStack target

`.gea/boards.json` aliases `puck` to the upstream GeaStack target `esp32-s3-touch-amoled-1.75c`. That target carries this board's pins, flash size, CO5300 panel, AXP2101 PMU and CST9217 touch, so the app never spells out pins itself.

`npx gea doctor` reports the toolchain state. GeaStack setup does not install ESP-IDF or CMake; install both, with ESP-IDF v6, before the first firmware build.

## Traps

- **1.75 and 1.75C are different boards.** The plain 1.75 has 16 MB flash, `LCD_RESET 39` and `TP_RST 40`, and its gea target is `esp32-s3-touch-amoled-1.75`. Most community projects target it. Copy their logic, never their pins or target.
- The panel is round. Anything outside the inscribed circle of the 466x466 buffer is invisible.
- AMOLED burns in under static light. Keep the idle dim and drift described in [creature.md](creature.md).
- Flashing replaces whatever firmware is on the board. Watt's web installer restores Watt.
- `geatsc` cannot log a pointer event object; log its fields.

## Sources

- Official 1.75C repo, with pins, BSP and schematic: https://github.com/waveshareteam/ESP32-S3-Touch-AMOLED-1.75C
- Wiki: https://www.waveshare.com/wiki/ESP32-S3-Touch-AMOLED-1.75

