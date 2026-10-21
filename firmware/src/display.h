#pragma once
#include "ui.h"

bool initDisplay();
Arduino_GFX *beginFrame();
// Pushes only the area that changed since the last frame, so a frame costs the pet's size, not the panel's.
void endFrame(Bounds drawn);

void displayBrightness(uint8_t level);
