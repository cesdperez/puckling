#include "display.h"
#include "pins.h"

static Arduino_DataBus *bus = new Arduino_ESP32QSPI(LCD_CS, LCD_SCLK, LCD_SDIO0, LCD_SDIO1, LCD_SDIO2, LCD_SDIO3);
static Arduino_CO5300 *panel = new Arduino_CO5300(bus, LCD_RESET, 0, LCD_WIDTH, LCD_HEIGHT, 6, 0, 0, 0);
static Arduino_Canvas *canvas = new Arduino_Canvas(LCD_WIDTH, LCD_HEIGHT, panel);
static uint16_t *region = nullptr;
static Bounds previous = {0, 0, LCD_WIDTH, LCD_HEIGHT};

static Bounds clipped(Bounds b) {
  // The CO5300 only accepts windows that start and end on even pixels.
  auto evenDown = [](int16_t v) { return (int16_t)(max<int16_t>(0, v) & ~1); };
  auto evenUp = [](int16_t v, int16_t limit) { return (int16_t)min<int16_t>(limit, (v + 1) & ~1); };
  return {evenDown(b.x0), evenDown(b.y0), evenUp(b.x1, LCD_WIDTH), evenUp(b.y1, LCD_HEIGHT)};
}

static Bounds unite(Bounds a, Bounds b) {
  return {min(a.x0, b.x0), min(a.y0, b.y0), max(a.x1, b.x1), max(a.y1, b.y1)};
}

bool initDisplay() {
  if (!canvas->begin(80000000)) return false;
  panel->setBrightness(160);
  region = (uint16_t *)ps_malloc(LCD_WIDTH * LCD_HEIGHT * sizeof(uint16_t));
  canvas->fillScreen(RGB565_BLACK);
  canvas->flush();
  return region != nullptr;
}

Arduino_GFX *beginFrame() {
  canvas->fillRect(previous.x0, previous.y0, previous.x1 - previous.x0, previous.y1 - previous.y0, RGB565_BLACK);
  return canvas;
}

void endFrame(Bounds drawn) {
  Bounds now = clipped(drawn);
  Bounds dirty = unite(previous, now);
  previous = now;

  int16_t w = dirty.x1 - dirty.x0;
  int16_t h = dirty.y1 - dirty.y0;
  if (w <= 0 || h <= 0) return;
  uint16_t *fb = canvas->getFramebuffer();
  for (int16_t row = 0; row < h; row++) {
    memcpy(region + row * w, fb + (dirty.y0 + row) * LCD_WIDTH + dirty.x0, w * sizeof(uint16_t));
  }
  panel->draw16bitRGBBitmap(dirty.x0, dirty.y0, region, w, h);
}
