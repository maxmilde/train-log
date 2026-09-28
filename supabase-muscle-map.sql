-- Muscle map: which muscles each exercise trains.
-- Run once in the Supabase SQL editor. Safe to run again.
-- Built-in defaults live in the app (src/lib/muscles.js); this table only holds the
-- ones you set or change in the app. name_key is the lower-cased, trimmed exercise name.

CREATE TABLE IF NOT EXISTS exercise_muscles (
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name_key           text NOT NULL,
  primary_muscles    text[] NOT NULL DEFAULT '{}',
  secondary_muscles  text[] NOT NULL DEFAULT '{}',
  tertiary_muscles   text[] NOT NULL DEFAULT '{}',
  quaternary_muscles text[] NOT NULL DEFAULT '{}',
  not_counted        boolean NOT NULL DEFAULT false,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, name_key)
);

ALTER TABLE exercise_muscles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own exercise muscles" ON exercise_muscles;
CREATE POLICY "own exercise muscles" ON exercise_muscles
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- One-off: "Swings" was the same exercise as "Swing"
UPDATE workout_exercises SET exercise_name = 'Swing' WHERE exercise_name = 'Swings';
