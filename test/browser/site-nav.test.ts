// The site's own nav (scripts/site-nav.ts), on the build as Pages serves it: dist/ under the base,
// by the SDK's served(), Vite's preview, in the pinned chrome-headless-shell, on all seven pages,
// the four hand pages and the three rendered Markdown pages.
//
// On each page the header's first child is the row, a nav landmark named Site, whose links are
// SITE_NAV's, in its order, by their text and the URL each resolves to, the page's own alone marked
// aria-current="page", every Markdown page marking Library demos; the Site drawer holds the same
// links. From the switch, 58rem (page.css), at 1120px and at 1376px, the capture widths above it,
// the row shows, its links on one line, sharing it with the header's buttons, and the drawer's
// opener is hidden; a px below the switch and at 390px the row is hidden and the opener shows,
// named Site, aria-expanded false. Below the switch the opener opens the drawer, a modal, by its
// click and by N; Escape and the drawer's Close each close it, aria-expanded following, focus back
// on the opener; a link followed in it closes it, its navigation held by the test so the page stays
// to be read. With script disabled, at 390px, the row shows, the opener and the drawer don't, and
// nothing scrolls sideways, with the text at its own size and at 200%, nothing in the header
// passing the viewport on any page; the components page's main, its Go demos unupgraded, is wider
// than a phone's without script, apart from the nav, so there the header alone is held. The SDK's
// shell checks, which run on every page in site.test.ts, hold the header's group, the opener among
// its buttons, to one line, Help's list to the page's bindings, N's among them below the switch,
// and every glyph button to its target size. Every wait is bounded.
//
// The index opens its main on the where-to-go list after its heading and lede and before the
// question and the evidence: its heading, Where to go, then its list, both main's own children as
// the index's other headings and lists are, the list an item for each page SITE_NAV links but
// home, in its order, each its link, by its text and the URL it resolves to, then its description,
// Library demos' item listing the three Markdown pages under it by their titles, as markdownPages
// titles them. The paragraph after the list stands at least the foundation's --space-s below it,
// the flow rule's space, at 390px and at 1376px, so a list the flow rule misses fails.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import { MARKDOWN_TITLES, SITE_NAV } from "../../scripts/site-nav.ts";
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

/** Every page the site builds, by its file under the root, and its path under the base. */
const PAGES = [
  ["index.html", ""],
  ["components.html", "components.html"],
  ["playground.html", "playground.html"],
  ["sqlate.html", "sqlate.html"],
  ["sqlate-compile.html", "sqlate-compile.html"],
  ["go-core-graph.html", "go-core-graph.html"],
  ["go-web-sdk-handlers.html", "go-web-sdk-handlers.html"],
];

/** The switch, page.css's 58rem, in px at the initial font size, as a media query reads it. */
const SWITCH = 58 * 16;

/** The capture widths above the switch, the SDK's two wider. */
const ROW_WIDTHS = [SWITCH, 1120, 1376];

/** Widths below the switch: a px below it, and a phone's. */
const DRAWER_WIDTHS = [SWITCH - 1, PHONE];

/** The pages whose main, without script, is wider than a phone's viewport, before and apart from
 * the nav: the components page, whose Go demos' unupgraded figures pass it. On these the check
 * holds the header alone inside the viewport. */
const UNSCRIPTED_WIDE = ["components.html"];

/** The row, the drawer, and the opener. */
const ROW = `document.querySelector('body > header > nav[aria-label="Site"]')`;
const DRAWER = `document.querySelector("sl-drawer#site")`;
const OPENER = `document.querySelector('body > header > .header-actions > button[aria-controls="site"]')`;

/** A list's links, each its text, the URL it resolves to, and its aria-current. */
const links = (list: string) => `[...${list}.querySelectorAll("a")].map((a) => ({
  text: a.textContent.trim(),
  href: a.href,
  current: a.getAttribute("aria-current"),
}))`;

/** The page's nav as laid out: whether the row is the header's first child, whether it shows, the
 * lines its links render on, and whether the header's shown buttons are on its first line; and
 * whether the opener shows, its name, and its aria-expanded. */
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
    first: row === document.querySelector("body > header").firstElementChild,
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

/** The drawer is open, a modal. */
const MODAL = `!!${DRAWER}.shadowRoot?.querySelector("dialog")?.matches(":modal")`;

/** Focus is on the opener. */
const ON_OPENER = `document.activeElement === ${OPENER}`;

/** Presses a key, as a reader types it: a letter with its text, or a named key. */
async function press(page: Page, key: "n" | "Escape"): Promise<void> {
  const event =
    key === "n"
      ? { key, code: "KeyN", windowsVirtualKeyCode: 78 }
      : { key, code: key, windowsVirtualKeyCode: 27 };
  await page.cdp("Input.dispatchKeyEvent", {
    type: "keyDown",
    ...event,
    ...(key === "n" ? { text: key } : {}),
  });
  await page.cdp("Input.dispatchKeyEvent", { type: "keyUp", ...event });
}

/** Clicks the element the expression gives at its center, as a mouse does. */
async function clickAt(page: Page, element: string): Promise<void> {
  const { x, y } = await page.evaluate(`(() => {
    const { left, top, width, height } = ${element}.getBoundingClientRect();
    return { x: left + width / 2, y: top + height / 2 };
  })()`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await page.cdp("Input.dispatchMouseEvent", { type, x, y, button: "left", clickCount: 1 });
  }
}

/** Waits for the drawer to open by how, then for aria-expanded to follow and its slide in to
 * end. */
async function opened(page: Page, where: string, how: string): Promise<void> {
  await until(page, MODAL, 5000).catch(() => assert.fail(`${where}: ${how} opens the drawer`));
  await until(page, `${OPENER}.getAttribute("aria-expanded") === "true"`, 5000).catch(() =>
    assert.fail(`${where}: aria-expanded is true while the drawer is open`),
  );
  // Past its slide in, a transition in the drawer's shadow root, which the document's own
  // animations leave out, so a click lands where its control comes to rest.
  await page.evaluate(`Promise.all(${DRAWER}.shadowRoot.querySelector("dialog")
    .getAnimations({ subtree: true }).map((animation) => animation.finished))`);
}

/** Waits for the drawer to close by how, aria-expanded to follow, and focus to be on the
 * opener. */
async function closed(page: Page, where: string, how: string): Promise<void> {
  await until(page, `!${MODAL}`, 5000).catch(() =>
    assert.fail(`${where}: ${how} closes the drawer`),
  );
  await until(page, `${OPENER}.getAttribute("aria-expanded") === "false"`, 5000).catch(() =>
    assert.fail(`${where}: aria-expanded is false once ${how} closes the drawer`),
  );
  await until(page, ON_OPENER, 5000).catch(() =>
    assert.fail(`${where}: focus is back on the opener once ${how} closes the drawer`),
  );
}

describe("the site's own nav", () => {
  for (const [file, path] of PAGES) {
    const where = path || "the index";

    test(`${where}'s header opens on the Site nav, SITE_NAV's links in order, its own marked current, and the drawer holds the same`, async () => {
      const page = await browser.open(`${server.origin}${path}`);
      try {
        const expected = SITE_NAV.map(({ label, href, pages }) => ({
          text: label,
          href: new URL(href, server.origin).href,
          current: pages.includes(file) ? "page" : null,
        }));
        assert.equal(expected.filter(({ current }) => current).length, 1, "one link is current");
        assert.deepEqual(await page.evaluate(links(ROW)), expected, `${where}: the row's links`);
        assert.deepEqual(
          await page.evaluate(links(DRAWER)),
          expected,
          `${where}: the drawer's links`,
        );
        assert.equal(
          await page.evaluate(
            `${ROW} === document.querySelector("body > header").firstElementChild`,
          ),
          true,
          `${where}: the row is the header's first child`,
        );
      } finally {
        await page.close();
      }
    });

    test(`${where}: from 58rem, at 1120px, and at 1376px the row shows on one line with the header's buttons; below it the opener shows in its place`, async () => {
      const page = await browser.open(`${server.origin}${path}`);
      try {
        for (const width of ROW_WIDTHS) {
          await viewport(page, width);
          const read = await page.evaluate(LAYOUT);
          assert.deepEqual(
            { row: read.row, lines: read.lines, shared: read.shared, opener: read.opener },
            { row: true, lines: 1, shared: true, opener: false },
            `${where} at ${width}px`,
          );
        }
        for (const width of DRAWER_WIDTHS) {
          await viewport(page, width);
          const read = await page.evaluate(LAYOUT);
          assert.deepEqual(
            { row: read.row, opener: read.opener, name: read.name, expanded: read.expanded },
            { row: false, opener: true, name: "Site", expanded: "false" },
            `${where} at ${width}px`,
          );
        }
      } finally {
        await page.close();
      }
    });

    test(`${where}: below the switch the opener opens the drawer by its click and by N; Escape and Close close it, focus back on the opener; a link followed closes it`, async () => {
      const page = await browser.open(`${server.origin}${path}`);
      try {
        await viewport(page, PHONE);
        await clickAt(page, OPENER);
        await opened(page, where, "the opener's click");
        await press(page, "Escape");
        await closed(page, where, "Escape");

        // N from the body, focus nowhere in particular: the keys module clicks the opener without
        // focusing it, and the drawer still returns focus to the opener.
        await page.evaluate(`document.activeElement?.blur()`);
        await press(page, "n");
        await opened(page, where, "N");
        await clickAt(page, `${DRAWER}.shadowRoot.querySelector("dialog button")`);
        await closed(page, where, "the drawer's Close");

        // A link, its navigation held, so the page stays to be read once the drawer has closed.
        await page.evaluate(
          `document.addEventListener("click", (event) => event.preventDefault())`,
        );
        await press(page, "n");
        await opened(page, where, "N");
        await clickAt(page, `${DRAWER}.querySelector("a")`);
        await closed(page, where, "following a link");
      } finally {
        await page.close();
      }
    });

    test(`${where} without script, at 390px: the row shows, the opener and the drawer don't, and nothing scrolls sideways at the text's size or 200%`, async () => {
      const page = await browser.open("about:blank");
      try {
        await page.cdp("Emulation.setScriptExecutionDisabled", { value: true });
        // The width set directly: viewport() waits on the page's frames, by script.
        await page.cdp("Emulation.setDeviceMetricsOverride", {
          width: PHONE,
          height: 844,
          deviceScaleFactor: 1,
          mobile: false,
        });
        await page.goto(`${server.origin}${path}`);
        for (const scale of [1, 2]) {
          const read = await page.evaluate(`(() => {
            const root = document.documentElement;
            root.style.fontSize = "";
            root.style.fontSize = parseFloat(getComputedStyle(root).fontSize) * ${scale} + "px";
            return {
              row: ${ROW}.checkVisibility(),
              opener: ${OPENER}.checkVisibility(),
              drawer: ${DRAWER}.checkVisibility(),
              header: [...document.querySelectorAll("body > header *")].filter(
                (element) => element.getBoundingClientRect().right > root.clientWidth + 0.5,
              ).length,
              sideways: ${UNSCRIPTED_WIDE.includes(file)} ? false : root.scrollWidth > root.clientWidth,
            };
          })()`);
          assert.deepEqual(
            read,
            { row: true, opener: false, drawer: false, header: 0, sideways: false },
            `${where} without script, the text at ${scale * 100}%`,
          );
        }
      } finally {
        await page.close();
      }
    });
  }

  test("the index opens its main on the where-to-go list, SITE_NAV's pages but home, in order, each with its line, before the question and the evidence", async () => {
    const page = await browser.open(server.origin);
    try {
      const read = await page.evaluate(`(() => {
        const heading = document.getElementById("where-to-go");
        const list = heading.nextElementSibling;
        const items = [...list.querySelectorAll(":scope > li")].map((li) => {
          const a = li.querySelector(":scope > a");
          const text = [...li.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE)
            .map((node) => node.textContent).join("").replace(/\\s+/g, " ").trim();
          return {
            text: a.textContent.trim(),
            href: a.href,
            line: text,
            pages: [...li.querySelectorAll(":scope > ul > li > a")].map((page) => ({
              text: page.textContent.trim(),
              href: page.href,
            })),
          };
        });
        const main = [...document.querySelector("main").children];
        const at = (element) => main.indexOf(element);
        return {
          name: heading?.textContent.trim(),
          heading: heading.parentElement.localName + " > " + heading.localName,
          list: list.parentElement.localName + " > " + list.localName + "." + list.className,
          items,
          afterLede: at(heading) > at(document.querySelector("main > h1")) &&
            at(heading) > at(document.querySelector("main > h1 + p")),
          beforeQuestion: at(list) < at(document.getElementById("the-question")) &&
            at(list) < at(document.getElementById("the-evidence")),
        };
      })()`);
      const expected = SITE_NAV.filter(({ pages }) => !pages.includes("index.html")).map(
        ({ label, href, pages, description }) => ({
          text: label,
          href: new URL(href, server.origin).href,
          line: `: ${description}`,
          pages:
            label === "Library demos"
              ? pages.map((file) => ({
                  text: MARKDOWN_TITLES.get(file),
                  href: new URL(file, server.origin).href,
                }))
              : [],
        }),
      );
      assert.equal(expected.length, SITE_NAV.length - 1, "every page but home");
      assert.ok(
        expected.every(({ line }) => line.length > ": ".length),
        "each page but home has its line",
      );
      assert.equal(expected.find(({ text }) => text === "Library demos")?.pages.length, 3);
      assert.deepEqual(read, {
        name: "Where to go",
        heading: "main > h2",
        list: "main > ul.where-to-go",
        items: expected,
        afterLede: true,
        beforeQuestion: true,
      });
      for (const width of [PHONE, 1376]) {
        await viewport(page, width);
        const { gap, step } = (await page.evaluate(`(() => {
          const list = document.querySelector("main > #where-to-go + ul");
          const next = list.nextElementSibling;
          const probe = document.createElement("div");
          probe.style.marginBlockStart = "var(--space-s)";
          document.querySelector("main").append(probe);
          const step = parseFloat(getComputedStyle(probe).marginBlockStart);
          probe.remove();
          return {
            gap: next.getBoundingClientRect().top - list.getBoundingClientRect().bottom,
            step,
          };
        })()`)) as { gap: number; step: number };
        assert.ok(step > 0, `--space-s resolves at ${width}px`);
        assert.ok(
          gap >= step - 0.5,
          `the element after the list stands ${gap}px below it at ${width}px, want --space-s, ${step}px`,
        );
      }
    } finally {
      await page.close();
    }
  });
});
