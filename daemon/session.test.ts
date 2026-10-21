import { describe, expect, test } from "bun:test";
import { parseOrca, SessionReducer, type AgentState } from "./session";

const agent = (id: string, state: AgentState) => ({ id, state });
const response = (agents: unknown[] = []) => ({
  ok: true,
  result: {
    worktrees: [{ hostId: "local", worktreeId: "tree", agents }],
    truncated: false,
    hostScope: { omittedHostIds: [] },
  },
});

describe("Orca snapshots", () => {
  test("extracts stable identities without retaining session content", () => {
    expect(parseOrca(response([{ paneKey: "pane", state: "working", prompt: "private" }]))).toEqual([
      agent("local/tree/pane", "working"),
    ]);
  });

  test("ignores archived worktrees", () => {
    const data = response();
    data.result.worktrees.push({ ...data.result.worktrees[0], isArchived: true, agents: [{}] } as any);
    expect(parseOrca(data)).toEqual([]);
  });

  test("rejects failures, malformed rows, unknown states, and incomplete coverage", () => {
    for (const data of [
      { ok: false, error: { code: "runtime_access_denied" } },
      {}, response([{}]), response([{ paneKey: "pane", state: "surprise" }]),
      { ...response(), result: { ...response().result, truncated: true } },
      { ...response(), result: { ...response().result, hostScope: { omittedHostIds: ["remote"] } } },
    ]) expect(() => parseOrca(data)).toThrow();
  });
});

describe("aggregate behaviour", () => {
  test("idle with no agents and no celebration for historical done agents", () => {
    expect(new SessionReducer().update([], 0)).toBe("idle");
    expect(new SessionReducer().update([agent("a", "done")], 0)).toBe("idle");
  });

  test("waiting and blocked take priority over working and completion", () => {
    for (const state of ["waiting", "blocked"] as const) {
      const reducer = new SessionReducer();
      reducer.update([agent("a", "working")], 0);
      expect(reducer.update([agent("a", "done"), agent("b", "working"), agent("c", state)], 2000)).toBe("needs_me");
    }
  });

  test("completion lasts four seconds, overrides working, and does not repeat", () => {
    const reducer = new SessionReducer();
    reducer.update([agent("a", "working"), agent("b", "working")], 0);
    expect(reducer.update([agent("a", "done"), agent("b", "working")], 2000)).toBe("just_finished");
    expect(reducer.update([agent("a", "done"), agent("b", "working")], 4000)).toBe("just_finished");
    expect(reducer.update([agent("a", "done"), agent("b", "working")], 6000)).toBe("working");
    expect(reducer.update([agent("a", "done"), agent("b", "done")], 8000)).toBe("just_finished");
    expect(reducer.update([agent("a", "done"), agent("b", "done")], 12000)).toBe("idle");
  });

  test("new or disappearing sessions are not completion events", () => {
    const reducer = new SessionReducer();
    reducer.update([agent("a", "working")], 0);
    expect(reducer.update([agent("b", "done")], 2000)).toBe("idle");
  });

  test("reconnection establishes a baseline without celebrating missed events", () => {
    const reducer = new SessionReducer();
    reducer.update([agent("a", "working")], 0);
    reducer.disconnect();
    expect(reducer.update([agent("a", "done")], 6000)).toBe("idle");
  });
});
