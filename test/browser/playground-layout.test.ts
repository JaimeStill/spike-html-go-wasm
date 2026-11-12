// The playground's fixed layout, playground.html's one sl-go-demo with `fixed`: the build as Pages
// serves it, dist/ under the base by the SDK's served(), Vite's preview, in the pinned
// chrome-headless-shell.
//
// The demo is as tall as the viewport less the page's header, and its parts keep their shares of
// that height at every width: at the SDK's three capture widths, 390, 1120, and 1376 px, and at
// widths that put the demo itself half a rem either side of its two bands' edges, 44rem and 64rem,
// a paste of 500 lines into the editor, 10,000 lines printed, and a full table of a build's timings
// change no part's box, in each arrangement from 64rem, each placing the parts as it says; the
// page never scrolls sideways; and every part lies inside the demo. A Run, a Stop, a failed build,
// a band change, and an arrangement change keep each part's content and scroll position, and the
// output tab chosen. Below 44rem, the output panel's tablist is the tabs pattern, its
// keyboard and accessibility tree the file tabs'; from 44rem it isn't there, and the console and
// the timings are no tabpanels. A demo without `fixed`, the components page's, has no output
// tablist and a console that grows. The helpers are go-demos.ts's, go-builds.ts's, and
// playground-layouts.ts's. playground-arrangement.test.ts proves the Layout menu and the stored
// choice. Every wait is bounded.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import { BUILD, build, BUILT_PHASES, DONE } from "./go-builds.ts";
import { demo, open as openPage, pressControl, says, settle } from "./go-demos.ts";
import {
  arrange,
  type AXNode,
  axQuery,
  type Band,
  comments,
  contained,
  kept,
  layout,
  type Layout,
  paste,
  type Placement,
  PLACEMENTS,
  placedAs,
  PLAYGROUND,
  press,
  printing,
  property,
  widthFor,
} from "./playground-layouts.ts";
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

/** Opens the playground, watched (go-demos.ts). */
const open = async () => (await openPage(browser, server.origin, "playground.html")).page;

/** A width the layout is proved at: a name for messages, its px, the band it gives, and the
 * placement the demo is in there; the narrower bands are proved in the default alone, where no
 * other is offered. */
interface Proved {
  name: string;
  width: number;
  band: Band;
  placement: Placement;
}

/** The widths the layout is proved at, the SDK's three and the demo half a rem either side of 44rem
 * and 64rem, each from 64rem in every placement. */
async function widths(page: Page): Promise<Proved[]> {
  const narrow: Omit<Proved, "placement">[] = [
    { name: "390px", width: PHONE, band: "phone" },
    { name: "43.5rem", width: await widthFor(page, 43.5), band: "phone" },
    { name: "44.5rem", width: await widthFor(page, 44.5), band: "middle" },
    { name: "63.5rem", width: await widthFor(page, 63.5), band: "middle" },
  ];
  const wide: Omit<Proved, "placement">[] = [
    { name: "64.5rem", width: await widthFor(page, 64.5), band: "wide" },
    { name: "1120px", width: 1120, band: "wide" },
    { name: "1376px", width: 1376, band: "wide" },
  ];
  return [
    ...narrow.map((each) => ({ ...each, placement: "left" as const })),
    ...PLACEMENTS.flatMap((placement) =>
      wide.map((each) => ({ ...each, name: `${each.name}, editor ${placement}`, placement })),
    ),
  ];
}

/** Lays the page out at the width, in the placement where the band offers one. */
async function at(page: Page, { width, band, placement }: Proved): Promise<void> {
  await viewport(page, width);
  if (band === "wide") await arrange(page, placement);
}

/** Scrolls the editor's frame and the console's log frame to the positions given. */
const scrollParts = (page: Page, editor: number, log: number) =>
  page.evaluate(`(() => {
    const root = ${PLAYGROUND}.shadowRoot;
    root.querySelector("sl-code-editor").shadowRoot.querySelector(".editor").scrollTop = ${editor};
    const frame = root.querySelector("sl-console").shadowRoot.querySelector(".frame");
    frame.scrollTop = ${log};
    frame.dispatchEvent(new Event("scroll"));
  })()`);

/** Selects the output part by a click on its tab. */
const choose = (page: Page, part: "console" | "timings") =>
  page.evaluate(
    `${PLAYGROUND}.shadowRoot.querySelector('.output-tabs [data-part="${part}"]').click()`,
  );

describe("the playground's fixed layout", () => {
  test("at each width, a paste of 500 lines, 10,000 lines printed, and a full timings table change no part's box; nothing scrolls the page sideways, and every part lies inside the demo", async () => {
    const page = await open();
    try {
      const proved = await widths(page);
      const before = new Map<string, Layout>();
      for (const each of proved) {
        const { name, width, band, placement } = each;
        await at(page, each);
        const laid = await layout(page);
        assert.equal(laid.band, band, `the band at ${name}`);
        if (band === "wide") placedAs(laid, placement, name);
        // Below 44rem the timings share the console's cell, hidden behind its tab.
        assert.equal(laid.parts.outputTabs.shown, band === "phone", `the output tabs at ${name}`);
        assert.equal(laid.parts.timings.shown, band !== "phone", `the timings at ${name}`);
        contained(laid, width);
        before.set(name, laid);
      }

      await viewport(page, PHONE);
      await paste(page, printing(10_000), true);
      const printed = await build(page, PLAYGROUND, DONE);
      assert.deepEqual(printed.phases, BUILT_PHASES, "a full timings table");
      assert.equal(printed.lines.at(-1)?.text, "line 10000");
      const lines = (await page.evaluate(
        `window.demos.editor(${PLAYGROUND}).value.split("\\n").length`,
      )) as number;
      await paste(page, comments(500));
      await until(
        page,
        `window.demos.editor(${PLAYGROUND}).value.split("\\n").length === ${lines + 500}`,
        5000,
      );

      for (const each of proved) {
        const { name, width } = each;
        await at(page, each);
        const laid = await layout(page);
        assert.deepEqual(laid, before.get(name), `every part's box at ${name}`);
        contained(laid, width);
        const overflows = await page.evaluate(`(() => {
          const root = ${PLAYGROUND}.shadowRoot;
          const editor = root.querySelector("sl-code-editor").shadowRoot.querySelector(".editor");
          const log = root.querySelector("sl-console").shadowRoot.querySelector(".frame");
          return [editor.scrollHeight > editor.clientHeight, log.scrollHeight > log.clientHeight];
        })()`);
        assert.deepEqual(overflows, [true, true], `the editor and the log scroll at ${name}`);
      }
      // The reader's choice is kept for the origin: the default again for the tests after.
      await arrange(page, "left");
    } finally {
      await page.close();
    }
  });

  test("a Run, a Stop, a failed build, a band change, and an arrangement change keep each part's content and scroll position, and the output tab chosen", async () => {
    const page = await open();
    try {
      await viewport(page, PHONE);
      await paste(page, printing(2000, true) + comments(300), true);
      await scrollParts(page, 800, 0);
      await pressControl(page, PLAYGROUND, "run");
      await until(
        page,
        `window.demos.rows(${PLAYGROUND}).some((row) => row.text === "line 2000")`,
        BUILD,
      );
      await settle(page);
      await scrollParts(page, 800, 1000);
      await choose(page, "timings");
      const running = await kept(page);
      assert.deepEqual(
        { editor: running.editor, log: running.log, selected: running.selected },
        { editor: 800, log: 1000, selected: "timings" },
        "a Run keeps the editor's scroll",
      );
      assert.equal(running.rows, 2000);

      for (const width of [1120, await widthFor(page, 52), 1376, PHONE]) {
        await viewport(page, width);
        await settle(page);
        assert.deepEqual(await kept(page), running, `at ${width}px`);
      }
      await viewport(page, 1376);
      for (const placement of ["top", "right", "left"] as const) {
        await arrange(page, placement);
        assert.deepEqual(await kept(page), running, `in editor ${placement}`);
      }
      await viewport(page, PHONE);
      await settle(page);

      await pressControl(page, PLAYGROUND, "stop");
      await says(page, PLAYGROUND, "Stopped main", 5000);
      await settle(page);
      assert.deepEqual(await kept(page), running, "after Stop");

      // A build that fails: an edit at the end, then Run.
      await paste(page, "x\n");
      await settle(page);
      const edited = await kept(page);
      await pressControl(page, PLAYGROUND, "run");
      await says(page, PLAYGROUND, "Failed main: compile exited with code 2", BUILD);
      await settle(page);
      const failed = await kept(page);
      assert.deepEqual(
        { editor: failed.editor, value: failed.value, selected: failed.selected },
        { editor: edited.editor, value: edited.value, selected: "timings" },
        "a failed build keeps the editor and the tab chosen",
      );
    } finally {
      await page.close();
    }
  });
});

const selected = (node: AXNode) => property(node, "selected") === true;

/** The focused output tab's part, each tab's tabindex, and which output parts show. */
const tabState = (page: Page) =>
  page.evaluate(`(() => {
    const root = ${PLAYGROUND}.shadowRoot;
    const tabs = [...root.querySelectorAll('.output-tabs [role="tab"]')];
    const shows = (selector) => root.querySelector(selector).checkVisibility({ visibilityProperty: true });
    return {
      focused: root.activeElement?.dataset.part ?? null,
      selected: tabs.find((tab) => tab.ariaSelected === "true")?.dataset.part,
      tabindex: tabs.map((tab) => tab.tabIndex),
      console: shows("sl-console"),
      timings: shows("sl-timings"),
    };
  })()`);

describe("the phone's output tablist", () => {
  test("is a tablist, Output panel, of Output and Timings, each controlling its tabpanel, the selected one alone shown; from 44rem it isn't there, and neither part is a tabpanel", async () => {
    const page = await open();
    try {
      await viewport(page, PHONE);
      await page.cdp("DOM.getDocument", {});
      const lists = await axQuery(page, PLAYGROUND, "tablist");
      assert.deepEqual(
        lists.map((node) => node.name?.value),
        ["Files", "Output panel"],
      );
      const tabs = await axQuery(page, `${PLAYGROUND}.shadowRoot.querySelector(".output")`, "tab");
      assert.deepEqual(
        tabs.map((node) => [node.name?.value, selected(node)]),
        [
          ["Output", true],
          ["Timings", false],
        ],
      );
      const panels = async () =>
        (await axQuery(page, `${PLAYGROUND}.shadowRoot.querySelector(".output")`, "tabpanel")).map(
          (node) => node.name?.value,
        );
      assert.deepEqual(await panels(), ["Output"], "the console, named by its tab");
      const controls = await page.evaluate(`[...${PLAYGROUND}.shadowRoot
        .querySelectorAll('.output-tabs [role="tab"]')].map((tab) => tab.getAttribute("aria-controls"))`);
      assert.deepEqual(controls, ["console", "timings"]);
      await choose(page, "timings");
      await settle(page);
      assert.deepEqual(await panels(), ["Timings"], "the timings, named by its tab");

      await viewport(page, await widthFor(page, 52));
      await settle(page);
      assert.deepEqual(
        (await axQuery(page, PLAYGROUND, "tablist")).map((node) => node.name?.value),
        ["Files"],
      );
      assert.deepEqual(await panels(), []);
      const shown = await tabState(page);
      assert.deepEqual([shown.console, shown.timings], [true, true]);
    } finally {
      await page.close();
    }
  });

  test("the selected tab alone is in the tab order; Left and Right select the previous and the next, wrapping, Home and End the first and the last", async () => {
    const page = await open();
    try {
      await viewport(page, PHONE);
      await page.evaluate(
        `${PLAYGROUND}.shadowRoot.querySelector('.output-tabs [aria-selected="true"]').focus()`,
      );
      const at = (part: "console" | "timings") => ({
        focused: part,
        selected: part,
        tabindex: part === "console" ? [0, -1] : [-1, 0],
        console: part === "console",
        timings: part === "timings",
      });
      assert.deepEqual(await tabState(page), at("console"));
      const steps: ["ArrowRight" | "ArrowLeft" | "Home" | "End", "console" | "timings"][] = [
        ["ArrowRight", "timings"],
        ["ArrowRight", "console"],
        ["ArrowLeft", "timings"],
        ["ArrowLeft", "console"],
        ["End", "timings"],
        ["Home", "console"],
      ];
      for (const [key, part] of steps) {
        await press(page, key);
        await settle(page);
        assert.deepEqual(await tabState(page), at(part), `${key} to ${part}`);
      }
    } finally {
      await page.close();
    }
  });
});

describe("a demo without fixed", () => {
  test("has no output tablist, and its console grows as before", async () => {
    const { page } = await openPage(browser, server.origin);
    try {
      const target = demo("program");
      const shown = await page.evaluate(`(() => {
        const root = ${target}.shadowRoot;
        return {
          tabs: root.querySelector(".output-tabs"),
          fill: root.querySelector("sl-console").hasAttribute("fill"),
          max: getComputedStyle(root.querySelector("sl-console").shadowRoot.querySelector(".frame"))
            .maxBlockSize,
        };
      })()`);
      assert.deepEqual(shown, { tabs: null, fill: false, max: "384px" });
    } finally {
      await page.close();
    }
  });
});
