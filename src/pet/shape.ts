import { SIZE, BODY_RADIUS, BODY_HALF_WIDTH, BODY_HEIGHT, ARM_EXTENT, ARM_TOP, ARM_HEIGHT, LEG_LENGTH, SHADOW_HALF_WIDTH, SHADOW_OFFSET, SHADOW_HEIGHT, type PetPose } from "./pet";

export type Bounds = { x: number; y: number; width: number; height: number };
export type PoseRect = Bounds & { part: "shadow" | "body" | "face" | "fx"; r: number; g: number; b: number };

export function poseRects(p: PetPose): PoseRect[] {
  const sx = p.scaleX, sy = p.scaleY;
  const lift = p.groundY - p.y;
  const left = p.x - ARM_EXTENT * sx;
  const top = p.y + BODY_RADIUS - (BODY_HEIGHT + LEG_LENGTH) * sy;
  const rects: PoseRect[] = [
    { x: p.x - SHADOW_HALF_WIDTH + lift / 2, y: p.groundY + SHADOW_OFFSET, width: 2 * SHADOW_HALF_WIDTH - lift, height: SHADOW_HEIGHT, part: "shadow", r: 40, g: 32, b: 29 },
    { x: p.x - BODY_HALF_WIDTH * sx, y: top, width: 2 * BODY_HALF_WIDTH * sx, height: BODY_HEIGHT * sy, part: "body", r: 217, g: 119, b: 87 },
    { x: left, y: top + ARM_TOP * sy, width: (ARM_EXTENT - BODY_HALF_WIDTH + 1) * sx, height: ARM_HEIGHT * sy, part: "body", r: 217, g: 119, b: 87 },
    { x: p.x + (BODY_HALF_WIDTH - 1) * sx, y: top + ARM_TOP * sy, width: (ARM_EXTENT - BODY_HALF_WIDTH + 1) * sx, height: ARM_HEIGHT * sy, part: "body", r: 217, g: 119, b: 87 },
  ];
  for (let i = 0; i < 4; i++) {
    const x = i < 2 ? 24 + i * 16 : 80 + (i - 2) * 16;
    rects.push({ x: left + x * sx, y: top + BODY_HEIGHT * sy, width: 8 * sx, height: LEG_LENGTH * sy, part: "body", r: 217, g: 119, b: 87 });
  }
  const eyeHeight = Math.max(3, 26 * p.eyeOpen) * sy;
  const eyeShift = p.lookX + p.facing * 2;
  const eyeTop = top + 38 * sy - eyeHeight / 2;
  rects.push({ x: left + (32 + eyeShift) * sx, y: eyeTop, width: 8 * sx, height: eyeHeight, part: "face", r: 0, g: 0, b: 0 });
  rects.push({ x: left + (88 + eyeShift) * sx, y: eyeTop, width: 8 * sx, height: eyeHeight, part: "face", r: 0, g: 0, b: 0 });
  return rects;
}

export function poseBounds(p: PetPose): Bounds {
  const rects = poseRects(p);
  let left = SIZE, top = SIZE, right = 0, bottom = 0;
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    left = Math.min(left, r.x);
    top = Math.min(top, r.y);
    right = Math.max(right, r.x + r.width);
    bottom = Math.max(bottom, r.y + r.height);
  }
  left = Math.max(0, Math.floor(left - 2));
  top = Math.max(0, Math.floor(top - 2));
  right = Math.min(SIZE, Math.ceil(right + 2));
  bottom = Math.min(SIZE, Math.ceil(bottom + 2));
  return { x: left, y: top, width: right - left, height: bottom - top };
}
