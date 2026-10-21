#pragma once
#include "pet.h"
#include "sensors.h"

// Advances the pet's little world by dt seconds and returns how to draw it.
Pose stepWorld(const Motion &motion, const Poke *poke, float dt);
