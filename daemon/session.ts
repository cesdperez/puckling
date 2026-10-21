export type Behaviour = "idle" | "working" | "needs_me" | "just_finished";
export type AgentState = "working" | "waiting" | "blocked" | "done";
export type Agent = {
  id: string;
  state: AgentState;
  hostId?: string;
  worktreeId?: string;
  paneKey?: string;
  stateStartedAt?: number;
};
export type Snapshot = { version: 1; type: "state"; state: Behaviour; connected: boolean };

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Orca response");
  return value as Record<string, unknown>;
}

export function parseOrca(value: unknown): Agent[] {
  const envelope = record(value);
  if (envelope.ok !== true) throw new Error("Orca query failed");
  const result = record(envelope.result);
  if (!Array.isArray(result.worktrees)) throw new Error("Missing Orca worktrees");
  const scope = record(result.hostScope);
  if (result.truncated !== false || !Array.isArray(scope.omittedHostIds) || scope.omittedHostIds.length) {
    throw new Error("Incomplete Orca snapshot");
  }

  const agents: Agent[] = [];
  for (const row of result.worktrees) {
    const tree = record(row);
    if (tree.isArchived === true) continue;
    if (typeof tree.hostId !== "string" || typeof tree.worktreeId !== "string" || !Array.isArray(tree.agents)) {
      throw new Error("Invalid Orca worktree");
    }
    for (const entry of tree.agents) {
      const agent = record(entry);
      if (typeof agent.paneKey !== "string" || !["working", "waiting", "blocked", "done"].includes(String(agent.state))) {
        throw new Error("Invalid Orca agent");
      }
      agents.push({
        id: `${tree.hostId}/${tree.worktreeId}/${agent.paneKey}`, state: agent.state as AgentState,
        hostId: tree.hostId, worktreeId: tree.worktreeId, paneKey: agent.paneKey,
        ...(typeof agent.stateStartedAt === "number" && Number.isFinite(agent.stateStartedAt) && agent.stateStartedAt >= 0
          ? { stateStartedAt: agent.stateStartedAt } : {}),
      });
    }
  }
  return agents;
}

export class SessionReducer {
  private previous = new Map<string, AgentState>();
  private finishedUntil = 0;

  update(agents: readonly Agent[], now: number): Behaviour {
    const finished = agents.some(agent => {
      const previous = this.previous.get(agent.id);
      return agent.state === "done" && previous !== undefined && previous !== "done";
    });
    this.previous = new Map(agents.map(agent => [agent.id, agent.state]));
    if (finished) this.finishedUntil = now + 4000;
    if (agents.some(agent => agent.state === "waiting" || agent.state === "blocked")) return "needs_me";
    if (now < this.finishedUntil) return "just_finished";
    if (agents.some(agent => agent.state === "working")) return "working";
    return "idle";
  }

  disconnect() {
    this.previous.clear();
    this.finishedUntil = 0;
  }
}
