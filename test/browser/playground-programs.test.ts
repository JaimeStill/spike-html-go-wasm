// The playground's programs, playground.html's Program select over its one demo: the build as
// Pages serves it, dist/ under the base by the SDK's served(), Vite's preview, in the pinned
// chrome-headless-shell, the page's and its worker's requests read through CDP (go-demos.ts).
//
// The select, beside the heading in the prose's title row, is labelled Program, in the
// accessibility tree as a combobox of that name, and offers Calculator, Basics, Generics,
// Concurrency, and Standard library, Calculator chosen. Choosing Basics shows its files, main.go
// and shapes.go, in the one demo in place, main.go active, with no reload and no request; its Run
// builds and prints basics' exact output, as its own go test holds it, with exit 0. Choosing
// Generics, or Concurrency, shows its files, main.go and stack.go, or main.go and pipeline.go,
// main.go active, with no request, and its Run prints its exact output, as its go test holds it,
// with exit 0: Concurrency's in a fixed order whatever turns its goroutines take. Choosing Standard
// library shows main.go and the input.json it reads, and its Run prints its report with exit 0; an
// edit to input.json alone reruns it with no Go compile or link and no request, as the runner
// reuses the last build when no .go file changed, and a malformed input.json prints the one stderr
// line naming its JSON error, with exit 1. Each program keeps its own files for the tab's life:
// edits, and the active file, survive switching away and back, and Reset restores the program on
// screen alone. A switch while a run is pending stops the run, the status saying it stopped, and
// every switch clears the console and the timings; the next Run runs the program now shown.
// Switching back to a program built earlier compiles and links it again, its build not held, but
// fetches no archive the worker holds. The fragment names the program shown: the page opens on the
// program it names, and on the calculator with none or one that names no program; a choice writes
// its fragment as a new history entry, and Back, Forward, and an edited fragment show the program
// it names, with its edits, the select following, with no reload. The page's one screen, at the
// SDK's widths in both font sets, and its shell checks are playground-layout-suite.ts's and
// site.test.ts's, with the select in place; the fences' bytes are the unit tier's
// (go-demo-fences.test.ts). The helpers are go-demos.ts's, go-builds.ts's, and
// playground-layouts.ts's. Every wait is bounded. Nothing here names the site: its base is
// package.json's name.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import { BUILD, build, BUILT_PHASES, DONE, retype, toolchainRequests } from "./go-builds.ts";
import { goRequests, open as openPage, pressControl, says, shown } from "./go-demos.ts";
import { axQuery, paste, PLAYGROUND } from "./playground-layouts.ts";

const root = join(import.meta.dirname, "../..");

let server: Server;
let browser: Browser;

before(async () => {
  server = await served(root);
  browser = await launch();
});
after(async () => {
  await browser?.close();
  await server?.stop();
});

/** Opens the playground, watched (go-demos.ts). */
const open = () => openPage(browser, server.origin, "playground.html");

/** The Program select. */
const PICKER = `document.querySelector("main > .prose > .title select#program")`;

/** The programs the select offers, each its value and its option's text, in order. */
const PROGRAMS = [
  ["calc", "Calculator"],
  ["basics", "Basics"],
  ["generics", "Generics"],
  ["concurrency", "Concurrency"],
  ["stdlib", "Standard library"],
];

/** A program's file, as playground/ holds it. */
const source = (program: string, name: string) =>
  readFileSync(join(root, "playground", program, name), "utf8");

/** What basics prints, every run, as its own go test holds it: each line on stdout. */
const BASICS_OUTPUT = [
  "Shapes:",
  "  3x4 rectangle        area 12.00  perimeter 14.00",
  "  circle of radius 2   area 12.57  perimeter 12.57",
  "  square of side 2     area  4.00  perimeter  8.00",
  "",
  "Scaled by 3: 3x6 rectangle",
  "",
  "Largest by:",
  "  area       circle of radius 2",
  "  perimeter  3x4 rectangle",
  "",
  "Area over 10: [3x4 rectangle circle of radius 2]",
  "",
  "What each shape is:",
  "  some other shape: 3x4 rectangle",
  "  a circle, 4 across",
  "  a square, its sides 2",
].map((text) => ({ stream: "stdout", text }));

/** What generics prints, every run, as its own go test holds it: each line on stdout. */
const GENERICS_OUTPUT = [
  "Sum:",
  "  ints     10",
  "  floats   0.75",
  "  Celsius  18.5C",
  "",
  "Largest:",
  "  of 3, 9, 4            9",
  "  of pear, apple, plum  plum",
  "",
  "A Stack[string]:",
  "  top down: out last in first",
  '  popped "out", 3 left',
  "  an empty Stack[int] pops 0, false",
  "",
  "Iterators:",
  "  Fibonacci under 100: 0 1 1 2 3 5 8 13 21 34 55 89",
  "  first five even, labelled: [#0 #2 #8 #34 #144]",
].map((text) => ({ stream: "stdout", text }));

/** What concurrency prints, every run, as its own go test holds it: each line on stdout. */
const CONCURRENCY_OUTPUT = [
  "Goroutines, one per word, then Wait:",
  "  goroutine  9 letters",
  "  channel    7 letters",
  "  select     6 letters",
  "  pipeline   8 letters",
  "",
  "Channels, taking turns:",
  "  sent 1, got back 2",
  "  sent 2, got back 4",
  "  sent 3, got back 6",
  "",
  "Select:",
  "  nothing ready, so the default case ran",
  "  nothing came within 10ms, so the timeout case ran",
  "  from evens: 4 values, sum 20",
  "  from odds:  3 values, sum 9",
  "",
  "A pipeline, squared by three workers:",
  ...Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    return `  ${String(n).padStart(2)} squared is ${String(n * n).padStart(3)}`;
  }),
  "  total 385",
].map((text) => ({ stream: "stdout", text }));

/** What stdlib prints for its shipped input.json, every run, as its own go test holds it: each
 * line on stdout. */
const STDLIB_OUTPUT = [
  "calc v1.1.0: 8 commits by 3 authors",
  "",
  "Features:",
  "  c47d2a6  -       comments start with # and run to the end of the line",
  "  e2a9d48  eval    report division by zero (#9, #14)",
  "  4d1e7a2  parser  parse a leading minus as negation (#14)",
  "",
  "Fixes:",
  "  b83f0c9  lexer   accept a number that starts with a dot (#12)",
  "  93ac27f  parser  reject a let with no name (#17)",
  "",
  "Other:",
  "  71c5e30  -       explain let in the doc comment",
  "  5be8c14  lexer   cover numbers with two dots",
  "",
  "Not in the conventional form:",
  '  0f6b1d5  "tidy up before the release"',
  "",
  "By author, most commits first:",
  "  Ada   4",
  "  Grace 3",
  "  Linus 1",
  "",
  "Issues referenced: #9, #12, #14, #17",
].map((text) => ({ stream: "stdout", text }));

/** Each program's files, in the demo's order. */
const FILES: Record<string, string[]> = {
  calc: ["main.go", "lexer.go", "parser.go", "eval.go", "input.txt"],
  basics: ["main.go", "shapes.go"],
  generics: ["main.go", "stack.go"],
  concurrency: ["main.go", "pipeline.go"],
  stdlib: ["main.go", "input.json"],
};

/** Chooses the program in the select, as a reader's choice changes it, and waits until the demo's
 * tabs show the program's files. */
async function choose(page: Page, program: string) {
  await page.evaluate(`(() => {
    const picker = ${PICKER};
    picker.value = ${JSON.stringify(program)};
    picker.dispatchEvent(new Event("input", { bubbles: true }));
    picker.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await until(
    page,
    `[...window.demos.part(${PLAYGROUND}, "sl-file-tabs").shadowRoot
      .querySelectorAll('[role="tab"]')].map((tab) => tab.dataset.name).join()
      === ${JSON.stringify(FILES[program].join())}`,
    2000,
  );
}

/** Resolves once the demo's tabs show the program's files and the select has it chosen, as a
 * history step or an edited fragment leaves them. */
const showing = (page: Page, program: string) =>
  until(
    page,
    `${PICKER}.value === ${JSON.stringify(program)}
      && [...window.demos.part(${PLAYGROUND}, "sl-file-tabs").shadowRoot
        .querySelectorAll('[role="tab"]')].map((tab) => tab.dataset.name).join()
        === ${JSON.stringify(FILES[program].join())}`,
    2000,
  );

/** The page's fragment and its history's length. */
const where = (page: Page): Promise<{ hash: string; length: number }> =>
  page.evaluate(`({ hash: location.hash, length: history.length })`);

/** Selects the demo's tab by its file's name, as a click on it requests. */
async function select(page: Page, name: string) {
  await page.evaluate(
    `window.demos.part(${PLAYGROUND}, "sl-file-tabs").shadowRoot
      .querySelector('[role="tab"][data-name=${JSON.stringify(name)}]').click()`,
  );
  await until(page, `window.demos.tab(${PLAYGROUND}) === ${JSON.stringify(name)}`, 2000);
}

/** The demo's files, its tabs' names in order, the active one, and the editor's text. */
const files = (page: Page): Promise<{ names: string[]; active: string; value: string }> =>
  page.evaluate(`({
    names: [...window.demos.part(${PLAYGROUND}, "sl-file-tabs").shadowRoot
      .querySelectorAll('[role="tab"]')].map((tab) => tab.dataset.name),
    active: window.demos.tab(${PLAYGROUND}),
    value: window.demos.editor(${PLAYGROUND}).value,
  })`);

describe("the playground's programs", () => {
  test("the Program select sits beside the heading, offers Calculator, Basics, Generics, Concurrency, and Standard library, Calculator chosen, and is in the accessibility tree by its label", async () => {
    const { page } = await open();
    try {
      const picker: { options: string[][]; value: string; beside: boolean } =
        await page.evaluate(`(() => {
          const picker = ${PICKER};
          const heading = document.querySelector("main > .prose > .title > h1");
          return {
            options: [...picker.options].map(({ value, text }) => [value, text]),
            value: picker.value,
            beside: picker.closest("label").parentElement === heading.parentElement,
          };
        })()`);
      assert.deepEqual(picker, { options: PROGRAMS, value: "calc", beside: true });
      const [combobox, ...others] = await axQuery(
        page,
        `document.querySelector("main > .prose")`,
        "combobox",
      );
      assert.ok(combobox, "the select is in the tree");
      assert.equal(others.length, 0, "one combobox");
      assert.equal(combobox.name?.value, "Program", "named by its label");
      assert.equal(combobox.value?.value, "Calculator", "its value the chosen option's");
    } finally {
      await page.close();
    }
  });

  test("choosing Basics shows its files in place, main.go active, with no reload and no request, and its Run prints its exact output with exit 0", async () => {
    const watched = await open();
    const { page } = watched;
    try {
      await page.evaluate(`window.notReloaded = true`);
      const from = watched.requests.length;
      await choose(page, "basics");
      assert.deepEqual(await files(page), {
        names: FILES.basics,
        active: "main.go",
        value: source("basics", "main.go"),
      });
      assert.equal(await page.evaluate(`window.notReloaded`), true, "no reload");
      assert.deepEqual(watched.requests.slice(from), [], "no request");
      assert.equal(await page.evaluate(`document.querySelectorAll("sl-go-demo").length`), 1);

      const ran = await build(page, PLAYGROUND, DONE);
      assert.deepEqual(ran.lines, BASICS_OUTPUT);
      assert.deepEqual(ran.rows.at(-1), { kind: "exit", text: "main exited with code 0" });

      // Back to the calculator: its files, and the console and timings cleared.
      await choose(page, "calc");
      const back = await shown(page, PLAYGROUND);
      assert.deepEqual([back.rows, back.phases], [[], []], "the console and the timings cleared");
      assert.equal((await files(page)).value, source("calc", "main.go"));
    } finally {
      await page.close();
    }
  });

  for (const [program, label, output] of [
    ["generics", "Generics", GENERICS_OUTPUT],
    ["concurrency", "Concurrency", CONCURRENCY_OUTPUT],
    ["stdlib", "Standard library", STDLIB_OUTPUT],
  ] as const) {
    test(`choosing ${label} shows its files in place, main.go active, with no request, and its Run prints its exact output with exit 0`, async () => {
      const watched = await open();
      const { page } = watched;
      try {
        const from = watched.requests.length;
        await choose(page, program);
        assert.deepEqual(await files(page), {
          names: FILES[program],
          active: "main.go",
          value: source(program, "main.go"),
        });
        assert.deepEqual(watched.requests.slice(from), [], "no request");

        const ran = await build(page, PLAYGROUND, DONE);
        assert.deepEqual(ran.lines, output);
        assert.deepEqual(ran.rows.at(-1), { kind: "exit", text: "main exited with code 0" });
      } finally {
        await page.close();
      }
    });
  }

  test("an edit to stdlib's input.json alone reruns it with no Go compile or link and no request, and a malformed input.json prints the one line naming its JSON error, with exit 1", async () => {
    const watched = await open();
    const { page } = watched;
    try {
      await choose(page, "stdlib");
      await build(page, PLAYGROUND, DONE);

      let from = watched.requests.length;
      await select(page, "input.json");
      await paste(
        page,
        '{"project": "calc", "version": "v1.1.1", "commits": [\n' +
          '  {"hash": "a1b2c3d", "author": "Grace", "message": "fix(eval): round -0 to 0 (#21)"},\n' +
          '  {"hash": "f00d5e7", "author": "Linus", "message": "bump the version"}\n' +
          "]}\n",
        true,
      );
      const rerun = await build(page, PLAYGROUND, DONE);
      assert.deepEqual(
        rerun.lines,
        [
          "calc v1.1.1: 2 commits by 2 authors",
          "",
          "Fixes:",
          "  a1b2c3d  eval    round -0 to 0 (#21)",
          "",
          "Not in the conventional form:",
          '  f00d5e7  "bump the version"',
          "",
          "By author, most commits first:",
          "  Grace 1",
          "  Linus 1",
          "",
          "Issues referenced: #21",
        ].map((text) => ({ stream: "stdout", text })),
      );
      assert.deepEqual(rerun.phases, ["Instantiate", "Run"], "no Go compile or link");
      assert.deepEqual(
        goRequests({ ...watched, requests: watched.requests.slice(from) }),
        [],
        "nothing fetched",
      );

      from = watched.requests.length;
      await paste(page, '{\n  "commits": [\n    { "hash": "4d1e7a2" },\n  ]\n}\n', true);
      const failed = await build(page, PLAYGROUND, "Finished main, exit code 1");
      assert.deepEqual(failed.lines, [
        {
          stream: "stderr",
          text: "input.json:4:3: syntax error: invalid character ']' looking for beginning of value",
        },
      ]);
      assert.deepEqual(failed.rows.at(-1), { kind: "exit", text: "main exited with code 1" });
      assert.deepEqual(failed.phases, ["Instantiate", "Run"]);
      assert.deepEqual(goRequests({ ...watched, requests: watched.requests.slice(from) }), []);
    } finally {
      await page.close();
    }
  });

  test("edits survive a switch, with the active file, and Reset restores the program on screen alone", async () => {
    const { page } = await open();
    try {
      await select(page, "input.txt");
      await retype(page, PLAYGROUND, "1 + 2");
      await choose(page, "basics");
      await select(page, "shapes.go");
      await retype(page, PLAYGROUND, "package main");

      await choose(page, "calc");
      assert.deepEqual(await files(page), {
        names: FILES.calc,
        active: "input.txt",
        value: "1 + 2",
      });
      await choose(page, "basics");
      assert.deepEqual(await files(page), {
        names: FILES.basics,
        active: "shapes.go",
        value: "package main",
      });

      await pressControl(page, PLAYGROUND, "reset");
      await until(
        page,
        `window.demos.editor(${PLAYGROUND}).value === ${JSON.stringify(source("basics", "shapes.go"))}`,
        2000,
      );
      await choose(page, "calc");
      assert.deepEqual(
        await files(page),
        {
          names: FILES.calc,
          active: "input.txt",
          value: "1 + 2",
        },
        "the calculator's edit kept",
      );
    } finally {
      await page.close();
    }
  });

  test("switching back to a program built earlier compiles and links it again, fetching no archive the worker holds", async (t) => {
    const watched = await open();
    const { page } = watched;
    try {
      const first = await build(page, PLAYGROUND, DONE);
      await choose(page, "basics");
      const other = await build(page, PLAYGROUND, DONE);
      assert.deepEqual(other.lines, BASICS_OUTPUT);

      const from = watched.requests.length;
      await choose(page, "calc");
      const again = await build(page, PLAYGROUND, DONE);
      t.diagnostic(`calc again: ${again.phases.join(", ")}`);
      assert.deepEqual(again.phases, BUILT_PHASES, "compiled and linked again");
      assert.deepEqual(again.lines, first.lines, "the calculator's output again");
      assert.deepEqual(again.rows.at(-1), { kind: "exit", text: "main exited with code 0" });
      assert.deepEqual(
        toolchainRequests(watched, from),
        ["manifest.json"],
        "the manifest revalidated, and no toolchain module or archive fetched",
      );
    } finally {
      await page.close();
    }
  });

  test("the page opens on the program its fragment names, and on the calculator with no fragment or one that names no program", async () => {
    const cases = [
      ...PROGRAMS.map(([program]) => [`#${program}`, program]),
      ["", "calc"],
      ["#", "calc"],
      ["#nope", "calc"],
      ["#program", "calc"],
    ];
    for (const [fragment, program] of cases) {
      const { page } = await openPage(browser, server.origin, `playground.html${fragment}`);
      try {
        await showing(page, program);
        assert.deepEqual(
          await files(page),
          { names: FILES[program], active: "main.go", value: source(program, "main.go") },
          `${fragment || "no fragment"} opens ${program}`,
        );
      } finally {
        await page.close();
      }
    }
  });

  test("a choice writes its fragment as a new history entry; Back, Forward, and an edited fragment show the program it names, with its edits, the select following, with no reload", async () => {
    const { page } = await open();
    try {
      await page.evaluate(`window.notReloaded = true`);
      const start = await where(page);
      assert.equal(start.hash, "", "no fragment on load");

      await choose(page, "basics");
      assert.deepEqual(await where(page), { hash: "#basics", length: start.length + 1 });
      await retype(page, PLAYGROUND, "package main // basics, edited");
      await choose(page, "generics");
      assert.deepEqual(await where(page), { hash: "#generics", length: start.length + 2 });

      await page.evaluate(`history.back()`);
      await showing(page, "basics");
      assert.equal((await where(page)).hash, "#basics");
      assert.deepEqual(
        await files(page),
        { names: FILES.basics, active: "main.go", value: "package main // basics, edited" },
        "Back shows basics with its edit",
      );

      await page.evaluate(`history.forward()`);
      await showing(page, "generics");
      assert.equal((await where(page)).hash, "#generics");
      assert.equal((await files(page)).value, source("generics", "main.go"));

      await page.evaluate(`history.go(-2)`);
      await showing(page, "calc");
      assert.equal((await where(page)).hash, "", "back to the entry the page opened on");

      await page.evaluate(`location.hash = "stdlib"`);
      await showing(page, "stdlib");
      await page.evaluate(`location.hash = "basics"`);
      await showing(page, "basics");
      assert.equal((await files(page)).value, "package main // basics, edited", "its edit kept");
      await page.evaluate(`location.hash = "nope"`);
      await showing(page, "calc");

      assert.equal(await page.evaluate(`window.notReloaded`), true, "no reload");
    } finally {
      await page.close();
    }
  });

  test("a switch while a run is pending stops it, the status saying so, and clears the console and the timings; the next Run runs the program shown", async () => {
    const { page } = await open();
    try {
      await retype(
        page,
        PLAYGROUND,
        'package main; import "fmt"; func main() { fmt.Println("spinning until a switch"); for {} }',
      );
      await pressControl(page, PLAYGROUND, "run");
      await until(
        page,
        `window.demos.rows(${PLAYGROUND}).some((row) => row.text === "spinning until a switch")`,
        BUILD,
      );
      await choose(page, "basics");
      await says(page, PLAYGROUND, "Stopped main", 5000);
      const switched = await shown(page, PLAYGROUND);
      assert.deepEqual(
        [switched.rows, switched.phases],
        [[], []],
        "the console and the timings cleared",
      );

      const ran = await build(page, PLAYGROUND, DONE);
      assert.deepEqual(ran.lines, BASICS_OUTPUT);
    } finally {
      await page.close();
    }
  });
});
