// The site nav's switch between its row and the Site drawer's opener (web/pages/site-nav.ts and
// page.css), on the build as Pages serves it: dist/ under the base, by the SDK's served(), Vite's
// preview, in the pinned chrome-headless-shell, on all seven pages, drawing in the font set the
// test file that imports this suite chose (fonts.ts): site-nav-layout.test.ts runs it in the
// machine's fonts, and site-nav-layout-dejavu.test.ts in the pinned DejaVu set, under a test-only
// fontconfig, where a first test proves the row draws in DejaVu Sans alone. The switch is made by
// whether the row fits, never by a width, so the suite holds the property at every width and text
// size it reads, in each font set, rather than a width the switch falls at.
//
// The property: at 390, 928, 1120, and 1376 px, each with the text at its own size and at 200%,
// either the row shows, its links on one line, sharing it with every shown button of the header,
// and the opener is hidden; or the row is hidden and the opener shows, named Site, aria-expanded
// false; never a row wrapped beside the buttons. At 390px, at the text's size, every page shows the
// opener, where the screenshots' Site state opens the drawer, and at 1376px the row. The switch
// follows a change without a reload: on each page, from 1376px, where the row shows, the viewport
// narrows 16px at a time until the opener shows, every step holding the property, and widening
// back by a step shows the row again; at 1376px, doubling the text shows the opener and restoring
// it the row. N follows the opener: in the row state N opens nothing, and in the drawer state it
// opens the drawer, so N, which the keys module binds only on a shown control, and Help's row for
// it, exist only where the opener shows. Every wait is bounded.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch, SETTLED, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import { fonts } from "./fonts.ts";
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

/** Every page the site builds, by its path under the base. */
const PAGES = [
  "",
  "components.html",
  "playground.html",
  "sqlate.html",
  "sqlate-compile.html",
  "go-core-graph.html",
  "go-web-sdk-handlers.html",
];

/** The widths the property is read at: a phone's, 928px, where the old fixed switch fell, and the
 * SDK's two wider capture widths. */
const WIDTHS = [PHONE, 928, 1120, 1376];

/** The widest of them, where the row shows at the text's own size. */
const WIDE = 1376;

/** The step the forcing case narrows the viewport by. */
const STEP = 16;

/** The row, the drawer, and the opener. */
const ROW = `document.querySelector('body > header > nav[aria-label="Site"]')`;
const DRAWER = `document.querySelector("sl-drawer#site")`;
const OPENER = `document.querySelector('body > header > .header-actions > button[aria-controls="site"]')`;

/** The page's nav as laid out: whether the row shows, the lines its links render on, and whether
 * the header's shown buttons are on its first line; and whether the opener shows, its name, and
 * its aria-expanded. */
const LAYOUT = `(() => {
  const row = ${ROW};
  const opener = ${OPENER};
  const anchors = [...row.querySelectorAll("a")];
  const lines = new Set(anchors.flatMap((a) => [...a.getClientRects()])
    .filter((rect) => rect.width > 0).map((rect) => Math.round(rect.top)));
  const first = anchors[0].getBoundingClientRect();
  const buttons = [...document.querySelectorAll("body > header > .header-actions > button")]
    .filter((button) => button.checkVisibility());
  return {
    row: row.checkVisibility(),
    lines: lines.size,
    shared: buttons.length > 0 && buttons.every((button) => {
      const { top, bottom } = button.getBoundingClientRect();
      return top < first.bottom && bottom > first.top;
    }),
    opener: opener.checkVisibility(),
    name: opener.getAttribute("aria-label"),
    expanded: opener.getAttribute("aria-expanded"),
  };
})()`;

interface Layout {
  row: boolean;
  lines: number;
  shared: boolean;
  opener: boolean;
  name: string;
  expanded: string;
}

/** The state the page shows, asserting it is one of the two the property allows: "row", its
 * links on one line sharing it with the header's buttons, the opener hidden; or "drawer", the row
 * hidden and the opener shown, named Site and closed. */
async function state(page: Page, where: string): Promise<"row" | "drawer"> {
  const read = (await page.evaluate(LAYOUT)) as Layout;
  if (read.row) {
    assert.deepEqual(
      { lines: read.lines, shared: read.shared, opener: read.opener },
      { lines: 1, shared: true, opener: false },
      `${where}: the row shows, so its links are on one line beside the buttons, the opener hidden`,
    );
    return "row";
  }
  assert.deepEqual(
    { opener: read.opener, name: read.name, expanded: read.expanded },
    { opener: true, name: "Site", expanded: "false" },
    `${where}: the row is hidden, so the opener shows in its place`,
  );
  return "drawer";
}

/** Sets the text to the scale of its own size, through the root's font size, as a reader's zoom
 * of the text alone does, and waits for fonts and two frames. */
async function textAt(page: Page, scale: number): Promise<void> {
  await page.evaluate(`(() => {
    const root = document.documentElement;
    root.style.fontSize = "";
    if (${scale} !== 1) {
      root.style.fontSize = parseFloat(getComputedStyle(root).fontSize) * ${scale} + "px";
    }
  })()`);
  await page.evaluate(SETTLED);
}

/** Presses N, as a reader types it. */
async function pressN(page: Page): Promise<void> {
  const event = { key: "n", code: "KeyN", windowsVirtualKeyCode: 78 };
  await page.cdp("Input.dispatchKeyEvent", { type: "keyDown", ...event, text: "n" });
  await page.cdp("Input.dispatchKeyEvent", { type: "keyUp", ...event });
}

/** The drawer is open, a modal. */
const MODAL = `!!${DRAWER}.shadowRoot?.querySelector("dialog")?.matches(":modal")`;

/** The families the platform draws the element's own text in, as CSS.getPlatformFontsForNode
 * reports them; the expression gives the element. As playground-layout-suite.ts reads them. */
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
// the machine's fonts again under another name.
const { families } = fonts();
if (families) {
  describe(`the font set, ${fonts().name}`, () => {
    test(`the row's links draw in ${families.sans} alone`, async () => {
      const page = await browser.open(`${server.origin}go-core-graph.html`);
      try {
        await viewport(page, WIDE);
        for (const link of ["a", 'a[aria-current="page"]']) {
          assert.deepEqual(
            await drawnIn(page, `${ROW}.querySelector('${link}')`),
            [families.sans],
            `the row's ${link}`,
          );
        }
      } finally {
        await page.close();
      }
    });
  });
}

describe(`the site nav's switch, in ${fonts().name}`, () => {
  for (const path of PAGES) {
    const where = path || "the index";

    test(`${where}: at ${WIDTHS.join(", ")} px, at the text's size and at 200%, the row shows on one line beside the buttons or the opener shows in its place, never a wrapped row; the opener at 390px, the row at 1376px`, async () => {
      const page = await browser.open(`${server.origin}${path}`);
      try {
        for (const scale of [1, 2]) {
          for (const width of WIDTHS) {
            await viewport(page, width);
            await textAt(page, scale);
            const shown = await state(page, `${where} at ${width}px, the text at ${scale * 100}%`);
            if (scale === 1 && width === PHONE) assert.equal(shown, "drawer", `${where} at 390px`);
            if (scale === 1 && width === WIDE) assert.equal(shown, "row", `${where} at ${WIDE}px`);
          }
        }
      } finally {
        await page.close();
      }
    });

    test(`${where}: narrowing from ${WIDE}px switches the row to the opener where it stops fitting, widening switches back, and doubling the text does too, with no reload; N opens the drawer only while the opener shows`, async () => {
      const page = await browser.open(`${server.origin}${path}`);
      try {
        await page.evaluate(`globalThis.siteNavLoaded = true`);
        await viewport(page, WIDE);
        assert.equal(await state(page, `${where} at ${WIDE}px`), "row");
        await pressN(page);
        await page.evaluate(`new Promise((resolve) => setTimeout(resolve, 250))`);
        assert.equal(await page.evaluate(MODAL), false, `${where}: N opens nothing beside the row`);

        let width = WIDE;
        while ((await state(page, `${where} at ${width}px`)) === "row") {
          width -= STEP;
          assert.ok(width >= PHONE, `${where}: the opener shows by ${PHONE}px`);
          await viewport(page, width);
        }
        await viewport(page, width + STEP);
        assert.equal(
          await state(page, `${where} widened to ${width + STEP}px`),
          "row",
          `${where}: the row shows again a step wider than where it stopped fitting, ${width}px`,
        );
        await viewport(page, width);
        assert.equal(await state(page, `${where} at ${width}px again`), "drawer");
        await pressN(page);
        await until(page, MODAL, 5000).catch(() =>
          assert.fail(`${where}: N opens the drawer while the opener shows`),
        );
        await page.evaluate(`${DRAWER}.close()`);
        await until(page, `!${MODAL}`, 5000);

        await viewport(page, WIDE);
        assert.equal(await state(page, `${where} widened to ${WIDE}px`), "row");
        await textAt(page, 2);
        assert.equal(
          await state(page, `${where} at ${WIDE}px, the text doubled`),
          "drawer",
          `${where}: doubling the text at ${WIDE}px shows the opener`,
        );
        await textAt(page, 1);
        assert.equal(
          await state(page, `${where} at ${WIDE}px, the text restored`),
          "row",
          `${where}: restoring the text at ${WIDE}px shows the row`,
        );
        assert.equal(
          await page.evaluate(`globalThis.siteNavLoaded`),
          true,
          `${where}: the page never reloaded`,
        );
      } finally {
        await page.close();
      }
    });
  }
});
