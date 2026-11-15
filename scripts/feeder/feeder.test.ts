import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, appendFileSync, existsSync, readFileSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { emptyState } from "./state";
import { weigh, modelFactor } from "./weigh";
import { readClaude } from "./claude";
import { readCodex } from "./codex";
import { readOpencode } from "./opencode";
import { applyMeals, countReport, parseArgs, runOnce } from "./main";
import { deliver, formatFood, formatFeed } from "./deliver";
import { displayModel } from "./tokens";
const dir = () => mkdtempSync(join(tmpdir(), "puckling-test-"));
test("weight and model factors", () => {
  expect(modelFactor("GPT-opus")).toBe(1);
  expect(modelFactor("unknown")).toBe(0.3);
  expect(
    weigh({ input: 10, output: 2, cacheWrite: 4, cacheRead: 10 }, "opus"),
  ).toBe(26);
});
test("claude offsets and partial lines", async () => {
  const d = dir(),
    p = join(d, "a.jsonl"),
    s = emptyState(),
    now = new Date().toISOString();
  const line = JSON.stringify({
    type: "assistant",
    timestamp: now,
    sessionId: "s",
    message: { id: "a", model: "opus", usage: { input_tokens: 1000 } },
  });
  writeFileSync(p, `${line}\n${line}`);
  expect((await readClaude(s, d)).length).toBe(1);
  appendFileSync(p, "\n");
  expect((await readClaude(s, d)).length).toBe(1);
  expect((await readClaude(s, d)).length).toBe(0);
});
test("codex model, math and fallback dedupe", async () => {
  const d = dir(),
    p = join(d, "a.jsonl"),
    s = emptyState(),
    now = new Date().toISOString();
  const event = {
    timestamp: now,
    type: "event_msg",
    payload: {
      type: "token_count",
      info: {
        total_token_usage: { total_tokens: 20 },
        last_token_usage: {
          input_tokens: 10,
          cached_input_tokens: 3,
          cache_write_input_tokens: 2,
          output_tokens: 4,
        },
      },
    },
  };
  writeFileSync(
    p,
    [
      JSON.stringify({ type: "turn_context", payload: { model: "gpt" } }),
      JSON.stringify(event),
      JSON.stringify(event),
    ].join("\n") + "\n",
  );
  const meals = await readCodex(s, d);
  expect(meals[0].model).toBe("gpt");
  expect(meals[0].usage.input).toBe(5);
  applyMeals(s, meals);
  expect(s.counters.codex).toBeCloseTo(weigh(meals[0].usage, "gpt") / 1000);
});
test("opencode skips incomplete and claude-agent", () => {
  const p = join(dir(), "db"),
    db = new Database(p);
  db.run(
    "CREATE TABLE session_message (id TEXT, session_id TEXT, time_created INTEGER, time_updated INTEGER, data TEXT)",
  );
  const add = db.prepare(
    "INSERT INTO session_message VALUES (?, ?, 0, 100, ?)",
  );
  for (const [id, provider, completed] of [
    ["1", "x", 100],
    ["2", "claude-agent", 100],
    ["3", "x", null],
  ])
    add.run(
      id,
      "s",
      JSON.stringify({
        model: { id: "gpt", providerID: provider },
        time: { completed },
        tokens: { input: 2, output: 3, reasoning: 4 },
      }),
    );
  db.close();
  const meals = readOpencode(emptyState(), p);
  expect(meals.length).toBe(1);
  expect(meals[0].usage.output).toBe(7);
});
test("night, parallel, dedupe and food format", () => {
  const s = emptyState(),
    time = new Date(2026, 0, 1, 23).getTime();
  const meals = [1, 2, 3].map((i) => ({
    id: String(i),
    tool: "claude" as const,
    model: "opus",
    session: String(i),
    time,
    usage: { input: 1000, output: 0, cacheRead: 0, cacheWrite: 0 },
  }));
  applyMeals(s, meals, 0, time);
  applyMeals(s, meals, 0, time);
  expect(s.counters.night).toBe(3);
  expect(s.counters.parallel).toBe(1);
  expect(formatFood(s, new Date(time))).toBe(
    `1 3 3 0 0 3 1 ${-new Date(time).getTimezoneOffset()} ${s.generation}`,
  );
});

test("first run skips existing lines and eats appended lines", async () => {
  const d = dir();
  const path = join(d, "a.jsonl");
  const statePath = join(d, "state.json");
  const makeLine = (id: string) =>
    JSON.stringify({
      type: "assistant",
      timestamp: new Date().toISOString(),
      sessionId: "s",
      message: { id, model: "opus", usage: { input_tokens: 1000 } },
    }) + "\n";
  writeFileSync(path, makeLine("old"));
  const env = {
    ...process.env,
    PUCKLING_CLAUDE_DIR: d,
    PUCKLING_CODEX_DIR: join(d, "none"),
    PUCKLING_OPENCODE_DB: join(d, "none.db"),
    PUCKLING_FEEDER_STATE: statePath,
  };
  const run = () =>
    Bun.spawnSync(["bun", "scripts/feeder/main.ts", "--dry-run"], { env });
  expect(run().exitCode).toBe(0);
  expect(JSON.parse(await Bun.file(statePath).text()).counters.total).toBe(0);
  appendFileSync(path, makeLine("new"));
  expect(run().exitCode).toBe(0);
  expect(JSON.parse(await Bun.file(statePath).text()).counters.total).toBe(1);
});

test("backfill counts only meals in its window", async () => {
  const d = dir();
  const now = Date.now();
  const makeLine = (id: string, time: number) =>
    JSON.stringify({
      type: "assistant",
      timestamp: new Date(time).toISOString(),
      sessionId: "s",
      message: { id, model: "opus", usage: { input_tokens: 1000 } },
    });
  writeFileSync(
    join(d, "a.jsonl"),
    [makeLine("old", now - 2 * 86400000), makeLine("new", now)].join("\n") +
      "\n",
  );
  const statePath = join(d, "state.json");
  const env = {
    ...process.env,
    PUCKLING_CLAUDE_DIR: d,
    PUCKLING_CODEX_DIR: join(d, "none"),
    PUCKLING_OPENCODE_DB: join(d, "none.db"),
    PUCKLING_FEEDER_STATE: statePath,
  };
  const result = Bun.spawnSync(
    ["bun", "scripts/feeder/main.ts", "--dry-run", "--backfill", "1"],
    { env },
  );
  expect(result.exitCode).toBe(0);
  expect(JSON.parse(await Bun.file(statePath).text()).counters.total).toBe(1);
});

test("backfill floor persists across polls", async () => {
  const d = dir(), now = Date.now(), old = join(d, "old.jsonl");
  const line = (id: string, time: number) => JSON.stringify({
    type: "assistant", timestamp: new Date(time).toISOString(), sessionId: "s",
    message: { id, model: "opus", usage: { input_tokens: 1000 } },
  }) + "\n";
  writeFileSync(old, line("old", now - 5 * 86400000));
  utimesSync(old, new Date(now - 5 * 86400000), new Date(now - 5 * 86400000));
  writeFileSync(join(d, "recent.jsonl"), line("recent", now - 3600000));
  const keys = ["PUCKLING_FEEDER_STATE", "PUCKLING_CLAUDE_DIR", "PUCKLING_CODEX_DIR", "PUCKLING_OPENCODE_DB"] as const;
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  Object.assign(process.env, {
    PUCKLING_FEEDER_STATE: join(d, "state.json"), PUCKLING_CLAUDE_DIR: d,
    PUCKLING_CODEX_DIR: join(d, "none"), PUCKLING_OPENCODE_DB: join(d, "none.db"),
  });
  try {
    const first = await runOnce(["--backfill", "2", "--dry-run"], "2");
    const second = await runOnce(["--backfill", "2", "--dry-run"], "2");
    expect(second.counters).toEqual(first.counters);
    expect(second.counters.total).toBe(1);
    expect(second.tokens).toEqual({ opus: { input: 1000, output: 0, cacheRead: 0, cacheWrite: 0 } });
    utimesSync(old, new Date(), new Date());
    const third = await runOnce(["--backfill", "2", "--dry-run"], "2");
    expect(third.counters.total).toBe(1);
    expect(third.offsets[old]).toBe(Buffer.byteLength(line("old", now - 5 * 86400000)));
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});

test("report excludes older meals and duplicates", () => {
  const meal = {
    id: "a",
    tool: "claude" as const,
    model: "opus",
    session: "s",
    time: 100,
    usage: { input: 1000, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
  const result = countReport([meal, meal, { ...meal, id: "b", time: 99 }], 100);
  expect(result.total).toBe(1000);
  expect(result.counts.claude).toBe(1);
});

test("codex persists record mode and switches when records appear", async () => {
  const d = dir();
  const p = join(d, "a.jsonl");
  const state = emptyState();
  const timestamp = new Date().toISOString();
  const fallback = {
    timestamp,
    type: "event_msg",
    payload: {
      type: "token_count",
      info: {
        total_token_usage: { total_tokens: 1 },
        last_token_usage: { input_tokens: 1 },
      },
    },
  };
  writeFileSync(p, JSON.stringify(fallback) + "\n");
  expect((await readCodex(state, d)).length).toBe(1);
  expect(state.hasRecords[p]).toBe(false);
  appendFileSync(
    p,
    JSON.stringify({
      timestamp,
      type: "token_usage_record",
      payload: { response_id: "r", usage: { input_tokens: 1 } },
    }) +
      "\n" +
      JSON.stringify(fallback) +
      "\n",
  );
  expect((await readCodex(state, d)).length).toBe(1);
  expect(state.hasRecords[p]).toBe(true);
});

test("idle opencode watermark keeps dedupe entries", () => {
  const state = emptyState(), time = Date.now() - 4 * 86400000;
  state.watermark = time;
  const meal = { id: "opencode:a", tool: "opencode" as const, model: "opus", session: "s", time, usage: { input: 1000, output: 0, cacheRead: 0, cacheWrite: 0 } };
  applyMeals(state, [meal], 0, time);
  applyMeals(state, [meal], 0, Date.now());
  applyMeals(state, [meal], 0, Date.now());
  expect(state.counters.total).toBe(1);
});
test("subagents have distinct sessions and rewritten Claude files dedupe", async () => {
  const d = dir(), p = join(d, "a.jsonl"), state = emptyState(), timestamp = new Date().toISOString();
  const line = (id: string, agentId: string) => JSON.stringify({ type: "assistant", timestamp, sessionId: "parent", agentId, message: { id, model: "opus", usage: { input_tokens: 1000 } } }) + "\n";
  writeFileSync(p, line("a", "one") + line("b", "two"));
  const meals = await readClaude(state, d);
  expect(meals.map(m => m.session)).toEqual(["parent:one", "parent:two"]);
  applyMeals(state, meals);
  writeFileSync(p, line("a", "one"));
  applyMeals(state, await readClaude(state, d));
  expect(state.counters.total).toBe(2);
  const c = join(dir(), "a.jsonl");
  writeFileSync(c, JSON.stringify({ timestamp, type: "token_usage_record", payload: { response_id: "r", session_id: "parent", thread_id: "worker", usage: { input_tokens: 1 } } }) + "\n");
  expect((await readCodex(emptyState(), join(c, "..")))[0].session).toBe("worker");
});
test("delivery sim, dry run, and unchanged device line", () => {
  const d = dir(), state = emptyState(), previous = process.env.PUCKLING_FEED_DIR;
  process.env.PUCKLING_FEED_DIR = d;
  try {
    expect(deliver("food", state, { dryRun: true, sim: true })).toBe(false);
    expect(existsSync(join(d, "feed.txt"))).toBe(false);
    expect(deliver("food", state, { sim: true })).toBe(false);
    expect(readFileSync(join(d, "feed.txt"), "utf8")).toBe(formatFeed(state));
    state.lastSent = "food";
    expect(deliver("food", state, {})).toBe(false);
  } finally {
    if (previous === undefined) delete process.env.PUCKLING_FEED_DIR;
    else process.env.PUCKLING_FEED_DIR = previous;
  }
});

test("model names and raw meal tallies", () => {
  expect(displayModel("claude-opus-5-5")).toBe("opus-5-5");
  expect(displayModel("claude-haiku-4-5-20251001")).toBe("haiku-4-5");
  expect(displayModel("gpt-6.1-terra")).toBe("gpt-6.1-terra");
  expect(displayModel("")).toBe("unknown");
  expect(displayModel("GPT Foo")).toBe("gpt-foo");
  const state = emptyState(), time = new Date(2026, 0, 2, 12).getTime();
  const meal = { id: "a", tool: "claude" as const, model: "claude-opus-5-5", session: "s", time, usage: { input: 1, output: 2, cacheRead: 3, cacheWrite: 4 } };
  applyMeals(state, [meal, meal], 0, time);
  expect(state.tokens["opus-5-5"]).toEqual(meal.usage);
  expect(state.days).toEqual({ "2026-01-02": 10 });
  for (let i = 1; i <= 9; i++) state.days[`2025-12-${String(i).padStart(2, "0")}`] = i;
  applyMeals(state, [], 0, time);
  expect(Object.keys(state.days).sort()).toHaveLength(8);
  expect(state.days["2025-12-01"]).toBeUndefined();
});

test("feed format totals and individual models", () => {
  const state = emptyState(), date = new Date(2026, 0, 2, 12);
  state.generation = 42;
  state.days["2026-01-02"] = 12;
  for (let i = 1; i <= 7; i++) state.tokens[`m${i}`] = { input: i, output: 1, cacheRead: 2, cacheWrite: 3 };
  state.tokens.zero = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
  expect(formatFeed(state, date)).toBe(`1 0 0 0 0 0 0 ${-date.getTimezoneOffset()} 42\n1 42 70 28 7 14 21 12\nm7 13\nm6 12\nm5 11\nm4 10\nm3 9\nm2 8\nm1 7\n`);
});

test("feed caps model lines at 24 with stable name ordering", () => {
  const state = emptyState(), date = new Date(2026, 0, 2);
  for (let i = 1; i <= 26; i++) state.tokens[`m${String(i).padStart(2, "0")}`] = { input: i < 4 ? 1 : i, output: 0, cacheRead: 0, cacheWrite: 0 };
  const lines = formatFeed(state, date).trimEnd().split("\n").slice(2);
  expect(lines).toHaveLength(24);
  expect(lines.slice(0, 2)).toEqual(["m26 26", "m25 25"]);
  expect(lines.slice(-2)).toEqual(["m04 4", "m01 1"]);
});

test('BLE arguments and framing', async () => {
  const { parseArgs, frameBle } = await import('./main')
  expect(() => parseArgs(['--ble'])).toThrow()
  expect(parseArgs(['--ble', '--pair']).pairing).toBe(true)
  expect(() => parseArgs(['--pair'])).toThrow()
  expect(Buffer.from(frameBle('0123456789abcdef', 'food\n'), 'base64').toString()).toBe('0123456789abcdef\nfood\n')
  expect(() => frameBle('0123456789abcdef', 'x'.repeat(4096))).toThrow()
})
