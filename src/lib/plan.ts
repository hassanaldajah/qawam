export type Sex = "m" | "f";
export interface Goal {
  current: number; target: number; heightCm: number; age: number; sex: Sex;
  activity: number; weeks: number; pregnant: boolean; medical: boolean;
}
export type Issue = "rate" | "floor" | "minor" | "bmi" | "pregnancy" | "medical" | "invalid";
export interface Plan { kcal: number; pctPerWeek: number; issues: Issue[]; safeWeeks: number; ok: boolean }

const KCAL_PER_KG = 7700;
export function evaluate(g: Goal): Plan {
  const valid = [g.current, g.target, g.heightCm, g.age, g.weeks].every((n) => Number.isFinite(n) && n > 0);
  if (!valid || g.current < 30 || g.current > 400 || g.target < 30 || g.heightCm < 100 || g.heightCm > 250 || g.age > 120)
    return { kcal: 0, pctPerWeek: 0, issues: ["invalid"], safeWeeks: 0, ok: false };
  const bmr = 10 * g.current + 6.25 * g.heightCm - 5 * g.age + (g.sex === "m" ? 5 : -161);
  const tdee = bmr * g.activity;
  const lossKg = Math.max(0, g.current - g.target);
  const pct = (lossKg / g.current / g.weeks) * 100;
  const kcal = Math.round(tdee - (lossKg / g.weeks) * (KCAL_PER_KG / 7));
  const floor = g.sex === "m" ? 1500 : 1200;
  const issues: Issue[] = [];
  if (pct > 1) issues.push("rate");
  if (lossKg > 0 && kcal < floor) issues.push("floor");
  const hm = g.heightCm / 100;
  if (lossKg > 0 && g.target / (hm * hm) < 18.5) issues.push("bmi");
  if (g.age < 18) issues.push("minor");
  if (g.pregnant) issues.push("pregnancy");
  if (g.medical) issues.push("medical");
  const safeWeeks = lossKg > 0 ? Math.max(g.weeks, Math.ceil(lossKg / g.current / 0.01)) : g.weeks;
  return { kcal, pctPerWeek: Math.round(pct * 100) / 100, issues, safeWeeks, ok: issues.length === 0 };
}
export function makeBackupCode(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  const abc = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const s = Array.from(a, (b) => abc[b % abc.length]).join("");
  return s.match(/.{4}/g)!.join("-");
}
