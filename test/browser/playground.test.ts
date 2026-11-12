// The playground, playground.html, running the reader's Go: the build as Pages serves it, dist/
// under the base by the SDK's served(), Vite's preview, in the pinned chrome-headless-shell, the
// worker's fetches read through CDP (go-demos.ts).
//
// The page holds one source demo with editable files, opening on the starter, playground/calc's
// four .go files and its input.txt, main.go active, and requests no Go and starts no worker before
// a Run. The first Run fetches the manifest, the compiler, the linker, and only the starter's
// closure of archives, and prints the starter's results with exit 0 and every phase of a build. An
// edit to input.txt alone builds nothing: the Run fetches nothing, shows no Go compile or link, and
// prints the new input's results, a failing line's report on stderr with exit 1. A Run after an
// edit to main.go fetches the manifest alone, no toolchain module and no archive already held, and
// prints what the edited program now prints; a new standard import fetches only the archives its
// closure adds. A compile error shows the compiler's output and its exit and runs nothing; Stop
// ends a busy loop, and the next build fetches no toolchain module; and a file the reader adds is
// read through os.ReadFile from the working directory, with nothing a run writes outliving it. What
// the build proves beyond these, through the components page's source demo, is go-build.test.ts's;
// the helpers are go-builds.ts's and go-demos.ts's. Every wait is bounded. Nothing here names the
// site: its base is package.json's name.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test, type TestContext } from "node:test";

import { launch, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import {
  archivesOf,
  BUILD,
  build,
  BUILT_PHASES,
  DONE,
  retype,
  timed,
  TOOLS,
  toolchainRequests,
} from "./go-builds.ts";
import { goRequests, open as openPage, pressControl, says, shown } from "./go-demos.ts";
import { paste } from "./playground-layouts.ts";

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

/** The playground's one demo. */
const PLAYGROUND = `document.querySelector("sl-go-demo")`;

/** Opens the playground, watched (go-demos.ts). */
const open = () => openPage(browser, server.origin, "playground.html");

/** The starter's files, in the demo's order, as playground/calc holds them. */
const STARTER = ["main.go", "lexer.go", "parser.go", "eval.go", "input.txt"];
const mainSource = readFileSync(join(root, "playground/calc/main.go"), "utf8");

/** The standard packages the starter's .go files import, whose closure its first Run fetches. */
const STARTER_IMPORTS = ["errors", "fmt", "os", "strconv", "strings", "unicode"];

/** What the starter prints for its shipped input.txt, as its own go test holds it. */
const STARTER_OUTPUT = [
  "apples = 3",
  "bread = 4.25",
  "coffee = 17.5",
  "subtotal = 24.75",
  "coupon = -4.75",
  "rate = 0.08",
  "total = 21.6",
  "5.4",
  "3.4",
].map((text) => ({ stream: "stdout", text }));

/** Selects the demo's tab by its file's name, as a click on it requests. */
async function select(page: Page, name: string) {
  await page.evaluate(
    `window.demos.part(${PLAYGROUND}, "sl-file-tabs").shadowRoot
      .querySelector('[role="tab"][data-name=${JSON.stringify(name)}]').click()`,
  );
  await until(page, `window.demos.tab(${PLAYGROUND}) === ${JSON.stringify(name)}`, 2000);
}

/** Adds a file by New file's form, its name typed and the form submitted. */
async function newFile(page: Page, name: string) {
  await pressControl(page, PLAYGROUND, "new");
  const input = `window.demos.part(${PLAYGROUND}, "sl-controls").shadowRoot.querySelector("#new-name")`;
  await until(page, `${input}.matches(":focus")`, 2000);
  await page.evaluate(`${input}.select()`);
  await page.cdp("Input.insertText", { text: name });
  await page.evaluate(`${input}.form.requestSubmit()`);
  await until(page, `window.demos.tab(${PLAYGROUND}) === ${JSON.stringify(name)}`, 2000);
}

describe("the playground", () => {
  test("opens on the starter in one source demo, main.go active, and requests no Go before a Run", async () => {
    const watched = await open();
    const { page } = watched;
    try {
      const opened: {
        demos: number;
        files: string[];
        value: string;
        tab: string;
        source: boolean;
      } = await page.evaluate(`({
          demos: document.querySelectorAll("sl-go-demo").length,
          files: [...window.demos.part(${PLAYGROUND}, "sl-file-tabs").shadowRoot
            .querySelectorAll('[role="tab"]')].map((tab) => tab.dataset.name),
          value: window.demos.editor(${PLAYGROUND}).value,
          tab: window.demos.tab(${PLAYGROUND}),
          source: ${PLAYGROUND}.source,
        })`);
      assert.deepEqual(opened, {
        demos: 1,
        files: STARTER,
        value: mainSource,
        tab: "main.go",
        source: true,
      });
      assert.deepEqual(goRequests(watched), []);
      assert.deepEqual(watched.workers, []);
    } finally {
      await page.close();
    }
  });

  test("the first Run builds the starter from the toolchain and its closure alone; an edit fetches no toolchain module and no archive held, a new import only what its closure adds", async (t: TestContext) => {
    const watched = await open();
    const { page } = watched;
    try {
      const cold = await build(page, PLAYGROUND, DONE);
      t.diagnostic(`cold: ${timed(cold)}`);
      assert.deepEqual(cold.lines, STARTER_OUTPUT);
      assert.deepEqual(cold.rows.at(-1), { kind: "exit", text: "main exited with code 0" });
      assert.deepEqual(cold.phases, BUILT_PHASES);
      assert.ok(
        cold.times.every((ms) => Number.isFinite(ms) && ms >= 0),
        `each phase's time is a duration: ${cold.times}`,
      );
      const fetched = toolchainRequests(watched);
      assert.equal(fetched[0], "manifest.json");
      assert.deepEqual(
        fetched.slice(1).sort(),
        [...TOOLS, ...archivesOf(STARTER_IMPORTS)].sort(),
        "the toolchain and the starter's closure, each once",
      );

      // An edit to main.go within the same imports: the manifest revalidated, nothing else
      // fetched. The other .go files still build with it, as package main.
      let from = watched.requests.length;
      await retype(
        page,
        PLAYGROUND,
        'package main; import "fmt"; func main() { fmt.Println("edited in the playground") }',
      );
      const edited = await build(page, PLAYGROUND, DONE);
      t.diagnostic(`edited: ${timed(edited)}`);
      assert.deepEqual(edited.lines, [{ stream: "stdout", text: "edited in the playground" }]);
      assert.deepEqual(edited.phases, BUILT_PHASES);
      assert.deepEqual(toolchainRequests(watched, from), ["manifest.json"]);

      // A new standard import: only the archives its closure adds.
      from = watched.requests.length;
      await retype(
        page,
        PLAYGROUND,
        'package main; import ("fmt"; "math/big"); func main() { fmt.Println(new(big.Int).Lsh(big.NewInt(1), 100)) }',
      );
      const imported = await build(page, PLAYGROUND, DONE);
      t.diagnostic(`math/big imported: ${timed(imported)}`);
      assert.deepEqual(imported.lines, [
        { stream: "stdout", text: "1267650600228229401496703205376" },
      ]);
      const held = new Set(archivesOf(STARTER_IMPORTS));
      const added = archivesOf([...STARTER_IMPORTS, "math/big"]).filter(
        (archive) => !held.has(archive),
      );
      assert.ok(added.length > 0, "math/big's closure adds archives");
      assert.deepEqual(toolchainRequests(watched, from).sort(), ["manifest.json", ...added].sort());
    } finally {
      await page.close();
    }
  });

  test("an edit to input.txt alone builds nothing: the Run fetches nothing and prints the new input's results, a failing line on stderr with exit 1", async () => {
    const watched = await open();
    const { page } = watched;
    try {
      await build(page, PLAYGROUND, DONE);

      let from = watched.requests.length;
      await select(page, "input.txt");
      await paste(page, "let price = 12.5\n# Three, with 20% off.\nprice * 3 * (1 - 0.2)\n", true);
      const rerun = await build(page, PLAYGROUND, DONE);
      assert.deepEqual(rerun.lines, [
        { stream: "stdout", text: "price = 12.5" },
        { stream: "stdout", text: "30" },
      ]);
      assert.deepEqual(rerun.phases, ["Instantiate", "Run"], "no Go compile or link");
      assert.deepEqual(
        goRequests({ ...watched, requests: watched.requests.slice(from) }),
        [],
        "nothing fetched",
      );

      from = watched.requests.length;
      await paste(page, "let price = 12.5\nprice / 0\nprice * count\nprice * 2\n", true);
      const failed = await build(page, PLAYGROUND, "Finished main, exit code 1");
      assert.deepEqual(failed.lines, [
        { stream: "stdout", text: "price = 12.5" },
        { stream: "stderr", text: "input.txt:2: division by zero" },
        { stream: "stderr", text: "input.txt:3: undefined: count" },
        { stream: "stdout", text: "25" },
      ]);
      assert.deepEqual(failed.rows.at(-1), { kind: "exit", text: "main exited with code 1" });
      assert.deepEqual(failed.phases, ["Instantiate", "Run"]);
      assert.deepEqual(goRequests({ ...watched, requests: watched.requests.slice(from) }), []);
    } finally {
      await page.close();
    }
  });

  test("a compile error shows the compiler's output and its exit, and runs nothing", async () => {
    const { page } = await open();
    try {
      await retype(page, PLAYGROUND, "package main; func main() { println(x) }");
      const failed = await build(page, PLAYGROUND, "Failed main: compile exited with code 2");
      assert.deepEqual(failed.lines, [{ stream: "stdout", text: "main.go:1:37: undefined: x" }]);
      assert.deepEqual(failed.rows.slice(1), [
        { kind: "exit", text: "compile exited with code 2" },
        { kind: "result", text: "Error compile exited with code 2" },
      ]);
      assert.deepEqual(failed.phases, ["Fetch", "Wasm compile", "Go compile"]);
    } finally {
      await page.close();
    }
  });

  test("Stop ends a busy loop, and the next build fetches no toolchain module", async (t: TestContext) => {
    const watched = await open();
    const { page } = watched;
    try {
      await retype(
        page,
        PLAYGROUND,
        'package main; import "fmt"; func main() { fmt.Println("spinning until Stop"); for {} }',
      );
      await pressControl(page, PLAYGROUND, "run");
      await until(
        page,
        `window.demos.rows(${PLAYGROUND}).some((row) => row.text === "spinning until Stop")`,
        BUILD,
      );
      await pressControl(page, PLAYGROUND, "stop");
      await says(page, PLAYGROUND, "Stopped main", 5000);
      assert.equal((await shown(page, PLAYGROUND)).status, "Stopped main");

      const from = watched.requests.length;
      await retype(
        page,
        PLAYGROUND,
        'package main; import "fmt"; func main() { fmt.Println("after Stop") }',
      );
      const next = await build(page, PLAYGROUND, DONE);
      t.diagnostic(`after Stop: ${timed(next)}`);
      assert.deepEqual(next.lines, [{ stream: "stdout", text: "after Stop" }]);
      const fetched = toolchainRequests(watched, from);
      assert.ok(
        TOOLS.every((tool) => !fetched.includes(tool)),
        `no toolchain module fetched: ${fetched}`,
      );
    } finally {
      await page.close();
    }
  });

  test("a file the reader adds is read from the working directory, and nothing a run writes outlives it", async () => {
    const { page } = await open();
    try {
      await newFile(page, "notes.txt");
      await page.cdp("Input.insertText", { text: "added in the playground" });
      await until(
        page,
        `window.demos.editor(${PLAYGROUND}).value === "added in the playground"`,
        2000,
      );
      await select(page, "main.go");
      await retype(
        page,
        PLAYGROUND,
        'package main; import ("fmt"; "os"); func main() { text, err := os.ReadFile("notes.txt"); if err != nil { panic(err) }; _, err = os.Stat("out.txt"); fmt.Printf("read %q, out.txt there: %v\\n", text, err == nil); if err := os.WriteFile("out.txt", text, 0o644); err != nil { panic(err) } }',
      );
      const line = {
        stream: "stdout",
        text: 'read "added in the playground", out.txt there: false',
      };
      const first = await build(page, PLAYGROUND, DONE);
      assert.deepEqual(first.lines, [line]);
      // The same files again run over a fresh working directory: the last run's out.txt is gone.
      const second = await build(page, PLAYGROUND, DONE);
      assert.deepEqual(second.phases, ["Instantiate", "Run"]);
      assert.deepEqual(second.lines, [line]);
    } finally {
      await page.close();
    }
  });
});
