import type { Ctx } from "../../_lib/types";
import { error, json, nowSec } from "../../_lib/http";
import { requireSession, withRefresh } from "../../_lib/session";
import { consume } from "../../_lib/ratelimit";
import { USER_TABLES, type UserTable } from "../../_lib/tables";

export const EXPORTS_PER_HOUR = 5;
export const EXPORT_PAGES_PER_HOUR = 200;
/** Rows per table per response: bounds CPU/memory of JSON.stringify (10 ms CPU on Free). */
export const EXPORT_PAGE = 2000;

type Row = Record<string, unknown> & { _cursor?: number };

async function page(ctx: Ctx, t: UserTable, userId: string, after: number) {
  const r = await ctx.env.DB.prepare(t.exportSql).bind(userId, after, EXPORT_PAGE + 1).all<Row>();
  return shape(r.results);
}

function shape(rows: Row[]): { rows: Row[]; next: number | null } {
  const more = rows.length > EXPORT_PAGE;
  if (more) rows.length = EXPORT_PAGE;
  const next = more ? (rows[rows.length - 1]!._cursor ?? null) : null;
  for (const r of rows) delete r._cursor;
  return { rows, next };
}

/**
 * GET /api/auth/export : the user's data as JSON (no secrets/hashes).
 * Without query: first page of every table + `next` = { table: cursor } for tables with more.
 * With ?table=<name>&after=<cursor>: the next page of one table ({ table, rows, next }).
 */
export const onRequestGet = async (ctx: Ctx): Promise<Response> => {
  const s = await requireSession(ctx);
  const db = ctx.env.DB;
  const now = nowSec();
  const url = new URL(ctx.request.url);
  const tableName = url.searchParams.get("table");

  if (tableName !== null) {
    const t = USER_TABLES.find((x) => x.name === tableName);
    const afterRaw = url.searchParams.get("after") ?? "";
    if (!t || !/^\d{1,15}$/.test(afterRaw)) return withRefresh(error(400, "invalid_query"), s);
    if (!(await consume(db, "export_page:" + s.userId, EXPORT_PAGES_PER_HOUR, 3600, now, ctx.waitUntil))) {
      return withRefresh(error(429, "rate_limited", { "Retry-After": "3600" }), s);
    }
    const p = await page(ctx, t, s.userId, Number(afterRaw));
    return withRefresh(json({ table: t.name, rows: p.rows, next: p.next }), s);
  }

  if (!(await consume(db, "export:" + s.userId, EXPORTS_PER_HOUR, 3600, now, ctx.waitUntil))) {
    return withRefresh(error(429, "rate_limited", { "Retry-After": "3600" }), s);
  }
  const results = await db.batch<Row>(USER_TABLES.map((t) => db.prepare(t.exportSql).bind(s.userId, 0, EXPORT_PAGE + 1)));
  const user = await db.prepare("SELECT created_at FROM users WHERE id = ?1").bind(s.userId).first();
  const next: Record<string, number> = {};
  const data: Record<string, unknown> = { format: "qawam-export-v2", exported_at: now, account: user };
  USER_TABLES.forEach((t, i) => {
    const p = shape(results[i]!.results);
    data[t.name] = p.rows;
    if (p.next !== null) next[t.name] = p.next;
  });
  data.next = next;
  return withRefresh(
    json(data, 200, { "Content-Disposition": 'attachment; filename="qawam-export.json"' }),
    s,
  );
};
