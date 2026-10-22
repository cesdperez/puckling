import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { revealChat } from "./native";
import { openSession } from "./open-session";

const directory = mkdtempSync(join(tmpdir(), "puckling-native-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));
const sessionId = "codex_11111111_2222_4333_8444_555555555555";
const target = { id: "agent", state: "waiting" as const, hostId: "local", worktreeId: "tree", paneKey: "tab:leaf" };
const terminals = { ok: true, result: { truncated: false, hostScope: { omittedHostIds: [] }, terminals: [
  { handle: "term_waiting", worktreeId: "tree", executionHostId: "local", tabId: "tab", leafId: "leaf", connected: true, orphaned: false },
] } };

test("terminal focus uses a discovered handle and verifies navigation", async () => {
  const commands: string[][] = [];
  await openSession(target, async args => {
    commands.push(args);
    return args[1] === "list" ? terminals : { ok: true, result: { focus: { navigated: true } } };
  });
  expect(commands).toEqual([["terminal", "list", "--limit", "10000"], ["terminal", "switch", "--terminal", "term_waiting"]]);
});

test("incomplete discovery and failed navigation are not reported as success", async () => {
  await expect(openSession(target, async () => ({ ok: true, result: { ...terminals.result, truncated: true } }))).rejects.toThrow();
  await expect(openSession(target, async args => args[1] === "list" ? terminals :
    { ok: true, result: { focus: { navigated: false } } })).rejects.toThrow();
});

test("native chat focus reveals the exact local session without terminal discovery", async () => {
  const revealed: string[] = [];
  const native = { ...target, paneKey: `structured-agent-session-${sessionId}:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee` };
  await openSession(native, async () => { throw new Error("terminal discovery was not expected"); },
    async id => { revealed.push(id); });
  expect(revealed).toEqual([sessionId]);
  await expect(openSession({ ...native, hostId: "remote" })).rejects.toThrow("on this Mac");
});

function fixture(name: string, result: string) {
  const app = join(directory, name + ".app");
  const resources = join(app, "Contents/Resources");
  mkdirSync(join(resources, "bin"), { recursive: true });
  const module = join(resources, "app.asar.unpacked/out/cli");
  mkdirSync(module, { recursive: true });
  const binary = join(resources, "bin/orca");
  writeFileSync(binary, "");
  writeFileSync(join(module, "runtime-client.js"), `module.exports.RuntimeClient = class {
    async call(method, params) {
      if (method !== "agentSession.reveal" || params.sessionId !== "${sessionId}") throw new Error("Wrong reveal request");
      return ${result};
    }
  };`);
  return { binary, app: realpathSync(app) };
}

test("the bundled runtime adapter activates Orca only after a confirmed reveal", async () => {
  const { binary, app } = fixture("ready", '{ok:true,result:{ok:true,sessionId:params.sessionId}}');
  const activated: string[] = [];
  await revealChat(sessionId, binary, async path => { activated.push(path); });
  expect(activated).toEqual([app]);
  for (const [name, result] of [["refused", "{ok:true,result:{ok:false}}"],
    ["wrong", '{ok:true,result:{ok:true,sessionId:"other"}}']]) {
    const { binary } = fixture(name, result);
    await expect(revealChat(sessionId, binary, async () => { activated.push("unexpected"); })).rejects.toThrow();
  }
  expect(activated).toEqual([app]);
});

test("source freshness is checked after terminal discovery and immediately before navigation",async()=>{
  const commands:string[][]=[];
  await expect(openSession(target,async args=>{commands.push(args);return terminals;},undefined,()=>false)).rejects.toThrow("stale");
  expect(commands).toHaveLength(1);expect(commands[0][1]).toBe("list");
});
