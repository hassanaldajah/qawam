// Static SQL per user-scoped table (literal strings only; no interpolation).
// Order matters for delete: children first.
export interface UserTable {
  name: string;
  exportSql: string;
  deleteSql: string;
}

export const USER_TABLES: UserTable[] = [
  {
    name: "meal_items",
    exportSql:
      "SELECT id, meal_id, food_ref, custom_food_id, name, grams, kcal, protein_g, carbs_g, fat_g, fiber_g, is_estimate, created_at FROM meal_items WHERE user_id = ?1 ORDER BY id",
    deleteSql: "DELETE FROM meal_items WHERE user_id = ?1",
  },
  {
    name: "meals",
    exportSql: "SELECT id, day, meal_type, source, created_at FROM meals WHERE user_id = ?1 ORDER BY id",
    deleteSql: "DELETE FROM meals WHERE user_id = ?1",
  },
  {
    name: "custom_foods",
    exportSql:
      "SELECT id, name, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, created_at FROM custom_foods WHERE user_id = ?1 ORDER BY id",
    deleteSql: "DELETE FROM custom_foods WHERE user_id = ?1",
  },
  {
    name: "profile",
    exportSql:
      "SELECT sex, birth_year, height_cm, activity_level, goal, target_weight_kg, is_pregnant, locale, updated_at FROM profile WHERE user_id = ?1",
    deleteSql: "DELETE FROM profile WHERE user_id = ?1",
  },
  {
    name: "weight_log",
    exportSql: "SELECT id, day, weight_kg, created_at FROM weight_log WHERE user_id = ?1 ORDER BY day, id",
    deleteSql: "DELETE FROM weight_log WHERE user_id = ?1",
  },
  {
    name: "steps",
    exportSql: "SELECT day, steps, updated_at FROM steps WHERE user_id = ?1 ORDER BY day",
    deleteSql: "DELETE FROM steps WHERE user_id = ?1",
  },
  {
    name: "water",
    exportSql: "SELECT id, day, ml, created_at FROM water WHERE user_id = ?1 ORDER BY day, id",
    deleteSql: "DELETE FROM water WHERE user_id = ?1",
  },
  {
    name: "measurements",
    exportSql: "SELECT id, day, kind, value, created_at FROM measurements WHERE user_id = ?1 ORDER BY day, id",
    deleteSql: "DELETE FROM measurements WHERE user_id = ?1",
  },
  {
    name: "workout_logs",
    exportSql:
      "SELECT id, day, workout_type, duration_min, kcal_burned, notes, created_at FROM workout_logs WHERE user_id = ?1 ORDER BY day, id",
    deleteSql: "DELETE FROM workout_logs WHERE user_id = ?1",
  },
  {
    name: "usage_counters",
    exportSql: "SELECT day, kind, used FROM usage_counters WHERE user_id = ?1 ORDER BY day",
    deleteSql: "DELETE FROM usage_counters WHERE user_id = ?1",
  },
  {
    // Export metadata only; key_hash never leaves the server.
    name: "shortcut_keys",
    exportSql: "SELECT label, scopes, created_at, last_used_day, expires_at, revoked_at FROM shortcut_keys WHERE user_id = ?1",
    deleteSql: "DELETE FROM shortcut_keys WHERE user_id = ?1",
  },
  {
    name: "backup_codes",
    exportSql: "SELECT created_at FROM backup_codes WHERE user_id = ?1",
    deleteSql: "DELETE FROM backup_codes WHERE user_id = ?1",
  },
  {
    name: "sessions",
    exportSql: "SELECT created_at, last_seen FROM sessions WHERE user_id = ?1",
    deleteSql: "DELETE FROM sessions WHERE user_id = ?1",
  },
];
