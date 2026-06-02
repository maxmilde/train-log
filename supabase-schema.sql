-- ============================================================
-- Train Log — Supabase Schema
-- Run this entire file in the Supabase SQL Editor
-- ============================================================

-- TABLES

CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL UNIQUE,
  weekly_goal integer DEFAULT 4,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workout_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  date date NOT NULL,
  day_type text CHECK (day_type IN ('workout', 'active_rest', 'rest')) DEFAULT 'rest',
  duration_minutes integer,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_day_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  exercise_name text NOT NULL DEFAULT '',
  weight_kg integer,
  weight_type text CHECK (weight_type IN ('single', 'double')) DEFAULT 'single',
  goal_reps integer,            -- target total reps for this exercise (sum across all sets)
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fk_workout_day FOREIGN KEY (workout_day_id) REFERENCES workout_days(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exercise_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_exercise_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users NOT NULL,
  set_number integer NOT NULL DEFAULT 1,
  reps integer,
  duration_seconds integer,
  weight_kg integer,            -- optional per-set weight override; falls back to workout_exercises.weight_kg
  created_at timestamptz DEFAULT now(),
  CONSTRAINT fk_workout_exercise FOREIGN KEY (workout_exercise_id) REFERENCES workout_exercises(id) ON DELETE CASCADE
);

-- For existing databases, add the column if it doesn't already exist.
ALTER TABLE exercise_sets ADD COLUMN IF NOT EXISTS weight_kg integer;

-- For existing databases, rename goal_sets → goal_reps (semantics changed to track reps, not sets).
-- Existing numeric values are preserved as-is but their meaning is now "target reps" instead of "target sets".
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='workout_exercises' AND column_name='goal_sets'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='workout_exercises' AND column_name='goal_reps'
  ) THEN
    EXECUTE 'ALTER TABLE workout_exercises RENAME COLUMN goal_sets TO goal_reps';
  END IF;
END$$;

-- INDEXES (for query performance)

CREATE INDEX IF NOT EXISTS idx_workout_days_user_date
  ON workout_days(user_id, date);

CREATE INDEX IF NOT EXISTS idx_workout_exercises_day
  ON workout_exercises(workout_day_id);

CREATE INDEX IF NOT EXISTS idx_workout_exercises_user_name
  ON workout_exercises(user_id, exercise_name);

CREATE INDEX IF NOT EXISTS idx_exercise_sets_exercise
  ON exercise_sets(workout_exercise_id);

-- ROW LEVEL SECURITY

ALTER TABLE user_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_days      ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_sets     ENABLE ROW LEVEL SECURITY;

-- user_settings
DROP POLICY IF EXISTS "own settings" ON user_settings;
CREATE POLICY "own settings" ON user_settings
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- workout_days
DROP POLICY IF EXISTS "own days" ON workout_days;
CREATE POLICY "own days" ON workout_days
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- workout_exercises
DROP POLICY IF EXISTS "own exercises" ON workout_exercises;
CREATE POLICY "own exercises" ON workout_exercises
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- exercise_sets
DROP POLICY IF EXISTS "own sets" ON exercise_sets;
CREATE POLICY "own sets" ON exercise_sets
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
