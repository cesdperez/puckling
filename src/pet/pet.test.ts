import { FrameRenderer } from "../render";
import { describe, expect, test } from "bun:test";
import { SIZE, CENTER, VISIBLE_RADIUS, createPet, pose, step } from "./pet";

import { FORMS, formScale, poseBounds, poseRects } from "./shape";

const adult = { stage: "adult" as const, branch: "ember" as const, fullness: 1, progress: 0, night: false };
function walkingPet(seed: number) { return step(createPet(seed), { life: adult }, 0); }

describe("pet", () => {
  test("pose bounds contain every painted rectangle", () => {
    let state = walkingPet(7);
    const modes = new Set<string>();
    let worstOverflow = -Infinity;
    for (let i = 0; i < 6000; i++) {
      const tap = i % 300 === 0 ? { x: state.x, y: state.y } :
        i % 300 === 150 ? { x: (i * 17) % SIZE, y: (i * 31) % SIZE } : undefined;
      state = step(state, { tap }, 1 / 30);
      modes.add(state.mode);
      const p = pose(state), bounds = poseBounds(p);
      for (const rect of poseRects(p)) {
        worstOverflow = Math.max(worstOverflow, bounds.x - rect.x, bounds.y - rect.y,
          rect.x + rect.width - bounds.x - bounds.width, rect.y + rect.height - bounds.y - bounds.height);
      }
      expect(bounds.width * bounds.height).toBeLessThan(SIZE * SIZE / 4);
    }
    expect(worstOverflow).toBeLessThanOrEqual(0);
    expect(modes.has("flinch")).toBe(true);
    expect(modes.has("hop")).toBe(true);
  });

  test("bounds clamp at a canvas corner", () => {
    const p = { ...pose(walkingPet(7)), x: 10, y: 10, groundY: 10 };
    const bounds = poseBounds(p);
    expect(bounds.x).toBe(0);
    expect(bounds.y).toBe(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(SIZE);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(SIZE);
  });

  test("clears each frame on its own canvas", () => {
    const calls: number[][] = [];
    const ctx = { fillStyle: "", fillRect: (x: number, y: number, width: number, height: number) => calls.push([x, y, width, height]) };
    const other = { ...ctx, fillRect: ctx.fillRect };
    const renderer = new FrameRenderer(), otherRenderer = new FrameRenderer();
    let state = createPet(7);
    for (let i = 0; i < 100; i++) {
      state = step(state, i === 20 ? { tap: { x: SIZE, y: SIZE } } : {}, 1 / 30);
      const p = pose(state);
      calls.length = 0;
      renderer.draw(ctx as Parameters<FrameRenderer["draw"]>[0], p);
      const [clear, ...paint] = calls;
      if (i === 0) expect(clear).toEqual([0, 0, SIZE, SIZE]);
      expect(paint).toEqual(poseRects(p).map(({ x, y, width, height }) => [x, y, width, height]));
      for (const [x, y, width, height] of paint) {
        expect(x).toBeGreaterThanOrEqual(clear[0]);
        expect(y).toBeGreaterThanOrEqual(clear[1]);
        expect(x + width).toBeLessThanOrEqual(clear[0] + clear[2]);
        expect(y + height).toBeLessThanOrEqual(clear[1] + clear[3]);
      }
    }
    calls.length = 0;
    otherRenderer.draw(other as Parameters<FrameRenderer["draw"]>[0], pose(state));
    expect(calls[0]).toEqual([0, 0, SIZE, SIZE]);
    calls.length = 0;
    renderer.draw(ctx as Parameters<FrameRenderer["draw"]>[0], { ...pose(state), brightness: 0.3 });
    expect(calls[0]).toEqual([0, 0, SIZE, SIZE]);
  });

  test("is deterministic and does not mutate its input", () => {
    let a = walkingPet(123), b = walkingPet(123);
    for (let i = 0; i < 1000; i++) {
      const original = a;
      const before = structuredClone(original);
      const input = i % 120 === 0 ? { tap: { x: i % 466, y: 30 } } : {};
      const inputBefore = structuredClone(input);
      a = step(a, input, 1 / 30);
      expect(input).toEqual(inputBefore);
      b = step(b, input, 1 / 30);
      expect(a).toEqual(b);
      expect(original).toEqual(before);
    }
  });

  test("remains inside the visible circle for ten minutes", () => {
    let state = walkingPet(7), seed = 1;
    let worstOverflow = -Infinity;
    for (let i = 0; i < 18000; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const tap = i % 97 === 0 ? { x: seed % 467, y: (seed >>> 12) % 467 } : undefined;
      state = step(state, { tap }, 1 / 30);
      const p = pose(state);
      for (const r of poseRects(p)) for (const x of [r.x, r.x + r.width]) for (const y of [r.y, r.y + r.height])
        worstOverflow = Math.max(worstOverflow, Math.hypot(x - CENTER, y - CENTER) - VISIBLE_RADIUS);
    }
    expect(worstOverflow).toBeLessThanOrEqual(0);
    for (const [x, y] of [[0, 0], [466, 0], [0, 466], [466, 466]]) {
      state = step(state, { tap: { x, y } }, 0);
      expect(Math.hypot(state.targetX - CENTER, state.targetY - CENTER)).toBeLessThan(VISIBLE_RADIUS);
    }
  });

  test("petting flinches, hops, then calms", () => {
    let state = step(walkingPet(1), { tap: { x: CENTER, y: CENTER } }, 0);
    expect(state.mode).toBe("flinch");
    expect(pose(state).eyeOpen).toBe(0);
    for (let i = 0; i < 4; i++) state = step(state, {}, 0.1);
    expect(state.mode).toBe("hop");
    expect(pose(state).y).toBeLessThan(state.y);
    expect(pose(state).scaleY).not.toBe(1);
    for (let i = 0; i < 10; i++) state = step(state, {}, 0.1);
    expect(state.mode).toBe("idle");
    expect(pose(state).eyeOpen).toBe(1);
  });

  test("walks to a clamped tap", () => {
    let state = step(walkingPet(2), { tap: { x: 466, y: 466 } }, 0);
    expect(state.mode).toBe("walk");
    const targetX = state.targetX, targetY = state.targetY;
    for (let i = 0; i < 500 && state.mode === "walk"; i++) state = step(state, {}, 0.1);
    expect(state.mode).toBe("look");
    expect(state.x).toBeCloseTo(targetX);
    expect(state.y).toBeCloseTo(targetY);
  });

  test("blinks within six seconds", () => {
    let state = walkingPet(12), blinked = false;
    for (let i = 0; i < 60; i++) {
      state = step(state, {}, 0.1);
      if (pose(state).eyeOpen < 1) blinked = true;
    }
    expect(blinked).toBe(true);
  });

  test("dims after inactivity and wakes immediately", () => {
    let state = walkingPet(4);
    for (let i = 0; i < 630; i++) state = step(state, {}, 0.1);
    expect(pose(state).brightness).toBeCloseTo(0.3);
    state = step(state, { tap: { x: CENTER, y: CENTER } }, 0);
    expect(pose(state).brightness).toBe(1);
  });

  test("long idle step dims and corner taps flinch", () => {
    expect(pose(step(walkingPet(1), {}, 65)).brightness).toBeCloseTo(0.3);
    expect(step(walkingPet(1), { tap: { x: 280, y: 170 } }, 0).mode).toBe("flinch");
  });

  test("dim wandering continues at a slower speed", () => {
    let dim = step(walkingPet(4), {}, 65);
    let moved = false;
    for (let i = 0; i < 300; i++) {
      const before = dim;
      dim = step(dim, {}, 0.1);
      if (dim.x !== before.x || dim.y !== before.y) moved = true;
      expect(dim.speed).toBeLessThanOrEqual(28 * 0.3 + 0.01);
    }
    expect(moved).toBe(true);
    const walking = { ...walkingPet(1), mode: "wander" as const, targetX: CENTER + 80, speed: 0 };
    let bright = walking, slow = { ...walking, sinceTap: 65 };
    for (let i = 0; i < 10; i++) { bright = step(bright, {}, 0.1); slow = step(slow, {}, 0.1); }
    expect(slow.x).toBeGreaterThan(CENTER);
    expect(slow.x).toBeLessThan(bright.x);
  });

  test("all forms stay inside the circle", () => {
    for (const { stage, branch } of FORMS) {
      let state = createPet(8), seed = 42;
      for (let i = 0; i < 18000; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        const life = { stage, branch, fullness: 0.7, progress: 0.6, night: i % 6000 >= 3000 };
        state = step(state, { life, tap: i % 251 === 0 ? { x: seed % 466, y: (seed >>> 10) % 466 } : undefined, meal: i % 479 === 0, evolved: i % 4000 === 0 }, 1 / 30);
        for (const r of poseRects(pose(state))) for (const x of [r.x, r.x + r.width]) for (const y of [r.y, r.y + r.height]) expect(Math.hypot(x - CENTER, y - CENTER)).toBeLessThanOrEqual(VISIBLE_RADIUS + 0.001);
      }
    }
  });

  test("meal, evolution and sleep", () => {
    let state = step(walkingPet(1), { meal: true }, 0);
    expect(pose(state).pellet).toBeDefined();
    state = step(state, { meal: true }, 0);
    for (let i = 0; i < 240 && state.mode !== "idle"; i++) state = step(state, {}, 1 / 30);
    expect(state.mode).toBe("idle"); expect(pose(state).pellet).toBeUndefined();
    state = step(state, { life: { ...adult, stage: "final" }, evolved: true }, 0);
    expect(pose(state).stage).toBe("adult");
    for (let i = 0; i < 46; i++) state = step(state, {}, 1 / 30);
    expect(pose(state).stage).toBe("final");
    for (let i = 0; i < 46; i++) state = step(state, {}, 1 / 30);
    expect(state.mode).toBe("idle"); expect(pose(state).formScale).toBe(1.1);
    state = step(state, { life: { ...adult, night: true } }, 0);
    for (let i = 0; i < 1200; i++) state = step(state, {}, 1 / 30);
    expect(pose(state).asleep).toBe(true); expect(pose(state).brightness).toBeLessThanOrEqual(0.2); expect(pose(state).eyeOpen).toBe(0);
    const day = step(state, { life: { ...adult, night: false } }, 0); expect(pose(day).asleep).toBe(false);
    state = step(state, { tap: { x: CENTER, y: CENTER } }, 0); expect(pose(state).asleep).toBe(false);
  });

  test("egg wobbles after a tap and on its timer without moving", () => {
    for (const timed of [false, true]) {
      let state = createPet(3);
      if (timed) state = { ...state, wobbleIn: 0 };
      state = step(state, timed ? {} : { tap: { x: 0, y: 0 } }, 0);
      expect(state.mode).toBe("wobble");
      state = step(state, {}, 0.05);
      expect(state.x).toBe(CENTER);
      expect(pose(state).x).not.toBe(state.x);
    }
  });

  test("meals start at the current form's floor", () => {
    for (const f of FORMS.filter(f => f.stage !== "egg")) {
      const state = step(createPet(1), { life: { ...adult, ...f }, meal: true }, 0);
      expect(state.pelletY + 10).toBeCloseTo(state.y + 64 * formScale(f.stage));
    }
  });

  test("egg stays put and hunger slows walking", () => {
    let egg = createPet(3);
    for (let i = 0; i < 1800; i++) egg = step(egg, { tap: i % 100 === 0 ? { x: 0, y: 0 } : undefined, meal: i % 200 === 0 }, 1 / 30);
    expect(egg.x).toBe(CENTER); expect(egg.y).toBe(CENTER);
    let fed = step(walkingPet(5), { tap: { x: 466, y: 233 } }, 0);
    let hungry = step(walkingPet(5), { life: { ...adult, fullness: 0.1 }, tap: { x: 466, y: 233 } }, 0);
    for (let i = 0; i < 30; i++) { fed = step(fed, {}, 1 / 30); hungry = step(hungry, {}, 1 / 30); }
    expect(hungry.x).toBeLessThan(fed.x);
  });

  test("clamps elapsed time", () => {
    expect(step(walkingPet(5), {}, 0.5)).toEqual({ ...step(walkingPet(5), {}, 0.1), sinceTap: 0.5 });
    expect(step(walkingPet(5), {}, -1)).toEqual(step(walkingPet(5), {}, 0));
  });
});
