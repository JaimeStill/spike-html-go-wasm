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
// motion. Nothing here names the site: its base is package.json's name.

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
  window.editors = {
    at: (state, list) => all(state, list)[0],
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
