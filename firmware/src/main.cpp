#include <Arduino.h>
#include "display.h"
#include "sensors.h"
#include "world.h"
#include "session.h"

static SessionReceiver session;

static const char *linkStatus(uint32_t now) {
  if (!session.hasSnapshot()) return "waiting";
  if (!session.fresh(now)) return "stale";
  return session.snapshot().connected ? "connected" : "unavailable";
}

void report(const Motion &m, uint32_t now) {
  static uint32_t lastReport = 0;
  static uint32_t frames = 0;
  frames++;
  if (now - lastReport < 2000) return;
  Serial.printf("fps %lu sensors %s down=(%.2f, %.2f) spin=%.2f session=%s link=%s\n",
                frames * 1000 / (now - lastReport), sensorStatus(), m.downX, m.downY, m.spin,
                sessionName(session.snapshot().state), linkStatus(now));
  frames = 0;
  lastReport = now;
}

void setup() {
  Serial.begin(115200);
  Serial.setTxTimeoutMs(0);
  if (!initDisplay()) Serial.println("display init failed");
  if (!initSensors()) Serial.println("sensor init failed");
  Serial.println("puckling ready protocol=1");
}

void loop() {
  static uint32_t last = millis();
  uint32_t now = millis();
  float dt = min(0.05f, (now - last) / 1000.0f);
  last = now;

  for (int remaining = 1024; remaining > 0 && Serial.available() > 0; remaining--) {
    session.feed(char(Serial.read()), now);
  }

  Motion motion = readMotion();
  Poke poke;
  bool poked = readPoke(poke);
  if (poked && session.canFocus(now) && Serial.availableForWrite() >= int(sizeof(TAP_MESSAGE) - 1)) {
    if (Serial.write(TAP_MESSAGE) == sizeof(TAP_MESSAGE) - 1) {
      Serial.println("tap action=focus");
      poked = false;
    }
  }
  if (poked) Serial.printf("poke %d,%d\n", poke.x, poke.y);

  Pose pose = stepWorld(motion, poked ? &poke : nullptr, dt);
  if (session.hasSnapshot()) applySession(pose, session.snapshot().state);

  drawPet(beginFrame(), pose);
  endFrame(petBounds(pose));
  report(motion, now);
}
