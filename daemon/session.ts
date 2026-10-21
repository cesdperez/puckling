import { createHash, randomBytes } from "node:crypto";

export type AgentState = "working" | "waiting" | "blocked" | "done";
export type Agent = {
  id: string; state: AgentState; hostId?: string; worktreeId?: string; paneKey?: string;
  stateStartedAt?: number; updatedAt?: number; project?: string; title?: string;
  agentType?: string; workingMode?: string; outcome?: string;
};
export const MAX_SESSIONS = 32;
export const MAX_LINE = 12288;
export const STALE_MS = 8000;
export type Card = [id: string, project: string, label: string, agent: string,
  state: number, attention: boolean, seen: boolean, supported: boolean, reason: string];
export type Feedback = "none" | "opening" | "opened" | "retry" | "unavailable" | "unsupported";
export type Snapshot = {
  version: 2; type: "state"; seq: number; connected: boolean; age: number;
  total: number; attention: number; working: number; monitoring: number; cue: number;
  request: number; target: string; feedback: Feedback; sessions: Card[];
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Orca response");
  return value as Record<string, unknown>;
}
function timestamp(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}
export function textLabel(value: unknown, limit: number, fallback: string): string {
  const text = typeof value === "string" ? value.replace(/[^\x20-\x7e]|["\\]/g, " ").replace(/\s+/g, " ").trim() : "";
  return text ? text.length > limit ? text.slice(0, limit - 2) + ".." : text : fallback;
}
export function parseOrca(value: unknown): Agent[] {
  const envelope = record(value);
  if (envelope.ok !== true) throw new Error("Orca query failed");
  const result = record(envelope.result), scope = record(result.hostScope);
  if (!Array.isArray(result.worktrees) || result.truncated !== false ||
      !Array.isArray(scope.omittedHostIds) || scope.omittedHostIds.length) throw new Error("Incomplete Orca snapshot");
  const agents: Agent[] = [], identities = new Set<string>();
  for (const row of result.worktrees) {
    const tree = record(row);
    if (tree.isArchived === true) continue;
    if (typeof tree.hostId !== "string" || typeof tree.worktreeId !== "string" || !Array.isArray(tree.agents)) throw new Error("Invalid Orca worktree");
    const repo = typeof tree.repo === "object" && tree.repo ? tree.repo as Record<string, unknown> : {};
    for (const entry of tree.agents) {
      const a = record(entry);
      if (typeof a.paneKey !== "string" || !["working", "waiting", "blocked", "done"].includes(String(a.state))) throw new Error("Invalid Orca agent");
      const id = JSON.stringify([tree.hostId, tree.worktreeId, a.paneKey]);
      if (identities.has(id)) throw new Error("Duplicate session identity");
      identities.add(id);
      const main = a.mainAgent && typeof a.mainAgent === "object" ? a.mainAgent as Record<string, unknown> : {};
      agents.push({ id, state: a.state as AgentState, hostId: tree.hostId, worktreeId: tree.worktreeId, paneKey: a.paneKey,
        stateStartedAt: timestamp(a.stateStartedAt), updatedAt: timestamp(a.updatedAt),
        project: textLabel(typeof tree.repo === "string" ? tree.repo : repo.name ?? tree.displayName, 24, "Project"),
        title: textLabel(a.displayName, 24, ""), agentType: textLabel(a.agentType, 10, "Agent"),
        workingMode: a.workingMode === "monitoring" ? "monitoring" : undefined,
        outcome: typeof main.outcome === "string" ? main.outcome : undefined,
      });
    }
  }
  return agents;
}
// State numbers are wire ABI: input, attention, failed, finished, working, monitoring, ended, unknown.
export function cardState(a: Agent): number {
  if (a.state === "waiting") return 0;
  if (a.state === "blocked") return 1;
  if (a.state === "working") return a.workingMode === "monitoring" ? 5 : 4;
  if (a.outcome === "failure") return 2;
  if (a.outcome === "success") return 3;
  if (["cancellation", "superseded"].includes(a.outcome ?? "")) return 6;
  if (["interruption", "unconfirmed"].includes(a.outcome ?? "")) return 1;
  return 7;
}
const actionable = (a: Agent) => [0, 1, 2].includes(cardState(a));
const eventKey = (a: Agent) => `${a.state}/${a.stateStartedAt ?? ""}/${a.outcome ?? ""}`;
export class SessionModel {
  private salt = randomBytes(16).toString("hex");
  private previous = new Map<string, string>();
  private alerts = new Map<string, { event: string; seen: boolean }>();
  private agents = new Map<string, Agent>();
  private queriedAt = -Infinity;
  private connected = false;
  private baseline = true;
  private seq = 0;
  private cue = 0;
  private lastCue = -Infinity;
  private pendingCue = false;
  private receipt = { request: 0, target: "", feedback: "none" as Feedback };
  token(a: Agent) { return createHash("sha256").update(this.salt + a.id).digest("hex").slice(0, 16); }
  update(agents: Agent[], now: number) {
    const live = new Set(agents.map(a => a.id));
    for (const id of this.alerts.keys()) if (!live.has(id)) this.alerts.delete(id);
    for (const a of agents) {
      const event = eventKey(a), old = this.previous.get(a.id), alert = this.alerts.get(a.id);
      const completed = !this.baseline && old !== undefined && old !== event && cardState(a) === 3;
      if ((actionable(a) || completed) && alert?.event !== event) {
        this.alerts.set(a.id, { event, seen: false });
        this.pendingCue = true;
      } else if (!actionable(a) && !completed && alert?.event !== event) this.alerts.delete(a.id);
    }
    this.previous = new Map(agents.map(a => [a.id, eventKey(a)]));
    this.agents = new Map(agents.map(a => [this.token(a), a]));
    this.queriedAt = now; this.connected = true; this.baseline = false;
  }
  disconnect() { this.connected = false; this.baseline = true; this.previous.clear(); }
  fresh(now: number) { return this.connected && now - this.queriedAt <= STALE_MS; }
  find(token: string) { return this.agents.get(token); }
  acknowledge(token: string) {
    const a = this.find(token), alert = a && this.alerts.get(a.id);
    if (!alert) return;
    if (cardState(a!) === 3) this.alerts.delete(a!.id);
    else alert.seen = true;
  }
  feedback(request: number, target: string, feedback: Feedback) { this.receipt = { request, target, feedback }; }
  snapshot(now: number): Snapshot {
    if (this.pendingCue && now - this.lastCue >= 3000) { this.cue++; this.lastCue = now; this.pendingCue = false; }
    const all = [...this.agents.values()];
    const alert = (a: Agent) => this.alerts.get(a.id);
    const rank = (a: Agent) => alert(a) ? (cardState(a) === 3 ? 2 : alert(a)!.seen ? 1 : 0) : a.state === "working" ? 3 : 4;
    const recent = all.filter(a => alert(a) || a.state !== "done" || now - (a.stateStartedAt ?? -Infinity) <= 86400000);
    recent.sort((a, b) => rank(a) - rank(b) || (rank(a) < 3 ?
      (a.stateStartedAt ?? Infinity) - (b.stateStartedAt ?? Infinity) :
      (b.stateStartedAt ?? -Infinity) - (a.stateStartedAt ?? -Infinity)) || a.id.localeCompare(b.id));
    const sessions: Card[] = recent.slice(0, MAX_SESSIONS).map(a => [this.token(a), a.project ?? "Project",
      // The suffix disambiguates identical or missing titles without exposing paths.
      textLabel(a.title, 16, "Session") + " " + this.token(a).slice(0, 4), a.agentType ?? "Agent", cardState(a),
      !!alert(a), alert(a)?.seen ?? false, !(a.paneKey?.startsWith("structured-agent-session-") && a.hostId !== "local"),
      cardState(a) === 0 ? "Waiting for your input" : cardState(a) === 1 ? "Needs your attention" :
      cardState(a) === 2 ? "Run reported failure" : cardState(a) === 7 ? "Outcome not reported" : ""]);
    return { version: 2, type: "state", seq: ++this.seq, connected: this.connected,
      age: Number.isFinite(this.queriedAt) ? Math.min(2147483647, Math.max(0, now - this.queriedAt)) : 2147483647,
      total: recent.length, attention: recent.filter(a => alert(a)).length,
      working: all.filter(a => cardState(a) === 4).length, monitoring: all.filter(a => cardState(a) === 5).length,
      cue: this.cue, ...this.receipt, sessions };
  }
}
