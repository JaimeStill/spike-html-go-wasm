// The runtime's dedicated worker, which the runner starts on the first load, one per page at a
// time, and again after each Stop: it fetches and compiles a scenario's module, holds the compiled
// WebAssembly.Module, and runs instances of it through wasm_exec.js over the in-memory fs, posting
// each output, exit, and timing event and each request's answer to the runner (protocol.ts).
//
// The in-memory fs installs first (install-fs.ts), then the runtime's committed wasm_exec.js
// evaluates, finds an fs, and never installs its stub. The build bundles both into the worker's
// one script, so the shim always pairs with the worker that loads it.
//
// A load fetches over the HTTP cache (a plain fetch, its default cache mode) and compiles the
// bytes, each phase timed apart, and answers the compiled module, which the runner keeps; loading
// the scenario already held fetches nothing. A load of another scenario drops the instance and
// replaces the held module in place, in this worker. An adopt, the first request a worker started
// by Stop receives, holds the module the runner kept, fetching and compiling nothing.
//
// Two kinds of scenario run on it. A program's main runs to completion: each run instantiates
// afresh from the held module and answers its exit code. A handler scenario's main serves its
// handlers through the bridge (bridge/bridge.go) and blocks, so its instance stays live: the
// first call instantiates and starts it, and every call runs on it until it exits or a load
// drops it. Each instance gets a fresh in-memory fs, so no file or cwd outlives the instance that
// made it.

import "./install-fs.ts";
import "./wasm_exec.js";

import { install, type OutputSink } from "./fs.ts";
import type { Phase, Reply, Request, RunnerEvent } from "./protocol.ts";

/** wasm_exec.js's Go, the members this worker uses: _scheduledTimeouts is the shim's own, the
 * timers that resume Go after a sleep, which a drop clears so a dropped instance never runs
 * again. */
interface Go {
  argv: string[];
  env: Record<string, string>;
  exit: (code: number) => void;
  importObject: WebAssembly.Imports;
  run(instance: WebAssembly.Instance): Promise<void>;
  _scheduledTimeouts: Map<number, ReturnType<typeof setTimeout>>;
}

/** The bridge's global: call answers a Promise of the handler's result as JSON text. */
interface Bridge {
  call(name: string, input: string): Promise<string>;
}

/** The worker's global scope, the members this worker uses. */
interface Scope {
  Go: new () => Go;
  goBridge?: Bridge;
  goBridgeReady?: () => void;
  postMessage(message: Reply): void;
  addEventListener(type: "message", listener: (event: MessageEvent<Request>) => void): void;
}

const scope = globalThis as unknown as Scope;

/** The compiled module of the scenario loaded last, held until another load replaces it. */
let held: { scenario: string; url: string; module: WebAssembly.Module } | undefined;

/** An instance of the held module, live until it exits or is dropped. */
interface Instance {
  scenario: string;
  go: Go;
  /** The exit code, once main returns, calls os.Exit, or panics. */
  code?: number;
  /** The bridge, once a handler scenario's main has registered its handlers. */
  bridge?: Bridge;
  /** The calls still running on the instance, which its exit or drop answers. */
  calls: Map<number, (error: string) => void>;
  dropped: boolean;
}

let live: Instance | undefined;

const post = (reply: Reply) => scope.postMessage(reply);
const emit = (event: RunnerEvent) => post({ type: "event", event });

/** Runs body, posting a timing event for phase once it settles, and answers its result. */
async function timed<T>(scenario: string, phase: Phase, body: () => Promise<T>): Promise<T> {
  const start = performance.now();
  try {
    return await body();
  } finally {
    emit({ type: "timing", scenario, phase, ms: performance.now() - start });
  }
}

/** An output sink posting each write as one event, decoded per fd with a streaming decoder, so a
 * character split between writes arrives whole; muted once its instance is dropped. */
function outputOf(instance: () => Instance | undefined): OutputSink {
  const decoders = { 1: new TextDecoder("utf-8"), 2: new TextDecoder("utf-8") };
  return (fd, bytes) => {
    if (instance()?.dropped) return;
    const text = decoders[fd].decode(bytes, { stream: true });
    if (text !== "") emit({ type: "output", stream: fd === 1 ? "stdout" : "stderr", text });
  };
}

/** Drops the live instance: its running calls fail, its output is muted, its timers are
 * cleared, and its exit, which can no longer come, posts nothing. */
function drop(reason: string) {
  if (!live) return;
  const instance = live;
  live = undefined;
  instance.dropped = true;
  for (const timer of instance.go._scheduledTimeouts.values()) clearTimeout(timer);
  instance.go._scheduledTimeouts.clear();
  for (const fail of instance.calls.values()) fail(reason);
  instance.calls.clear();
}

/** Fetches and compiles the scenario's module and holds it, answering it; answers undefined when
 * it is the one held. */
async function load(scenario: string, url: string): Promise<WebAssembly.Module | undefined> {
  if (held?.scenario === scenario && held.url === url) return undefined;
  drop(`${live?.scenario} was replaced by ${scenario}`);
  held = undefined;
  const bytes = await timed(scenario, "fetch", async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}: ${response.status} ${response.statusText}`);
    return response.arrayBuffer();
  });
  const module = await timed(scenario, "compile", () => WebAssembly.compile(bytes));
  held = { scenario, url, module };
  return module;
}

/** Holds a module compiled before, in another worker, as a load would have: no fetch, no
 * compile, so no timing. */
function adopt(scenario: string, url: string, module: WebAssembly.Module) {
  drop(`${live?.scenario} was replaced by ${scenario}`);
  held = { scenario, url, module };
}

/** Instantiates the held module afresh, over a fresh in-memory fs, and starts its main: answers
 * the instance once main has registered its handlers (ready) or has exited, whichever is first. */
async function start(): Promise<{ instance: Instance; ready: boolean }> {
  if (!held) throw new Error("no scenario is loaded");
  const { scenario, module } = held;
  drop(`${scenario} restarted`);
  const instance: Instance = {
    scenario,
    go: new scope.Go(),
    calls: new Map(),
    dropped: false,
  };
  live = instance;
  // Before the instance starts: Go's syscall package reads globalThis.fs once, at its init, and
  // wasm_exec.js's writeSync reads it on each write.
  install(
    globalThis as unknown as Record<string, unknown>,
    outputOf(() => instance),
  );
  const { go } = instance;
  go.argv = [scenario];
  const wasm = await timed(scenario, "instantiate", () =>
    WebAssembly.instantiate(module, go.importObject),
  );

  const end = (reason: string) => {
    if (live === instance) live = undefined;
    for (const fail of instance.calls.values()) fail(reason);
    instance.calls.clear();
  };
  go.exit = (code) => {
    instance.code = code;
    if (instance.dropped) return;
    emit({ type: "exit", scenario, code });
    end(`${scenario} exited with code ${code}`);
  };

  delete scope.goBridge;
  const ready = new Promise<true>((resolve) => {
    scope.goBridgeReady = () => resolve(true);
  });
  const started = performance.now();
  // go.run settles after go.exit, or rejects on a trap, which ends the instance too; main runs
  // inside it until it blocks.
  const ran = go.run(wasm).then(
    () => false as const,
    (error: unknown) => {
      end(`${scenario} trapped: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    },
  );
  // A trap after the handlers are ready fails the calls running, not the start.
  ran.catch(() => {});
  const first = await Promise.race([ready, ran]);
  delete scope.goBridgeReady;
  if (first) {
    instance.bridge = scope.goBridge;
    emit({ type: "timing", scenario, phase: "start", ms: performance.now() - started });
  } else {
    emit({ type: "timing", scenario, phase: "run", ms: performance.now() - started });
  }
  return { instance, ready: first };
}

/** Runs the held program's main afresh, answering its exit code. A scenario that serves
 * handlers instead stays live, and the run fails naming them. */
async function runProgram(): Promise<number> {
  const { instance, ready } = await start();
  if (ready) {
    throw new Error(`${instance.scenario} serves handlers; run one of them by name`);
  }
  return instance.code ?? 0;
}

/** The live handler instance of the held scenario, started when there is none. */
async function serving(): Promise<Instance> {
  if (live?.bridge && live.scenario === held?.scenario) return live;
  const { instance, ready } = await start();
  if (!ready) {
    throw new Error(`${instance.scenario} exited with code ${instance.code} serving no handlers`);
  }
  return instance;
}

/** Calls handler on instance, answering its parsed result, or failing with its error. */
async function call(instance: Instance, id: number, handler: string, input: string) {
  const { scenario, bridge, calls } = instance;
  // The call fails at once when its instance exits or is dropped first, since Go never settles
  // it then.
  const ended = new Promise<never>((_, reject) => {
    calls.set(id, (error) => reject(new Error(error)));
  });
  try {
    const text = await timed(scenario, "call", () => {
      // The call can throw rather than reject: when Go exits during it, a panic in a goroutine
      // it started, wasm_exec.js drops its instance while the call is still on the stack, and its
      // next step throws a TypeError. By then the exit has failed ended, which goes first in the
      // race, so the call fails with the exit's reason.
      const answer = (async () => bridge!.call(handler, input))();
      return Promise.race([ended, answer]);
    });
    return JSON.parse(text) as unknown;
  } finally {
    calls.delete(id);
  }
}

/** The requests' order: each load, each program run, and each call's start wait for the one
 * before them, so a run follows the load before it; a call, once its instance is serving, runs
 * beside later requests, as the bridge runs each call in its own goroutine. */
let queue: Promise<unknown> = Promise.resolve();

function handle(request: Request): Promise<unknown> {
  let step: Promise<unknown>;
  if (request.op === "load") {
    step = queue.then(() => load(request.scenario, request.url));
  } else if (request.op === "adopt") {
    const { scenario, url, module } = request;
    step = queue.then(() => adopt(scenario, url, module));
  } else if (request.handler === undefined) {
    step = queue.then(runProgram);
  } else {
    const { id, handler, input } = request;
    const instance = queue.then(serving);
    queue = instance.catch(() => {});
    return instance.then((serving) => call(serving, id, handler, input));
  }
  queue = step.catch(() => {});
  return step;
}

scope.addEventListener("message", ({ data: request }) => {
  handle(request).then(
    (value) => post({ type: "settled", id: request.id, ok: true, value }),
    (error: unknown) =>
      post({
        type: "settled",
        id: request.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
  );
});
