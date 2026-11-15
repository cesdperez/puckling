import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { State } from "./state";
import { addUsage, localDay, tokenTotal } from "./tokens";
export function formatFood(state: State, date = new Date()) {
  const c = state.counters;
  return [1, c.total, c.claude, c.codex, c.opencode, c.night, c.parallel]
    .map(Math.floor)
    .concat(-date.getTimezoneOffset(), state.generation)
    .join(" ");
}
export function formatFeed(state: State, date = new Date()) {
  const totals = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  const models = Object.entries(state.tokens).map(([name, usage]) => {
    addUsage(totals, usage);
    return { name, count: tokenTotal(usage) };
  }).filter(({ count }) => count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const totalsLine = [1, state.generation, tokenTotal(totals), totals.input, totals.output, totals.cacheRead, totals.cacheWrite, state.days[localDay(date)] ?? 0].map(Math.floor).join(" ");
  const modelLines = models.slice(0, 24).map(({ name, count }) => `${name} ${Math.floor(count)}`);
  return [formatFood(state, date), totalsLine, ...modelLines].join("\n") + "\n";
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
