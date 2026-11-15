import { execFileSync } from "node:child_process";
import { networkInterfaces } from "node:os";
import type { State } from "./state";
import { formatFeed } from "./deliver";

export function feedUrl(interfaces: ReturnType<typeof networkInterfaces>, port: number) {
  for (const addresses of Object.values(interfaces)) {
    const address = addresses?.find((entry) => entry.family === "IPv4" && !entry.internal);
    if (address) return `http://${address.address}:${port}/feed`;
  }
  throw new Error("No non-internal IPv4 address found");
}

export function pair(port: number, devicePort?: string) {
  const url = feedUrl(networkInterfaces(), port);
  console.log(url);
  execFileSync("npx", ["gea", "devctl", "storage", "set", "feedurl", url, "--board", "puck", ...(devicePort ? ["--port", devicePort] : [])], { stdio: "inherit" });
}

export function serve(port: number, latest: () => State | undefined) {
  return Bun.serve({
    hostname: "0.0.0.0", port,
    fetch(request) {
      if (request.method !== "GET" || new URL(request.url).pathname !== "/feed") return new Response("Not found", { status: 404 });
      const state = latest();
      if (!state) return new Response("Not ready", { status: 503 });
      return new Response(formatFeed(state), { headers: { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*", "Cache-Control": "no-store" } });
    },
  });
}
