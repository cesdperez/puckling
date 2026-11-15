import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import type { Usage } from "./weigh";
export type Tool = "claude" | "codex" | "opencode";
export type Meal = {
  id: string;
  tool: Tool;
  model: string;
  session: string;
  time: number;
  usage: Usage;
};
export type State = {
  generation: number;
  tokens: Record<string, Usage>;
  days: Record<string, number>;
  offsets: Record<string, number>;
  models: Record<string, string>;
  hasRecords: Record<string, boolean>;
  watermark: number;
  since: number;
  seen: Record<string, number>;
  counters: Record<"total" | Tool | "night" | "parallel", number>;
  recent: {
    session: string;
    time: number;
  }[];
  lastSent?: string;
};
export const statePath = () =>
  process.env.PUCKLING_FEEDER_STATE ||
  join(homedir(), ".local/state/puckling/feeder.json");
export function emptyState(): State {
  return {
    generation: Math.floor(Date.now() / 1000),
    tokens: {},
    days: {},
    offsets: {},
    models: {},
    hasRecords: {},
    watermark: 0,
    since: 0,
    seen: {},
    counters: {
      total: 0,
      claude: 0,
      codex: 0,
      opencode: 0,
      night: 0,
      parallel: 0,
    },
    recent: [],
  };
}
export function loadState(path = statePath()) {
  if (!existsSync(path)) return null;
  const state = JSON.parse(readFileSync(path, "utf8")) as State;
  state.tokens ??= {};
  state.days ??= {};
  state.generation ??= Math.floor(Date.now() / 1000);
  state.since ??= 0;
  return state;
}
export function saveState(state: State, path = statePath()) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(state));
  renameSync(tmp, path);
}
