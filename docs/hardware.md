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

The `puck` alias carries this puck's USB serial, so flash, monitor and screenshot find it without `--port`. With a different board, run `npx gea boards set puck serial <serial> --local` using the serial `npx gea boards discover` shows. The project alias replaces a home (`~/.geastack`) alias of the same name instead of merging its fields, so a home alias cannot correct it.

`npx gea doctor` reports the toolchain state. GeaStack setup does not install ESP-IDF or CMake; install both, with ESP-IDF v6, before the first firmware build.

## Traps

- **1.75 and 1.75C are different boards.** The plain 1.75 has 16 MB flash, `LCD_RESET 39` and `TP_RST 40`, and its gea target is `esp32-s3-touch-amoled-1.75`. Most community projects target it. Copy their logic, never their pins or target.
- The panel is round. Anything outside the inscribed circle of the 466x466 buffer is invisible.
- AMOLED burns in under static light. Keep the idle dim and drift described in [creature.md](creature.md).
- Flashing replaces whatever firmware is on the board. Watt's web installer restores Watt.
- `geatsc` cannot log a pointer event object; log its fields.
- `geatsc` cannot use the canvas context as a WeakMap key, since a native handle has no reference identity on the device; keep per-canvas state on an object the component owns.
- `gea flash`, `gea monitor`, `gea screenshot` and `gea devctl` accept `--port <dev>`, although their help does not list it.
- Right after a flash, `gea screenshot` returns `display-unavailable` and `gea devctl summary` times out until the app finishes booting. Wait a few seconds, or reboot the board.
- NVS keys are at most 15 characters, and `localStorage` on the device is NVS. That is why the keys are `food` and `life`.
- `gea devctl storage set <key> <value>` writes the app's NVS-backed `localStorage`. It presets the food line the feeder sends, and `storage set life 0` resets growth, because the text does not parse as a life. The running app overwrites the key on its next save, so reboot straight after a reset.
- The browser sim has no Clock host binding. `src/App.tsx` catches that and falls back to `Date.now()` for wall time, so night still works in the sim.
- macOS has no `timeout`. A monitor wrapped as `perl -e 'alarm N; exec @ARGV' npx gea monitor` kills only `npx`, and its node child keeps the serial port, so the next flash or monitor fails. Run `node_modules/.bin/gea monitor` under the same wrapper instead, with no npx in between.

## Sources

- Official 1.75C repo, with pins, BSP and schematic: https://github.com/waveshareteam/ESP32-S3-Touch-AMOLED-1.75C
- Wiki: https://www.waveshare.com/wiki/ESP32-S3-Touch-AMOLED-1.75
