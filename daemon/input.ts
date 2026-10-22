export type OpenInput = { version: 2; type: "input"; event: "open"; id: string; seq: number; request: number };
export type StepInput = Omit<OpenInput, "event"> & { event: "step"; view: number; direction: number };
export type DeviceInput = OpenInput | StepInput;
export class InputStream {
  private line = "";
  private discarded = false;
  feed(bytes: Uint8Array): DeviceInput[] {
    const events: DeviceInput[] = [];
    for (const byte of bytes) {
      if (byte === 10) {
        if (!this.discarded) {
          try {
            if (this.line.includes("\\")) throw new Error("Escaped input field");
            const a = JSON.parse(this.line);
            const keys = [...this.line.matchAll(/"([a-z]+)"\s*:/g)].map(match => match[1]);
            if (new Set(keys).size !== keys.length) throw new Error("Duplicate input field");
            if (a?.version === 2 && a.type === "input" && ["open", "step"].includes(a.event) && typeof a.id === "string" && (a.event === "step" && a.id === "" || /^[a-f0-9]{16}$/.test(a.id)) &&
              Number.isSafeInteger(a.seq) && a.seq > 0 && a.seq <= 2147483647 &&
              Number.isSafeInteger(a.request) && a.request > 0 && a.request <= 2147483647 && (a.event === "open" ? Object.keys(a).length === 6 : Object.keys(a).length === 8 && [0,1,2].includes(a.view) && [-1,1].includes(a.direction))) events.push(a);
          } catch {}
        }
        this.line = ""; this.discarded = false;
      } else if (this.line.length === 255 || byte === 0 || byte > 127) this.discarded = true;
      else if (!this.discarded) this.line += String.fromCharCode(byte);
    }
    return events;
  }
}
export async function readInputs(onInput: (input: DeviceInput) => Promise<unknown>) {
  const stream = new InputStream();
  for await (const bytes of Bun.stdin.stream()) for (const event of stream.feed(bytes)) void onInput(event).catch(() => console.error("Focus request failed"));
}
