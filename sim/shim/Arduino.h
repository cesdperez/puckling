#pragma once
// The slice of the Arduino core that the firmware's drawing and world code uses.
#include <stdint.h>
#include <stdlib.h>
#include <math.h>
#include <algorithm>

using std::max;
using std::min;

#ifndef PI
#define PI 3.14159265358979323846f
#endif
#define HALF_PI 1.57079632679489661923f
#define TWO_PI 6.28318530717958647693f

template <class T>
T constrain(T x, T low, T high) {
  return x < low ? low : (x > high ? high : x);
}

inline long random(long howBig) { return howBig > 0 ? arc4random_uniform((uint32_t)howBig) : 0; }
inline long random(long howSmall, long howBig) {
  return howSmall >= howBig ? howSmall : howSmall + random(howBig - howSmall);
}
