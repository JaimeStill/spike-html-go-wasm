// The runtime in the browser: the build as Pages serves it, dist/ under the base by the SDK's
// served(), Vite's preview, in the pinned chrome-headless-shell. The modules answer as
// application/wasm; neither page requests Go on load; and on the runtime page, its Run buttons
// drive the runner, whose events the page writes out (web/pages/runtime.ts): hello's line and
// exit, format's answer, its line, and its parse error, files' steps, each run's timings by phase,
// a held module reused without a fetch, and scenarios switched in place in one worker. Then Stop:
// it ends spin's busy loop, and after it, or after crash's panic ends the instance, the next call
// answers from the module the runner kept, with no new .wasm request, and the page never has more
// than one live worker.
//
// The worker fetches the modules itself, and the page's own Network domain never sees a worker's
// requests, so each page auto-attaches to its workers through the page's session, in the protocol's
// non-flat mode, whose messages travel inside Target events on that session: each worker attached
// is counted, live until it detaches, waits for the debugger until its Network domain is on, and
// reports every request it sends. Nothing here names the site: its base is package.json's name.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

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

/** A page under watch: every request it and its workers send, by URL, each worker it started,
 * by its script's URL, and the workers still live, by their sessions. */
interface Watched {
  page: Page;
  requests: string[];
  workers: string[];
  live: Set<string>;
}

/** Opens path under the base with its requests and workers watched from before it loads. */
async function watch(path: string): Promise<Watched> {
  const page = await browser.open("about:blank");
  const watched: Watched = { page, requests: [], workers: [], live: new Set() };
  let lastId = 0;
  page.on("Target.attachedToTarget", ({ sessionId, targetInfo }) => {
    watched.workers.push(targetInfo.url);
    watched.live.add(sessionId);
    const send = (method: string) =>
      page.cdp("Target.sendMessageToTarget", {
        sessionId,
        message: JSON.stringify({ id: ++lastId, method, params: {} }),
      });
    // The worker waits until its Network domain is on, so its first fetch is seen.
    void send("Network.enable").then(() => send("Runtime.runIfWaitingForDebugger"));
  });
  // A terminated worker detaches.
  page.on("Target.detachedFromTarget", ({ sessionId }) => watched.live.delete(sessionId));
  page.on("Target.receivedMessageFromTarget", ({ message }) => {
    const { method, params } = JSON.parse(message);
    if (method === "Network.requestWillBeSent") watched.requests.push(params.request.url);
  });
  page.on("Network.requestWillBeSent", ({ request }) => watched.requests.push(request.url));
  await page.cdp("Network.enable");
  await page.cdp("Target.setAutoAttach", {
    autoAttach: true,
    waitForDebuggerOnStart: true,
    flatten: false,
  });
  await page.goto(`${server.origin}${path}`);
  return watched;
}

/** The requests for a .wasm module, a worker's script, or wasm_exec.js, by path under the base. */
const goRequests = ({ requests }: Watched) =>
  requests
    .filter((url) => /\.wasm$|\/worker-[^/]*\.js$|wasm_exec/.test(new URL(url).pathname))
    .map((url) => url.slice(server.origin.length).replace(/-[\w-]+\.js$/, ".js"));

/** What the runtime page shows after a Run. */
interface Shown {
  output: { stream: string; text: string }[];
  result: { state: string | undefined; text: string };
  exit: number | undefined;
  phases: string[];
}

/** The .wasm modules requested, by path under the base. */
const wasmRequests = (watched: Watched) =>
  goRequests(watched).filter((path) => path.endsWith(".wasm"));

/** Clicks the Run button for scenario and handler, a program's when handler is undefined, with
 * input in the page's input when given, and answers at once; the click sets the status busy
 * before it returns. */
async function start(
  { page }: Watched,
  scenario: string,
  handler?: string,
  input?: string,
): Promise<void> {
  const selector = handler
    ? `button[data-scenario="${scenario}"][data-handler="${handler}"]`
    : `button[data-scenario="${scenario}"]:not([data-handler])`;
  await page.evaluate(`(() => {
    ${input === undefined ? "" : `document.querySelector("#input").value = ${JSON.stringify(input)};`}
    document.querySelector(${JSON.stringify(selector)}).click();
  })()`);
}

/** Clicks the page's Stop. The runner terminates its worker and starts the fresh one before the
 * click returns. */
async function stop({ page }: Watched): Promise<void> {
  await page.evaluate(`document.querySelector("#stop").click()`);
}

/** Waits, in node, until check holds, failing naming what after timeout ms. */
async function settles(check: () => boolean, what: string, timeout = 10_000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/** Runs what start runs, and answers what the page shows once the run ends. */
async function run(
  watched: Watched,
  scenario: string,
  handler?: string,
  input?: string,
): Promise<Shown> {
  await start(watched, scenario, handler, input);
  return shown(watched);
}

/** Waits for the run started last to end, and answers what the page shows. */
async function shown({ page }: Watched): Promise<Shown> {
  await until(page, `document.querySelector("#status").dataset.state === "idle"`);
  return page.evaluate(`({
    output: [...document.querySelectorAll("#output > span")].map((span) => ({
      stream: span.dataset.stream,
      text: span.textContent,
    })),
    result: {
      state: document.querySelector("#result").dataset.state,
      text: document.querySelector("#result").textContent,
    },
    exit: document.querySelector("#exit").dataset.code === undefined
      ? undefined
      : Number(document.querySelector("#exit").dataset.code),
    phases: [...document.querySelectorAll("#timings > tr")].map((row) => row.dataset.phase),
  })`);
}

const helloLine = /^hello from Go go1\.\d+\.\d+ on js\/wasm\n$/;

describe("the Go modules under the base", () => {
  for (const name of ["hello", "probe"]) {
    test(`${name}.wasm answers 200 as application/wasm`, async () => {
      const response = await fetch(new URL(`go/${name}.wasm`, server.origin));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "application/wasm");
      const bytes = new Uint8Array(await response.arrayBuffer());
      // The wasm magic number, \0asm.
      assert.deepEqual([...bytes.subarray(0, 4)], [0x00, 0x61, 0x73, 0x6d]);
    });
  }

  for (const [name, path] of [
    ["the index", ""],
    ["the runtime page", "runtime.html"],
  ]) {
    test(`${name} requests no .wasm and no worker on load`, async () => {
      const watched = await watch(path);
      try {
        assert.ok(watched.requests.length > 0, "the page's own requests were seen");
        assert.deepEqual(goRequests(watched), []);
        assert.deepEqual(watched.workers, []);
      } finally {
        await watched.page.close();
      }
    });
  }
});

describe("the runtime page", () => {
  test("hello prints its line as stdout and exits 0, in the worker the first run starts", async () => {
    const watched = await watch("runtime.html");
    try {
      const shown = await run(watched, "hello");
      assert.equal(shown.output.length, 1, JSON.stringify(shown.output));
      assert.equal(shown.output[0].stream, "stdout");
      assert.match(shown.output[0].text, helloLine);
      assert.equal(shown.exit, 0);
      assert.deepEqual(shown.result, { state: "resolved", text: "0" });
      // The worker bundles wasm_exec.js: no request names it.
      assert.deepEqual(goRequests(watched), ["assets/worker.js", "go/hello.wasm"]);
      assert.equal(watched.workers.length, 1);
    } finally {
      await watched.page.close();
    }
  });

  test("each run's timings name its phases: a program's run, a handler's start and call", async () => {
    const watched = await watch("runtime.html");
    try {
      assert.deepEqual((await run(watched, "hello")).phases, [
        "fetch",
        "compile",
        "instantiate",
        "run",
      ]);
      assert.deepEqual((await run(watched, "probe", "format", "[1]")).phases, [
        "fetch",
        "compile",
        "instantiate",
        "start",
        "call",
      ]);
      const ms: number[] = await watched.page.evaluate(
        `[...document.querySelectorAll("#timings > tr > td")].map((cell) => Number(cell.textContent))`,
      );
      assert.ok(
        ms.length === 5 && ms.every((value) => Number.isFinite(value) && value >= 0),
        `each phase's time is a duration: ${ms}`,
      );
    } finally {
      await watched.page.close();
    }
  });

  test("format answers the input indented, and prints one stdout line", async () => {
    const watched = await watch("runtime.html");
    try {
      const input = '{"a":[1,2],"b":{"c":"d"}}';
      const indented = JSON.stringify(JSON.parse(input), null, 2);
      const shown = await run(watched, "probe", "format", input);
      assert.deepEqual(shown.result, { state: "resolved", text: indented });
      assert.deepEqual(shown.output, [
        {
          stream: "stdout",
          text: `format: ${input.length} bytes in, ${indented.length} bytes out\n`,
        },
      ]);
      assert.equal(shown.exit, undefined, "probe's instance stays live");
    } finally {
      await watched.page.close();
    }
  });

  test("format's parse error rejects the run with its message", async () => {
    const watched = await watch("runtime.html");
    try {
      const shown = await run(watched, "probe", "format", '{"a":');
      assert.equal(shown.result.state, "rejected");
      assert.equal(shown.result.text, "format: unexpected end of JSON input");
      assert.deepEqual(shown.output, []);
      // The instance outlives the rejection: the next call answers on it.
      const next = await run(watched, "probe", "format", "[]");
      assert.deepEqual(next.result, { state: "resolved", text: "[]" });
      assert.deepEqual(next.phases, ["call"]);
    } finally {
      await watched.page.close();
    }
  });

  test("files works through the in-memory fs and reports each step", async () => {
    const watched = await watch("runtime.html");
    try {
      const input = "hello, files";
      const shown = await run(watched, "probe", "files", input);
      assert.equal(shown.result.state, "resolved", shown.result.text);
      const { dir, steps } = JSON.parse(shown.result.text);
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
      assert.deepEqual(shown.output, [{ stream: "stdout", text: `files: 6 steps in ${dir}\n` }]);
    } finally {
      await watched.page.close();
    }
  });

  test("a second run reuses the held module: probe's call alone, hello afresh, no fetch", async () => {
    const watched = await watch("runtime.html");
    try {
      await run(watched, "probe", "format", "[1]");
      const again = await run(watched, "probe", "files", "x");
      assert.equal(again.result.state, "resolved", again.result.text);
      assert.deepEqual(again.phases, ["call"]);
      assert.deepEqual(goRequests(watched), ["assets/worker.js", "go/probe.wasm"]);

      const first = await run(watched, "hello");
      const second = await run(watched, "hello");
      assert.deepEqual(first.phases, ["fetch", "compile", "instantiate", "run"]);
      // A program's exit ends its instance; the next run instantiates the held module afresh.
      assert.deepEqual(second.phases, ["instantiate", "run"]);
      assert.equal(second.exit, 0);
      assert.match(second.output.map(({ text }) => text).join(""), helloLine);
      assert.deepEqual(goRequests(watched), ["assets/worker.js", "go/probe.wasm", "go/hello.wasm"]);
    } finally {
      await watched.page.close();
    }
  });

  test("switching probe → hello → probe happens in place, in the one worker", async () => {
    const watched = await watch("runtime.html");
    try {
      assert.equal((await run(watched, "probe", "format", "[1]")).result.state, "resolved");
      const hello = await run(watched, "hello");
      assert.equal(hello.exit, 0);
      const probe = await run(watched, "probe", "format", "[2]");
      assert.deepEqual(probe.result, { state: "resolved", text: "[\n  2\n]" });
      // probe's module is fetched again, over the HTTP cache, since the switch to hello replaced
      // it; its instance starts afresh.
      assert.deepEqual(probe.phases, ["fetch", "compile", "instantiate", "start", "call"]);
      assert.deepEqual(goRequests(watched), [
        "assets/worker.js",
        "go/probe.wasm",
        "go/hello.wasm",
        "go/probe.wasm",
      ]);
      assert.equal(watched.workers.length, 1, `one worker: ${watched.workers}`);
    } finally {
      await watched.page.close();
    }
  });
});

describe("Stop", () => {
  test("ends spin's busy loop, and the next format answers from the kept module, no fetch", async () => {
    const watched = await watch("runtime.html");
    try {
      await start(watched, "probe", "spin");
      await until(
        watched.page,
        `document.querySelector("#output").textContent === "spin: looping until Stop\\n"`,
      );
      // The loop holds the worker: the call stays pending, however long the page waits.
      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.equal(
        await watched.page.evaluate(`document.querySelector("#status").dataset.state`),
        "busy",
      );
      await stop(watched);
      const spun = await shown(watched);
      assert.deepEqual(spun.result, { state: "rejected", text: "stopped" });
      // spin's call never answered, so it posted no call timing.
      assert.deepEqual(spun.phases, ["fetch", "compile", "instantiate", "start"]);
      assert.equal(spun.exit, undefined);

      const next = await run(watched, "probe", "format", "[3]");
      assert.deepEqual(next.result, { state: "resolved", text: "[\n  3\n]" });
      // A fresh instance of the kept module: no fetch, no compile.
      assert.deepEqual(next.phases, ["instantiate", "start", "call"]);
      assert.deepEqual(wasmRequests(watched), ["go/probe.wasm"]);
      // The fresh worker replaced the first: two started, one live.
      assert.equal(watched.workers.length, 2, `two workers: ${watched.workers}`);
      await settles(() => watched.live.size === 1, `one live worker, not ${watched.live.size}`);
    } finally {
      await watched.page.close();
    }
  });

  test("while idle leaves the runner ready, the same scenario loaded, with no fetch", async () => {
    const watched = await watch("runtime.html");
    try {
      // Before any Run there is no worker to stop, and Stop starts none.
      await stop(watched);
      assert.deepEqual(goRequests(watched), []);
      assert.deepEqual(watched.workers, []);

      assert.equal((await run(watched, "probe", "format", "[1]")).result.state, "resolved");
      await stop(watched);
      const format = await run(watched, "probe", "format", "[2]");
      assert.deepEqual(format.result, { state: "resolved", text: "[\n  2\n]" });
      assert.deepEqual(format.phases, ["instantiate", "start", "call"]);

      assert.equal((await run(watched, "hello")).exit, 0);
      await stop(watched);
      const hello = await run(watched, "hello");
      assert.equal(hello.exit, 0);
      assert.match(hello.output.map(({ text }) => text).join(""), helloLine);
      assert.deepEqual(hello.phases, ["instantiate", "run"]);

      assert.deepEqual(wasmRequests(watched), ["go/probe.wasm", "go/hello.wasm"]);
      assert.equal(watched.workers.length, 3, `three workers: ${watched.workers}`);
      await settles(() => watched.live.size === 1, `one live worker, not ${watched.live.size}`);
    } finally {
      await watched.page.close();
    }
  });
});

describe("a Go panic outside any handler", () => {
  test("prints to stderr, exits 2, fails the call, and the next call starts afresh, no fetch", async () => {
    const watched = await watch("runtime.html");
    try {
      const crashed = await run(watched, "probe", "crash", "boom");
      assert.deepEqual(crashed.result, { state: "rejected", text: "probe exited with code 2" });
      assert.equal(crashed.exit, 2);
      // The handler's line through os.Stdout, then the runtime's panic through writeSync to fd 2.
      assert.deepEqual(crashed.output[0], {
        stream: "stdout",
        text: "crash: panicking outside any handler\n",
      });
      const rest = crashed.output.slice(1);
      assert.ok(
        rest.length > 0 && rest.every(({ stream }) => stream === "stderr"),
        JSON.stringify(rest),
      );
      assert.match(
        rest.map(({ text }) => text).join(""),
        /^panic: probe: crash: boom\n\ngoroutine \d+ \[running\]:\n/,
      );

      const next = await run(watched, "probe", "format", "[4]");
      assert.deepEqual(next.result, { state: "resolved", text: "[\n  4\n]" });
      assert.deepEqual(next.phases, ["instantiate", "start", "call"]);
      assert.deepEqual(wasmRequests(watched), ["go/probe.wasm"]);
      assert.equal(watched.workers.length, 1, `one worker: ${watched.workers}`);
    } finally {
      await watched.page.close();
    }
  });
});
