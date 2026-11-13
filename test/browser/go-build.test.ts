// Building in the page, through the components page's source demo (sl-go-demo's source mode) and
// the page's one runner: the build as Pages serves it, dist/ under the base by the SDK's served(),
// Vite's preview, in the pinned chrome-headless-shell, the worker's fetches read through CDP
// (go-demos.ts).
//
// A cold Run fetches the manifest, the compiler, the linker, and only the archives of the
// program's import closure, compiles every .go file as package main and links it, and runs main,
// which reads input.txt from its working directory, its exit 0, every phase of a build shown in
// phase order. A Run of the same files builds nothing: no request, the run's two phases alone. An
// edit adding an import revalidates the manifest and fetches only the archives the new closure
// adds, no toolchain module, and the edited program's output shows. A compile error shows the
// compiler's output as written, its position relative to main.go, and its exit, the build failing
// naming the step and running nothing; an import the manifest doesn't hold fails naming the
// package before the compiler runs or the toolchain is fetched. Stop: after the runner's Stop while
// idle, a Run of the same files runs with no build and no request; Stop ends a built busy loop and
// a build whose archive fetch CDP's Fetch holds, and the next build fetches and compiles no
// toolchain module, one worker live. A build runs alone: started while spin is pending, it stops
// spin first, each console holding only its own output; a program's Run, or the runner's load or
// run, started while a build is pending stops the build, which rejects with "stopped", the source
// demo's console holding none of the other request's events. A built program that exits with a
// goroutine's timer still scheduled answers its exit code, and so does the next run, which the
// exited program's timer would otherwise fail (the worker's exit guard). Ctrl+Enter and
// Cmd+Enter, Meta, from the source demo's editor build and run the edited program, and Reset
// restores the source as given. The build's helpers are go-builds.ts's. Every wait is bounded. Nothing here names the
// site: its base is package.json's name.

import assert from "node:assert/strict";
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
  manifest,
  retype as retypeIn,
  timed,
  TOOLS,
  toolchainRequests,
} from "./go-builds.ts";
import {
  demo,
  open as openPage,
  pressControl,
  says,
  settles,
  shown,
  spin,
  type Shown,
} from "./go-demos.ts";

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

const SOURCE = demo("source");
const SPIN = demo("shared", 0);
const HELLO = demo("program");

/** hello's line, as the prebuilt program demo prints it. */
const helloLine = /^hello from Go go1\.\d+\.\d+ on js\/wasm$/;

/** The source demo's input.txt, as components.html gives it. */
const INPUT = "hello from the working directory\n";

/** Opens the components page, watched (go-demos.ts). */
const open = () => openPage(browser, server.origin);

/** Replaces the source demo's active file's text. */
const retype = (page: Page, text: string) => retypeIn(page, SOURCE, text);

/** CDP's modifier bits. */
const CTRL = 2;
const META = 4;

/** Enter pressed and released on the focused element, carrying its text as a keyboard's does,
 * with the modifiers, CDP's bits. */
async function enter(page: Page, modifiers: number) {
  for (const type of ["keyDown", "keyUp"]) {
    await page.cdp("Input.dispatchKeyEvent", {
      type,
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
      modifiers,
      ...(type === "keyDown" ? { text: "\r" } : {}),
    });
  }
}

/** Holds back the compiler's fetch with CDP's Fetch, so a cold build stays pending; release lets
 * every held request go, a terminated worker's among them. */
async function holdCompiler(page: Page): Promise<{ paused: string[]; release(): Promise<void> }> {
  const paused: string[] = [];
  page.on("Fetch.requestPaused", ({ requestId }) => paused.push(requestId));
  await page.cdp("Fetch.enable", {
    patterns: [{ urlPattern: `*/go/toolchain/${manifest.compile}` }],
  });
  let released = false;
  return {
    paused,
    async release() {
      if (released) return;
      released = true;
      await page.cdp("Fetch.disable").catch(() => {});
      for (const requestId of paused) {
        await page.cdp("Fetch.continueRequest", { requestId }).catch(() => {});
      }
    },
  };
}

/** Presses the source demo's Run and answers what it shows once its status says the text. */
const run = (page: Page, finished: string): Promise<Shown> => build(page, SOURCE, finished);

describe("a source demo's build", () => {
  test("cold: the manifest, the toolchain, and only the closure's archives fetched; main run; every phase", async (t: TestContext) => {
    const watched = await open();
    const { page } = watched;
    try {
      const cold = await run(page, DONE);
      t.diagnostic(`cold: ${timed(cold)}`);
      assert.deepEqual(cold.lines, [
        { stream: "stdout", text: `main read ${INPUT.length} bytes: ${INPUT.trimEnd()}` },
      ]);
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
        [...TOOLS, ...archivesOf(["fmt", "os"])].sort(),
        "the toolchain and the closure's archives, each once",
      );

      // The same files again: nothing fetched, compiled, or linked.
      const before = watched.requests.length;
      const warm = await run(page, DONE);
      t.diagnostic(`unchanged: ${timed(warm)}`);
      assert.deepEqual(warm.phases, ["Instantiate", "Run"]);
      assert.deepEqual(toolchainRequests(watched, before), []);
      assert.deepEqual(warm.lines, cold.lines);
    } finally {
      await page.close();
    }
  });

  test("an edit adding an import fetches the manifest and only the archives it adds, and prints what it now prints", async (t: TestContext) => {
    const watched = await open();
    const { page } = watched;
    try {
      await run(page, DONE);
      const before = watched.requests.length;
      await retype(
        page,
        'package main; import ("encoding/json"; "fmt"); func main() { b, _ := json.Marshal([]int{1}); fmt.Println("edited", string(b)) }',
      );
      const edited = await run(page, DONE);
      t.diagnostic(`edited, encoding/json added: ${timed(edited)}`);
      assert.deepEqual(edited.lines, [{ stream: "stdout", text: "edited [1]" }]);
      assert.deepEqual(edited.phases, BUILT_PHASES);
      const held = new Set(archivesOf(["fmt", "os"]));
      const added = archivesOf(["encoding/json", "fmt"]).filter((archive) => !held.has(archive));
      assert.ok(added.length > 0, "encoding/json's closure adds archives");
      assert.deepEqual(
        toolchainRequests(watched, before).sort(),
        ["manifest.json", ...added].sort(),
      );
    } finally {
      await page.close();
    }
  });

  test("a compile error shows the compiler's output as written and its exit, and runs nothing", async () => {
    const watched = await open();
    const { page } = watched;
    try {
      await retype(page, "package main; func main() { println(x) }");
      const failed = await run(page, "Failed main: compile exited with code 2");
      assert.deepEqual(failed.lines, [{ stream: "stdout", text: "main.go:1:37: undefined: x" }]);
      assert.deepEqual(failed.rows.slice(1), [
        { kind: "exit", text: "compile exited with code 2" },
        { kind: "result", text: "Error compile exited with code 2" },
      ]);
      // The build stopped at Go's compile: nothing linked, instantiated, or run.
      assert.deepEqual(failed.phases, ["Fetch", "Wasm compile", "Go compile"]);
    } finally {
      await page.close();
    }
  });

  test("an import the manifest doesn't hold fails naming it, before the compiler runs or the toolchain is fetched", async () => {
    const watched = await open();
    const { page } = watched;
    try {
      await retype(page, 'package main; import _ "example.com/x"; func main() {}');
      const failed = await run(page, "Failed main: package example.com/x is not in the manifest");
      assert.deepEqual(failed.rows, [
        { kind: "result", text: "Error package example.com/x is not in the manifest" },
      ]);
      assert.deepEqual(failed.phases, ["Fetch"]);
      assert.deepEqual(toolchainRequests(watched), ["manifest.json"]);
    } finally {
      await page.close();
    }
  });
});

describe("Stop and a built program", () => {
  test("after the runner's Stop while idle, a Run of the same files runs the program with no build and no request", async () => {
    const watched = await open();
    const { page } = watched;
    try {
      await run(page, DONE);
      await page.evaluate(`${SOURCE}.runner.stop()`);
      const before = watched.requests.length;
      const again = await run(page, DONE);
      assert.deepEqual(again.phases, ["Instantiate", "Run"]);
      assert.match(again.lines[0]?.text ?? "", /^main read \d+ bytes: /);
      assert.deepEqual(toolchainRequests(watched, before), []);
      assert.equal(watched.workers.length, 2, `two workers: ${watched.workers}`);
      await settles(() => watched.live.size === 1, `one live worker, not ${watched.live.size}`);
    } finally {
      await page.close();
    }
  });

  test("Stop ends a built busy loop and a pending build; the next build fetches and compiles no toolchain module", async (t: TestContext) => {
    const watched = await open();
    const { page } = watched;
    const paused: string[] = [];
    try {
      await retype(
        page,
        'package main; import "fmt"; func main() { fmt.Println("spinning until Stop"); for {} }',
      );
      await pressControl(page, SOURCE, "run");
      await until(
        page,
        `window.demos.rows(${SOURCE}).some((row) => row.text === "spinning until Stop")`,
        BUILD,
      );
      await pressControl(page, SOURCE, "stop");
      await says(page, SOURCE, "Stopped main", 5000);

      // The fresh worker holds the toolchain: no compiler or linker fetched again. It holds no
      // archives, which the next build fetches again, over the HTTP cache.
      let before = watched.requests.length;
      await retype(page, 'package main; import "fmt"; func main() { fmt.Println("after Stop") }');
      const next = await run(page, DONE);
      t.diagnostic(`after Stop: ${timed(next)}`);
      assert.deepEqual(next.lines, [{ stream: "stdout", text: "after Stop" }]);
      assert.deepEqual(next.phases, BUILT_PHASES);
      assert.deepEqual(
        toolchainRequests(watched, before).sort(),
        ["manifest.json", ...archivesOf(["fmt"])].sort(),
      );

      // A build whose new archive is held back by CDP's Fetch, stopped while it waits.
      const unicode = manifest.packages["unicode/utf16"].archive!;
      page.on("Fetch.requestPaused", ({ requestId }) => paused.push(requestId));
      await page.cdp("Fetch.enable", { patterns: [{ urlPattern: `*/${unicode}` }] });
      await retype(
        page,
        'package main; import ("fmt"; "unicode/utf16"); func main() { fmt.Println(utf16.IsSurrogate(65)) }',
      );
      await pressControl(page, SOURCE, "run");
      await settles(() => paused.length === 1, "the utf16 archive requested and held", BUILD);
      await pressControl(page, SOURCE, "stop");
      await says(page, SOURCE, "Stopped main", 5000);
      await page.cdp("Fetch.disable");
      for (const requestId of paused) {
        await page.cdp("Fetch.continueRequest", { requestId }).catch(() => {});
      }

      before = watched.requests.length;
      const built = await run(page, DONE);
      assert.deepEqual(built.lines, [{ stream: "stdout", text: "false" }]);
      assert.deepEqual(built.phases, BUILT_PHASES);
      const fetched = toolchainRequests(watched, before);
      assert.ok(
        TOOLS.every((tool) => !fetched.includes(tool)),
        `no toolchain module fetched: ${fetched}`,
      );
      assert.equal(watched.workers.length, 3, `three workers: ${watched.workers}`);
      await settles(() => watched.live.size === 1, `one live worker, not ${watched.live.size}`);
    } finally {
      await page.cdp("Fetch.disable").catch(() => {});
      await page.close();
    }
  });
});

describe("a build runs alone", () => {
  test("a build started while spin is pending stops spin first; each console holds only its own output", async () => {
    const { page } = await open();
    try {
      await spin(page, SPIN);
      await pressControl(page, SOURCE, "run");
      await says(page, SPIN, "Stopped spin", 10_000);
      await says(page, SOURCE, DONE, BUILD);
      assert.deepEqual((await shown(page, SPIN)).rows, [
        { kind: "line", text: "spin: looping until Stop" },
      ]);
      const built = await shown(page, SOURCE);
      assert.deepEqual(built.lines, [
        { stream: "stdout", text: `main read ${INPUT.length} bytes: ${INPUT.trimEnd()}` },
      ]);
      assert.deepEqual(built.rows.at(-1), { kind: "exit", text: "main exited with code 0" });
      assert.deepEqual(built.phases, BUILT_PHASES);
    } finally {
      await page.close();
    }
  });

  test("a program's Run while a build is pending stops the build; the source demo's console holds none of its events", async () => {
    const { page } = await open();
    const held = await holdCompiler(page);
    try {
      await pressControl(page, SOURCE, "run");
      await settles(() => held.paused.length === 1, "the compiler requested and held", BUILD);
      await pressControl(page, HELLO, "run");
      await says(page, SOURCE, "Stopped main", 10_000);
      await says(page, HELLO, "Finished hello, exit code 0", BUILD);
      const hello = await shown(page, HELLO);
      assert.match(hello.lines.map(({ text }) => text).join(""), helloLine);
      assert.deepEqual(hello.phases, ["Fetch", "Wasm compile", "Instantiate", "Run"]);
      // The stopped build showed nothing of hello's: no line, exit, result, or phase past its own.
      const stopped = await shown(page, SOURCE);
      assert.deepEqual(stopped.rows, []);
      assert.ok(
        stopped.phases.every((phase) => !["Instantiate", "Run"].includes(phase)),
        `the build's phases alone: ${stopped.phases}`,
      );
    } finally {
      await held.release();
      await page.close();
    }
  });

  for (const [what, next] of [
    ["the runner's load", `runner.load("hello")`],
    ["the runner's run", `runner.run().catch(() => {})`],
  ]) {
    test(`${what} while a build is pending stops the build, which rejects with "stopped"`, async () => {
      const { page } = await open();
      const held = await holdCompiler(page);
      try {
        const building = page.evaluate(`${SOURCE}.runner
          .build([{ name: "main.go", text: 'package main; func main() {}' }])
          .then(() => "built", (error) => error.message)`);
        await settles(() => held.paused.length === 1, "the compiler requested and held", BUILD);
        await page.evaluate(`(() => { const runner = ${SOURCE}.runner; return ${next}; })()`);
        // Bounded: without the preemption the build would wait on the held compiler forever.
        const unsettled = new Promise((resolve) => {
          setTimeout(resolve, 10_000, "unsettled").unref();
        });
        assert.equal(await Promise.race([building, unsettled]), "stopped");
        // The direct calls are no demo's: the source demo shows nothing of them.
        assert.deepEqual((await shown(page, SOURCE)).rows, []);
      } finally {
        await held.release();
        await page.close();
      }
    });
  }
});

describe("a built program's exit with a timer pending", () => {
  // wasm_exec.js's timeout events outlive the program's exit: a timer the program started is
  // still scheduled when it exits, and its callback resumes the exited program, which throws from
  // the worker's timer task. Here a goroutine's sleep outlasts main, which exits from a timer's
  // resume after writing stderr; its timeout fires while the next run is pending.
  const PROGRAM = `package main

import (
	"fmt"
	"os"
	"time"
)

func main() {
	go time.Sleep(1500 * time.Millisecond)
	time.Sleep(time.Second)
	fmt.Fprintln(os.Stderr, "leaving")
	os.Exit(3)
}
`;

  test("each run answers the program's exit code, not the exited program's timer", async () => {
    const { page } = await open();
    try {
      const runs: unknown[] = await page.evaluate(`(async () => {
        const runner = ${SOURCE}.runner;
        await runner.build([{ name: "main.go", text: ${JSON.stringify(PROGRAM)} }]);
        const answer = () => runner.run().then((code) => code, (error) => error.message);
        return [await answer(), await answer()];
      })()`);
      assert.deepEqual(runs, [3, 3]);
    } finally {
      await page.close();
    }
  });
});

describe("a source demo's keys and Reset", () => {
  test("Ctrl+Enter and Cmd+Enter, Meta, build and run the edited program; Reset restores the source as given", async () => {
    const { page } = await open();
    try {
      const given: string = await page.evaluate(`window.demos.editor(${SOURCE}).value`);
      await retype(
        page,
        'package main; import "fmt"; func main() { fmt.Println("by Ctrl+Enter") }',
      );
      await enter(page, CTRL);
      await says(page, SOURCE, DONE, BUILD);
      assert.deepEqual((await shown(page, SOURCE)).lines, [
        { stream: "stdout", text: "by Ctrl+Enter" },
      ]);

      await retype(page, 'package main; import "fmt"; func main() { fmt.Println("by Cmd+Enter") }');
      await enter(page, META);
      await until(
        page,
        `window.demos.lines(${SOURCE}).some((line) => line.text === "by Cmd+Enter")`,
        BUILD,
      );
      await says(page, SOURCE, DONE, BUILD);
      assert.deepEqual((await shown(page, SOURCE)).lines, [
        { stream: "stdout", text: "by Cmd+Enter" },
      ]);

      await pressControl(page, SOURCE, "reset");
      await until(page, `window.demos.editor(${SOURCE}).value === ${JSON.stringify(given)}`, 2000);
    } finally {
      await page.close();
    }
  });
});
