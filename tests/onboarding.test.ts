import { describe, it, expect } from "vitest";
import { evaluate, makeBackupCode, type Goal } from "../src/lib/plan";
import { canFinishBackup, canLeaveGoal, canLeaveSafety } from "../src/onboarding/Onboarding";

const base: Goal = { current: 80, target: 75, heightCm: 170, age: 30, sex: "m", activity: 1.55, weeks: 12, pregnant: false, medical: false };

describe("onboarding validation", () => {
  it("accepts a safe plan", () => {
    const p = evaluate(base);
    expect(p.ok).toBe(true);
    expect(p.kcal).toBeGreaterThan(1500);
    expect(canLeaveSafety(base)).toBe(true);
  });
  it("rejects invalid numbers", () => {
    expect(canLeaveGoal({ ...base, current: NaN })).toBe(false);
    expect(canLeaveGoal({ ...base, age: 0 })).toBe(false);
    expect(canLeaveGoal({ ...base, heightCm: 20 })).toBe(false);
  });
  it("blocks loss above 1%/week and suggests a safe duration", () => {
    const g = { ...base, target: 65, weeks: 4 };
    const p = evaluate(g);
    expect(p.issues).toContain("rate");
    expect(canLeaveSafety(g)).toBe(false);
    expect(evaluate({ ...g, weeks: p.safeWeeks }).issues).not.toContain("rate");
  });
  it("blocks minors, pregnancy, medical, and kcal below floor", () => {
    expect(evaluate({ ...base, age: 17 }).issues).toContain("minor");
    expect(evaluate({ ...base, pregnant: true }).issues).toContain("pregnancy");
    expect(evaluate({ ...base, medical: true }).issues).toContain("medical");
    expect(evaluate({ ...base, sex: "f", current: 50, target: 45, heightCm: 150, age: 60, activity: 1.375, weeks: 8 }).issues).toContain("floor");
  });
  it("backup step requires the checkbox", () => {
    expect(canFinishBackup(false)).toBe(false);
    expect(canFinishBackup(true)).toBe(true);
  });
  it("generates a formatted random code", () => {
    const c = makeBackupCode();
    expect(c).toMatch(/^([A-Z2-9]{4}-){3}[A-Z2-9]{4}$/);
    expect(makeBackupCode()).not.toBe(c);
  });
});
