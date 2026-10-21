import { expect, test } from "bun:test";
import { FocusController, oldestWaiting, sessionForTap, terminalForAgent } from "./focus";
import { TapStream } from "./input";
import type { Agent } from "./session";

const agent = (id: string, state: Agent["state"], stateStartedAt?: number): Agent => ({
  id, state, stateStartedAt, hostId: "local", worktreeId: "tree", paneKey: `${id}:leaf`,
});

test("selects the oldest waiting or blocked agent, with stable ties and unknown times last", () => {
  const agents = [agent("working", "working", 1), agent("done", "done", 1),
    agent("unknown", "waiting"), agent("new", "waiting", 200), agent("old", "blocked", 100)];
  expect(oldestWaiting(agents)?.id).toBe("old");
  expect(oldestWaiting([agent("b", "waiting", 100), agent("a", "blocked", 100)])?.id).toBe("a");
  expect(oldestWaiting([])).toBeUndefined();
});

test("matches the exact host, worktree, tab and pane instead of another terminal", () => {
  const waiting = agent("tab", "waiting", 100);
  const terminal = { handle: "term_right", executionHostId: "local", worktreeId: "tree",
    tabId: "tab", leafId: "leaf", connected: true, orphaned: false };
  expect(terminalForAgent(waiting, [
    { ...terminal, handle: "wrong_host", executionHostId: "ssh:other" },
    { ...terminal, handle: "wrong_tree", worktreeId: "other" },
    { ...terminal, handle: "wrong_leaf", leafId: "other" },
    { ...terminal, handle: "orphan", orphaned: true },
    { ...terminal, handle: "disconnected", connected: false }, terminal,
  ])).toBe("term_right");
  expect(() => terminalForAgent(waiting, [])).toThrow();
  expect(() => terminalForAgent(waiting, [terminal, { ...terminal, handle: "duplicate" }])).toThrow();
});

test("live taps select waiting first, then newest working, then newest finished", () => {
  const active = [agent("older", "working", 1), agent("newer", "working", 2), agent("done", "done", 3)];
  expect(sessionForTap(active)?.id).toBe("newer");
  expect(sessionForTap([...active, agent("waiting", "waiting", 0)])?.id).toBe("waiting");
  expect(sessionForTap([agent("old", "done", 1), agent("latest", "done", 2), agent("unknown", "done")])?.id).toBe("latest");
  expect(sessionForTap([agent("b", "working"), agent("a", "working")])?.id).toBe("a");
  expect(sessionForTap([])).toBeUndefined();
});

test("taps before a connection or after an outage do not query or focus", async () => {
  let calls = 0;
  const focus = new FocusController(async () => { calls++; return []; }, async () => { calls++; });
  expect(await focus.tap()).toBe(false);
  focus.update({ version: 1, type: "state", state: "needs_me", connected: false });
  expect(await focus.tap()).toBe(false);
  expect(calls).toBe(0);
});

test("working, idle and finished expressions all allow live session navigation", async () => {
  const focused: string[] = [];
  const focus = new FocusController(async () => [agent("active", "working", 2)], async target => { focused.push(target.id); });
  for (const state of ["idle", "working", "just_finished"] as const) {
    focus.update({ version: 1, type: "state", state, connected: true });
    expect(await focus.tap()).toBe(true);
  }
  expect(focused).toEqual(["active", "active", "active"]);
});

test("rechecks live agents and focuses the oldest remaining waiter", async () => {
  const focused: string[] = [];
  const focus = new FocusController(async () => [agent("resolved", "done", 1), agent("waiting", "waiting", 2)],
    async target => { focused.push(target.id); });
  focus.update({ version: 1, type: "state", state: "needs_me", connected: true });
  expect(await focus.tap()).toBe(true);
  expect(focused).toEqual(["waiting"]);
});

test("resolved sessions and overlapping taps cannot switch to an unrelated session", async () => {
  let finish!: (agents: Agent[]) => void;
  let focused = false;
  const focus = new FocusController(() => new Promise(resolve => { finish = resolve; }), async () => { focused = true; });
  focus.update({ version: 1, type: "state", state: "needs_me", connected: true });
  const first = focus.tap();
  expect(await focus.tap()).toBe(false);
  finish([]);
  expect(await first).toBe(false);
  expect(focused).toBe(false);
});

test("a failed focus can be retried", async () => {
  let attempts = 0;
  const focus = new FocusController(async () => [agent("a", "waiting", 1)], async () => {
    if (++attempts === 1) throw new Error("session gone");
  });
  focus.update({ version: 1, type: "state", state: "needs_me", connected: true });
  await expect(focus.tap()).rejects.toThrow("session gone");
  expect(await focus.tap()).toBe(true);
});

test("accepts framed taps and ignores malformed, oversized and unsupported input", () => {
  const stream = new TapStream();
  const encode = (s: string) => new TextEncoder().encode(s);
  expect(stream.feed(encode('{"version":1,"type":"input",'))).toBe(0);
  expect(stream.feed(encode('"event":"tap"}\n'))).toBe(1);
  for (const line of ["not json", "x".repeat(300),
    '{"version":2,"type":"input","event":"tap"}',
    '{"version":1,"type":"state","event":"tap"}',
    '{"version":1,"type":"input","event":"turn"}',
    '{"version":1,"type":"input","event":"tap","terminal":"untrusted"}',
    '{"version":1,"type":"input","event":"tap"}\0',
  ]) expect(stream.feed(encode(line + "\n"))).toBe(0);
  expect(stream.feed(encode('{"event":"tap","type":"input","version":1}\r\n'.repeat(2)))).toBe(2);
});
