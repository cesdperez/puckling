import { realpathSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";

export async function activateApp(app: string) {
  const child = Bun.spawn(["open", "-a", app], { stdout: "ignore", stderr: "ignore" });
  const timeout = setTimeout(() => child.kill("SIGKILL"), 5000);
  try {
    if (await child.exited !== 0) throw new Error("Unable to bring Orca to the front");
  } finally { clearTimeout(timeout); }
}

export async function revealChat(sessionId: string, executable = process.env.ORCA_CLI_COMMAND ?? "orca", activate = activateApp) {
  if (process.env.ORCA_ENVIRONMENT || process.env.ORCA_PAIRING_CODE || process.env.ORCA_REMOTE_PAIRING) {
    throw new Error("Native chat focus requires the local Orca runtime");
  }
  const binary = realpathSync(Bun.which(executable) ?? executable);
  const resources = dirname(dirname(binary));
  const app = resolve(resources, "../..");
  if (!app.endsWith(".app")) throw new Error("Native chat focus requires the installed macOS Orca app");
  // Orca exposes chat reveal through its runtime API, without a matching CLI command.
  const { RuntimeClient } = createRequire(import.meta.url)(join(resources, "app.asar.unpacked/out/cli/runtime-client.js"));
  const response = await new RuntimeClient(undefined, 5000, null, null).call("agentSession.reveal", { sessionId });
  if (response?.ok !== true || response.result?.ok !== true || response.result.sessionId !== sessionId) {
    throw new Error("Orca could not reveal the waiting chat");
  }
  await activate(app);
}
