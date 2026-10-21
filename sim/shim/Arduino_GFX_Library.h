#pragma once
// Stands in for Arduino_GFX with an in-memory RGB565 canvas, so the firmware's drawing code runs unchanged.
#include <vector>
#include "Arduino.h"

#define RGB565_BLACK 0x0000

class Arduino_GFX {
 public:
  Arduino_GFX(int16_t width, int16_t height);

  void fillScreen(uint16_t color);
  void fillTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2, uint16_t color);
  void drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color);

  int16_t width() const { return _width; }
  int16_t height() const { return _height; }
  const uint16_t *framebuffer() const { return _pixels.data(); }

 private:
  void hline(int16_t x0, int16_t x1, int16_t y, uint16_t color);
  void pixel(int16_t x, int16_t y, uint16_t color);

  int16_t _width, _height;
  std::vector<uint16_t> _pixels;
};
