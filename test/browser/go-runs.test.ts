// The runtime in the browser, through the components page's Go demos: the build as Pages serves it,
// dist/ under the base by the SDK's served(), Vite's preview, in the pinned chrome-headless-shell,
// the page's one runner shared by every demo. The modules, hello's, probe's, and sqlate's, answer
// as application/wasm, and the index requests no Go on load (the components page's own load is
// go-demo.test.ts's). Through the demos: files' steps through the in-memory fs; a held module
// reused, a handler's call alone and a program's instance afresh, with no fetch; scenarios switched
// in place in one worker. Then Stop: it ends spin's busy loop, and after it, or after crash's panic
// ends the instance, the next call answers from the module the runner kept, with no new .wasm
// request, and the page never has more than one live worker; the runner's Stop while idle, which no
// demo sends, leaves the scenario loaded. And one request at a time: a program's Run in another
// demo while spin is pending stops spin first, then loads hello in the fresh worker; a load or Run
// while another demo's load is pending, its probe.wasm held back by CDP's Fetch, stops that load,
// which rejects with "stopped", and proceeds, and the stopped load, settling, never clears the
// newer load's scenario. hello's line and exit, format's answer, line, and error, the timings by
// phase, and a call while spin is pending are go-demo.test.ts's, the page's watch and helpers
// go-demos.ts's. Every wait is bounded. Nothing here names the site: its base is package.json's
// name.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import {
  demo,
  goRequests,
  open as openPage,
  pressControl,
  run,
  says,
  settles,
  shown,
  spin,
  wasmRequests,
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

/** Opens the components page, or the path, watched (go-demos.ts). */
const open = (path?: string) => openPage(browser, server.origin, path);

const helloLine = /^hello from Go go1\.\d+\.\d+ on js\/wasm$/;

/** The demos the runs use, by their states on the components page. */
const FORMAT = demo("handler");
const HELLO = demo("program");
const FILES = demo("files");
const CRASH = demo("crash");
const SPIN = demo("shared", 0);
const FORMAT5 = demo("shared", 1);

const HELLO_DONE = "Finished hello, exit code 0";

/** probe.wasm's requests held back, each paused, by CDP's Fetch, which sees the worker's fetch
 * through the page, until release(), which lets every one paused go on and holds no more. */
async function hold(page: Page): Promise<{ paused: string[]; release(): Promise<void> }> {
  const paused: string[] = [];
  page.on("Fetch.requestPaused", ({ requestId }) => paused.push(requestId));
  await page.cdp("Fetch.enable", { patterns: [{ urlPattern: "*/go/probe.wasm" }] });
  let released = false;
  return {
    paused,
    async release() {
      if (released) return;
      released = true;
      await page.cdp("Fetch.disable").catch(() => {});
      // A request of a worker Stop terminated may be gone already.
      for (const requestId of paused) {
        await page.cdp("Fetch.continueRequest", { requestId }).catch(() => {});
      }
    },
  };
}

describe("the Go modules under the base", () => {
  for (const name of ["hello", "probe", "sqlate"]) {
    test(`${name}.wasm answers 200 as application/wasm`, async () => {
      const response = await fetch(new URL(`go/${name}.wasm`, server.origin));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "application/wasm");
      const bytes = new Uint8Array(await response.arrayBuffer());
      // The wasm magic number, \0asm.
      assert.deepEqual([...bytes.subarray(0, 4)], [0x00, 0x61, 0x73, 0x6d]);
    });
  }

  test("the index requests no .wasm and no worker on load", async () => {
    const watched = await open("");
    try {
      assert.ok(watched.requests.length > 0, "the page's own requests were seen");
      assert.deepEqual(goRequests(watched), []);
      assert.deepEqual(watched.workers, []);
    } finally {
      await watched.page.close();
    }
  });
});

describe("the runs", () => {
  test("files works through the in-memory fs and reports each step", async () => {
    const { page } = await open();
    try {
      const input: string = await page.evaluate(`window.demos.editor(${FILES}).value`);
      const shown = await run(page, FILES, "Finished files");
      assert.equal(shown.result?.ok, true, JSON.stringify(shown.result));
      const { dir, steps } = JSON.parse(shown.result?.text ?? "");
      assert.match(dir, /^\/tmp\/probe-files-\d+$/);
      assert.deepEqual(steps, [
        { op: "mkdirtemp", path: dir },
        { op: "write", path: "input.txt", bytes: input.length },
        { op: "write", path: "notes/length.txt", bytes: String(input.length).length },
        {
          op: "list",
          path: ".",
          entries: [
            { name: "input.txt", kind: "file", size: input.length },
            { name: "notes", kind: "dir" },
          ],
        },
        { op: "read", path: "input.txt", bytes: input.length, text: input },
        { op: "remove", path: dir },
      ]);
      assert.deepEqual(shown.lines, [{ stream: "stdout", text: `files: 6 steps in ${dir}` }]);
    } finally {
      await page.close();
    }
  });

  test("a second run reuses the held module: probe's call alone, hello afresh, no fetch", async () => {
    const watched = await open();
    const { page } = watched;
    try {
      await run(page, FORMAT, "Finished format");
      const again = await run(page, FILES, "Finished files");
      assert.equal(again.result?.ok, true, JSON.stringify(again.result));
      assert.deepEqual(again.phases, ["Call"]);
      assert.deepEqual(goRequests(watched), ["assets/worker.js", "go/probe.wasm"]);

      const first = await run(page, HELLO, HELLO_DONE);
      const second = await run(page, HELLO, HELLO_DONE);
      assert.deepEqual(first.phases, ["Fetch", "Wasm compile", "Instantiate", "Run"]);
      // A program's exit ends its instance; the next run instantiates the held module afresh.
      assert.deepEqual(second.phases, ["Instantiate", "Run"]);
      assert.match(second.lines.map(({ text }) => text).join(""), helloLine);
      assert.deepEqual(goRequests(watched), ["assets/worker.js", "go/probe.wasm", "go/hello.wasm"]);
    } finally {
      await page.close();
    }
  });

  test("switching probe → hello → probe happens in place, in the one worker", async () => {
    const watched = await open();
    const { page } = watched;
    try {
      assert.equal((await run(page, FORMAT, "Finished format")).result?.ok, true);
      await run(page, HELLO, HELLO_DONE);
      const probe = await run(page, FORMAT5, "Finished format");
      assert.deepEqual(probe.result, { ok: true, text: "[\n  5\n]\n" });
      // probe's module is fetched again, over the HTTP cache, since the switch to hello replaced
      // it; its instance starts afresh.
      assert.deepEqual(probe.phases, ["Fetch", "Wasm compile", "Instantiate", "Start", "Call"]);
      assert.deepEqual(goRequests(watched), [
        "assets/worker.js",
        "go/probe.wasm",
        "go/hello.wasm",
        "go/probe.wasm",
      ]);
      assert.equal(watched.workers.length, 1, `one worker: ${watched.workers}`);
    } finally {
      await page.close();
    }
  });
});

describe("Stop", () => {
  test("ends spin's busy loop, and the next format answers from the kept module, no fetch", async () => {
    const watched = await open();
    const { page } = watched;
    try {
      await spin(page, SPIN);
      // The loop holds the worker: the call stays pending, however long the page waits.
      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.equal(await page.evaluate(`window.demos.status(${SPIN})`), "Running spin…");
      await pressControl(page, SPIN, "stop");
      await says(page, SPIN, "Stopped spin", 5000);
      const spun = await shown(page, SPIN);
      // spin's call never answered, so it posted no call timing, and no exit or result shows.
      assert.deepEqual(spun.phases, ["Fetch", "Wasm compile", "Instantiate", "Start"]);
      assert.deepEqual(spun.rows, [{ kind: "line", text: "spin: looping until Stop" }]);

      const next = await run(page, FORMAT5, "Finished format");
      assert.deepEqual(next.result, { ok: true, text: "[\n  5\n]\n" });
      // A fresh instance of the kept module: no fetch, no compile.
      assert.deepEqual(next.phases, ["Instantiate", "Start", "Call"]);
      assert.deepEqual(wasmRequests(watched), ["go/probe.wasm"]);
      // The fresh worker replaced the first: two started, one live.
      assert.equal(watched.workers.length, 2, `two workers: ${watched.workers}`);
      await settles(() => watched.live.size === 1, `one live worker, not ${watched.live.size}`);
    } finally {
      await page.close();
    }
  });

  test("the runner's Stop while idle leaves it ready, the same scenario loaded, with no fetch", async () => {
    const watched = await open();
    const { page } = watched;
    // No demo sends Stop while idle, its Stop unavailable then: the page's runner, every demo's,
    // is stopped directly.
    const stop = () => page.evaluate(`${FORMAT}.runner.stop()`);
    try {
      // Before any Run there is no worker to stop, and Stop starts none.
      await stop();
      assert.deepEqual(goRequests(watched), []);
      assert.deepEqual(watched.workers, []);

      await run(page, FORMAT, "Finished format");
      await stop();
      const format = await run(page, FORMAT5, "Finished format");
      assert.deepEqual(format.result, { ok: true, text: "[\n  5\n]\n" });
      assert.deepEqual(format.phases, ["Instantiate", "Start", "Call"]);

      await run(page, HELLO, HELLO_DONE);
      await stop();
      const hello = await run(page, HELLO, HELLO_DONE);
      assert.match(hello.lines.map(({ text }) => text).join(""), helloLine);
      assert.deepEqual(hello.phases, ["Instantiate", "Run"]);

      assert.deepEqual(wasmRequests(watched), ["go/probe.wasm", "go/hello.wasm"]);
      assert.equal(watched.workers.length, 3, `three workers: ${watched.workers}`);
      await settles(() => watched.live.size === 1, `one live worker, not ${watched.live.size}`);
    } finally {
      await page.close();
    }
  });
});

describe("a Go panic outside any handler", () => {
  test("prints to stderr, exits 2, fails the call, and the next call starts afresh, no fetch", async () => {
    const watched = await open();
    const { page } = watched;
    try {
      const input: string = await page.evaluate(`window.demos.editor(${CRASH}).value`);
      const crashed = await run(page, CRASH, "Failed crash: probe exited with code 2");
      assert.deepEqual(crashed.result, { ok: false, text: "probe exited with code 2" });
      assert.ok(
        crashed.rows.some((row) => row.kind === "exit" && row.text === "probe exited with code 2"),
        JSON.stringify(crashed.rows),
      );
      // The handler's line through os.Stdout, then the runtime's panic through writeSync to fd 2.
      assert.deepEqual(crashed.lines[0], {
        stream: "stdout",
        text: "crash: panicking outside any handler",
      });
      const rest = crashed.lines.slice(1);
      assert.ok(
        rest.length > 0 && rest.every(({ stream }) => stream === "stderr"),
        JSON.stringify(rest),
      );
      const panic = rest.map(({ text }) => text).join("\n");
      assert.ok(
        panic.startsWith(`panic: probe: crash: ${input}\n\ngoroutine `),
        JSON.stringify(panic.slice(0, 120)),
      );
      assert.match(panic, /\ngoroutine \d+ \[running\]:\n/);

      const next = await run(page, FORMAT5, "Finished format");
      assert.deepEqual(next.result, { ok: true, text: "[\n  5\n]\n" });
      assert.deepEqual(next.phases, ["Instantiate", "Start", "Call"]);
      assert.deepEqual(wasmRequests(watched), ["go/probe.wasm"]);
      assert.equal(watched.workers.length, 1, `one worker: ${watched.workers}`);
    } finally {
      await page.close();
    }
  });
});

describe("one request at a time", () => {
  test("a program's Run while spin is pending stops spin first, then loads hello in the fresh worker", async () => {
    const watched = await open();
    const { page } = watched;
    try {
      await spin(page, SPIN);
      const hello = await run(page, HELLO, HELLO_DONE);
      assert.match(hello.lines.map(({ text }) => text).join(""), helloLine);
      assert.deepEqual(hello.phases, ["Fetch", "Wasm compile", "Instantiate", "Run"]);
      assert.equal(await page.evaluate(`window.demos.status(${SPIN})`), "Stopped spin");
      assert.deepEqual((await shown(page, SPIN)).rows, [
        { kind: "line", text: "spin: looping until Stop" },
      ]);
      assert.deepEqual(wasmRequests(watched), ["go/probe.wasm", "go/hello.wasm"]);
      assert.equal(watched.workers.length, 2, `two workers: ${watched.workers}`);
      await settles(() => watched.live.size === 1, `one live worker, not ${watched.live.size}`);
    } finally {
      await page.close();
    }
  });

  test("a program's Run while a load is pending stops the load, which rejects as stopped, then loads and runs hello", async () => {
    const watched = await open();
    const { page } = watched;
    const held = await hold(page);
    try {
      // Format's load waits on probe.wasm, held back.
      const loading = page.evaluate(`${FORMAT}.runner.load("probe").then(
        () => "loaded",
        (error) => error.message,
      )`);
      await settles(() => held.paused.length === 1, "probe.wasm requested and held");
      const hello = await run(page, HELLO, HELLO_DONE);
      assert.equal(await loading, "stopped");
      assert.match(hello.lines.map(({ text }) => text).join(""), helloLine);
      assert.deepEqual(hello.phases, ["Fetch", "Wasm compile", "Instantiate", "Run"]);
      // The stopped load's response, released now, reaches no worker and changes nothing.
      await held.release();
      assert.equal(await page.evaluate(`${FORMAT}.runner.scenario`), "hello");
      assert.deepEqual(wasmRequests(watched), ["go/probe.wasm", "go/hello.wasm"]);
      assert.equal(watched.workers.length, 2, `two workers: ${watched.workers}`);
      await settles(() => watched.live.size === 1, `one live worker, not ${watched.live.size}`);
    } finally {
      await held.release();
      await page.close();
    }
  });

  test("a Run while another demo's load of the same scenario is pending stops it, which, settling, leaves the newer load's scenario", async () => {
    const watched = await open();
    const { page } = watched;
    const held = await hold(page);
    try {
      await pressControl(page, FORMAT, "run");
      await settles(() => held.paused.length === 1, "format's probe.wasm requested and held");
      await pressControl(page, FILES, "run");
      await says(page, FORMAT, "Stopped format");
      await settles(() => held.paused.length === 2, "files' probe.wasm requested and held");
      await held.release();
      await says(page, FILES, "Finished files");
      const files = await shown(page, FILES);
      assert.equal(files.result?.ok, true, JSON.stringify(files.result));
      assert.equal(await page.evaluate(`${FORMAT}.runner.scenario`), "probe");
      // The newer load's module is held: the next call answers on its instance, with no fetch.
      const next = await run(page, FORMAT5, "Finished format");
      assert.deepEqual(next.result, { ok: true, text: "[\n  5\n]\n" });
      assert.deepEqual(next.phases, ["Call"]);
      assert.deepEqual(wasmRequests(watched), ["go/probe.wasm", "go/probe.wasm"]);
      assert.deepEqual((await shown(page, FORMAT)).rows, []);
      assert.equal(watched.workers.length, 2, `two workers: ${watched.workers}`);
      await settles(() => watched.live.size === 1, `one live worker, not ${watched.live.size}`);
    } finally {
      await held.release();
      await page.close();
    }
  });
});
