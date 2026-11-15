export type Usage = {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
};
export const modelFactors = [
  ["opus", 1],
  ["sonnet", 0.6],
  ["haiku", 0.2],
  ["sol", 0.5],
  ["terra", 0.2],
  ["luna", 0.02],
  ["deepseek", 0.03],
  ["flash", 0.03],
  ["gpt", 0.4],
] as const;
export function modelFactor(model: string) {
  return (
    modelFactors.find(([name]) => model.toLowerCase().includes(name))?.[1] ??
    0.3
  );
}
export function weigh(usage: Usage, model: string) {
  return (
    (usage.output * 5 +
      usage.input +
      usage.cacheWrite * 1.25 +
      usage.cacheRead * 0.1) *
    modelFactor(model)
  );
}
