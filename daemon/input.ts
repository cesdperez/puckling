export class TapStream {
  private line = "";
  private discarded = false;

  feed(bytes: Uint8Array): number {
    let taps = 0;
    for (const byte of bytes) {
      if (byte === 10) {
        if (!this.discarded && this.isTap()) taps++;
        this.line = "";
        this.discarded = false;
      } else if (this.line.length === 255 || byte === 0 || byte > 127) {
        this.discarded = true;
      } else if (!this.discarded) this.line += String.fromCharCode(byte);
    }
    return taps;
  }

  private isTap(): boolean {
    try {
      const input = JSON.parse(this.line);
      return input?.version === 1 && input.type === "input" && input.event === "tap" && Object.keys(input).length === 3;
    } catch {
      return false;
    }
  }
}

export async function readTaps(onTap: () => Promise<unknown>) {
  const stream = new TapStream();
  for await (const bytes of Bun.stdin.stream()) {
    const count = stream.feed(bytes);
    for (let i = 0; i < count; i++) {
      void onTap().catch(error => console.error(`Unable to focus session: ${error instanceof Error ? error.message : "request failed"}`));
    }
  }
}
