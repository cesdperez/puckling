# Hardware

Board: **Waveshare ESP32-S3-Touch-AMOLED-1.75C**. Same board Watt uses.

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

## Pins (1.75C)

From `examples/arduino/libraries/board_config` in the official 1.75C repo.

```c
#define LCD_SDIO0 4
#define LCD_SDIO1 5
#define LCD_SDIO2 6
#define LCD_SDIO3 7
#define LCD_SCLK  38
#define LCD_CS    12
#define LCD_RESET 1
#define IIC_SDA   15
#define IIC_SCL   14
#define TP_INT    11
#define TP_RST    2
#define PIN_ES7210_BCLK 9
#define PIN_ES7210_LRCK 45
#define PIN_ES7210_DIN  10
#define PIN_ES7210_MCLK 16
#define PIN_ES8311_DOUT 8
#define PA              46
```

## Traps

- **1.75 and 1.75C are different boards.** Most community projects target the plain 1.75 (16 MB flash, `LCD_RESET 39`, `TP_RST 40`). Copy their logic, never their pin file. Always take pins from the 1.75C repo.
- The panel is round. Anything outside the inscribed circle of the 466x466 buffer is invisible.
- AMOLED burns in. Static elements need dimming or a slow drift (TamaPoke does anti-burn-in dimming).
- Flashing our firmware wipes Watt. Watt's web installer restores it.

## Sources

- Official 1.75C repo, ESP-IDF and Arduino examples, BSP, schematic: https://github.com/waveshareteam/ESP32-S3-Touch-AMOLED-1.75C
  - ESP-IDF managed component: `waveshare/esp32_s3_touch_amoled_1_75c`
  - Arduino examples: HelloWorld, GFX, LVGL + AXP2101, LVGL + QMI8658, LVGL widgets, ES7210 mics, ES8311 speaker
- Wiki: https://www.waveshare.com/wiki/ESP32-S3-Touch-AMOLED-1.75
