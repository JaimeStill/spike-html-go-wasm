// The site's build, as Pages serves it: dist/ under the base, by the SDK's served(), Vite's
// preview, loaded in the pinned chrome-headless-shell. Each of the SDK's shell checks is a test on
// a fresh page of each hand page, the index, the components page, and the playground, whose
// headers have no site nav, which the checks allow, and which a test of its own holds on each: no
// sl-site-nav in the header, and no site-nav.js loaded, which defines it; the build bundles the
// module, so the registry rather than a request names it. The playground is an app page, its main
// across the body's content width, so it runs every check but main's reading width,
// holdsReadingWidth; a check of the spike's own holds its prose, the heading, the intro, and the
// disclosure, to 80ch, centered, instead. The crawl, from the index, checks every
// copied page, none here, and loads each hand page it reaches: it reaches exactly the index and,
// by the index's links, the components page and the playground. No page holds an SDK fence, so
// the SDK's palette check has nothing to run on; the components page's editors are held to its
// colors by code-editor.test.ts. Each hand page's cascade layers, read from its sheets in the
// order the document names them, are the foundation's, then the SDK's site, then page, the
// shared sheet's (web/pages/page.css), last, and its source holds no inline <style>, which the
// build would write ahead of the linked sheets. The components page sets every section apart, its
// heading --space-xl below what came before; the playground has no section, its one screen proved
// by playground-layout.test.ts. Nothing here names the site: its base is package.json's name.
// Adapted from spike-html-hosting-architecture (27d70e1): test/browser/site.test.ts, its checks
// the SDK's.
// Adapted from spike-html-hosting-sdk (v0.6.2): template/test/browser/site.test.ts, its checks
// run on each hand page, as the SDK's README gives a root-style site, its crawl reaching the hand
// pages alone, without the palette check.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { crawl, holdsReadingWidth, shell } from "@jaimestill/spike-html-hosting-sdk/browser.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import { viewport } from "./viewport.ts";

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

/** The hand pages, each by its path under the base. */
const hand = ["", "components.html", "playground.html"];

/** The app page, the playground, whose main spans the body's content width. */
const APP = "playground.html";

describe("the site under its base", () => {
  for (const path of hand) {
    const where = path || "the index";
    for (const [name, check] of Object.entries(shell)) {
      // The playground is an app page: main spans the body's content width, and its prose holds
      // the reading width instead, by the check below.
      if (path === APP && check === holdsReadingWidth) continue;
      test(`${name} on ${where}`, async () => {
        const page = await browser.open("about:blank");
        try {
          await check(page, server.origin, `${server.origin}${path}`);
        } finally {
          await page.close();
        }
      });
    }

    test(`${where}'s header holds no site nav, and the page loads no site-nav.js`, async () => {
      const page = await browser.open(`${server.origin}${path}`);
      try {
        const nav: { inHeader: number; defined: boolean } = await page.evaluate(`({
          inHeader: document.querySelectorAll("body > header sl-site-nav").length,
          defined: customElements.get("sl-site-nav") !== undefined,
        })`);
        assert.deepEqual(nav, { inHeader: 0, defined: false });
      } finally {
        await page.close();
      }
    });
  }

  for (const path of hand) {
    const where = path || "the index";
    test(`${where}'s cascade layers are the foundation's, then site, then page, and its source holds no inline sheet`, async () => {
      const page = await browser.open(`${server.origin}${path}`);
      try {
        const read: { layers: string[]; inline: boolean } = await page.evaluate(`(async () => {
          // Each layer by its full name, in the order the document first names it: the cascade's
          // order. A statement or a block names its layer at its place in the sheet, a layered
          // @import names its layer before the imported sheet's own, and a block's layers nest
          // under its name; a conditional group's rules are walked in place. The document's
          // sheets come first, then its adopted ones, as the cascade orders them.
          const layers = [];
          const name = (outer, inner) => (outer ? outer + "." + inner : inner);
          // A dotted name declares each layer it nests in first, as the cascade does.
          const named = (full) => {
            const parts = full.split(".");
            for (let i = 1; i <= parts.length; i++) {
              const prefix = parts.slice(0, i).join(".");
              if (!layers.includes(prefix)) layers.push(prefix);
            }
          };
          const walk = (rules, outer) => {
            for (const rule of rules) {
              if (rule instanceof CSSLayerStatementRule) {
                for (const inner of rule.nameList) named(name(outer, inner));
              } else if (rule instanceof CSSLayerBlockRule) {
                const full = rule.name ? name(outer, rule.name) : outer;
                if (rule.name) named(full);
                walk(rule.cssRules, full);
              } else if (rule instanceof CSSImportRule) {
                const full = rule.layerName ? name(outer, rule.layerName) : outer;
                if (rule.layerName) named(full);
                if (rule.styleSheet) walk(rule.styleSheet.cssRules, full);
              } else if (rule instanceof CSSGroupingRule) {
                walk(rule.cssRules, outer);
              }
            }
          };
          for (const sheet of [...document.styleSheets, ...document.adoptedStyleSheets]) {
            walk(sheet.cssRules, "");
          }
          const source = await (await fetch(location.href)).text();
          return { layers, inline: /<style[\\s>]/i.test(source) };
        })()`);
        const top = read.layers.filter((layer) => !layer.includes("."));
        assert.deepEqual(top, ["foundation", "site", "page"], read.layers.join(", "));
        const site = read.layers.indexOf("site");
        assert.ok(
          read.layers.slice(0, site).every((layer) => layer.split(".")[0] === "foundation"),
          `every layer before site is the foundation's: ${read.layers.join(", ")}`,
        );
        assert.ok(
          read.layers.some((layer) => layer.startsWith("foundation.")),
          "the foundation's sub-layers are read",
        );
        assert.equal(read.layers.at(-1), "page", "page is the last layer");
        assert.equal(read.inline, false, "the page's source holds no <style>");
      } finally {
        await page.close();
      }
    });
  }

  test("components.html sets each section apart: its heading sits --space-xl below what came before", async () => {
    const page = await browser.open(`${server.origin}components.html`);
    try {
      const gaps: { id: string; gap: number; xl: number }[] = await page.evaluate(`(() => {
      const probe = document.createElement("div");
      probe.style.blockSize = "var(--space-xl)";
      document.body.append(probe);
      const xl = probe.getBoundingClientRect().height;
      probe.remove();
      return [...document.querySelectorAll("main > section")].map((section) => ({
        id: section.id,
        gap: section.querySelector("h2").getBoundingClientRect().top -
          section.previousElementSibling.getBoundingClientRect().bottom,
        xl,
      }));
    })()`);
      assert.ok(gaps.length > 0, "the page has sections");
      for (const { id, gap, xl } of gaps) {
        assert.ok(xl > 0, "--space-xl resolves");
        assert.ok(
          gap >= xl - 0.5,
          `#${id}'s heading sits ${gap}px below what came before, under ${xl}px`,
        );
      }
    } finally {
      await page.close();
    }
  });

  test(`${APP}'s prose, its heading, intro, and disclosure, holds its 80ch reading width, centered, at 1600px and 1120px, and the whole width less the gutters at 390px`, async () => {
    const page = await browser.open(`${server.origin}${APP}`);
    try {
      for (const width of [1600, 1120, 390]) {
        await viewport(page, width);
        const read: { ch: number; viewport: number; gutter: number; prose: number[][] } =
          await page.evaluate(`(() => {
          const main = document.querySelector("main");
          const probe = document.createElement("div");
          probe.style.inlineSize = "80ch";
          main.append(probe);
          const ch = probe.getBoundingClientRect().width;
          probe.remove();
          const viewport = document.documentElement.clientWidth;
          return {
            ch,
            viewport,
            gutter: parseFloat(getComputedStyle(document.body).paddingInlineStart),
            prose: [...main.querySelectorAll(":scope > :is(h1, p, details)")].map((element) => {
              const { left, right, width } = element.getBoundingClientRect();
              return [left, viewport - right, width];
            }),
          };
        })()`);
        assert.equal(read.prose.length, 3, "the heading, the intro, and the disclosure");
        const column = Math.min(read.ch, read.viewport - 2 * read.gutter);
        for (const [left, right, inline] of read.prose) {
          assert.ok(Math.abs(inline - column) <= 0.5, `at ${width}px the prose is ${inline}px`);
          assert.ok(Math.abs(left - right) <= 1, `at ${width}px it is centered, ${left}, ${right}`);
        }
      }
    } finally {
      await page.close();
    }
  });

  test("the crawl reaches the hand pages, and nothing else", async (t) => {
    const page = await browser.open("about:blank");
    try {
      const crawled = await crawl(page, server.origin, root);
      t.diagnostic(`${crawled.pages} pages, ${crawled.links} in-site links`);
      assert.deepEqual(
        { pages: crawled.pages, unreachable: crawled.unreachable, hand: crawled.hand },
        { pages: hand.length, unreachable: [], hand },
      );
    } finally {
      await page.close();
    }
  });
});
