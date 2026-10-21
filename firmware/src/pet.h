#pragma once
#include <Arduino_GFX_Library.h>

enum class Eyes { Open, Blink, Squeeze, Dizzy };

// The pet's local frame has its origin between the feet, x to its right, y toward its feet.
constexpr float PET_CELL = 10;
constexpr float PET_HALF_WIDTH = 8 * PET_CELL;
constexpr float PET_HEIGHT = 5 * 2 * PET_CELL;

struct Pose {
  float x = 0;  // feet position on screen
  float y = 0;
  float angle = 0;   // radians clockwise, 0 is upright on the screen
  float squash = 0;  // positive flattens, negative stretches
  float look = 0;    // -1 to 1
  float time = 0;    // seconds, drives the dizzy eyes
  Eyes eyes = Eyes::Open;
  bool leftArmUp = false;
  bool rightArmUp = false;
  int8_t step = -1;  // -1 standing, 0 or 1 lifts one pair of legs
};

struct Bounds {
  int16_t x0, y0, x1, y1;  // inclusive-exclusive
};

void drawPet(Arduino_GFX *gfx, const Pose &pose);
Bounds petBounds(const Pose &pose);
