// The reader's arrangement on the playground, playground.html's fixed sl-go-demo from 64rem: the
// build as Pages serves it, dist/ under the base by the SDK's served(), Vite's preview, in the
// pinned chrome-headless-shell, its own browser, so its storage is its own.
//
// From 64rem the toolbar shows Layout, a menu button in its own group after Files, and below 64rem
// the group isn't there. Its menu is the APG menu button's: its accessibility tree, a menu of three
// radio items, the placement checked, and its keyboard, each key in turn. Choosing an item places
// the parts again in place, with no reload and no change to the run state. The choice is kept in
// localStorage under the spike's key and nothing else is written: a reload, and another page on the
// origin, open in it; another tab's choice moves this one; and blocked storage, an empty store, a
// value that isn't JSON, and one the model refuses all open with the editor left, writing nothing.
// The helpers are go-demos.ts's, go-builds.ts's, and playground-layouts.ts's. Every wait is bounded.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch, SETTLED, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import { build, DONE } from "./go-builds.ts";
import { goRequests, open as openPage, settle, type Watched } from "./go-demos.ts";
import {
  arrange,
  axQuery,
  CONTROLS,
  layout,
  type Placement,
  placed,
  placedAs,
  PLAYGROUND,
  press,
  property,
  widthFor,
} from "./playground-layouts.ts";
import { PHONE, viewport } from "./viewport.ts";

const root = join(import.meta.dirname, "../..");

/** The key the page keeps the choice under. */
const KEY = "spike-html-go-wasm.arrangement";

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

/** Opens the playground, watched (go-demos.ts), at 1376px, the demo in the wide band. */
async function open(): Promise<Watched> {
  const watched = await openPage(browser, server.origin, "playground.html");
  await viewport(watched.page, 1376);
  return watched;
}

/** Leaves the origin's store holding the raw text given under the key, and nothing else; null
 * leaves it empty. */
async function store(text: string | null): Promise<void> {
  const { page } = await openPage(browser, server.origin, "playground.html");
  try {
    await page.evaluate(`(() => {
      localStorage.clear();
      ${text === null ? "" : `localStorage.setItem(${JSON.stringify(KEY)}, ${JSON.stringify(text)});`}
    })()`);
  } finally {
    await page.close();
  }
}

/** Everything the origin's store holds, by key. */
const stored = (page: Page): Promise<Record<string, string>> =>
  page.evaluate(`Object.fromEntries(Object.entries(localStorage))`);

/** Loads the playground again in the page, resolving once it has painted. */
async function reload(page: Page): Promise<void> {
  await page.goto(`${server.origin}playground.html`);
  await page.evaluate(SETTLED);
}

/** The Layout menu as it stands: whether it is open, Layout's aria-expanded, the placement whose
 * item has focus, or "layout" when Layout has it, and the item checked. */
const menuState = (page: Page) =>
  page.evaluate(`(() => {
    const root = ${CONTROLS};
    const active = root.activeElement;
    return {
      open: root.querySelector("#layout-menu").matches(":popover-open"),
      expanded: root.querySelector('[data-control="layout"]').ariaExpanded,
      focused: active?.dataset.placement ?? active?.dataset.control ?? null,
      checked: root.querySelector('#layout-menu [aria-checked="true"]').dataset.placement,
    };
  })()`);

/** Resolves once the menu is open or closed, as given. */
const menu = (page: Page, open: boolean) =>
  until(
    page,
    `${open ? "" : "!"}${CONTROLS}.querySelector("#layout-menu").matches(":popover-open")`,
    5000,
  ).then(() => settle(page));

/** Layout's group and button, if shown: the toolbar's groups by name, and Layout's tabindex. */
const groups = (page: Page) =>
  page.evaluate(`(() => {
    const root = ${CONTROLS};
    return {
      groups: [...root.querySelectorAll('[role="group"]')].map((group) => group.ariaLabel),
      layout: root.querySelector('[data-control="layout"]')?.tabIndex ?? null,
    };
  })()`);

describe("the Layout menu button", () => {
  test("from 64rem is a menu button in its own group after Files, its menu three radio items with the placement checked; below 64rem the group isn't there", async () => {
    await store(null);
    const { page } = await open();
    try {
      await page.cdp("DOM.getDocument", {});
      const toolbar = `${PLAYGROUND}.shadowRoot.querySelector("sl-controls")`;
      assert.deepEqual(
        (await axQuery(page, toolbar, "group")).map((node) => node.name?.value),
        ["Run", "Files", "Layout"],
      );
      const [button] = (await axQuery(page, toolbar, "button")).filter(
        (node) => node.name?.value === "Layout",
      );
      assert.ok(button, "Layout is a button");
      assert.equal(property(button, "hasPopup"), "menu");
      assert.equal(property(button, "expanded"), false);
      assert.deepEqual(await groups(page), { groups: ["Run", "Files", "Layout"], layout: -1 });

      await page.evaluate(`${CONTROLS}.querySelector('[data-control="layout"]').click()`);
      await menu(page, true);
      const [opened] = (await axQuery(page, toolbar, "button")).filter(
        (node) => node.name?.value === "Layout",
      );
      assert.equal(property(opened, "expanded"), true);
      const menus = await axQuery(page, toolbar, "menu");
      assert.deepEqual(
        menus.map((node) => node.name?.value),
        ["Layout"],
      );
      const items = await axQuery(page, toolbar, "menuitemradio");
      assert.deepEqual(
        items.map((node) => [node.name?.value, property(node, "checked")]),
        [
          ["Editor left", "true"],
          ["Editor top", "false"],
          ["Editor right", "false"],
        ],
      );
      await press(page, "Escape");
      await menu(page, false);

      for (const width of [await widthFor(page, 63.5), await widthFor(page, 44.5), PHONE]) {
        await viewport(page, width);
        await settle(page);
        assert.deepEqual(
          await groups(page),
          { groups: ["Run", "Files"], layout: null },
          `no Layout group at ${width}px`,
        );
      }
      await viewport(page, await widthFor(page, 64.5));
      await settle(page);
      assert.deepEqual((await groups(page)).groups, ["Run", "Files", "Layout"], "at 64.5rem");
    } finally {
      await page.close();
    }
  });

  test("Enter, Space, and Down open the menu on the checked item; Up and Down move, wrapping, Home and End to the ends; Enter or Space chooses and closes; Escape closes; focus returns to Layout", async () => {
    await store(null);
    const watched = await open();
    const { page } = watched;
    try {
      await page.evaluate(`${CONTROLS}.querySelector('[data-control="layout"]').focus()`);
      await settle(page);
      const state = (open: boolean, focused: string, checked: Placement) => ({
        open,
        expanded: open ? "true" : "false",
        focused,
        checked,
      });

      await press(page, "Enter");
      await menu(page, true);
      assert.deepEqual(await menuState(page), state(true, "left", "left"), "Enter opens");
      const moves: [Parameters<typeof press>[1], Placement][] = [
        ["ArrowDown", "top"],
        ["ArrowDown", "right"],
        ["ArrowDown", "left"],
        ["ArrowUp", "right"],
        ["ArrowUp", "top"],
        ["Home", "left"],
        ["End", "right"],
      ];
      for (const [key, to] of moves) {
        await press(page, key);
        await settle(page);
        assert.deepEqual(await menuState(page), state(true, to, "left"), `${key} to ${to}`);
      }
      await press(page, "Escape");
      await menu(page, false);
      assert.deepEqual(await menuState(page), state(false, "layout", "left"), "Escape closes");
      assert.equal(await placed(page), "left");

      await press(page, " ");
      await menu(page, true);
      assert.deepEqual(await menuState(page), state(true, "left", "left"), "Space opens");
      await press(page, "Escape");
      await menu(page, false);

      await press(page, "ArrowDown");
      await menu(page, true);
      assert.deepEqual(await menuState(page), state(true, "left", "left"), "Down opens");
      await press(page, "ArrowDown");
      await press(page, "Enter");
      await menu(page, false);
      assert.deepEqual(await menuState(page), state(false, "layout", "top"), "Enter chooses");
      assert.equal(await placed(page), "top");

      await press(page, "Enter");
      await menu(page, true);
      assert.deepEqual(await menuState(page), state(true, "top", "top"), "opens on the checked");
      await press(page, "ArrowDown");
      await press(page, " ");
      await menu(page, false);
      assert.deepEqual(await menuState(page), state(false, "layout", "right"), "Space chooses");
      assert.equal(await placed(page), "right");

      // Tab closes the menu and moves on from Layout, out of the toolbar.
      await press(page, "Enter");
      await menu(page, true);
      await press(page, "Tab");
      await menu(page, false);
      const after = await menuState(page);
      assert.equal(after.open, false);
      assert.equal(after.focused, null, "focus has left the toolbar");
      assert.equal(await placed(page), "right");

      assert.deepEqual(goRequests(watched), [], "choosing runs nothing");
    } finally {
      await page.close();
    }
  });
});

describe("choosing an arrangement", () => {
  test("places the parts again in place, with no reload and no change to the run state", async () => {
    await store(null);
    const watched = await open();
    const { page } = watched;
    try {
      assert.equal(await placed(page), "left");
      placedAs(await layout(page), "left", "the default");
      const done = await build(page, PLAYGROUND, DONE);
      await page.evaluate(`window.unreloaded = true`);
      const requested = watched.requests.length;
      for (const placement of ["right", "top", "left"] as const) {
        await arrange(page, placement);
        placedAs(await layout(page), placement, `editor ${placement}`);
        assert.deepEqual(
          await page.evaluate(`({
            status: window.demos.status(${PLAYGROUND}),
            rows: window.demos.rows(${PLAYGROUND}),
            phases: window.demos.phases(${PLAYGROUND}),
            unreloaded: window.unreloaded,
          })`),
          { status: done.status, rows: done.rows, phases: done.phases, unreloaded: true },
          `editor ${placement} keeps the run as it was`,
        );
      }
      assert.deepEqual(watched.requests.slice(requested), [], "and requests nothing");
    } finally {
      await page.close();
    }
  });
});

describe("the stored arrangement", () => {
  test("is the choice alone, under the spike's key; a reload and another page on the origin open in it", async () => {
    await store(null);
    const { page } = await open();
    try {
      assert.deepEqual(await stored(page), {}, "opening writes nothing");
      await arrange(page, "left");
      assert.deepEqual(await stored(page), {}, "choosing the placement held writes nothing");
      await arrange(page, "right");
      assert.deepEqual(await stored(page), { [KEY]: `"right"` });

      await reload(page);
      assert.equal(await placed(page), "right", "the reload");
      placedAs(await layout(page), "right", "the reload");
      const other = await open();
      try {
        assert.equal(await placed(other.page), "right", "another page");
      } finally {
        await other.page.close();
      }
      assert.deepEqual(await stored(page), { [KEY]: `"right"` }, "and no page writes more");
    } finally {
      await page.close();
    }
  });

  test("another tab's choice moves this page's demo; a cleared store moves it back to left", async () => {
    await store(null);
    const first = await open();
    const second = await open();
    try {
      await arrange(first.page, "top");
      await until(
        second.page,
        `${PLAYGROUND}.shadowRoot.querySelector(".demo").dataset.placement === "top"`,
        5000,
      );
      await first.page.evaluate(`localStorage.clear()`);
      await until(
        second.page,
        `${PLAYGROUND}.shadowRoot.querySelector(".demo").dataset.placement === "left"`,
        5000,
      );
    } finally {
      await first.page.close();
      await second.page.close();
    }
  });

  test("an empty store, a value that isn't JSON, and one the model refuses open with the editor left, and write nothing", async () => {
    const cases: [string, string | null][] = [
      ["an empty store", null],
      ["text that isn't JSON", "right"],
      ["a placement it refuses", `"bottom"`],
      ["a value of another shape", `{"placement":"right"}`],
    ];
    for (const [name, text] of cases) {
      await store(text);
      const { page } = await open();
      try {
        assert.equal(await placed(page), "left", name);
        placedAs(await layout(page), "left", name);
        assert.deepEqual(
          await stored(page),
          text === null ? {} : { [KEY]: text },
          `${name} is left as it was`,
        );
      } finally {
        await page.close();
      }
    }
  });

  test("blocked storage opens with the editor left, and a choice still places the parts", async () => {
    await store(`"right"`);
    const { page } = await open();
    try {
      // Every document the page loads from now on finds localStorage blocked, as a sandbox or the
      // reader's settings block it.
      await page.cdp("Page.addScriptToEvaluateOnNewDocument", {
        source: `Object.defineProperty(window, "localStorage", {
          get() { throw new DOMException("blocked", "SecurityError"); },
        });`,
      });
      await reload(page);
      assert.equal(await placed(page), "left");
      placedAs(await layout(page), "left", "blocked storage");
      await arrange(page, "top");
      placedAs(await layout(page), "top", "a choice with storage blocked");
    } finally {
      await page.close();
    }
  });
});
