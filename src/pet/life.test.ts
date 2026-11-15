import { describe, expect, test } from "bun:test";
import { age, createLife, feed, HATCH_KCAL, HUNGER_HOURS, isNight, MEAL_KCAL, parseFood, parseLife, progress, serializeLife, STAGE_KCAL, STARVE_LOSS_PER_DAY, threshold } from "./life";
import type { Food, Life } from "./life";

function food(total: number, claude = total, codex = 0, opencode = 0, night = 0, parallel = 0): Food {
  return { total, claude, codex, opencode, night, parallel, tzMinutes: 60 };
}
function teen(diet: Food): Life {
  return { ...createLife(), stage: "teen", lifetime: threshold("adult"), diet };
}
describe("life", () => {
  test("first line feeds and hatches, repeated line does not eat", () => {
    const first = feed(createLife(), food(HATCH_KCAL));
    expect(first.ate).toBe(HATCH_KCAL);
    expect(first.life.stage).toBe("baby");
    expect(first.life.diet.total).toBe(0);
    const again = feed(first.life, food(HATCH_KCAL));
    expect(again.ate).toBe(0);
    expect(again.evolved).toBe(false);
  });
  test("surplus advances one stage per call and resets diet", () => {
    const meal = food(5000);
    let result = feed(createLife(), meal);
    expect(result.life.stage).toBe("baby");
    expect(result.life.lifetime).toBe(5000);
    result = feed(result.life, meal);
    expect(result.life.stage).toBe("child");
    result = feed(result.life, meal);
    expect(result.life.stage).toBe("teen");
    result = feed(result.life, meal);
    expect(result.life.stage).toBe("adult");
    expect(result.life.branch).toBe("ember");
    expect(result.life.diet.total).toBe(0);
    result = feed(result.life, meal);
    expect(result.life.stage).toBe("final");
    expect(progress(result.life)).toBe(1);
  });
  test("chooses adult branch with priority and ties", () => {
    const cases: [Food, string][] = [
      [food(100, 0, 100, 0, 35, 50), "night"],
      [food(100, 0, 100, 0, 34, 50), "swarm"],
      [food(100, 70, 20, 10), "ember"],
      [food(100, 10, 70, 20), "frost"],
      [food(100, 10, 20, 70), "moss"],
      [food(100, 50, 50, 0), "ember"],
      [food(100, 0, 50, 50), "ember"],
      [food(0), "ember"],
    ];
    for (const [diet, expected] of cases) expect(feed(teen(diet), food(0)).life.branch).toBe(expected);
  });
  test("feeder reset uses the whole line when any counter falls", () => {
    const initial = feed(createLife(), food(100, 60, 40)).life;
    const reset = feed(initial, food(110, 10, 100));
    expect(reset.ate).toBe(110);
    expect(reset.life.diet.total).toBe(210);
  });
  test("fullness drains before starvation and loss floors at stage threshold", () => {
    const full = feed(createLife(), food(MEAL_KCAL * 2)).life;
    expect(full.fullness).toBe(1);
    expect(age(full, HUNGER_HOURS * 3600).fullness).toBe(0);
    expect(age(full, HUNGER_HOURS * 3600).lifetime).toBe(full.lifetime);
    expect(age(full, HUNGER_HOURS * 3600 + 86400).lifetime).toBe(full.lifetime - STARVE_LOSS_PER_DAY * STAGE_KCAL);
    const baby = { ...full, stage: "baby" as const, lifetime: threshold("baby") + 10, fullness: 0 };
    expect(age(baby, 86400).lifetime).toBe(threshold("baby"));
    expect(age(full, -1)).toEqual(full);
  });
  test("serialization round trips and rejects malformed data", () => {
    const original = { ...feed(createLife(), food(50)).life, fullness: 0.12349, lifetime: 50.4 };
    const restored = parseLife(serializeLife(original));
    expect(restored).toEqual({ ...original, fullness: 0.123, lifetime: 50 });
    expect(serializeLife(original).length).toBeLessThan(4000);
    for (const text of ["", "garbage", "1 0 0", serializeLife(original) + " 1", serializeLife(original).replace("1 0 0", "2 0 0")]) expect(parseLife(text)).toBeUndefined();
    expect(parseFood("1 10 4 3 3 2 1 -60")).toEqual({ total: 10, claude: 4, codex: 3, opencode: 3, night: 2, parallel: 1, tzMinutes: -60 });
    for (const text of ["", "garbage", "2 1 1 0 0 0 0 0", "1 1 0 0 0 0 0 x", "1 -1 0 0 0 0 0 0", "1 1.5 0 0 0 0 0 0"]) expect(parseFood(text)).toBeUndefined();
  });
  test("night uses local hour and requires a set clock", () => {
    const day = Date.UTC(2024, 0, 1);
    expect(isNight(day + 20 * 3600000 + 59 * 60000, 60)).toBe(false);
    expect(isNight(day + 21 * 3600000, 60)).toBe(true);
    expect(isNight(day + 5 * 3600000 + 59 * 60000, 60)).toBe(true);
    expect(isNight(day + 6 * 3600000, 60)).toBe(false);
    expect(isNight(0, 60)).toBe(false);
  });
  test("does not mutate inputs", () => {
    const original = createLife(), meal = food(50);
    const before = structuredClone(original), mealBefore = structuredClone(meal);
    const next = feed(original, meal).life;
    age(next, 10);
    expect(original).toEqual(before);
    expect(meal).toEqual(mealBefore);
    expect(next.fullness).toBe(50 / MEAL_KCAL);
  });
});
