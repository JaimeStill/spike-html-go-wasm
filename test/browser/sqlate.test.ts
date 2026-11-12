// The sqlate page, sqlate.html, building and running playground/sqlate in the page: the build as
// Pages serves it, dist/ under the base by the SDK's served(), Vite's preview, in the pinned
// chrome-headless-shell, the worker's fetches read through CDP (go-demos.ts).
//
// The page holds one source demo with editable files, playground/sqlate's main.go, active, its
// guard.go, its .sql files, and its input.json, and requests no Go and starts no worker before a
// Run. Each .sql file shows in SQL's grammar, its comments painted apart from its statement. The
// first Run fetches the manifest, the compiler, the linker, and only the program's closure of
// archives, the standard library's and the site's pinned modules', sqlate's, its sqltest driver's,
// and PostgreSQL's driver's among them, and prints every statement and the guarded edit's success
// exactly, with exit 0 and every phase of a build. An edit to input.json alone builds nothing: the
// Run fetches nothing and shows no Go compile or link, and each outcome the row's stored version
// sets prints its call log and result, the version mismatch, no row, and the success again. An edit
// to a .sql file alone builds nothing either, and prints the edited statement. A statement with no
// tier prints sqlate's one stderr line with exit 1; and a pattern file in a namespace of the
// reader's, added by New file, is included by a statement added after it, each rerun again building
// nothing.
//
// The cases run in order on one page, each from the files the last left, since every page's first
// Run is a cold build of about 220 archives; each restores what it changed, and the first page in
// a fresh browser makes that build cold. The program's cost, its cold and warm timings and its
// closure, is reported with the playground's programs' (playground-report.test.ts). The helpers
// are go-builds.ts's, go-demos.ts's, and playground-layouts.ts's. Every wait is bounded. Nothing
// here names the site: its base is package.json's name.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test, type TestContext } from "node:test";

import { launch, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import { programImports } from "../../web/runtime/build.ts";
import {
  archivesOf,
  build,
  BUILT_PHASES,
  DONE,
  SQLATE_BUILD,
  timed,
  TOOLS,
  toolchainRequests,
} from "./go-builds.ts";
import { goRequests, open, pressControl, type Watched } from "./go-demos.ts";
import { paste, PLAYGROUND as DEMO } from "./playground-layouts.ts";

const root = join(import.meta.dirname, "../..");

/** playground/sqlate's files, in the demo's order: the Go files, the .sql files by name, and
 * input.json. */
const FILES = [
  "main.go",
  "guard.go",
  "app.identity.sql",
  "create.sql",
  "edit.sql",
  "version.sql",
  "input.json",
];
const source = (name: string) => readFileSync(join(root, "playground/sqlate", name), "utf8");

/** The packages the Go files import, whose closure the first Run fetches. */
const IMPORTS = programImports(
  ["main.go", "guard.go"].map((name) => ({ name, text: source(name) })),
);

/** A Run's stdout, as the console shows it, one entry a line. */
const stdout = (text: string) =>
  text
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => ({ stream: "stdout", text: line }));

/** The statements every Run prints but version, which the cases edit, as the program's own go test
 * holds them. */
const CREATE_AND_EDIT = `-- create: native, parameters $1 code, $2 name
INSERT INTO project (code, name)
VALUES ($1, $2)
RETURNING id, version

-- edit: standard, parameters $1 code, $2 name, $3 id, $4 version
UPDATE project
SET code = $1, name = $2, updated_at = CURRENT_TIMESTAMP, version = version + 1
WHERE id = $3 AND version = $4
`;

/** The run's edit, at input.json's arguments and the version read, 3, as the call log shows it. */
const EXEC_EDIT = `
-- exec, $1 = "LAB", $2 = "Standards Lab", $3 = 42, $4 = 3
UPDATE project
SET code = $1, name = $2, updated_at = CURRENT_TIMESTAMP, version = version + 1
WHERE id = $3 AND version = $4
`;

/** The run's version check, when the edit changes no row, as the call log shows it. */
const QUERY_VERSION = `
-- query, $1 = 42
SELECT version FROM project WHERE id = $1
`;

/** What the run prints for the shipped input.json, the row stored at the version read, as the
 * program's own go test holds it. */
const SUCCEEDED = `
-- run: edit guarded by version, version 3 read; the row stored at version 3
${EXEC_EDIT}
-- result: version 4
`;

/** What sqlate prints for the shipped statements, before the run. */
const STATEMENTS = `${CREATE_AND_EDIT}
-- version: standard, parameters $1 id
SELECT version FROM project WHERE id = $1
`;

/** What sqlate prints for the shipped files, as its own go test holds it. */
const OUTPUT = STATEMENTS + SUCCEEDED;

/** input.json as the page opens on it, with no final line break, as the cases paste it. */
const INPUT = source("input.json").replace(/\n$/, "");

/** The status of a main that exited 1. */
const FAILED = "Finished main, exit code 1";

let server: Server;
let browser: Browser;
let watched: Watched;
let page: Page;

before(async () => {
  server = await served(root);
  browser = await launch();
  watched = await open(browser, server.origin, "sqlate.html");
  page = watched.page;
});
after(async () => {
  await page?.close();
  await browser?.close();
  await server?.stop();
});

/** Selects the demo's tab by its file's name, as a click on it requests. */
async function select(name: string) {
  await page.evaluate(
    `window.demos.part(${DEMO}, "sl-file-tabs").shadowRoot
      .querySelector('[role="tab"][data-name=${JSON.stringify(name)}]').click()`,
  );
  await until(page, `window.demos.tab(${DEMO}) === ${JSON.stringify(name)}`, 2000);
}

/** Adds a file by New file's form, its name typed and the form submitted, then its text. */
async function newFile(name: string, text: string) {
  await pressControl(page, DEMO, "new");
  const input = `window.demos.part(${DEMO}, "sl-controls").shadowRoot.querySelector("#new-name")`;
  await until(page, `${input}.matches(":focus")`, 2000);
  await page.evaluate(`${input}.select()`);
  await page.cdp("Input.insertText", { text: name });
  await page.evaluate(`${input}.form.requestSubmit()`);
  await until(page, `window.demos.tab(${DEMO}) === ${JSON.stringify(name)}`, 2000);
  await pasteOver(text);
}

/** Pastes text over the active file's whole text, resolving once the editor holds it. A pasted
 * text's final line break shows in the editor's value doubled, so the cases' texts end without
 * one, which sqlate reads alike. */
async function pasteOver(text: string) {
  await paste(page, text, true);
  await until(page, `window.demos.editor(${DEMO}).value === ${JSON.stringify(text)}`, 2000);
}

/** Replaces the file's text, its tab selected first. */
async function edit(name: string, text: string) {
  await select(name);
  await pasteOver(text);
}

/** Runs the files again, expecting no build: answers what it shows, once it says `finished`,
 * having asserted its phases a run's alone and that it fetched nothing. */
async function rerun(finished: string) {
  const from = watched.requests.length;
  const shown = await build(page, DEMO, finished);
  assert.deepEqual(shown.phases, ["Instantiate", "Run"], "no Go compile or link");
  assert.deepEqual(
    goRequests({ ...watched, requests: watched.requests.slice(from) }),
    [],
    "nothing fetched",
  );
  return shown;
}

describe("the sqlate page", () => {
  test("opens on playground/sqlate's files in one source demo, main.go active, and requests no Go before a Run", async () => {
    const opened: { demos: number; files: string[]; value: string; tab: string; source: boolean } =
      await page.evaluate(`({
        demos: document.querySelectorAll("sl-go-demo").length,
        files: [...window.demos.part(${DEMO}, "sl-file-tabs").shadowRoot
          .querySelectorAll('[role="tab"]')].map((tab) => tab.dataset.name),
        value: window.demos.editor(${DEMO}).value,
        tab: window.demos.tab(${DEMO}),
        source: ${DEMO}.source,
      })`);
    assert.deepEqual(opened, {
      demos: 1,
      files: FILES,
      value: source("main.go"),
      tab: "main.go",
      source: true,
    });
    assert.deepEqual(goRequests(watched), []);
    assert.deepEqual(watched.workers, []);
  });

  test("each .sql file shows in SQL's grammar: its comments and its statement painted apart", async () => {
    for (const name of FILES.filter((file) => file.endsWith(".sql"))) {
      await select(name);
      const editor = `window.demos.editor(${DEMO})`;
      // The ranges painted in the editor's text, each its highlight's name and its text, once the
      // tokenizer, loaded lazily, has painted them.
      const ranges = `(() => {
        const text = ${editor}.shadowRoot.querySelector(".text");
        const found = [];
        for (const [name, highlight] of CSS.highlights) {
          for (const range of highlight) {
            if (text.contains(range.startContainer)) found.push({ name, text: range.toString() });
          }
        }
        return found;
      })()`;
      await until(page, `${ranges}.length > 0`, 10000);
      const shown: { language: string; value: string; ranges: { name: string; text: string }[] } =
        await page.evaluate(
          `({ language: ${editor}.language, value: ${editor}.value, ranges: ${ranges} })`,
        );
      assert.equal(shown.value, source(name), name);
      assert.equal(shown.language, "sql", name);
      const comment = shown.ranges.filter(({ text }) => text.startsWith("--"));
      assert.ok(comment.length > 0, `${name}: a -- comment is painted`);
      const comments = new Set(comment.map(({ name }) => name));
      assert.ok(
        shown.ranges.some(({ name }) => !comments.has(name)),
        `${name}: its statement is painted apart from its comments`,
      );
    }
    await select("main.go");
  });

  test("the first Run builds the program from the toolchain and its closure alone, the site's pinned modules' archives among it, and prints every statement and the guarded edit's success exactly, with exit 0", async (t: TestContext) => {
    const cold = await build(page, DEMO, DONE, SQLATE_BUILD);
    t.diagnostic(`cold: ${timed(cold)}`);
    assert.deepEqual(cold.lines, stdout(OUTPUT));
    assert.deepEqual(cold.rows.at(-1), { kind: "exit", text: "main exited with code 0" });
    assert.deepEqual(cold.phases, BUILT_PHASES);
    const fetched = toolchainRequests(watched);
    assert.equal(fetched[0], "manifest.json");
    const closure = archivesOf(IMPORTS);
    assert.ok(
      closure.some((archive) => archive.startsWith("mod/github.com/standards-lab/sqlate/")),
      "sqlate's archives are in the closure",
    );
    assert.ok(
      closure.some((archive) => archive.startsWith("mod/github.com/standards-lab/sqlate/sqltest.")),
      "sqltest's archive is in the closure",
    );
    assert.deepEqual(
      fetched.slice(1).sort(),
      [...TOOLS, ...closure].sort(),
      "the toolchain and the program's closure, each once",
    );
    t.diagnostic(
      `closure: ${closure.length} archives, ${closure.filter((archive) => archive.startsWith("mod/")).length} of them the modules'`,
    );
  });

  test("an edit to input.json alone reruns the program with no Go compile or link and no request, and each stored version prints its call log and outcome", async () => {
    for (const [stored, run] of [
      [
        "5",
        `
-- run: edit guarded by version, version 3 read; the row stored at version 5
${EXEC_EDIT}${QUERY_VERSION}
-- result: version mismatch: expected 3, current 5
`,
      ],
      [
        "null",
        `
-- run: edit guarded by version, version 3 read; no row stored
${EXEC_EDIT}${QUERY_VERSION}
-- result: sql: no rows in result set
`,
      ],
      ["3", SUCCEEDED],
    ]) {
      await edit("input.json", INPUT.replace(/"stored": 3/, `"stored": ${stored}`));
      const shown = await rerun(DONE);
      assert.deepEqual(shown.lines, stdout(STATEMENTS + run), `stored ${stored}`);
      assert.deepEqual(shown.rows.at(-1), { kind: "exit", text: "main exited with code 0" });
    }
  });

  test("an edit to a .sql file alone reruns the program with no Go compile or link and no request, printing the edited statement", async () => {
    await edit(
      "version.sql",
      "--| tier: standard\nSELECT version, updated_at FROM project WHERE id = {{id}}",
    );
    const shown = await rerun(DONE);
    assert.deepEqual(
      shown.lines,
      stdout(`${CREATE_AND_EDIT}
-- version: standard, parameters $1 id
SELECT version, updated_at FROM project WHERE id = $1
${SUCCEEDED}`),
    );
    await edit("version.sql", source("version.sql").replace(/\n$/, ""));
  });

  test("a statement with no tier prints sqlate's message on one stderr line, with exit 1", async () => {
    await edit("version.sql", "SELECT version FROM project WHERE id = {{id}}");
    const shown = await rerun(FAILED);
    assert.deepEqual(shown.lines, [
      { stream: "stderr", text: "query: version.sql: no tier declaration" },
    ]);
    assert.deepEqual(shown.rows.at(-1), { kind: "exit", text: "main exited with code 1" });
    await edit("version.sql", source("version.sql").replace(/\n$/, ""));
  });

  test("a pattern file in a new namespace is included by a statement, rerunning with no Go compile or link", async () => {
    await newFile(
      "audit.stamp.sql",
      "--| tier: standard\n-- When the row was read.\nCURRENT_TIMESTAMP AS read_at",
    );
    await newFile(
      "stamped.sql",
      "--| tier: standard\nSELECT name, {{> audit.stamp}}\nFROM project WHERE id = {{id}}",
    );
    const shown = await rerun(DONE);
    assert.deepEqual(
      shown.lines,
      stdout(`${CREATE_AND_EDIT}
-- stamped: standard, parameters $1 id
SELECT name, CURRENT_TIMESTAMP AS read_at
FROM project WHERE id = $1

-- version: standard, parameters $1 id
SELECT version FROM project WHERE id = $1
${SUCCEEDED}`),
    );
  });
});
