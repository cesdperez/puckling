import { parseOrca } from "./session";

export async function callOrca(args: string[], executable = process.env.ORCA_CLI_COMMAND ?? "orca", timeoutMs = 5000) {
  const child = Bun.spawn([executable, ...args, "--json"], {
    stdout: "pipe", stderr: "pipe",
  });
  const timeout = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
  try {
    const [output, , exit] = await Promise.all([
      new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
    ]);
    if (exit !== 0) throw new Error(`Orca exited with status ${exit}`);
    const response = JSON.parse(output);
    if (response?.ok !== true) throw new Error("Orca query failed");
    return response;
  } finally {
    clearTimeout(timeout);
  }
}

export async function readOrca(executable = process.env.ORCA_CLI_COMMAND ?? "orca", timeoutMs = 5000) {
  return parseOrca(await callOrca(["worktree", "ps", "--limit", "10000"], executable, timeoutMs));
}
