import { describe, it, expect } from "vitest";
import { light, dark } from "../src/tokens";
const lum = (h: string) => { const c = [1,3,5].map(i => parseInt(h.slice(i,i+2),16)/255).map(v => v<=0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4); return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2]; };
const ratio = (a: string, b: string) => { const x = lum(a), y = lum(b); return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05); };
describe("WCAG AA (4.5:1) brand contrast", () => {
  for (const [name, t] of Object.entries({ light, dark })) {
    it(`${name}: text, primary button, accent text, green`, () => {
      expect(ratio(t.fg, t.bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.onPrimary, t.primary)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.accentText, t.bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.green, t.bg)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${name}: gradient end, muted text, text on cards`, () => {
      expect(ratio(t.onPrimary, t.primaryEnd)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.muted, t.bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.muted, t.card)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.fg, t.card)).toBeGreaterThanOrEqual(4.5);
    });
  }
});
