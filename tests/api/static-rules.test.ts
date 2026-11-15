import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";

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

  it("wrangler.toml has the DB binding and no secret-looking values", () => {
    const t = readFileSync(join(root, "wrangler.toml"), "utf8");
    expect(t).toMatch(/binding = "DB"/);
    expect(t).not.toMatch(/(secret|token|password|api_key)\s*=/i);
  });
});
