// The site's build, as Pages serves it: dist/ under the base, by the SDK's served(), Vite's
// preview, loaded in the pinned chrome-headless-shell. Each of the SDK's shell checks is a test on
// a fresh page of each hand page, the index, the runtime page, and the components page, whose
// headers have no site nav,
// which the checks allow, and which a test of its own holds on each: no sl-site-nav in the header,
// and no site-nav.js loaded, which defines it; the build bundles the module, so the registry
// rather than a request names it. The crawl, from the index, checks every copied page, none here,
// and loads each hand page it reaches: it reaches exactly the index and, by the index's links, the
// runtime page and the components page. No page holds an SDK fence, so the SDK's palette check has
// nothing to run on; the components page's editors are held to its colors by
// code-editor.test.ts. Nothing here names the site: its base is package.json's name.
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
import { crawl, shell } from "@jaimestill/spike-html-hosting-sdk/browser.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

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
const hand = ["", "runtime.html", "components.html"];

describe("the site under its base", () => {
  for (const path of hand) {
    const where = path || "the index";
    for (const [name, check] of Object.entries(shell)) {
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
