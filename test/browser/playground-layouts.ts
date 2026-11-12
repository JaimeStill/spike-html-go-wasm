// The browser tier's hold on the playground's fixed layout, shared by playground-layout.test.ts,
// which proves the bands and the boxes, and playground-arrangement.test.ts, which proves the
// reader's arrangement: the demo's parts' boxes and band, the widths that put the demo either side
// of a band's edge, a paste into the editor, the programs and comments the tests write, what each
// scroller keeps, the Layout menu's choice, and the accessibility tree and keys. Every wait is
// bounded.

import assert from "node:assert/strict";

import { until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Page } from "@jaimestill/spike-html-apps-tooling/browser.js";

import { settle } from "./go-demos.ts";
import { viewport } from "./viewport.ts";

/** The playground's one demo. */
export const PLAYGROUND = `document.querySelector("sl-go-demo")`;

/** A CSS px to the rem, the foundation's root size. */
export const REM = 16;

/** The bands a fixed demo's width puts it in, as go-demo.css names them in --band. */
export type Band = "phone" | "middle" | "wide";

/** Where the editor sits from 64rem, as the Layout menu offers it. */
export type Placement = "left" | "top" | "right";

/** Every placement, in the Layout menu's order. */
export const PLACEMENTS: Placement[] = ["left", "top", "right"];

/** A part's box, [x, y, width, height], each to a hundredth of a px, on the page, so the page's
 * own scroll moves none, and whether it shows. */
export interface Part {
  box: number[];
  shown: boolean;
}

/** The parts of the demo laid out by its fixed layout, by name: the demo, the toolbar, the file
 * tabs, the panel and the editor's frame, the output, its tablist, the console and its log's
 * frame, and the timings; and the demo's band, the page's sideways overflow, and its width. */
export interface Layout {
  band: Band;
  parts: Record<string, Part>;
  sideways: number;
  width: number;
}

/** The demo's layout, as Layout says, read once two frames have painted. */
export const layout = async (page: Page): Promise<Layout> => {
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

/** The playground's one screen as laid out: the viewport's height and width, less any scrollbar;
 * the body's padding at the inline start, the inline end, and the block end, the page's gutter;
 * how far the page scrolls each way, and its height; the top and bottom edges, on the page, of the
 * disclosure and of the demo, and the demo's inline start and end in the viewport; and whether the
 * disclosure is open. Each length to a hundredth of a px. */
export interface Screen {
  viewport: number;
  width: number;
  gutters: [number, number, number];
  down: number;
  sideways: number;
  height: number;
  details: [number, number];
  demo: [number, number];
  sides: [number, number];
  open: boolean;
}

/** The playground's one screen, as Screen says, read once two frames have painted. */
export const screen = async (page: Page): Promise<Screen> => {
  await settle(page);
  return page.evaluate(`(() => {
    const round = (n) => Math.round(n * 100) / 100;
    const edges = (element) => {
      const { top, bottom } = element.getBoundingClientRect();
      return [round(top + scrollY), round(bottom + scrollY)];
    };
    const html = document.documentElement;
    const body = getComputedStyle(document.body);
    const details = document.querySelector("main > details");
    const demo = ${PLAYGROUND}.getBoundingClientRect();
    return {
      viewport: innerHeight,
      width: html.clientWidth,
      gutters: [body.paddingInlineStart, body.paddingInlineEnd, body.paddingBlockEnd].map(parseFloat),
      down: html.scrollHeight - html.clientHeight,
      sideways: html.scrollWidth - html.clientWidth,
      height: html.scrollHeight,
      details: edges(details),
      demo: edges(${PLAYGROUND}),
      sides: [round(demo.left), round(demo.right)],
      open: details.open,
    };
  })()`);
};

/** The fixed demo's floor, in lines of each part's own text, go-demo.css's
 * --sl-go-demo-editor-lines and --sl-go-demo-console-lines: the editor's frame and the console's
 * log frame are never shorter. */
export const FLOOR = { editor: 6, log: 2 };

/** The editor's frame's and the console's log frame's heights, each in lines of its own text. */
export const frameLines = (page: Page): Promise<{ editor: number; log: number }> =>
  page.evaluate(`(() => {
    const root = ${PLAYGROUND}.shadowRoot;
    const editor = root.querySelector("sl-code-editor").shadowRoot.querySelector(".editor");
    const log = root.querySelector("sl-console").shadowRoot.querySelector(".frame");
    const lines = (frame) =>
      frame.getBoundingClientRect().height / parseFloat(getComputedStyle(frame).lineHeight);
    return { editor: lines(editor), log: lines(log) };
  })()`);

/** Opens or closes the playground's disclosure by a click on its summary, as a reader does,
 * resolving once it is open or closed. */
export async function disclose(page: Page, open: boolean): Promise<void> {
  await page.evaluate(`(() => {
    const details = document.querySelector("main > details");
    if (details.open !== ${open}) details.querySelector("summary").click();
  })()`);
  await until(page, `document.querySelector("main > details").open === ${open}`, 5000);
}

/** Asserts that the page doesn't scroll sideways and every part shown lies inside the demo. */
export function contained({ parts, sideways }: Layout, width: number | string) {
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

/** Asserts that the parts sit as the placement places them from 64rem: the editor left of the
 * output, right of it, or above it, with the console over the timings beside the editor, or beside
 * them under it. */
export function placedAs({ parts }: Layout, placement: Placement, name: string): void {
  const [fx, fy, fw, fh] = parts.panel.box;
  const [ox, oy, ow] = parts.output.box;
  const [cx, cy] = parts.console.box;
  const [tx, ty] = parts.timings.box;
  const where = {
    left: fx + fw <= ox + 0.5 && cx === tx && cy < ty,
    right: ox + ow <= fx + 0.5 && cx === tx && cy < ty,
    top: fy + fh <= oy + 0.5 && cy === ty && cx < tx,
  };
  assert.ok(where[placement], `the parts at ${name} sit as editor ${placement} places them`);
}

/** The viewport width, in CSS px, at which the demo itself is the rems given wide, found by
 * measuring: the page's own margins and scrollbar follow its width, so they are measured, not
 * assumed. */
export async function widthFor(page: Page, rems: number): Promise<number> {
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

/** Pastes the text at the end of the editor's text, as the clipboard would, or over all of it
 * when over: a paste keeps its line breaks as written, where typed text's would be the editor's
 * keys. */
export const paste = (page: Page, text: string, over = false) =>
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
export const printing = (lines: number, spin = false) =>
  `package main

import "fmt"

func main() {
\tfor i := 1; i <= ${lines}; i++ {
\t\tfmt.Println("line", i)
\t}${spin ? "\n\tfor {\n\t}" : ""}
}
`;

/** Lines of comments, numbered, to paste. */
export const comments = (count: number) =>
  Array.from({ length: count }, (_, index) => `// pasted line ${index + 1}\n`).join("");

/** Each scroller's position and what it holds: the editor's frame and value, the console's log
 * frame and its row count, the timings, and the output part the tablist selects. */
export const kept = (page: Page) =>
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

/** The demo's toolbar's shadow root, as an expression. */
export const CONTROLS = `${PLAYGROUND}.shadowRoot.querySelector("sl-controls").shadowRoot`;

/** The placement the demo lays out, as its layout names it in data-placement; null with none. */
export const placed = (page: Page): Promise<Placement | null> =>
  page.evaluate(`${PLAYGROUND}.shadowRoot.querySelector(".demo").dataset.placement ?? null`);

/** Chooses the placement as a reader does with a pointer: a click on Layout opens its menu, and a
 * click on the item chooses it; resolves once the demo lays out in it and the menu has closed. */
export async function arrange(page: Page, placement: Placement): Promise<void> {
  await page.evaluate(`${CONTROLS}.querySelector('[data-control="layout"]').click()`);
  await until(page, `${CONTROLS}.querySelector("#layout-menu").matches(":popover-open")`, 5000);
  await page.evaluate(
    `${CONTROLS}.querySelector('#layout-menu [data-placement="${placement}"]').click()`,
  );
  await until(
    page,
    `${PLAYGROUND}.shadowRoot.querySelector(".demo").dataset.placement === "${placement}" &&
      !${CONTROLS}.querySelector("#layout-menu").matches(":popover-open")`,
    5000,
  );
  await settle(page);
}

/** A node of the page's accessibility tree, as Accessibility.queryAXTree gives it. */
export interface AXNode {
  ignored: boolean;
  role?: { value: string };
  name?: { value: string };
  properties?: { name: string; value: { value?: unknown } }[];
}

/** The unignored nodes of the role under the element the expression gives. */
export async function axQuery(page: Page, expression: string, role: string): Promise<AXNode[]> {
  const { result } = await page.cdp("Runtime.evaluate", { expression });
  const { nodes }: { nodes: AXNode[] } = await page.cdp("Accessibility.queryAXTree", {
    objectId: result.objectId,
    role,
  });
  return nodes.filter((node) => !node.ignored);
}

/** The node's property of the name, as the tree gives it, or undefined. */
export const property = (node: AXNode, name: string) =>
  node.properties?.find((each) => each.name === name)?.value.value;

/** The keys the tests press, each its key and its Windows virtual key code. */
export const KEYS = {
  ArrowLeft: 37,
  ArrowUp: 38,
  ArrowRight: 39,
  ArrowDown: 40,
  Home: 36,
  End: 35,
  Enter: 13,
  Escape: 27,
  " ": 32,
  Tab: 9,
} as const;

/** A key pressed and released on the focused element. Enter and Space carry their text, so a
 * button they reach activates as a reader's press would. */
export async function press(page: Page, key: keyof typeof KEYS) {
  const code = { " ": "Space" }[key as string] ?? key;
  const text = { Enter: "\r", " ": " " }[key as string];
  for (const type of ["keyDown", "keyUp"]) {
    await page.cdp("Input.dispatchKeyEvent", {
      type,
      key,
      code,
      windowsVirtualKeyCode: KEYS[key],
      ...(type === "keyDown" && text ? { text } : {}),
    });
  }
}
