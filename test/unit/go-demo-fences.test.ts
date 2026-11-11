// Every program demo's go fence on the components page is its scenario's source, byte for byte:
// each sl-go-demo in components.html with no handler attribute runs the prebuilt program, so the
// code it shows must be the code that program was built from. A fence is a direct-child pre of the
// demo, its text the pre's text content, as sl-go-demo reads it (web/components/go-demo.ts); its
// file is the fence's name, its data-file, on the pre or its code, else the pre's title, else
// main.go, under cmd/<scenario>/, so a one-fence demo's is its entrypoint, cmd/<scenario>/main.go.
// The page's 20rem copies are the script's, cloned from these, so the written demos are every
// demo's source.
//
// The page is read as text, with no browser and no HTML parser dependency: the demos are the
// page's hand-written markup, so a small reader suffices, held to the HTML parser's rules where
// they bear on a fence's text: comments skipped, the newline right after a pre's start tag
// dropped, and character references decoded. Anything it can't read, a named reference it
// doesn't know or a demo it can't close, fails the test rather than pass a fence unread.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const root = join(import.meta.dirname, "../..");

/** The named character references the reader decodes; any other fails the read. */
const NAMED: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Text with its character references decoded. */
function decode(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (reference, body: string) => {
    if (body[0] === "#") {
      const hex = body[1] === "x" || body[1] === "X";
      return String.fromCodePoint(parseInt(body.slice(hex ? 2 : 1), hex ? 16 : 10));
    }
    const named = NAMED[body];
    if (named === undefined)
      throw new Error(`a character reference the reader can't decode: ${reference}`);
    return named;
  });
}

/** A start tag's attributes, by name, each value decoded; a bare attribute's value is "". */
function attributes(tag: string): Map<string, string> {
  const found = new Map<string, string>();
  const body = tag.replace(/^<[\w-]+/, "").replace(/\/?>$/, "");
  for (const [, name, value] of body.matchAll(
    /([^\s"'=<>/]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g,
  )) {
    found.set(name.toLowerCase(), decode((value ?? "").replace(/^(["'])(.*)\1$/s, "$2")));
  }
  return found;
}

/** The void elements, which take no end tag. */
const VOID = new Set([
  "area",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

/** A program demo as written: its scenario and its fences, each its name and its text. */
interface ProgramDemo {
  scenario: string;
  fences: { name: string; text: string }[];
}

/** The fences of a demo's content: each direct-child pre, its name and its text content. */
function fences(content: string): { name: string; text: string }[] {
  const found: { name: string; text: string }[] = [];
  let depth = 0;
  let fence: {
    name: string | undefined;
    title: string | undefined;
    text: string;
    depth: number;
  } | null = null;
  let at = 0;
  for (const match of content.matchAll(/<(\/?)([a-zA-Z][\w-]*)[^>]*>/g)) {
    const [tag, closing, rawName] = match;
    const name = rawName.toLowerCase();
    if (fence) fence.text += content.slice(at, match.index);
    at = match.index + tag.length;
    if (closing) {
      depth--;
      if (fence && depth === fence.depth && name === "pre") {
        found.push({ name: fence.name ?? fence.title ?? "main.go", text: decode(fence.text) });
        fence = null;
      }
      continue;
    }
    const attrs = attributes(tag);
    if (name === "pre" && depth === 0 && !fence) {
      fence = { name: attrs.get("data-file"), title: attrs.get("title"), text: "", depth };
      // The parser drops a newline right after a pre's start tag.
      if (content[at] === "\n") at++;
    } else if (fence && name === "code" && depth === fence.depth + 1) {
      fence.name ??= attrs.get("data-file");
    }
    if (!VOID.has(name) && !tag.endsWith("/>")) depth++;
  }
  if (fence) throw new Error("a fence the reader can't close");
  return found;
}

/** The page's program demos, each sl-go-demo with no handler attribute, in order. */
function programDemos(html: string): ProgramDemo[] {
  const page = html.replace(/<!--[\s\S]*?-->/g, "");
  const demos: ProgramDemo[] = [];
  const starts = [...page.matchAll(/<sl-go-demo\b[^>]*>/gi)];
  for (const start of starts) {
    const from = start.index + start[0].length;
    const end = page.indexOf("</sl-go-demo>", from);
    if (end < 0) throw new Error(`a demo the reader can't close: ${start[0]}`);
    const attrs = attributes(start[0]);
    if (attrs.has("handler")) continue;
    demos.push({ scenario: attrs.get("scenario") ?? "", fences: fences(page.slice(from, end)) });
  }
  return demos;
}

describe("the components page's program demos", () => {
  const html = readFileSync(join(root, "components.html"), "utf8");
  const demos = programDemos(html);

  test("are found: the page's hello demos, every one read", () => {
    assert.deepEqual(
      demos.map(({ scenario, fences }) => [scenario, fences.map(({ name }) => name)]),
      [
        ["hello", ["main.go"]],
        ["hello", ["main.go"]],
      ],
    );
  });

  test("each go fence equals its scenario's source byte for byte", () => {
    for (const { scenario, fences } of demos) {
      for (const { name, text } of fences) {
        const source = readFileSync(join(root, "cmd", scenario, name), "utf8");
        assert.equal(text, source, `the ${scenario} demo's ${name}`);
      }
    }
  });
});

describe("the reader", () => {
  test("reads a fence as the parser does: its newline after <pre> dropped, its markup stripped, its references decoded", () => {
    const [demo] = programDemos(
      `<!-- <sl-go-demo scenario="no"> --><sl-go-demo scenario="x" label="a &amp; b"><pre data-file="a.go">
<code><span>if a &lt; b &amp;&amp; c &#62; d &#x26; "</span>
</code></pre><pre title="b.go"><code>b</code></pre></sl-go-demo>
<sl-go-demo scenario="y" handler="format"><pre><code>[]</code></pre></sl-go-demo>`,
    );
    assert.deepEqual(demo, {
      scenario: "x",
      fences: [
        { name: "a.go", text: 'if a < b && c > d & "\n' },
        { name: "b.go", text: "b" },
      ],
    });
  });

  test("refuses a reference it doesn't know, rather than pass the fence unread", () => {
    assert.throws(
      () => programDemos(`<sl-go-demo scenario="x"><pre><code>&nbsp;</code></pre></sl-go-demo>`),
      /&nbsp;/,
    );
  });
});
