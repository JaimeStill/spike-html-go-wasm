// The site nav's build step (scripts/site-nav.ts) on the index's markup, read from index.html
// without a browser: writeNav replaces the where-to-go marker with the list, and fails the build,
// naming the index and the marker, when the index lacks it or holds it twice. Another page is
// written without the marker and takes no list.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { WHERE_TO_GO, writeNav } from "../../scripts/site-nav.ts";

const index = readFileSync(join(import.meta.dirname, "../../index.html"), "utf8");

describe("the index's where-to-go list", () => {
  test("index.html marks the list's place once, and writeNav replaces the marker with the list", () => {
    assert.equal(index.split(WHERE_TO_GO).length, 2, "index.html holds the marker once");
    const out = writeNav(index, "index.html");
    assert.ok(!out.includes(WHERE_TO_GO), "the marker is replaced");
    assert.equal(out.match(/<section class="where-to-go"/g)?.length, 1, "one list");
  });

  test("an index without the marker, or with it twice, fails the build, naming the index", () => {
    const without = index.replace(WHERE_TO_GO, "");
    assert.throws(
      () => writeNav(without, "index.html"),
      /site-nav: want one .*site-nav: where-to-go.* in index\.html, found 0/,
    );
    const twice = index.replace(WHERE_TO_GO, `${WHERE_TO_GO}\n${WHERE_TO_GO}`);
    assert.throws(
      () => writeNav(twice, "index.html"),
      /site-nav: want one .*site-nav: where-to-go.* in index\.html, found 2/,
    );
  });

  test("another page needs no marker and takes no list", () => {
    const out = writeNav(index.replace(WHERE_TO_GO, ""), "components.html");
    assert.ok(!out.includes('class="where-to-go"'));
  });
});
