// sl-code-editor on the components page, the build as Pages serves it: dist/ under the base by the
// SDK's served(), Vite's preview, in the pinned chrome-headless-shell.
//
// The build: the tokenizer's chunk holds Shiki's Go and JSON grammars and no other, and no Shiki
// wasm is emitted. Loading: the index never requests the tokenizer, the components page does, and
// until it arrives every editor shows its text with no range painted. Colors: in every palette
// the foundation registers, in light and in dark, every character of the Go and JSON editors
// paints, through its highlight, the color the SDK's own fence of the same code gives it, built
// here at test time by the SDK's createSyntax and rendered on the page beside them; a palette with
// no syntax theme paints the text plain; and no element enters the editor's text. Sharing: two
// editors paint into the same highlights, and removing one leaves the other's ranges and colors.
// The accessibility tree, read through CDP: each editor a multiline textbox named by its label or
// by its caption through aria-labelledby, the read-only one read-only, and no line number in the
// tree. The gutter: no text, every number beside its line's first row in each space and type
// profile, at a wide and a narrow viewport, wrapped lines included. Read-only: keys, typing, and
// paste change nothing, while selection, copy, and focus work and the highlighting stays. value:
// setting it replaces the text and re-highlights, sending no event. Typing re-highlights without
// moving the caret or a selection. Focus shows on the frame, and nothing moves under reduced
// motion. Editing, through CDP's keys and input methods: Enter carries the indent, Tab and
// Shift+Tab indent and outdent a caret's line or a selection's lines and keep the selection, one
// undo reverts each and redo restores it, Escape releases Tab and typing, a click, or focus coming
// back arms it, a composition commits as typed, input reaches the host once an edit and change
// once focus leaves with the value changed, and the keyboard hint and description say the Tab
// model. Nothing here names the site: its base is package.json's name.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch, SETTLED, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";
import { builtinSyntax, createSyntax } from "@jaimestill/spike-html-hosting-sdk/syntax.js";

const root = join(import.meta.dirname, "../..");
const assets = join(root, "dist/assets");

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

/** The page's helpers, installed on window.editors once the page has loaded:
 *
 * - at(state, list): the editor of the figure data-state names, in the list'th states list, the
 *   first by default, or of #code-editor .focus when list is "focus"; all(state, list) every one.
 * - painted(editor): the editor's text, and each character's color as it paints: its highlight's
 *   ::highlight() color when a range of the editor covers it, else the text's own; with the
 *   ranges' count and the text's element children.
 * - ranges(editor): how many ranges in the document's highlights lie in the editor's text.
 * - settled(editor): resolves once the editor's ranges cover its text as tokenized: a range ends
 *   at its value's last non-space character.
 * - select(editor, start, end): focuses the editor and selects its text from start to end, as
 *   offsets in its value; selected(editor) gives the selection as [start, end] offsets, a br
 *   counting as its "\n", or null when the selection isn't in the editor.
 * - listen(editor): counts the input and change events the host hears from then on, in
 *   editor.heard, with whether each was the host's own and change bubbled.
 */
const HELPERS = `(() => {
  const lists = () => document.querySelectorAll("#code-editor .states");
  const scope = (list) =>
    list === "focus" ? document.querySelector("#code-editor .focus") : lists()[list ?? 0];
  const all = (state, list) =>
    [...scope(list).querySelectorAll(\`figure[data-state="\${state}"] sl-code-editor\`)];
  const text = (editor) => editor.shadowRoot.querySelector(".text");
  /** The offset in the text of a DOM position. */
  const offset = (element, node, at) => {
    const before = new Range();
    before.setStart(element, 0);
    before.setEnd(node, at);
    return before.toString().length;
  };
  /** The editor's ranges, each with its highlight's name and its offsets. */
  const spans = (editor) => {
    const element = text(editor);
    const found = [];
    for (const [name, highlight] of CSS.highlights) {
      for (const range of highlight) {
        if (!element.contains(range.startContainer)) continue;
        found.push({
          name,
          start: offset(element, range.startContainer, range.startOffset),
          end: offset(element, range.endContainer, range.endOffset),
        });
      }
    }
    return found;
  };
  /** The text of the content before a DOM position, a br counting as "\n". */
  const before = (element, node, at) => {
    const range = new Range();
    range.setStart(element, 0);
    range.setEnd(node, at);
    let length = 0;
    const walk = (parent) => {
      for (const child of parent.childNodes) {
        if (child instanceof Text) length += child.data.length;
        else if (child instanceof HTMLBRElement) length += 1;
        else walk(child);
      }
    };
    walk(range.cloneContents());
    return length;
  };
  /** The DOM position of an offset in the element's text. */
  const at = (element, offset) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let start = 0;
    let last = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (offset <= start + node.data.length) return [node, offset - start];
      start += node.data.length;
      last = node;
    }
    return last ? [last, last.data.length] : [element, 0];
  };
  window.editors = {
    at: (state, list) => all(state, list)[0],
    select(editor, start, end = start) {
      editor.focus();
      const element = text(editor);
      getSelection().setBaseAndExtent(...at(element, start), ...at(element, end));
    },
    selected(editor) {
      const element = text(editor);
      const [range] = getSelection().getComposedRanges({ shadowRoots: [editor.shadowRoot] });
      if (!range || !element.contains(range.startContainer)) return null;
      return [
        before(element, range.startContainer, range.startOffset),
        before(element, range.endContainer, range.endOffset),
      ];
    },
    listen(editor) {
      editor.heard = [];
      for (const type of ["input", "change"]) {
        editor.addEventListener(type, (event) => editor.heard.push({
          type, own: event.target === editor, bubbles: event.bubbles,
        }));
      }
    },
    all,
    ranges: (editor) => spans(editor).length,
    painted(editor) {
      const element = text(editor);
      const value = editor.value;
      const plain = getComputedStyle(element).color;
      const colors = Array.from(value, () => plain);
      const found = spans(editor);
      for (const { name, start, end } of found) {
        const color = getComputedStyle(element, \`::highlight(\${name})\`).color;
        for (let i = start; i < end; i++) colors[i] = color;
      }
      return { value, colors, plain, ranges: found.length, children: element.children.length };
    },
    async settled(editor) {
      await editor.updateComplete;
      const last = editor.value.trimEnd().length;
      const deadline = Date.now() + 10000;
      while (Date.now() < deadline) {
        if (spans(editor).some(({ end }) => end === last)) return true;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      throw new Error("the editor never painted to its text's end");
    },
  };
})()`;

/** Opens the components page, waits for every editor to render, and installs the helpers. */
async function open(path = "components.html"): Promise<Page> {
  const page = await browser.open(`${server.origin}${path}`);
  await page.evaluate(SETTLED);
  await page.evaluate(HELPERS);
  return page;
}

/** Waits until every Go and JSON editor in the states lists has painted its text. */
const settleAll = (page: Page) =>
  page.evaluate(`Promise.all([...document.querySelectorAll("#code-editor sl-code-editor")]
    .filter((editor) => ["go", "json"].includes(editor.language) && editor.value.trim() !== "")
    .map((editor) => window.editors.settled(editor)))`);

/** A key pressed and released on the focused element, with the text it types, if any. */
async function press(page: Page, key: string, code = key, keyCode?: number, modifiers = 0) {
  await page.cdp("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    modifiers,
    ...(key.length === 1 ? { text: key, unmodifiedText: key } : {}),
  });
  await page.cdp("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code,
    windowsVirtualKeyCode: keyCode,
    modifiers,
  });
}

/** Ctrl, as CDP's modifiers mask names it. */
const CTRL = 2;

/** A node of the page's accessibility tree, as Accessibility.getFullAXTree gives it. */
interface AXNode {
  ignored: boolean;
  role?: { value: string };
  name?: { value: string; sources?: { attribute?: string; value?: unknown }[] };
  properties?: { name: string; value: { value: unknown } }[];
}

describe("the editor's build", () => {
  test("the tokenizer's grammars are Go's and JSON's alone, and no Shiki wasm is emitted", () => {
    const scopes = new Set<string>();
    for (const file of readdirSync(assets).filter((name) => name.endsWith(".js"))) {
      const source = readFileSync(join(assets, file), "utf8");
      for (const [, scope] of source.matchAll(/\\?"scopeName\\?":\s*\\?"([\w.-]+)\\?"/g)) {
        scopes.add(scope);
      }
    }
    assert.deepEqual([...scopes].sort(), ["source.go", "source.json"]);
    assert.deepEqual(
      readdirSync(assets).filter((name) => name.endsWith(".wasm")),
      [],
      "Shiki's Oniguruma engine isn't emitted; Go's modules are under go/",
    );
  });
});

describe("loading the tokenizer", () => {
  const tokenizer = /\/assets\/tokenizer-[\w-]+\.js$/;

  test("the index never requests it", async () => {
    const page = await browser.open("about:blank");
    try {
      const requests: string[] = [];
      page.on("Network.requestWillBeSent", ({ request }) => requests.push(request.url));
      await page.cdp("Network.enable");
      await page.goto(`${server.origin}`);
      await page.evaluate(SETTLED);
      assert.ok(requests.length > 0, "the page's own requests were seen");
      assert.deepEqual(
        requests.filter((url) => tokenizer.test(new URL(url).pathname)),
        [],
      );
    } finally {
      await page.close();
    }
  });

  test("the components page requests it once, and each editor shows plain text until it loads", async () => {
    const page = await browser.open("about:blank");
    try {
      const held: string[] = [];
      const requests: string[] = [];
      page.on("Network.requestWillBeSent", ({ request }) => requests.push(request.url));
      page.on("Fetch.requestPaused", ({ requestId }) => held.push(requestId));
      await page.cdp("Network.enable");
      await page.cdp("Fetch.enable", { patterns: [{ urlPattern: "*/assets/tokenizer-*.js" }] });
      void page.goto(`${server.origin}components.html`);
      await until(
        page,
        `document.querySelector("sl-code-editor")?.shadowRoot?.querySelector(".text") ? true : false`,
      );
      await new Promise((resolve) => setTimeout(resolve, 200));
      assert.equal(held.length, 1, "the tokenizer is requested once, while its request is held");
      await page.evaluate(HELPERS);
      const before: { value: string; ranges: number }[] = await page.evaluate(`
        [...document.querySelectorAll("#code-editor sl-code-editor")]
          .map((editor) => ({ value: editor.value, ranges: window.editors.ranges(editor) }))`);
      assert.ok(
        before.some(({ value }) => value.includes("package shapes")),
        "the text is shown",
      );
      assert.deepEqual(
        before.filter(({ ranges }) => ranges > 0),
        [],
        "nothing is painted until the tokenizer loads",
      );
      await page.cdp("Fetch.continueRequest", { requestId: held[0] });
      await page.cdp("Fetch.disable");
      await settleAll(page);
      assert.equal(requests.filter((url) => tokenizer.test(new URL(url).pathname)).length, 1);
    } finally {
      await page.close();
    }
  });
});

describe("the editor's colors", () => {
  let page: Page;
  let palettes: string[];
  before(async () => {
    page = await open();
    await settleAll(page);
    palettes = await page.evaluate(
      `[...(globalThis[Symbol.for("spike-html-apps-foundation.registry")]?.color ?? [])]`,
    );
    // The SDK's fence of each editor's code, built as markdownPages builds one, rendered on the
    // page with its stylesheet, each fence after its editor.
    const syntax = await createSyntax(builtinSyntax, ["go", "json"]);
    const fences: { state: string; html: string }[] = [];
    for (const [state, lang] of [
      ["go", "go"],
      ["json", "json"],
    ]) {
      const value: string = await page.evaluate(`window.editors.at("${state}").value`);
      const html = syntax.highlight(value, lang);
      assert.ok(html, `the SDK highlights ${lang}`);
      fences.push({ state, html });
    }
    await page.evaluate(`(() => {
      const style = document.createElement("style");
      style.textContent = ${JSON.stringify(syntax.stylesheet())};
      document.head.append(style);
      for (const { state, html } of ${JSON.stringify(fences)}) {
        const fence = document.createElement("div");
        fence.className = "sdk-fence";
        fence.dataset.state = state;
        fence.innerHTML = html;
        window.editors.at(state).after(fence);
      }
    })()`);
  });
  after(async () => {
    await page?.close();
  });

  /** Sets the palette and the scheme on the root, as the settings do. */
  const apply = (palette: string | null, scheme: string) =>
    page.evaluate(`(() => {
      const root = document.documentElement;
      ${palette === null ? `root.removeAttribute("data-palette");` : `root.setAttribute("data-palette", ${JSON.stringify(palette)});`}
      root.setAttribute("data-scheme", ${JSON.stringify(scheme)});
    })()`);

  /** The SDK fence's text and each character's color, after the editor of the state. */
  const fence = (state: string): Promise<{ text: string; colors: string[] }> =>
    page.evaluate(`(() => {
      const code = document.querySelector(${JSON.stringify(`.sdk-fence[data-state="${state}"] code`)});
      const colors = [];
      let text = "";
      const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const color = getComputedStyle(node.parentElement).color;
        for (const _ of node.data) colors.push(color);
        text += node.data;
      }
      return { text, colors };
    })()`);

  test("the registry lists exactly the palettes the SDK gives a syntax theme", () => {
    assert.deepEqual([...palettes].sort(), builtinSyntax.map(({ palette }) => palette).sort());
  });

  for (const scheme of ["light", "dark"]) {
    for (const state of ["go", "json"]) {
      test(`in ${scheme}, every character of the ${state} editor paints the SDK fence's color, in each palette`, async () => {
        // The default palette applies with no attribute too, as a root with none has it.
        for (const palette of [null, ...palettes]) {
          await apply(palette, scheme);
          const at = `${palette ?? "no data-palette"} in ${scheme}`;
          const shown = await page.evaluate(
            `window.editors.painted(window.editors.at("${state}"))`,
          );
          const sdk = await fence(state);
          assert.equal(shown.children, 0, "no element enters the editor's text");
          assert.equal(sdk.text.replace(/\n$/, ""), shown.value.replace(/\n$/, ""));
          const differ: string[] = [];
          for (let i = 0; i < sdk.text.length; i++) {
            if (/\s/.test(shown.value[i])) continue;
            if (shown.colors[i] !== sdk.colors[i]) {
              differ.push(
                `${JSON.stringify(shown.value.slice(i, i + 8))} at ${i}: ${shown.colors[i]}, not ${sdk.colors[i]}`,
              );
            }
          }
          assert.deepEqual(differ.slice(0, 5), [], `${at}: ${differ.length} characters differ`);
          assert.ok(
            shown.colors.some((color: string) => color !== shown.plain),
            `${at}: the editor paints in its syntax theme's colors, not plain`,
          );
        }
      });
    }
  }

  test("a palette with no syntax theme paints the text plain, at the root or around the editor", async () => {
    for (const scheme of ["light", "dark"]) {
      await apply("unthemed", scheme);
      const atRoot = await page.evaluate(`window.editors.painted(window.editors.at("go"))`);
      assert.ok(atRoot.ranges > 0, "the ranges stay");
      assert.deepEqual(new Set(atRoot.colors), new Set([atRoot.plain]), `${scheme}: plain`);
      await apply("primer", scheme);
      const nested = await page.evaluate(`(() => {
        const figure = window.editors.at("go").closest("figure");
        figure.setAttribute("data-palette", "unthemed");
        const shown = window.editors.painted(window.editors.at("go"));
        figure.removeAttribute("data-palette");
        return shown;
      })()`);
      assert.deepEqual(new Set(nested.colors), new Set([nested.plain]), `${scheme}: plain inside`);
    }
    await apply(null, "light");
  });

  test("another language shows plain, with no range", async () => {
    const shown = await page.evaluate(`window.editors.painted(window.editors.at("plain"))`);
    assert.ok(shown.value.includes("SELECT"));
    assert.equal(shown.ranges, 0);
  });
});

describe("two editors sharing the document's highlights", () => {
  test("they paint into the same highlights, and removing one leaves the other painted", async () => {
    const page = await open();
    try {
      await settleAll(page);
      const shared: { names: string[][]; totals: number; colors: string[][] } =
        await page.evaluate(`(() => {
          const [first, second] = window.editors.all("shared");
          const names = (editor) => [...CSS.highlights]
            .filter(([, h]) => [...h].some((r) => editor.shadowRoot.contains(r.startContainer)))
            .map(([name]) => name).sort();
          return {
            names: [names(first), names(second)],
            totals: [...CSS.highlights.values()].reduce((n, h) => n + h.size, 0),
            colors: [first, second].map((e) => window.editors.painted(e).colors),
          };
        })()`);
      assert.ok(shared.names[0].length > 0);
      assert.deepEqual(
        shared.names[0],
        shared.names[1],
        "one highlight per color, both editors in it",
      );
      assert.deepEqual(shared.colors[0], shared.colors[1]);
      const removed: { totals: number; mine: number; colors: string[]; ranges: number } =
        await page.evaluate(`(() => {
          const [first, second] = window.editors.all("shared");
          const mine = window.editors.ranges(first);
          first.remove();
          const shown = window.editors.painted(second);
          return {
            totals: [...CSS.highlights.values()].reduce((n, h) => n + h.size, 0),
            mine, colors: shown.colors, ranges: shown.ranges,
          };
        })()`);
      assert.equal(
        removed.totals,
        shared.totals - removed.mine,
        "only the removed editor's ranges go",
      );
      assert.ok(removed.ranges > 0);
      assert.deepEqual(removed.colors, shared.colors[1], "the other stays painted as it was");
    } finally {
      await page.close();
    }
  });
});

describe("the editor in the accessibility tree", () => {
  test("each editor is a multiline textbox, named by its label or its caption, read-only as set, with no line number in the tree", async () => {
    const page = await open();
    try {
      await settleAll(page);
      const { nodes }: { nodes: AXNode[] } = await page.cdp("Accessibility.getFullAXTree", {});
      const property = (node: AXNode, name: string) =>
        node.properties?.find((p) => p.name === name)?.value.value;
      const boxes = nodes
        .filter((node) => !node.ignored && node.role?.value === "textbox")
        .map((node) => ({
          name: node.name?.value ?? "",
          multiline: property(node, "multiline") === true,
          readonly: property(node, "readonly") === true,
        }));
      const expected = [
        { name: "shapes.go", multiline: true, readonly: false },
        { name: "input.json", multiline: true, readonly: false },
        { name: "query.sql", multiline: true, readonly: false },
        { name: "shapes.go", multiline: true, readonly: true },
        { name: "long.go", multiline: true, readonly: false },
        {
          name: "Empty, named by this caption through aria-labelledby",
          multiline: true,
          readonly: false,
        },
        { name: "first.go", multiline: true, readonly: false },
        { name: "second.go", multiline: true, readonly: false },
        { name: "classify.go", multiline: true, readonly: false },
        { name: "events.go", multiline: true, readonly: false },
      ];
      // The tree lists nodes in no promised order, so the boxes are compared as a sorted list.
      const sorted = (list: typeof boxes) => list.map((box) => JSON.stringify(box)).sort();
      assert.deepEqual(
        sorted(boxes),
        sorted([...expected, ...expected, { name: "shapes.go", multiline: true, readonly: false }]),
      );
      // The caption names the empty editor through aria-labelledby.
      const empty = nodes.find(
        (node) => node.role?.value === "textbox" && node.name?.value.startsWith("Empty"),
      );
      assert.ok(
        empty?.name?.sources?.some((s) => s.attribute === "aria-labelledby" && s.value),
        `named by aria-labelledby: ${JSON.stringify(empty?.name?.sources)}`,
      );
      // No static text in the tree is a line number alone: the gutter is out of it.
      const numbers = nodes.filter(
        (node) =>
          !node.ignored &&
          node.role?.value === "StaticText" &&
          /^\d+$/.test(node.name?.value ?? ""),
      );
      assert.deepEqual(
        numbers.map((node) => node.name?.value),
        [],
      );
    } finally {
      await page.close();
    }
  });
});

describe("the gutter", () => {
  test("holds no text, and a select-all in the editor selects the value alone", async () => {
    const page = await open();
    try {
      await page.cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
      const gutter: { texts: string[]; hidden: boolean } = await page.evaluate(`(() => {
        const numbers = [...window.editors.at("go").shadowRoot.querySelectorAll(".number")];
        return {
          texts: [...new Set(numbers.map((n) => n.textContent))],
          hidden: numbers.every((n) => n.getAttribute("aria-hidden") === "true"),
        };
      })()`);
      assert.deepEqual(gutter, { texts: [""], hidden: true });
      await page.evaluate(`window.editors.at("go").focus()`);
      await press(page, "a", "KeyA", 65, CTRL);
      const copied: { selected: string; value: string } = await page.evaluate(`(() => {
        const editor = window.editors.at("go");
        const [range] = getSelection().getComposedRanges({ shadowRoots: [editor.shadowRoot] });
        const live = new Range();
        live.setStart(range.startContainer, range.startOffset);
        live.setEnd(range.endContainer, range.endOffset);
        return { selected: live.toString(), value: editor.value };
      })()`);
      assert.equal(copied.selected, copied.value);
    } finally {
      await page.close();
    }
  });

  // Each non-empty line's first character's line box, and its number's: their tops, in px, for
  // each that differs by more than a pixel; and each editor whose numbers aren't one a line.
  const ALIGNMENT = `(() => {
    const off = [];
    for (const editor of document.querySelectorAll("#code-editor sl-code-editor")) {
      const root = editor.shadowRoot;
      const text = root.querySelector(".text").firstChild;
      const numbers = [...root.querySelectorAll(".number")];
      let start = 0;
      editor.value.split("\\n").forEach((line, i) => {
        if (line !== "") {
          const range = new Range();
          range.setStart(text, start);
          range.setEnd(text, start + 1);
          // A character's rect is its glyph's content area, half the leading below its line box's
          // top; the number's box is its line box.
          const glyph = range.getClientRects()[0];
          const leading = parseFloat(getComputedStyle(numbers[i]).lineHeight) - glyph.height;
          const lineTop = glyph.top - leading / 2;
          const numberTop = numbers[i].getBoundingClientRect().top;
          if (Math.abs(lineTop - numberTop) > 1) {
            off.push(\`\${editor.label} line \${i + 1}: \${lineTop} vs \${numberTop}\`);
          }
        }
        start += line.length + 1;
      });
      if (numbers.length !== editor.value.split("\\n").length) {
        off.push(\`\${editor.label}: \${numbers.length} numbers\`);
      }
    }
    return off;
  })()`;

  test("every number sits beside its line's first row, in each space and type profile, wide and narrow", async () => {
    const page = await open();
    try {
      await settleAll(page);
      const wrapped: boolean = await page.evaluate(`(() => {
        const editor = window.editors.at("long", 1);
        const rows = editor.shadowRoot.querySelectorAll(".ghost");
        return [...rows].some((row) => row.getBoundingClientRect().height > parseFloat(getComputedStyle(row).lineHeight) * 1.5);
      })()`);
      assert.ok(wrapped, "the long editor at 20rem wraps a line");
      for (const width of [1120, 390]) {
        await page.cdp("Emulation.setDeviceMetricsOverride", {
          width,
          height: 900,
          deviceScaleFactor: 1,
          mobile: false,
        });
        for (const space of ["regular", "compact"]) {
          for (const type of ["sans", "mono"]) {
            await page.evaluate(`(() => {
              document.documentElement.setAttribute("data-space", "${space}");
              document.documentElement.setAttribute("data-type", "${type}");
            })()`);
            await page.evaluate(SETTLED);
            assert.deepEqual(await page.evaluate(ALIGNMENT), [], `${space}, ${type}, ${width}px`);
          }
        }
      }
    } finally {
      await page.close();
    }
  });
});

describe("a read-only editor", () => {
  test("rejects typing, keys, and paste, and keeps its highlighting, selection, and focus", async () => {
    const page = await open();
    try {
      await page.cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
      await settleAll(page);
      const before = await page.evaluate(`window.editors.painted(window.editors.at("readonly"))`);
      await page.evaluate(`window.editors.at("readonly").focus()`);
      await page.cdp("Input.insertText", { text: "typed" });
      await press(page, "x", "KeyX", 88);
      await press(page, "Enter", "Enter", 13);
      await press(page, "Backspace", "Backspace", 8);
      await press(page, "Tab", "Tab", 9);
      await page.evaluate(`window.editors.at("readonly").focus()`);
      await page.evaluate(`(() => {
        const text = window.editors.at("readonly").shadowRoot.querySelector(".text");
        const data = new DataTransfer();
        data.setData("text/plain", "pasted");
        text.dispatchEvent(new InputEvent("beforeinput", {
          inputType: "insertFromPaste", dataTransfer: data, bubbles: true, cancelable: true, composed: true,
        }));
      })()`);
      await new Promise((resolve) => setTimeout(resolve, 100));
      const after = await page.evaluate(`window.editors.painted(window.editors.at("readonly"))`);
      assert.equal(after.value, before.value, "no edit is made");
      assert.deepEqual(after.colors, before.colors, "the highlighting stays");
      assert.equal(after.children, 0);
      // Focus and selection: it takes focus, and a select-all selects its whole text.
      await page.evaluate(`window.editors.at("readonly").focus()`);
      await press(page, "a", "KeyA", 65, CTRL);
      const shown: { focused: boolean; selected: string } = await page.evaluate(`(() => {
        const editor = window.editors.at("readonly");
        const [range] = getSelection().getComposedRanges({ shadowRoots: [editor.shadowRoot] });
        const live = new Range();
        live.setStart(range.startContainer, range.startOffset);
        live.setEnd(range.endContainer, range.endOffset);
        return {
          focused: editor.shadowRoot.activeElement?.classList.contains("text") ?? false,
          selected: live.toString(),
        };
      })()`);
      assert.deepEqual(shown, { focused: true, selected: before.value });
    } finally {
      await page.close();
    }
  });
});

describe("value and typing", () => {
  test("setting value replaces the text and re-highlights it, sending no event", async () => {
    const page = await open();
    try {
      await settleAll(page);
      const shown: { value: string; text: string; heard: string[] } =
        await page.evaluate(`(async () => {
        const editor = window.editors.at("plain");
        const heard = [];
        for (const type of ["input", "change"]) editor.addEventListener(type, () => heard.push(type));
        editor.language = "go";
        editor.value = "package main\\n\\nfunc main() {}\\n";
        await window.editors.settled(editor);
        return {
          value: editor.value,
          text: editor.shadowRoot.querySelector(".text").textContent,
          heard,
        };
      })()`);
      assert.deepEqual(shown, {
        value: "package main\n\nfunc main() {}\n",
        text: "package main\n\nfunc main() {}\n",
        heard: [],
      });
      const numbers: number = await page.evaluate(
        `window.editors.at("plain").shadowRoot.querySelectorAll(".number").length`,
      );
      assert.equal(numbers, 4);
    } finally {
      await page.close();
    }
  });

  test("typing re-highlights the text without moving the caret or a selection", async () => {
    const page = await open();
    try {
      await page.cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
      await settleAll(page);
      // The caret after "package ", where typing makes a new identifier.
      await page.evaluate(`(() => {
        const editor = window.editors.at("go");
        editor.focus();
        const text = editor.shadowRoot.querySelector(".text").firstChild;
        const at = editor.value.indexOf("package shapes") + "package ".length;
        getSelection().setBaseAndExtent(text, at, text, at);
      })()`);
      await page.cdp("Input.insertText", { text: "my" });
      const caret = () =>
        page.evaluate(`(() => {
          const editor = window.editors.at("go");
          const element = editor.shadowRoot.querySelector(".text");
          const [range] = getSelection().getComposedRanges({ shadowRoots: [editor.shadowRoot] });
          const at = (node, offset) => {
            const before = new Range();
            before.setStart(element, 0);
            before.setEnd(node, offset);
            return before.toString().length;
          };
          return [at(range.startContainer, range.startOffset), at(range.endContainer, range.endOffset)];
        })()`);
      const typedAt: number = await page.evaluate(
        `window.editors.at("go").value.indexOf("package myshapes") + "package my".length`,
      );
      assert.ok(typedAt > 0, "the text is typed");
      // A selection made before the re-highlight runs.
      await page.evaluate(`(() => {
        const text = window.editors.at("go").shadowRoot.querySelector(".text").firstChild;
        getSelection().setBaseAndExtent(text, ${typedAt - 4}, text, ${typedAt + 3});
      })()`);
      // The re-highlight paints the new identifier as one token.
      await page.evaluate(`(async () => {
        const editor = window.editors.at("go");
        const element = editor.shadowRoot.querySelector(".text");
        const start = editor.value.indexOf("myshapes");
        const deadline = Date.now() + 10000;
        while (Date.now() < deadline) {
          for (const highlight of CSS.highlights.values()) {
            for (const range of highlight) {
              if (!element.contains(range.startContainer)) continue;
              if (range.startOffset === start && range.endOffset === start + "myshapes".length) return;
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
        throw new Error("the typed identifier was never highlighted as one token");
      })()`);
      assert.deepEqual(await caret(), [typedAt - 4, typedAt + 3]);
    } finally {
      await page.close();
    }
  });
});

describe("focus and motion", () => {
  test("Tab from the focus mark reaches the editor and its frame shows the focus outline", async () => {
    const page = await open();
    try {
      await page.cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
      await page.evaluate(`document.querySelector("[data-focus-start]").focus()`);
      await press(page, "Tab", "Tab", 9);
      const shown: { focused: boolean; outline: string } = await page.evaluate(`(() => {
        const editor = window.editors.at("focus", "focus");
        const frame = editor.shadowRoot.querySelector(".editor");
        return {
          focused: editor.shadowRoot.activeElement?.classList.contains("text") ?? false,
          outline: getComputedStyle(frame).outlineStyle,
        };
      })()`);
      assert.deepEqual(shown, { focused: true, outline: "solid" });
    } finally {
      await page.close();
    }
  });

  test("under reduced motion, nothing in the editor transitions or animates", async () => {
    const page = await open();
    try {
      await page.cdp("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "reduce" }],
      });
      const moving: string[] = await page.evaluate(`(() => {
        const root = window.editors.at("go").shadowRoot;
        return [...root.querySelectorAll("*")].filter((element) => {
          const style = getComputedStyle(element);
          return style.animationName !== "none" ||
            style.transitionDuration.split(",").some((d) => parseFloat(d) > 0);
        }).map((element) => element.className);
      })()`);
      assert.deepEqual(moving, []);
    } finally {
      await page.close();
    }
  });
});

// Editing, on the editable state's editor, its value the classify function below: each key's
// edit, its undo and redo, Escape's release of Tab, input methods, the events, and the hint.

/** The editable state's value, as the page sets it. */
const CLASSIFY = `func classify(n int) string {
\tswitch {
\tcase n < 0:
\t\treturn "negative"
\tdefault:
\t\treturn "other"
\t}
}
`;

/** CDP's modifiers mask: Shift. */
const SHIFT = 8;

/** The editable state's editor, as the page script reads it. */
const EDITABLE = `window.editors.at("editable")`;

/** The editor's value, its selection as offsets, and how many elements its text holds. */
interface Shown {
  value: string;
  selected: [number, number] | null;
  children: number;
}

const shown = (page: Page, editor = EDITABLE): Promise<Shown> =>
  page.evaluate(`(() => {
    const editor = ${editor};
    return {
      value: editor.value,
      selected: window.editors.selected(editor),
      children: editor.shadowRoot.querySelector(".text").children.length,
    };
  })()`);

/** Focuses the editor and selects from start to end, offsets in its value. */
const select = (page: Page, start: number, end = start, editor = EDITABLE) =>
  page.evaluate(`window.editors.select(${editor}, ${start}, ${end})`);

/** The offset just after the first occurrence of text in CLASSIFY. */
const endOf = (text: string) => {
  const at = CLASSIFY.indexOf(text);
  assert.ok(at >= 0, `CLASSIFY holds ${JSON.stringify(text)}`);
  return at + text.length;
};

/** The offset of the start of the first occurrence of text in CLASSIFY. */
const startOf = (text: string) => endOf(text) - text.length;

/** Enter pressed and released, with the carriage return a real key types, so the browser would
 * break the line itself were the press not taken. */
async function enter(page: Page, modifiers = 0) {
  const key = { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, modifiers };
  await page.cdp("Input.dispatchKeyEvent", { type: "keyDown", text: "\r", ...key });
  await page.cdp("Input.dispatchKeyEvent", { type: "keyUp", ...key });
}

const undo = (page: Page) => press(page, "z", "KeyZ", 90, CTRL);
const redo = (page: Page) => press(page, "Z", "KeyZ", 90, CTRL | SHIFT);

/** Opens the components page with focus emulated, every editor painted. */
async function editing(): Promise<Page> {
  const page = await open();
  await page.cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
  await settleAll(page);
  assert.equal(await page.evaluate(`${EDITABLE}.value`), CLASSIFY);
  return page;
}

describe("Enter", () => {
  test("breaks the line, the new line carrying the indent before the caret, and the caret after it", async () => {
    const page = await editing();
    try {
      const end = endOf(`\t\treturn "negative"`);
      await select(page, end);
      await enter(page);
      const indented = `${CLASSIFY.slice(0, end)}\n\t\t${CLASSIFY.slice(end)}`;
      assert.deepEqual(await shown(page), {
        value: indented,
        selected: [end + 3, end + 3],
        children: 0,
      });
      // The caret survives the re-highlight, and typing lands there.
      await page.evaluate(`window.editors.settled(${EDITABLE})`);
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.deepEqual((await shown(page)).selected, [end + 3, end + 3]);
      await page.cdp("Input.insertText", { text: "x" });
      assert.equal(
        (await shown(page)).value,
        `${CLASSIFY.slice(0, end)}\n\t\tx${CLASSIFY.slice(end)}`,
      );
    } finally {
      await page.close();
    }
  });

  test("carries only the whitespace before the caret, nothing from an unindented line, and replaces a selection", async () => {
    const page = await editing();
    try {
      // Between the two tabs of "\t\treturn": one tab before the caret.
      const between = startOf(`\t\treturn "negative"`) + 1;
      await select(page, between);
      await enter(page);
      assert.equal(
        (await shown(page)).value,
        `${CLASSIFY.slice(0, between)}\n\t${CLASSIFY.slice(between)}`,
      );
      await page.evaluate(`${EDITABLE}.value = ${JSON.stringify(CLASSIFY)}`);
      // At the end of the unindented first line: nothing carried.
      const first = endOf("string {");
      await select(page, first);
      await enter(page);
      assert.deepEqual((await shown(page)).selected, [first + 1, first + 1]);
      assert.equal(
        (await shown(page)).value,
        `${CLASSIFY.slice(0, first)}\n${CLASSIFY.slice(first)}`,
      );
      await page.evaluate(`${EDITABLE}.value = ${JSON.stringify(CLASSIFY)}`);
      // Shift+Enter breaks the line with no indent, as the browser does.
      const line = endOf(`\t\treturn "negative"`);
      await select(page, line);
      await enter(page, SHIFT);
      assert.equal(
        (await shown(page)).value,
        `${CLASSIFY.slice(0, line)}\n${CLASSIFY.slice(line)}`,
      );
      await page.evaluate(`${EDITABLE}.value = ${JSON.stringify(CLASSIFY)}`);
      // A selection of "negative" inside the indented line: replaced by the break and the indent.
      const word = startOf("negative");
      await select(page, word, word + "negative".length);
      await enter(page);
      assert.equal(
        (await shown(page)).value,
        `${CLASSIFY.slice(0, word)}\n\t\t${CLASSIFY.slice(word + "negative".length)}`,
      );
    } finally {
      await page.close();
    }
  });
});

describe("Tab and Shift+Tab", () => {
  test("Tab at a caret inserts a tab and leaves the caret after it", async () => {
    const page = await editing();
    try {
      const at = startOf("negative");
      await select(page, at);
      await press(page, "Tab", "Tab", 9);
      assert.deepEqual(await shown(page), {
        value: `${CLASSIFY.slice(0, at)}\t${CLASSIFY.slice(at)}`,
        selected: [at + 1, at + 1],
        children: 0,
      });
      assert.ok(
        await page.evaluate(`${EDITABLE}.shadowRoot.activeElement?.classList.contains("text")`),
        "focus stays in the editor",
      );
    } finally {
      await page.close();
    }
  });

  test("Tab with a selection indents every line it touches and keeps the same text selected", async () => {
    const page = await editing();
    try {
      // From inside "case" to inside the first "return": three lines.
      const from = startOf("case") + 2;
      const to = startOf("return") + 3;
      const selectedText = CLASSIFY.slice(from, to);
      await select(page, from, to);
      await press(page, "Tab", "Tab", 9);
      const expected = CLASSIFY.replace(
        `\tcase n < 0:\n\t\treturn "negative"\n`,
        `\t\tcase n < 0:\n\t\t\treturn "negative"\n`,
      );
      const indented = await shown(page);
      assert.equal(indented.value, expected);
      assert.ok(indented.selected);
      assert.equal(
        indented.value.slice(...indented.selected),
        selectedText.replace("\n", "\n\t"),
        "the selection holds the text it held, with the tab the line gained inside it",
      );
      assert.deepEqual(indented.selected, [from + 1, to + 2]);
      // A selection ending at a line's start doesn't touch that line; one starting at a line's
      // start takes in the tab it gains.
      await page.evaluate(`${EDITABLE}.value = ${JSON.stringify(CLASSIFY)}`);
      const lines = [startOf("\tswitch"), startOf("\tcase")];
      await select(page, lines[0], lines[1]);
      await press(page, "Tab", "Tab", 9);
      const one = await shown(page);
      assert.equal(one.value, CLASSIFY.replace("\tswitch", "\t\tswitch"));
      assert.deepEqual(one.selected, [lines[0], lines[1] + 1]);
    } finally {
      await page.close();
    }
  });

  test("Shift+Tab outdents a tab or up to four spaces from the caret's line or every selected line", async () => {
    const page = await editing();
    try {
      // The caret's line loses its first tab, the caret moving with the text.
      const caret = startOf("negative");
      await select(page, caret);
      await press(page, "Tab", "Tab", 9, SHIFT);
      assert.deepEqual(await shown(page), {
        value: CLASSIFY.replace(`\t\treturn "negative"`, `\treturn "negative"`),
        selected: [caret - 1, caret - 1],
        children: 0,
      });
      // Lines of spaces lose four, or as many as they have; a line with none is left.
      const spaced = "a\n      six\n  two\nnone\n";
      await page.evaluate(`${EDITABLE}.value = ${JSON.stringify(spaced)}`);
      await select(page, spaced.indexOf("six") + 1, spaced.indexOf("none") + 2);
      await press(page, "Tab", "Tab", 9, SHIFT);
      const out = await shown(page);
      assert.equal(out.value, "a\n  six\ntwo\nnone\n");
      assert.ok(out.selected);
      assert.equal(out.value.slice(...out.selected), "ix\ntwo\nno");
      // A caret inside the whitespace a line loses moves to the line's start.
      await page.evaluate(`${EDITABLE}.value = ${JSON.stringify(spaced)}`);
      await select(page, 4);
      await press(page, "Tab", "Tab", 9, SHIFT);
      assert.deepEqual((await shown(page)).selected, [2, 2]);
    } finally {
      await page.close();
    }
  });

  test("Shift+Tab with nothing to outdent makes no edit and sends no input", async () => {
    const page = await editing();
    try {
      await page.evaluate(`window.editors.listen(${EDITABLE})`);
      await select(page, 4);
      await press(page, "Tab", "Tab", 9, SHIFT);
      assert.deepEqual(await shown(page), { value: CLASSIFY, selected: [4, 4], children: 0 });
      assert.deepEqual(await page.evaluate(`${EDITABLE}.heard`), []);
      assert.ok(
        await page.evaluate(`${EDITABLE}.shadowRoot.activeElement?.classList.contains("text")`),
        "focus stays in the editor",
      );
    } finally {
      await page.close();
    }
  });
});

describe("undo and redo", () => {
  /** Each key edit, made from a fresh value: the selection it starts from and its keys. */
  const edits: { name: string; from: [number, number]; keys: (page: Page) => Promise<void> }[] = [
    {
      name: "Enter",
      from: [endOf(`"negative"`), endOf(`"negative"`)],
      keys: (page) => enter(page),
    },
    {
      name: "Tab at a caret",
      from: [startOf("negative"), startOf("negative")],
      keys: (page) => press(page, "Tab", "Tab", 9),
    },
    {
      name: "Tab over lines",
      from: [startOf("switch"), endOf("default:")],
      keys: (page) => press(page, "Tab", "Tab", 9),
    },
    {
      name: "Shift+Tab over lines",
      from: [startOf("switch"), endOf("default:")],
      keys: (page) => press(page, "Tab", "Tab", 9, SHIFT),
    },
  ];

  for (const { name, from, keys } of edits) {
    test(`one undo reverts ${name}, and redo restores it, by key and by the browser's command`, async () => {
      const page = await editing();
      try {
        await select(page, ...from);
        await keys(page);
        const edited = (await shown(page)).value;
        assert.notEqual(edited, CLASSIFY, "the edit is made");
        await undo(page);
        assert.equal((await shown(page)).value, CLASSIFY, "Ctrl+Z reverts it in one step");
        await redo(page);
        assert.equal((await shown(page)).value, edited, "Ctrl+Shift+Z restores it");
        // The browser's own undo and redo, as its Edit menu runs them.
        await page.evaluate(`document.execCommand("undo")`);
        assert.equal((await shown(page)).value, CLASSIFY, "the browser's undo reverts it");
        await page.evaluate(`document.execCommand("redo")`);
        assert.equal((await shown(page)).value, edited, "the browser's redo restores it");
        assert.equal((await shown(page)).children, 0, "no element enters the text");
      } finally {
        await page.close();
      }
    });
  }

  test("typing, then a key edit, undo one step at a time", async () => {
    const page = await editing();
    try {
      const end = endOf(`"other"`);
      await select(page, end);
      await page.cdp("Input.insertText", { text: " // done" });
      const typed = (await shown(page)).value;
      await enter(page);
      await undo(page);
      assert.equal((await shown(page)).value, typed, "the first undo takes back the Enter alone");
      await undo(page);
      assert.equal((await shown(page)).value, CLASSIFY, "the second takes back the typing");
      // Typing after a key edit is a step of its own.
      await press(page, "Tab", "Tab", 9);
      const tabbed = (await shown(page)).value;
      await page.cdp("Input.insertText", { text: "after" });
      await undo(page);
      assert.equal((await shown(page)).value, tabbed, "undo takes back the typing alone");
      await undo(page);
      assert.equal((await shown(page)).value, CLASSIFY, "and then the Tab");
    } finally {
      await page.close();
    }
  });

  test("an undo after value is set leaves the value as set", async () => {
    const page = await editing();
    try {
      await select(page, 4);
      await press(page, "Tab", "Tab", 9);
      await page.evaluate(`${EDITABLE}.value = "set\\n"`);
      await undo(page);
      const { value, children } = await shown(page);
      assert.deepEqual({ value, children }, { value: "set\n", children: 0 });
    } finally {
      await page.close();
    }
  });
});

describe("Escape's release of Tab", () => {
  /** Whether focus is in the editor's text. */
  const inside = (page: Page, editor = EDITABLE): Promise<boolean> =>
    page.evaluate(
      `document.activeElement === ${editor} && ${editor}.shadowRoot.activeElement?.classList.contains("text")`,
    );

  test("after Escape, Tab and Shift+Tab move focus out of the editor, editing nothing", async () => {
    const page = await editing();
    try {
      for (const modifiers of [0, SHIFT]) {
        await select(page, 4);
        await press(page, "Escape", "Escape", 27);
        assert.ok(await inside(page), "Escape leaves focus where it is");
        await press(page, "Tab", "Tab", 9, modifiers);
        assert.equal(
          await inside(page),
          false,
          `Tab${modifiers ? " with Shift" : ""} moves focus out`,
        );
        assert.equal((await shown(page)).value, CLASSIFY);
      }
      // Forward, focus reaches the events state's editor, the next in the tab order.
      await select(page, 4);
      await press(page, "Escape", "Escape", 27);
      await press(page, "Tab", "Tab", 9);
      assert.ok(await inside(page, `window.editors.at("events")`));
    } finally {
      await page.close();
    }
  });

  test("typing, a click, or focus coming back arms Tab again", async () => {
    const page = await editing();
    try {
      // Typing.
      await select(page, 4);
      await press(page, "Escape", "Escape", 27);
      await page.cdp("Input.insertText", { text: "x" });
      await press(page, "Tab", "Tab", 9);
      assert.ok(await inside(page), "Tab after typing stays in the editor");
      assert.equal((await shown(page)).value, `${CLASSIFY.slice(0, 4)}x\t${CLASSIFY.slice(4)}`);
      // A click in the text.
      await page.evaluate(`${EDITABLE}.value = ${JSON.stringify(CLASSIFY)}`);
      await select(page, 4);
      await press(page, "Escape", "Escape", 27);
      const point: { x: number; y: number } = await page.evaluate(`(() => {
        const element = ${EDITABLE}.shadowRoot.querySelector(".text");
        element.scrollIntoView({ block: "center" });
        const box = element.getBoundingClientRect();
        return { x: box.left + 4, y: box.top + 4 };
      })()`);
      for (const type of ["mousePressed", "mouseReleased"]) {
        await page.cdp("Input.dispatchMouseEvent", {
          type,
          ...point,
          button: "left",
          clickCount: 1,
        });
      }
      const clicked = (await shown(page)).selected;
      assert.ok(clicked && (await inside(page)), "the click puts the caret in the text");
      await press(page, "Tab", "Tab", 9);
      assert.ok(await inside(page), "Tab after a click stays in the editor");
      assert.equal(
        (await shown(page)).value,
        `${CLASSIFY.slice(0, clicked[0])}\t${CLASSIFY.slice(clicked[0])}`,
      );
      // Focus leaving and coming back.
      await page.evaluate(`${EDITABLE}.value = ${JSON.stringify(CLASSIFY)}`);
      await select(page, 4);
      await press(page, "Escape", "Escape", 27);
      await press(page, "Tab", "Tab", 9);
      assert.equal(await inside(page), false);
      const next = `window.editors.at("events")`;
      assert.ok(await inside(page, next));
      await press(page, "Escape", "Escape", 27);
      await press(page, "Tab", "Tab", 9, SHIFT);
      assert.ok(await inside(page), "Escape, then Shift+Tab, in the next editor comes back");
      await select(page, 4);
      await press(page, "Tab", "Tab", 9);
      assert.ok(await inside(page), "Tab after focus came back stays in the editor");
      assert.equal((await shown(page)).value, `${CLASSIFY.slice(0, 4)}\t${CLASSIFY.slice(4)}`);
    } finally {
      await page.close();
    }
  });
});

describe("the keyboard hint", () => {
  /** The editor's hint: whether it is shown, its text, and whether it is hidden from assistive
   * technology; null when the editor has none. */
  const hint = (page: Page, editor = EDITABLE) =>
    page.evaluate(`(() => {
      const hint = ${editor}.shadowRoot.querySelector(".hint");
      if (!hint) return null;
      return {
        open: hint.matches(":popover-open"),
        text: hint.textContent.replace(/\\s+/g, " ").trim(),
        hidden: hint.getAttribute("aria-hidden") === "true",
      };
    })()`);

  test("shows the Tab model below the editor while it has focus, and the release after Escape", async () => {
    const page = await editing();
    try {
      assert.deepEqual(await hint(page), {
        open: false,
        text: "Tab indents · Esc then Tab moves focus",
        hidden: true,
      });
      await select(page, 4);
      assert.equal((await hint(page))?.open, true, "shown while focused");
      const placed: { below: boolean; end: boolean; within: boolean; veil: string } =
        await page.evaluate(`(() => {
          const root = ${EDITABLE}.shadowRoot;
          const frame = root.querySelector(".editor").getBoundingClientRect();
          const hint = root.querySelector(".hint");
          const box = hint.getBoundingClientRect();
          return {
            below: box.top >= frame.bottom,
            end: Math.abs(box.right - frame.right) <= 1,
            within: box.width <= frame.width + 1,
            veil: getComputedStyle(hint, "::backdrop").backgroundColor,
          };
        })()`);
      assert.deepEqual(
        placed,
        { below: true, end: true, within: true, veil: "rgba(0, 0, 0, 0)" },
        "below the frame, at its inline end, no wider, and veiling nothing",
      );
      await press(page, "Escape", "Escape", 27);
      assert.deepEqual(await hint(page), { open: true, text: "Tab moves focus", hidden: true });
      await page.cdp("Input.insertText", { text: "x" });
      assert.equal((await hint(page))?.text, "Tab indents · Esc then Tab moves focus");
      await press(page, "Escape", "Escape", 27);
      await press(page, "Tab", "Tab", 9);
      assert.equal((await hint(page))?.open, false, "hidden once focus leaves");
    } finally {
      await page.close();
    }
  });

  test("an editable textbox describes the model, and a read-only one has neither hint nor description", async () => {
    const page = await editing();
    try {
      assert.equal(await hint(page, `window.editors.at("readonly")`), null);
      await page.evaluate(`window.editors.at("readonly").focus()`);
      assert.equal(
        await page.evaluate(`document.querySelectorAll(":popover-open").length`),
        0,
        "no hint opens for the read-only editor",
      );
      const { nodes }: { nodes: AXNode[] } = await page.cdp("Accessibility.getFullAXTree", {});
      const described = nodes
        .filter((node) => !node.ignored && node.role?.value === "textbox")
        .map((node) => ({
          readonly: node.properties?.some((p) => p.name === "readonly" && p.value.value === true),
          description: (node as AXNode & { description?: { value: string } }).description?.value,
        }));
      assert.ok(described.length > 0);
      for (const { readonly, description } of described) {
        assert.equal(
          description,
          readonly ? undefined : "Tab indents. Press Escape, then Tab, to move focus out.",
        );
      }
    } finally {
      await page.close();
    }
  });
});

describe("input methods", () => {
  test("a composition commits as typed, and no key is taken while it composes", async () => {
    const page = await editing();
    try {
      await page.evaluate(`window.editors.listen(${EDITABLE})`);
      const at = startOf("negative");
      await select(page, at);
      await page.cdp("Input.imeSetComposition", {
        text: "ね",
        selectionStart: 1,
        selectionEnd: 1,
      });
      await page.cdp("Input.imeSetComposition", {
        text: "ねg",
        selectionStart: 2,
        selectionEnd: 2,
      });
      // A Tab, Enter, or Escape while composing belongs to the input method: the editor neither
      // takes nor cancels it.
      const taken: string[] = await page.evaluate(`(() => {
        const element = ${EDITABLE}.shadowRoot.querySelector(".text");
        return ["Tab", "Enter", "Escape"].filter((key) => {
          const event = new KeyboardEvent("keydown", {
            key, isComposing: true, bubbles: true, cancelable: true, composed: true,
          });
          element.dispatchEvent(event);
          return event.defaultPrevented;
        });
      })()`);
      assert.deepEqual(taken, []);
      await page.cdp("Input.insertText", { text: "猫" });
      const committed = await shown(page);
      assert.equal(committed.value, `${CLASSIFY.slice(0, at)}猫${CLASSIFY.slice(at)}`);
      assert.deepEqual(committed.selected, [at + 1, at + 1]);
      const heard: { type: string }[] = await page.evaluate(`${EDITABLE}.heard`);
      assert.ok(heard.length > 0 && heard.every(({ type }) => type === "input"));
      // The composition's Escape released nothing: Tab after it still indents.
      await press(page, "Tab", "Tab", 9);
      assert.equal((await shown(page)).value, `${CLASSIFY.slice(0, at)}猫\t${CLASSIFY.slice(at)}`);
    } finally {
      await page.close();
    }
  });
});

describe("the editor's events", () => {
  test("input reaches the host once for each edit, key edits, undo, and redo included", async () => {
    const page = await editing();
    try {
      await page.evaluate(`window.editors.listen(${EDITABLE})`);
      const heard = async () =>
        (await page.evaluate(`${EDITABLE}.heard`)) as { type: string; own: boolean }[];
      const steps: [string, () => Promise<unknown>][] = [
        ["typing", () => page.cdp("Input.insertText", { text: "y" })],
        ["Enter", () => enter(page)],
        ["Tab", () => press(page, "Tab", "Tab", 9)],
        ["Shift+Tab", () => press(page, "Tab", "Tab", 9, SHIFT)],
        ["Backspace", () => press(page, "Backspace", "Backspace", 8)],
        ["undo", () => undo(page)],
        ["redo", () => redo(page)],
      ];
      await select(page, endOf(`"other"`));
      let value = (await shown(page)).value;
      for (const [i, [name, step]] of steps.entries()) {
        await step();
        const now = (await shown(page)).value;
        assert.notEqual(now, value, `${name} edits`);
        value = now;
        assert.deepEqual(
          await heard(),
          Array.from({ length: i + 1 }, () => ({ type: "input", own: true, bubbles: true })),
          `one input after ${name}, the host's own`,
        );
      }
      // The indent over lines, one input for every line it changes.
      await select(page, startOf("switch"), endOf("default:"));
      await press(page, "Tab", "Tab", 9);
      assert.equal((await heard()).length, steps.length + 1);
    } finally {
      await page.close();
    }
  });

  test("change goes once focus leaves with the value changed since focus came in, and no other time", async () => {
    const page = await editing();
    try {
      await page.evaluate(`window.editors.listen(${EDITABLE})`);
      const changes = async () =>
        ((await page.evaluate(`${EDITABLE}.heard`)) as { type: string }[]).filter(
          ({ type }) => type === "change",
        );
      const leave = () =>
        page.evaluate(
          `document.querySelector("h1").setAttribute("tabindex", "-1"), document.querySelector("h1").focus()`,
        );
      // Edited, then left: one change, bubbling, the host's own, as focus leaves and not before.
      await select(page, 4);
      await page.cdp("Input.insertText", { text: "z" });
      await enter(page);
      assert.deepEqual(await changes(), [], "no change while focus stays");
      await leave();
      assert.deepEqual(await changes(), [{ type: "change", own: true, bubbles: true }]);
      // Focused and left with no edit: none.
      await select(page, 4);
      await leave();
      assert.equal((await changes()).length, 1, "no change without an edit");
      // Edited and undone back to the value focus came in with: none.
      await select(page, 4);
      await page.cdp("Input.insertText", { text: "q" });
      await undo(page);
      await leave();
      assert.equal((await changes()).length, 1, "no change when the value is as it was");
      // Set by value while focused: none, and the set value is what change measures from.
      await select(page, 4);
      await page.evaluate(`${EDITABLE}.value = "set"`);
      await leave();
      assert.equal((await changes()).length, 1, "setting value sends no change");
      // Edited after the set: one more.
      await select(page, 3);
      await page.cdp("Input.insertText", { text: "!" });
      await leave();
      assert.equal((await changes()).length, 2);
      assert.equal((await shown(page)).value, "set!");
    } finally {
      await page.close();
    }
  });

  test("setting value sends neither event, and a read-only editor sends none and lets Tab move focus", async () => {
    const page = await editing();
    try {
      for (const state of ["editable", "readonly"]) {
        await page.evaluate(`window.editors.listen(window.editors.at("${state}"))`);
      }
      await page.evaluate(`${EDITABLE}.value = "package main\\n"`);
      const readonly = `window.editors.at("readonly")`;
      const before = (await shown(page, readonly)).value;
      await page.evaluate(`${readonly}.focus()`);
      await enter(page);
      await page.cdp("Input.insertText", { text: "typed" });
      await press(page, "Tab", "Tab", 9);
      const moved: boolean = await page.evaluate(`document.activeElement !== ${readonly}`);
      assert.ok(moved, "Tab moves focus out of the read-only editor");
      assert.equal((await shown(page, readonly)).value, before);
      assert.deepEqual(await page.evaluate(`[${EDITABLE}.heard, ${readonly}.heard]`), [[], []]);
    } finally {
      await page.close();
    }
  });

  test("the events state's readout counts what its editor sends", async () => {
    const page = await editing();
    try {
      const events = `window.editors.at("events")`;
      const readout = () =>
        page.evaluate(`${events}.closest("figure").querySelector(".readout").textContent`);
      assert.equal(await readout(), "Specimen aid, events heard: input 0 · change 0");
      await select(page, 4, 4, events);
      await page.cdp("Input.insertText", { text: "a" });
      await press(page, "Tab", "Tab", 9);
      assert.equal(await readout(), "Specimen aid, events heard: input 2 · change 0");
      await press(page, "Escape", "Escape", 27);
      await press(page, "Tab", "Tab", 9);
      assert.equal(await readout(), "Specimen aid, events heard: input 2 · change 1");
    } finally {
      await page.close();
    }
  });
});
