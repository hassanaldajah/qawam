import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import { SECURITY_HEADERS } from "../../functions/_lib/http";

const root = fileURLToPath(new URL("../../", import.meta.url));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".ts") ? [p] : [];
  });
}

describe("static rules", () => {
  const files = walk(join(root, "functions"));

  it("no template strings or concatenated variables inside prepare()", () => {
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      expect(src, f).not.toMatch(/prepare\(\s*`/);
      expect(src, f).not.toMatch(/\$\{[^}]*\}[^`]*(SELECT|INSERT|UPDATE|DELETE)\b/);
    }
  });

  it("_routes.json limits Functions to /api/*", () => {
    const r = JSON.parse(readFileSync(join(root, "public/_routes.json"), "utf8"));
    expect(r).toEqual({ version: 1, include: ["/api/*"], exclude: [] });
  });

  it("public/_headers: /* equals SECURITY_HEADERS minus Cache-Control; hashed assets immutable", () => {
    const text = readFileSync(join(root, "public/_headers"), "utf8");
    const rules = new Map<string, Record<string, string>>();
    let cur: Record<string, string> | null = null;
    for (const line of text.split(/\r?\n/)) {
      expect(line.length).toBeLessThan(2000);
      if (!line.trim() || line.startsWith("#")) continue;
      if (!/^\s/.test(line)) {
        cur = {};
        rules.set(line.trim(), cur);
        continue;
      }
      const i = line.indexOf(":");
      cur![line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    const expected = { ...SECURITY_HEADERS };
    delete expected["Cache-Control"];
    expect(rules.get("/*")).toEqual(expected);
    expect(rules.get("/assets/*")).toEqual({ "Cache-Control": "public, max-age=31536000, immutable" });
    for (const p of ["/", "/index.html", "/sw.js"]) expect(rules.get(p)).toEqual({ "Cache-Control": "no-cache" });
    expect(text).not.toMatch(/no-store/);
    const csp = expected["Content-Security-Policy"]!;
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("frame-src https://challenges.cloudflare.com");
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval/);
  });

  it("built index.html has no inline scripts or styles (CSP compatible)", () => {
    const p = join(root, "dist/index.html");
    let html: string;
    try {
      html = readFileSync(p, "utf8");
    } catch {
      return; // not built yet; `npm run build` then re-run
    }
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(html).not.toMatch(/<style\b|\sstyle="/);
  });

  it("wrangler.toml has the DB binding and no secret-looking values", () => {
    const t = readFileSync(join(root, "wrangler.toml"), "utf8");
    expect(t).toMatch(/binding = "DB"/);
    expect(t).not.toMatch(/(secret|token|password|api_key)\s*=/i);
  });
});
