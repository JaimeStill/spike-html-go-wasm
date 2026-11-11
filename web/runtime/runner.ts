// The runtime's runner, the page's one handle on Go: it loads a scenario's module by name, runs a
// program or calls a handler, and stops, and it hands every output, exit, and timing event to its
// listeners (protocol.ts). The work happens in one dedicated worker (worker.ts), which the runner
// starts on its first load, so a page that never runs Go requests no worker script and no .wasm.
// A page holds one runner, and the runner never holds more than one worker.
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
  #pending = new Map<number, { resolve(value: unknown): void; reject(error: Error): void }>();
  #listeners = new Set<Listener>();
  #lastId = 0;
  #scenario: string | undefined;
  /** The directory holding the scenarios' modules, absolute, so the worker resolves nothing. */
  readonly #modules: URL;

  /** modules: the directory holding <name>.wasm, by default go/ under the site's base. */
  constructor(modules: string | URL = new URL(`${import.meta.env.BASE_URL}go/`, location.href)) {
    this.#modules = new URL(modules, location.href);
  }

  /** The scenario loaded last, or undefined before the first load and after a stop. */
  get scenario(): string | undefined {
    return this.#scenario;
  }

  /** Adds listener for every event; answers the function that removes it. */
  listen(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Loads the scenario's module by name, fetched over the HTTP cache and compiled in the worker,
   * dropping the scenario before it; resolves at once when it is the one loaded. Starts the
   * worker on the first load. */
  async load(scenario: string): Promise<void> {
    if (scenario === this.#scenario) return;
    const url = new URL(`${encodeURIComponent(scenario)}.wasm`, this.#modules).href;
    this.#scenario = scenario;
    try {
      await this.#send({ op: "load", scenario, url });
    } catch (error) {
      if (this.#scenario === scenario) this.#scenario = undefined;
      throw error;
    }
  }

  /** With no handler, runs the loaded program's main afresh to its exit, resolving with its exit
   * code. With one, calls that handler of the loaded scenario's live instance, starting it first
   * when it has none, and resolves with the handler's parsed JSON result, or rejects with its
   * error's message. */
  run(handler?: string, input = ""): Promise<unknown> {
    if (this.#scenario === undefined) {
      return Promise.reject(new Error("no scenario is loaded; load one first"));
    }
    return this.#send({ op: "run", handler, input });
  }

  /** Ends whatever runs by terminating the worker: every pending load and run rejects, and the
   * next load starts a fresh worker and fetches its module again. Stopping while nothing runs
   * leaves the runner ready for a load. */
  async stop(): Promise<void> {
    const worker = this.#worker;
    if (!worker) return;
    worker.terminate();
    this.#worker = undefined;
    this.#scenario = undefined;
    for (const { reject } of this.#pending.values()) reject(new Error("stopped"));
    this.#pending.clear();
  }

  #send(body: Body): Promise<unknown> {
    const id = ++this.#lastId;
    const worker = this.#start();
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
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
