import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import i18n, { applyLang } from "../../src/i18n";
import { BottomNav, TABS } from "../../src/app/BottomNav";
import { evaluate, makeBackupCode, type Goal } from "../../src/lib/plan";
import { canLeaveSafety } from "../../src/onboarding/Onboarding";

const base: Goal = { current: 80, target: 75, heightCm: 170, age: 30, sex: "m", activity: 1.55, weeks: 12, pregnant: false, medical: false };

describe("QA: RTL / i18n", () => {
  it("Arabic is the default language", () => {
    expect(i18n.language).toBe("ar");
  });
  it("applyLang sets dir/lang on <html> (rtl for ar, ltr for en)", () => {
    const doc = { documentElement: {} as Record<string, string> };
    (globalThis as any).document = doc;
    applyLang("ar");
    expect(doc.documentElement.dir).toBe("rtl");
    applyLang("en");
    expect(doc.documentElement.dir).toBe("ltr");
    expect(doc.documentElement.lang).toBe("en");
    delete (globalThis as any).document;
  });
  it("ar and en have identical key sets and no HTML in strings", () => {
    const flat = (o: any, p = ""): string[] => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flat(v, p + k + ".") : [p + k]));
    const ar = i18n.getResourceBundle("ar", "translation");
    const en = i18n.getResourceBundle("en", "translation");
    expect(flat(ar).sort()).toEqual(flat(en).sort());
    expect(JSON.stringify([ar, en])).not.toMatch(/<[a-z][^>]*>/i);
  });
  it("nav: 5 links, Log is the middle one, labels exist in both languages", () => {
    expect(TABS[2]!.key).not.toBe("log");
    expect(TABS.map((t) => t.key).indexOf("log")).toBe(1);
    const html = renderToString(<MemoryRouter><BottomNav /></MemoryRouter>);
    expect((html.match(/<a /g) ?? []).length).toBe(5);
    for (const l of ["ar", "en"]) for (const t of TABS) expect(i18n.getResource(l, "translation", `nav.${t.key}`), `${l}.${t.key}`).toBeTruthy();
  });
});

describe("QA: onboarding safety gating boundaries", () => {
  it("exactly 1%/week passes; just above fails", () => {
    expect(evaluate({ ...base, current: 100, target: 90, weeks: 10 }).issues).not.toContain("rate");
    expect(evaluate({ ...base, current: 100, target: 89, weeks: 10 }).issues).toContain("rate");
  });
  it("age 18 allowed, 17 blocked", () => {
    expect(evaluate({ ...base, age: 18 }).issues).not.toContain("minor");
    expect(canLeaveSafety({ ...base, age: 17 })).toBe(false);
  });
  it("pregnancy/medical block even for maintenance or gain goals", () => {
    expect(canLeaveSafety({ ...base, target: 80, pregnant: true })).toBe(false);
    expect(canLeaveSafety({ ...base, target: 85, medical: true })).toBe(false);
  });
  it("suggested safeWeeks always yields a safe plan", () => {
    for (const [c, t, w] of [[120, 80, 2], [60, 50, 1], [200, 100, 3]] as const) {
      const p = evaluate({ ...base, current: c, target: t, weeks: w });
      expect(evaluate({ ...base, current: c, target: t, weeks: p.safeWeeks }).issues).not.toContain("rate");
    }
  });
  it("garbage input never passes the gate", () => {
    for (const patch of [{ current: Infinity }, { target: -5 }, { weeks: 0 }, { weeks: NaN }, { heightCm: 500 }, { age: 200 }, { current: 10, target: 10 }])
      expect(canLeaveSafety({ ...base, ...patch }), JSON.stringify(patch)).toBe(false);
  });
  it("QA-1 fixed: target far below a healthy BMI is blocked", () => {
    // 35 kg at 170 cm = BMI 12.1
    expect(canLeaveSafety({ ...base, current: 50, target: 35, weeks: 60 }), "BMI<18.5 target should be blocked").toBe(false);
  });
  it("backup codes are unique across generations", () => {
    expect(new Set(Array.from({ length: 200 }, makeBackupCode)).size).toBe(200);
  });
});
