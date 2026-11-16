// The components page's rendered fence, a build step (scripts/rendered-fence.ts), read without a
// browser: renderFence renders the fixed Markdown fence through the SDK's own render and Shiki
// highlighter, a highlighted pre of one line with no empty line after it, whose text is the
// fence's line; components.html marks the fence's place once, inside the rendered-fence state's
// demo, and writeFence replaces the marker with the fence, failing the build, naming the page, when
// the page holds no marker or two.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  FENCE_MARKER,
  FENCE_PAGE,
  RENDERED_FENCE,
  renderFence,
  writeFence,
} from "../../scripts/rendered-fence.ts";

const page = readFileSync(join(import.meta.dirname, "../..", FENCE_PAGE), "utf8");

describe("the components page's rendered fence", () => {
  test("is the SDK's Shiki markup of the json fence: one line, its text the fence's line", async () => {
    const fence = await renderFence();
    assert.match(fence, /^<pre class="shiki [^"]*" tabindex="0"><code class="language-json">/);
    assert.match(fence, /<\/code><\/pre>$/);
    assert.equal(fence.match(/<span class="line">/g)?.length, 1, "one line, no empty one after it");
    assert.ok(!fence.includes("\n"), "no newline in or after its one line");
    assert.equal(fence.replace(/<[^>]*>/g, ""), RENDERED_FENCE.text);
  });

  test("components.html marks its place once, in the rendered-fence state's demo, and writeFence fills it", async () => {
    assert.equal(page.split(FENCE_MARKER).length, 2, "the page holds the marker once");
    assert.match(
      page,
      new RegExp(`label="format demo, rendered fence">\\s*${FENCE_MARKER}\\s*</sl-go-demo>`),
      "the marker is the demo's one child",
    );
    const fence = await renderFence();
    const out = writeFence(page, FENCE_PAGE, fence);
    assert.ok(!out.includes(FENCE_MARKER), "the marker is replaced");
    assert.equal(out.split(fence).length, 2, "by the fence, once");
  });

  test("a page without the marker, or with it twice, fails the build, naming the page", () => {
    for (const [html, found] of [
      ["<main></main>", 0],
      [`${FENCE_MARKER}${FENCE_MARKER}`, 2],
    ] as const) {
      assert.throws(
        () => writeFence(html, FENCE_PAGE, "<pre></pre>"),
        new RegExp(`want one ${FENCE_MARKER} in ${FENCE_PAGE}, found ${found}`),
      );
    }
  });
});
