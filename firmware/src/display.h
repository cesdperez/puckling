#pragma once
#include "pet.h"

bool initDisplay();
Arduino_GFX *beginFrame();
// Pushes only the area that changed since the last frame, so a frame costs the pet's size, not the panel's.
void endFrame(Bounds drawn);
