--| tier: standard
-- A guarded edit: it changes the row only at the version the caller read,
-- and advances that version.
UPDATE project
SET code = {{code}}, name = {{name}}, {{> sql.guard_set}}
WHERE {{> sql.guard_where}}
