// A demo's run state, a model with no document and no element: whether a run is pending, what it
// runs, and how the last run ended. Its owner, the page or the element composing the controls over
// a runner, is its only writer: it starts a run as it asks the runner for one, and finishes it as
// the runner's promise settles. sl-controls reads it, renders from it, re-renders on its change
// event, and announces its transitions, never writing it.
//
// The runner runs one request at a time, and a new one stops the pending one, whose promise
// rejects as stopped only after the new one has begun. So each run has its own number, which start
// returns and finish takes: a finish for any run but the pending one, a superseded run settling
// late, changes nothing. A start while a run is pending supersedes it, recording it as stopped, as
// the runner stops it.

import { shown } from "./reasons.ts";

/** How a run ended: a handler's answer (ok), a program's exit and its code, stopped, or failed, a
 * handler's error or a load that failed, with its message. */
export type Outcome =
  | { readonly kind: "ok" }
  | { readonly kind: "exit"; readonly code: number }
  | { readonly kind: "stopped" }
  | { readonly kind: "failed"; readonly message: string };

/** Each outcome's kind. */
export const KINDS: readonly Outcome["kind"][] = Object.freeze(["ok", "exit", "stopped", "failed"]);

/** A finished run, a frozen snapshot: what it ran and how it ended. */
export interface Finished {
  readonly what: string;
  readonly outcome: Outcome;
}

/** Why value can't name what a run runs, or null when it can: a string holding something other
 * than white space, as a scenario's or handler's name. */
export function whatProblem(value: unknown): string | null {
  if (typeof value !== "string") return `what a run runs must be text, not ${shown(value)}`;
  return value.trim() === "" ? "what a run runs can't be empty" : null;
}

/** Why value can't be an outcome, or null when it can: an object of one of KINDS, an exit's code a
 * whole number, a failure's message text. */
export function outcomeProblem(value: unknown): string | null {
  if (typeof value !== "object" || value === null) {
    return `an outcome must be an object, not ${shown(value)}`;
  }
  const { kind } = value as { kind?: unknown };
  if (!(KINDS as readonly unknown[]).includes(kind)) {
    return `an outcome's kind must be one of ${KINDS.join(", ")}, not ${shown(kind)}`;
  }
  if (kind === "exit") {
    const { code } = value as { code?: unknown };
    if (typeof code !== "number") return `an exit's code must be a number, not ${shown(code)}`;
    if (!Number.isInteger(code)) return `an exit's code must be a whole number, not ${code}`;
  }
  if (kind === "failed") {
    const { message } = value as { message?: unknown };
    if (typeof message !== "string") {
      return `a failure's message must be text, not ${shown(message)}`;
    }
  }
  return null;
}

/**
 * A demo's run state: `pending`, whether a run is pending; `running`, what it runs, or null when
 * idle; `run`, the number of the pending run or of the last, 0 before the first; and `last`, how
 * the last finished run ended, or null before one has.
 *
 * `start(what)` starts a run of what, returning its number; a run pending then is superseded, and
 * its outcome recorded as stopped. `finish(run, outcome)` finishes the run of the number with the
 * outcome, returning true; for any run but the pending one it changes nothing and returns false.
 *
 * An operation it can't apply throws, naming the reason, and changes nothing: a TypeError for a
 * value of the wrong type, a RangeError for an empty what, an outcome's unknown kind, or an exit's
 * code that isn't whole. `whatProblem` and `outcomeProblem` give the reason, or null. Each start,
 * and each finish of the pending run, sends one `change` event; a finish that changes nothing
 * sends none.
 */
export class RunState extends EventTarget {
  #running: string | null = null;
  #run = 0;
  #last: Finished | null = null;

  /** Whether a run is pending. */
  get pending(): boolean {
    return this.#running !== null;
  }

  /** What the pending run runs, or null when idle. */
  get running(): string | null {
    return this.#running;
  }

  /** The number of the pending run, or of the last when idle; 0 before the first. */
  get run(): number {
    return this.#run;
  }

  /** How the last finished run ended, or null before one has. */
  get last(): Finished | null {
    return this.#last;
  }

  /** Starts a run of what, superseding a pending one, which is recorded as stopped. Returns the new
   * run's number, which its finish names. */
  start(what: string): number {
    const problem = whatProblem(what);
    if (problem) throw refusal(typeof what === "string", problem);
    if (this.#running !== null) this.#last = finished(this.#running, { kind: "stopped" });
    this.#running = what;
    this.#run += 1;
    this.dispatchEvent(new Event("change"));
    return this.#run;
  }

  /** Finishes the run of the number with the outcome, when it is the pending run, and returns
   * true; else changes nothing and returns false. The outcome is checked either way. */
  finish(run: number, outcome: Outcome): boolean {
    const problem = outcomeProblem(outcome);
    if (problem) throw refusal(typeOk(outcome), problem);
    if (this.#running === null || run !== this.#run) return false;
    this.#last = finished(this.#running, outcome);
    this.#running = null;
    this.dispatchEvent(new Event("change"));
    return true;
  }
}

/** The finished run, a frozen snapshot holding only an outcome's own fields. */
function finished(what: string, outcome: Outcome): Finished {
  const kept: Outcome =
    outcome.kind === "exit"
      ? { kind: "exit", code: outcome.code }
      : outcome.kind === "failed"
        ? { kind: "failed", message: outcome.message }
        : { kind: outcome.kind };
  return Object.freeze({ what, outcome: Object.freeze(kept) });
}

/** Whether an outcome's problem is of its value, not its type: an object whose kind is a string,
 * whose code, for an exit, is a number, and whose message, for a failure, is text. */
function typeOk(value: unknown): boolean {
  if (typeof value !== "object" || value === null) return false;
  const { kind, code, message } = value as { kind?: unknown; code?: unknown; message?: unknown };
  if (typeof kind !== "string") return false;
  if (kind === "exit") return typeof code === "number";
  if (kind === "failed") return typeof message === "string";
  return true;
}

/** The refusal for the reason: a RangeError when the value's type is right, else a TypeError. */
function refusal(typed: boolean, problem: string): Error {
  return typed ? new RangeError(problem) : new TypeError(problem);
}
