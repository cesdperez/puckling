/// <reference types="node" />
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { createPet, pose } from "../src/pet/pet";
import { FORMS, formScale, poseRects } from "../src/pet/shape";
import type { Stage, Branch } from "../src/pet/life";

const forms: { stage: Stage; branch: Branch; label: string }[] = FORMS.map(f => ({ ...f, label: f.branch === "none" ? f.stage : `${f.stage} ${f.branch}` }));
forms.push({ stage: "egg", branch: "none", label: "cracked egg" }, { stage: "adult", branch: "ember", label: "eating" }, { stage: "adult", branch: "frost", label: "sleeping" }, { stage: "teen", branch: "none", label: "evolving" });
const cols = 4, rows = Math.ceil(forms.length / cols);
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * 466}" height="${rows * 466}"><rect width="100%" height="100%" fill="black"/>`;
for (let i = 0; i < forms.length; i++) {
  const f = forms[i], x = i % cols * 466, y = Math.floor(i / cols) * 466;
  const p = { ...pose(createPet(1)), stage: f.stage, branch: f.branch, formScale: formScale(f.stage), mouth: f.label === "eating" ? 1 : 0, pellet: f.label === "eating" ? { x: 300, y: 290, size: 10 } : undefined, asleep: f.label === "sleeping", sleepTime: 1, sparkle: f.label === "evolving" ? 0.5 : 0, progress: f.label === "cracked egg" ? 0.9 : 0 };
  svg += `<g transform="translate(${x} ${y})"><circle cx="233" cy="233" r="232" fill="none" stroke="#333"/><text x="233" y="420" fill="#aaa" text-anchor="middle" font-family="sans-serif" font-size="18">${f.label}</text>`;
  for (const r of poseRects(p)) svg += `<rect x="${r.x}" y="${r.y}" width="${r.width}" height="${r.height}" fill="rgb(${r.r},${r.g},${r.b})"/>`;
  svg += "</g>";
}
svg += "</svg>";
const output = resolve(process.argv[2] || "./forms.png");
await mkdir(dirname(output), { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: cols * 466, height: rows * 466 }, deviceScaleFactor: 1 });
await page.setContent(`<style>body{margin:0}</style>${svg}`);
await page.screenshot({ path: output });
await browser.close();
console.log(output);
