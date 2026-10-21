import type { Agent, Snapshot } from "./session";

export function oldestWaiting(agents: readonly Agent[]): Agent | undefined {
  return agents.filter(agent => agent.state === "waiting" || agent.state === "blocked")
    .sort((a, b) => (a.stateStartedAt ?? Infinity) - (b.stateStartedAt ?? Infinity) || a.id.localeCompare(b.id))[0];
}

export function terminalForAgent(agent: Agent, terminals: readonly Record<string, unknown>[]): string {
  const matches = terminals.filter(terminal => terminal.executionHostId === agent.hostId &&
    terminal.worktreeId === agent.worktreeId && `${terminal.tabId}:${terminal.leafId}` === agent.paneKey &&
    terminal.connected === true && terminal.orphaned === false && typeof terminal.handle === "string");
  if (matches.length !== 1) throw new Error("Waiting session has no unique live terminal");
  return matches[0].handle as string;
}

export class FocusController {
  private eligible = false;
  private busy = false;

  constructor(private query: () => Promise<Agent[]>, private focus: (agent: Agent) => Promise<void>) {}

  update(snapshot: Snapshot) {
    this.eligible = snapshot.connected && snapshot.state === "needs_me";
  }

  async tap(): Promise<boolean> {
    if (!this.eligible || this.busy) return false;
    this.busy = true;
    try {
      const target = oldestWaiting(await this.query());
      if (!target || !this.eligible) return false;
      await this.focus(target);
      return true;
    } finally {
      this.busy = false;
    }
  }
}
