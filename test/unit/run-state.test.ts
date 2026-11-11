// The controls' run state, web/components/run-state.ts, under node with no browser: idle at first,
// a start making a run pending and numbering it, a finish of the pending run recording its outcome
// as a frozen snapshot, a start while pending superseding the run as stopped, a late finish of a
// superseded or finished run changing nothing, the refusals and the reasons they name, and the
// change event, sent once for each change and never for a finish that changes nothing.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  type Outcome,
  outcomeProblem,
  RunState,
  whatProblem,
} from "../../web/components/run-state.ts";

/** The state as each change event finds it, in order. */
function heard(state: RunState) {
  const seen: { pending: boolean; running: string | null; run: number; last: unknown }[] = [];
  state.addEventListener("change", (event) => {
    assert.equal(event.target, state);
    const { pending, running, run, last } = state;
    seen.push({ pending, running, run, last });
  });
  return seen;
}

describe("RunState", () => {
  test("starts idle: nothing running, no run, no outcome", () => {
    const state = new RunState();
    assert.equal(state.pending, false);
    assert.equal(state.running, null);
    assert.equal(state.run, 0);
    assert.equal(state.last, null);
  });

  test("a start makes a run pending, numbered from 1, and sends one change", () => {
    const state = new RunState();
    const seen = heard(state);
    assert.equal(state.start("hello"), 1);
    assert.equal(state.pending, true);
    assert.equal(state.running, "hello");
    assert.equal(state.run, 1);
    assert.equal(state.last, null);
    assert.deepEqual(seen, [{ pending: true, running: "hello", run: 1, last: null }]);
  });

  test("finishing the pending run records each kind of outcome, and leaves it idle", () => {
    const outcomes: Outcome[] = [
      { kind: "ok" },
      { kind: "exit", code: 0 },
      { kind: "exit", code: 2 },
      { kind: "stopped" },
      { kind: "failed", message: "input.go:3:1: expected declaration" },
    ];
    const state = new RunState();
    for (const outcome of outcomes) {
      const run = state.start("format");
      const seen = heard(state);
      assert.equal(state.finish(run, outcome), true);
      assert.equal(state.pending, false);
      assert.equal(state.running, null);
      assert.equal(state.run, run, "idle, run numbers the last run");
      assert.deepEqual(state.last, { what: "format", outcome });
      assert.equal(seen.length, 1);
    }
  });

  test("the last outcome is a frozen snapshot holding only its own fields", () => {
    const state = new RunState();
    const given = { kind: "exit" as const, code: 3, extra: "dropped" };
    state.finish(state.start("crash"), given);
    const last = state.last;
    assert.ok(last && Object.isFrozen(last) && Object.isFrozen(last.outcome));
    assert.deepEqual(last, { what: "crash", outcome: { kind: "exit", code: 3 } });
    given.code = 4;
    assert.deepEqual(
      last.outcome,
      { kind: "exit", code: 3 },
      "a later change to the given leaves it",
    );
  });

  test("a start while a run is pending supersedes it, recorded as stopped, with one change", () => {
    const state = new RunState();
    const first = state.start("spin");
    const seen = heard(state);
    const second = state.start("format");
    assert.equal(second, first + 1);
    assert.deepEqual(seen, [
      {
        pending: true,
        running: "format",
        run: second,
        last: { what: "spin", outcome: { kind: "stopped" } },
      },
    ]);
  });

  test("a superseded run's late finish changes nothing and sends nothing; the pending run's finishes", () => {
    const state = new RunState();
    const first = state.start("spin");
    const second = state.start("format");
    const seen = heard(state);
    assert.equal(state.finish(first, { kind: "failed", message: "stopped" }), false);
    assert.equal(state.running, "format");
    assert.deepEqual(state.last, { what: "spin", outcome: { kind: "stopped" } });
    assert.deepEqual(seen, []);
    assert.equal(state.finish(second, { kind: "ok" }), true);
    assert.deepEqual(state.last, { what: "format", outcome: { kind: "ok" } });
    assert.equal(seen.length, 1);
  });

  test("a finish when idle, or of a run never started, changes nothing", () => {
    const state = new RunState();
    const seen = heard(state);
    assert.equal(state.finish(0, { kind: "ok" }), false);
    const run = state.start("hello");
    assert.equal(state.finish(run + 1, { kind: "ok" }), false);
    assert.equal(state.finish(run, { kind: "exit", code: 0 }), true);
    assert.equal(state.finish(run, { kind: "stopped" }), false, "finished, it stays finished");
    assert.deepEqual(state.last, { what: "hello", outcome: { kind: "exit", code: 0 } });
    assert.equal(seen.length, 2);
  });

  test("refuses what isn't a name of something to run, naming why, changing nothing", () => {
    const state = new RunState();
    const seen = heard(state);
    assert.throws(() => state.start(""), {
      name: "RangeError",
      message: "what a run runs can't be empty",
    });
    assert.throws(() => state.start("  "), RangeError);
    assert.throws(() => state.start(7 as unknown as string), {
      name: "TypeError",
      message: "what a run runs must be text, not 7",
    });
    assert.equal(state.run, 0);
    assert.deepEqual(seen, []);
    assert.equal(whatProblem("hello"), null);
  });

  test("refuses an outcome it can't record, naming why, changing nothing, even for a late run", () => {
    const state = new RunState();
    const run = state.start("hello");
    const seen = heard(state);
    const refused: [unknown, string, string][] = [
      [null, "TypeError", "an outcome must be an object, not null"],
      [
        { kind: 1 },
        "TypeError",
        "an outcome's kind must be one of ok, exit, stopped, failed, not 1",
      ],
      [
        { kind: "done" },
        "RangeError",
        'an outcome\'s kind must be one of ok, exit, stopped, failed, not "done"',
      ],
      [{ kind: "exit" }, "TypeError", "an exit's code must be a number, not undefined"],
      [{ kind: "exit", code: 1.5 }, "RangeError", "an exit's code must be a whole number, not 1.5"],
      [{ kind: "exit", code: NaN }, "RangeError", "an exit's code must be a whole number, not NaN"],
      [{ kind: "failed" }, "TypeError", "a failure's message must be text, not undefined"],
    ];
    for (const [outcome, name, message] of refused) {
      assert.throws(() => state.finish(run, outcome as Outcome), { name, message });
      assert.throws(() => state.finish(run + 5, outcome as Outcome), { name, message });
      assert.equal(outcomeProblem(outcome), message);
    }
    assert.equal(state.pending, true);
    assert.deepEqual(seen, []);
    assert.equal(outcomeProblem({ kind: "exit", code: -1 }), null);
    assert.equal(outcomeProblem({ kind: "failed", message: "" }), null);
  });
});
