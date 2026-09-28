-- Reverses 2-convert.sql: removes the complexes it created and restores the old
-- chained entries exactly as they were. All or nothing.
BEGIN;
DELETE FROM workout_complexes WHERE id IN (SELECT id FROM chain_created_complexes);  -- their exercises and sets go too
INSERT INTO workout_exercises SELECT * FROM chain_backup_exercises;
INSERT INTO exercise_sets SELECT * FROM chain_backup_sets;
DROP TABLE chain_created_complexes, chain_backup_exercises, chain_backup_sets;
COMMIT;
