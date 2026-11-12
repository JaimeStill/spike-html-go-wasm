// Every program demo's go fence on the components page is its scenario's source, byte for byte:
// each sl-go-demo in components.html with no handler and no source attribute runs the prebuilt
// program, so the code it shows must be the code that program was built from. The playground's one
// demo, a source demo, opens on the starter: its fences, main.go, lexer.go, parser.go, eval.go, and
// input.txt, in that order, are cmd/calc's files byte for byte. A fence is a direct-child pre of
// the demo, its text the pre's text content, as sl-go-demo reads it (web/components/go-demo.ts);
// its file is the fence's name, its data-file, on the pre or its code, else the pre's title, else
// main.go, under cmd/<scenario>/, so a one-fence demo's is its entrypoint, cmd/<scenario>/main.go.
// The written demos are every demo's source: the pages' scripts add none.
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

/** A demo as written: its attributes and its fences. */
interface WrittenDemo {
  attrs: Map<string, string>;
  fences: { name: string; text: string }[];
}

/** The page's demos, every sl-go-demo outside a comment, in order. */
function writtenDemos(html: string): WrittenDemo[] {
  const page = html.replace(/<!--[\s\S]*?-->/g, "");
  const demos: WrittenDemo[] = [];
  for (const start of page.matchAll(/<sl-go-demo\b[^>]*>/gi)) {
    const from = start.index + start[0].length;
    const end = page.indexOf("</sl-go-demo>", from);
    if (end < 0) throw new Error(`a demo the reader can't close: ${start[0]}`);
    demos.push({ attrs: attributes(start[0]), fences: fences(page.slice(from, end)) });
  }
  return demos;
}

/** The page's program demos, each sl-go-demo with no handler attribute and no source attribute,
 * in order: a source demo's fences are the reader's program, which no scenario was built from. */
function programDemos(html: string): ProgramDemo[] {
  return writtenDemos(html)
    .filter(({ attrs }) => !attrs.has("handler") && !attrs.has("source"))
    .map(({ attrs, fences }) => ({ scenario: attrs.get("scenario") ?? "", fences }));
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

describe("the playground's demo", () => {
  const html = readFileSync(join(root, "playground.html"), "utf8");

  test("is one source demo with editable files, opening on cmd/calc's files byte for byte", () => {
    const demos = writtenDemos(html);
    assert.deepEqual(
      demos.map(({ attrs, fences }) => [
        attrs.has("source"),
        attrs.has("editable-files"),
        attrs.has("scenario") || attrs.has("handler"),
        fences.map(({ name }) => name),
      ]),
      [[true, true, false, ["main.go", "lexer.go", "parser.go", "eval.go", "input.txt"]]],
    );
    const [{ fences }] = demos;
    for (const { name, text } of fences) {
      assert.equal(
        text,
        readFileSync(join(root, "cmd/calc", name), "utf8"),
        `the starter's ${name}`,
      );
    }
  });
});

describe("the reader", () => {
  test("reads a fence as the parser does: its newline after <pre> dropped, its markup stripped, its references decoded", () => {
    const [demo, ...rest] = programDemos(
      `<!-- <sl-go-demo scenario="no"> --><sl-go-demo scenario="x" label="a &amp; b"><pre data-file="a.go">
<code><span>if a &lt; b &amp;&amp; c &#62; d &#x26; "</span>
</code></pre><pre title="b.go"><code>b</code></pre></sl-go-demo>
<sl-go-demo scenario="y" handler="format"><pre><code>[]</code></pre></sl-go-demo>
<sl-go-demo source><pre><code>package main</code></pre></sl-go-demo>`,
    );
    assert.deepEqual(demo, {
      scenario: "x",
      fences: [
        { name: "a.go", text: 'if a < b && c > d & "\n' },
        { name: "b.go", text: "b" },
      ],
    });
    assert.deepEqual(rest, [], "a handler demo and a source demo are no program demos");
  });

  test("refuses a reference it doesn't know, rather than pass the fence unread", () => {
    assert.throws(
      () => programDemos(`<sl-go-demo scenario="x"><pre><code>&nbsp;</code></pre></sl-go-demo>`),
      /&nbsp;/,
    );
  });
});
