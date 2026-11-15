import { describe, expect, test } from "bun:test";
import { BODY_RADIUS, CENTER, VISIBLE_RADIUS, createPet, pose, step } from "./pet";

describe("pet", () => {
  test("is deterministic and does not mutate its input", () => {
    let a = createPet(123), b = createPet(123);
    for (let i = 0; i < 1000; i++) {
      const before = structuredClone(a);
      const input = i % 120 === 0 ? { tap: { x: i % 466, y: 30 } } : {};
      a = step(a, input, 1 / 30);
      b = step(b, input, 1 / 30);
      expect(a).toEqual(b);
      expect(before).toEqual(i === 0 ? createPet(123) : previous);
      previous = structuredClone(a);
    }
  });
  let previous = createPet(123);

  test("remains inside the visible circle for ten minutes", () => {
    let state = createPet(7), seed = 1;
    for (let i = 0; i < 18000; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const tap = i % 97 === 0 ? { x: seed % 467, y: (seed >>> 12) % 467 } : undefined;
      state = step(state, { tap }, 1 / 30);
      const p = pose(state);
      expect(Math.hypot(p.x - CENTER, p.y - CENTER) + BODY_RADIUS * Math.max(p.scaleX, p.scaleY) + 8).toBeLessThanOrEqual(VISIBLE_RADIUS);
    }
    for (const [x, y] of [[0, 0], [466, 0], [0, 466], [466, 466]]) {
      state = step(state, { tap: { x, y } }, 0);
      expect(Math.hypot(state.targetX - CENTER, state.targetY - CENTER) + BODY_RADIUS).toBeLessThan(VISIBLE_RADIUS);
    }
  });

  test("petting flinches, hops, then calms", () => {
    let state = step(createPet(1), { tap: { x: CENTER, y: CENTER } }, 0);
    expect(state.mode).toBe("flinch");
    expect(pose(state).eyeOpen).toBe(0);
    for (let i = 0; i < 4; i++) state = step(state, {}, 0.1);
    expect(state.mode).toBe("hop");
    for (let i = 0; i < 10; i++) state = step(state, {}, 0.1);
    expect(state.mode).toBe("idle");
  });

  test("walks to a clamped tap", () => {
    let state = step(createPet(2), { tap: { x: 466, y: 466 } }, 0);
    expect(state.mode).toBe("walk");
    const targetX = state.targetX, targetY = state.targetY;
    for (let i = 0; i < 500 && state.mode === "walk"; i++) state = step(state, {}, 0.1);
    expect(state.mode).toBe("look");
    expect(state.x).toBeCloseTo(targetX);
    expect(state.y).toBeCloseTo(targetY);
  });

  test("blinks within six seconds", () => {
    let state = createPet(12), blinked = false;
    for (let i = 0; i < 60; i++) {
      state = step(state, {}, 0.1);
      if (pose(state).eyeOpen < 1) blinked = true;
    }
    expect(blinked).toBe(true);
  });

  test("dims after inactivity and wakes immediately", () => {
    let state = createPet(4);
    for (let i = 0; i < 630; i++) state = step(state, {}, 0.1);
    expect(pose(state).brightness).toBeCloseTo(0.3);
    state = step(state, { tap: { x: CENTER, y: CENTER } }, 0);
    expect(pose(state).brightness).toBe(1);
  });

  test("clamps elapsed time", () => {
    expect(step(createPet(5), {}, 0.5)).toEqual(step(createPet(5), {}, 0.1));
    expect(step(createPet(5), {}, -1)).toEqual(step(createPet(5), {}, 0));
  });
});
