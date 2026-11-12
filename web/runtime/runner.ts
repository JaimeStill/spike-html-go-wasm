// The runtime's runner, the page's one handle on Go: it loads a scenario's module by name, or
// builds a program from its files, runs a program or calls a handler, and stops, and it hands
// every output, exit, and timing event to its listeners (protocol.ts). The work happens in one
// dedicated worker (worker.ts), which the runner starts on its first load or build, so a page that
// never runs Go requests no worker script and no .wasm. A page holds one runner, and the runner
// never holds more than one worker.
//
// The runner runs one load, build, or run at a time. Output events name no caller, so a request
// started while another is pending first stops the pending one, which rejects with "stopped", and
// then proceeds: every event between a request's start and its settling belongs to that request,
// and several callers can share one runner, each attributing the events to its own request.
//
// The worker answers each load and build with the compiled WebAssembly.Module, and posts the
// toolchain's compiled modules as a build compiles them; the runner keeps them all. Stop is the
// one way to end Go that never yields (GOMAXPROCS is 1 under js, and nothing preempts a busy
// loop): it terminates the worker, starts a fresh one, and posts it the kept modules, so the next
// run instantiates at once, and the next build fetches and compiles no toolchain module. A build
// whose .go files are the last successful build's holds its program again, by the same adopt,
// with no fetch, compile, or link, and with the build's own non-Go files, which only the run
// reads: editing input.txt alone builds nothing.
//
// A built program is held as the scenario "main" (BUILT_SCENARIO), under a URL no load's module
// has, so a load always replaces it, and a build always replaces a loaded scenario.
//
// A scenario is a Go entrypoint the build writes to <base>go/<name>.wasm, the base the site's,
// which Vite gives as import.meta.env.BASE_URL. Loading another scenario replaces the one before
// in place, in the same worker; loading the one held is a no-op.

import { isGo } from "./build.ts";
import {
  BUILT_SCENARIO,
  BUILT_URL,
  type BuildFile,
  type HeldProgram,
  type HeldTool,
  type Reply,
  type Request,
  type RunnerEvent,
} from "./protocol.ts";

export type {
  BuildFile,
  ExitEvent,
  OutputEvent,
  Phase,
  RunnerEvent,
  Stream,
  TimingEvent,
} from "./protocol.ts";

/** Called with each event, in the order the worker posted them. */
export type Listener = (event: RunnerEvent) => void;

/** A request without its id, which sending adds: Omit over each member of the union. */
type Body = Request extends infer R ? (R extends unknown ? Omit<R, "id"> : never) : never;

export class Runner {
  #worker: Worker | undefined;
  /** Every request posted and not yet answered, by id; stop tells the adopt a Stop posts itself
   * from a caller's request, a build's adopt of the program it built last among them. */
  #pending = new Map<
    number,
    { stop: boolean; resolve(value: unknown): void; reject(error: Error): void }
  >();
  #listeners = new Set<Listener>();
  #lastId = 0;
  /** How many loads and builds have started: one settling after a later one started, the one
   * that stopped it, leaves the later one's scenario alone. */
  #loads = 0;
  #scenario: string | undefined;
  /** The URL of the module loaded, or BUILT_URL for a built program, with #scenario. */
  #url: string | undefined;
  /** The compiled module of the scenario loaded or built, as the worker answered it. */
  #held: HeldProgram | undefined;
  /** The last successful build's program, and its .go files as one key. */
  #built: { key: string; program: HeldProgram } | undefined;
  /** The toolchain's compiled modules, as the worker last posted them. */
  #tools: HeldTool[] = [];
  /** The directory holding the scenarios' modules, absolute, so the worker resolves nothing. */
  readonly #modules: URL;

  /** modules: the directory holding <name>.wasm and toolchain/manifest.json, by default go/ under
   * the site's base. */
  constructor(modules: string | URL = new URL(`${import.meta.env.BASE_URL}go/`, location.href)) {
    this.#modules = new URL(modules, location.href);
  }

  /** The scenario loaded last, "main" for a built program, or undefined before the first load or
   * build and after a failed one, or a stop during one. */
  get scenario(): string | undefined {
    return this.#scenario;
  }

  /** Adds listener for every event; answers the function that removes it. */
  listen(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Loads the scenario's module by name, fetched over the HTTP cache and compiled in the worker,
   * dropping the scenario before it; resolves at once when it is the one loaded and nothing is
   * pending. Stops a pending load or run first, as Stop does. Starts the worker on the first
   * load. */
  async load(scenario: string): Promise<void> {
    this.#preempt();
    const url = new URL(`${encodeURIComponent(scenario)}.wasm`, this.#modules).href;
    if (scenario === this.#scenario && url === this.#url) return;
    const load = this.#begin(scenario, url);
    try {
      const module = await this.#send({ op: "load", scenario, url });
      if (module instanceof WebAssembly.Module && this.#loads === load) {
        this.#held = { scenario, url, module };
      }
    } catch (error) {
      this.#failed(load);
      throw error;
    }
  }

  /**
   * Builds a program from its files and holds it as the loaded scenario, "main", so the next run
   * runs its main to its exit, over a working directory holding every file that isn't Go. Every
   * .go file is compiled as package main, against the standard library and the site's pinned
   * modules' packages, as the manifest holds them, and linked.
   *
   * In the worker: the toolchain's manifest, revalidated; the compiler, the linker, and the
   * imports' closure of archives the worker doesn't hold yet, fetched; then compile and link, each
   * its own phase, the compiler's or the linker's output the build's output events. A failed step
   * posts its exit, an exit event naming the step, and rejects naming it ("compile exited with code
   * 1"); an import the manifest doesn't hold rejects before the compiler runs, naming the package.
   * A failed build holds nothing, and a run after it finds no scenario loaded.
   *
   * .go files identical to the last successful build's, the same names and texts in the same
   * order, hold that program again, fetching, compiling, and linking nothing, whatever the non-Go
   * files are: the program held carries this build's files, so each run's working directory holds
   * the non-Go files as given here. Stops a pending load,
   * build, or run first, as Stop does. Starts the worker on the first request.
   */
  async build(files: readonly BuildFile[]): Promise<void> {
    this.#preempt();
    const given = files.map(({ name, text }) => ({ name, text }));
    // Only the .go files reach the compiler and the linker; the rest reach only the run.
    const key = JSON.stringify(given.filter(isGo));
    const load = this.#begin(BUILT_SCENARIO, BUILT_URL);
    const built = this.#built;
    try {
      if (built?.key === key) {
        const program = { ...built.program, files: given };
        await this.#send({ op: "adopt", program, tools: [] });
        if (this.#loads === load) {
          this.#held = program;
          this.#built = { key, program };
        }
        return;
      }
      const manifest = new URL("toolchain/manifest.json", this.#modules).href;
      const module = await this.#send({ op: "build", manifest, files: given });
      if (module instanceof WebAssembly.Module && this.#loads === load) {
        const program = { scenario: BUILT_SCENARIO, url: BUILT_URL, module, files: given };
        this.#held = program;
        this.#built = { key, program };
      }
    } catch (error) {
      this.#failed(load);
      throw error;
    }
  }

  /** Begins a load or build of the scenario at url, dropping the one held; answers its number. */
  #begin(scenario: string, url: string): number {
    this.#scenario = scenario;
    this.#url = url;
    this.#held = undefined;
    return ++this.#loads;
  }

  /** A load or build failed: the runner holds no scenario, unless a later one has begun. */
  #failed(load: number) {
    if (this.#loads === load) this.#scenario = this.#url = undefined;
  }

  /** With no handler, runs the loaded program's main afresh to its exit, resolving with its exit
   * code. With one, calls that handler of the loaded scenario's live instance, starting it first
   * when it has none, and resolves with the handler's parsed JSON result, or rejects with its
   * error's message. Stops a pending load or run first, as Stop does, so a run started during a
   * load finds no scenario loaded. */
  run(handler?: string, input = ""): Promise<unknown> {
    this.#preempt();
    if (this.#scenario === undefined) {
      return Promise.reject(new Error("no scenario is loaded; load one first"));
    }
    return this.#send({ op: "run", handler, input });
  }

  /** Ends whatever runs by terminating the worker: every pending load, build, and run rejects with
   * "stopped", and the instance, its files, and its handlers are gone. When a scenario is loaded
   * or built, or a build has compiled the toolchain, a fresh worker starts at once with the kept
   * modules, so the scenario stays loaded and the next run instantiates afresh, with no fetch and
   * no compile, and the next build compiles no toolchain module; stopping during a load or build
   * leaves none loaded, and the next load fetches. Stopping while nothing runs rejects nothing and
   * leaves the runner ready with the same scenario; an idle handler instance goes with its
   * worker. */
  async stop(): Promise<void> {
    this.#stop();
  }

  /** Stop's work, done before the caller's next line, which load and run rely on. */
  #stop() {
    const worker = this.#worker;
    if (!worker) return;
    // The old worker goes first, so the page never has two.
    worker.terminate();
    this.#worker = undefined;
    for (const { reject } of this.#pending.values()) reject(new Error("stopped"));
    this.#pending.clear();
    const held = this.#held;
    this.#scenario = held?.scenario;
    this.#url = held?.url;
    const tools = this.#tools;
    if (!held && tools.length === 0) return;
    const fresh = this.#start();
    // The adopt is the fresh worker's first request, so every later one follows it. Should it
    // fail, the worker holds nothing, and the next load fetches afresh; a later Stop's rejection
    // of it changes nothing, since that Stop has started a worker of its own.
    this.#send({ op: "adopt", program: held, tools }, true).catch(() => {
      if (this.#worker === fresh && this.#held === held) {
        this.#held = this.#scenario = this.#url = undefined;
      }
      if (this.#worker === fresh && this.#tools === tools) this.#tools = [];
    });
  }

  /** Stops the pending load, build, or run, if any, so the request about to start runs alone. A
   * Stop's own adopt is no caller's: it stays, and the request queues behind it in the fresh
   * worker. */
  #preempt() {
    for (const { stop } of this.#pending.values()) {
      if (!stop) return this.#stop();
    }
  }

  /** Posts the request, answering its value; stop marks the adopt a Stop posts itself. */
  #send(body: Body, stop = false): Promise<unknown> {
    const id = ++this.#lastId;
    const worker = this.#start();
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { stop, resolve, reject });
      worker.postMessage({ ...body, id } satisfies Request);
    });
  }

  /** The worker, started on first use: an ES module worker the build bundles from worker.ts. */
  #start(): Worker {
    if (this.#worker) return this.#worker;
    const worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
      name: "go-runtime",
    });
    worker.addEventListener("message", ({ data }: MessageEvent<Reply>) => {
      this.#receive(data);
    });
    worker.addEventListener("error", (event) => {
      // An uncaught error in the worker: every pending request fails with it.
      const error = new Error(event.message || "the Go runtime's worker failed");
      for (const { reject } of this.#pending.values()) reject(error);
      this.#pending.clear();
    });
    this.#worker = worker;
    return worker;
  }

  #receive(reply: Reply) {
    if (reply.type === "event") {
      for (const listener of this.#listeners) listener(reply.event);
      return;
    }
    if (reply.type === "tools") {
      this.#tools = reply.tools;
      return;
    }
    const pending = this.#pending.get(reply.id);
    this.#pending.delete(reply.id);
    if (reply.ok) pending?.resolve(reply.value);
    else pending?.reject(new Error(reply.error));
  }
}
