-- Once you're happy with the conversion: delete the backups and the lookup table.
-- After this, 3-undo.sql can no longer be used.
DROP TABLE IF EXISTS chain_created_complexes, chain_backup_exercises, chain_backup_sets, chain_parts;
