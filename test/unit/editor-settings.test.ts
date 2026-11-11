// The code editor's settings model, web/components/editor-settings.ts, under node with no
// browser: its defaults, its validation and the reasons it names, and its change event, sent once
// for each change and never for a set that changes nothing.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  defaults,
  EditorSettings,
  tabSizeProblem,
  wrapProblem,
} from "../../web/components/editor-settings.ts";

/** The settings' values after each change event, in order, as the events arrive. */
function heard(settings: EditorSettings): { wrap: boolean; tabSize: number }[] {
  const seen: { wrap: boolean; tabSize: number }[] = [];
  settings.addEventListener("change", (event) => {
    assert.equal(event.target, settings);
    seen.push({ wrap: settings.wrap, tabSize: settings.tabSize });
  });
  return seen;
}

describe("EditorSettings", () => {
  test("defaults to scrolling long lines and a tab four columns wide", () => {
    const settings = new EditorSettings();
    assert.deepEqual({ wrap: settings.wrap, tabSize: settings.tabSize }, defaults);
    assert.deepEqual(defaults, { wrap: false, tabSize: 4 });
    assert.ok(Object.isFrozen(defaults), "no one can change the defaults every editor shows");
  });

  test("takes its initial values, each validated, the rest at the defaults", () => {
    const wrapped = new EditorSettings({ wrap: true });
    assert.deepEqual({ wrap: wrapped.wrap, tabSize: wrapped.tabSize }, { wrap: true, tabSize: 4 });
    const narrow = new EditorSettings({ tabSize: 2 });
    assert.deepEqual({ wrap: narrow.wrap, tabSize: narrow.tabSize }, { wrap: false, tabSize: 2 });
    assert.throws(() => new EditorSettings({ tabSize: 9 }), RangeError);
    assert.throws(() => new EditorSettings({ wrap: "yes" as unknown as boolean }), TypeError);
  });

  test("holds every whole tab size from 1 to 8", () => {
    const settings = new EditorSettings();
    for (let size = 1; size <= 8; size++) {
      assert.equal(tabSizeProblem(size), null);
      settings.tabSize = size;
      assert.equal(settings.tabSize, size);
    }
  });

  test("refuses a tab size out of range or not a whole number, naming why, and keeps its value", () => {
    const settings = new EditorSettings({ tabSize: 2 });
    const seen = heard(settings);
    const refused: [unknown, ErrorConstructor, RegExp][] = [
      [0, RangeError, /from 1 to 8 columns, not 0$/],
      [9, RangeError, /from 1 to 8 columns, not 9$/],
      [-4, RangeError, /from 1 to 8 columns, not -4$/],
      [2.5, RangeError, /whole number, not 2\.5$/],
      [Number.NaN, RangeError, /whole number, not NaN$/],
      [Number.POSITIVE_INFINITY, RangeError, /whole number, not Infinity$/],
      ["4", TypeError, /whole number, not "4"$/],
      [null, TypeError, /whole number, not null$/],
      [undefined, TypeError, /whole number, not undefined$/],
    ];
    for (const [value, kind, reason] of refused) {
      assert.match(tabSizeProblem(value) ?? "", reason);
      assert.throws(
        () => {
          settings.tabSize = value as number;
        },
        (error: Error) => error instanceof kind && reason.test(error.message),
        `${String(value)} is refused as a ${kind.name} naming why`,
      );
      assert.equal(settings.tabSize, 2, `${String(value)} leaves the tab size as it was`);
    }
    assert.deepEqual(seen, [], "a refused set sends no change");
  });

  test("refuses a wrap that isn't a boolean, naming why, and keeps its value", () => {
    const settings = new EditorSettings({ wrap: true });
    const seen = heard(settings);
    for (const value of [1, "true", null, undefined]) {
      assert.match(wrapProblem(value) ?? "", /^wrap must be true or false, not /);
      assert.throws(() => {
        settings.wrap = value as unknown as boolean;
      }, TypeError);
      assert.equal(settings.wrap, true);
    }
    assert.equal(wrapProblem(false), null);
    assert.deepEqual(seen, []);
  });

  test("sends one change for each set that changes a value, and none for a set to the same", () => {
    const settings = new EditorSettings();
    const seen = heard(settings);
    settings.wrap = false;
    settings.tabSize = 4;
    assert.deepEqual(seen, [], "setting the values held sends nothing");
    settings.wrap = true;
    settings.wrap = true;
    settings.tabSize = 8;
    settings.tabSize = 8;
    settings.tabSize = 2;
    settings.wrap = false;
    assert.deepEqual(seen, [
      { wrap: true, tabSize: 4 },
      { wrap: true, tabSize: 8 },
      { wrap: true, tabSize: 2 },
      { wrap: false, tabSize: 2 },
    ]);
  });

  test("each instance is its own: changing one leaves another as it was and sends it nothing", () => {
    const first = new EditorSettings();
    const second = new EditorSettings();
    const seen = heard(second);
    first.wrap = true;
    first.tabSize = 2;
    assert.deepEqual({ wrap: second.wrap, tabSize: second.tabSize }, defaults);
    assert.deepEqual(seen, []);
  });
});
