import { readOrca } from "./orca";
import { SessionReducer, type Behaviour, type Snapshot } from "./session";
import { FocusController } from "./focus";
import { readTaps } from "./input";
import { openSession } from "./open-session";

const args = process.argv.slice(2);
if (args.some(arg => arg !== "--once")) {
  console.error("Usage: bun daemon/main.ts [--once]");
  process.exit(1);
}

const reducer = new SessionReducer();
const focus = new FocusController(readOrca, openSession);
if (!args.includes("--once")) {
  void readTaps(async () => {
    if (await focus.tap()) console.error("Focused waiting session");
  }).catch(error => console.error(`Input link failed: ${error instanceof Error ? error.message : "read failed"}`));
}
let state: Behaviour = "idle";
let wasConnected: boolean | undefined;

do {
  const started = performance.now();
  let connected = false;
  try {
    state = reducer.update(await readOrca(), performance.now());
    connected = true;
  } catch (error) {
    reducer.disconnect();
    if (wasConnected !== false) console.error(`Orca unavailable: ${error instanceof Error ? error.message : "query failed"}`);
  }
  if (connected && wasConnected !== true) console.error("Orca connected");
  wasConnected = connected;
  const snapshot: Snapshot = { version: 1, type: "state", state, connected };
  focus.update(snapshot);
  await Bun.write(Bun.stdout, JSON.stringify(snapshot) + "\n");
  if (args.includes("--once")) break;
  await Bun.sleep(Math.max(0, 2000 - (performance.now() - started)));
} while (true);
