export type OpenInput = { version: 2; type: "input"; event: "open"; id: string; seq: number; request: number };
export class InputStream {
  private line = "";
  private discarded = false;
  feed(bytes: Uint8Array): OpenInput[] {
    const events: OpenInput[] = [];
    for (const byte of bytes) {
      if (byte === 10) {
        if (!this.discarded) {
          try {
            const a = JSON.parse(this.line);
            if (a?.version === 2 && a.type === "input" && a.event === "open" && /^[a-f0-9]{16}$/.test(a.id) &&
              Number.isSafeInteger(a.seq) && a.seq > 0 && a.seq <= 2147483647 &&
              Number.isSafeInteger(a.request) && a.request > 0 && a.request <= 2147483647 && Object.keys(a).length === 6) events.push(a);
          } catch {}
        }
        this.line = ""; this.discarded = false;
      } else if (this.line.length === 255 || byte === 0 || byte > 127) this.discarded = true;
      else if (!this.discarded) this.line += String.fromCharCode(byte);
    }
    return events;
  }
}
export async function readInputs(onInput: (input: OpenInput) => Promise<unknown>) {
  const stream = new InputStream();
  for await (const bytes of Bun.stdin.stream()) for (const event of stream.feed(bytes)) void onInput(event).catch(() => console.error("Focus request failed"));
}
