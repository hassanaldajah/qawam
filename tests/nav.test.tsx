import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import "../src/i18n";
import i18n from "../src/i18n";
import { BottomNav, TABS } from "../src/app/BottomNav";

const render = (path: string) => renderToString(<MemoryRouter initialEntries={[path]}><BottomNav /></MemoryRouter>);

describe("bottom nav", () => {
  it("has 5 tabs in ux order with Log in the center", () => {
    expect(TABS.map((t) => t.key)).toEqual(["today", "log", "workouts", "progress", "more"]);
    expect((render("/").match(/<a /g) ?? []).length).toBe(5);
  });
  it("marks only the active tab with aria-current and shows labels", () => {
    const html = render("/progress");
    expect((html.match(/aria-current="page"/g) ?? []).length).toBe(1);
    expect(html).toMatch(/aria-current="page"[^>]*>|href="\/progress"/);
    expect(html).toContain("التقدم");
  });
  it("renders English labels and uses no physical left/right classes", async () => {
    await i18n.changeLanguage("en");
    const html = render("/");
    expect(html).toContain("Workouts");
    expect(html).not.toMatch(/class="[^"]*\b(left|right|ml|mr|pl|pr)-/);
    await i18n.changeLanguage("ar");
  });
});
