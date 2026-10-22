import { expect, test } from "bun:test";
import { parseOrca, SessionModel, cardState, MAX_LINE, type Agent } from "./session";
export const agent = (id: string, state: Agent["state"], extra: Partial<Agent> = {}): Agent => ({
  id, state, hostId: "local", worktreeId: "tree", paneKey: id + ":leaf", stateStartedAt: 100, ...extra,
});
const response = (worktrees: unknown[]) => ({ ok: true, result: { worktrees, truncated: false, hostScope: { omittedHostIds: [] } } });
test("metadata covers projects, mixed agents and siblings without private content or unread inference", () => {
  const a = parseOrca(response([
    { hostId: "local", worktreeId: "a", repo: "one", unread: true, agents: [
      { paneKey: "tab:leaf", state: "working", agentType: "claude", workingMode: "monitoring", prompt: "secret", displayName: "Review" },
      { paneKey: "structured-agent-session-codex_123456:leaf", state: "done", agentType: "codex", mainAgent: { outcome: "failure" } },
    ] },
    { hostId: "local", worktreeId: "b", repo: "two", agents: [{ paneKey: "tab:leaf", state: "waiting" }] },
    { isArchived: true, agents: [{}] },
  ]));
  expect(a.length).toBe(3);expect(new Set(a.map(a => a.id)).size).toBe(3);
  expect(a.map(cardState)).toEqual([5,2,0]);expect(JSON.stringify(a)).not.toContain("secret");
  expect(a.map(a => a.project)).toEqual(["one","one","two"]);
});
test("requires complete valid coverage and unambiguous identities", () => {
  const t = { hostId: "local", worktreeId: "a", agents: [{ paneKey: "tab", state: "done" }] };
  for (const data of [{}, {ok:false}, response([{}]), response([t,t]),
    { ok:true,result:{...response([]).result,truncated:true}},
    { ok:true,result:{...response([]).result,hostScope:{omittedHostIds:["remote"]}}},
    response([{...t,agents:[{paneKey:"a",state:"nonsense"}]}])]) expect(() => parseOrca(data)).toThrow();
});
test("historical done sessions baseline silently; only observed successful completion alerts", () => {
  const m=new SessionModel();m.update([agent("old","done",{outcome:"success"}),agent("a","working")],1000);
  expect(m.snapshot(1000).attention).toBe(0);
  m.update([agent("old","done",{outcome:"success"}),agent("a","done",{outcome:"success",stateStartedAt:2000})],2000);
  let s=m.snapshot(2000);expect(s.attention).toBe(1);expect(s.sessions[0][4]).toBe(3);
  m.acknowledge(s.sessions[0][0]);expect(m.snapshot(3000).attention).toBe(0);
  m.update([agent("a","done",{outcome:"success",stateStartedAt:2000})],4000);expect(m.snapshot(4000).attention).toBe(0);
  m.disconnect();m.update([agent("a","done",{outcome:"success",stateStartedAt:5000})],6000);expect(m.snapshot(6000).attention).toBe(0);
});
test("requests precede completions; opening sees but does not resolve an actionable event", () => {
  const m=new SessionModel();m.update([agent("a","working")],1000);
  m.update([agent("a","done",{outcome:"success",stateStartedAt:2000}),agent("b","waiting"),agent("c","blocked"),agent("d","done",{outcome:"failure"})],2000);
  let s=m.snapshot(2000);expect(s.attention).toBe(4);expect(s.sessions.at(-1)![4]).toBe(3);
  const token=s.sessions[0][0];m.acknowledge(token);s=m.snapshot(2500);
  expect(s.attention).toBe(4);expect(s.sessions[0][0]).not.toBe(token);expect(s.sessions.find(c => c[0]===token)![6]).toBe(true);
  m.update([agent("b","working"),agent("c","blocked"),agent("d","done",{outcome:"failure"})],3000);
  expect(m.snapshot(3000).attention).toBe(2);
});
test("unknown outcomes are never success, monitoring never counts as work", () => {
  const m=new SessionModel();m.update([agent("a","working",{workingMode:"monitoring"}),agent("b","working"),agent("c","done")],1000);
  const s=m.snapshot(1000);expect(s.working).toBe(1);expect(s.monitoring).toBe(1);expect(s.attention).toBe(0);
  expect(cardState(agent("c","done"))).toBe(7);
  expect(cardState(agent("c","done",{outcome:"interruption"}))).toBe(1);
});
test("stable ties, 24 hour history, bounded frames, explicit truncation and fresh links", () => {
  const now=100000000, m=new SessionModel();
  const a=Array.from({length:50},(_,i)=>agent(String(i),"waiting",{project:"P".repeat(24),title:"T".repeat(30),agentType:"claude"}));
  m.update([...a,agent("old","done",{stateStartedAt:now-86400001}),agent("unknown","done",{stateStartedAt:undefined})],now);
  const first=m.snapshot(now);m.update([...a].reverse(),now+10);const second=m.snapshot(now+10);
  expect(first.sessions.map(c=>c[0])).toEqual(second.sessions.map(c=>c[0]));expect(first.total).toBe(50);expect(first.sessions.length).toBe(32);
  expect(JSON.stringify(first).length).toBeLessThan(MAX_LINE);expect(m.fresh(now+8011)).toBe(false);
  m.disconnect();expect(m.snapshot(now+20).connected).toBe(false);
});
test("cues batch new events and acknowledgements do not repeat a cue", () => {
  const m=new SessionModel();m.update([agent("a","waiting")],1000);expect(m.snapshot(1000).cue).toBe(1);
  m.update([agent("a","waiting"),agent("b","waiting")],2000);expect(m.snapshot(2000).cue).toBe(1);
  let s=m.snapshot(4000);expect(s.cue).toBe(1);m.acknowledge(s.sessions[0][0]);expect(m.snapshot(5000).cue).toBe(1);
  m.update([agent("a","waiting"),agent("b","waiting"),agent("c","blocked")],6000);expect(m.snapshot(6000).cue).toBe(2);
});

test("all sessions remain reachable through bounded windows while page selections stay pinned", () => {
  const m=new SessionModel(),now=1000000;
  const rows=Array.from({length:90},(_,i)=>agent(String(i),i%2?"working":"waiting",{stateStartedAt:i,project:"Project "+i}));
  m.update(rows,now);let s=m.snapshot(now),home=s.sessions[0][0],id=home;const reached=new Set<string>();
  for(let i=0;i<90;i++){
    reached.add(id);id=m.step(2,id,1,now);s=m.snapshot(now);
    expect(s.sessions.length).toBeLessThanOrEqual(32);expect(s.sessions.some(c=>c[0]===id)).toBe(true);
    expect(s.sessions.some(c=>c[0]===home)).toBe(true);expect(s.total).toBe(90);
  }
  expect(reached.size).toBe(90);
  m.update([agent("new","waiting",{stateStartedAt:0}),...rows],now+1);
  expect(m.snapshot(now+1).sessions.some(c=>c[0]===home)).toBe(true);
});

test("late success metadata never turns historical done into a fresh alert", () => {
  const m=new SessionModel();m.update([agent("a","done")],1000);
  m.update([agent("a","done",{outcome:"success"})],2000);expect(m.snapshot(2000).attention).toBe(0);
  m.update([agent("a","working")],3000);m.update([agent("a","done",{stateStartedAt:4000})],4000);
  expect(m.snapshot(4000).attention).toBe(1);const cue=m.snapshot(4000).cue;
  m.update([agent("a","done",{stateStartedAt:4000,outcome:"success"})],5000);
  expect(m.snapshot(5000).attention).toBe(1);expect(m.snapshot(5000).cue).toBe(cue);
});
