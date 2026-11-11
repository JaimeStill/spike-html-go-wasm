// A run's timings, a model with no document and no element: how long each phase of the last run
// took, in milliseconds. Its owner, the page or the element composing the timings over a runner,
// is its only writer: it begins a run as the run starts and records each phase's timing as the
// runner reports it. sl-timings reads it, renders from it, and re-renders on its change event,
// never writing it.
//
// The shapes it takes are the runtime's re-declared structurally (web/runtime/protocol.ts: a
// timing event's phase and ms, its Phase), since the components tier imports nothing from the
// runtime: an owner hands the runner's timing events in as they are, their type and scenario
// unread.
//
// A run has only the phases it went through, each once: a cold load's fetch, compile,
// instantiate, start, and call; a held instance's call alone; a program's instantiate and run.
// The model holds them in the runtime's phase order, whatever order they arrive in, and the total
// is their sum, derived on each read. A new run replaces the last: begin clears every phase.

/** A run's phases as the runtime names them, in the order a run goes through them: fetch and
 * compile on a load; instantiate for a fresh instance; start, a handler scenario's main running
 * until its handlers are registered; and call, one handler's answer, or run, a program's main
 * running to its exit. */
export type Phase = "fetch" | "compile" | "instantiate" | "start" | "call" | "run";

/** Every phase, in the order a run goes through them, which the timings keep. */
export const PHASES: readonly Phase[] = Object.freeze([
  "fetch",
  "compile",
  "instantiate",
  "start",
  "call",
  "run",
]);

/** A phase's timing as the runtime's timing event carries it: the phase and how long it took, in
 * milliseconds. */
export interface TimingLike {
  phase: Phase;
  ms: number;
}

/** A phase's timing, a frozen snapshot. */
export interface PhaseTiming {
  readonly phase: Phase;
  readonly ms: number;
}

/** The value as a reason names it: a string as JSON, so its spaces show; anything else as it
 * prints. */
const shown = (value: unknown) =>
  typeof value === "string" ? JSON.stringify(value) : String(value);

/** Why value can't be a phase, or null when it can: one of PHASES. */
export function phaseProblem(value: unknown): string | null {
  return (PHASES as readonly unknown[]).includes(value)
    ? null
    : `a phase must be one of ${PHASES.join(", ")}, not ${shown(value)}`;
}

/** Why value can't be a phase's milliseconds, or null when it can: a finite number, at least 0. */
export function msProblem(value: unknown): string | null {
  if (typeof value !== "number") return `a time must be a number of ms, not ${shown(value)}`;
  if (!Number.isFinite(value) || value < 0) {
    return `a time must be a finite number of ms, at least 0, not ${value}`;
  }
  return null;
}

/**
 * A run's timings: `phases`, the phases the current run has recorded, in PHASES' order, as frozen
 * snapshots; `total`, their sum in ms; `runs`, how many runs have begun, 0 before the first.
 *
 * `begin()` begins a new run, clearing every phase of the last; `record({ phase, ms })` adds the
 * phase's timing to the current run, or replaces it when the run has it already.
 *
 * A record it can't apply throws, naming the reason, and changes nothing: a TypeError for a phase
 * that isn't a string or a time that isn't a number, a RangeError for a phase the runtime doesn't
 * name or a time that is negative, NaN, or infinite. Each operation that changes the timings sends
 * one `change` event: every begin, as it begins a run, and a record that adds a phase or changes
 * its time; a record of the time a phase already has sends none.
 */
export class RunTimings extends EventTarget {
  /** The current run's phases, by phase. */
  readonly #held = new Map<Phase, PhaseTiming>();
  #runs = 0;
  /** The phases as one frozen array, made on the first read after a change. */
  #snapshot: readonly PhaseTiming[] | null = null;

  /** How many runs have begun: 0 before the first, which shows no run yet. */
  get runs(): number {
    return this.#runs;
  }

  /** The current run's phases, in PHASES' order, as frozen snapshots; the same array until the
   * timings change. */
  get phases(): readonly PhaseTiming[] {
    this.#snapshot ??= Object.freeze(
      PHASES.flatMap((phase) => {
        const timing = this.#held.get(phase);
        return timing ? [timing] : [];
      }),
    );
    return this.#snapshot;
  }

  /** The current run's total, the sum of its phases' ms; 0 with none. */
  get total(): number {
    return this.phases.reduce((sum, { ms }) => sum + ms, 0);
  }

  /** The phase's ms in the current run, or undefined when the run hasn't it. */
  ms(phase: Phase): number | undefined {
    return this.#held.get(phase)?.ms;
  }

  /** Begins a new run, clearing the last's phases. */
  begin(): void {
    this.#held.clear();
    this.#runs += 1;
    this.#changed();
  }

  /** Adds the phase's timing to the current run, or replaces the time it has. A timing event of
   * the runtime's is taken as it is. */
  record(timing: TimingLike): void {
    const phase = checkedPhase(timing.phase);
    const ms = checkedMs(timing.ms);
    if (this.#held.get(phase)?.ms === ms) return;
    this.#held.set(phase, Object.freeze({ phase, ms }));
    this.#changed();
  }

  #changed(): void {
    this.#snapshot = null;
    this.dispatchEvent(new Event("change"));
  }
}

/** The value, when it can be a phase; else a RangeError naming why, or a TypeError when it isn't
 * a string. */
function checkedPhase(value: unknown): Phase {
  const problem = phaseProblem(value);
  if (!problem) return value as Phase;
  throw typeof value === "string" ? new RangeError(problem) : new TypeError(problem);
}

/** The value, when it can be a phase's ms; else a RangeError naming why, or a TypeError when it
 * isn't a number. */
function checkedMs(value: unknown): number {
  const problem = msProblem(value);
  if (!problem) return value as number;
  throw typeof value === "number" ? new RangeError(problem) : new TypeError(problem);
}
