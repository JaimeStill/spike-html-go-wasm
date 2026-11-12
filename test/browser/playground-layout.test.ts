// The playground's fixed layout, playground.html's one sl-go-demo with `fixed`: the build as Pages
// serves it, dist/ under the base by the SDK's served(), Vite's preview, in the pinned
// chrome-headless-shell.
//
// The demo is as tall as the viewport less the page's header, and its parts keep their shares of
// that height at every width: at the SDK's three capture widths, 390, 1120, and 1376 px, and at
// widths that put the demo itself half a rem either side of its two bands' edges, 44rem and 64rem,
// a paste of 500 lines into the editor, 10,000 lines printed, and a full table of a build's timings
// change no part's box; the page never scrolls sideways; and every part lies inside the demo. A
// Run, a Stop, a failed build, and a band change keep each part's content and scroll position,
// and the output tab chosen. Below 44rem, the output panel's tablist is the tabs pattern, its
// keyboard and accessibility tree the file tabs'; from 44rem it isn't there, and the console and
// the timings are no tabpanels. A demo without `fixed`, the components page's, has no output
// tablist and a console that grows. The helpers are go-demos.ts's and go-builds.ts's. Every wait
// is bounded.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import { BUILD, build, BUILT_PHASES, DONE } from "./go-builds.ts";
import { demo, open as openPage, pressControl, says, settle } from "./go-demos.ts";
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

/** The playground's one demo. */
const PLAYGROUND = `document.querySelector("sl-go-demo")`;

/** Opens the playground, watched (go-demos.ts). */
const open = async () => (await openPage(browser, server.origin, "playground.html")).page;

/** A CSS px to the rem, the foundation's root size. */
const REM = 16;

/** The bands a fixed demo's width puts it in, as go-demo.css names them in --band. */
type Band = "phone" | "middle" | "wide";

/** A part's box, [x, y, width, height], each to a hundredth of a px, on the page, so the page's
 * own scroll moves none, and whether it shows. */
interface Part {
  box: number[];
  shown: boolean;
}

/** The parts of the demo laid out by its fixed layout, by name: the demo, the toolbar, the file
 * tabs, the panel and the editor's frame, the output, its tablist, the console and its log's
 * frame, and the timings; and the demo's band, the page's sideways overflow, and its width. */
interface Layout {
  band: Band;
  parts: Record<string, Part>;
  sideways: number;
  width: number;
}

/** The demo's layout, as Layout says, read once two frames have painted. */
const layout = async (page: Page): Promise<Layout> => {
  await settle(page);
  return page.evaluate(`(() => {
    const demo = ${PLAYGROUND};
    const root = demo.shadowRoot;
    const editor = root.querySelector("sl-code-editor");
    const console = root.querySelector("sl-console");
    const elements = {
      demo,
      controls: root.querySelector("sl-controls"),
      tabs: root.querySelector("sl-file-tabs"),
      panel: root.querySelector("#panel"),
      editor: editor.shadowRoot.querySelector(".editor"),
      output: root.querySelector(".output"),
      outputTabs: root.querySelector(".output-tabs"),
      console,
      log: console.shadowRoot.querySelector(".frame"),
      timings: root.querySelector("sl-timings"),
    };
    const round = (n) => Math.round(n * 100) / 100;
    const parts = {};
    for (const [name, element] of Object.entries(elements)) {
      const { x, y, width, height } = element.getBoundingClientRect();
      parts[name] = {
        box: [x + scrollX, y + scrollY, width, height].map(round),
        shown: element.checkVisibility({ visibilityProperty: true }),
      };
    }
    const html = document.documentElement;
    return {
      band: getComputedStyle(root.querySelector(".demo")).getPropertyValue("--band").trim(),
      parts,
      sideways: html.scrollWidth - html.clientWidth,
      width: round(demo.getBoundingClientRect().width / ${REM}),
    };
  })()`);
};

/** Asserts that the page doesn't scroll sideways and every part shown lies inside the demo. */
function contained({ parts, sideways }: Layout, width: number) {
  assert.ok(sideways <= 0, `at ${width}px the page scrolls sideways by ${sideways}px`);
  const [x, y, w, h] = parts.demo.box;
  for (const [name, { box, shown }] of Object.entries(parts)) {
    if (!shown) continue;
    const [px, py, pw, ph] = box;
    assert.ok(
      px >= x - 0.5 && py >= y - 0.5 && px + pw <= x + w + 0.5 && py + ph <= y + h + 0.5,
      `at ${width}px the ${name}, ${box}, lies inside the demo, ${parts.demo.box}`,
    );
  }
}

/** The viewport width, in CSS px, at which the demo itself is the rems given wide, found by
 * measuring: the page's own margins and scrollbar follow its width, so they are measured, not
 * assumed. */
async function widthFor(page: Page, rems: number): Promise<number> {
  let width = Math.round(rems * REM + 64);
  for (let step = 0; step < 4; step++) {
    await viewport(page, width);
    const measured = (await layout(page)).width;
    const off = Math.round((rems - measured) * REM);
    if (off === 0) break;
    width += off;
  }
  return width;
}

/** The widths the layout is proved at, each with the band it gives, and a name for messages: the
 * SDK's three, and the demo half a rem either side of 44rem and 64rem. */
async function widths(page: Page): Promise<{ name: string; width: number; band: Band }[]> {
  return [
    { name: "390px", width: PHONE, band: "phone" },
    { name: "43.5rem", width: await widthFor(page, 43.5), band: "phone" },
    { name: "44.5rem", width: await widthFor(page, 44.5), band: "middle" },
    { name: "63.5rem", width: await widthFor(page, 63.5), band: "middle" },
    { name: "64.5rem", width: await widthFor(page, 64.5), band: "wide" },
    { name: "1120px", width: 1120, band: "wide" },
    { name: "1376px", width: 1376, band: "wide" },
  ];
}

/** Pastes the text at the end of the editor's text, as the clipboard would, or over all of it
 * when over: a paste keeps its line breaks as written, where typed text's would be the editor's
 * keys. */
const paste = (page: Page, text: string, over = false) =>
  page.evaluate(`(() => {
    const text = window.demos.editor(${PLAYGROUND}).shadowRoot.querySelector(".text");
    text.focus();
    const selection = getSelection();
    selection.selectAllChildren(text);
    if (!${over}) selection.collapseToEnd();
    const data = new DataTransfer();
    data.setData("text/plain", ${JSON.stringify(text)});
    text.dispatchEvent(new ClipboardEvent("paste", {
      clipboardData: data, bubbles: true, cancelable: true, composed: true,
    }));
  })()`);

/** A program printing the lines given, numbered, then, when spin, looping until Stop. */
const printing = (lines: number, spin = false) =>
  `package main

import "fmt"

func main() {
\tfor i := 1; i <= ${lines}; i++ {
\t\tfmt.Println("line", i)
\t}${spin ? "\n\tfor {\n\t}" : ""}
}
`;

/** Lines of comments, numbered, to paste. */
const comments = (count: number) =>
  Array.from({ length: count }, (_, index) => `// pasted line ${index + 1}\n`).join("");

/** Each scroller's position and what it holds: the editor's frame and value, the console's log
 * frame and its row count, the timings, and the output part the tablist selects. */
const kept = (page: Page) =>
  page.evaluate(`(() => {
    const root = ${PLAYGROUND}.shadowRoot;
    const editor = root.querySelector("sl-code-editor");
    const log = root.querySelector("sl-console").shadowRoot.querySelector(".frame");
    return {
      editor: editor.shadowRoot.querySelector(".editor").scrollTop,
      value: editor.value,
      log: log.scrollTop,
      rows: log.querySelector(".lines").children.length,
      timings: root.querySelector("sl-timings").scrollTop,
      selected: root.querySelector('.output-tabs [aria-selected="true"]').dataset.part,
    };
  })()`);

/** Scrolls the editor's frame and the console's log frame to the positions given. */
const scrollParts = (page: Page, editor: number, log: number) =>
  page.evaluate(`(() => {
    const root = ${PLAYGROUND}.shadowRoot;
    root.querySelector("sl-code-editor").shadowRoot.querySelector(".editor").scrollTop = ${editor};
    const frame = root.querySelector("sl-console").shadowRoot.querySelector(".frame");
    frame.scrollTop = ${log};
    frame.dispatchEvent(new Event("scroll"));
  })()`);

/** Selects the output part by a click on its tab. */
const choose = (page: Page, part: "console" | "timings") =>
  page.evaluate(
    `${PLAYGROUND}.shadowRoot.querySelector('.output-tabs [data-part="${part}"]').click()`,
  );

describe("the playground's fixed layout", () => {
  test("at each width, a paste of 500 lines, 10,000 lines printed, and a full timings table change no part's box; nothing scrolls the page sideways, and every part lies inside the demo", async () => {
    const page = await open();
    try {
      const proved = await widths(page);
      const before = new Map<string, Layout>();
      for (const { name, width, band } of proved) {
        await viewport(page, width);
        const laid = await layout(page);
        assert.equal(laid.band, band, `the band at ${name}`);
        // Below 44rem the timings share the console's cell, hidden behind its tab.
        assert.equal(laid.parts.outputTabs.shown, band === "phone", `the output tabs at ${name}`);
        assert.equal(laid.parts.timings.shown, band !== "phone", `the timings at ${name}`);
        contained(laid, width);
        before.set(name, laid);
      }

      await viewport(page, PHONE);
      await paste(page, printing(10_000), true);
      const printed = await build(page, PLAYGROUND, DONE);
      assert.deepEqual(printed.phases, BUILT_PHASES, "a full timings table");
      assert.equal(printed.lines.at(-1)?.text, "line 10000");
      const lines = (await page.evaluate(
        `window.demos.editor(${PLAYGROUND}).value.split("\\n").length`,
      )) as number;
      await paste(page, comments(500));
      await until(
        page,
        `window.demos.editor(${PLAYGROUND}).value.split("\\n").length === ${lines + 500}`,
        5000,
      );

      for (const { name, width } of proved) {
        await viewport(page, width);
        const laid = await layout(page);
        assert.deepEqual(laid, before.get(name), `every part's box at ${name}`);
        contained(laid, width);
        const overflows = await page.evaluate(`(() => {
          const root = ${PLAYGROUND}.shadowRoot;
          const editor = root.querySelector("sl-code-editor").shadowRoot.querySelector(".editor");
          const log = root.querySelector("sl-console").shadowRoot.querySelector(".frame");
          return [editor.scrollHeight > editor.clientHeight, log.scrollHeight > log.clientHeight];
        })()`);
        assert.deepEqual(overflows, [true, true], `the editor and the log scroll at ${name}`);
      }
    } finally {
      await page.close();
    }
  });

  test("a Run, a Stop, a failed build, and a band change keep each part's content and scroll position, and the output tab chosen", async () => {
    const page = await open();
    try {
      await viewport(page, PHONE);
      await paste(page, printing(2000, true) + comments(300), true);
      await scrollParts(page, 800, 0);
      await pressControl(page, PLAYGROUND, "run");
      await until(
        page,
        `window.demos.rows(${PLAYGROUND}).some((row) => row.text === "line 2000")`,
        BUILD,
      );
      await settle(page);
      await scrollParts(page, 800, 1000);
      await choose(page, "timings");
      const running = await kept(page);
      assert.deepEqual(
        { editor: running.editor, log: running.log, selected: running.selected },
        { editor: 800, log: 1000, selected: "timings" },
        "a Run keeps the editor's scroll",
      );
      assert.equal(running.rows, 2000);

      for (const width of [1120, await widthFor(page, 52), 1376, PHONE]) {
        await viewport(page, width);
        await settle(page);
        assert.deepEqual(await kept(page), running, `at ${width}px`);
      }

      await pressControl(page, PLAYGROUND, "stop");
      await says(page, PLAYGROUND, "Stopped main", 5000);
      await settle(page);
      assert.deepEqual(await kept(page), running, "after Stop");

      // A build that fails: an edit at the end, then Run.
      await paste(page, "x\n");
      await settle(page);
      const edited = await kept(page);
      await pressControl(page, PLAYGROUND, "run");
      await says(page, PLAYGROUND, "Failed main: compile exited with code 2", BUILD);
      await settle(page);
      const failed = await kept(page);
      assert.deepEqual(
        { editor: failed.editor, value: failed.value, selected: failed.selected },
        { editor: edited.editor, value: edited.value, selected: "timings" },
        "a failed build keeps the editor and the tab chosen",
      );
    } finally {
      await page.close();
    }
  });
});

/** A node of the page's accessibility tree, as Accessibility.queryAXTree gives it. */
interface AXNode {
  ignored: boolean;
  role?: { value: string };
  name?: { value: string };
  properties?: { name: string; value: { value?: unknown } }[];
}

/** The unignored nodes of the role under the element the expression gives. */
async function axQuery(page: Page, expression: string, role: string): Promise<AXNode[]> {
  const { result } = await page.cdp("Runtime.evaluate", { expression });
  const { nodes }: { nodes: AXNode[] } = await page.cdp("Accessibility.queryAXTree", {
    objectId: result.objectId,
    role,
  });
  return nodes.filter((node) => !node.ignored);
}

const selected = (node: AXNode) =>
  node.properties?.find((each) => each.name === "selected")?.value.value === true;

/** A key pressed and released on the focused element. */
async function press(page: Page, key: string, keyCode: number) {
  for (const type of ["keyDown", "keyUp"]) {
    await page.cdp("Input.dispatchKeyEvent", {
      type,
      key,
      code: key,
      windowsVirtualKeyCode: keyCode,
    });
  }
}

/** The focused output tab's part, each tab's tabindex, and which output parts show. */
const tabState = (page: Page) =>
  page.evaluate(`(() => {
    const root = ${PLAYGROUND}.shadowRoot;
    const tabs = [...root.querySelectorAll('.output-tabs [role="tab"]')];
    const shows = (selector) => root.querySelector(selector).checkVisibility({ visibilityProperty: true });
    return {
      focused: root.activeElement?.dataset.part ?? null,
      selected: tabs.find((tab) => tab.ariaSelected === "true")?.dataset.part,
      tabindex: tabs.map((tab) => tab.tabIndex),
      console: shows("sl-console"),
      timings: shows("sl-timings"),
    };
  })()`);

describe("the phone's output tablist", () => {
  test("is a tablist, Output panel, of Output and Timings, each controlling its tabpanel, the selected one alone shown; from 44rem it isn't there, and neither part is a tabpanel", async () => {
    const page = await open();
    try {
      await viewport(page, PHONE);
      await page.cdp("DOM.getDocument", {});
      const lists = await axQuery(page, PLAYGROUND, "tablist");
      assert.deepEqual(
        lists.map((node) => node.name?.value),
        ["Files", "Output panel"],
      );
      const tabs = await axQuery(page, `${PLAYGROUND}.shadowRoot.querySelector(".output")`, "tab");
      assert.deepEqual(
        tabs.map((node) => [node.name?.value, selected(node)]),
        [
          ["Output", true],
          ["Timings", false],
        ],
      );
      const panels = async () =>
        (await axQuery(page, `${PLAYGROUND}.shadowRoot.querySelector(".output")`, "tabpanel")).map(
          (node) => node.name?.value,
        );
      assert.deepEqual(await panels(), ["Output"], "the console, named by its tab");
      const controls = await page.evaluate(`[...${PLAYGROUND}.shadowRoot
        .querySelectorAll('.output-tabs [role="tab"]')].map((tab) => tab.getAttribute("aria-controls"))`);
      assert.deepEqual(controls, ["console", "timings"]);
      await choose(page, "timings");
      await settle(page);
      assert.deepEqual(await panels(), ["Timings"], "the timings, named by its tab");

      await viewport(page, await widthFor(page, 52));
      await settle(page);
      assert.deepEqual(
        (await axQuery(page, PLAYGROUND, "tablist")).map((node) => node.name?.value),
        ["Files"],
      );
      assert.deepEqual(await panels(), []);
      const shown = await tabState(page);
      assert.deepEqual([shown.console, shown.timings], [true, true]);
    } finally {
      await page.close();
    }
  });

  test("the selected tab alone is in the tab order; Left and Right select the previous and the next, wrapping, Home and End the first and the last", async () => {
    const page = await open();
    try {
      await viewport(page, PHONE);
      await page.evaluate(
        `${PLAYGROUND}.shadowRoot.querySelector('.output-tabs [aria-selected="true"]').focus()`,
      );
      const at = (part: "console" | "timings") => ({
        focused: part,
        selected: part,
        tabindex: part === "console" ? [0, -1] : [-1, 0],
        console: part === "console",
        timings: part === "timings",
      });
      assert.deepEqual(await tabState(page), at("console"));
      const steps: [string, number, "console" | "timings"][] = [
        ["ArrowRight", 39, "timings"],
        ["ArrowRight", 39, "console"],
        ["ArrowLeft", 37, "timings"],
        ["ArrowLeft", 37, "console"],
        ["End", 35, "timings"],
        ["Home", 36, "console"],
      ];
      for (const [key, code, part] of steps) {
        await press(page, key, code);
        await settle(page);
        assert.deepEqual(await tabState(page), at(part), `${key} to ${part}`);
      }
    } finally {
      await page.close();
    }
  });
});

describe("a demo without fixed", () => {
  test("has no output tablist, and its console grows as before", async () => {
    const { page } = await openPage(browser, server.origin);
    try {
      const target = demo("program");
      const shown = await page.evaluate(`(() => {
        const root = ${target}.shadowRoot;
        return {
          tabs: root.querySelector(".output-tabs"),
          fill: root.querySelector("sl-console").hasAttribute("fill"),
          max: getComputedStyle(root.querySelector("sl-console").shadowRoot.querySelector(".frame"))
            .maxBlockSize,
        };
      })()`);
      assert.deepEqual(shown, { tabs: null, fill: false, max: "384px" });
    } finally {
      await page.close();
    }
  });
});
