import { parseOrca } from "./session";

export async function readOrca(executable = process.env.ORCA_CLI_COMMAND ?? "orca", timeoutMs = 5000) {
  const child = Bun.spawn([executable, "worktree", "ps", "--limit", "10000", "--json"], {
    stdout: "pipe", stderr: "pipe",
  });
  const timeout = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
  try {
    const [output, , exit] = await Promise.all([
      new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
    ]);
    if (exit !== 0) throw new Error(`Orca exited with status ${exit}`);
    return parseOrca(JSON.parse(output));
  } finally {
    clearTimeout(timeout);
  }
}
