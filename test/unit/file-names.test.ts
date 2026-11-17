// A Go demo's fence naming rules, web/components/file-names.ts, under node with no browser: a
// fence's own name, data-file or title, wins; else the demo's file attribute names it; else its
// language's default, main.go for go, input.json for json, query.sql for sql, and input.txt for
// any other or for none. A demo with no file attribute, or an empty one, names its fences by those
// defaults.
// And each file's grammar by its name's extension: go, json, or sql, any other plain.
// And a fence's text, its lines: its pre's text content less one final newline, so the same
// Markdown fence, rendered by the SDK's render plain and through its Shiki highlighter, reads as
// the same text, the lines between its backticks; a page's own markup ending in two newlines keeps
// one. The rendered pre's text content is read by a small reader, tags dropped and the references
// marked and Shiki write decoded, as the browser's textContent reads it.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { render } from "@jaimestill/spike-html-hosting-sdk/markdown-pages.js";
import { builtinSyntax, createSyntax } from "@jaimestill/spike-html-hosting-sdk/syntax.js";

import { fenceName, fenceText, languageOf } from "../../web/components/file-names.ts";

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

/** The named references marked writes in a fence's code; Shiki writes numeric ones. */
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"' };

/** The text content of the one pre a rendered page holds: its tags dropped, its references
 * decoded; fails on a reference it doesn't know. */
function preText(html: string): string {
  const pres = html.match(/<pre[\s>][\s\S]*?<\/pre>/g) ?? [];
  assert.equal(pres.length, 1, "the page renders one fence");
  return pres[0]
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (reference, body: string) => {
      if (body[0] === "#") {
        const hex = body[1] === "x" || body[1] === "X";
        return String.fromCodePoint(parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10));
      }
      const named = NAMED[body];
      if (named === undefined) throw new Error(`a reference the reader can't decode: ${reference}`);
      return named;
    });
}

/** A Markdown page of one json fence, its lines given, as the SDK renders it: plain, and through
 * its Shiki highlighter. */
async function renderings(lines: string): Promise<{ plain: string; shiki: string }> {
  const markdown = `# Fence\n\n\`\`\`json\n${lines}\n\`\`\`\n`;
  const source = {
    pages: new Set(["fence.md"]),
    external: new Set<string>(),
    repository: "",
    ref: "",
  };
  const syntax = await createSyntax(builtinSyntax, ["json"]);
  const plain = render("fence.md", markdown, source).html;
  const shiki = render("fence.md", markdown, source, syntax.highlight).html;
  assert.ok(plain.includes("<pre><code"), "the plain rendering is marked's");
  assert.ok(shiki.includes('<pre class="shiki'), "the highlighted rendering is Shiki's");
  return { plain: preText(plain), shiki: preText(shiki) };
}

describe("a fence's text", () => {
  const line = '{ "shiki": true, "list": [3, 1, 2] }';

  test("marked's plain fence, its code ending in the newline marked adds, reads as its line", async () => {
    const { plain } = await renderings(line);
    assert.equal(plain, `${line}\n`, "marked adds one newline");
    assert.equal(fenceText(plain), line);
    assert.equal(fenceText("[1, 2]\n"), "[1, 2]", "a page's own plain fence");
  });

  test("the SDK's Shiki fence, no newline after its last line, reads as its line", async () => {
    const { shiki } = await renderings(line);
    assert.equal(shiki, line, "Shiki adds none");
    assert.equal(fenceText(shiki), line);
  });

  test("the plain and the Shiki rendering of a fence of several lines read as the same lines", async () => {
    const lines = '{\n  "a": [1, 2],\n  "b": "<&>"\n}';
    const { plain, shiki } = await renderings(lines);
    assert.equal(fenceText(plain), lines);
    assert.equal(fenceText(shiki), lines);
  });

  test("a fence ending in a blank line reads alike either way, and a page's own two final newlines keep one", async () => {
    // marked drops the fence's final newline before it adds its own, so its plain form is the
    // same as a fence with no blank line; Shiki's form holds the blank line, read as its newline,
    // and the rule reads both as the lines before it.
    const { plain, shiki } = await renderings(`${line}\n`);
    assert.equal(plain, `${line}\n`);
    assert.equal(shiki, `${line}\n`);
    assert.equal(fenceText(plain), fenceText(shiki));
    assert.equal(fenceText("TEXT\n\n"), "TEXT\n", "exactly one newline goes");
    assert.equal(fenceText(""), "", "an empty fence");
  });
});
