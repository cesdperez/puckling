#include <Arduino.h>
#include "display.h"
#include "sensors.h"
#include "world.h"

void report(const Motion &m, uint32_t now) {
  static uint32_t lastReport = 0;
  static uint32_t frames = 0;
  frames++;
  if (now - lastReport < 2000) return;
  Serial.printf("fps %lu down=(%.2f, %.2f) spin=%.2f\n", frames * 1000 / (now - lastReport), m.downX, m.downY, m.spin);
  frames = 0;
  lastReport = now;
}

void setup() {
  Serial.begin(115200);
  if (!initDisplay()) Serial.println("display init failed");
  if (!initSensors()) Serial.println("sensor init failed");
  Serial.println("puckling poc");
}

void loop() {
  static uint32_t last = millis();
  uint32_t now = millis();
  float dt = min(0.05f, (now - last) / 1000.0f);
  last = now;

  Motion motion = readMotion();
  Poke poke;
  bool poked = readPoke(poke);
  if (poked) Serial.printf("poke %d,%d\n", poke.x, poke.y);

  Pose pose = stepWorld(motion, poked ? &poke : nullptr, dt);

  drawPet(beginFrame(), pose);
  endFrame(petBounds(pose));
  report(motion, now);
}
