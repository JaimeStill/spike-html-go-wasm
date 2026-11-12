# Compile a sqlate statement

This page is Markdown, rendered at build into the site's Markdown shell. The statement below is an
ordinary `sql` fence, and the live demo around it calls a Go handler: press Run, or
<kbd>Ctrl+Enter</kbd> in the editor, and the page loads the prebuilt sqlate scenario, a Go
WebAssembly module, and compiles the statement with sqlate for PostgreSQL. Nothing loads until the
first Run.

## The statement

<sl-go-demo scenario="sqlate" handler="compile" file="statement.sql" label="compile demo">

```sql
--| tier: native
--| native: postgres — RETURNING. Ports: OUTPUT INSERTED (SQL Server), RETURNING INTO (Oracle), LAST_INSERT_ID + a read (MySQL).
-- A create that returns the new row's identity.
INSERT INTO project (code, name)
VALUES ({{code}}, {{name}})
{{> app.identity}}
```

</sl-go-demo>

The answer is the statement as PostgreSQL receives it, each `{{name}}` a `$n` placeholder and each
`{{> namespace.pattern}}` spliced in, and the output line names its tier and its parameters in the
order they bind. Edit the statement and run it again; a statement sqlate refuses, one with no tier,
one that includes a pattern nothing publishes, or a native pattern in a standard statement, answers
sqlate's own message instead.

## What it compiles against

The handler compiles one statement, as `statement.sql`, against the catalog the sqlate page's
program builds from its sample files: PostgreSQL's spelling of sqlate's own patterns, the `sql`
namespace, with `{{> sql.guard_set}}` and `{{> sql.guard_where}}` among them, and the sample app
pattern `{{> app.identity}}`, the identity a create returns:

```sql
--| tier: native
--| native: postgres — RETURNING. Ports: OUTPUT INSERTED (SQL Server), RETURNING INTO (Oracle), LAST_INSERT_ID + a read (MySQL).
-- The identity a command returns, the row's key and its version, so every
-- create ends with {{> app.identity}} and reads the same columns.
RETURNING id, version
```

A guarded edit, a standard statement, compiles against the `sql` patterns alone:

```sql
--| tier: standard
UPDATE project
SET code = {{code}}, name = {{name}}, {{> sql.guard_set}}
WHERE {{> sql.guard_where}}
```

## How the page is made

The page is written in the spike's own `markdown/` directory and rendered as the spike's own tree
by the hosting SDK's Markdown pages, never copied into the site at a commit. The demo is raw HTML
around the fence: an `sl-go-demo` naming its scenario, `sqlate`, its handler, `compile`, and its
file, `statement.sql`, which names the fence, since a rendered fence carries no name of its own. The
shell's script gives every demo on the page the page's one runner, the same runtime and bridge the
hand pages use, and the scenario is one long-lived instance, so each Run after the first calls the
module already loaded.
