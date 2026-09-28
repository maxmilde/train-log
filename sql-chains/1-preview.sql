-- STEP 1 of 2: turn chained exercises logged before complexes existed into complexes.
-- This step only creates the lookup table below and SHOWS what step 2 would do.
-- Nothing in your workouts changes. Run it in the Supabase SQL editor.
--
-- Rule: each logged set becomes one round of a complex. A part's reps are the number
-- in the name (1 if none) × the set's logged reps. "4HS-5Jerk" logged as 2 becomes
-- 8 Half Snatch + 10 Jerk; "Clean-Squat" logged as 8 becomes 8 Clean + 8 Squats.
-- Identical sets on the same day (same reps and weight) become one complex with that
-- many rounds.

CREATE TABLE IF NOT EXISTS chain_parts (
  name_key     text NOT NULL,     -- lower-cased logged name
  part_order   int  NOT NULL,
  part_name    text NOT NULL,     -- existing exercise name the part becomes
  reps_per     int  NOT NULL,     -- the number in the name (1 if none)
  bodyweight   boolean NOT NULL DEFAULT false,
  force_double boolean NOT NULL DEFAULT false,  -- DS = double snatch (two bells)
  PRIMARY KEY (name_key, part_order)
);
ALTER TABLE chain_parts ENABLE ROW LEVEL SECURITY;  -- not readable from the app
TRUNCATE chain_parts;

INSERT INTO chain_parts (name_key, part_order, part_name, reps_per, bodyweight, force_double) VALUES
  -- no numbers: 1 of each part per logged rep
  ('clean-squat', 0, 'Clean', 1, false, false),
  ('clean-squat', 1, 'Squats', 1, false, false),
  ('clean-squat-lunge-lunge', 0, 'Clean', 1, false, false),
  ('clean-squat-lunge-lunge', 1, 'Squats', 1, false, false),
  ('clean-squat-lunge-lunge', 2, 'Lunges', 1, false, false),   -- one each leg
  ('squat-lunge-lunge', 0, 'Squats', 1, false, false),
  ('squat-lunge-lunge', 1, 'Lunges', 1, false, false),         -- one each leg
  ('ds-clean-press', 0, 'Snatch', 1, false, true),
  ('ds-clean-press', 1, 'Clean', 1, false, false),
  ('ds-clean-press', 2, 'Press', 1, false, false),
  ('hs-jerk-fsquat', 0, 'Half Snatch', 1, false, false),
  ('hs-jerk-fsquat', 1, 'Jerk', 1, false, false),
  ('hs-jerk-fsquat', 2, 'Squats', 1, false, false),
  ('hs-lc', 0, 'Half Snatch', 1, false, false),
  ('hs-lc', 1, 'Long Cycle', 1, false, false),
  ('hs-lc-squat', 0, 'Half Snatch', 1, false, false),
  ('hs-lc-squat', 1, 'Long Cycle', 1, false, false),
  ('hs-lc-squat', 2, 'Squats', 1, false, false),
  ('hs-squat', 0, 'Half Snatch', 1, false, false),
  ('hs-squat', 1, 'Squats', 1, false, false),
  ('swing-clean-ppress-squat-hpull', 0, 'Swing', 1, false, false),
  ('swing-clean-ppress-squat-hpull', 1, 'Clean', 1, false, false),
  ('swing-clean-ppress-squat-hpull', 2, 'Push press', 1, false, false),
  ('swing-clean-ppress-squat-hpull', 3, 'Squats', 1, false, false),
  ('swing-clean-ppress-squat-hpull', 4, 'High pulls', 1, false, false),
  ('swing-clean-ppress-squat-row', 0, 'Swing', 1, false, false),
  ('swing-clean-ppress-squat-row', 1, 'Clean', 1, false, false),
  ('swing-clean-ppress-squat-row', 2, 'Push press', 1, false, false),
  ('swing-clean-ppress-squat-row', 3, 'Squats', 1, false, false),
  ('swing-clean-ppress-squat-row', 4, 'Row', 1, false, false),
  ('swing-hs', 0, 'Swing', 1, false, false),
  ('swing-hs', 1, 'Half Snatch', 1, false, false),
  ('swing-lc', 0, 'Swing', 1, false, false),
  ('swing-lc', 1, 'Long Cycle', 1, false, false),
  ('swing-snatch', 0, 'Swing', 1, false, false),
  ('swing-snatch', 1, 'Snatch', 1, false, false),
  -- numbers: that many of the part per logged rep
  ('10pushup-10hindusquat', 0, 'Pushups', 10, true, false),
  ('10pushup-10hindusquat', 1, 'Hindu squats', 10, true, false),
  ('10pushup-10hindusquat-5pullup', 0, 'Pushups', 10, true, false),
  ('10pushup-10hindusquat-5pullup', 1, 'Hindu squats', 10, true, false),
  ('10pushup-10hindusquat-5pullup', 2, 'Pullups', 5, true, false),
  ('1j-2hs-1lc', 0, 'Jerk', 1, false, false),
  ('1j-2hs-1lc', 1, 'Half Snatch', 2, false, false),
  ('1j-2hs-1lc', 2, 'Long Cycle', 1, false, false),
  ('2clean-1press-3squat', 0, 'Clean', 2, false, false),
  ('2clean-1press-3squat', 1, 'Press', 1, false, false),
  ('2clean-1press-3squat', 2, 'Squats', 3, false, false),
  ('2hs-jerk-3lc', 0, 'Half Snatch', 2, false, false),
  ('2hs-jerk-3lc', 1, 'Jerk', 1, false, false),
  ('2hs-jerk-3lc', 2, 'Long Cycle', 3, false, false),
  ('2jerk-2/2row-10/10hs', 0, 'Jerk', 2, false, false),
  ('2jerk-2/2row-10/10hs', 1, 'Row', 2, false, false),          -- 2 each side
  ('2jerk-2/2row-10/10hs', 2, 'Half Snatch', 10, false, false), -- 10 each side
  ('4hs-5jerk', 0, 'Half Snatch', 4, false, false),
  ('4hs-5jerk', 1, 'Jerk', 5, false, false),
  ('4hs-5press', 0, 'Half Snatch', 4, false, false),
  ('4hs-5press', 1, 'Press', 5, false, false),
  ('6/6gr-lc-jerk', 0, 'Gorilla row', 6, false, false),         -- 6 each side
  ('6/6gr-lc-jerk', 1, 'Long Cycle', 1, false, false),
  ('6/6gr-lc-jerk', 2, 'Jerk', 1, false, false);

-- What step 2 will create: one row per new complex
SELECT
  d.date,
  e.exercise_name AS logged_as,
  s.reps AS logged_reps,
  CASE WHEN COALESCE(s.weight_type, e.weight_type) = 'bodyweight' THEN 'BW'
       WHEN COALESCE(s.weight_type, e.weight_type) = 'double' THEN '2×' || COALESCE(s.weight_kg, e.weight_kg) || 'kg'
       ELSE COALESCE(s.weight_kg, e.weight_kg) || 'kg' END AS weight,
  SUM(COALESCE(s.rounds, 1)) AS complex_rounds,
  (SELECT string_agg(p.reps_per * s.reps || ' ' || p.part_name
                     || CASE WHEN p.force_double THEN ' (2 bells)' ELSE '' END, ' + ' ORDER BY p.part_order)
     FROM chain_parts p WHERE p.name_key = lower(trim(e.exercise_name))) AS each_round
FROM workout_exercises e
JOIN workout_days d ON d.id = e.workout_day_id
JOIN exercise_sets s ON s.workout_exercise_id = e.id
WHERE e.complex_id IS NULL
  AND lower(trim(e.exercise_name)) IN (SELECT name_key FROM chain_parts)
  AND s.reps > 0
GROUP BY d.date, e.id, e.exercise_name, e.weight_type, e.weight_kg, s.reps, s.weight_kg, s.weight_type
ORDER BY d.date, e.exercise_name, s.reps;
