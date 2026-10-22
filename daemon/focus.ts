import { STALE_MS, SessionModel, eventKey, type Agent, type Snapshot } from "./session";
import type { DeviceInput } from "./input";

export class TargetUnavailable extends Error {}

export function terminalForAgent(agent: Agent, terminals: readonly Record<string, unknown>[]): string {
  const matches = terminals.filter(terminal => terminal.executionHostId === agent.hostId &&
    terminal.worktreeId === agent.worktreeId && `${terminal.tabId}:${terminal.leafId}` === agent.paneKey &&
    terminal.connected === true && terminal.orphaned === false && typeof terminal.handle === "string");
  if (matches.length !== 1) throw new TargetUnavailable("Selected session has no unique live terminal");
  return matches[0].handle as string;
}

export class FocusController {
  private busy = false;
  private lastRequest = 0;
  private offers = new Map<number, { at: number; ids: Map<string, string | undefined> }>();
  constructor(private model: SessionModel, private query: () => Promise<Agent[]>,
    private focus: (agent: Agent) => Promise<void>, private publish: () => Promise<void>, private clock = Date.now) {}
  offered(snapshot: Snapshot) {
    const now = this.clock();
    this.offers.set(snapshot.seq, { at: now, ids: new Map(snapshot.sessions.map(c => [c[0], this.model.revision(c[0])])) });
    for (const [seq, offer] of this.offers) if (now - offer.at > STALE_MS) this.offers.delete(seq);
  }
  async open(input: DeviceInput): Promise<boolean> {
    if (this.busy || input.request <= this.lastRequest) return false;
    this.lastRequest = input.request;
    const offer = this.offers.get(input.seq), now = this.clock();
    const report = async (status: Parameters<SessionModel["feedback"]>[2]) => {
      this.model.feedback(input.request, input.id, status); await this.publish();
    };
    if (input.event === "step") {
      if (!this.model.fresh(now)) { await report("unavailable"); return false; }
      const target = this.model.step(input.view, input.id, input.direction, now);
      this.model.feedback(input.request, target, "selected"); await this.publish(); return true;
    }
    if (!this.model.fresh(now) || !offer?.ids.has(input.id) || now - offer.at > STALE_MS) {
      await report("unavailable"); return false;
    }
    this.busy = true;
    try {
      await report("opening");
      const selected = this.model.find(input.id);
      const agents = await this.query();
      const target = agents.find(a => a.id === selected?.id);
      if (!target || !this.model.fresh(this.clock())) { await report("unavailable"); return false; }
      if (target.paneKey?.startsWith("structured-agent-session-") && target.hostId !== "local") {
        await report("unsupported"); return false;
      }
      await this.focus(target);
      if (eventKey(target) === offer.ids.get(input.id)) this.model.acknowledge(input.id, offer.ids.get(input.id));
      await report("opened"); return true;
    } catch (error) {
      await report(error instanceof TargetUnavailable ? "unavailable" : "retry"); return false;
    } finally { this.busy = false; }
  }
}
