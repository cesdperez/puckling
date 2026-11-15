import type { Stage, Branch } from "./life";
import { formScale, formExtent, poseRects } from "./shape";

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
const DIM_AFTER = 60;
const DIM_RAMP = 2;
const DIM_LEVEL = 0.3;
const BLINK_DURATION = 0.15;
const MAX_DT = 0.1;

export type PetMode = "idle" | "look" | "wander" | "walk" | "flinch" | "hop" | "eat" | "evolve" | "sleep" | "wobble";
export type PetLife = { stage: Stage; branch: Branch; fullness: number; progress: number; night: boolean };
export type PetInput = { tap?: { x: number; y: number }; life?: PetLife; meal?: boolean; evolved?: boolean };
export type PetState = {
  seed: number; x: number; y: number; targetX: number; targetY: number;
  mode: PetMode; modeTime: number; duration: number; time: number; sinceTap: number;
  blinkIn: number; blinkTime: number; facing: -1 | 1; speed: number;
  life: PetLife; oldStage: Stage; oldBranch: Branch; pelletX: number; pelletY: number; eating: boolean; wobbleIn: number;
};
export type PetPose = {
  x: number; y: number; groundY: number; scaleX: number; scaleY: number;
  facing: -1 | 1; eyeOpen: number; lookX: number; brightness: number;
  stage: Stage; branch: Branch; form: number; formScale: number; progress: number;
  mouth: number; asleep: boolean; sleepTime: number;
  pellet: { x: number; y: number; size: number } | undefined;
  sparkle: number; time: number;
};

function random(state: PetState): number {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 4294967296;
}

function reach(state: PetState): number {
  return VISIBLE_RADIUS - formExtent(state.life.stage, state.life.branch) - HOP_LIFT;
}

function target(state: PetState, x: number, y: number): void {
  const dx = x - CENTER, dy = y - CENTER;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const scale = distance > reach(state) ? reach(state) / distance : 1;
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
    life: { stage: "egg", branch: "none", fullness: 1, progress: 0, night: false },
    oldStage: "egg", oldBranch: "none", pelletX: 0, pelletY: 0, eating: false, wobbleIn: 6,
  };
  state.blinkIn = 2 + random(state) * 4;
  state.wobbleIn = 6 + random(state) * 4;
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

function setMode(state: PetState, mode: PetMode): void {
  state.mode = mode;
  state.modeTime = 0;
  state.speed = 0;
}

function applyTap(state: PetState, input: PetInput): void {
  if (!input.tap) return;
  state.sinceTap = 0;
  state.eating = false;
  if (state.life.stage === "egg") { setMode(state, "wobble"); return; }
  const rects = poseRects(pose(state));
  let hit = false;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (r.part === "body" && input.tap.x >= r.x - 12 && input.tap.x <= r.x + r.width + 12 &&
        input.tap.y >= r.y - 12 && input.tap.y <= r.y + r.height + 12) hit = true;
  }
  if (hit) setMode(state, "flinch");
  else { target(state, input.tap.x, input.tap.y); setMode(state, "walk"); }
}

function meal(state: PetState): void {
  if (state.mode === "sleep" || state.mode === "evolve" || state.mode === "eat") return;
  if (state.life.stage === "egg") { setMode(state, "wobble"); return; }
  const x = state.x + state.facing * 40, y = state.y + 45;
  const dx = x + 5 - CENTER, dy = y + 5 - CENTER;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const scale = distance > VISIBLE_RADIUS - 17 ? (VISIBLE_RADIUS - 17) / distance : 1;
  state.pelletX = CENTER + dx * scale - 5;
  state.pelletY = CENTER + dy * scale - 5;
  target(state, state.pelletX - state.facing * 20, state.y);
  state.eating = true;
  setMode(state, "eat");
}

function updateLife(state: PetState, input: PetInput): void {
  if (input.evolved) {
    state.oldStage = state.life.stage;
    state.oldBranch = state.life.branch;
    state.eating = false;
    setMode(state, "evolve");
  }
  if (input.life) state.life = { ...input.life };
  const x = state.x, y = state.y, tx = state.targetX, ty = state.targetY;
  target(state, x, y); state.x = state.targetX; state.y = state.targetY;
  target(state, tx, ty);
  if (state.mode === "sleep" && !state.life.night) idle(state);
  if (input.meal && !input.evolved) meal(state);
}

function nextMode(state: PetState): void {
  if (state.mode === "evolve" && state.modeTime >= 3) idle(state);
  else if (state.mode === "wobble" && state.modeTime >= 1) { idle(state); state.wobbleIn = 6 + random(state) * 4; }
  else if (state.mode === "eat" && !state.eating && state.modeTime >= 1.5) setMode(state, "hop");
  else if (state.mode === "idle" && state.life.night && state.sinceTap > 30) setMode(state, "sleep");
  else if (state.life.stage === "egg") {
    if (state.mode !== "sleep" && state.mode !== "evolve" && state.mode !== "wobble" && state.modeTime >= state.wobbleIn) setMode(state, "wobble");
  }
  else if (state.mode === "flinch" && state.modeTime >= 0.25) {
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
    } else if (choice < (state.life.fullness <= 0 ? 0.5 : 0.85)) {
      target(state, CENTER + (random(state) * 2 - 1) * reach(state), CENTER + (random(state) * 2 - 1) * reach(state));
      state.mode = "wander";
      state.modeTime = 0;
    } else {
      idle(state);
    }
  }
}

function move(state: PetState, delta: number): void {
  if (state.mode === "walk" || state.mode === "wander" || (state.mode === "eat" && state.eating)) {
    const dx = state.targetX - state.x, dy = state.targetY - state.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 0.5) {
      state.x = state.targetX;
      state.y = state.targetY;
      if (state.mode === "eat") { state.eating = false; state.modeTime = 0; state.speed = 0; }
      else if (state.mode === "walk") {
        state.mode = "look";
        state.modeTime = 0;
        state.duration = 2;
        state.speed = 0;
      } else idle(state);
    } else {
      if (Math.abs(dx) > 0.1) state.facing = dx < 0 ? -1 : 1;
      const maxSpeed = 28 * (state.life.fullness < 0.2 ? 0.6 : 1) * (1 - (1 - DIM_LEVEL) * dimming(state));
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
  updateLife(state, input);
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
  if (state.mode === "wobble") squash = 0.04 * Math.sin(Math.PI * state.modeTime);
  if (state.mode === "sleep") squash = 0.08 + 0.02 * Math.sin(state.modeTime * Math.PI / 2);
  if (state.mode === "evolve") squash = 0.15 * (1 - Math.abs(1 - state.modeTime / 1.5));
  const evolving = state.mode === "evolve";
  const phase = Math.min(1, state.modeTime / 3);
  const shownStage = evolving && phase < 0.5 ? state.oldStage : state.life.stage;
  const shownBranch = evolving && phase < 0.5 ? state.oldBranch : state.life.branch;
  const sleepFade = state.mode === "sleep" ? Math.min(1, state.modeTime / 2) : 0;
  const blinking = state.blinkTime > 0 ? Math.abs(state.blinkTime - BLINK_DURATION / 2) / (BLINK_DURATION / 2) : 1;
  return {
    x: state.x + (state.mode === "wobble" ? 3 * Math.sin(state.modeTime * Math.PI * 4) : 0), y: state.y - lift, groundY: state.y,
    scaleX: 1 + squash, scaleY: (1 - squash) * (state.life.fullness < 0.2 ? 0.96 : 1), facing: state.facing,
    eyeOpen: state.mode === "flinch" || state.mode === "sleep" ? 0 : Math.min(state.life.fullness < 0.2 ? 0.55 : 1, blinking),
    lookX: state.mode === "look" ? Math.sin(state.modeTime * 1.5) * 4 :
      state.mode === "walk" || state.mode === "wander" ? state.facing * 3 : 0,
    brightness: (1 - (1 - DIM_LEVEL) * dimming(state)) * (1 - sleepFade) + 0.2 * sleepFade,
    stage: shownStage, branch: shownBranch, form: evolving ? Math.abs(1 - phase * 2) : 1,
    formScale: evolving ? formScale(state.oldStage) + (formScale(state.life.stage) - formScale(state.oldStage)) * phase : formScale(state.life.stage),
    progress: state.life.progress, mouth: state.mode === "eat" && !state.eating ? Math.abs(Math.sin(state.modeTime * Math.PI * 2)) : 0,
    asleep: state.mode === "sleep", sleepTime: state.mode === "sleep" ? state.modeTime : 0,
    pellet: state.mode === "eat" ? { x: state.pelletX, y: state.pelletY, size: state.eating ? 10 : 10 * Math.max(0, 1 - state.modeTime / 1.5) } : undefined,
    sparkle: evolving ? phase : 0, time: state.time,
  };
}
