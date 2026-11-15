import { SIZE, type PetPose } from "./pet";
import type { Stage, Branch } from "./life";

export type Bounds = { x: number; y: number; width: number; height: number };
export type PoseRect = Bounds & { part: "shadow" | "body" | "face" | "fx"; r: number; g: number; b: number };
type Color = { r: number; g: number; b: number };
type Drawing = { p: PetPose; rects: PoseRect[]; radius: number; color: Color };

export function formScale(stage: Stage): number {
  if (stage === "egg") return 0.75;
  if (stage === "baby") return 0.5;
  if (stage === "child") return 0.7;
  if (stage === "teen") return 0.85;
  if (stage === "final") return 1.1;
  return 1;
}

/** Excludes the pellet, which is bounded separately. */
export function formExtent(stage: Stage, branch: Branch): number {
  if (stage === "final") return 150;
  if (stage === "adult" && branch === "frost") return 130;
  return 125;
}

function color(p: PetPose): Color {
  if (p.stage === "egg") return { r: 239, g: 228, b: 207 };
  if (p.stage === "baby") return { r: 240, g: 160, b: 122 };
  if (p.stage === "child") return { r: 224, g: 138, b: 104 };
  if (p.stage === "adult" || p.stage === "final") {
    if (p.branch === "frost") return { r: 127, g: 178, b: 229 };
    if (p.branch === "moss") return { r: 124, g: 191, b: 106 };
    if (p.branch === "night") return { r: 138, g: 118, b: 224 };
    if (p.branch === "swarm") return { r: 224, g: 122, b: 154 };
  }
  return { r: 217, g: 119, b: 87 };
}

function rect(d: Drawing, x: number, y: number, w: number, h: number, part: "body" | "face" | "fx", c: Color): void {
  const sx = d.radius * d.p.scaleX, sy = d.radius * d.p.scaleY;
  d.rects.push({ x: d.p.x + x * sx, y: d.p.y + y * sy, width: w * sx, height: h * sy, part, r: c.r, g: c.g, b: c.b });
}
function body(d: Drawing, x: number, y: number, w: number, h: number): void { rect(d, x, y, w, h, "body", d.color); }
function face(d: Drawing, x: number, y: number, w: number, h: number): void { rect(d, x, y, w, h, "face", { r: 0, g: 0, b: 0 }); }
function legs(d: Drawing, count: number, width: number, y: number, height: number): void {
  for (let i = 0; i < count; i++) body(d, -width / 2 + (i + 0.5) * width / count - 0.06, y, 0.12, height);
}
function eyes(d: Drawing, y: number, spacing: number, width: number, height: number): void {
  const h = d.p.asleep ? 3 / d.radius : Math.max(3 / d.radius, height * d.p.eyeOpen);
  const shift = (d.p.lookX + d.p.facing * 2) / 64;
  for (let i = -1; i <= 1; i += 2) {
    const x = i * spacing - width / 2 + shift;
    face(d, x, y - h / 2, width, h);
    if (!d.p.asleep && d.p.eyeOpen > 0.5 && (d.p.stage === "adult" || d.p.stage === "final") && d.p.branch === "night") rect(d, x + 0.02, y - h / 2 + 0.03, 3 / d.radius, 3 / d.radius, "body", { r: 255, g: 255, b: 255 });
  }
}
function egg(d: Drawing): void {
  body(d, -0.28, -1, 0.56, 0.16); body(d, -0.48, -0.84, 0.96, 0.25);
  body(d, -0.62, -0.59, 1.24, 0.37); body(d, -0.72, -0.22, 1.44, 0.55);
  body(d, -0.65, 0.33, 1.3, 0.4); body(d, -0.45, 0.73, 0.9, 0.27);
  const c = { r: 217, g: 119, b: 87 };
  rect(d, -0.35, -0.35, 6 / d.radius, 6 / d.radius, "body", c); rect(d, 0.22, 0, 6 / d.radius, 6 / d.radius, "body", c); rect(d, -0.18, 0.45, 6 / d.radius, 6 / d.radius, "body", c);
  const crack = { r: 58, g: 42, b: 34 };
  for (let j = 0; j < 2; j++) if (d.p.progress >= (j === 0 ? 0.5 : 0.8)) for (let i = 0; i < 3; i++) rect(d, -0.22 + i * 0.13 + j * 0.3, -0.72 + i % 2 * 0.08, 0.14, 0.055, "body", crack);
}
function classic(d: Drawing, arms: number): void {
  body(d, -0.75, -1, 1.5, 1.59375);
  if (arms > 0) { body(d, -0.75 - arms, -0.203125, arms + 0.02, 0.40625); body(d, 0.73, -0.203125, arms + 0.02, 0.40625); }
  legs(d, 4, 1, 0.59375, 0.40625);
}
function baby(d: Drawing): void { body(d, -0.75, -0.35, 1.5, 1.05); body(d, -0.55, -0.5, 1.1, 0.2); legs(d, 2, 0.9, 0.7, 0.3); }
function frost(d: Drawing): void { body(d, -0.6, -0.95, 1.2, 1.65); legs(d, 2, 0.8, 0.7, 0.3); body(d, -0.03, -1.23, 0.06, 0.28); body(d, -0.08, -1.34, 0.16, 0.16); }
function moss(d: Drawing): void {
  body(d, -0.95, -0.45, 1.9, 1.2); legs(d, 6, 1.7, 0.75, 0.25);
  const c = { r: 79, g: 154, b: 69 };
  rect(d, -0.04, -0.75, 0.08, 0.3, "body", c); rect(d, -0.35, -0.75, 0.3, 0.12, "body", c); rect(d, 0.04, -0.84, 0.3, 0.12, "body", c);
}
function night(d: Drawing): void {
  classic(d, 0); const c = { r: 93, g: 75, b: 176 };
  rect(d, -0.98, -0.65, 0.24, 0.9, "body", c); rect(d, -1.13, -0.4, 0.16, 0.45, "body", c);
  rect(d, 0.74, -0.65, 0.24, 0.9, "body", c); rect(d, 0.97, -0.4, 0.16, 0.45, "body", c);
}
function swarm(d: Drawing): void {
  body(d, -0.75, -0.4, 1.5, 1.1); legs(d, 4, 1, 0.7, 0.3);
  for (let i = 0; i < 3; i++) {
    const x = -0.78 + i * 0.53, y = -0.86 + Math.sin(d.p.time * 2 + i * 2) * 2 / d.radius;
    body(d, x, y, 0.5, 0.5);
    const h = d.p.asleep ? 3 / d.radius : 0.14 * d.p.eyeOpen;
    face(d, x + 0.09, y + 0.18, 0.07, h); face(d, x + 0.33, y + 0.18, 0.07, h);
    if (i === 1 && d.p.mouth > 0) face(d, x + 0.2, y + 0.36, 0.1, 0.12 * d.p.mouth);
  }
}
function creature(d: Drawing): void {
  const p = d.p;
  if (p.stage === "egg") { egg(d); return; }
  if (p.stage === "baby") baby(d);
  else if (p.stage === "child") classic(d, 0.12);
  else if (p.stage === "teen") { classic(d, 0.25); body(d, -0.18, -1.17, 0.14, 0.2); body(d, -0.04, -1.25, 0.14, 0.28); }
  else if (p.branch === "frost") frost(d);
  else if (p.branch === "moss") moss(d);
  else if (p.branch === "night") night(d);
  else if (p.branch === "swarm") swarm(d);
  else { classic(d, 0.25); body(d, -0.75, -1.16, 0.25, 0.2); body(d, 0.5, -1.16, 0.25, 0.2); body(d, p.facing === 1 ? -1.1 : 0.75, 0.3, 0.35, 0.18); }
  if (p.branch !== "swarm" || (p.stage !== "adult" && p.stage !== "final")) {
    const y = p.stage === "baby" ? 0 : p.branch === "moss" && (p.stage === "adult" || p.stage === "final") ? -0.05 : -0.40625;
    eyes(d, y, 0.4375, p.branch === "night" ? 0.17 : 0.125, p.stage === "baby" ? 0.48 : 0.40625);
    if (p.mouth > 0) face(d, -0.09, y + 0.28, 0.18, 0.16 * p.mouth);
  }
  if (p.stage === "final") crown(d);
}
function crown(d: Drawing): void {
  let top = -1.16;
  if (d.p.branch === "frost") top = -1.34;
  else if (d.p.branch === "moss") top = -0.84;
  else if (d.p.branch === "night") top = -1;
  else if (d.p.branch === "swarm") top = -0.86 - 2 / d.radius;
  const y = top - 0.2 + Math.sin(d.p.time * Math.PI * 2 / 3) * 2 / d.radius;
  const c = { r: 232, g: 195, b: 90 };
  rect(d, -0.35, y, 0.22, 0.16, "body", c); rect(d, -0.11, y - 0.1, 0.22, 0.26, "body", c); rect(d, 0.13, y, 0.22, 0.16, "body", c);
}
function overlays(d: Drawing): void {
  const p = d.p;
  if (p.asleep) for (let i = 0; i < 3; i++) {
    const t = (p.sleepTime / 4 + i / 3) % 1, v = Math.floor(200 * (1 - t)), c = { r: v, g: v, b: Math.floor(224 * (1 - t)) };
    const x = 0.55 + i * 0.15, y = -1.05 - t * 0.5, w = 12 / d.radius, h = 3 / d.radius;
    rect(d, x, y, w, h, "fx", c); rect(d, x + h, y + h, w - 2 * h, h * 2, "fx", c); rect(d, x, y + h * 3, w, h, "fx", c);
  }
  if (p.sparkle > 0) for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3, radius = 0.9 + p.sparkle * 0.3, fade = 1 - p.sparkle;
    rect(d, Math.cos(a) * radius, Math.sin(a) * radius, 6 / d.radius, 6 / d.radius, "fx", { r: Math.floor(d.color.r * fade), g: Math.floor(d.color.g * fade), b: Math.floor(d.color.b * fade) });
  }
  if (p.pellet) d.rects.push({ x: p.pellet.x, y: p.pellet.y, width: p.pellet.size, height: p.pellet.size, part: "fx", r: 242, g: 193, b: 78 });
}
export function poseRects(p: PetPose): PoseRect[] {
  const lift = p.groundY - p.y;
  const rects: PoseRect[] = [{ x: p.x - 34 + lift / 2, y: p.groundY + 65, width: 68 - lift, height: 4, part: "shadow", r: 40, g: 32, b: 29 }];
  const d: Drawing = { p, rects, radius: 64 * p.formScale * p.form, color: color(p) };
  if (d.radius > 0) { creature(d); overlays(d); }
  return rects;
}
export function poseBounds(p: PetPose): Bounds {
  const rects = poseRects(p);
  let left = SIZE, top = SIZE, right = 0, bottom = 0;
  for (let i = 0; i < rects.length; i++) { const r = rects[i]; left = Math.min(left, r.x); top = Math.min(top, r.y); right = Math.max(right, r.x + r.width); bottom = Math.max(bottom, r.y + r.height); }
  left = Math.max(0, Math.floor(left - 2)); top = Math.max(0, Math.floor(top - 2)); right = Math.min(SIZE, Math.ceil(right + 2)); bottom = Math.min(SIZE, Math.ceil(bottom + 2));
  return { x: left, y: top, width: right - left, height: bottom - top };
}
