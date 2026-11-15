export type Stage = "egg" | "baby" | "child" | "teen" | "adult" | "final";
export type Branch = "none" | "ember" | "frost" | "moss" | "night" | "swarm";
export type Food = { total: number; claude: number; codex: number; opencode: number; night: number; parallel: number; tzMinutes: number };
export type Life = { stage: Stage; branch: Branch; lifetime: number; fullness: number; diet: Food; last: Food; seen: boolean };
export const STAGES: Stage[] = ["egg", "baby", "child", "teen", "adult", "final"];
export const BRANCHES: Branch[] = ["none", "ember", "frost", "moss", "night", "swarm"];
export const STAGE_KCAL = 1000;
export const HATCH_KCAL = STAGE_KCAL / 2;
export const MEAL_KCAL = STAGE_KCAL / 8;
export const HUNGER_HOURS = 16;
export const STARVE_LOSS_PER_DAY = 0.1;

function emptyFood(): Food {
  return { total: 0, claude: 0, codex: 0, opencode: 0, night: 0, parallel: 0, tzMinutes: 0 };
}
function copyFood(food: Food): Food {
  return { total: food.total, claude: food.claude, codex: food.codex, opencode: food.opencode, night: food.night, parallel: food.parallel, tzMinutes: food.tzMinutes };
}
export function createLife(): Life {
  return { stage: "egg", branch: "none", lifetime: 0, fullness: 0, diet: emptyFood(), last: emptyFood(), seen: false };
}
function numbers(text: string): number[] {
  const parts = text.split(" "), result: number[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "") return [];
    const n = Number(parts[i]);
    if (!Number.isFinite(n)) return [];
    result.push(n);
  }
  return result;
}
function foodAt(n: number[], i: number): Food {
  return { total: n[i], claude: n[i + 1], codex: n[i + 2], opencode: n[i + 3], night: n[i + 4], parallel: n[i + 5], tzMinutes: n[i + 6] };
}
function validFood(f: Food): boolean {
  return f.total >= 0 && f.claude >= 0 && f.codex >= 0 && f.opencode >= 0 && f.night >= 0 && f.parallel >= 0 &&
    Math.floor(f.total) === f.total && Math.floor(f.claude) === f.claude && Math.floor(f.codex) === f.codex &&
    Math.floor(f.opencode) === f.opencode && Math.floor(f.night) === f.night && Math.floor(f.parallel) === f.parallel && Math.floor(f.tzMinutes) === f.tzMinutes;
}
export function parseFood(line: string): Food | undefined {
  const n = numbers(line);
  if (n.length !== 8 || n[0] !== 1) return undefined;
  const food = foodAt(n, 1);
  return validFood(food) ? food : undefined;
}
export function threshold(stage: Stage): number {
  const i = STAGES.indexOf(stage);
  return i <= 0 ? 0 : HATCH_KCAL + (i - 1) * STAGE_KCAL;
}
export function progress(life: Life): number {
  const i = STAGES.indexOf(life.stage);
  if (i === STAGES.length - 1) return 1;
  return Math.min(1, Math.max(0, (life.lifetime - threshold(life.stage)) / (threshold(STAGES[i + 1]) - threshold(life.stage))));
}
function branch(d: Food): Branch {
  if (d.total > 0 && d.night / d.total >= 0.35) return "night";
  if (d.total > 0 && d.parallel / d.total >= 0.5) return "swarm";
  if (d.codex > d.claude && d.codex > d.opencode) return "frost";
  if (d.opencode > d.claude && d.opencode > d.codex) return "moss";
  return "ember";
}
export function feed(life: Life, food: Food): { life: Life; ate: number; evolved: boolean } {
  const last = life.last;
  const reset = !life.seen || food.total < last.total || food.claude < last.claude || food.codex < last.codex || food.opencode < last.opencode || food.night < last.night || food.parallel < last.parallel;
  const base = reset ? emptyFood() : last;
  const delta = { total: food.total - base.total, claude: food.claude - base.claude, codex: food.codex - base.codex, opencode: food.opencode - base.opencode, night: food.night - base.night, parallel: food.parallel - base.parallel, tzMinutes: 0 };
  const diet = { total: life.diet.total + delta.total, claude: life.diet.claude + delta.claude, codex: life.diet.codex + delta.codex, opencode: life.diet.opencode + delta.opencode, night: life.diet.night + delta.night, parallel: life.diet.parallel + delta.parallel, tzMinutes: life.diet.tzMinutes };
  const result: Life = { stage: life.stage, branch: life.branch, lifetime: life.lifetime + delta.total, fullness: Math.min(1, life.fullness + delta.total / MEAL_KCAL), diet, last: copyFood(food), seen: true };
  const i = STAGES.indexOf(result.stage);
  let evolved = false;
  if (i < STAGES.length - 1 && result.lifetime >= threshold(STAGES[i + 1])) {
    result.stage = STAGES[i + 1];
    if (result.stage === "adult") result.branch = branch(result.diet);
    result.diet = emptyFood();
    evolved = true;
  }
  return { life: result, ate: delta.total, evolved };
}
export function age(life: Life, seconds: number): Life {
  const result: Life = { stage: life.stage, branch: life.branch, lifetime: life.lifetime, fullness: life.fullness, diet: copyFood(life.diet), last: copyFood(life.last), seen: life.seen };
  if (seconds <= 0) return result;
  const emptySeconds = Math.max(0, seconds - life.fullness * HUNGER_HOURS * 3600);
  result.fullness = Math.max(0, life.fullness - seconds / (HUNGER_HOURS * 3600));
  result.lifetime = Math.max(threshold(life.stage), life.lifetime - emptySeconds / 86400 * STARVE_LOSS_PER_DAY * STAGE_KCAL);
  return result;
}
function foodText(f: Food): string {
  return Math.round(f.total) + " " + Math.round(f.claude) + " " + Math.round(f.codex) + " " + Math.round(f.opencode) + " " + Math.round(f.night) + " " + Math.round(f.parallel) + " " + Math.round(f.tzMinutes);
}
export function serializeLife(life: Life): string {
  return "1 " + STAGES.indexOf(life.stage) + " " + BRANCHES.indexOf(life.branch) + " " + Math.round(life.lifetime) + " " + Math.round(life.fullness * 1000) / 1000 + " " + foodText(life.diet) + " " + foodText(life.last) + " " + (life.seen ? 1 : 0);
}
export function parseLife(text: string): Life | undefined {
  const n = numbers(text);
  if (n.length !== 20 || n[0] !== 1 || Math.floor(n[1]) !== n[1] || n[1] < 0 || n[1] >= STAGES.length || Math.floor(n[2]) !== n[2] || n[2] < 0 || n[2] >= BRANCHES.length || n[3] < 0 || Math.floor(n[3]) !== n[3] || n[4] < 0 || n[4] > 1 || (n[19] !== 0 && n[19] !== 1)) return undefined;
  const diet = foodAt(n, 5), last = foodAt(n, 12);
  if (!validFood(diet) || !validFood(last)) return undefined;
  return { stage: STAGES[n[1]], branch: BRANCHES[n[2]], lifetime: n[3], fullness: n[4], diet, last, seen: n[19] === 1 };
}
export function isNight(epochMs: number, tzMinutes: number): boolean {
  if (epochMs < 1600000000000) return false;
  const hour = Math.floor((epochMs + tzMinutes * 60000) / 3600000) % 24;
  return hour >= 22 || hour < 7;
}
