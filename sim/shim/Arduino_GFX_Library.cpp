#include "Arduino_GFX_Library.h"

Arduino_GFX::Arduino_GFX(int16_t width, int16_t height)
    : _width(width), _height(height), _pixels((size_t)width * height, RGB565_BLACK) {}

void Arduino_GFX::fillScreen(uint16_t color) { std::fill(_pixels.begin(), _pixels.end(), color); }

void Arduino_GFX::pixel(int16_t x, int16_t y, uint16_t color) {
  if (x < 0 || y < 0 || x >= _width || y >= _height) return;
  _pixels[(size_t)y * _width + x] = color;
}

void Arduino_GFX::hline(int16_t x0, int16_t x1, int16_t y, uint16_t color) {
  if (y < 0 || y >= _height) return;
  if (x0 > x1) std::swap(x0, x1);
  x0 = max<int16_t>(x0, 0);
  x1 = min<int16_t>(x1, _width - 1);
  for (int16_t x = x0; x <= x1; x++) _pixels[(size_t)y * _width + x] = color;
}

void Arduino_GFX::fillTriangle(int16_t x0, int16_t y0, int16_t x1, int16_t y1, int16_t x2, int16_t y2,
                               uint16_t color) {
  if (y0 > y1) std::swap(y0, y1), std::swap(x0, x1);
  if (y1 > y2) std::swap(y1, y2), std::swap(x1, x2);
  if (y0 > y1) std::swap(y0, y1), std::swap(x0, x1);

  if (y0 == y2) {
    hline(min({x0, x1, x2}), max({x0, x1, x2}), y0, color);
    return;
  }
  for (int y = y0; y <= y2; y++) {
    int32_t long_x = x0 + (int32_t)(x2 - x0) * (y - y0) / (y2 - y0);
    int32_t short_x;
    if (y < y1 || (y == y1 && y1 == y0)) {
      short_x = y1 == y0 ? x1 : x0 + (int32_t)(x1 - x0) * (y - y0) / (y1 - y0);
    } else {
      short_x = y2 == y1 ? x1 : x1 + (int32_t)(x2 - x1) * (y - y1) / (y2 - y1);
    }
    hline((int16_t)long_x, (int16_t)short_x, (int16_t)y, color);
  }
}

void Arduino_GFX::drawRect(int16_t x, int16_t y, int16_t w, int16_t h, uint16_t color) {
  for (int16_t i = 0; i < w; i++) {
    pixel(x + i, y, color);
    pixel(x + i, y + h - 1, color);
  }
  for (int16_t i = 0; i < h; i++) {
    pixel(x, y + i, color);
    pixel(x + w - 1, y + i, color);
  }
}
