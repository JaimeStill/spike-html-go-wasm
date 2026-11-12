// The runner's events and the messages between the runner, on the page, and its worker. Every
// event and message is a plain object, structured-cloneable, so the worker posts an event and the
// runner hands the same object to its listeners, and a component can re-declare the events'
// shapes without importing the runtime.

import type { BuildFile } from "./build.ts";

export type { BuildFile } from "./build.ts";

/** The fd a write went to: 1 is stdout, 2 is stderr. */
export type Stream = "stdout" | "stderr";

/** One write to fd 1 or 2, decoded, as written: never buffered to a line. */
export interface OutputEvent {
  type: "output";
  stream: Stream;
  text: string;
}

/** A scenario's main returned or called os.Exit, or the runtime panicked: its exit code. */
export interface ExitEvent {
  type: "exit";
  scenario: string;
  code: number;
}

/** A run's phases, in the order a run goes through them: fetch and compile, WebAssembly's, on a
 * load or a build; go-compile and link, Go's compiler and linker, on a build; instantiate for a
 * fresh instance; start, a handler scenario's main running until its handlers are registered; and
 * call, one handler's answer, or run, a program's main running to its exit. A request reports each
 * phase it went through once: a build's fetch and compile, each timed in several parts (the
 * toolchain's modules and the archives, then the built program), report their sum. */
export type Phase =
  "fetch" | "compile" | "go-compile" | "link" | "instantiate" | "start" | "call" | "run";

/** How long one phase took, in milliseconds. */
export interface TimingEvent {
  type: "timing";
  scenario: string;
  phase: Phase;
  ms: number;
}

export type RunnerEvent = OutputEvent | ExitEvent | TimingEvent;

/** The scenario a built program is held as, and names in its events. */
export const BUILT_SCENARIO = "main";

/** The URL a built program is held under, which no load's module has, so a load never takes a
 * built program for a scenario it holds. */
export const BUILT_URL = "build:main";

/** A compiled module held for a scenario: a loaded one's, under its module's URL, or a built
 * program's, under BUILT_URL with the files it was built from, whose non-Go files each run's
 * working directory holds. */
export interface HeldProgram {
  scenario: string;
  url: string;
  module: WebAssembly.Module;
  files?: BuildFile[];
}

/** One of the toolchain's modules, the compiler or the linker, compiled, by its absolute URL,
 * which holds its content's hash. */
export interface HeldTool {
  url: string;
  module: WebAssembly.Module;
}

/** The runner's requests, each answered by one Settled with its id.
 *
 * A load names the module's absolute URL, which the runner resolves under the site's base, and
 * answers the compiled WebAssembly.Module when it fetched and compiled one, undefined when the
 * worker held it already.
 *
 * A build names the toolchain's manifest by its absolute URL, and the program's files. The worker
 * reads the manifest, revalidated, resolves the .go files' import closure, fetches the compiler,
 * the linker, and the closure's archives it doesn't hold yet, compiles and links the program, and
 * compiles the linked module, which it holds as the scenario BUILT_SCENARIO under BUILT_URL. It
 * answers that module. A failed step's output is the build's output events, its exit an exit event
 * naming the step, and the build fails naming it; an import the manifest doesn't hold fails before
 * the compiler runs.
 *
 * An adopt hands a worker modules compiled before, which it holds as a load's or a build's, with
 * no fetch and no compile: the program, when there is one, and the toolchain's modules. The
 * runner's Stop sends it to the fresh worker, and a build of the files the last build built sends
 * it in the build's place.
 *
 * A run with no handler runs the program's main; with one, it calls that handler with input. */
export type Request =
  | { id: number; op: "load"; scenario: string; url: string }
  | { id: number; op: "build"; manifest: string; files: BuildFile[] }
  | { id: number; op: "adopt"; program?: HeldProgram; tools: HeldTool[] }
  | { id: number; op: "run"; handler?: string; input: string };

/** A request's answer: its value, or the message of the error it failed with. */
export type Settled =
  | { type: "settled"; id: number; ok: true; value: unknown }
  | { type: "settled"; id: number; ok: false; error: string };

/** The toolchain's modules the worker holds, posted as soon as a build has compiled a new one, so
 * the runner keeps them even when Stop ends the build before it settles. */
export interface ToolsHeld {
  type: "tools";
  tools: HeldTool[];
}

/** What the worker posts: an event as it happens, the toolchain it holds, or a request's
 * answer. */
export type Reply = { type: "event"; event: RunnerEvent } | ToolsHeld | Settled;
