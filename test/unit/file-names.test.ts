// A Go demo's fence naming rules, web/components/file-names.ts, under node with no browser: a
// fence's own name, data-file or title, wins; else the demo's file attribute names it; else its
// language's default, main.go for go, input.json for json, query.sql for sql, input.txt for any
// other; else the mode's, main.go on a program or source demo and input.json on a handler demo. A
// demo with no file attribute, or an empty one, names its fences exactly as before the attribute.
// And each file's grammar by its name's extension: go, json, or sql, any other plain.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { fenceName, languageOf } from "../../web/components/file-names.ts";

describe("a fence's name", () => {
  test("a fence labelled sql defaults to query.sql, in either mode", () => {
    assert.equal(fenceName({ language: "sql" }, true), "query.sql");
    assert.equal(fenceName({ language: "sql" }, false), "query.sql");
  });

  test("with no file attribute, the defaults are as before: by language, then by mode", () => {
    for (const file of [undefined, null, ""]) {
      assert.equal(fenceName({ language: "go" }, false, file), "main.go");
      assert.equal(fenceName({ language: "json" }, true, file), "input.json");
      assert.equal(fenceName({ language: "yaml" }, true, file), "input.txt");
      assert.equal(fenceName({}, true, file), "main.go", "a program or source demo");
      assert.equal(fenceName({}, false, file), "input.json", "a handler demo");
      assert.equal(fenceName({ named: "a.go", language: "json" }, false, file), "a.go");
    }
  });

  test("the file attribute names a fence that names none, in place of every default", () => {
    assert.equal(fenceName({}, false, "query.sql"), "query.sql", "a handler demo's Shiki fence");
    assert.equal(fenceName({}, true, "schema.sql"), "schema.sql", "a source demo's Shiki fence");
    assert.equal(fenceName({ language: "json" }, false, "query.sql"), "query.sql");
    assert.equal(fenceName({ language: "sql" }, true, "edit.sql"), "edit.sql");
  });

  test("a fence's own name wins over the file attribute", () => {
    assert.equal(fenceName({ named: "create.sql" }, false, "query.sql"), "create.sql");
    assert.equal(fenceName({ named: "main.go", language: "go" }, true, "edit.sql"), "main.go");
  });
});

describe("a file's grammar", () => {
  test("is go, json, or sql by the name's extension, any other plain", () => {
    assert.deepEqual(
      [
        "main.go",
        "input.json",
        "query.sql",
        "app.identity.sql",
        "input.txt",
        "sql",
        "a.sql.txt",
      ].map(languageOf),
      ["go", "json", "sql", "sql", "", "", ""],
    );
  });
});
