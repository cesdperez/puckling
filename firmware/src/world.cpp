#include "world.h"
#include <Arduino.h>

constexpr float CENTER = 233;
constexpr float RIM = 226;
constexpr float GRAVITY = 1400;      // px/s^2 per g of tilt
constexpr float FLAT_TILT = 0.12f;   // below this the puck counts as lying flat, in g
constexpr float WALKABLE_TILT = 0.3f;
constexpr float WALK_SPEED = 110;
constexpr float HOP_SPEED = 380;
constexpr float HOP_GRAVITY = 1600;
constexpr float DIZZY_SPIN = 4;  // rad/s
constexpr float DIZZY_TURNS = 1.5f;

struct Vec {
  float x, y;
  Vec operator+(Vec o) const { return {x + o.x, y + o.y}; }
  Vec operator-(Vec o) const { return {x - o.x, y - o.y}; }
  Vec operator*(float s) const { return {x * s, y * s}; }
  float dot(Vec o) const { return x * o.x + y * o.y; }
  float length() const { return hypotf(x, y); }
  Vec rotated(float a) const { return {cosf(a) * x - sinf(a) * y, sinf(a) * x + cosf(a) * y}; }
};

enum class Idle { None, Wave, Look };

static struct {
  Vec pos{0, 60};  // feet, relative to the screen centre
  Vec vel{0, 0};
  float down = HALF_PI;  // direction of world-down on the screen
  float angle = 0;       // body angle, follows down
  float hop = 0;
  float hopVel = 0;
  float squash = 0;
  float dizzyCharge = 0;
  float dizzyUntil = 0;
  float squeezeUntil = 0;
  bool walking = false;
  Vec target{0, 0};
  Idle idle = Idle::None;
  float idleUntil = 0;
  float nextIdle = 4;
  float nextBlink = 2;
  float time = 0;
} w;

static float angleToward(float from, float to, float t) {
  float diff = atan2f(sinf(to - from), cosf(to - from));
  return from + diff * t;
}

static Vec up() { return {sinf(w.angle), -cosf(w.angle)}; }

// Spinning the puck turns the screen under a pet that stays put in the world.
static void followSpin(float spin, float dt) {
  float turn = spin * dt;
  w.pos = w.pos.rotated(turn);
  w.vel = w.vel.rotated(turn);
  w.down += turn;
  w.angle += turn;

  if (fabsf(spin) > DIZZY_SPIN) {
    w.dizzyCharge += fabsf(turn);
  } else {
    w.dizzyCharge = max(0.0f, w.dizzyCharge - 3 * dt);
  }
  if (w.dizzyCharge > DIZZY_TURNS * TWO_PI) {
    w.dizzyUntil = w.time + 3;
    w.dizzyCharge = 0;
    w.walking = false;
  }
}

static void followGravity(const Motion &m, float tilt, float dt) {
  if (tilt <= FLAT_TILT) return;
  w.down = angleToward(w.down, atan2f(m.downY, m.downX), min(1.0f, 4 * tilt * dt));
  float pull = (tilt - FLAT_TILT) / tilt * GRAVITY * dt;
  w.vel = w.vel + Vec{m.downX, m.downY} * pull;
}

static void walk(float tilt, float dt) {
  if (!w.walking) return;
  Vec to = w.target - w.pos;
  float distance = to.length();
  if (distance < 6 || tilt > WALKABLE_TILT) {
    w.walking = false;
    return;
  }
  Vec desired = to * (WALK_SPEED / distance);
  w.vel = w.vel + (desired - w.vel) * min(1.0f, 8 * dt);
}

// Pushes the pet back inside the round screen by its most protruding corner, and lands it on the rim.
static void stayInside() {
  const Vec corners[] = {{-PET_HALF_WIDTH, 0}, {PET_HALF_WIDTH, 0}, {-PET_HALF_WIDTH, -PET_HEIGHT}, {PET_HALF_WIDTH, -PET_HEIGHT}};
  for (int pass = 0; pass < 3; pass++) {
    float overlap = 0;
    Vec normal{0, 0};
    for (Vec c : corners) {
      Vec p = w.pos + c.rotated(w.angle);
      float r = p.length();
      if (r - RIM > overlap) {
        overlap = r - RIM;
        normal = p * (1 / r);
      }
    }
    if (overlap <= 0) return;
    w.pos = w.pos - normal * overlap;
    float into = w.vel.dot(normal);
    if (into > 0) {
      if (into > 250) w.squash = max(w.squash, min(1.0f, into / 900));
      w.vel = w.vel - normal * into;
    }
  }
}

static void move(float tilt, float dt) {
  float friction = w.walking ? 0 : (tilt > FLAT_TILT ? 1.0f : 3.0f);
  w.vel = w.vel * expf(-friction * dt);
  w.pos = w.pos + w.vel * dt;
  w.angle = angleToward(w.angle, w.down - HALF_PI, min(1.0f, 10 * dt));
  stayInside();
}

static void bounce(float dt) {
  if (w.hop <= 0 && w.hopVel <= 0) return;
  w.hopVel -= HOP_GRAVITY * dt;
  w.hop += w.hopVel * dt;
  if (w.hop < 0) {
    if (w.hopVel < -200) w.squash = max(w.squash, 0.5f);
    w.hop = 0;
    w.hopVel = 0;
  }
}

static bool hits(Vec point) {
  Vec local = (point - w.pos - up() * w.hop).rotated(-w.angle);
  return fabsf(local.x) < PET_HALF_WIDTH + 15 && local.y > -PET_HEIGHT - 15 && local.y < 15;
}

static void react(const Poke &poke, float tilt) {
  Vec point{poke.x - CENTER, poke.y - CENTER};
  if (hits(point)) {
    w.squeezeUntil = w.time + 0.8f;
    w.hopVel = HOP_SPEED;
    w.hop = max(w.hop, 0.1f);
    w.squash = 0.6f;
    w.walking = false;
    return;
  }
  if (tilt > WALKABLE_TILT || w.time < w.dizzyUntil) return;
  float reach = RIM - 110;
  float r = point.length();
  w.target = r > reach ? point * (reach / r) : point;
  w.walking = true;
}

static void idleAround(float tilt) {
  bool busy = w.walking || w.hop > 0 || w.time < w.dizzyUntil || w.time < w.squeezeUntil;
  if (busy || w.time < w.nextIdle) return;

  w.nextIdle = w.time + random(4000, 8000) / 1000.0f;
  switch (random(4)) {
    case 0:
      w.idle = Idle::Wave;
      w.idleUntil = w.time + 1.6f;
      break;
    case 1:
      w.idle = Idle::Look;
      w.idleUntil = w.time + 2.5f;
      break;
    case 2:
      w.hopVel = HOP_SPEED * 0.6f;
      w.hop = 0.1f;
      break;
    case 3:
      if (tilt < FLAT_TILT) {
        w.target = Vec{(float)random(-100, 100), (float)random(-100, 100)};
        w.walking = true;
      }
      break;
  }
}

static Eyes eyes() {
  if (w.time < w.dizzyUntil) return Eyes::Dizzy;
  if (w.time < w.squeezeUntil) return Eyes::Squeeze;
  if (w.time > w.nextBlink + 0.14f) w.nextBlink = w.time + random(2000, 5000) / 1000.0f;
  return w.time >= w.nextBlink ? Eyes::Blink : Eyes::Open;
}

static Pose pose() {
  Pose p;
  Vec feet = w.pos + up() * w.hop;
  bool dizzy = w.time < w.dizzyUntil;
  bool idling = w.time < w.idleUntil;

  p.x = CENTER + feet.x;
  p.y = CENTER + feet.y;
  p.angle = w.angle + (dizzy ? 0.18f * sinf(w.time * 7) : 0);
  p.squash = w.squash + 0.04f * sinf(w.time * 2.5f);
  p.time = w.time;
  p.eyes = eyes();

  if (w.walking) {
    p.look = constrain((w.target - w.pos).rotated(-w.angle).x / 40, -1.0f, 1.0f);
  } else if (idling && w.idle == Idle::Look) {
    p.look = sinf(w.time * 2.5f);
  }

  bool airborne = w.hop > 15;
  bool waving = idling && w.idle == Idle::Wave && fmodf(w.time, 0.4f) < 0.2f;
  p.leftArmUp = airborne;
  p.rightArmUp = airborne || waving;
  p.step = w.walking && w.vel.length() > 20 ? (int)(w.time * 7) % 2 : -1;
  return p;
}

Pose stepWorld(const Motion &motion, const Poke *poke, float dt) {
  w.time += dt;
  float tilt = hypotf(motion.downX, motion.downY);

  followSpin(motion.spin, dt);
  followGravity(motion, tilt, dt);
  if (poke) react(*poke, tilt);
  idleAround(tilt);
  walk(tilt, dt);
  move(tilt, dt);
  bounce(dt);
  w.squash *= expf(-8 * dt);
  return pose();
}
