import { join } from "node:path";
import { homedir } from "node:os";
import { statSync } from "node:fs";
import { files, lines } from "./claude";
import type { Meal, State } from "./state";
export const codexDir = () =>
  process.env.PUCKLING_CODEX_DIR || join(homedir(), ".codex/sessions");
function parseLine(line: string) {
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}
async function initializeFile(state: State, path: string, offset: number) {
  let position = 0;
  let model = state.models[path] || "";
  let hasRecords = false;
  await lines(path, 0, (line) => {
    const x = parseLine(line);
    if (x?.type === "token_usage_record") hasRecords = true;
    if (position < offset && x?.type === "turn_context")
      model = x.payload?.model || model;
    position += Buffer.byteLength(line) + 1;
  });
  state.models[path] = model;
  state.hasRecords[path] = hasRecords;
}
function toMeal(
  x: any,
  path: string,
  model: string,
  hasRecords: boolean,
): Meal | undefined {
  const p = x.payload || {};
  const record = x.type === "token_usage_record";
  if (
    !record &&
    (hasRecords ||
      x.type !== "event_msg" ||
      p.type !== "token_count" ||
      !p.info)
  )
    return;
  const u = record ? p.usage : p.info.last_token_usage;
  const id = record
    ? p.response_id
    : `${path}:${p.info.total_token_usage?.total_tokens}`;
  if (!u || !id) return;
  return {
    id: `codex:${id}`,
    tool: "codex",
    model,
    session: p.session_id || path,
    time: Date.parse(x.timestamp),
    usage: {
      input: Math.max(
        0,
        (u.input_tokens || 0) -
          (u.cached_input_tokens || 0) -
          (u.cache_write_input_tokens || 0),
      ),
      output: u.output_tokens || 0,
      cacheRead: u.cached_input_tokens || 0,
      cacheWrite: u.cache_write_input_tokens || 0,
    },
  };
}
async function readFile(state: State, path: string): Promise<Meal[]> {
  const previous = state.offsets[path] || 0;
  const rewritten = statSync(path).size < previous;
  const offset = rewritten ? 0 : previous;
  if (rewritten) {
    delete state.hasRecords[path];
    delete state.models[path];
  }
  if (!(path in state.hasRecords)) await initializeFile(state, path, offset);
  const meals: Meal[] = [];
  state.offsets[path] = await lines(path, offset, (line) => {
    const x = parseLine(line);
    if (!x) return;
    if (x.type === "turn_context") {
      state.models[path] = x.payload?.model || state.models[path];
      return;
    }
    if (x.type === "token_usage_record") state.hasRecords[path] = true;
    const meal = toMeal(x, path, state.models[path], state.hasRecords[path]);
    if (meal) meals.push(meal);
  });
  return meals;
}
export async function readCodex(state: State, dir = codexDir(), since = 0) {
  state.hasRecords ||= {};
  const meals: Meal[] = [];
  for (const path of files(dir, since))
    meals.push(...(await readFile(state, path)));
  return meals;
}
