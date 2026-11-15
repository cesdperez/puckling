import { createReadStream, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import type { Meal, State } from "./state";
export const claudeDir = () =>
  process.env.PUCKLING_CLAUDE_DIR || join(homedir(), ".claude/projects");
export function files(dir: string, since = 0): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory()
      ? files(p, since)
      : e.isFile() && p.endsWith(".jsonl") && (!since || statSync(p).mtimeMs >= since)
        ? [p]
        : [];
  });
}
export async function lines(
  path: string,
  offset: number,
  visit: (line: string) => void,
) {
  const size = statSync(path).size;
  if (size === offset) return offset;
  let start = size < offset ? 0 : offset;
  let pending = Buffer.alloc(0);
  for await (const chunk of createReadStream(path, { start })) {
    pending = Buffer.concat([pending, chunk as Buffer]);
    let n: number;
    while ((n = pending.indexOf(10)) >= 0) {
      visit(pending.subarray(0, n).toString());
      start += n + 1;
      pending = pending.subarray(n + 1);
    }
  }
  return start;
}
export async function readClaude(state: State, dir = claudeDir(), since = 0) {
  const meals: Meal[] = [];
  for (const path of files(dir, since)) {
    state.offsets[path] = await lines(
      path,
      state.offsets[path] || 0,
      (line) => {
        try {
          const x = JSON.parse(line),
            m = x.message,
            u = m?.usage;
          if (
            x.type !== "assistant" ||
            !u ||
            !m.id ||
            m.model === "<synthetic>"
          )
            return;
          meals.push({
            id: `claude:${m.id}`,
            tool: "claude",
            model: m.model || "",
            session: x.agentId ? `${x.sessionId || path}:${x.agentId}` : x.sessionId || path,
            time: Date.parse(x.timestamp),
            usage: {
              input: u.input_tokens || 0,
              output: u.output_tokens || 0,
              cacheWrite: u.cache_creation_input_tokens || 0,
              cacheRead: u.cache_read_input_tokens || 0,
            },
          });
        } catch {}
      },
    );
  }
  return meals;
}
