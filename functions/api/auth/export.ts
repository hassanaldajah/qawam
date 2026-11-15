import type { Ctx } from "../../_lib/types";
import { json, nowSec } from "../../_lib/http";
import { requireSession, withRefresh } from "../../_lib/session";
import { USER_TABLES } from "../../_lib/tables";

/** GET /api/auth/export : all of the user's data as JSON (no secrets/hashes). */
export const onRequestGet = async (ctx: Ctx): Promise<Response> => {
  const s = await requireSession(ctx);
  const db = ctx.env.DB;
  const results = await db.batch(USER_TABLES.map((t) => db.prepare(t.exportSql).bind(s.userId)));
  const user = await db.prepare("SELECT created_at FROM users WHERE id = ?1").bind(s.userId).first();
  const data: Record<string, unknown> = { format: "qawam-export-v1", exported_at: nowSec(), account: user };
  USER_TABLES.forEach((t, i) => (data[t.name] = results[i]!.results));
  return withRefresh(
    json(data, 200, { "Content-Disposition": 'attachment; filename="qawam-export.json"' }),
    s,
  );
};
