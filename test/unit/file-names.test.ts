// A Go demo's fence naming rules, web/components/file-names.ts, under node with no browser: a
// fence's own name, data-file or title, wins; else the demo's file attribute names it; else its
// language's default, main.go for go, input.json for json, query.sql for sql, and input.txt for
// any other or for none. A demo with no file attribute, or an empty one, names its fences by those
// defaults.
// And each file's grammar by its name's extension: go, json, or sql, any other plain.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { fenceName, languageOf } from "../../web/components/file-names.ts";

describe("a fence's name", () => {
  test("a fence labelled sql defaults to query.sql", () => {
    assert.equal(fenceName({ language: "sql" }), "query.sql");
  });

  test("with no file attribute, the defaults are by language, input.txt for any other or none", () => {
    for (const file of [undefined, null, ""]) {
      assert.equal(fenceName({ language: "go" }, file), "main.go");
      assert.equal(fenceName({ language: "json" }, file), "input.json");
      assert.equal(fenceName({ language: "yaml" }, file), "input.txt");
      assert.equal(fenceName({}, file), "input.txt", "a fence with no info string");
      assert.equal(fenceName({ language: "constructor" }, file), "input.txt", "no inherited key");
      assert.equal(fenceName({ named: "a.go", language: "json" }, file), "a.go");
    }
  });

  test("the file attribute names a fence that names none, in place of every default", () => {
    assert.equal(fenceName({}, "request.http"), "request.http", "a fence with no info string");
    assert.equal(fenceName({ language: "json" }, "query.sql"), "query.sql");
    assert.equal(fenceName({ language: "sql" }, "edit.sql"), "edit.sql");
  });

  test("a fence's own name wins over the file attribute", () => {
    assert.equal(fenceName({ named: "create.sql" }, "query.sql"), "create.sql");
    assert.equal(fenceName({ named: "main.go", language: "go" }, "edit.sql"), "main.go");
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
