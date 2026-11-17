// The playground's fixed layout, playground.html's one sl-go-demo with `fixed`: the build as Pages
// serves it, dist/ under the base by the SDK's served(), Vite's preview, in the pinned
// chrome-headless-shell, drawing in the font set the test file that imports this suite chose
// (fonts.ts): playground-layout.test.ts runs it in the machine's fonts, and
// playground-layout-dejavu.test.ts in the pinned DejaVu font set, under a test-only fontconfig,
// where a first test proves the page draws in DejaVu alone.
//
// The page is one screen, in CSS alone, an app page (web/pages/page.css): at the SDK's three
// capture sizes, each also 900px tall, at 1120x800, and at the middle capture's 900x700, the demo
// takes every row the header, the heading, and the lede leave, and ends a gutter above the
// viewport's bottom edge, the one gutter that holds the page off both its sides, every part's
// bottom border inside the demo and in view, the page scrolling neither way, in each arrangement
// from 64rem, and no script sizing the demo; at each capture size the demo stands above its floor,
// the least height at which the editor's frame holds six of its lines and the console's log two,
// by a headroom the test reports. On a short screen, 390x600 or 1376x400, or at twice the text
// size, the demo holds its floor, one of those parts at exactly it, and the page scrolls down,
// never sideways, the demo ending a gutter above the page's end.
//
// The demo's parts keep their shares of its height at every width: at the SDK's three capture
// widths, 390, 1120, and 1376 px, and at widths that put the demo itself half a rem either side of
// its two bands' edges, 44rem and 64rem, a paste of 500 lines into the editor, 10,000 lines
// printed, and a full table of a build's timings change no part's box, in each arrangement from
// 64rem, each placing the parts as it says; the page never scrolls sideways; and every part lies
// inside the demo. A Run, a Stop, a failed build, a band change, and an arrangement change keep
// each part's content and scroll position, and the output tab chosen. Below 44rem, and from 64rem
// with the editor left or right, the output is one panel under its tablist, the tabs pattern, its
// keyboard and accessibility tree the file tabs', and there, at 1120px and 1376px after a Run, the
// Timings tab shows the build's whole table inside its panel, the Total in view with the page
// unscrolled, the table still named Timings by its caption, which takes no visible box, as the
// tab names it; from 44rem to 64rem, and from 64rem with the editor top, the tablist isn't there,
// the console and the timings share a row, and neither is a tabpanel. A demo without `fixed`,
// the components page's, has no output tablist and a console that grows. The reservations are
// one property each, read where they apply: the timings' track is sl-timings' least width, 28ch of
// its table, and the steady status asks the row for 24ch of its own text, sharing the toolbar's
// line where the row holds the toolbar, the gap, and that reservation, as measured, and taking its
// own where it doesn't, a rem either side, and at a phone's width, whatever it says; each property
// set on its element moves every reader. The helpers are go-demos.ts's, go-builds.ts's, and
// playground-layouts.ts's. playground-arrangement.test.ts proves the Layout menu and the stored
// choice. Every wait is bounded.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test, type TestContext } from "node:test";

import { launch, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { WIDTHS } from "@jaimestill/spike-html-hosting-sdk/screenshots.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import { fonts } from "./fonts.ts";
import { BUILD, build, BUILT_PHASES, DONE } from "./go-builds.ts";
import { demo, open as openPage, pressControl, says, settle } from "./go-demos.ts";
import {
  arrange,
  FLOOR,
  frameLines,
  screen,
  type Screen,
  type AXNode,
  axQuery,
  type Band,
  comments,
  contained,
  CONTROLS,
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
  REM,
  tabbed,
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

/** Asserts that the page has one gutter, the body's padding at both inline sides and at the block
 * end, and that the demo spans the body's content width, a gutter from each side. */
function guttered(shown: Screen, where: string): number {
  const [gutter, ...others] = shown.gutters;
  assert.ok(gutter > 0, `${where}: the page has a gutter`);
  assert.deepEqual(others, [gutter, gutter], `${where}: one gutter at the sides and the block end`);
  const [start, end] = shown.sides;
  assert.ok(Math.abs(start - gutter) <= 0.5, `${where}: the demo starts a gutter in, at ${start}`);
  assert.ok(Math.abs(shown.width - gutter - end) <= 0.5, `${where}: the demo ends a gutter in`);
  return gutter;
}

/** Asserts that every part shown, its bottom border among it, lies inside the demo and ends no
 * lower than the bottom given. */
function above({ parts }: Layout, bottom: number, where: string): void {
  for (const [name, { box, shown }] of Object.entries(parts)) {
    if (!shown) continue;
    const end = box[1] + box[3];
    assert.ok(
      end <= bottom + 0.5,
      `${where}: the ${name}'s bottom border, ${end}, is above ${bottom}`,
    );
  }
}

/** Asserts the page is one screen: the demo ends a gutter above the viewport's bottom edge, every
 * part's bottom border inside the demo and in view, and the page scrolls neither way. */
async function oneScreen(page: Page, shown: Screen, where: string): Promise<void> {
  const gutter = guttered(shown, where);
  const bottom = shown.viewport - gutter;
  assert.deepEqual([shown.down, shown.sideways], [0, 0], `${where}: the page scrolls neither way`);
  assert.ok(Math.abs(shown.demo[1] - bottom) <= 0.5, `${where}: the demo ends at ${shown.demo[1]}`);
  const laid = await layout(page);
  contained(laid, where);
  above(laid, bottom, where);
}

/** Asserts the demo is at its floor: the page scrolls down, never sideways, the demo ending a
 * gutter above the page's end with every part inside it, the editor's frame and the console's log
 * each at least its floor's lines, and one of them at exactly that, as the floor is the least
 * height that holds both. */
async function atFloor(page: Page, shown: Screen, where: string): Promise<void> {
  const gutter = guttered(shown, where);
  assert.ok(shown.down > 0, `${where}: the page scrolls down`);
  assert.equal(shown.sideways, 0, `${where}: the page never scrolls sideways`);
  const bottom = shown.height - gutter;
  assert.ok(Math.abs(shown.demo[1] - bottom) <= 0.5, `${where}: the demo ends at ${shown.demo[1]}`);
  const laid = await layout(page);
  contained(laid, where);
  above(laid, bottom, where);
  const lines = await frameLines(page);
  assert.ok(
    lines.editor >= FLOOR.editor - 0.02,
    `${where}: the editor shows ${lines.editor} lines`,
  );
  assert.ok(lines.log >= FLOOR.log - 0.02, `${where}: the log shows ${lines.log} lines`);
  const least = Math.min(lines.editor - FLOOR.editor, lines.log - FLOOR.log);
  assert.ok(least <= 0.05, `${where}: a part is at its floor, ${JSON.stringify(lines)}`);
}

/** The SDK's capture sizes, each also 900px tall, the 1120px width also 800px tall, and the
 * middle capture's, 900x700. */
const SCREENS = [
  ...WIDTHS.flatMap(({ width, height }) => [
    { width, height },
    { width, height: 900 },
  ]),
  { width: 1120, height: 800 },
  { width: 900, height: 700 },
];

/** A viewport's height too short for the demo's floor at any width the tests read, so the demo
 * holds it. */
const SHORT = 300;

/** The families the platform draws the element's own text in, the text nodes that are its
 * children, as CSS.getPlatformFontsForNode reports them; the expression gives the element. */
async function drawnIn(page: Page, expression: string): Promise<string[]> {
  await page.cdp("DOM.enable");
  await page.cdp("CSS.enable");
  await page.cdp("DOM.getDocument", { depth: -1, pierce: true });
  const { result } = await page.cdp("Runtime.evaluate", { expression });
  assert.ok(result.objectId, `${expression} gives an element`);
  const { nodeId } = await page.cdp("DOM.requestNode", { objectId: result.objectId });
  const { fonts: drawn }: { fonts: { familyName: string }[] } = await page.cdp(
    "CSS.getPlatformFontsForNode",
    { nodeId },
  );
  return drawn.map(({ familyName }) => familyName);
}

// A font set the test file set up must be the one the browser draws in, or the suite would prove
// the machine's fonts again under another name. The type profile decides which of the set's
// families each text takes (the mono profile draws the heading and the controls in the code's),
// so the body text and the code are held to theirs, and every text to the set.
const { families } = fonts();
if (families) {
  describe(`the font set, ${fonts().name}`, () => {
    test(`the page draws in ${families.sans} and ${families.mono} alone, its body text in the first and its code in the second`, async () => {
      const page = await open();
      try {
        const root = `${PLAYGROUND}.shadowRoot`;
        const drawn = {
          heading: await drawnIn(page, `document.querySelector("main > .prose > .title > h1")`),
          program: await drawnIn(page, `document.querySelector("main > .prose > .title > label")`),
          lede: await drawnIn(page, `document.querySelector("main > .prose > p")`),
          toolbar: await drawnIn(page, `${CONTROLS}.querySelector(".name")`),
          code: await drawnIn(
            page,
            `${root}.querySelector("sl-code-editor").shadowRoot.querySelector(".text")`,
          ),
        };
        const set = [families.sans, families.mono];
        for (const [text, used] of Object.entries(drawn)) {
          assert.ok(used.length > 0, `the ${text} is drawn`);
          assert.ok(
            used.every((family) => set.includes(family)),
            `the ${text} is drawn in ${used.join(", ")}`,
          );
        }
        // The lede's own text; its kbd is the code's.
        assert.ok(drawn.lede.includes(families.sans), `the lede is drawn in ${families.sans}`);
        assert.deepEqual(drawn.code, [families.mono], "the code");
      } finally {
        await page.close();
      }
    });
  });
}

describe(`the playground's one screen, in ${fonts().name}`, () => {
  test("the demo takes every row left and ends a gutter above the viewport's bottom, every part's bottom border in view, the page scrolling neither way, with no script sizing the demo", async () => {
    const page = await open();
    try {
      for (const { width, height } of SCREENS) {
        const where = `${width}x${height}`;
        await viewport(page, width, height);
        await oneScreen(page, await screen(page), where);
      }
      // From 64rem, in each arrangement, at the wide captures' sizes.
      for (const { width, height } of WIDTHS.filter(({ width }) => width > PHONE)) {
        await viewport(page, width, height);
        for (const placement of PLACEMENTS) {
          await arrange(page, placement);
          await oneScreen(page, await screen(page), `${width}x${height}, editor ${placement}`);
        }
      }
      // The reader's choice is kept for the origin: the default again for the tests after.
      await arrange(page, "left");
      const styled = await page.evaluate(`${PLAYGROUND}.getAttribute("style")`);
      assert.equal(styled, null, "the page sets no style on the demo");
    } finally {
      await page.close();
    }
  });

  test("at each capture size the demo stands above its floor, by the headroom reported", async (t: TestContext) => {
    const page = await open();
    try {
      for (const { width, height } of WIDTHS) {
        const where = `${width}x${height}`;
        await viewport(page, width, height);
        const shown = await screen(page);
        const lines = await frameLines(page);
        assert.ok(
          lines.editor > FLOOR.editor && lines.log > FLOOR.log,
          `${where}: above the floor, ${JSON.stringify(lines)}`,
        );
        // The floor's height at this width: the demo's on a screen too short for it, where it holds
        // its floor and the page scrolls.
        await viewport(page, width, SHORT);
        const floored = await screen(page);
        await atFloor(page, floored, `${width}x${SHORT}`);
        const headroom = shown.demo[1] - shown.demo[0] - (floored.demo[1] - floored.demo[0]);
        assert.ok(headroom > 0, `${where}: the demo stands above its floor, by ${headroom}px`);
        t.diagnostic(
          `${where} in ${fonts().name}: the demo stands ${headroom.toFixed(2)}px above its floor`,
        );
      }
    } finally {
      await page.close();
    }
  });

  test("on a short screen, or at twice the text size, the demo holds its floor, and the page scrolls down, never sideways", async () => {
    const page = await open();
    try {
      for (const { width, height } of [
        { width: 390, height: 600 },
        { width: 1376, height: 400 },
      ]) {
        await viewport(page, width, height);
        await atFloor(page, await screen(page), `${width}x${height}`);
      }
      // Text zoom, as the root's font size doubled: every line the page and the demo state, the
      // floor's among them, in rem, em, or lh, doubles with it, at the phone's capture size and at
      // the middle capture's, 1120x700.
      for (const { width, height } of [
        { width: 390, height: 844 },
        { width: 1120, height: 700 },
      ]) {
        await viewport(page, width, height);
        await page.evaluate(`document.documentElement.style.fontSize = "200%"`);
        try {
          await atFloor(page, await screen(page), `${width}x${height} at 200%`);
        } finally {
          await page.evaluate(`document.documentElement.style.removeProperty("font-size")`);
        }
      }
    } finally {
      await page.close();
    }
  });
});

describe(`the playground's fixed layout, in ${fonts().name}`, () => {
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
        // Where the output is tabbed the timings share the console's cell, hidden behind its tab.
        const tabs = tabbed(band, placement);
        assert.equal(laid.parts.outputTabs.shown, tabs, `the output tabs at ${name}`);
        assert.equal(laid.parts.timings.shown, !tabs, `the timings at ${name}`);
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

/** The output panel's tabpanels, by name, in the accessibility tree. */
const panels = async (page: Page) =>
  (await axQuery(page, `${PLAYGROUND}.shadowRoot.querySelector(".output")`, "tabpanel")).map(
    (node) => node.name?.value,
  );

/** Asserts that the output is one panel under its tablist, the phone's: a tablist, Output panel,
 * of Output and Timings, Output selected, each controlling its part, the console a tabpanel named
 * by its tab and alone shown, then, with Timings chosen, the timings alone. */
async function tablisted(page: Page, where: string): Promise<void> {
  await page.cdp("DOM.getDocument", {});
  const lists = await axQuery(page, PLAYGROUND, "tablist");
  assert.deepEqual(
    lists.map((node) => node.name?.value),
    ["Files", "Output panel"],
    where,
  );
  const tabs = await axQuery(page, `${PLAYGROUND}.shadowRoot.querySelector(".output")`, "tab");
  assert.deepEqual(
    tabs.map((node) => [node.name?.value, selected(node)]),
    [
      ["Output", true],
      ["Timings", false],
    ],
    where,
  );
  assert.deepEqual(await panels(page), ["Output"], `${where}: the console, named by its tab`);
  const controls = await page.evaluate(`[...${PLAYGROUND}.shadowRoot
    .querySelectorAll('.output-tabs [role="tab"]')].map((tab) => tab.getAttribute("aria-controls"))`);
  assert.deepEqual(controls, ["console", "timings"], where);
  let shown = await tabState(page);
  assert.deepEqual([shown.console, shown.timings], [true, false], `${where}: the console alone`);
  await choose(page, "timings");
  await settle(page);
  assert.deepEqual(await panels(page), ["Timings"], `${where}: the timings, named by its tab`);
  shown = await tabState(page);
  assert.deepEqual([shown.console, shown.timings], [false, true], `${where}: the timings alone`);
}

/** The timings' table as laid out in the timings' box: its row headers, in order, the timings'
 * bottom edge and whether they scroll, the Total row's bottom edge, each in the viewport, and its
 * caption's text and box, and how far below the table's top its header row starts. */
const timingsTable = (page: Page) =>
  page.evaluate(`(() => {
    const timings = ${PLAYGROUND}.shadowRoot.querySelector("sl-timings");
    const table = timings.shadowRoot.querySelector("table");
    const caption = table.querySelector("caption").getBoundingClientRect();
    return {
      rows: [...table.querySelectorAll("tbody th, tfoot th")].map((th) => th.textContent.trim()),
      bottom: timings.getBoundingClientRect().bottom,
      scrolls: timings.scrollHeight > timings.clientHeight,
      total: table.querySelector("tfoot tr").getBoundingClientRect().bottom,
      viewport: innerHeight,
      caption: {
        text: table.querySelector("caption").textContent.trim(),
        width: caption.width,
        height: caption.height,
      },
      head:
        table.querySelector("thead").getBoundingClientRect().top - table.getBoundingClientRect().top,
    };
  })()`) as Promise<{
    rows: string[];
    bottom: number;
    scrolls: boolean;
    total: number;
    viewport: number;
    caption: { text: string; width: number; height: number };
    head: number;
  }>;

describe(`the output tablist, in ${fonts().name}`, () => {
  test("below 44rem is a tablist, Output panel, of Output and Timings, each controlling its tabpanel, the selected one alone shown; from 44rem to 64rem it isn't there, and neither part is a tabpanel", async () => {
    const page = await open();
    try {
      await viewport(page, PHONE);
      await tablisted(page, `${PHONE}px`);

      await viewport(page, await widthFor(page, 52));
      await settle(page);
      assert.deepEqual(
        (await axQuery(page, PLAYGROUND, "tablist")).map((node) => node.name?.value),
        ["Files"],
      );
      assert.deepEqual(await panels(page), []);
      const shown = await tabState(page);
      assert.deepEqual([shown.console, shown.timings], [true, true]);
    } finally {
      await page.close();
    }
  });

  test("from 64rem, at 1120px and 1376px, the editor left or right puts the output in the phone's tablist, and after a Run the Timings tab shows the whole table, its Total in view with the page unscrolled; the editor top puts the console and the timings in a row, with no tablist and no tabpanel", async () => {
    const page = await open();
    try {
      await viewport(page, 1376);
      const ran = await build(page, PLAYGROUND, DONE);
      assert.deepEqual(ran.phases, BUILT_PHASES, "a build's timings");
      for (const { width, height } of WIDTHS.filter(({ width }) => width > PHONE)) {
        await viewport(page, width, height);
        for (const placement of ["left", "right"] as const) {
          const where = `${width}x${height}, editor ${placement}`;
          await arrange(page, placement);
          await choose(page, "console");
          await settle(page);
          placedAs(await layout(page), placement, where);
          await tablisted(page, where);
          const table = await timingsTable(page);
          assert.deepEqual(table.rows, [...BUILT_PHASES, "Total"], `${where}: every phase`);
          assert.equal(table.scrolls, false, `${where}: the whole table in the timings' panel`);
          assert.ok(
            table.total <= table.bottom + 0.5 && table.total <= table.viewport,
            `${where}: the Total, ending at ${table.total}, in the panel and the viewport`,
          );
          assert.equal((await screen(page)).down, 0, `${where}: the page unscrolled`);
          // The table keeps its name, its caption, which the Timings tab says, so no visible box.
          const timings = `${PLAYGROUND}.shadowRoot.querySelector("sl-timings")`;
          assert.deepEqual(
            (await axQuery(page, timings, "table")).map((node) => node.name?.value),
            ["Timings"],
            `${where}: the table's name`,
          );
          assert.equal(table.caption.text, "Timings", where);
          assert.ok(
            table.caption.width <= 1 && table.caption.height <= 1,
            `${where}: the caption's box, ${table.caption.width}x${table.caption.height}px`,
          );
          assert.ok(table.head <= 1, `${where}: the header row ${table.head}px below the top`);
        }
        const where = `${width}x${height}, editor top`;
        await arrange(page, "top");
        const laid = await layout(page);
        placedAs(laid, "top", where);
        assert.equal(laid.parts.outputTabs.shown, false, `${where}: no tablist`);
        assert.deepEqual(await panels(page), [], `${where}: no tabpanel`);
        const shown = await tabState(page);
        assert.deepEqual([shown.console, shown.timings], [true, true], `${where}: both parts`);
      }
      // The reader's choice is kept for the origin: the default again for the tests after.
      await arrange(page, "left");
    } finally {
      await page.close();
    }
  });

  test("the selected tab alone is in the tab order; Left and Right select the previous and the next, wrapping, Home and End the first and the last, below 44rem and from 64rem with the editor left or right", async () => {
    const page = await open();
    try {
      const at = (part: "console" | "timings") => ({
        focused: part,
        selected: part,
        tabindex: part === "console" ? [0, -1] : [-1, 0],
        console: part === "console",
        timings: part === "timings",
      });
      const steps: ["ArrowRight" | "ArrowLeft" | "Home" | "End", "console" | "timings"][] = [
        ["ArrowRight", "timings"],
        ["ArrowRight", "console"],
        ["ArrowLeft", "timings"],
        ["ArrowLeft", "console"],
        ["End", "timings"],
        ["Home", "console"],
      ];
      for (const [width, placement] of [
        [PHONE, null],
        [1376, "left"],
        [1376, "right"],
      ] as const) {
        const where = placement ? `${width}px, editor ${placement}` : `${width}px`;
        await viewport(page, width);
        if (placement) await arrange(page, placement);
        await page.evaluate(
          `${PLAYGROUND}.shadowRoot.querySelector('.output-tabs [aria-selected="true"]').focus()`,
        );
        assert.deepEqual(await tabState(page), at("console"), where);
        for (const [key, part] of steps) {
          await press(page, key);
          await settle(page);
          assert.deepEqual(await tabState(page), at(part), `${where}: ${key} to ${part}`);
        }
      }
      // The reader's choice is kept for the origin: the default again for the tests after.
      await arrange(page, "left");
    } finally {
      await page.close();
    }
  });
});

describe(`the reservations, in ${fonts().name}`, () => {
  /** The timings' box and the status's, beside the ch of the text each is in: the table's, and the
   * status's own; the status's line against Run's; and the row the status asks a share of, its
   * width, the toolbar's, and the gap between them. */
  const reserved = (page: Page) =>
    page.evaluate(`(() => {
      const root = ${PLAYGROUND}.shadowRoot;
      const controls = root.querySelector("sl-controls");
      const bar = controls.shadowRoot.querySelector(".bar");
      const toolbar = controls.shadowRoot.querySelector(".toolbar");
      const status = controls.shadowRoot.querySelector(".status");
      const run = controls.shadowRoot.querySelector('[data-control="run"]').getBoundingClientRect();
      const timings = root.querySelector("sl-timings");
      const table = timings.shadowRoot.querySelector("table");
      // A ch measured in the element's own text: a probe beside it, styled as it is, 100ch wide,
      // so the box's rounding to a 64th of a px is a hundredth of that in the ch, and 200ch read
      // from it is within a 30th of a px in any font.
      const ch = (element) => {
        const probe = document.createElement("span");
        const style = getComputedStyle(element);
        probe.style.cssText = "position: absolute; visibility: hidden; inline-size: 100ch;";
        probe.style.font = style.font;
        element.getRootNode().append(probe);
        const width = probe.getBoundingClientRect().width / 100;
        probe.remove();
        return width;
      };
      return {
        timings: timings.getBoundingClientRect().width,
        table: table.getBoundingClientRect().width,
        tableCh: ch(table),
        status: parseFloat(getComputedStyle(status).flexBasis),
        statusCh: ch(status),
        ownLine: status.getBoundingClientRect().top >= run.bottom,
        bar: bar.getBoundingClientRect().width,
        toolbar: toolbar.getBoundingClientRect().width,
        gap: parseFloat(getComputedStyle(bar).columnGap),
        controls: controls.getBoundingClientRect().height,
      };
    })()`);

  type Reserved = Awaited<ReturnType<typeof reserved>>;

  /** The row's width the status needs to share the toolbar's line: the toolbar's, the gap, and
   * the status's reservation, each as measured, so no font decides the expectation. */
  const needed = ({ toolbar, gap, status }: Reserved) => toolbar + gap + status;

  /** Asserts the status's line is the one its reservation gives at the row's width: its own
   * where the toolbar, the gap, and the reservation don't fit on the toolbar's line. */
  function lined(laid: Reserved, where: string): void {
    assert.equal(
      laid.ownLine,
      needed(laid) > laid.bar,
      `${where}: the status's line follows its reservation, ${JSON.stringify(laid)}`,
    );
  }

  test("the timings' track is the least width sl-timings states, 28ch of its table, read on the element; the steady status asks the row for 24ch of its own text, which decides its line by width alone", async () => {
    const page = await open();
    try {
      await viewport(page, await widthFor(page, 50));
      let laid = await reserved(page);
      assert.ok(Math.abs(laid.timings - 28 * laid.tableCh) < 0.5, `the track, ${laid.timings}`);
      assert.ok(Math.abs(laid.table - laid.timings) < 0.5, `the table fills it, ${laid.table}`);
      assert.ok(Math.abs(laid.status - 24 * laid.statusCh) < 0.5, `the status, ${laid.status}`);
      lined(laid, "at 50rem");

      // A rem either side of the row the status needs, read at 50rem, each in the band where the
      // toolbar shows its names and no Layout group: the toolbar's fluid spaces move it by a px
      // or so between the two, well inside the rem, so the status shares the toolbar's line on
      // the wider side alone, whatever the font.
      const need = needed(laid);
      assert.ok(need / REM - 1 >= 26 && need / REM + 1 < 64, `the row needed, ${need}, is in band`);
      for (const [side, ownLine] of [
        [1, false],
        [-1, true],
      ] as const) {
        const where = `a row ${Math.round(need + side * REM)}px wide`;
        await viewport(page, await widthFor(page, need / REM + side));
        laid = await reserved(page);
        lined(laid, where);
        assert.equal(laid.ownLine, ownLine, `${where}: the status's own line is ${ownLine}`);

        // Words longer than the reservation change neither its line nor the controls' box.
        const words = "Finished a program whose name runs well past the status's reservation";
        await page.evaluate(`(() => {
          const status = ${CONTROLS}.querySelector(".status");
          status.append(new Text(${JSON.stringify(words)}));
        })()`);
        await settle(page);
        const said = await reserved(page);
        assert.equal(said.ownLine, ownLine, `${where}: long words keep the status's line`);
        assert.equal(said.controls, laid.controls, `${where}: long words keep the controls' box`);
        await page.evaluate(`${CONTROLS}.querySelector(".status").lastChild.remove()`);
      }

      // One property each: set on the element, it moves every reader.
      await viewport(page, await widthFor(page, 50));
      await page.evaluate(`(() => {
        const root = ${PLAYGROUND}.shadowRoot;
        root.querySelector("sl-timings").style.setProperty("--sl-timings-min-inline-size", "20ch");
        root.querySelector("sl-controls").style.setProperty("--sl-controls-status-inline-size", "200ch");
      })()`);
      await settle(page);
      laid = await reserved(page);
      assert.ok(Math.abs(laid.timings - 20 * laid.tableCh) < 0.5, `the track set, ${laid.timings}`);
      assert.ok(Math.abs(laid.table - laid.timings) < 0.5, `the table set, ${laid.table}`);
      assert.ok(
        Math.abs(laid.status - 200 * laid.statusCh) < 0.5,
        `the status set, ${laid.status}`,
      );
      assert.equal(laid.ownLine, true, "a reservation wider than the line left takes its own");
      await page.evaluate(`(() => {
        const root = ${PLAYGROUND}.shadowRoot;
        root.querySelector("sl-timings").style.removeProperty("--sl-timings-min-inline-size");
        root.querySelector("sl-controls").style.removeProperty("--sl-controls-status-inline-size");
      })()`);

      await viewport(page, PHONE);
      await settle(page);
      laid = await reserved(page);
      lined(laid, "at a phone's width");
      assert.equal(laid.ownLine, true, "at a phone's width the status takes a line of its own");
    } finally {
      await page.close();
    }
  });
});

describe(`a demo without fixed, in ${fonts().name}`, () => {
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
