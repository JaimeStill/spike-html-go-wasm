// The site's build, as Pages serves it: dist/ under the base, by the SDK's served(), Vite's
// preview, loaded in the pinned chrome-headless-shell. Each of the SDK's shell checks is a test on
// a fresh page of the hand index, whose header has no site nav, which the checks allow. The crawl,
// from the index, checks every copied page, none here, and loads each hand page it reaches: it
// reaches exactly the index. The index holds no highlighted code yet, so the SDK's palette check
// has nothing to run on. Nothing here names the site: its base is package.json's name.
// Adapted from spike-html-hosting-architecture (27d70e1): test/browser/site.test.ts, its checks
// the SDK's.
// Adapted from spike-html-hosting-sdk (v0.6.1): template/test/browser/site.test.ts, its crawl
// reaching the hand index alone, without the palette check.

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

describe("the site under its base", () => {
  for (const [name, check] of Object.entries(shell)) {
    test(name, async () => {
      const page = await browser.open("about:blank");
      try {
        await check(page, server.origin);
      } finally {
        await page.close();
      }
    });
  }

  test("the crawl reaches the hand index, and nothing else", async (t) => {
    const page = await browser.open("about:blank");
    try {
      const crawled = await crawl(page, server.origin, root);
      t.diagnostic(`${crawled.pages} pages, ${crawled.links} in-site links`);
      assert.deepEqual(
        { pages: crawled.pages, unreachable: crawled.unreachable, hand: crawled.hand },
        { pages: 1, unreachable: [], hand: [""] },
      );
    } finally {
      await page.close();
    }
  });
});
