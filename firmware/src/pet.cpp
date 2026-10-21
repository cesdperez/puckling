#include "pet.h"

constexpr uint16_t BODY = 0xDBAA;  // #D97757
constexpr uint16_t EYE = RGB565_BLACK;

// Cells are twice as tall as wide, like the terminal quadrant glyphs the pet comes from.
constexpr float CELL = PET_CELL;
constexpr float ROW = 2 * PET_CELL;

struct Frame {
  Arduino_GFX *gfx;
  float x, y, cosA, sinA, scaleX, scaleY;

  void toScreen(float lx, float ly, int16_t &sx, int16_t &sy) const {
    lx *= scaleX;
    ly *= scaleY;
    sx = (int16_t)lroundf(x + cosA * lx - sinA * ly);
    sy = (int16_t)lroundf(y + sinA * lx + cosA * ly);
  }

  void quad(const float (&pts)[4][2], uint16_t color) const {
    int16_t sx[4], sy[4];
    for (int i = 0; i < 4; i++) toScreen(pts[i][0], pts[i][1], sx[i], sy[i]);
    gfx->fillTriangle(sx[0], sy[0], sx[1], sy[1], sx[2], sy[2], color);
    gfx->fillTriangle(sx[0], sy[0], sx[2], sy[2], sx[3], sy[3], color);
  }

  void rect(float lx, float ly, float w, float h, uint16_t color) const {
    const float pts[4][2] = {{lx, ly}, {lx + w, ly}, {lx + w, ly + h}, {lx, ly + h}};
    quad(pts, color);
  }

  void triangle(float x0, float y0, float x1, float y1, float x2, float y2, uint16_t color) const {
    int16_t a, b, c, d, e, f;
    toScreen(x0, y0, a, b);
    toScreen(x1, y1, c, d);
    toScreen(x2, y2, e, f);
    gfx->fillTriangle(a, b, c, d, e, f, color);
  }
};

// Grid columns run 1..16 with the pet centred on column 9; rows run 0..4 with the feet at the bottom of row 4.
static float colX(float col) { return (col - 9) * CELL; }
static float rowY(float row) { return (row - 5) * ROW; }

static void drawEye(const Frame &f, float col, bool leftEye, const Pose &p) {
  float x = colX(col) + p.look * CELL / 2;
  float y = rowY(1);
  float cx = x + CELL / 2;
  float cy = y + ROW / 2;
  switch (p.eyes) {
    case Eyes::Open:
      f.rect(x, y, CELL, ROW, EYE);
      break;
    case Eyes::Blink:
      f.rect(x - 1, cy - 2, CELL + 2, 4, EYE);
      break;
    case Eyes::Focused:
      f.rect(x - 2, cy, CELL + 4, ROW / 2, EYE);
      break;
    case Eyes::Alert:
      f.rect(x - 3, y - 2, CELL + 6, ROW + 4, EYE);
      f.rect(x, y + 2, 4, 6, BODY);
      break;
    case Eyes::Happy: {
      const float left[4][2] = {{x - 3, cy + 4}, {cx, cy - 7}, {cx, cy - 1}, {x - 3, cy + 10}};
      const float right[4][2] = {{cx, cy - 7}, {x + CELL + 3, cy + 4}, {x + CELL + 3, cy + 10}, {cx, cy - 1}};
      f.quad(left, EYE);
      f.quad(right, EYE);
      break;
    }
    case Eyes::Squeeze:
      if (leftEye) {
        f.triangle(x - 2, y + 2, x + CELL + 2, cy, x - 2, y + ROW - 2, EYE);
      } else {
        f.triangle(x + CELL + 2, y + 2, x - 2, cy, x + CELL + 2, y + ROW - 2, EYE);
      }
      break;
    case Eyes::Dizzy: {
      float a = p.time * 9 * (leftEye ? 1 : -1);
      float dx = cosf(a) * CELL * 0.8f, dy = sinf(a) * CELL * 0.8f;
      float nx = -sinf(a) * 1.5f, ny = cosf(a) * 1.5f;
      const float bar[4][2] = {{cx - dx - nx, cy - dy - ny}, {cx + dx - nx, cy + dy - ny},
                               {cx + dx + nx, cy + dy + ny}, {cx - dx + nx, cy - dy + ny}};
      f.quad(bar, EYE);
      break;
    }
  }
}

static void drawLegs(const Frame &f, int8_t step) {
  const float legs[] = {4, 6, 11, 13};
  for (int i = 0; i < 4; i++) {
    bool lifted = step >= 0 && (i % 2) == step;
    float h = lifted ? ROW / 2 : ROW;
    f.rect(colX(legs[i]), rowY(4), CELL, h, BODY);
  }
}

static Frame frameFor(Arduino_GFX *gfx, const Pose &p) {
  return {gfx, p.x, p.y, cosf(p.angle), sinf(p.angle), 1 + 0.25f * p.squash, 1 - 0.3f * p.squash};
}

Bounds petBounds(const Pose &p) {
  Frame f = frameFor(nullptr, p);
  Bounds b{INT16_MAX, INT16_MAX, INT16_MIN, INT16_MIN};
  const float corners[4][2] = {{colX(1), rowY(0)}, {colX(17), rowY(0)}, {colX(17), 0}, {colX(1), 0}};
  for (auto &c : corners) {
    int16_t x, y;
    f.toScreen(c[0], c[1], x, y);
    b = {min(b.x0, x), min(b.y0, y), max(b.x1, x), max(b.y1, y)};
  }
  return {(int16_t)(b.x0 - 3), (int16_t)(b.y0 - 3), (int16_t)(b.x1 + 4), (int16_t)(b.y1 + 4)};
}

void drawPet(Arduino_GFX *gfx, const Pose &p) {
  Frame f = frameFor(gfx, p);

  // Arms overlap the body by a pixel so rotated edges leave no seam.
  f.rect(colX(3), rowY(0), 12 * CELL, 4 * ROW + 1, BODY);
  f.rect(colX(1), rowY(p.leftArmUp ? 1 : 2), 2 * CELL + 1, ROW, BODY);
  f.rect(colX(15) - 1, rowY(p.rightArmUp ? 1 : 2), 2 * CELL + 1, ROW, BODY);
  drawLegs(f, p.step);
  drawEye(f, 5, true, p);
  drawEye(f, 12, false, p);
}
