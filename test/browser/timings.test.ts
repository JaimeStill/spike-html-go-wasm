// sl-timings on the components page, the build as Pages serves it: dist/ under the base by the
// SDK's served(), Vite's preview, in the pinned chrome-headless-shell.
//
// The accessibility tree, read through CDP: a table named by its caption, its column headers, a
// row header for each phase and the total, each time its cell. Rendering: only the phases the run
// had, in the runtime's phase order whatever order they arrived in, and a total row; the times
// formatted to a tenth under 10 ms and whole from there, grouped, right-aligned in tabular
// numerals; no run yet said, with no total, and a run begun with no phase timed said apart from
// it; at a phone's width the table fits its column. A new run replaces the last, on the owner's begin and on
// the specimen aid's press. The table listens only to the timings it holds, only while in the
// document, and nothing moves. Nothing here names the site: its base is package.json's name.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch, SETTLED, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import { PHONE, viewport } from "./viewport.ts";

const root = join(import.meta.dirname, "../..");

let server: Server;
let browser: Browser;

before(async () => {
  server = await served(root);
  browser = await launch();
});
after(async () => {
  await browser?.close();
  await server?.stop();
});

/** The page's helpers, installed on window.timings once the page has loaded:
 *
 * - figure(state): the figure data-state names in the states list of #timings; at(state) its
 *   sl-timings.
 * - rows(table): once its pending render is done, each body row as it renders, its header's text
 *   and its cell's, and the total row's, or null with none.
 * - loose(timings): a table of the timings, in the "empty" figure, with no owner.
 * - counted(timings): the timings, their change listeners counted in timings.listeners as tables
 *   add and remove them.
 * - RunTimings: the page's model class, read from a table's timings.
 */
const HELPERS = `(() => {
  const figure = (state) =>
    document.querySelector("#timings .states").querySelector(\`figure[data-state="\${state}"]\`);
  const text = (cell) => cell?.textContent.trim() ?? null;
  window.timings = {
    figure,
    at: (state) => figure(state).querySelector("sl-timings"),
    async rows(table) {
      await table.updateComplete;
      const root = table.shadowRoot;
      const total = root.querySelector("tfoot tr");
      return {
        body: [...root.querySelectorAll("tbody tr")].map((row) =>
          [text(row.querySelector("th")), text(row.querySelector("td"))]),
        total: total ? [text(total.querySelector("th")), text(total.querySelector("td"))] : null,
      };
    },
    loose(timings) {
      const table = document.createElement("sl-timings");
      table.timings = timings;
      figure("empty").append(table);
      return table;
    },
    counted(timings) {
      timings.listeners = 0;
      const add = timings.addEventListener.bind(timings);
      const remove = timings.removeEventListener.bind(timings);
      timings.addEventListener = (type, listener) => {
        if (type === "change") timings.listeners++;
        add(type, listener);
      };
      timings.removeEventListener = (type, listener) => {
        if (type === "change") timings.listeners--;
        remove(type, listener);
      };
      return timings;
    },
    RunTimings: figure("cold").querySelector("sl-timings").timings.constructor,
  };
})()`;

/** Opens the components page, waits for every element to render, and installs the helpers. */
async function open(): Promise<Page> {
  const page = await browser.open(`${server.origin}components.html`);
  await page.evaluate(SETTLED);
  await page.evaluate(HELPERS);
  return page;
}

/** A table's body rows and total row, each [header, cell]. */
interface Rows {
  body: [string | null, string | null][];
  total: [string | null, string | null] | null;
}

/** The rows of the table the expression gives, once its pending render is done. */
const rows = (page: Page, table: string): Promise<Rows> =>
  page.evaluate(`window.timings.rows(${table})`);

/** A node of the accessibility tree, as CDP gives it. */
interface AXNode {
  ignored: boolean;
  role?: { value: string };
  name?: { value: string };
}

/** The nodes of the role in the accessibility tree under the element the expression gives. */
async function axQuery(page: Page, expression: string, role: string): Promise<AXNode[]> {
  const { result } = await page.cdp("Runtime.evaluate", { expression });
  const { nodes }: { nodes: AXNode[] } = await page.cdp("Accessibility.queryAXTree", {
    objectId: result.objectId,
    role,
  });
  return nodes.filter((node) => !node.ignored);
}

const names = (nodes: AXNode[]) => nodes.map((node) => node.name?.value);

describe("the timings in the accessibility tree", () => {
  test("a table named by its caption, its column headers, and a row header for each phase and the total", async () => {
    const page = await open();
    try {
      const figure = `window.timings.figure("program")`;
      const tables = await axQuery(page, figure, "table");
      assert.deepEqual(names(tables), ["Timings"]);
      assert.deepEqual(names(await axQuery(page, figure, "columnheader")), ["Phase", "Time"]);
      assert.deepEqual(names(await axQuery(page, figure, "rowheader")), [
        "Instantiate",
        "Run",
        "Total",
      ]);
      assert.deepEqual(names(await axQuery(page, figure, "cell")), [
        "3.1 ms",
        "1,535 ms",
        "1,538 ms",
      ]);
      // The label names the table.
      await page.evaluate(`window.timings.at("program").label = "hello's timings"`);
      await page.evaluate(`window.timings.at("program").updateComplete`);
      assert.deepEqual(names(await axQuery(page, figure, "table")), ["hello's timings"]);
    } finally {
      await page.close();
    }
  });
});

describe("the timings' rendering", () => {
  test("shows only the phases the run had, in phase order, and their total", async () => {
    const page = await open();
    try {
      assert.deepEqual(await rows(page, `window.timings.at("cold")`), {
        body: [
          ["Fetch", "182 ms"],
          ["Compile", "96 ms"],
          ["Instantiate", "4.2 ms"],
          ["Start", "13 ms"],
          ["Call", "0.6 ms"],
        ],
        total: ["Total", "296 ms"],
      });
      assert.deepEqual(await rows(page, `window.timings.at("held")`), {
        body: [["Call", "0.4 ms"]],
        total: ["Total", "0.4 ms"],
      });
      // Run arrived before instantiate; the table shows the phase order.
      assert.deepEqual(await rows(page, `window.timings.at("program")`), {
        body: [
          ["Instantiate", "3.1 ms"],
          ["Run", "1,535 ms"],
        ],
        total: ["Total", "1,538 ms"],
      });
      assert.deepEqual(await rows(page, `window.timings.at("after-stop")`), {
        body: [
          ["Instantiate", "5.6 ms"],
          ["Start", "12 ms"],
          ["Call", "10 ms"],
        ],
        total: ["Total", "28 ms"],
      });
    } finally {
      await page.close();
    }
  });

  test("formats a time to a tenth while it rounds under 10 ms, whole from there, grouped", async () => {
    const page = await open();
    try {
      const cases: [number, string][] = [
        [0, "0.0 ms"],
        [0.04, "0.0 ms"],
        [0.05, "0.1 ms"],
        [3, "3.0 ms"],
        [9.94, "9.9 ms"],
        [9.95, "10 ms"],
        [10, "10 ms"],
        [10.5, "11 ms"],
        [999.4, "999 ms"],
        [1234.5, "1,235 ms"],
        [65432.1, "65,432 ms"],
      ];
      for (const [ms, shown] of cases) {
        const got = await rows(
          page,
          `(() => {
            const timings = new window.timings.RunTimings();
            timings.record({ phase: "call", ms: ${ms} });
            window.table?.remove();
            window.table = window.timings.loose(timings);
            return window.table;
          })()`,
        );
        assert.deepEqual(got.body, [["Call", shown]], `${ms} ms`);
        assert.deepEqual(got.total, ["Total", shown], `${ms} ms in total`);
      }
    } finally {
      await page.close();
    }
  });

  test("the times are right-aligned in tabular numerals, the total set apart by weight", async () => {
    const page = await open();
    try {
      const styles: { align: string; numerals: string; wrap: string; weight: string }[] =
        await page.evaluate(`(() => {
          const root = window.timings.at("cold").shadowRoot;
          return [...root.querySelectorAll("tbody td, tfoot td")].map((cell) => {
            const style = getComputedStyle(cell);
            return {
              align: style.textAlign,
              numerals: style.fontVariantNumeric,
              wrap: style.whiteSpace,
              weight: style.fontWeight,
            };
          });
        })()`);
      assert.equal(styles.length, 6);
      for (const style of styles) {
        assert.equal(style.align, "end");
        assert.equal(style.numerals, "tabular-nums");
        assert.equal(style.wrap, "nowrap");
      }
      assert.ok(Number(styles.at(-1)?.weight) > Number(styles[0].weight), "the total is bolder");
      // Right-aligned: the times' inline ends meet.
      const ends: number[] = await page.evaluate(`(() => {
        const root = window.timings.at("cold").shadowRoot;
        return [...root.querySelectorAll("tbody td, tfoot td")].map((cell) => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          return Math.round(range.getBoundingClientRect().right);
        });
      })()`);
      assert.equal(new Set(ends).size, 1, `the times end together: ${ends}`);
    } finally {
      await page.close();
    }
  });

  test("with no run yet it says so, with no total; a run begun with no phase timed says that", async () => {
    const page = await open();
    try {
      assert.deepEqual(await rows(page, `window.timings.at("empty")`), {
        body: [[null, "No run yet."]],
        total: null,
      });
      assert.deepEqual(
        names(await axQuery(page, `window.timings.figure("empty")`, "table")),
        ["Timings"],
        "the empty table is still named",
      );
      await page.evaluate(`window.timings.at("empty").timings.begin()`);
      assert.deepEqual(await rows(page, `window.timings.at("empty")`), {
        body: [[null, "No phase timed yet."]],
        total: null,
      });
      await page.evaluate(`window.timings.at("empty").timings = null`);
      assert.deepEqual(await rows(page, `window.timings.at("empty")`), {
        body: [[null, "No run yet."]],
        total: null,
      });
    } finally {
      await page.close();
    }
  });

  test("at a phone's width the table fits its column, and nothing scrolls sideways", async () => {
    const page = await open();
    try {
      await viewport(page, PHONE);
      for (const state of ["cold", "program", "empty"]) {
        const fit: { table: number; figure: number; sideways: boolean; page: boolean } =
          await page.evaluate(`(() => {
            const host = window.timings.at("${state}");
            const table = host.shadowRoot.querySelector("table");
            return {
              table: table.getBoundingClientRect().width,
              figure: host.parentElement.getBoundingClientRect().width,
              sideways: host.scrollWidth > host.clientWidth,
              page: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            };
          })()`);
        assert.ok(
          fit.figure < PHONE,
          `${state}: the column is narrower than the page, ${fit.figure}px`,
        );
        assert.ok(fit.table <= fit.figure, `${state}: ${fit.table}px in ${fit.figure}px`);
        assert.equal(fit.sideways, false, state);
        assert.equal(fit.page, false, state);
      }
    } finally {
      await page.close();
    }
  });
});

describe("a new run", () => {
  test("replaces the last: the owner's begin clears it, and the new run's phases show alone", async () => {
    const page = await open();
    try {
      const table = `window.timings.at("cold")`;
      await page.evaluate(`(() => {
        const timings = ${table}.timings;
        timings.begin();
        timings.record({ phase: "run", ms: 42 });
        timings.record({ phase: "instantiate", ms: 2.5 });
      })()`);
      assert.deepEqual(await rows(page, table), {
        body: [
          ["Instantiate", "2.5 ms"],
          ["Run", "42 ms"],
        ],
        total: ["Total", "45 ms"],
      });
    } finally {
      await page.close();
    }
  });

  test("the specimen aid's press begins a new run in place of the last, and the next another", async () => {
    const page = await open();
    try {
      const table = `window.timings.at("replaced")`;
      const before = await rows(page, table);
      assert.equal(before.body.length, 5);
      await page.evaluate(
        `window.timings.figure("replaced").querySelector(".readout button").click()`,
      );
      await until(page, `${table}.shadowRoot.querySelectorAll("tbody tr").length === 1`, 5000);
      assert.deepEqual(await rows(page, table), {
        body: [["Call", "0.4 ms"]],
        total: ["Total", "0.4 ms"],
      });
      await page.evaluate(
        `window.timings.figure("replaced").querySelector(".readout button").click()`,
      );
      await until(page, `${table}.shadowRoot.querySelectorAll("tbody tr").length === 5`, 5000);
      assert.deepEqual(await rows(page, table), before);
    } finally {
      await page.close();
    }
  });
});

describe("the timings' subscription", () => {
  test("it listens only to the timings it holds, only while in the document", async () => {
    const page = await open();
    try {
      await page.evaluate(`(() => {
        window.a = window.timings.counted(new window.timings.RunTimings());
        window.b = window.timings.counted(new window.timings.RunTimings());
        window.a.record({ phase: "call", ms: 1 });
        window.b.record({ phase: "run", ms: 20 });
        window.held = document.createElement("sl-timings");
        window.held.timings = window.a;
      })()`);
      const counts = () =>
        page.evaluate(
          `window.held.updateComplete.then(() => [window.a.listeners, window.b.listeners])`,
        );
      assert.deepEqual(
        await page.evaluate(`[window.a.listeners, window.b.listeners]`),
        [0, 0],
        "never in the document, it listens to none",
      );
      await page.evaluate(`window.timings.figure("empty").append(window.held)`);
      assert.deepEqual(await counts(), [1, 0], "in the document, it listens to the timings held");
      await page.evaluate(`window.held.remove()`);
      assert.deepEqual(await counts(), [0, 0], "removed, it stops");
      await page.evaluate(`window.a.record({ phase: "call", ms: 2 })`);
      await page.evaluate(`window.timings.figure("empty").append(window.held)`);
      assert.deepEqual(await counts(), [1, 0]);
      assert.deepEqual(
        (await rows(page, "window.held")).body,
        [["Call", "2.0 ms"]],
        "reconnected, it shows the timings as they now are",
      );
      await page.evaluate(`window.a.record({ phase: "call", ms: 3 })`);
      assert.deepEqual((await rows(page, "window.held")).body, [["Call", "3.0 ms"]]);
      await page.evaluate(`window.held.timings = window.b`);
      assert.deepEqual(await counts(), [0, 1], "replaced, it leaves the old timings for the new");
      assert.deepEqual((await rows(page, "window.held")).body, [["Run", "20 ms"]]);
      await page.evaluate(`window.a.record({ phase: "call", ms: 4 })`);
      assert.deepEqual((await rows(page, "window.held")).body, [["Run", "20 ms"]]);
      await page.evaluate(`window.held.timings = null`);
      assert.deepEqual(await counts(), [0, 0]);
    } finally {
      await page.close();
    }
  });
});

describe("motion", () => {
  test("nothing moves, with motion allowed or reduced", async () => {
    const page = await open();
    try {
      for (const value of ["no-preference", "reduce"]) {
        await page.cdp("Emulation.setEmulatedMedia", {
          features: [{ name: "prefers-reduced-motion", value }],
        });
        const moving: string[] = await page.evaluate(`(() => {
          const root = window.timings.at("cold").shadowRoot;
          return [...root.querySelectorAll("*")].filter((element) => {
            const style = getComputedStyle(element);
            return style.animationName !== "none" || style.scrollBehavior !== "auto" ||
              style.transitionDuration.split(",").some((d) => parseFloat(d) > 0);
          }).map((element) => element.localName);
        })()`);
        assert.deepEqual(moving, [], value);
      }
    } finally {
      await page.close();
    }
  });
});
