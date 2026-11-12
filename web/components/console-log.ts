// A console's log, a model with no document and no element: what a run wrote to stdout and stderr,
// its exits, and its handlers' answers, as an ordered list of entries. Its owner, the page or the
// element composing the console over a runner, is its only writer; the console reads it, renders
// from it, and re-renders on its change event, sending a clear request its owner applies.
//
// The shapes it takes are the runtime's events re-declared structurally (web/runtime/protocol.ts:
// an output event's stream and text, an exit event's scenario and code), since the components tier
// imports nothing from the runtime: an owner hands the runner's events in as they are.
//
// Output arrives as written, unbuffered: one write may hold part of a line, several lines, or a
// line's end. The log splits it into lines at "\n", and keeps every other character as text,
// "\r" and ANSI escapes included. A write continues the line before it only when that line is the
// same stream's, still open (no "\n" has ended it), and the last entry in the log; anything else,
// a write to the other stream, an exit, or a result, between them ends the open line where it
// stands, and the continuation starts a line of its own. So interleaved stdout and stderr keep the
// order they arrived in, line by line, never a line of one stream holding the other's text, and
// only the last entry ever changes after it is added: each write costs the lines it adds, and
// nothing it leaves alone.
//
// The log keeps the latest 10,000 entries, an output line, an exit, and a result each counting as
// one, and counts those it dropped from the front. Each entry carries a sequence number, one more
// than the last entry added before it, never reused, clear included, so the kept entries' numbers
// run unbroken from `first` to `next - 1`, and a reader rendering the log can tell, in constant
// time, what has gone from the front, what has changed at the end, and what is new.

import { shown } from "./reasons.ts";

/** The fd a write went to, as the runtime names it: 1 is stdout, 2 is stderr. */
export type Stream = "stdout" | "stderr";

/** A write as the runtime's output event carries it: its stream and its text, as written. */
export interface OutputLike {
  stream: Stream;
  text: string;
}

/** An exit as the runtime's exit event carries it: the scenario that exited and its code. */
export interface ExitLike {
  scenario: string;
  code: number;
}

/** A handler's answer: whether it resolved, and its answer or its error as text. */
export interface ResultLike {
  ok: boolean;
  text: string;
}

/** An output line, a frozen snapshot: its stream, its text without the "\n" that ended it, and
 * whether it is still open, no "\n" having ended it yet. */
export interface OutputEntry {
  readonly kind: "output";
  readonly seq: number;
  readonly stream: Stream;
  readonly text: string;
  readonly open: boolean;
}

/** An exit, a frozen snapshot: the scenario and its code. */
export interface ExitEntry {
  readonly kind: "exit";
  readonly seq: number;
  readonly scenario: string;
  readonly code: number;
}

/** A handler's answer, a frozen snapshot: ok for an answer, not for an error, and its text. */
export interface ResultEntry {
  readonly kind: "result";
  readonly seq: number;
  readonly ok: boolean;
  readonly text: string;
}

/** An entry of the log. */
export type ConsoleEntry = OutputEntry | ExitEntry | ResultEntry;

/** How many entries a log keeps unless told otherwise. */
export const LIMIT = 10_000;

/** The text of an entry as a copy of the log gives it, one line or block: an output line as
 * written; an exit as "<scenario> exited with code <code>"; a result as its text, an error's
 * after "error: ". */
export function entryText(entry: ConsoleEntry): string {
  switch (entry.kind) {
    case "output":
      return entry.text;
    case "exit":
      return `${entry.scenario} exited with code ${entry.code}`;
    case "result":
      return entry.ok ? entry.text : `error: ${entry.text}`;
  }
}

/**
 * A console's log: `entries`, the kept entries in the order they arrived, as frozen snapshots;
 * `dropped`, how many entries the limit has dropped from the front since the last clear; and
 * `first` and `next`, the sequence numbers of the first entry kept and of the next to be added.
 *
 * Its operations each add to it as named: `output` writes a stream's text, split into lines and
 * continuing the open line before it when it may (see the module's note); `exit` adds an exit;
 * `result` adds a handler's answer or error. `clear` empties it, the dropped count included.
 *
 * An operation it can't apply throws, naming the reason, and changes nothing: a TypeError for a
 * value of the wrong type, a RangeError for a stream other than stdout or stderr or a code that
 * isn't a whole number. Each operation that changes the log sends one `change` event; one that
 * changes nothing, an empty write or a clear of an empty log, sends none.
 */
export class ConsoleLog extends EventTarget {
  /** The entries, kept from #head on; those before it are dropped, and go at the next compaction. */
  #held: ConsoleEntry[] = [];
  #head = 0;
  #dropped = 0;
  #next = 0;
  readonly #limit: number;
  /** The kept entries as one frozen array, made on the first read after a change. */
  #snapshot: readonly ConsoleEntry[] | null = null;

  /** An empty log keeping the latest limit entries, 10,000 unless said: a whole number, at least
   * 1. */
  constructor({ limit = LIMIT }: { limit?: number } = {}) {
    super();
    if (typeof limit !== "number")
      throw new TypeError(`a limit must be a number, not ${shown(limit)}`);
    if (!Number.isInteger(limit) || limit < 1) {
      throw new RangeError(`a limit must be a whole number of at least 1, not ${limit}`);
    }
    this.#limit = limit;
  }

  /** How many entries the log keeps. */
  get limit(): number {
    return this.#limit;
  }

  /** The kept entries, oldest first, as frozen snapshots; the same array until the log changes. */
  get entries(): readonly ConsoleEntry[] {
    return (this.#snapshot ??= Object.freeze(this.#held.slice(this.#head)));
  }

  /** How many entries the log keeps now. */
  get size(): number {
    return this.#held.length - this.#head;
  }

  /** How many entries the limit has dropped from the front since the log was made or cleared. */
  get dropped(): number {
    return this.#dropped;
  }

  /** The sequence number of the first entry kept; `next` when the log is empty. */
  get first(): number {
    return this.#next - this.size;
  }

  /** The sequence number the next entry added will carry. */
  get next(): number {
    return this.#next;
  }

  /** The kept entry of the sequence number, or undefined when the log keeps none of it. */
  at(seq: number): ConsoleEntry | undefined {
    if (!Number.isInteger(seq) || seq < this.first || seq >= this.#next) return undefined;
    return this.#held[this.#head + (seq - this.first)];
  }

  /** The kept entries from the sequence number on, oldest first: all of them when it is before
   * `first`, none when it is `next` or after. */
  since(seq: number): ConsoleEntry[] {
    const from = Math.max(0, Math.min(this.size, Math.ceil(seq) - this.first));
    return this.#held.slice(this.#head + from);
  }

  /** The kept text, each entry on a line of its own (see entryText), as a copy of the log gives
   * it; empty when the log is. */
  text(): string {
    return this.since(this.first).map(entryText).join("\n");
  }

  /** The last entry kept, if any. */
  get #last(): ConsoleEntry | undefined {
    return this.#held.length > this.#head ? this.#held[this.#held.length - 1] : undefined;
  }

  /** Writes text to the stream, as written: split into lines at "\n", its first line continuing
   * the last entry when that is the same stream's open line, and its last line left open unless
   * the text ends with "\n". An empty text changes nothing. */
  output({ stream, text }: OutputLike): void {
    if (typeof stream !== "string") {
      throw new TypeError(`a stream must be "stdout" or "stderr", not ${shown(stream)}`);
    }
    if (stream !== "stdout" && stream !== "stderr") {
      throw new RangeError(`a stream must be "stdout" or "stderr", not ${shown(stream)}`);
    }
    if (typeof text !== "string") throw new TypeError(`output must be text, not ${shown(text)}`);
    if (text === "") return;
    const lines = text.split("\n");
    // The text after the last "\n": the line left open, or "" when the text ends the line.
    const rest = lines.pop() as string;
    const parts = lines.map((line) => ({ text: line, open: false }));
    if (rest !== "") parts.push({ text: rest, open: true });
    const last = this.#last;
    let from = 0;
    if (last?.kind === "output" && last.open && last.stream === stream) {
      // The open line continues: replaced by its snapshot with the first part joined to it.
      const { text: joined, open } = parts[0];
      this.#held[this.#held.length - 1] = Object.freeze({
        ...last,
        text: last.text + joined,
        open,
      });
      from = 1;
    }
    for (const part of parts.slice(from)) {
      this.#add({ kind: "output", seq: this.#next, stream, text: part.text, open: part.open });
    }
    this.#changed();
  }

  /** Adds an exit: the scenario's name and its code, a whole number. */
  exit({ scenario, code }: ExitLike): void {
    if (typeof scenario !== "string") {
      throw new TypeError(`a scenario must be named by text, not ${shown(scenario)}`);
    }
    if (typeof code !== "number")
      throw new TypeError(`a code must be a number, not ${shown(code)}`);
    if (!Number.isInteger(code)) throw new RangeError(`a code must be a whole number, not ${code}`);
    this.#add({ kind: "exit", seq: this.#next, scenario, code });
    this.#changed();
  }

  /** Adds a handler's answer: ok true for an answer, false for an error, and its text. */
  result({ ok, text }: ResultLike): void {
    if (typeof ok !== "boolean") throw new TypeError(`ok must be true or false, not ${shown(ok)}`);
    if (typeof text !== "string") throw new TypeError(`a result must be text, not ${shown(text)}`);
    this.#add({ kind: "result", seq: this.#next, ok, text });
    this.#changed();
  }

  /** Empties the log, its dropped count included; the sequence numbers go on from where they
   * were. A log already empty is left as it is: one that has dropped entries keeps its limit's. */
  clear(): void {
    if (this.size === 0) return;
    this.#held = [];
    this.#head = 0;
    this.#dropped = 0;
    this.#changed();
  }

  /** Appends the entry, frozen, dropping the oldest past the limit. Dropped entries stay in the
   * array, before the head, until they are half of it, so a drop costs a step and the compaction
   * that frees them is paid once for as many drops as there are entries kept. */
  #add(entry: ConsoleEntry): void {
    this.#held.push(Object.freeze(entry));
    this.#next += 1;
    if (this.size > this.#limit) {
      this.#head += 1;
      this.#dropped += 1;
      if (this.#head >= this.#limit) {
        this.#held = this.#held.slice(this.#head);
        this.#head = 0;
      }
    }
  }

  /** The kept entries' snapshot made again on the next read, and one change sent. */
  #changed(): void {
    this.#snapshot = null;
    this.dispatchEvent(new Event("change"));
  }
}
