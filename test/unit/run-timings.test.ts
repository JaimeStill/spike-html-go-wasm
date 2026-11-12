// The timings' model, web/components/run-timings.ts, under node with no browser: a run's phases
// kept in the runtime's phase order whatever order they arrive in, only the phases recorded, the
// total their sum, a new run replacing the last, the refusals and the reasons they name, and the
// change event, sent once for each change and never for a record that changes nothing.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  msProblem,
  type Phase,
  PHASES,
  phaseProblem,
  RunTimings,
} from "../../web/components/run-timings.ts";

/** The timings as each change event finds them, in order: the run and its phases. */
function heard(timings: RunTimings): { runs: number; phases: [Phase, number][] }[] {
  const seen: { runs: number; phases: [Phase, number][] }[] = [];
  timings.addEventListener("change", (event) => {
    assert.equal(event.target, timings);
    seen.push({ runs: timings.runs, phases: timings.phases.map(({ phase, ms }) => [phase, ms]) });
  });
  return seen;
}

/** The timings' phases as pairs. */
const pairs = (timings: RunTimings) => timings.phases.map(({ phase, ms }) => [phase, ms]);

describe("RunTimings", () => {
  test("starts with no run, no phase, and a total of 0", () => {
    const timings = new RunTimings();
    assert.equal(timings.runs, 0);
    assert.deepEqual(timings.phases, []);
    assert.equal(timings.total, 0);
    assert.equal(timings.ms("fetch"), undefined);
  });

  test("holds every phase the runtime names, in a run's order, however they arrive", () => {
    const timings = new RunTimings();
    timings.begin();
    for (const phase of [...PHASES].reverse()) timings.record({ phase, ms: 1 });
    assert.deepEqual(
      timings.phases.map(({ phase }) => phase),
      ["fetch", "compile", "go-compile", "link", "instantiate", "start", "call", "run"],
    );
  });

  test("holds a build's phases before its program's run, in phase order", () => {
    const timings = new RunTimings();
    timings.begin();
    // As a build reports them: Go's steps first, then its summed fetch and compile, then the run.
    timings.record({ phase: "go-compile", ms: 812 });
    timings.record({ phase: "link", ms: 240 });
    timings.record({ phase: "fetch", ms: 95 });
    timings.record({ phase: "compile", ms: 1310 });
    timings.record({ phase: "instantiate", ms: 4 });
    timings.record({ phase: "run", ms: 3 });
    assert.deepEqual(pairs(timings), [
      ["fetch", 95],
      ["compile", 1310],
      ["go-compile", 812],
      ["link", 240],
      ["instantiate", 4],
      ["run", 3],
    ]);
    assert.equal(timings.total, 2464);
  });

  test("holds only the phases recorded, in the phase order whatever order they arrive in", () => {
    const timings = new RunTimings();
    timings.begin();
    timings.record({ phase: "call", ms: 0.6 });
    timings.record({ phase: "fetch", ms: 182.4 });
    timings.record({ phase: "start", ms: 12.8 });
    timings.record({ phase: "compile", ms: 96.3 });
    assert.deepEqual(pairs(timings), [
      ["fetch", 182.4],
      ["compile", 96.3],
      ["start", 12.8],
      ["call", 0.6],
    ]);
    assert.equal(timings.ms("compile"), 96.3);
    assert.equal(timings.ms("instantiate"), undefined);
    assert.equal(timings.ms("run"), undefined);
  });

  test("totals the phases recorded", () => {
    const timings = new RunTimings();
    timings.begin();
    timings.record({ phase: "instantiate", ms: 3.25 });
    timings.record({ phase: "run", ms: 41.5 });
    assert.equal(timings.total, 44.75);
    timings.record({ phase: "run", ms: 40 });
    assert.equal(timings.total, 43.25);
  });

  test("takes a timing event of the runtime's as it is, its type and scenario unread", () => {
    const timings = new RunTimings();
    const event = { type: "timing", scenario: "hello", phase: "run" as const, ms: 9 };
    timings.record(event);
    assert.deepEqual(pairs(timings), [["run", 9]]);
    assert.deepEqual(Object.keys(timings.phases[0]), ["phase", "ms"]);
  });

  test("a phase recorded again replaces its time, in its place", () => {
    const timings = new RunTimings();
    timings.begin();
    timings.record({ phase: "instantiate", ms: 4 });
    timings.record({ phase: "call", ms: 1 });
    timings.record({ phase: "instantiate", ms: 5 });
    assert.deepEqual(pairs(timings), [
      ["instantiate", 5],
      ["call", 1],
    ]);
  });

  test("a new run replaces the last: begin clears every phase and counts the run", () => {
    const timings = new RunTimings();
    timings.begin();
    timings.record({ phase: "fetch", ms: 100 });
    timings.record({ phase: "call", ms: 2 });
    timings.begin();
    assert.equal(timings.runs, 2);
    assert.deepEqual(timings.phases, []);
    assert.equal(timings.total, 0);
    timings.record({ phase: "call", ms: 0.4 });
    assert.deepEqual(pairs(timings), [["call", 0.4]]);
  });

  test("its phases are frozen snapshots, the same array until the timings change", () => {
    const timings = new RunTimings();
    timings.record({ phase: "run", ms: 1 });
    const phases = timings.phases;
    assert.ok(Object.isFrozen(phases));
    assert.ok(Object.isFrozen(phases[0]));
    assert.equal(timings.phases, phases);
    timings.record({ phase: "run", ms: 1 });
    assert.equal(timings.phases, phases, "a record that changes nothing keeps the array");
    timings.record({ phase: "run", ms: 2 });
    assert.notEqual(timings.phases, phases);
    assert.deepEqual(
      phases.map(({ phase, ms }) => [phase, ms]),
      [["run", 1]],
      "a snapshot never changes",
    );
  });

  test("refuses a phase the runtime doesn't name, naming why, and changes nothing", () => {
    const timings = new RunTimings();
    timings.record({ phase: "call", ms: 1 });
    const seen = heard(timings);
    const refused: [unknown, ErrorConstructor, RegExp][] = [
      [
        "wasm",
        RangeError,
        /one of fetch, compile, go-compile, link, instantiate, start, call, run, not "wasm"$/,
      ],
      ["Fetch", RangeError, /not "Fetch"$/],
      ["", RangeError, /not ""$/],
      [undefined, TypeError, /not undefined$/],
      [null, TypeError, /not null$/],
      [3, TypeError, /not 3$/],
    ];
    for (const [phase, kind, reason] of refused) {
      assert.match(phaseProblem(phase) ?? "", reason);
      assert.throws(
        () => timings.record({ phase: phase as Phase, ms: 1 }),
        (error: Error) => error instanceof kind && reason.test(error.message),
        `${String(phase)} is refused as a ${kind.name} naming why`,
      );
    }
    assert.deepEqual(pairs(timings), [["call", 1]]);
    assert.deepEqual(seen, [], "a refused record sends no change");
  });

  test("refuses a time that is negative, NaN, infinite, or not a number, naming why, and changes nothing", () => {
    const timings = new RunTimings();
    timings.record({ phase: "call", ms: 1 });
    const seen = heard(timings);
    const refused: [unknown, ErrorConstructor, RegExp][] = [
      [-1, RangeError, /finite number of ms, at least 0, not -1$/],
      [-0.001, RangeError, /not -0\.001$/],
      [Number.NaN, RangeError, /not NaN$/],
      [Number.POSITIVE_INFINITY, RangeError, /not Infinity$/],
      [Number.NEGATIVE_INFINITY, RangeError, /not -Infinity$/],
      ["12", TypeError, /a number of ms, not "12"$/],
      [undefined, TypeError, /not undefined$/],
      [null, TypeError, /not null$/],
    ];
    for (const [ms, kind, reason] of refused) {
      assert.match(msProblem(ms) ?? "", reason);
      assert.throws(
        () => timings.record({ phase: "call", ms: ms as number }),
        (error: Error) => error instanceof kind && reason.test(error.message),
        `${String(ms)} is refused as a ${kind.name} naming why`,
      );
      assert.throws(() => timings.record({ phase: "run", ms: ms as number }), kind);
    }
    assert.deepEqual(pairs(timings), [["call", 1]]);
    assert.deepEqual(seen, [], "a refused record sends no change");
  });

  test("holds 0 ms and a whole or fractional time", () => {
    for (const ms of [0, 0.05, 7, 1234.5678]) {
      assert.equal(msProblem(ms), null);
      const timings = new RunTimings();
      timings.record({ phase: "start", ms });
      assert.equal(timings.ms("start"), ms);
    }
  });

  test("sends one change for each change: every begin, and a record that adds or changes a phase", () => {
    const timings = new RunTimings();
    const seen = heard(timings);
    timings.begin();
    timings.record({ phase: "instantiate", ms: 3 });
    timings.record({ phase: "instantiate", ms: 3 });
    timings.record({ phase: "run", ms: 10 });
    timings.record({ phase: "run", ms: 11 });
    timings.begin();
    timings.begin();
    assert.deepEqual(seen, [
      { runs: 1, phases: [] },
      { runs: 1, phases: [["instantiate", 3]] },
      {
        runs: 1,
        phases: [
          ["instantiate", 3],
          ["run", 10],
        ],
      },
      {
        runs: 1,
        phases: [
          ["instantiate", 3],
          ["run", 11],
        ],
      },
      { runs: 2, phases: [] },
      { runs: 3, phases: [] },
    ]);
  });
});
