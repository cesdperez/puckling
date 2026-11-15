import { spawn, execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { statSync } from "node:fs";
import { files, readClaude, claudeDir } from "./claude";
import { readCodex, codexDir } from "./codex";
import { readOpencode } from "./opencode";
import {
  emptyState,
  loadState,
  saveState,
  type Meal,
  type State,
} from "./state";
import { weigh } from "./weigh";
import { deliver, formatFood, formatFeed } from "./deliver";
import { addUsage, displayModel, localDay, tokenTotal } from "./tokens";
import { pair, serve } from "./serve";
function newMeal(meal: Meal, since: number, seen: Record<string, number>): boolean {
  if (!Number.isFinite(meal.time) || meal.time < since || seen[meal.id] !== undefined) return false;
  seen[meal.id] = meal.time;
  return true;
}
export function applyMeals(
  state: State,
  meals: Meal[],
  since = 0,
  now = Date.now(),
) {
  const eaten = { claude: 0, codex: 0, opencode: 0 };
  for (const m of meals.sort((a, b) => a.time - b.time)) {
    if (!newMeal(m, since, state.seen)) continue;
    const model = displayModel(m.model);
    const usage = state.tokens[model] ??= { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
    addUsage(usage, m.usage);
    const day = localDay(new Date(m.time));
    state.days[day] = (state.days[day] ?? 0) + tokenTotal(m.usage);
    const kcal = weigh(m.usage, m.model) / 1000;
    eaten[m.tool] += kcal;
    state.counters.total += kcal;
    state.counters[m.tool] += kcal;
    const hour = new Date(m.time).getHours();
    if (hour >= 22 || hour < 7) state.counters.night += kcal;
    state.recent = state.recent.filter(
      (x) => x.time >= m.time - 600000 && x.time <= m.time,
    );
    state.recent.push({ session: `${m.tool}:${m.session}`, time: m.time });
    if (new Set(state.recent.map((x) => x.session)).size >= 3)
      state.counters.parallel += kcal;
  }
  for (const day of Object.keys(state.days).sort().slice(0, -8)) delete state.days[day];
  for (const [id, time] of Object.entries(state.seen))
    if (time < Math.min(now - 3 * 86400000, state.watermark - 3600000)) delete state.seen[id];
  state.recent = state.recent.filter((x) => x.time >= now - 600000);
  return eaten;
}
async function scan(state: State, since = 0) {
  return [
    ...(await readClaude(state, claudeDir(), since)),
    ...(await readCodex(state, codexDir(), since)),
    ...readOpencode(state),
  ];
}
export function startFromNow(state: State, now = Date.now()) {
  for (const p of [...files(claudeDir()), ...files(codexDir())])
    state.offsets[p] = statSync(p).size;
  state.watermark = now;
}
export function countReport(meals: Meal[], since: number) {
  const unique: Record<string, number> = {};
  const totals = { claude: 0, codex: 0, opencode: 0 };
  const counts = { claude: 0, codex: 0, opencode: 0 };
  for (const meal of meals) {
    if (!newMeal(meal, since, unique))
      continue;
    totals[meal.tool] += weigh(meal.usage, meal.model);
    counts[meal.tool]++;
  }
  return {
    totals,
    counts,
    total: totals.claude + totals.codex + totals.opencode,
  };
}
async function report(days: number) {
  const since = Date.now() - days * 86400000;
  const state = emptyState();
  state.watermark = since;
  const { totals, counts, total } = countReport(
    await scan(state, since),
    since,
  );
  console.log(
    `claude ${totals.claude.toFixed(2)} (${counts.claude} meals)\ncodex ${totals.codex.toFixed(2)} (${counts.codex} meals)\nopencode ${totals.opencode.toFixed(2)} (${counts.opencode} meals)\ntotal ${total.toFixed(2)}\nper-day ${(total / days).toFixed(2)}`,
  );
}
export async function runOnce(args: string[], backfill?: string) {
  const now = Date.now();
  let state = loadState();
  const first = !state || (state.watermark === 0 && state.since === 0 && Object.keys(state.seen).length === 0);
  state ||= emptyState();
  if (first) {
    state.since = backfill === undefined ? now : now - Number(backfill) * 86400000;
    if (backfill === undefined) startFromNow(state, now);
  }
  const eaten = applyMeals(state, await scan(state, state.since), state.since, now);
  saveState(state);
  const line = formatFood(state);
  console.log(
    `claude ${eaten.claude.toFixed(2)} codex ${eaten.codex.toFixed(2)} opencode ${eaten.opencode.toFixed(2)} | ${line}`,
  );
  if (
    ((!args.includes("--serve") && !args.includes("--ble")) || args.includes("--sim")) && deliver(line, state, {
      sim: args.includes("--sim"),
      dryRun: args.includes("--dry-run"),
      port: value(args, "--port"),
    })
  ) {
    state.lastSent = line;
    saveState(state);
  }
  return state;
}
function value(args: string[], flag: string) {
  const i = args.indexOf(flag);
  if (i < 0) return undefined;
  if (!args[i + 1] || args[i + 1].startsWith("--"))
    throw new Error(`Missing value for ${flag}`);
  return args[i + 1];
}
export function parseArgs(args: string[]) {
  const days = Number(value(args, "--days") ?? 7);
  const backfill = value(args, "--backfill");
  const watch = value(args, "--watch");
  const serveArg = value(args, "--serve");
  const port = serveArg === undefined ? undefined : Number(serveArg);
  const pairing = args.includes("--pair");
  const ble = args.includes("--ble");
  if (port !== undefined && (!Number.isInteger(port) || port < 1 || port > 65535)) throw new Error("Invalid serve port");
  if (pairing && port === undefined && !ble) throw new Error("--pair requires --serve or --ble");
  if (ble && port !== undefined) throw new Error("--ble cannot be combined with --serve");
  if (ble && !watch && !pairing) throw new Error("--ble requires --watch");
  const devicePort = value(args, "--port");
  if (port !== undefined && !watch && !pairing) throw new Error("--serve requires --watch");
  if (
    !Number.isFinite(days) ||
    days <= 0 ||
    (backfill !== undefined &&
      (!Number.isFinite(Number(backfill)) || Number(backfill) <= 0)) ||
    (watch !== undefined &&
      (!Number.isFinite(Number(watch)) || Number(watch) <= 0))
  )
    throw new Error("Days and watch interval must be positive numbers");
  return { days, backfill, watch, port, pairing, ble, devicePort, report: args.includes("--report") };
}
export function frameBle(key: string, body: string): string {
  const blob = Buffer.from(`${key}\n${body}`, "utf8");
  if (blob.length > 4096) throw new Error("BLE feed exceeds 4096 bytes");
  return blob.toString("base64") + "\n";
}
function ensureBleKey(state: State): string {
  return state.bleKey ||= randomBytes(8).toString("hex");
}
async function main() {
  const args = process.argv;
  const { days, backfill, watch, port, pairing, ble, devicePort, report: isReport } = parseArgs(args);
  if (isReport) return report(days);
  if (pairing && ble) {
    const state = loadState() || emptyState();
    const key = ensureBleKey(state);
    saveState(state);
    execFileSync("npx", ["gea", "devctl", "storage", "set", "feedkey", key, "--board", "puck", ...(devicePort ? ["--port", devicePort] : [])], { stdio: "inherit" });
    return;
  }
  if (pairing) return pair(port!, devicePort);
  const helper = ble ? spawn("swift", ["scripts/feeder/ble.swift"], { stdio: ["pipe", "ignore", "inherit"] }) : undefined;
  helper?.on("error", (error) => { console.error(error.message); process.exit(1); });
  helper?.on("exit", () => { console.error("BLE helper exited"); process.exit(1); });
  let lastBody: string | undefined;
  let latest: State | undefined;
  if (port !== undefined) serve(port, () => latest);
  do {
    try {
      latest = await runOnce(args, backfill);
      if (helper) {
        const key = ensureBleKey(latest);
        saveState(latest);
        const body = formatFeed(latest);
        if (body !== lastBody) { helper.stdin.write(frameBle(key, body)); lastBody = body; }
      }
    } catch (error) {
      if (!watch) throw error;
      console.error(String(error instanceof Error ? error.message : error).split("\n")[0]);
    }
    if (watch) await Bun.sleep(Number(watch) * 1000);
  } while (watch);
}
if (import.meta.main)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
