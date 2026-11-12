--| tier: native
--| native: postgres — RETURNING. Ports: OUTPUT INSERTED (SQL Server), RETURNING INTO (Oracle), LAST_INSERT_ID + a read (MySQL).
INSERT INTO project (code, name)
VALUES ({{code}}, {{name}})
{{> app.identity}}
