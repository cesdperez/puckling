import type { Usage } from "./weigh";

export function displayModel(model: string) {
  return model.toLowerCase().replace(/^claude-/, "").replace(/-\d{8}$/, "").replace(/\s+/g, "-") || "unknown";
}

export function localDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function tokenTotal(usage: Usage) {
  return usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
}
