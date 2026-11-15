import { expect, test } from "bun:test";
import { createPet, pose } from "./pet";
import { FORMS, formExtent, formScale, poseBounds, poseRects } from "./shape";
import type { Stage, Branch } from "./life";

function make(stage: Stage, branch: Branch) { return { ...pose(createPet(1)), stage, branch, formScale: formScale(stage) }; }

test("bounds and extent contain every form and overlay", () => {
  for (const f of FORMS) for (const progress of [0, 0.9]) {
    const p = { ...make(f.stage, f.branch), scaleX: 1.12, scaleY: 1.12, progress, mouth: 1, asleep: true, sleepTime: 2, sparkle: 0.9, pellet: { x: 260, y: 290, size: 8 } };
    const bounds = poseBounds(p), extent = formExtent(f.stage, f.branch);
    for (const r of poseRects(p)) for (const x of [r.x, r.x + r.width]) for (const y of [r.y, r.y + r.height]) {
      expect(Math.hypot(x - p.x, y - p.y)).toBeLessThanOrEqual(extent);
      expect(x).toBeGreaterThanOrEqual(bounds.x); expect(x).toBeLessThanOrEqual(bounds.x + bounds.width);
      expect(y).toBeGreaterThanOrEqual(bounds.y); expect(y).toBeLessThanOrEqual(bounds.y + bounds.height);
    }
  }
});
test("forms have distinct silhouettes or colours", () => {
  const signatures = FORMS.map(f => { const rs = poseRects(make(f.stage, f.branch)); const body = rs.filter(r => r.part === "body"); return JSON.stringify([Math.max(...body.map(r => r.x + r.width)) - Math.min(...body.map(r => r.x)), Math.max(...body.map(r => r.y + r.height)) - Math.min(...body.map(r => r.y)), [...new Set(body.map(r => `${r.r},${r.g},${r.b}`))].sort()]); });
  expect(new Set(signatures).size).toBe(FORMS.length);
});
test("closed mouths and eggs", () => {
  const p = make("adult", "ember");
  expect(poseRects(p).filter(r => r.part === "face")).toHaveLength(2);
  expect(poseRects({ ...make("egg", "none"), mouth: 1 }).filter(r => r.part === "face")).toHaveLength(0);
});

test("shadow follows the floor of every form", () => {
  for (const f of FORMS) {
    const p = make(f.stage, f.branch);
    const rects = poseRects(p);
    const bottom = Math.max(...rects.filter(r => r.part === "body").map(r => r.y + r.height));
    const shadow = rects.find(r => r.part === "shadow")!;
    expect(shadow.y - bottom).toBeGreaterThanOrEqual(0);
    expect(shadow.y - bottom).toBeLessThanOrEqual(2);
  }
});
