#pragma once
#include <stdint.h>

// All values are in screen coordinates: x right, y down, angles clockwise.
struct Motion {
  float downX;  // gravity along the screen, in g
  float downY;
  float spin;  // rotation of the puck about the screen normal, rad/s
};

struct Poke {
  int16_t x;
  int16_t y;
};

bool initSensors();
Motion readMotion();
bool readPoke(Poke &poke);
