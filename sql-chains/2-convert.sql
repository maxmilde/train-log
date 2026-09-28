-- STEP 2 of 2: do the conversion previewed in step 1 (run step 1 first).
-- Backs up the old rows, creates the complexes, then removes the old chained entries.
-- All or nothing: if anything fails, nothing changes. It refuses to run twice.
-- To reverse it, run 3-undo.sql.

DO $$
DECLARE
  g record;
  p record;
  cx_id uuid;
  ex_id uuid;
  part_kg integer;
  part_type text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM chain_parts) THEN
    RAISE EXCEPTION 'Run 1-preview.sql first';
  END IF;

  -- Backups (fails if they already exist, i.e. this already ran)
  CREATE TABLE chain_backup_exercises AS
    SELECT e.* FROM workout_exercises e
    WHERE e.complex_id IS NULL
      AND lower(trim(e.exercise_name)) IN (SELECT name_key FROM chain_parts);
  CREATE TABLE chain_backup_sets AS
    SELECT s.* FROM exercise_sets s
    WHERE s.workout_exercise_id IN (SELECT id FROM chain_backup_exercises);
  CREATE TABLE chain_created_complexes (id uuid PRIMARY KEY);
  ALTER TABLE chain_backup_exercises ENABLE ROW LEVEL SECURITY;
  ALTER TABLE chain_backup_sets ENABLE ROW LEVEL SECURITY;
  ALTER TABLE chain_created_complexes ENABLE ROW LEVEL SECURITY;

  -- One complex per (old entry, logged reps, weight); identical sets add rounds
  FOR g IN
    SELECT e.user_id, e.workout_day_id, e.display_order,
           lower(trim(e.exercise_name)) AS name_key,
           s.reps,
           COALESCE(s.weight_kg, e.weight_kg) AS kg,
           COALESCE(s.weight_type, e.weight_type, 'single') AS wtype,
           SUM(COALESCE(s.rounds, 1))::int AS rounds,
           MIN(s.set_number) AS first_set
    FROM chain_backup_exercises e
    JOIN exercise_sets s ON s.workout_exercise_id = e.id
    WHERE s.reps > 0
    GROUP BY e.id, e.user_id, e.workout_day_id, e.display_order, e.exercise_name,
             s.reps, COALESCE(s.weight_kg, e.weight_kg), COALESCE(s.weight_type, e.weight_type, 'single')
    ORDER BY e.workout_day_id, e.display_order, MIN(s.set_number)
  LOOP
    INSERT INTO workout_complexes (user_id, workout_day_id, rounds, display_order)
    VALUES (g.user_id, g.workout_day_id, g.rounds, g.display_order)
    RETURNING id INTO cx_id;
    INSERT INTO chain_created_complexes VALUES (cx_id);

    FOR p IN SELECT * FROM chain_parts WHERE name_key = g.name_key ORDER BY part_order LOOP
      IF p.bodyweight OR g.wtype = 'bodyweight' THEN
        part_kg := NULL; part_type := 'bodyweight';
      ELSIF p.force_double AND g.wtype = 'single' THEN
        part_kg := g.kg; part_type := 'double';
      ELSE
        part_kg := g.kg; part_type := g.wtype;
      END IF;

      INSERT INTO workout_exercises (user_id, workout_day_id, exercise_name, weight_kg, weight_type, display_order, complex_id)
      VALUES (g.user_id, g.workout_day_id, p.part_name, part_kg, part_type, p.part_order, cx_id)
      RETURNING id INTO ex_id;

      INSERT INTO exercise_sets (user_id, workout_exercise_id, set_number, reps, weight_kg, weight_type, rounds)
      VALUES (g.user_id, ex_id, 1, p.reps_per * g.reps, part_kg, part_type, 1);
    END LOOP;
  END LOOP;

  -- Remove the old chained entries (their sets go with them)
  DELETE FROM workout_exercises WHERE id IN (SELECT id FROM chain_backup_exercises);
END$$;

-- Check: how many complexes were created
SELECT count(*) AS complexes_created FROM chain_created_complexes;
