// The runner's events and the messages between the runner, on the page, and its worker. Every
// event and message is a plain object, structured-cloneable, so the worker posts an event and the
// runner hands the same object to its listeners, and a component can re-declare the events'
// shapes without importing the runtime.

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

/** A run's phases: fetch and compile on a load; instantiate for a fresh instance; start, a
 * handler scenario's main running until its handlers are registered; and call, one handler's
 * answer, or run, a program's main running to its exit. */
export type Phase = "fetch" | "compile" | "instantiate" | "start" | "call" | "run";

/** How long one phase took, in milliseconds. */
export interface TimingEvent {
  type: "timing";
  scenario: string;
  phase: Phase;
  ms: number;
}

export type RunnerEvent = OutputEvent | ExitEvent | TimingEvent;

/** The runner's requests, each answered by one Settled with its id. A load names the module's
 * absolute URL, which the runner resolves under the site's base. A run with no handler runs the
 * program's main; with one, it calls that handler with input. */
export type Request =
  | { id: number; op: "load"; scenario: string; url: string }
  | { id: number; op: "run"; handler?: string; input: string };

/** A request's answer: its value, or the message of the error it failed with. */
export type Settled =
  | { type: "settled"; id: number; ok: true; value: unknown }
  | { type: "settled"; id: number; ok: false; error: string };

/** What the worker posts: an event as it happens, or a request's answer. */
export type Reply = { type: "event"; event: RunnerEvent } | Settled;
