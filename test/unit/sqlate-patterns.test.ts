// The sqlate scenario's sample patterns are the program's, byte for byte: internal/sqlate embeds
// each pattern at patterns/<ns>/<name>.sql, the layout query.Publish reads, and playground/sqlate
// ships it as <ns>.<name>.sql, the name its own reader turns into the same namespace and pattern
// (playground/sqlate/main.go). So a statement the Markdown page's compile demo compiles sees the
// catalog the sqlate page's program builds from its shipped files. Every pattern file of either
// has its counterpart in the other, so a pattern added to one and not the other fails; the
// program's statements, any other .sql file, have none. And the Markdown page, which shows the
// app pattern its demo compiles against, shows it byte for byte, so the page can't drift from it.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const root = join(import.meta.dirname, "../..");
const program = join(root, "playground/sqlate");
const scenario = join(root, "internal/sqlate/patterns");
const markdown = join(root, "markdown/sqlate-compile.md");

/** The program's pattern files, each <ns>.<name>.sql, a .sql file whose base name holds a dot. */
const programPatterns = (): string[] =>
  readdirSync(program)
    .filter((name) => /^[^.]+\.[^.]+\.sql$/.test(name))
    .sort();

/** The scenario's embedded patterns, each by its program name, <ns>.<name>.sql, for its file
 * patterns/<ns>/<name>.sql. */
const scenarioPatterns = (): string[] =>
  readdirSync(scenario, { withFileTypes: true })
    .flatMap((ns) =>
      ns.isDirectory()
        ? readdirSync(join(scenario, ns.name)).map((name) => `${ns.name}.${name}`)
        : [`${ns.name}: a file outside any namespace's directory`],
    )
    .sort();

describe("the sqlate scenario's patterns", () => {
  test("are found: the program's app.identity.sql among them", () => {
    assert.ok(programPatterns().includes("app.identity.sql"), programPatterns().join(", "));
  });

  test("are the program's pattern files, each in its namespace's directory", () => {
    assert.deepEqual(scenarioPatterns(), programPatterns());
  });

  test("each equals its program file byte for byte", () => {
    for (const name of programPatterns()) {
      const [ns, pattern] = name.split(/\.(.*)/s);
      assert.deepEqual(
        readFileSync(join(scenario, ns, pattern)),
        readFileSync(join(program, name)),
        `internal/sqlate/patterns/${ns}/${pattern} isn't playground/sqlate/${name}`,
      );
    }
  });

  test("app.identity is the Markdown page's sql fence that shows it, byte for byte", () => {
    const fences = [...readFileSync(markdown, "utf8").matchAll(/^```sql\n([\s\S]*?)^```$/gm)].map(
      ([, text]) => text,
    );
    assert.ok(
      fences.includes(readFileSync(join(scenario, "app/identity.sql"), "utf8")),
      "markdown/sqlate-compile.md shows internal/sqlate/patterns/app/identity.sql",
    );
  });
});
