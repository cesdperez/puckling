import { readOrca } from "./orca";
import { MAX_LINE, SessionModel } from "./session";
import { FocusController } from "./focus";
import { readInputs } from "./input";
import { openSession } from "./open-session";

const args = process.argv.slice(2);
if (args.some(arg => arg !== "--once")) { console.error("Usage: bun daemon/main.ts [--once]"); process.exit(1); }
const model = new SessionModel();
let writes = Promise.resolve();
async function publish() {
  const snapshot = model.snapshot(Date.now());
  const line = JSON.stringify(snapshot) + "\n";
  if (line.length > MAX_LINE) throw new Error("Snapshot exceeds protocol bound");
  focus.offered(snapshot);
  writes = writes.then(async () => { await Bun.write(Bun.stdout, line); });
  await writes;
}
const focus = new FocusController(model, readOrca, openSession, publish);
if (!args.includes("--once")) void readInputs(input => focus.open(input)).catch(() => console.error("Input link failed"));
do {
  const started = Date.now();
  try { model.update(await readOrca(), Date.now()); }
  catch { model.disconnect(); console.error("Orca unavailable"); }
  await publish();
  if (args.includes("--once")) break;
  await Bun.sleep(Math.max(0, 2000 - (Date.now() - started)));
} while (true);
