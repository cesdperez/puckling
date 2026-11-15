import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { State } from "./state";
export function formatFood(state: State, date = new Date()) {
  const c = state.counters;
  return [1, c.total, c.claude, c.codex, c.opencode, c.night, c.parallel]
    .map(Math.floor)
    .concat(-date.getTimezoneOffset(), state.generation)
    .join(" ");
}
export function deliver(
  line: string,
  state: State,
  opts: {
    sim?: boolean;
    dryRun?: boolean;
    port?: string;
  },
) {
  if (opts.dryRun) return false;
  if (opts.sim) {
    const dir = process.env.PUCKLING_FEED_DIR || fileURLToPath(new URL("../../feed/", import.meta.url));
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/food.txt`, line);
    return false;
  }
  if (line === state.lastSent) return false;
  const port = opts.port || process.env.PUCKLING_PORT;
  const suffix = ["--board", "puck", ...(port ? ["--port", port] : [])];
  execFileSync(
    "npx",
    ["gea", "devctl", "storage", "set", "food", line, ...suffix],
    { stdio: "inherit" },
  );
  execFileSync("npx", ["gea", "devctl", "set-time", ...suffix], {
    stdio: "inherit",
  });
  return true;
}
