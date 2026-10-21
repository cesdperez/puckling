import { terminalForAgent } from "./focus";
import { revealChat } from "./native";
import { callOrca } from "./orca";
import type { Agent } from "./session";

export async function openSession(agent: Agent, cli = callOrca, chat = revealChat) {
  if (agent.paneKey?.startsWith("structured-agent-session-")) {
    if (agent.hostId !== "local") throw new Error("Native chat focus requires a chat on this Mac");
    const separator = agent.paneKey.indexOf(":");
    const sessionId = agent.paneKey.slice("structured-agent-session-".length, separator);
    if (separator < 0 || !/^[A-Za-z0-9_-]{8,128}$/.test(sessionId)) throw new Error("Invalid native chat identity");
    await chat(sessionId);
    return;
  }
  const response = await cli(["terminal", "list", "--limit", "10000"]);
  const result = response.result;
  if (result?.truncated !== false || !Array.isArray(result.terminals) ||
      !Array.isArray(result.hostScope?.omittedHostIds) || result.hostScope.omittedHostIds.length) {
    throw new Error("Incomplete Orca terminal list");
  }
  const handle = terminalForAgent(agent, result.terminals);
  const switched = await cli(["terminal", "switch", "--terminal", handle]);
  if (switched.result?.focus?.navigated !== true) throw new Error("Orca did not focus the waiting terminal");
}
