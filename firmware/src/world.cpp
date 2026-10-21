#include "world.h"
#include <Arduino.h>

// The puck is a cylinder and the pet stands on its inner wall. Turning the puck drags that floor under its feet;
// it walks against the drag to stay at the bottom, and loses its footing when the floor moves too far or too fast.

constexpr float CENTER = 233;
constexpr float FEET_RADIUS = 210;  // the outer legs then just touch the round edge
constexpr float GRAVITY = 2200;     // px/s^2
constexpr float RUN_SPEED = 1.6f;   // rad/s along the floor
constexpr float LEG_REACTION = 14;  // rad/s^2, how fast it can change pace
constexpr float HOMING = 4;         // 1/s, how eagerly it heads for its goal
constexpr float SLIP_ANGLE = 0.85f;    // rad up the wall before it loses its footing
constexpr float STUMBLE_JERK = 35;     // rad/s^2 of floor acceleration that knocks it over
constexpr float FLOOR_DRAG = 3;        // 1/s, friction while sliding
constexpr float STRIDE = 0.1f;         // rad of travel per leg swap
constexpr float UPRIGHT_TILT = 0.3f;   // g in the screen plane before gravity overrides the gyro
constexpr float HOP_SPEED = 350;
constexpr float HOP_GRAVITY = 1800;
constexpr float DIZZY_SPIN = 4;  // rad/s
constexpr float DIZZY_TURNS = 1.5f;

enum class State { Standing, Sliding, GettingUp };
enum class Idle { None, Wave, Look };

static struct {
  State state = State::Standing;
  float stateSince = 0;
  float down = HALF_PI;  // screen angle of world-down
  float phi = 0;         // position on the wall, world angle from the bottom
  float phiVel = 0;
  float pace = 0;  // leg speed relative to the floor
  float lean = 0;
  float stride = 0;
  float floorVel = 0;
  float floorAccel = 0;
  float hop = 0;
  float hopVel = 0;
  float squash = 0;
  float goal = 0;
  float goalUntil = 0;
  float dizzyCharge = 0;
  float dizzyUntil = 0;
  float squeezeUntil = 0;
  Idle idle = Idle::None;
  float idleUntil = 0;
  float nextIdle = 4;
  float nextBlink = 2;
  float time = 0;
} w;

static float wrapAngle(float a) { return atan2f(sinf(a), cosf(a)); }
static float approach(float from, float to, float rate, float dt) { return to + (from - to) * expf(-rate * dt); }

static void enter(State s) {
  w.state = s;
  w.stateSince = w.time;
}

static void trackDown(const Motion &m, float tilt, float dt) {
  w.down += m.spin * dt;
  if (tilt > UPRIGHT_TILT) {
    float measured = atan2f(m.downY, m.downX);
    w.down += wrapAngle(measured - w.down) * (1 - expf(-5 * dt));
  }
}

// The floor turns with the puck, so in the world it moves opposite to the screen's view of the spin.
static void trackFloor(const Motion &m, float dt) {
  float vel = -m.spin;
  float accel = (vel - w.floorVel) / dt;
  w.floorAccel = approach(w.floorAccel, accel, 30, dt);
  w.floorVel = vel;
}

static void trackDizziness(float spin, float dt) {
  if (fabsf(spin) > DIZZY_SPIN) {
    w.dizzyCharge += fabsf(spin) * dt;
  } else {
    w.dizzyCharge = max(0.0f, w.dizzyCharge - 3 * dt);
  }
  if (w.dizzyCharge > DIZZY_TURNS * TWO_PI) {
    w.dizzyUntil = w.time + 3;
    w.dizzyCharge = 0;
  }
}

static void stand(float dt) {
  float goal = w.time < w.goalUntil ? w.goal : 0;
  float wantVel = HOMING * (goal - w.phi);
  float wantPace = constrain(wantVel - w.floorVel, -RUN_SPEED, RUN_SPEED);
  w.pace += constrain(wantPace - w.pace, -LEG_REACTION * dt, LEG_REACTION * dt);
  w.phiVel = w.floorVel + w.pace;
  w.phi += w.phiVel * dt;
  w.stride += fabsf(w.pace) * dt / STRIDE;

  // It leans into its stride, and inertia tips it against a lurch of the floor.
  float lean = -0.3f * w.pace / RUN_SPEED - 0.012f * w.floorAccel;
  w.lean = approach(w.lean, constrain(lean, -0.5f, 0.5f), 15, dt);

  if (fabsf(w.phi) > SLIP_ANGLE || fabsf(w.floorAccel) > STUMBLE_JERK) {
    w.squeezeUntil = w.time + 0.6f;
    enter(State::Sliding);
  }
}

static void slide(float dt) {
  float accel = -(GRAVITY / FEET_RADIUS) * sinf(w.phi) + FLOOR_DRAG * (w.floorVel - w.phiVel);
  w.phiVel += accel * dt;
  w.phi += w.phiVel * dt;
  w.pace = w.phiVel - w.floorVel;
  w.stride += 14 * dt;
  w.lean = approach(w.lean, constrain(-0.4f * w.pace, -0.6f, 0.6f), 10, dt);

  bool settled = fabsf(w.pace) < 0.4f && fabsf(w.phi) < SLIP_ANGLE;
  if (settled && w.time - w.stateSince > 0.5f) {
    w.squash = max(w.squash, 0.4f);
    enter(State::GettingUp);
  }
}

static void getUp(float dt) {
  w.pace = 0;
  w.phiVel = w.floorVel;
  w.phi += w.phiVel * dt;
  w.lean = approach(w.lean, 0, 12, dt);
  if (w.time - w.stateSince > 0.35f) enter(State::Standing);
}

static void bounce(float dt) {
  if (w.hop <= 0 && w.hopVel <= 0) return;
  w.hopVel -= HOP_GRAVITY * dt;
  w.hop += w.hopVel * dt;
  if (w.hop < 0) {
    if (w.hopVel < -150) w.squash = max(w.squash, 0.5f);
    w.hop = 0;
    w.hopVel = 0;
  }
}

static void hopUp(float speed) {
  w.hopVel = speed;
  w.hop = max(w.hop, 0.1f);
}

static bool hits(const Pose &pose, float px, float py) {
  float dx = px - pose.x, dy = py - pose.y;
  float c = cosf(-pose.angle), s = sinf(-pose.angle);
  float lx = c * dx - s * dy, ly = s * dx + c * dy;
  return fabsf(lx) < PET_HALF_WIDTH + 20 && ly > -PET_HEIGHT - 20 && ly < 20;
}

static void react(const Poke &poke, const Pose &shown) {
  if (hits(shown, poke.x, poke.y)) {
    w.squeezeUntil = w.time + 0.8f;
    w.squash = 0.6f;
    if (w.state == State::Standing) hopUp(HOP_SPEED);
    return;
  }
  float angle = atan2f(poke.y - CENTER, poke.x - CENTER);
  w.goal = constrain(wrapAngle(angle - w.down), -0.7f, 0.7f);
  w.goalUntil = w.time + 3;
}

static void idleAround() {
  bool busy = w.state != State::Standing || w.hop > 0 || fabsf(w.pace) > 0.1f || w.time < w.goalUntil ||
              w.time < w.dizzyUntil || w.time < w.squeezeUntil;
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
      hopUp(HOP_SPEED * 0.6f);
      break;
    case 3:
      w.goal = random(-50, 50) / 100.0f;
      w.goalUntil = w.time + 2.5f;
      break;
  }
}

static Eyes eyes() {
  if (w.time < w.dizzyUntil) return Eyes::Dizzy;
  if (w.time < w.squeezeUntil || w.state == State::Sliding) return Eyes::Squeeze;
  if (w.time > w.nextBlink + 0.14f) w.nextBlink = w.time + random(2000, 5000) / 1000.0f;
  return w.time >= w.nextBlink ? Eyes::Blink : Eyes::Open;
}

static void placeArms(Pose &p) {
  bool idling = w.time < w.idleUntil;
  bool alternate = (int)w.stride % 2;
  if (w.state == State::Sliding || w.hop > 15) {
    p.leftArmUp = p.rightArmUp = true;
  } else if (fabsf(w.pace) > 0.6f * RUN_SPEED) {
    p.leftArmUp = alternate;
    p.rightArmUp = !alternate;
  } else if (idling && w.idle == Idle::Wave) {
    p.rightArmUp = fmodf(w.time, 0.4f) < 0.2f;
  }
}

static Pose pose() {
  Pose p;
  float feetDir = w.down + w.phi;
  float radius = FEET_RADIUS - w.hop;
  bool dizzy = w.time < w.dizzyUntil;

  p.x = CENTER + radius * cosf(feetDir);
  p.y = CENTER + radius * sinf(feetDir);
  p.angle = feetDir - HALF_PI + w.lean + (dizzy ? 0.18f * sinf(w.time * 7) : 0);
  p.squash = w.squash + 0.04f * sinf(w.time * 2.5f);
  p.time = w.time;
  p.eyes = eyes();

  if (fabsf(w.pace) > 0.1f) {
    p.look = constrain(w.pace / RUN_SPEED * 2, -1.0f, 1.0f);
  } else if (w.time < w.idleUntil && w.idle == Idle::Look) {
    p.look = sinf(w.time * 2.5f);
  }
  bool moving = fabsf(w.pace) > 0.1f || w.state == State::Sliding;
  p.step = moving ? (int)w.stride % 2 : -1;
  placeArms(p);
  return p;
}

Pose stepWorld(const Motion &motion, const Poke *poke, float dt) {
  if (dt <= 0) return pose();
  w.time += dt;
  float tilt = hypotf(motion.downX, motion.downY);

  trackDown(motion, tilt, dt);
  trackFloor(motion, dt);
  trackDizziness(motion.spin, dt);
  if (poke) react(*poke, pose());
  idleAround();

  switch (w.state) {
    case State::Standing:
      stand(dt);
      break;
    case State::Sliding:
      slide(dt);
      break;
    case State::GettingUp:
      getUp(dt);
      break;
  }
  w.phi = wrapAngle(w.phi);
  bounce(dt);
  w.squash = approach(w.squash, 0, 8, dt);
  return pose();
}
