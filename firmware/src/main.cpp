#include <Arduino.h>
#include <Arduino_GFX_Library.h>
#include "pins.h"

constexpr uint16_t BODY = 0xDBAA;  // #D97757
constexpr uint16_t EYE = RGB565_BLACK;
constexpr uint16_t SHADOW = 0x2104;

// The canvas covers only the pet's area, so each frame pushes ~150 KB instead of the full panel.
// The CO5300 needs even window coordinates and sizes.
constexpr int16_t CANVAS_W = 300;
constexpr int16_t CANVAS_H = 260;
constexpr int16_t CANVAS_X = (LCD_WIDTH - CANVAS_W) / 2 / 2 * 2;
constexpr int16_t CANVAS_Y = (LCD_HEIGHT - CANVAS_H) / 2 / 2 * 2;

// The pet is drawn on a grid of cells, each CELL wide and 2*CELL tall, like the terminal quadrant glyphs it comes from.
constexpr int16_t CELL = 16;
constexpr int16_t ROW = CELL * 2;
constexpr int16_t GRID_X = CANVAS_W / 2 - 9 * CELL;
constexpr int16_t GROUND_Y = 60 + 5 * ROW;

Arduino_DataBus *bus = new Arduino_ESP32QSPI(LCD_CS, LCD_SCLK, LCD_SDIO0, LCD_SDIO1, LCD_SDIO2, LCD_SDIO3);
Arduino_CO5300 *panel = new Arduino_CO5300(bus, LCD_RESET, 0, LCD_WIDTH, LCD_HEIGHT, 6, 0, 0, 0);
Arduino_Canvas *canvas = new Arduino_Canvas(CANVAS_W, CANVAS_H, panel, CANVAS_X, CANVAS_Y);

struct Pose {
  int16_t dx = 0;
  int16_t lift = 0;
  bool blink = false;
  int16_t look = 0;
  bool leftArmUp = false;
  bool rightArmUp = false;
  int8_t step = -1;  // -1 standing, 0 or 1 lifts one pair of legs
};

enum class Action { Idle, Wave, Hop, Walk, Look };

void cell(int16_t x0, int16_t y0, int16_t col, int16_t row, int16_t w, int16_t h, uint16_t color) {
  canvas->fillRect(x0 + col * CELL, y0 + row * ROW, w * CELL, h * ROW, color);
}

void drawLegs(int16_t x0, int16_t y0, int8_t step) {
  const int16_t legs[] = {4, 6, 11, 13};
  for (int i = 0; i < 4; i++) {
    bool lifted = step >= 0 && (i % 2) == step;
    int16_t h = lifted ? ROW / 2 : ROW;
    canvas->fillRect(x0 + legs[i] * CELL, y0 + 4 * ROW, CELL, h, BODY);
  }
}

void drawEyes(int16_t x0, int16_t y0, const Pose &p) {
  for (int16_t col : {5, 12}) {
    int16_t x = x0 + col * CELL + p.look;
    if (p.blink) {
      canvas->fillRect(x, y0 + ROW + ROW / 2 - 2, CELL, 4, EYE);
    } else {
      canvas->fillRect(x, y0 + ROW, CELL, ROW, EYE);
    }
  }
}

void drawPet(const Pose &p) {
  int16_t x0 = GRID_X + p.dx;
  int16_t y0 = GROUND_Y - 5 * ROW - p.lift;

  int16_t shadowW = 6 * CELL - p.lift;
  canvas->fillEllipse(CANVAS_W / 2 + p.dx, GROUND_Y + 8, shadowW, 6, SHADOW);

  cell(x0, y0, 3, 0, 12, 4, BODY);
  cell(x0, y0, 1, p.leftArmUp ? 1 : 2, 2, 1, BODY);
  cell(x0, y0, 15, p.rightArmUp ? 1 : 2, 2, 1, BODY);
  drawLegs(x0, y0, p.step);
  drawEyes(x0, y0, p);
}

Pose poseFor(Action action, uint32_t t) {
  Pose p;
  p.lift = (t / 600) % 2 ? 2 : 0;
  switch (action) {
    case Action::Idle:
      break;
    case Action::Wave:
      p.rightArmUp = (t / 200) % 2;
      break;
    case Action::Hop: {
      float phase = (t % 700) / 700.0f;
      p.lift = (int16_t)(50 * sinf(phase * PI));
      p.step = p.lift > 10 ? 0 : -1;
      p.leftArmUp = p.rightArmUp = p.lift > 25;
      break;
    }
    case Action::Walk:
      p.dx = (int16_t)(40 * sinf(t / 600.0f));
      p.step = (t / 150) % 2;
      break;
    case Action::Look:
      p.look = (int16_t)(CELL / 2 * sinf(t / 400.0f));
      break;
  }
  return p;
}

Action nextAction() {
  const Action menu[] = {Action::Idle, Action::Wave, Action::Hop, Action::Walk, Action::Look};
  return menu[random(5)];
}

bool blinking(uint32_t now) {
  static uint32_t nextBlink = 2000;
  if (now > nextBlink + 140) nextBlink = now + random(2000, 5000);
  return now >= nextBlink;
}

void setup() {
  Serial.begin(115200);
  if (!canvas->begin()) Serial.println("display init failed");
  panel->fillScreen(RGB565_BLACK);
  panel->setBrightness(160);
  Serial.println("puckling poc");
}

void loop() {
  static Action action = Action::Idle;
  static uint32_t actionStart = 0;
  uint32_t now = millis();

  if (now - actionStart > 3500) {
    action = nextAction();
    actionStart = now;
    Serial.printf("action %d\n", (int)action);
  }

  Pose pose = poseFor(action, now - actionStart);
  pose.blink = blinking(now);

  canvas->fillScreen(RGB565_BLACK);
  drawPet(pose);
  canvas->flush();
  delay(16);
}
