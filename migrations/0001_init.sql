-- Qawam initial schema (D1 / SQLite). Timestamps = unix seconds (INTEGER).
-- Calendar days = 'YYYY-MM-DD' TEXT (user's local day). Every user table is scoped by user_id.
-- Note: keep one statement per ';' and no triggers (test runner splits on ';').

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
) STRICT;

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 64),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE backup_codes (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  public_id TEXT NOT NULL UNIQUE CHECK (length(public_id) = 10),
  secret_hash TEXT NOT NULL CHECK (length(secret_hash) = 64),
  created_at INTEGER NOT NULL,
  -- Set when the code was reset without the old code (session only); drives a banner.
  -- No failure counter / lock on purpose: any account-keyed lock is attacker-controlled.
  reset_without_code_at INTEGER
) STRICT;

CREATE TABLE profile (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sex TEXT CHECK (sex IN ('male', 'female')),
  birth_year INTEGER CHECK (birth_year BETWEEN 1900 AND 2100),
  height_cm REAL CHECK (height_cm BETWEEN 50 AND 260),
  activity_level TEXT CHECK (activity_level IN ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal TEXT CHECK (goal IN ('lose', 'maintain', 'gain')),
  target_weight_kg REAL CHECK (target_weight_kg BETWEEN 20 AND 400),
  is_pregnant INTEGER NOT NULL DEFAULT 0 CHECK (is_pregnant IN (0, 1)),
  locale TEXT NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar', 'en')),
  updated_at INTEGER NOT NULL
) STRICT;

CREATE TABLE weight_log (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL CHECK (length(day) = 10),
  weight_kg REAL NOT NULL CHECK (weight_kg BETWEEN 20 AND 400),
  created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_weight_user_day ON weight_log(user_id, day);

CREATE TABLE custom_foods (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  kcal_100g REAL NOT NULL CHECK (kcal_100g BETWEEN 0 AND 900),
  protein_100g REAL NOT NULL DEFAULT 0 CHECK (protein_100g BETWEEN 0 AND 100),
  carbs_100g REAL NOT NULL DEFAULT 0 CHECK (carbs_100g BETWEEN 0 AND 100),
  fat_100g REAL NOT NULL DEFAULT 0 CHECK (fat_100g BETWEEN 0 AND 100),
  fiber_100g REAL NOT NULL DEFAULT 0 CHECK (fiber_100g BETWEEN 0 AND 100),
  created_at INTEGER NOT NULL,
  UNIQUE (id, user_id)
) STRICT;
CREATE INDEX idx_custom_foods_user ON custom_foods(user_id);

CREATE TABLE meals (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL CHECK (length(day) = 10),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'text', 'photo')),
  created_at INTEGER NOT NULL,
  UNIQUE (id, user_id)
) STRICT;
CREATE INDEX idx_meals_user_day ON meals(user_id, day);

CREATE TABLE meal_items (
  id INTEGER PRIMARY KEY,
  meal_id INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_ref TEXT CHECK (food_ref IS NULL OR length(food_ref) <= 40),
  custom_food_id INTEGER,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  grams REAL NOT NULL CHECK (grams BETWEEN 1 AND 2000),
  kcal REAL NOT NULL CHECK (kcal BETWEEN 0 AND 20000),
  protein_g REAL NOT NULL DEFAULT 0 CHECK (protein_g >= 0),
  carbs_g REAL NOT NULL DEFAULT 0 CHECK (carbs_g >= 0),
  fat_g REAL NOT NULL DEFAULT 0 CHECK (fat_g >= 0),
  fiber_g REAL NOT NULL DEFAULT 0 CHECK (fiber_g >= 0),
  is_estimate INTEGER NOT NULL DEFAULT 0 CHECK (is_estimate IN (0, 1)),
  created_at INTEGER NOT NULL,
  -- User-scoped FKs: an item can only point at a meal / custom food of the SAME user.
  FOREIGN KEY (meal_id, user_id) REFERENCES meals(id, user_id) ON DELETE CASCADE,
  -- No action clause (checked at statement end, so the users cascade still works).
  -- Deleting a custom food: first UPDATE meal_items SET custom_food_id = NULL in the same batch.
  FOREIGN KEY (custom_food_id, user_id) REFERENCES custom_foods(id, user_id)
) STRICT;
CREATE INDEX idx_meal_items_user_meal ON meal_items(user_id, meal_id);
CREATE INDEX idx_meal_items_meal ON meal_items(meal_id);

CREATE TABLE steps (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL CHECK (length(day) = 10),
  steps INTEGER NOT NULL CHECK (steps BETWEEN 0 AND 100000),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, day)
) STRICT;

CREATE TABLE water (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL CHECK (length(day) = 10),
  ml INTEGER NOT NULL CHECK (ml BETWEEN 0 AND 5000),
  created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_water_user_day ON water(user_id, day);

CREATE TABLE measurements (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL CHECK (length(day) = 10),
  kind TEXT NOT NULL CHECK (kind IN ('waist', 'hip', 'chest', 'arm', 'thigh', 'neck', 'body_fat_pct')),
  value REAL NOT NULL CHECK (value > 0 AND value < 400),
  created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_measurements_user_day ON measurements(user_id, day);

CREATE TABLE workout_logs (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL CHECK (length(day) = 10),
  workout_type TEXT NOT NULL CHECK (length(workout_type) BETWEEN 1 AND 40),
  duration_min INTEGER NOT NULL CHECK (duration_min BETWEEN 0 AND 1440),
  kcal_burned REAL CHECK (kcal_burned IS NULL OR kcal_burned BETWEEN 0 AND 10000),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 500),
  created_at INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_workouts_user_day ON workout_logs(user_id, day);

-- Per-user quotas (AI calls etc.). Reserve atomically: UPDATE ... WHERE used < cap.
CREATE TABLE usage_counters (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL CHECK (length(day) = 10),
  kind TEXT NOT NULL CHECK (kind IN ('ai_photo', 'ai_text')),
  used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0),
  PRIMARY KEY (user_id, day, kind)
) STRICT;

-- iOS Shortcut keys (phase 2): hash only, explicit scopes, max 3 per user enforced in code.
CREATE TABLE shortcut_keys (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE CHECK (length(key_hash) = 64),
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 40),
  scopes TEXT NOT NULL CHECK (length(scopes) <= 100),
  created_at INTEGER NOT NULL,
  last_used_day TEXT,
  expires_at INTEGER,
  revoked_at INTEGER
) STRICT;
CREATE INDEX idx_shortcut_keys_user ON shortcut_keys(user_id);

-- Global (not user-scoped) by design. Owner edits via `wrangler d1 execute`.
CREATE TABLE global_flags (
  key TEXT PRIMARY KEY CHECK (key IN ('ai_enabled')),
  value INTEGER NOT NULL CHECK (value IN (0, 1))
) STRICT;
INSERT INTO global_flags (key, value) VALUES ('ai_enabled', 1);

-- Authoritative daily neuron budget. Reserve: UPDATE ... SET neurons_used = neurons_used + ?
-- WHERE day = ? AND neurons_used + ? <= neuron_cap RETURNING neurons_used.
CREATE TABLE global_counters (
  day TEXT PRIMARY KEY CHECK (length(day) = 10),
  neurons_used INTEGER NOT NULL DEFAULT 0 CHECK (neurons_used >= 0),
  neuron_cap INTEGER NOT NULL DEFAULT 8500 CHECK (neuron_cap >= 0),
  ai_calls INTEGER NOT NULL DEFAULT 0 CHECK (ai_calls >= 0)
) STRICT;

-- Rate-limit buckets; key holds a hashed IP or a user id, never a raw IP.
CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
) STRICT;
CREATE INDEX idx_rate_limits_window ON rate_limits(window_start);

-- Minimal audit trail (no payload). Survives account deletion on purpose; purged after 90 days.
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('account_create', 'account_delete', 'restore', 'backup_code_create', 'backup_code_reset', 'shortcut_key_create')),
  ts INTEGER NOT NULL
) STRICT;
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_ts ON audit_log(ts);
