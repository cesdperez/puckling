import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Meal, State } from "./state";
export const opencodeDb = () =>
  process.env.PUCKLING_OPENCODE_DB ||
  join(homedir(), ".local/share/opencode/opencode.db");
export function readOpencode(state: State, path = opencodeDb()) {
  if (!existsSync(path)) return [] as Meal[];
  const db = new Database(path, { readonly: true });
  try {
    const rows = db
      .query(
        `SELECT id, session_id, time_updated, json_extract(data, '$.time.completed') completed, json_extract(data, '$.model.id') model, json_extract(data, '$.model.providerID') provider, json_extract(data, '$.tokens.input') input, json_extract(data, '$.tokens.output') output, json_extract(data, '$.tokens.reasoning') reasoning, json_extract(data, '$.tokens.cache.read') cacheRead, json_extract(data, '$.tokens.cache.write') cacheWrite FROM session_message WHERE time_updated > ? AND json_extract(data, '$.time.completed') IS NOT NULL AND json_extract(data, '$.tokens') IS NOT NULL`,
      )
      .all(Math.max(0, state.watermark - 600000)) as any[];
    const meals: Meal[] = [];
    for (const r of rows) {
      state.watermark = Math.max(state.watermark, r.time_updated);
      if (r.provider === "claude-agent") continue;
      meals.push({
        id: `opencode:${r.id}`,
        tool: "opencode",
        model: r.model || "",
        session: r.session_id,
        time: r.completed,
        usage: {
          input: r.input || 0,
          output: (r.output || 0) + (r.reasoning || 0),
          cacheRead: r.cacheRead || 0,
          cacheWrite: r.cacheWrite || 0,
        },
      });
    }
    return meals;
  } finally {
    db.close();
  }
}
