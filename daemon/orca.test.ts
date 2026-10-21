import { afterAll, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readOrca } from "./orca";

const directory = mkdtempSync(join(tmpdir(), "puckling-orca-"));
afterAll(() => rmSync(directory, { recursive: true, force: true }));

function executable(name: string, script: string) {
  const path = join(directory, name);
  writeFileSync(path, "#!/bin/sh\n" + script);
  chmodSync(path, 0o700);
  return path;
}

test("queries the real CLI argument shape and parses a successful snapshot", async () => {
  const cli = executable("ready", `
test "$*" = 'worktree ps --limit 10000 --json' || exit 2
echo '{"ok":true,"result":{"worktrees":[],"truncated":false,"hostScope":{"omittedHostIds":[]}}}'
`);
  expect(await readOrca(cli)).toEqual([]);
});

test("CLI errors, missing binaries and invalid output reject", async () => {
  await expect(readOrca(executable("failed", "exit 1"))).rejects.toThrow();
  await expect(readOrca(join(directory, "missing"))).rejects.toThrow();
  await expect(readOrca(executable("invalid", "echo not-json"))).rejects.toThrow();
});

test("a stalled CLI is killed", async () => {
  const start = performance.now();
  await expect(readOrca(executable("stalled", "exec sleep 20"), 50)).rejects.toThrow();
  expect(performance.now() - start).toBeLessThan(2000);
});

test("unavailable Orca emits a disconnected snapshot instead of claiming idle is current", async () => {
  const child = Bun.spawn(["bun", "daemon/main.ts", "--once"], {
    env: { ...process.env, ORCA_CLI_COMMAND: executable("offline", "exit 1") },
    stdout: "pipe", stderr: "pipe",
  });
  const [output, error, exit] = await Promise.all([
    new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
  ]);
  expect(exit).toBe(0);
  expect(JSON.parse(output)).toEqual({ version: 1, type: "state", state: "idle", connected: false });
  expect(error).toContain("Orca unavailable");
});
