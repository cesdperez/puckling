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
| Radio | BLE 5 | |

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
- NVS keys are at most 15 characters, and `localStorage` on the device is NVS. That is why the keys are `food`, `life`, `evo` and `feedkey`.
- `geatsc` fails on `JSON.stringify` of an optional value. Pass a defined value, or stringify it behind a guard.
- `fillText` anchors the top-left of the text, and `textAlign` does nothing. Centre a string yourself with `measureText` and subtract half the width.
- Without a baked font atlas, the device draws a scaled 8x16 bitmap font but `measureText` and `measureTextInkCenter` return zero. Its ASCII cell width is `round(fontSize / 2)`.
- The bitmap font does not contain `Σ`. Use ASCII text.
- Canvas `stroke()` treats an arc as a one-pixel full circle rather than a partial thick arc. Use filled circles for thick arcs.
- The browser sim's `Battery` has `level()` only, with no `charging()`, and no `measureTextInkCenter`. Calls to those sit in `try`/`catch`.
- `gea devctl storage set <key> <value>` writes the app's NVS-backed `localStorage`. It presets the food line the feeder sends, and `storage set life 0` resets growth, because the text does not parse as a life. The running app overwrites the key on its next save, so reboot straight after a reset.
- The browser sim has no Clock host binding. `src/App.tsx` catches that and falls back to `Date.now()` for wall time, so night still works in the sim.
- macOS has no `timeout`. A monitor wrapped as `perl -e 'alarm N; exec @ARGV' npx gea monitor` kills only `npx`, and its node child keeps the serial port, so the next flash or monitor fails. Run `node_modules/.bin/gea monitor` under the same wrapper instead, with no npx in between.
- BLE controller preinitialization competes with the display for internal DMA RAM. The `puck` alias uses an 8 KB main-task stack and 4 KB IPC stacks. The CLI defaults (32 KB main, 16 KB per IPC task) leave the panel without flush buffers. Reducing only the main stack lets the panel start but can still starve the 10 KB internal-stack worker used by NVS saves.
- The installed geatsc legacy adapter does not populate `BLEServer`'s registry. Direct `BLE.init('puckling', 0, '')` and `BLE.startAdvertising()` work without a subclass. Initialize once from the frame loop.
- The config service UUID is not advertised. Scan by advertised name or the cached CoreBluetooth peripheral name. Appearance zero omits the HID advertisement, but the shared GATT table still contains HID services. macOS can delay config transactions for about 40 seconds while it probes and tries to pair with HID.
- `BLE.config.setDocument` resets the DATA read cursor. Publish only when the document changes, and stop reading at the length returned by CTRL `0x81`, not at an empty read.
- The config DATA characteristic supports writes with response. Acknowledge every chunk before CTRL COMMIT; write-without-response chunks can be overtaken by the commit.
- `devctl storage get feedkey` is denied because the name is sensitive; `storage set feedkey` is allowed. Pairing and watching must use the same `PUCKLING_FEEDER_STATE` file.
- If CLI monitoring shows no logs, open `/dev/cu.usbmodem1101` with pyserial at 115200, send `GEADEV REBOOT\n`, and read boot output on that same open connection. Do not run a separate devctl while a monitor owns the port. `/dev/cu.usbmodem201NTNHNH3032` does not answer this puck's GEADEV commands.

## Sources

- Official 1.75C repo, with pins, BSP and schematic: https://github.com/waveshareteam/ESP32-S3-Touch-AMOLED-1.75C
- Wiki: https://www.waveshare.com/wiki/ESP32-S3-Touch-AMOLED-1.75
