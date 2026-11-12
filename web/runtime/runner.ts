// The runtime's runner, the page's one handle on Go: it loads a scenario's module by name, runs a
// program or calls a handler, and stops, and it hands every output, exit, and timing event to its
// listeners (protocol.ts). The work happens in one dedicated worker (worker.ts), which the runner
// starts on its first load, so a page that never runs Go requests no worker script and no .wasm.
// A page holds one runner, and the runner never holds more than one worker.
//
// The runner runs one load or run at a time. Output events name no caller, so a load or run
// started while another is pending first stops the pending one, which rejects with "stopped", and
// then proceeds: every event between a request's start and its settling belongs to that request,
// and several callers can share one runner, each attributing the events to its own request.
//
// The worker answers each load with the compiled WebAssembly.Module, and the runner keeps it. Stop
// is the one way to end Go that never yields (GOMAXPROCS is 1 under js, and nothing preempts a
// busy loop): it terminates the worker, starts a fresh one, and posts it the kept module, so the
// next run instantiates at once, with no fetch and no compile.
//
// A scenario is a Go entrypoint the build writes to <base>go/<name>.wasm, the base the site's,
// which Vite gives as import.meta.env.BASE_URL. Loading another scenario replaces the one before
// in place, in the same worker; loading the one held is a no-op.

import type { Reply, Request, RunnerEvent } from "./protocol.ts";

export type {
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
  /** Every request posted and not yet answered, by id; op tells a caller's load or run from the
   * adopt a Stop posts itself. */
  #pending = new Map<
    number,
    { op: Body["op"]; resolve(value: unknown): void; reject(error: Error): void }
  >();
  #listeners = new Set<Listener>();
  #lastId = 0;
  /** How many loads have started: a load settling after a later one started, the one that stopped
   * it, leaves the later one's scenario alone. */
  #loads = 0;
  #scenario: string | undefined;
  /** The compiled module of the scenario loaded, as the worker answered its load. */
  #held: { scenario: string; url: string; module: WebAssembly.Module } | undefined;
  /** The directory holding the scenarios' modules, absolute, so the worker resolves nothing. */
  readonly #modules: URL;

  /** modules: the directory holding <name>.wasm, by default go/ under the site's base. */
  constructor(modules: string | URL = new URL(`${import.meta.env.BASE_URL}go/`, location.href)) {
    this.#modules = new URL(modules, location.href);
  }

  /** The scenario loaded last, or undefined before the first load and after a failed one, or a
   * stop during one. */
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
    if (scenario === this.#scenario) return;
    const url = new URL(`${encodeURIComponent(scenario)}.wasm`, this.#modules).href;
    const load = ++this.#loads;
    this.#scenario = scenario;
    this.#held = undefined;
    try {
      const module = await this.#send({ op: "load", scenario, url });
      if (
        module instanceof WebAssembly.Module &&
        this.#loads === load &&
        this.#scenario === scenario
      ) {
        this.#held = { scenario, url, module };
      }
    } catch (error) {
      if (this.#loads === load && this.#scenario === scenario) this.#scenario = undefined;
      throw error;
    }
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

  /** Ends whatever runs by terminating the worker: every pending load and run rejects with
   * "stopped", and the instance, its files, and its handlers are gone. When a scenario is loaded,
   * a fresh worker starts at once with the kept module, so the scenario stays loaded and the next
   * run instantiates afresh, with no fetch and no compile; stopping during a load leaves none
   * loaded, and the next load fetches. Stopping while nothing runs rejects nothing and leaves the
   * runner ready with the same scenario; an idle handler instance goes with its worker. */
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
    if (!held) return;
    const { scenario, url, module } = held;
    const fresh = this.#start();
    // The adopt is the fresh worker's first request, so every later one follows it. Should it
    // fail, the worker holds nothing, and the next load fetches afresh; a later Stop's rejection
    // of it changes nothing, since that Stop has started a worker of its own.
    this.#send({ op: "adopt", scenario, url, module }).catch(() => {
      if (this.#worker === fresh && this.#held === held) {
        this.#held = this.#scenario = undefined;
      }
    });
  }

  /** Stops the pending load or run, if any, so the request about to start runs alone. A Stop's
   * own adopt is no caller's: it stays, and the request queues behind it in the fresh worker. */
  #preempt() {
    for (const { op } of this.#pending.values()) {
      if (op !== "adopt") return this.#stop();
    }
  }

  #send(body: Body): Promise<unknown> {
    const id = ++this.#lastId;
    const worker = this.#start();
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { op: body.op, resolve, reject });
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
    const pending = this.#pending.get(reply.id);
    this.#pending.delete(reply.id);
    if (reply.ok) pending?.resolve(reply.value);
    else pending?.reject(new Error(reply.error));
  }
}
