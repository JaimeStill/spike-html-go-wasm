// The console's log, web/components/console-log.ts, under node with no browser: output split into
// lines and joined across writes, interleaved streams kept in arrival order, exits and results,
// text kept as written, the limit and the dropped count at their boundary, the sequence numbers a
// renderer reads, clear, the refusals that leave the log as it was, and its change event, sent once
// for each change and never for an operation that changes nothing.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ConsoleLog,
  entryText,
  LIMIT,
  type ConsoleEntry,
} from "../../web/components/console-log.ts";

/** The log's entries as plain values, without their sequence numbers. */
const shown = (log: ConsoleLog) =>
  log.entries.map((entry) =>
    Object.fromEntries(Object.entries(entry).filter(([key]) => key !== "seq")),
  );

/** An output line as the log gives it, without its sequence number. */
const line = (stream: "stdout" | "stderr", text: string, open = false) => ({
  kind: "output" as const,
  stream,
  text,
  open,
});

/** How many change events the log sends from now on, counted as they arrive. */
function counted(log: ConsoleLog): { changes: number } {
  const count = { changes: 0 };
  log.addEventListener("change", (event) => {
    assert.equal(event.target, log);
    count.changes++;
  });
  return count;
}

/** Asserts that act throws the kind of error, its message matching reason, and leaves the log as
 * it was, sending no change. */
function refused(log: ConsoleLog, act: () => void, kind: ErrorConstructor, reason: RegExp): void {
  const before = log.entries;
  const next = log.next;
  const count = counted(log);
  assert.throws(act, (error: Error) => error instanceof kind && reason.test(error.message));
  assert.equal(log.entries, before, "a refusal makes no new snapshot");
  assert.equal(log.next, next);
  assert.equal(count.changes, 0, "a refusal sends no change");
}

describe("ConsoleLog's output", () => {
  test("starts empty, keeping 10,000 entries", () => {
    const log = new ConsoleLog();
    assert.deepEqual(log.entries, []);
    assert.equal(log.limit, 10_000);
    assert.deepEqual([log.size, log.dropped, log.first, log.next], [0, 0, 0, 0]);
    assert.equal(log.text(), "");
  });

  test("splits a write into lines at each \\n, the last left open unless the write ends one", () => {
    const log = new ConsoleLog();
    log.output({ stream: "stdout", text: "one\ntwo\n\nfour" });
    assert.deepEqual(shown(log), [
      line("stdout", "one"),
      line("stdout", "two"),
      line("stdout", ""),
      line("stdout", "four", true),
    ]);
    const ended = new ConsoleLog();
    ended.output({ stream: "stdout", text: "done\n" });
    assert.deepEqual(shown(ended), [line("stdout", "done")]);
    const blank = new ConsoleLog();
    blank.output({ stream: "stderr", text: "\n" });
    assert.deepEqual(shown(blank), [line("stderr", "")], "a lone \\n is a blank line");
  });

  test("a write continues the same stream's open line, and its \\n ends it", () => {
    const log = new ConsoleLog();
    log.output({ stream: "stdout", text: "hel" });
    const open = log.entries[0];
    log.output({ stream: "stdout", text: "lo, " });
    log.output({ stream: "stdout", text: "world\nnext" });
    assert.deepEqual(shown(log), [line("stdout", "hello, world"), line("stdout", "next", true)]);
    assert.equal(log.entries[0].seq, open.seq, "the joined line keeps its sequence number");
    assert.notEqual(log.entries[0], open, "and is a new snapshot");
    assert.equal((open as { text: string }).text, "hel", "the old snapshot is left as it was");
    log.output({ stream: "stdout", text: "\n" });
    assert.deepEqual(shown(log), [line("stdout", "hello, world"), line("stdout", "next")]);
    log.output({ stream: "stdout", text: "after" });
    assert.deepEqual(
      shown(log).at(-1),
      line("stdout", "after", true),
      "a closed line is never continued",
    );
  });

  test("interleaved streams keep arrival order: a write to the other stream ends the open line, and its continuation starts a new one", () => {
    const log = new ConsoleLog();
    log.output({ stream: "stdout", text: "progress: " });
    log.output({ stream: "stderr", text: "warning: low disk" });
    log.output({ stream: "stdout", text: "50%\n" });
    log.output({ stream: "stderr", text: "\n" });
    assert.deepEqual(shown(log), [
      line("stdout", "progress: ", true),
      line("stderr", "warning: low disk", true),
      line("stdout", "50%"),
      line("stderr", ""),
    ]);
    // The first two stay open, but are no longer the last entry, so nothing joins them again.
    log.output({ stream: "stdout", text: "more" });
    assert.deepEqual(shown(log).at(-1), line("stdout", "more", true));
    assert.equal(log.size, 5);
  });

  test("an exit or a result between writes ends the open line too", () => {
    const log = new ConsoleLog();
    log.output({ stream: "stdout", text: "partial" });
    log.exit({ scenario: "hello", code: 0 });
    log.output({ stream: "stdout", text: " more" });
    log.result({ ok: true, text: "{}" });
    log.output({ stream: "stdout", text: "!" });
    assert.deepEqual(shown(log), [
      line("stdout", "partial", true),
      { kind: "exit", scenario: "hello", code: 0 },
      line("stdout", " more", true),
      { kind: "result", ok: true, text: "{}" },
      line("stdout", "!", true),
    ]);
  });

  test("keeps the text exactly as written: ANSI escapes, \\r, tabs, and Unicode", () => {
    const log = new ConsoleLog();
    const text = "\u001b[31mred\u001b[0m\tdone\r\n✓ ünïcode 🎉";
    log.output({ stream: "stdout", text });
    assert.deepEqual(shown(log), [
      line("stdout", "\u001b[31mred\u001b[0m\tdone\r"),
      line("stdout", "✓ ünïcode 🎉", true),
    ]);
    assert.equal(log.text(), text, "the copy holds the same characters");
  });

  test("an empty write changes nothing and sends no change", () => {
    const log = new ConsoleLog();
    log.output({ stream: "stdout", text: "x" });
    const entries = log.entries;
    const count = counted(log);
    log.output({ stream: "stdout", text: "" });
    log.output({ stream: "stderr", text: "" });
    assert.equal(count.changes, 0);
    assert.equal(log.entries, entries);
  });
});

describe("ConsoleLog's exits and results", () => {
  test("adds an exit, naming the scenario and its code, zero or not", () => {
    const log = new ConsoleLog();
    log.exit({ scenario: "hello", code: 0 });
    log.exit({ scenario: "crash", code: 2 });
    log.exit({ scenario: "neg", code: -1 });
    assert.deepEqual(shown(log), [
      { kind: "exit", scenario: "hello", code: 0 },
      { kind: "exit", scenario: "crash", code: 2 },
      { kind: "exit", scenario: "neg", code: -1 },
    ]);
  });

  test("takes the runtime's events as they are, their type field and all", () => {
    const log = new ConsoleLog();
    log.output({ type: "output", stream: "stderr", text: "boom\n" } as never);
    log.exit({ type: "exit", scenario: "crash", code: 2 } as never);
    assert.deepEqual(shown(log), [
      line("stderr", "boom"),
      { kind: "exit", scenario: "crash", code: 2 },
    ]);
  });

  test("adds a result, an answer or an error, its text whole, line breaks and all", () => {
    const log = new ConsoleLog();
    log.result({ ok: true, text: '{\n  "a": 1\n}' });
    log.result({ ok: false, text: "parse error: line 1" });
    assert.deepEqual(shown(log), [
      { kind: "result", ok: true, text: '{\n  "a": 1\n}' },
      { kind: "result", ok: false, text: "parse error: line 1" },
    ]);
    assert.equal(log.size, 2, "a result is one entry, however many lines its text holds");
  });

  test("its text is each entry on a line: output as written, an exit and a result as the console says them", () => {
    const log = new ConsoleLog();
    log.output({ stream: "stdout", text: "a\nb" });
    log.output({ stream: "stderr", text: "c\n" });
    log.exit({ scenario: "hello", code: 1 });
    log.result({ ok: true, text: "42" });
    log.result({ ok: false, text: "bad input" });
    assert.equal(log.text(), "a\nb\nc\nhello exited with code 1\n42\nerror: bad input");
    const [exit] = log.entries.filter((entry) => entry.kind === "exit");
    assert.equal(entryText(exit), "hello exited with code 1");
  });
});

describe("ConsoleLog's limit", () => {
  /** A log of n closed stdout lines, "line 0" on. */
  const filled = (n: number, limit?: number) => {
    const log = new ConsoleLog(limit === undefined ? {} : { limit });
    for (let i = 0; i < n; i++) log.output({ stream: "stdout", text: `line ${i}\n` });
    return log;
  };

  test("keeps exactly 10,000 entries, dropping none, and the next drops the oldest", () => {
    const log = filled(LIMIT);
    assert.deepEqual([log.size, log.dropped, log.first, log.next], [LIMIT, 0, 0, LIMIT]);
    log.output({ stream: "stdout", text: "one more\n" });
    assert.deepEqual([log.size, log.dropped, log.first, log.next], [LIMIT, 1, 1, LIMIT + 1]);
    assert.deepEqual(log.entries[0], {
      kind: "output",
      seq: 1,
      stream: "stdout",
      text: "line 1",
      open: false,
    });
    assert.equal((log.entries.at(-1) as { text: string }).text, "one more");
  });

  test("one write of many lines past the limit keeps its latest and counts the rest dropped", () => {
    const log = new ConsoleLog({ limit: 3 });
    log.output({ stream: "stdout", text: "a\nb\nc\nd\ne" });
    assert.deepEqual(shown(log), [
      line("stdout", "c"),
      line("stdout", "d"),
      line("stdout", "e", true),
    ]);
    assert.equal(log.dropped, 2);
    // A continuation of the open last line adds no entry, so drops nothing.
    log.output({ stream: "stdout", text: "e" });
    assert.equal(log.dropped, 2);
    assert.deepEqual(shown(log).at(-1), line("stdout", "ee", true));
  });

  test("exits and results count toward the limit as one entry each", () => {
    const log = new ConsoleLog({ limit: 2 });
    log.output({ stream: "stdout", text: "x\n" });
    log.exit({ scenario: "s", code: 0 });
    log.result({ ok: false, text: "e" });
    assert.deepEqual(shown(log), [
      { kind: "exit", scenario: "s", code: 0 },
      { kind: "result", ok: false, text: "e" },
    ]);
    assert.equal(log.dropped, 1);
  });

  test("past the limit many times over, keeps the latest in order, their numbers unbroken, at() and since() finding each", () => {
    const n = LIMIT * 3 + 17;
    const log = filled(n);
    assert.equal(log.size, LIMIT);
    assert.equal(log.dropped, n - LIMIT);
    assert.equal(log.first, n - LIMIT);
    assert.equal(log.next, n);
    const entries = log.entries;
    entries.forEach((entry, i) => assert.equal(entry.seq, log.first + i));
    assert.equal((entries[0] as { text: string }).text, `line ${n - LIMIT}`);
    assert.equal((entries.at(-1) as { text: string }).text, `line ${n - 1}`);
    assert.equal(log.at(log.first), entries[0]);
    assert.equal(log.at(n - 1), entries.at(-1));
    assert.equal(log.at(log.first - 1), undefined, "a dropped entry is gone");
    assert.equal(log.at(n), undefined, "an entry not yet added");
    assert.deepEqual(log.since(n - 2), entries.slice(-2));
    assert.deepEqual(log.since(0), entries, "from before first, every kept entry");
    assert.deepEqual(log.since(n), []);
  });

  test("a write past the limit stays cheap: 100,000 writes in well under a second", () => {
    const log = new ConsoleLog();
    const start = performance.now();
    for (let i = 0; i < 100_000; i++)
      log.output({ stream: i % 2 ? "stdout" : "stderr", text: `${i}\n` });
    const took = performance.now() - start;
    assert.equal(log.size, LIMIT);
    assert.ok(took < 1000, `took ${took.toFixed(0)} ms`);
  });

  test("a limit must be a whole number of at least 1", () => {
    assert.equal(new ConsoleLog({ limit: 1 }).limit, 1);
    assert.throws(() => new ConsoleLog({ limit: 0 }), RangeError);
    assert.throws(() => new ConsoleLog({ limit: 2.5 }), RangeError);
    assert.throws(() => new ConsoleLog({ limit: "5" as unknown as number }), TypeError);
  });
});

describe("ConsoleLog's clear", () => {
  test("empties the log and its dropped count, the numbers going on from where they were", () => {
    const log = new ConsoleLog({ limit: 2 });
    log.output({ stream: "stdout", text: "a\nb\nc\n" });
    assert.equal(log.dropped, 1);
    const count = counted(log);
    log.clear();
    assert.equal(count.changes, 1);
    assert.equal(log.entries.length, 0);
    assert.deepEqual([log.size, log.dropped, log.first, log.next], [0, 0, 3, 3]);
    assert.equal(log.text(), "");
    log.output({ stream: "stdout", text: "d" });
    assert.equal(log.entries[0].seq, 3, "a number is never reused");
  });

  test("ends an open line: a write after a clear starts a new one", () => {
    const log = new ConsoleLog();
    log.output({ stream: "stdout", text: "open" });
    log.clear();
    log.output({ stream: "stdout", text: "fresh" });
    assert.deepEqual(shown(log), [line("stdout", "fresh", true)]);
  });

  test("a clear of an empty log changes nothing and sends no change", () => {
    const log = new ConsoleLog();
    const count = counted(log);
    log.clear();
    assert.equal(count.changes, 0);
  });
});

describe("ConsoleLog's change events and snapshots", () => {
  test("one change for each operation that changes the log, however many lines it adds", () => {
    const log = new ConsoleLog();
    const count = counted(log);
    log.output({ stream: "stdout", text: "a\nb\nc\n" });
    log.output({ stream: "stdout", text: "d" });
    log.output({ stream: "stdout", text: "e" });
    log.exit({ scenario: "s", code: 0 });
    log.result({ ok: true, text: "" });
    log.clear();
    assert.equal(count.changes, 6);
  });

  test("entries are frozen snapshots, the same array until the log changes", () => {
    const log = new ConsoleLog();
    log.output({ stream: "stdout", text: "a\n" });
    const entries = log.entries;
    assert.ok(Object.isFrozen(entries));
    assert.ok(entries.every((entry: ConsoleEntry) => Object.isFrozen(entry)));
    assert.equal(log.entries, entries);
    assert.throws(() => {
      (entries[0] as { text: string }).text = "changed";
    }, TypeError);
    log.output({ stream: "stdout", text: "b\n" });
    assert.notEqual(log.entries, entries);
    assert.equal(entries.length, 1, "a snapshot already read is left as it was");
  });
});

describe("ConsoleLog's refusals", () => {
  test("a stream other than stdout or stderr", () => {
    const log = new ConsoleLog();
    refused(log, () => log.output({ stream: "stdin" as never, text: "x" }), RangeError, /"stdin"/);
    refused(log, () => log.output({ stream: 1 as never, text: "x" }), TypeError, /not 1/);
  });

  test("output that isn't text", () => {
    const log = new ConsoleLog();
    refused(
      log,
      () => log.output({ stream: "stdout", text: 5 as never }),
      TypeError,
      /must be text/,
    );
  });

  test("an exit without a scenario's name or a whole-number code", () => {
    const log = new ConsoleLog();
    refused(log, () => log.exit({ scenario: 3 as never, code: 0 }), TypeError, /scenario/);
    refused(log, () => log.exit({ scenario: "s", code: "0" as never }), TypeError, /"0"/);
    refused(log, () => log.exit({ scenario: "s", code: 1.5 }), RangeError, /1\.5/);
  });

  test("a result without a boolean ok or text", () => {
    const log = new ConsoleLog();
    refused(log, () => log.result({ ok: "yes" as never, text: "" }), TypeError, /"yes"/);
    refused(log, () => log.result({ ok: true, text: null as never }), TypeError, /null/);
  });
});
