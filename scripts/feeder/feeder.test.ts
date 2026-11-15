import { test, expect } from "bun:test";
import { mkdtempSync, writeFileSync, appendFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Database } from "bun:sqlite";
import { emptyState } from "./state";
import { weigh, modelFactor } from "./weigh";
import { readClaude } from "./claude";
import { readCodex } from "./codex";
import { readOpencode } from "./opencode";
import { applyMeals, countReport } from "./main";
import { formatFood } from "./deliver";
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
    `1 3 3 0 0 3 1 ${-new Date(time).getTimezoneOffset()}`,
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
