#pragma once
#include <stdint.h>
#include "ui.h"

// All values are in screen coordinates: x right, y down, angles clockwise.
struct Motion {
  float downX;  // gravity along the screen, in g
  float downY;
  float spin;  // rotation of the puck about the screen normal, rad/s
};

bool initSensors();
const char *sensorStatus();
Motion readMotion();
TouchSample readTouch();
