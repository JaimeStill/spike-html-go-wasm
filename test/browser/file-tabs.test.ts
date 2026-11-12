// sl-file-tabs on the components page, the build as Pages serves it: dist/ under the base by the
// SDK's served(), Vite's preview, in the pinned chrome-headless-shell.
//
// The accessibility tree, read through CDP: a tablist named Files, one tab per file in order, the
// active file's selected, a modified file's name saying so, a read-only file's described so, and
// every tab controlling the tabpanel that holds the editor. The keyboard, through CDP input: one
// tab in the tab order, the selected one; Left and Right wrapping, Home and End, focus following
// and a select request sent for each tab reached, the page applying it. Control: a request no
// owner applies changes neither the selection nor the tab order, the set's own change does, and
// the tabs never write the set. The marker follows the editor's edits, through the page's loop.
// Overflow: at a phone's width the row scrolls, the active tab in view as the page loads, as focus
// moves, and as the set changes, the page never scrolled; no row, wide or at a phone's width,
// overflows up or down in any space and type. Focus shows, the row scrolls smoothly only when motion is allowed, and
// nothing moves under reduced motion. The tabs listen only to the set they hold, only while in the
// document. Nothing here names the site: its base is package.json's name.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch, SETTLED } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import { PHONE, viewport, WIDE } from "./viewport.ts";

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

/** The page's helpers, installed on window.tabs once the page has loaded:
 *
 * - figure(state, list): the figure data-state names in the states list of #file-tabs, or in its
 *   .focus when list is "focus"; at(state, list) its sl-file-tabs,
 *   editor(state, list) its sl-code-editor.
 * - shown(tabs): each tab as it renders: its file's name, whether selected, its tabindex, and
 *   whether it shows a marker; with the name of the tab focus is on, if any.
 * - listen(tabs): records the select requests the tabs send from then on, in tabs.requests, each
 *   its detail's name, whether it bubbles, and whether it is composed.
 * - inView(tabs, name): whether the named tab lies whole within its tablist's box.
 */
const HELPERS = `(() => {
  const scope = (list) =>
    document.querySelector("#file-tabs")
      .querySelectorAll(list === "focus" ? ".focus" : ".states")[list === "focus" ? 0 : (list ?? 0)];
  const figure = (state, list) => scope(list).querySelector(\`figure[data-state="\${state}"]\`);
  const tabsOf = (tabs) => [...tabs.shadowRoot.querySelectorAll('[role="tab"]')];
  window.tabs = {
    figure,
    at: (state, list) => figure(state, list).querySelector("sl-file-tabs"),
    editor: (state, list) => figure(state, list).querySelector("sl-code-editor"),
    tab: (tabs, name) => tabsOf(tabs).find((tab) => tab.dataset.name === name),
    shown(tabs) {
      return {
        tabs: tabsOf(tabs).map((tab) => ({
          name: tab.dataset.name,
          selected: tab.getAttribute("aria-selected") === "true",
          tabindex: tab.tabIndex,
          marker: tab.querySelector(".marker") !== null,
        })),
        focused: tabs.shadowRoot.activeElement?.dataset.name ?? null,
      };
    },
    listen(tabs) {
      tabs.requests = [];
      tabs.addEventListener("select", (event) =>
        tabs.requests.push({ name: event.detail.name, bubbles: event.bubbles, composed: event.composed }));
    },
    inView(tabs, name) {
      const list = tabs.shadowRoot.querySelector('[role="tablist"]').getBoundingClientRect();
      const box = window.tabs.tab(tabs, name).getBoundingClientRect();
      return box.left >= list.left - 0.5 && box.right <= list.right + 0.5;
    },
  };
})()`;

/** Opens the components page, at the width when one is given, waits for every element to render, and installs the helpers. */
async function open(width?: number): Promise<Page> {
  const url = `${server.origin}components.html`;
  // Laid out at the width from the first frame, so the page loads at it.
  const page = await browser.open(width === undefined ? url : "about:blank");
  if (width !== undefined) {
    await viewport(page, width);
    await page.goto(url);
  }
  await page.evaluate(SETTLED);
  await page.evaluate(HELPERS);
  return page;
}

/** Opens the components page with focus emulated, so focus and :focus-visible hold headless. */
async function focused(width?: number): Promise<Page> {
  const page = await open(width);
  await page.cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
  return page;
}

/** A key pressed and released on the focused element. */
async function press(page: Page, key: string, code = key, keyCode?: number, modifiers = 0) {
  for (const type of ["keyDown", "keyUp"]) {
    await page.cdp("Input.dispatchKeyEvent", {
      type,
      key,
      code,
      windowsVirtualKeyCode: keyCode,
      modifiers,
    });
  }
}

const KEYS = {
  Right: ["ArrowRight", "ArrowRight", 39],
  Left: ["ArrowLeft", "ArrowLeft", 37],
  Home: ["Home", "Home", 36],
  End: ["End", "End", 35],
  Tab: ["Tab", "Tab", 9],
} as const;

const key = (page: Page, name: keyof typeof KEYS, modifiers = 0) => {
  const [pressed, code, keyCode] = KEYS[name];
  return press(page, pressed, code, keyCode, modifiers);
};

/** A tab as shown: its file's name, whether selected, its tabindex, and whether it shows a
 * marker. */
interface Tab {
  name: string;
  selected: boolean;
  tabindex: number;
  marker: boolean;
}

/** The tabs as they render, after any update pending. */
const shown = async (page: Page, tabs: string): Promise<{ tabs: Tab[]; focused: string | null }> =>
  page.evaluate(`${tabs}.updateComplete.then(() => window.tabs.shown(${tabs}))`);

/** The names of the selected tab and of the tab focus is on, and the editor's label. */
const where = async (page: Page, state: string) => {
  const tabs = `window.tabs.at("${state}")`;
  const { tabs: list, focused } = await shown(page, tabs);
  return {
    selected: list.filter((tab) => tab.selected).map((tab) => tab.name),
    focused,
    editor: await page.evaluate(`window.tabs.editor("${state}").label`),
  };
};

/** A node of the accessibility tree, as CDP gives it. */
interface AXNode {
  ignored: boolean;
  role?: { value: string };
  name?: { value: string };
  description?: { value: string };
  backendDOMNodeId?: number;
  properties?: {
    name: string;
    value: { value?: unknown; relatedNodes?: { backendDOMNodeId: number }[] };
  }[];
}

/** The nodes of the role in the accessibility tree under the element the expression gives. */
async function axQuery(page: Page, expression: string, role: string): Promise<AXNode[]> {
  const { result } = await page.cdp("Runtime.evaluate", { expression });
  const { nodes }: { nodes: AXNode[] } = await page.cdp("Accessibility.queryAXTree", {
    objectId: result.objectId,
    role,
  });
  return nodes.filter((node) => !node.ignored);
}

/** The backend node id of the element the expression gives. */
async function backendId(page: Page, expression: string): Promise<number> {
  const { result } = await page.cdp("Runtime.evaluate", { expression });
  const { node } = await page.cdp("DOM.describeNode", { objectId: result.objectId });
  return node.backendNodeId;
}

const property = (node: AXNode, name: string) =>
  node.properties?.find((each) => each.name === name)?.value;

describe("the tabs in the accessibility tree", () => {
  test("a tablist named Files, a tab per file in order, the active one selected, each controlling the panel", async () => {
    const page = await open();
    try {
      await page.cdp("DOM.getDocument", {});
      const figure = `window.tabs.figure("several")`;
      const lists = await axQuery(page, figure, "tablist");
      assert.deepEqual(
        lists.map((node) => node.name?.value),
        ["Files"],
      );
      const tabs = await axQuery(page, figure, "tab");
      assert.deepEqual(
        tabs.map((node) => ({
          name: node.name?.value,
          selected: property(node, "selected")?.value === true,
        })),
        [
          { name: "main.go", selected: true },
          { name: "greeting.go", selected: false },
          { name: "go.mod", selected: false },
        ],
      );
      const panel = await backendId(page, `${figure}.querySelector('[role="tabpanel"]')`);
      for (const tab of tabs) {
        assert.deepEqual(
          property(tab, "controls")?.relatedNodes?.map((node) => node.backendDOMNodeId),
          [panel],
          `${tab.name?.value} controls the panel`,
        );
      }
      const panels = await axQuery(page, figure, "tabpanel");
      assert.deepEqual(
        panels.map((node) => node.name?.value),
        ["main.go"],
        "the panel is named by the active file",
      );
      const boxes = await axQuery(page, `${figure}.querySelector('[role="tabpanel"]')`, "textbox");
      assert.deepEqual(
        boxes.map((node) => node.name?.value),
        ["main.go"],
        "the panel holds the editor of the active file",
      );
    } finally {
      await page.close();
    }
  });

  test("a modified file's tab is named as modified, and a read-only file's described as read-only", async () => {
    const page = await open();
    try {
      const named = async (state: string) =>
        (await axQuery(page, `window.tabs.figure("${state}")`, "tab")).map((node) => ({
          name: node.name?.value,
          description: node.description?.value ?? "",
        }));
      assert.deepEqual(await named("modified"), [
        { name: "main.go", description: "" },
        { name: "greeting.go, modified", description: "" },
        { name: "go.mod", description: "" },
      ]);
      assert.deepEqual(await named("readonly"), [
        { name: "main.go", description: "" },
        { name: "greeting.go", description: "read-only" },
        { name: "go.mod", description: "" },
      ]);
      // The marker shows, and only on the modified file's tab; the name shows as text either way.
      const marked: Tab[] = (await shown(page, `window.tabs.at("modified")`)).tabs;
      assert.deepEqual(
        marked.map((tab) => tab.marker),
        [false, true, false],
      );
      const marker: { width: number; hidden: string | null } = await page.evaluate(`(() => {
        const marker = window.tabs.tab(window.tabs.at("modified"), "greeting.go").querySelector(".marker");
        return { width: marker.getBoundingClientRect().width, hidden: marker.getAttribute("aria-hidden") };
      })()`);
      assert.ok(marker.width > 0, "the marker is visible");
      assert.equal(marker.hidden, "true", "the name says modified; the dot isn't said again");
    } finally {
      await page.close();
    }
  });

  test("the read-only file's editor is read-only while it is active, and editable once another is", async () => {
    const page = await open();
    try {
      const readonly = () => page.evaluate(`window.tabs.editor("readonly").readonly`);
      assert.equal(await readonly(), true);
      await page.evaluate(`window.tabs.tab(window.tabs.at("readonly"), "main.go").click()`);
      await page.evaluate(`window.tabs.at("readonly").updateComplete`);
      assert.equal(await readonly(), false);
    } finally {
      await page.close();
    }
  });
});

describe("the tabs' keyboard", () => {
  test("Tab reaches the selected tab alone, and the next Tab leaves the tablist for the editor", async () => {
    const page = await focused();
    try {
      await page.evaluate(`window.tabs.tab(window.tabs.at("several"), "greeting.go").click()`);
      assert.deepEqual(
        (await shown(page, `window.tabs.at("several")`)).tabs.map((tab) => tab.tabindex),
        [-1, 0, -1],
        "a roving tabindex: only the selected tab is in the tab order",
      );
      await page.evaluate(
        `window.tabs.figure("several").querySelector("figcaption").tabIndex = -1`,
      );
      await page.evaluate(`window.tabs.figure("several").querySelector("figcaption").focus()`);
      await key(page, "Tab");
      assert.equal((await where(page, "several")).focused, "greeting.go");
      await key(page, "Tab");
      const after: { tabs: string | null; editor: boolean } = await page.evaluate(`({
        tabs: window.tabs.at("several").shadowRoot.activeElement?.dataset.name ?? null,
        editor: document.activeElement === window.tabs.editor("several"),
      })`);
      assert.deepEqual(after, { tabs: null, editor: true });
    } finally {
      await page.close();
    }
  });

  test("Left and Right wrap, Home and End reach the ends, and each moves focus and requests that tab, which the page selects", async () => {
    const page = await focused();
    try {
      const tabs = `window.tabs.at("several")`;
      await page.evaluate(`window.tabs.listen(${tabs})`);
      await page.evaluate(`window.tabs.tab(${tabs}, "main.go").focus()`);
      const steps: [keyof typeof KEYS, string][] = [
        ["Right", "greeting.go"],
        ["Right", "go.mod"],
        ["Right", "main.go"],
        ["Left", "go.mod"],
        ["Home", "main.go"],
        ["End", "go.mod"],
        ["Left", "greeting.go"],
      ];
      for (const [name, file] of steps) {
        await key(page, name);
        assert.deepEqual(
          await where(page, "several"),
          { selected: [file], focused: file, editor: file },
          `${name} reaches ${file}, selected, its file in the editor`,
        );
      }
      assert.deepEqual(
        await page.evaluate(`${tabs}.requests`),
        steps.map(([, name]) => ({ name, bubbles: true, composed: false })),
      );
      // A modified key is the page's: no move, no request.
      await key(page, "Right", 8);
      await key(page, "Home", 2);
      assert.equal((await where(page, "several")).focused, "greeting.go");
      assert.equal(await page.evaluate(`${tabs}.requests.length`), steps.length);
    } finally {
      await page.close();
    }
  });

  test("a click requests the tab's file, and the selected tab's own click requests nothing", async () => {
    const page = await open();
    try {
      const tabs = `window.tabs.at("several")`;
      await page.evaluate(`window.tabs.listen(${tabs})`);
      await page.evaluate(`window.tabs.tab(${tabs}, "main.go").click()`);
      await page.evaluate(`window.tabs.tab(${tabs}, "go.mod").click()`);
      assert.deepEqual(await page.evaluate(`${tabs}.requests.map((request) => request.name)`), [
        "go.mod",
      ]);
      assert.deepEqual((await where(page, "several")).selected, ["go.mod"]);
    } finally {
      await page.close();
    }
  });
});

describe("the tabs as a controlled element", () => {
  test("a request no owner applies changes neither the selection nor the tab order; the set's change does; the tabs never write the set", async () => {
    const page = await focused();
    try {
      // Tabs of a set no one applies requests to, its changes counted.
      await page.evaluate(`(() => {
        const FileSet = window.tabs.at("several").files.constructor;
        const set = new FileSet([
          { name: "a.go", text: "" },
          { name: "b.go", text: "" },
          { name: "c.go", text: "" },
        ]);
        set.changes = 0;
        set.addEventListener("change", () => set.changes++);
        const tabs = document.createElement("sl-file-tabs");
        tabs.files = set;
        window.tabs.listen(tabs);
        window.loose = tabs;
        window.tabs.figure("several").append(tabs);
      })()`);
      await page.evaluate(`window.tabs.tab(window.loose, "a.go").focus()`);
      const unchanged = [
        { name: "a.go", selected: true, tabindex: 0, marker: false },
        { name: "b.go", selected: false, tabindex: -1, marker: false },
        { name: "c.go", selected: false, tabindex: -1, marker: false },
      ];
      await key(page, "Right");
      assert.deepEqual(await shown(page, "window.loose"), { tabs: unchanged, focused: "b.go" });
      await key(page, "End");
      await page.evaluate(`window.tabs.tab(window.loose, "b.go").click()`);
      assert.deepEqual((await shown(page, "window.loose")).tabs, unchanged);
      assert.deepEqual(
        await page.evaluate(`window.loose.requests.map((request) => request.name)`),
        ["b.go", "c.go", "b.go"],
      );
      assert.equal(await page.evaluate(`window.loose.files.changes`), 0, "the tabs wrote nothing");
      assert.equal(await page.evaluate(`window.loose.files.active`), "a.go");
      // The set's own change moves the selection and the tab order.
      await page.evaluate(`window.loose.files.select("c.go")`);
      assert.deepEqual(
        (await shown(page, "window.loose")).tabs.map(({ selected, tabindex }) => [
          selected,
          tabindex,
        ]),
        [
          [false, -1],
          [false, -1],
          [true, 0],
        ],
      );
      // As do its edits, renames, additions, and removals.
      await page.evaluate(`(() => {
        const set = window.loose.files;
        set.edit("a.go", "package a");
        set.rename("b.go", "renamed.go");
        set.add("d.go");
        set.remove("c.go");
      })()`);
      assert.deepEqual((await shown(page, "window.loose")).tabs, [
        { name: "a.go", selected: false, tabindex: -1, marker: true },
        { name: "renamed.go", selected: false, tabindex: -1, marker: false },
        { name: "d.go", selected: true, tabindex: 0, marker: false },
      ]);
    } finally {
      await page.close();
    }
  });

  test("the marker follows the editor's edits, through the page's loop, and goes as an undo restores the text", async () => {
    const page = await focused();
    try {
      const tabs = `window.tabs.at("several")`;
      const marked = async () => (await shown(page, tabs)).tabs.map((tab) => tab.marker);
      assert.deepEqual(await marked(), [false, false, false]);
      await page.evaluate(`window.tabs.editor("several").focus()`);
      await page.cdp("Input.insertText", { text: "x" });
      assert.deepEqual(await marked(), [true, false, false]);
      assert.equal(
        await page.evaluate(`${tabs}.files.file("main.go").text`),
        await page.evaluate(`window.tabs.editor("several").value`),
      );
      const names = await axQuery(page, `window.tabs.figure("several")`, "tab");
      assert.equal(names[0].name?.value, "main.go, modified");
      await press(page, "z", "KeyZ", 90, 2);
      assert.deepEqual(await marked(), [false, false, false]);
      // Another file keeps its own state: typing in it marks it alone.
      await page.evaluate(`window.tabs.tab(${tabs}, "go.mod").click()`);
      await page.evaluate(`window.tabs.editor("several").focus()`);
      await page.cdp("Input.insertText", { text: "y" });
      assert.deepEqual(await marked(), [false, false, true]);
    } finally {
      await page.close();
    }
  });
});

describe("overflowing tabs", () => {
  /** The overflowing state's tabs, which each test here reads at a phone's width. */
  const NARROW = `window.tabs.at("overflow")`;

  test("at a phone's width the row scrolls inside itself, the active tab in view as the page loads", async () => {
    const page = await open(PHONE);
    try {
      const row: { scrolls: boolean; overflow: string; width: number; host: number } =
        await page.evaluate(`(() => {
          const list = ${NARROW}.shadowRoot.querySelector('[role="tablist"]');
          return {
            scrolls: list.scrollWidth > list.clientWidth,
            overflow: getComputedStyle(list).overflowX,
            width: list.getBoundingClientRect().width,
            host: ${NARROW}.parentElement.getBoundingClientRect().width,
          };
        })()`);
      assert.equal(row.scrolls, true, "sixteen tabs overflow a phone's width");
      assert.equal(row.overflow, "auto");
      assert.ok(
        row.width <= row.host,
        "the row is no wider than its figure: the page doesn't scroll",
      );
      assert.equal(await page.evaluate(`window.tabs.inView(${NARROW}, "step12.go")`), true);
      assert.equal(await page.evaluate(`window.tabs.inView(${NARROW}, "step01.go")`), false);
    } finally {
      await page.close();
    }
  });

  test("focus moving by the keyboard, and the set's own select, scroll the tab into view, never the page", async () => {
    const page = await focused(PHONE);
    try {
      // Instant scrolling, so each position is read as it lands.
      await page.cdp("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "reduce" }],
      });
      await page.evaluate(`window.tabs.tab(${NARROW}, "step12.go").focus({ preventScroll: true })`);
      const scrollY = await page.evaluate(`window.scrollY`);
      const view = (name: string) => page.evaluate(`window.tabs.inView(${NARROW}, "${name}")`);
      // With the page's requests held back, focus alone reveals the tab it reaches.
      await page.evaluate(`(() => {
        window.hold = (event) => event.stopPropagation();
        ${NARROW}.parentElement.addEventListener("select", window.hold, { capture: true });
      })()`);
      await key(page, "End");
      assert.equal(await view("step16.go"), true, "End, focus alone");
      assert.equal(await page.evaluate(`${NARROW}.files.active`), "step12.go", "nothing applied");
      await page.evaluate(
        `${NARROW}.parentElement.removeEventListener("select", window.hold, { capture: true })`,
      );
      await key(page, "End");
      await key(page, "Right");
      assert.equal(await view("step01.go"), true, "Right, wrapping to the first");
      assert.equal(
        await page.evaluate(`${NARROW}.shadowRoot.querySelector('[role="tablist"]').scrollLeft`),
        0,
      );
      await key(page, "Left");
      assert.equal(await view("step16.go"), true, "Left, wrapping to the last");
      await key(page, "Home");
      assert.equal(await view("step01.go"), true, "Home");
      // The set's own select, with focus elsewhere, reveals the newly active tab.
      await page.evaluate(`document.activeElement.blur()`);
      await page.evaluate(`${NARROW}.files.select("step09.go")`);
      await page.evaluate(`${NARROW}.updateComplete`);
      assert.equal(await view("step09.go"), true, "the set's select");
      assert.equal(await page.evaluate(`window.scrollY`), scrollY, "the page never scrolled");
    } finally {
      await page.close();
    }
  });

  test("no row overflows up or down, wide or at a phone's width, in each space and type; there it still scrolls sideways", async () => {
    const page = await open();
    try {
      const profiles: { space: string[]; type: string[] } = await page.evaluate(`(() => {
        const registry = globalThis[Symbol.for("spike-html-apps-foundation.registry")];
        return { space: [...registry.space], type: [...registry.type] };
      })()`);
      assert.ok(profiles.space.length > 1 && profiles.type.length > 1);
      for (const width of [WIDE, PHONE]) {
        await viewport(page, width);
        for (const space of profiles.space) {
          for (const type of profiles.type) {
            // Every tablist on the page, the Go demos' among them, by its figure's state and how far
            // its content reaches past it up and down.
            const rows: { state: string; overflow: number }[] = await page.evaluate(`(async () => {
            const root = document.documentElement;
            root.setAttribute("data-space", ${JSON.stringify(space)});
            root.setAttribute("data-type", ${JSON.stringify(type)});
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const rows = [];
            const walk = (scope) => {
              for (const element of scope.querySelectorAll("*")) {
                if (element.localName === "sl-file-tabs") {
                  const list = element.shadowRoot.querySelector('[role="tablist"]');
                  rows.push({
                    state: element.closest("figure")?.dataset.state ?? element.getRootNode().host?.label,
                    overflow: list.scrollHeight - list.clientHeight,
                  });
                }
                if (element.shadowRoot) walk(element.shadowRoot);
              }
            };
            walk(document);
            return rows;
          })()`);
            assert.ok(rows.length > 2, `${width}px, ${space} ${type}: the tablists found`);
            assert.deepEqual(
              rows.filter((row) => row.overflow !== 0),
              [],
              `${width}px, ${space} ${type}: every row as tall as its content`,
            );
          }
        }
      }
      const sideways: { before: number; after: number; max: number } = await page.evaluate(`(() => {
        const list = ${NARROW}.shadowRoot.querySelector('[role="tablist"]');
        list.style.scrollBehavior = "auto";
        const before = list.scrollLeft;
        list.scrollLeft = before === 0 ? 1e6 : 0;
        return { before, after: list.scrollLeft, max: list.scrollWidth - list.clientWidth };
      })()`);
      assert.ok(sideways.max > 0, "at a phone's width the row overflows sideways");
      assert.notEqual(sideways.after, sideways.before, "and scrolls sideways");
    } finally {
      await page.close();
    }
  });
});

describe("focus and motion", () => {
  test("Tab from the section's focus mark reaches the selected tab, which shows the focus outline", async () => {
    const page = await focused();
    try {
      await page.evaluate(`document.querySelector("#file-tabs [data-focus-start]").focus()`);
      await key(page, "Tab");
      const shownFocus: { name: string | null; outline: string; width: number } =
        await page.evaluate(`(() => {
          const tabs = window.tabs.at("focus", "focus");
          const tab = tabs.shadowRoot.activeElement;
          const style = tab && getComputedStyle(tab);
          return {
            name: tab?.dataset.name ?? null,
            outline: style?.outlineStyle ?? "",
            width: parseFloat(style?.outlineWidth ?? "0"),
          };
        })()`);
      assert.equal(shownFocus.name, "main.go");
      assert.equal(shownFocus.outline, "solid");
      assert.ok(shownFocus.width > 0);
    } finally {
      await page.close();
    }
  });

  test("the row scrolls smoothly when motion is allowed, and under reduced motion nothing moves", async () => {
    const page = await open();
    try {
      const behavior = () =>
        page.evaluate(
          `getComputedStyle(window.tabs.at("several").shadowRoot.querySelector('[role="tablist"]')).scrollBehavior`,
        );
      assert.equal(await behavior(), "smooth");
      await page.cdp("Emulation.setEmulatedMedia", {
        features: [{ name: "prefers-reduced-motion", value: "reduce" }],
      });
      assert.equal(await behavior(), "auto");
      const moving: string[] = await page.evaluate(`(() => {
        const root = window.tabs.at("modified").shadowRoot;
        return [...root.querySelectorAll("*")].filter((element) => {
          const style = getComputedStyle(element);
          return style.animationName !== "none" || style.scrollBehavior !== "auto" ||
            style.transitionDuration.split(",").some((d) => parseFloat(d) > 0);
        }).map((element) => element.className);
      })()`);
      assert.deepEqual(moving, []);
    } finally {
      await page.close();
    }
  });
});

describe("the tabs' subscription", () => {
  test("they listen only to the set they hold, only while in the document", async () => {
    const page = await open();
    try {
      // Sets whose change listeners are counted as the tabs add and remove them.
      await page.evaluate(`(() => {
        const FileSet = window.tabs.at("several").files.constructor;
        const counted = (name) => {
          const set = new FileSet([{ name, text: "" }]);
          set.listeners = 0;
          const add = set.addEventListener.bind(set);
          const remove = set.removeEventListener.bind(set);
          set.addEventListener = (type, listener) => {
            if (type === "change") set.listeners++;
            add(type, listener);
          };
          set.removeEventListener = (type, listener) => {
            if (type === "change") set.listeners--;
            remove(type, listener);
          };
          return set;
        };
        window.a = counted("a.go");
        window.b = counted("b.go");
        window.held = document.createElement("sl-file-tabs");
        window.held.files = window.a;
      })()`);
      const counts = () =>
        page.evaluate(
          `window.held.updateComplete.then(() => [window.a.listeners, window.b.listeners])`,
        );
      // Never connected, it hasn't updated, and its updateComplete waits on a connection.
      assert.deepEqual(
        await page.evaluate(`[window.a.listeners, window.b.listeners]`),
        [0, 0],
        "never in the document, it listens to none",
      );
      await page.evaluate(`window.tabs.figure("single").append(window.held)`);
      assert.deepEqual(await counts(), [1, 0], "in the document, it listens to the set it holds");
      await page.evaluate(`window.held.remove()`);
      assert.deepEqual(await counts(), [0, 0], "removed, it stops");
      // A change while it is out: back in, it listens again and shows the set as it is.
      await page.evaluate(`window.a.add("new.go")`);
      await page.evaluate(`window.tabs.figure("single").append(window.held)`);
      assert.deepEqual(await counts(), [1, 0]);
      assert.deepEqual(
        (await shown(page, "window.held")).tabs.map((tab) => tab.name),
        ["a.go", "new.go"],
      );
      // Replaced, it leaves the old set and listens to the new, and shows it.
      await page.evaluate(`window.held.files = window.b`);
      assert.deepEqual(await counts(), [0, 1]);
      assert.deepEqual(
        (await shown(page, "window.held")).tabs.map((tab) => tab.name),
        ["b.go"],
      );
      // With none, no tab and no tablist.
      await page.evaluate(`window.held.files = null`);
      assert.deepEqual(await counts(), [0, 0]);
      assert.equal(
        await page.evaluate(`window.held.shadowRoot.querySelector('[role="tablist"]')`),
        null,
      );
    } finally {
      await page.close();
    }
  });
});
