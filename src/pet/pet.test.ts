import { FrameRenderer } from "../render";
import { describe, expect, test } from "bun:test";
import { SIZE, BODY_RADIUS, BODY_HALF_WIDTH, BODY_HEIGHT, ARM_EXTENT, ARM_TOP, ARM_HEIGHT, LEG_LENGTH, SHADOW_HALF_WIDTH, SHADOW_OFFSET, SHADOW_HEIGHT, CENTER, VISIBLE_RADIUS, createPet, pose, poseBounds, poseRects, step } from "./pet";

describe("pet", () => {
  test("pose bounds contain every painted rectangle", () => {
    let state = createPet(7);
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
    const p = { x: 10, y: 10, groundY: 10, scaleX: 1, scaleY: 1, facing: 1 as const, eyeOpen: 1, lookX: 0, brightness: 1 };
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
    let a = createPet(123), b = createPet(123);
    for (let i = 0; i < 1000; i++) {
      const original = a;
      const before = structuredClone(original);
      const input = i % 120 === 0 ? { tap: { x: i % 466, y: 30 } } : {};
      a = step(a, input, 1 / 30);
      b = step(b, input, 1 / 30);
      expect(a).toEqual(b);
      expect(original).toEqual(before);
    }
  });

  test("remains inside the visible circle for ten minutes", () => {
    let state = createPet(7), seed = 1;
    let worstOverflow = -Infinity;
    for (let i = 0; i < 18000; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const tap = i % 97 === 0 ? { x: seed % 467, y: (seed >>> 12) % 467 } : undefined;
      state = step(state, { tap }, 1 / 30);
      const p = pose(state);
      const top = p.y + BODY_RADIUS - (BODY_HEIGHT + LEG_LENGTH) * p.scaleY;
      const boxes = [
        [p.x - BODY_HALF_WIDTH * p.scaleX, top, p.x + BODY_HALF_WIDTH * p.scaleX, top + BODY_HEIGHT * p.scaleY],
        [p.x - ARM_EXTENT * p.scaleX, top + ARM_TOP * p.scaleY, p.x + ARM_EXTENT * p.scaleX, top + (ARM_TOP + ARM_HEIGHT) * p.scaleY],
        [p.x - BODY_HALF_WIDTH * p.scaleX, top + BODY_HEIGHT * p.scaleY, p.x + BODY_HALF_WIDTH * p.scaleX, top + (BODY_HEIGHT + LEG_LENGTH) * p.scaleY],
        [p.x - SHADOW_HALF_WIDTH, p.groundY + SHADOW_OFFSET, p.x + SHADOW_HALF_WIDTH, p.groundY + SHADOW_OFFSET + SHADOW_HEIGHT],
      ];
      for (const [left, upper, right, lower] of boxes) for (const x of [left, right]) for (const y of [upper, lower])
        worstOverflow = Math.max(worstOverflow, Math.hypot(x - CENTER, y - CENTER) - VISIBLE_RADIUS);
    }
    expect(worstOverflow).toBeLessThanOrEqual(0);
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
    expect(pose(state).y).toBeLessThan(state.y);
    expect(pose(state).scaleY).not.toBe(1);
    for (let i = 0; i < 10; i++) state = step(state, {}, 0.1);
    expect(state.mode).toBe("idle");
    expect(pose(state).eyeOpen).toBe(1);
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

  test("long idle step dims and corner taps flinch", () => {
    expect(pose(step(createPet(1), {}, 65)).brightness).toBeCloseTo(0.3);
    expect(step(createPet(1), { tap: { x: 280, y: 170 } }, 0).mode).toBe("flinch");
  });

  test("dim wandering continues at a slower speed", () => {
    let dim = step(createPet(4), {}, 65);
    let moved = false;
    for (let i = 0; i < 300; i++) {
      const before = dim;
      dim = step(dim, {}, 0.1);
      if (dim.x !== before.x || dim.y !== before.y) moved = true;
      expect(dim.speed).toBeLessThanOrEqual(28 * 0.3 + 0.01);
    }
    expect(moved).toBe(true);
    const walking = { ...createPet(1), mode: "wander" as const, targetX: CENTER + 80, speed: 0 };
    let bright = walking, slow = { ...walking, sinceTap: 65 };
    for (let i = 0; i < 10; i++) { bright = step(bright, {}, 0.1); slow = step(slow, {}, 0.1); }
    expect(slow.x).toBeGreaterThan(CENTER);
    expect(slow.x).toBeLessThan(bright.x);
  });

  test("clamps elapsed time", () => {
    expect(step(createPet(5), {}, 0.5)).toEqual({ ...step(createPet(5), {}, 0.1), sinceTap: 0.5 });
    expect(step(createPet(5), {}, -1)).toEqual(step(createPet(5), {}, 0));
  });
});
