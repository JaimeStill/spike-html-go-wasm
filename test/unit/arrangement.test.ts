// A fixed demo's arrangement model, web/components/arrangement.ts, under node with no browser: its
// default, its validation and the reasons it names, and its change event, sent once for each
// change and never for a set that changes nothing.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  Arrangement,
  DEFAULT_PLACEMENT,
  type Placement,
  PLACEMENTS,
  placementProblem,
} from "../../web/components/arrangement.ts";

/** The placement after each change event, in order, as the events arrive. */
function heard(arrangement: Arrangement): Placement[] {
  const seen: Placement[] = [];
  arrangement.addEventListener("change", (event) => {
    assert.equal(event.target, arrangement);
    seen.push(arrangement.placement);
  });
  return seen;
}

describe("Arrangement", () => {
  test("defaults to the editor left, and holds left, top, and right, in the menu's order", () => {
    assert.equal(new Arrangement().placement, "left");
    assert.equal(DEFAULT_PLACEMENT, "left");
    assert.deepEqual(PLACEMENTS, ["left", "top", "right"]);
    assert.ok(Object.isFrozen(PLACEMENTS), "no one can change the placements every menu offers");
  });

  test("takes its initial placement, validated", () => {
    for (const placement of PLACEMENTS) {
      assert.equal(placementProblem(placement), null);
      assert.equal(new Arrangement(placement).placement, placement);
    }
    assert.throws(() => new Arrangement("bottom" as Placement), RangeError);
    assert.throws(() => new Arrangement(1 as unknown as Placement), TypeError);
  });

  test("refuses a value that isn't a placement, naming why, and keeps its own", () => {
    const arrangement = new Arrangement("top");
    const seen = heard(arrangement);
    const refused: [unknown, ErrorConstructor, string][] = [
      ["bottom", RangeError, `"bottom"`],
      ["Left", RangeError, `"Left"`],
      ["", RangeError, `""`],
      [" left", RangeError, `" left"`],
      [null, TypeError, "null"],
      [0, TypeError, "0"],
      [true, TypeError, "true"],
      [undefined, TypeError, "undefined"],
    ];
    for (const [value, type, named] of refused) {
      const reason = `an arrangement must be "left", "top", or "right", not ${named}`;
      assert.equal(placementProblem(value), reason);
      assert.throws(
        () => (arrangement.placement = value as Placement),
        (error: Error) => error instanceof type && error.message === reason,
        `${String(value)} is refused`,
      );
    }
    assert.equal(arrangement.placement, "top");
    assert.deepEqual(seen, []);
  });

  test("sends one change for each set that changes the placement, and none for one that doesn't", () => {
    const arrangement = new Arrangement();
    const seen = heard(arrangement);
    arrangement.placement = "left";
    arrangement.placement = "right";
    arrangement.placement = "right";
    arrangement.placement = "top";
    arrangement.placement = "left";
    assert.deepEqual(seen, ["right", "top", "left"]);
  });
});
