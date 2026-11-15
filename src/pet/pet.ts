export const SIZE = 466;
export const CENTER = SIZE / 2;
export const VISIBLE_RADIUS = 233;
export const BODY_RADIUS = 64;
export const BODY_HALF_WIDTH = BODY_RADIUS * 0.75;
export const BODY_HEIGHT = BODY_RADIUS * 1.59375;
export const ARM_EXTENT = BODY_RADIUS;
export const ARM_TOP = BODY_RADIUS * 0.796875;
export const ARM_HEIGHT = BODY_RADIUS * 0.40625;
export const LEG_LENGTH = BODY_RADIUS * 0.40625;
export const SHADOW_HALF_WIDTH = BODY_RADIUS * 0.53125;
export const SHADOW_OFFSET = BODY_RADIUS * 1.015625;
export const SHADOW_HEIGHT = BODY_RADIUS * 0.0625;
export const HOP_LIFT = BODY_RADIUS * 0.3125;
const BOUNDS_MARGIN = 2;
const MAX_SCALE = 1.12;
const DRAW_REACH = Math.max(
  Math.sqrt(ARM_EXTENT * ARM_EXTENT + BODY_RADIUS * BODY_RADIUS) * MAX_SCALE + HOP_LIFT,
  Math.sqrt(SHADOW_HALF_WIDTH * SHADOW_HALF_WIDTH + (SHADOW_OFFSET + SHADOW_HEIGHT) * (SHADOW_OFFSET + SHADOW_HEIGHT)),
);
const REACH = VISIBLE_RADIUS - DRAW_REACH;
const DIM_AFTER = 60;
const DIM_RAMP = 2;
const DIM_LEVEL = 0.3;
const BLINK_DURATION = 0.15;
const MAX_DT = 0.1;

export type PetMode = "idle" | "look" | "wander" | "walk" | "flinch" | "hop";
export type PetInput = { tap?: { x: number; y: number } };
export type PetState = {
  seed: number; x: number; y: number; targetX: number; targetY: number;
  mode: PetMode; modeTime: number; duration: number; time: number; sinceTap: number;
  blinkIn: number; blinkTime: number; facing: -1 | 1; speed: number;
};
export type PetPose = {
  x: number; y: number; groundY: number; scaleX: number; scaleY: number;
  facing: -1 | 1; eyeOpen: number; lookX: number; brightness: number;
};

export type Bounds = { x: number; y: number; width: number; height: number };
export type PoseRect = Bounds & { part: "shadow" | "body" | "eyes" };

export function poseRects(p: PetPose): PoseRect[] {
  const sx = p.scaleX, sy = p.scaleY, lift = p.groundY - p.y;
  const left = p.x - ARM_EXTENT * sx;
  const top = p.y + BODY_RADIUS - (BODY_HEIGHT + LEG_LENGTH) * sy;
  const eyeHeight = Math.max(3, 26 * p.eyeOpen) * sy;
  const eyeShift = p.lookX + p.facing * 2, eyeTop = top + 38 * sy - eyeHeight / 2;
  return [
    { part: "shadow", x: p.x - SHADOW_HALF_WIDTH + lift / 2, y: p.groundY + SHADOW_OFFSET, width: 2 * SHADOW_HALF_WIDTH - lift, height: SHADOW_HEIGHT },
    { part: "body", x: p.x - BODY_HALF_WIDTH * sx, y: top, width: 2 * BODY_HALF_WIDTH * sx, height: BODY_HEIGHT * sy },
    { part: "body", x: left, y: top + ARM_TOP * sy, width: (ARM_EXTENT - BODY_HALF_WIDTH + 1) * sx, height: ARM_HEIGHT * sy },
    { part: "body", x: p.x + (BODY_HALF_WIDTH - 1) * sx, y: top + ARM_TOP * sy, width: (ARM_EXTENT - BODY_HALF_WIDTH + 1) * sx, height: ARM_HEIGHT * sy },
    ...[24, 40, 80, 96].map(x => ({ part: "body" as const, x: left + x * sx, y: top + BODY_HEIGHT * sy, width: 8 * sx, height: LEG_LENGTH * sy })),
    ...[32, 88].map(x => ({ part: "eyes" as const, x: left + (x + eyeShift) * sx, y: eyeTop, width: 8 * sx, height: eyeHeight })),
  ];
}

export function poseBounds(p: PetPose): Bounds {
  const rects = poseRects(p);
  const left = Math.min(...rects.map(r => r.x));
  const top = Math.min(...rects.map(r => r.y));
  const right = Math.max(...rects.map(r => r.x + r.width));
  const bottom = Math.max(...rects.map(r => r.y + r.height));
  const clamp = (value: number) => Math.max(0, Math.min(SIZE, value));
  const x = clamp(Math.floor(left - BOUNDS_MARGIN));
  const y = clamp(Math.floor(top - BOUNDS_MARGIN));
  return { x, y, width: clamp(Math.ceil(right + BOUNDS_MARGIN)) - x, height: clamp(Math.ceil(bottom + BOUNDS_MARGIN)) - y };
}

function random(state: PetState): number {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

function target(state: PetState, x: number, y: number): void {
  const dx = x - CENTER, dy = y - CENTER;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const scale = distance > REACH ? REACH / distance : 1;
  state.targetX = CENTER + dx * scale;
  state.targetY = CENTER + dy * scale;
}

function idle(state: PetState): void {
  state.mode = "idle";
  state.modeTime = 0;
  state.duration = 2 + random(state) * 3;
  state.speed = 0;
}

export function createPet(seed: number): PetState {
  const state: PetState = {
    seed: seed >>> 0, x: CENTER, y: CENTER, targetX: CENTER, targetY: CENTER,
    mode: "idle", modeTime: 0, duration: 3, time: 0, sinceTap: 0,
    blinkIn: 2, blinkTime: 0, facing: 1, speed: 0,
  };
  state.blinkIn = 2 + random(state) * 4;
  return state;
}

function advanceClocks(state: PetState, dt: number, delta: number): void {
  state.time += delta;
  state.sinceTap += Math.max(0, dt);
  state.modeTime += delta;
}

function dimming(state: PetState): number {
  return Math.min(1, Math.max(0, (state.sinceTap - DIM_AFTER) / DIM_RAMP));
}

function updateBlink(state: PetState, delta: number): void {
  if (state.blinkTime > 0) {
    state.blinkTime = Math.max(0, state.blinkTime - delta);
  } else {
    state.blinkIn -= delta;
    if (state.blinkIn <= 0) {
      state.blinkTime = BLINK_DURATION;
      state.blinkIn = 2 + random(state) * 4;
    }
  }
}

function applyTap(state: PetState, input: PetInput): void {
  if (input.tap) {
    state.sinceTap = 0;
    const current = pose(state);
    const dx = input.tap.x - current.x;
    if (Math.abs(dx) <= BODY_HALF_WIDTH * current.scaleX + 12 &&
        input.tap.y >= current.y + BODY_RADIUS - (BODY_HEIGHT + LEG_LENGTH) * current.scaleY - 12 &&
        input.tap.y <= current.y + BODY_RADIUS - LEG_LENGTH * current.scaleY + 12) {
      state.mode = "flinch";
      state.modeTime = 0;
      state.speed = 0;
    } else {
      target(state, input.tap.x, input.tap.y);
      state.mode = "walk";
      state.modeTime = 0;
      state.speed = 0;
    }
  }
}

function nextMode(state: PetState): void {
  if (state.mode === "flinch" && state.modeTime >= 0.25) {
    state.mode = "hop";
    state.modeTime = 0;
  } else if (state.mode === "hop" && state.modeTime >= 0.8) {
    idle(state);
  } else if ((state.mode === "idle" || state.mode === "look") && state.modeTime >= state.duration) {
    const choice = random(state);
    if (choice < 0.4) {
      state.mode = "look";
      state.modeTime = 0;
      state.duration = 2 + random(state) * 2;
    } else if (choice < 0.85) {
      target(state, CENTER + (random(state) * 2 - 1) * REACH, CENTER + (random(state) * 2 - 1) * REACH);
      state.mode = "wander";
      state.modeTime = 0;
    } else {
      idle(state);
    }
  }
}

function move(state: PetState, delta: number): void {
  if (state.mode === "walk" || state.mode === "wander") {
    const dx = state.targetX - state.x, dy = state.targetY - state.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 0.5) {
      state.x = state.targetX;
      state.y = state.targetY;
      if (state.mode === "walk") {
        state.mode = "look";
        state.modeTime = 0;
        state.duration = 2;
        state.speed = 0;
      } else idle(state);
    } else {
      if (Math.abs(dx) > 0.1) state.facing = dx < 0 ? -1 : 1;
      const maxSpeed = 28 * (1 - (1 - DIM_LEVEL) * dimming(state));
      const desired = Math.min(maxSpeed, Math.max(3, distance * 2));
      state.speed += (desired - state.speed) * Math.min(1, delta * 3);
      const movement = Math.min(distance, state.speed * delta);
      state.x += dx / distance * movement;
      state.y += dy / distance * movement;
    }
  }
}

export function step(previous: PetState, input: PetInput, dt: number): PetState {
  const state = { ...previous };
  const delta = dt > 0 ? Math.min(dt, MAX_DT) : 0;
  advanceClocks(state, dt, delta);
  updateBlink(state, delta);
  applyTap(state, input);
  nextMode(state);
  move(state, delta);
  return state;
}

export function pose(state: PetState): PetPose {
  let lift = 0, squash = 0;
  if (state.mode === "flinch") squash = 0.12;
  if (state.mode === "hop") {
    const phase = Math.min(1, state.modeTime / 0.8);
    lift = HOP_LIFT * Math.sin(Math.PI * phase);
    squash = phase < 0.12 ? 0.1 * (1 - phase / 0.12) : phase > 0.85 ? 0.12 * (phase - 0.85) / 0.15 : -0.05;
  } else if (state.mode === "idle" || state.mode === "look") {
    squash = 0.015 * Math.sin(state.time * 2);
  } else if (state.mode === "walk" || state.mode === "wander") {
    lift = 2 * Math.abs(Math.sin(state.time * 5));
  }
  const blinking = state.blinkTime > 0 ? Math.abs(state.blinkTime - BLINK_DURATION / 2) / (BLINK_DURATION / 2) : 1;
  return {
    x: state.x, y: state.y - lift, groundY: state.y,
    scaleX: 1 + squash, scaleY: 1 - squash, facing: state.facing,
    eyeOpen: state.mode === "flinch" ? 0 : Math.min(1, blinking),
    lookX: state.mode === "look" ? Math.sin(state.modeTime * 1.5) * 4 :
      state.mode === "walk" || state.mode === "wander" ? state.facing * 3 : 0,
    brightness: 1 - (1 - DIM_LEVEL) * dimming(state),
  };
}
