// Static SQL per user-scoped table (literal strings only; no interpolation).
// Order matters for delete: children first.
// exportSql binds (?1 user_id, ?2 rowid cursor, ?3 limit); _cursor is stripped before output.
export interface UserTable {
  name: string;
  exportSql: string;
  deleteSql: string;
}

export const USER_TABLES: UserTable[] = [
  {
    name: "meal_items",
    exportSql:
      "SELECT rowid AS _cursor, id, meal_id, food_ref, custom_food_id, name, grams, kcal, protein_g, carbs_g, fat_g, fiber_g, is_estimate, created_at FROM meal_items WHERE user_id = ?1 AND rowid > ?2 ORDER BY rowid LIMIT ?3",
    deleteSql: "DELETE FROM meal_items WHERE user_id = ?1",
  },
  {
    name: "meals",
    exportSql: "SELECT rowid AS _cursor, id, day, meal_type, source, created_at FROM meals WHERE user_id = ?1 AND rowid > ?2 ORDER BY rowid LIMIT ?3",
    deleteSql: "DELETE FROM meals WHERE user_id = ?1",
  },
  {
    name: "custom_foods",
    exportSql:
      "SELECT rowid AS _cursor, id, name, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, created_at FROM custom_foods WHERE user_id = ?1 AND rowid > ?2 ORDER BY rowid LIMIT ?3",
    deleteSql: "DELETE FROM custom_foods WHERE user_id = ?1",
  },
  {
    name: "profile",
    exportSql:
      "SELECT rowid AS _cursor, sex, birth_year, height_cm, activity_level, goal, target_weight_kg, is_pregnant, locale, updated_at FROM profile WHERE user_id = ?1 AND rowid > ?2 ORDER BY rowid LIMIT ?3",
    deleteSql: "DELETE FROM profile WHERE user_id = ?1",
  },
  {
    name: "weight_log",
    exportSql: "SELECT rowid AS _cursor, id, day, weight_kg, created_at FROM weight_log WHERE user_id = ?1 AND rowid > ?2 ORDER BY rowid LIMIT ?3",
    deleteSql: "DELETE FROM weight_log WHERE user_id = ?1",
  },
  {
    name: "steps",
    exportSql: "SELECT rowid AS _cursor, day, steps, updated_at FROM steps WHERE user_id = ?1 AND rowid > ?2 ORDER BY rowid LIMIT ?3",
    deleteSql: "DELETE FROM steps WHERE user_id = ?1",
  },
  {
    name: "water",
    exportSql: "SELECT rowid AS _cursor, id, day, ml, created_at FROM water WHERE user_id = ?1 AND rowid > ?2 ORDER BY rowid LIMIT ?3",
    deleteSql: "DELETE FROM water WHERE user_id = ?1",
  },
  {
    name: "measurements",
    exportSql: "SELECT rowid AS _cursor, id, day, kind, value, created_at FROM measurements WHERE user_id = ?1 AND rowid > ?2 ORDER BY rowid LIMIT ?3",
    deleteSql: "DELETE FROM measurements WHERE user_id = ?1",
  },
  {
    name: "workout_logs",
    exportSql:
      "SELECT rowid AS _cursor, id, day, workout_type, duration_min, kcal_burned, notes, created_at FROM workout_logs WHERE user_id = ?1 AND rowid > ?2 ORDER BY rowid LIMIT ?3",
    deleteSql: "DELETE FROM workout_logs WHERE user_id = ?1",
  },
  {
    name: "usage_counters",
    exportSql: "SELECT rowid AS _cursor, day, kind, used FROM usage_counters WHERE user_id = ?1 AND rowid > ?2 ORDER BY rowid LIMIT ?3",
    deleteSql: "DELETE FROM usage_counters WHERE user_id = ?1",
  },
  {
    // Export metadata only; key_hash never leaves the server.
    name: "shortcut_keys",
    exportSql: "SELECT rowid AS _cursor, label, scopes, created_at, last_used_day, expires_at, revoked_at FROM shortcut_keys WHERE user_id = ?1 AND rowid > ?2 ORDER BY rowid LIMIT ?3",
    deleteSql: "DELETE FROM shortcut_keys WHERE user_id = ?1",
  },
  {
    name: "backup_codes",
    exportSql: "SELECT rowid AS _cursor, created_at FROM backup_codes WHERE user_id = ?1 AND rowid > ?2 ORDER BY rowid LIMIT ?3",
    deleteSql: "DELETE FROM backup_codes WHERE user_id = ?1",
  },
  {
    name: "sessions",
    exportSql: "SELECT rowid AS _cursor, created_at, last_seen FROM sessions WHERE user_id = ?1 AND rowid > ?2 ORDER BY rowid LIMIT ?3",
    deleteSql: "DELETE FROM sessions WHERE user_id = ?1",
  },
];
