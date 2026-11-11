// sl-controls on the components page, the build as Pages serves it: dist/ under the base by the
// SDK's served(), Vite's preview, in the pinned chrome-headless-shell.
//
// The accessibility tree, read through CDP: a toolbar named Controls holding a Run group (Run,
// Stop, Reset), and under editable-files a vertical separator and a Files group (New file, Rename,
// Delete), each button named, an unavailable one disabled yet focusable, Run's key shortcuts, the
// form buttons' popup a dialog; the status a polite live region; a form's input named by its label,
// invalid and described by the reason once refused. The keyboard: one tab stop, the control last
// focused; Left and Right wrapping, Home and End, unavailable controls reached; Enter and Space
// pressing. Availability follows the models; every press sends a request and changes neither
// model, an unavailable one sending nothing. The forms: opened anchored below their buttons, the
// input focused, a rename's stem selected; refused on submit and checked again as typed; taken on
// submit; Escape closing with nothing sent; focus back on the button either way. The status says
// only transitions. Sizes, the 20rem column, motion, and the subscription. Every wait is bounded.
// Nothing here names the site: its base is package.json's name.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch, SETTLED, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

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

/** The page's helpers, installed on window.controls once the page has loaded:
 *
 * - figure(state, list): the figure data-state names in the list'th states list of #controls, the
 *   first by default, or in its .focus when list is "focus"; at(state, list) its sl-controls.
 * - button(controls, control): the toolbar's button of the control; available(controls), each
 *   button's control and aria-disabled, in order.
 * - status(controls): the status's text.
 * - loose({ files, editable }): a toolbar of a fresh FileSet of the files, the first active, and a
 *   fresh RunState, in the "idle" figure, with no owner applying its requests, which it records in
 *   controls.requests as { type, detail, bubbles, composed }; each model counts its changes in
 *   changes.
 * - counted(model): the model, its change listeners counted in model.listeners as toolbars add and
 *   remove them.
 */
const HELPERS = `(() => {
  const scope = (list) =>
    document.querySelector("#controls")
      .querySelectorAll(list === "focus" ? ".focus" : ".states")[list === "focus" ? 0 : (list ?? 0)];
  const figure = (state, list) => scope(list).querySelector(\`figure[data-state="\${state}"]\`);
  const sample = figure("idle").querySelector("sl-controls");
  const FileSet = sample.files.constructor;
  const RunState = sample.runState.constructor;
  const changes = (model) => {
    model.changes = 0;
    model.addEventListener("change", () => model.changes++);
    return model;
  };
  window.controls = {
    figure,
    at: (state, list) => figure(state, list).querySelector("sl-controls"),
    button: (controls, control) =>
      controls.shadowRoot.querySelector(\`[data-control="\${control}"]\`),
    available: (controls) =>
      [...controls.shadowRoot.querySelectorAll("[data-control]")].map(
        (b) => [b.dataset.control, b.getAttribute("aria-disabled")]),
    status: (controls) => controls.shadowRoot.querySelector('[role="status"]').textContent,
    loose({ files = [{ name: "main.go", text: "package main\\n" }], editable = true } = {}) {
      const controls = document.createElement("sl-controls");
      controls.files = changes(new FileSet(files));
      controls.runState = changes(new RunState());
      controls.editableFiles = editable;
      controls.requests = [];
      for (const type of ["run", "stop", "reset", "new", "rename", "delete"]) {
        controls.addEventListener(type, (event) => controls.requests.push({
          type, detail: event.detail ?? null, bubbles: event.bubbles, composed: event.composed,
        }));
      }
      figure("idle").append(controls);
      return controls;
    },
    counted(model) {
      model.listeners = 0;
      const add = model.addEventListener.bind(model);
      const remove = model.removeEventListener.bind(model);
      model.addEventListener = (type, listener) => {
        if (type === "change") model.listeners++;
        add(type, listener);
      };
      model.removeEventListener = (type, listener) => {
        if (type === "change") model.listeners--;
        remove(type, listener);
      };
      return model;
    },
    FileSet,
    RunState,
  };
})()`;

/** Opens the components page, waits for every element to render, and installs the helpers. */
async function open(): Promise<Page> {
  const page = await browser.open(`${server.origin}components.html`);
  await page.evaluate(SETTLED);
  await page.evaluate(HELPERS);
  return page;
}

/** Opens the components page with focus emulated, so focus and :focus-visible hold headless. */
async function focused(): Promise<Page> {
  const page = await open();
  await page.cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
  return page;
}

/** A key pressed and released on the focused element; Enter and Space carry their text, as a
 * keyboard's do, so they press a button. */
async function press(page: Page, key: string, modifiers = 0) {
  const [code, keyCode, text] = KEYS[key];
  for (const type of ["keyDown", "keyUp"]) {
    await page.cdp("Input.dispatchKeyEvent", {
      type,
      key,
      code,
      windowsVirtualKeyCode: keyCode,
      modifiers,
      ...(type === "keyDown" && text ? { text } : {}),
    });
  }
}

const KEYS: Record<string, [string, number, string?]> = {
  ArrowRight: ["ArrowRight", 39],
  ArrowLeft: ["ArrowLeft", 37],
  Home: ["Home", 36],
  End: ["End", 35],
  Tab: ["Tab", 9],
  Enter: ["Enter", 13, "\r"],
  " ": ["Space", 32, " "],
  Escape: ["Escape", 27],
  Backspace: ["Backspace", 8],
};

/** A click through CDP input, a user's gesture, at the middle of the element the expression
 * gives, scrolled into view first. */
async function click(page: Page, expression: string) {
  const point: { x: number; y: number } = await page.evaluate(`(() => {
    const element = ${expression};
    element.scrollIntoView({ block: "center" });
    const box = element.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
  })()`);
  for (const type of ["mousePressed", "mouseReleased"]) {
    await page.cdp("Input.dispatchMouseEvent", { type, ...point, button: "left", clickCount: 1 });
  }
}

/** The control focused in the toolbar the expression gives, or the id of the field focused in its
 * shadow root, or null; and whether the page's focus is in the toolbar's host at all. */
const focusIn = (page: Page, controls: string): Promise<string | null> =>
  page.evaluate(`(() => {
    const controls = ${controls};
    if (document.activeElement !== controls) return null;
    const active = controls.shadowRoot.activeElement;
    return active?.dataset.control ?? active?.id ?? null;
  })()`);

/** Resolves once the expression's toolbar focuses the control or field, within two seconds. */
const focusReaches = (page: Page, controls: string, what: string) =>
  until(
    page,
    `document.activeElement === ${controls} &&
      [${controls}.shadowRoot.activeElement?.dataset.control,
       ${controls}.shadowRoot.activeElement?.id].includes(${JSON.stringify(what)})`,
    2000,
  );

/** A node of the accessibility tree, as CDP gives it. */
interface AXNode {
  ignored: boolean;
  nodeId: string;
  role?: { value: string };
  name?: { value: string };
  description?: { value: string };
  properties?: { name: string; value: { value?: unknown } }[];
}

/** The nodes of the role in the accessibility tree under the element the expression gives. */
async function axQuery(page: Page, expression: string, role?: string): Promise<AXNode[]> {
  const { result } = await page.cdp("Runtime.evaluate", { expression });
  const { nodes }: { nodes: AXNode[] } = await page.cdp("Accessibility.queryAXTree", {
    objectId: result.objectId,
    ...(role ? { role } : {}),
  });
  return nodes.filter((node) => !node.ignored);
}

const property = (node: AXNode, name: string) =>
  node.properties?.find((each) => each.name === name)?.value.value;

/** The buttons under the element as the tree has them: name, disabled, focusable. */
async function buttons(page: Page, expression: string) {
  return (await axQuery(page, expression, "button")).map((node) => ({
    name: node.name?.value,
    disabled: property(node, "disabled") === true,
    focusable: property(node, "focusable") === true,
  }));
}

const shadow = (controls: string) => `${controls}.shadowRoot`;
const input = (controls: string, form: string) =>
  `${shadow(controls)}.querySelector("#${form}-name")`;
const popover = (controls: string, form: string) =>
  `${shadow(controls)}.querySelector("#${form}-form")`;
const isOpen = (page: Page, controls: string, form: string): Promise<boolean> =>
  page.evaluate(`${popover(controls, form)}.matches(":popover-open")`);

/** The form's input as the tree has it: its name, whether invalid, and its description. */
async function field(page: Page, controls: string, form: string) {
  const [node] = await axQuery(page, input(controls, form), "textbox");
  return {
    name: node.name?.value,
    // The tree gives aria-invalid's token, "true" or "false".
    invalid: property(node, "invalid") === "true",
    description: node.description?.value ?? "",
  };
}

describe("the controls in the accessibility tree", () => {
  test("a toolbar named Controls: a Run group, a separator, a Files group, each button named, Run's shortcuts declared", async () => {
    const page = await open();
    try {
      const figure = `window.controls.figure("editable")`;
      const [toolbar] = await axQuery(page, figure, "toolbar");
      assert.equal(toolbar.name?.value, "Controls");
      const groups = await axQuery(page, figure, "group");
      assert.deepEqual(
        groups.map((node) => node.name?.value),
        ["Run", "Files"],
      );
      const [separator] = await axQuery(page, figure, "separator");
      assert.equal(property(separator, "orientation"), "vertical");
      assert.deepEqual(await buttons(page, figure), [
        { name: "Run", disabled: false, focusable: true },
        { name: "Stop", disabled: true, focusable: true },
        { name: "Reset", disabled: true, focusable: true },
        { name: "New file", disabled: false, focusable: true },
        { name: "Rename", disabled: false, focusable: true },
        { name: "Delete", disabled: false, focusable: true },
      ]);
      const all = await axQuery(page, figure, "button");
      assert.equal(property(all[0], "keyshortcuts"), "Control+Enter Meta+Enter");
      assert.deepEqual(
        all.map((node) => property(node, "hasPopup") ?? null),
        [null, null, null, "dialog", "dialog", null],
      );
      const [status] = await axQuery(page, figure, "status");
      assert.equal(property(status, "live"), "polite");
    } finally {
      await page.close();
    }
  });

  test("without editable-files, the run group alone: no separator, no Files group", async () => {
    const page = await open();
    try {
      const figure = `window.controls.figure("idle")`;
      assert.deepEqual(
        (await axQuery(page, figure, "group")).map((node) => node.name?.value),
        ["Run"],
      );
      assert.deepEqual(await axQuery(page, figure, "separator"), []);
      assert.deepEqual(
        (await buttons(page, figure)).map((button) => button.name),
        ["Run", "Stop", "Reset"],
      );
    } finally {
      await page.close();
    }
  });
});

describe("availability follows the models", () => {
  test("each state on the page: Reset only when modified, Stop only while pending, Delete unless the last file", async () => {
    const page = await open();
    try {
      const available = (state: string) =>
        page.evaluate(`window.controls.available(window.controls.at("${state}"))`);
      const yes = "false";
      const no = "true";
      assert.deepEqual(await available("idle"), [
        ["run", yes],
        ["stop", no],
        ["reset", no],
      ]);
      assert.deepEqual(await available("modified"), [
        ["run", yes],
        ["stop", no],
        ["reset", yes],
      ]);
      assert.deepEqual(await available("running"), [
        ["run", yes],
        ["stop", yes],
        ["reset", no],
      ]);
      assert.deepEqual(await available("last-file"), [
        ["run", yes],
        ["stop", no],
        ["reset", no],
        ["new", yes],
        ["rename", yes],
        ["delete", no],
      ]);
      assert.deepEqual((await available("editable")).at(-1), ["delete", yes]);
    } finally {
      await page.close();
    }
  });

  test("as the owner changes the models, the controls follow", async () => {
    const page = await open();
    try {
      await page.evaluate(`void (window.loose = window.controls.loose({
        files: [{ name: "main.go", text: "a" }, { name: "b.go", text: "b" }],
      }))`);
      const available = () =>
        page.evaluate(
          `window.loose.updateComplete.then(() => Object.fromEntries(window.controls.available(window.loose)))`,
        );
      assert.deepEqual(await available(), {
        run: "false",
        stop: "true",
        reset: "true",
        new: "false",
        rename: "false",
        delete: "false",
      });
      await page.evaluate(`window.loose.files.edit("b.go", "changed")`);
      assert.equal((await available()).reset, "false", "a file modified, Reset is available");
      await page.evaluate(`window.loose.files.reset("b.go")`);
      assert.equal((await available()).reset, "true");
      await page.evaluate(`window.loose.runState.start("hello")`);
      assert.equal((await available()).stop, "false", "a run pending, Stop is available");
      await page.evaluate(`window.loose.runState.finish(1, { kind: "exit", code: 0 })`);
      assert.equal((await available()).stop, "true");
      await page.evaluate(`window.loose.files.remove("b.go")`);
      assert.equal((await available()).delete, "true", "the last file, Delete is unavailable");
    } finally {
      await page.close();
    }
  });
});

describe("the toolbar's keyboard", () => {
  test("one tab stop: Tab reaches Run, the next Tab leaves the toolbar, and focus shows", async () => {
    const page = await focused();
    try {
      const controls = `window.controls.at("focus", "focus")`;
      await page.evaluate(`document.querySelector("#controls [data-focus-start]").focus()`);
      await press(page, "Tab");
      assert.equal(await focusIn(page, controls), "run");
      const outline = await page.evaluate(
        `getComputedStyle(window.controls.button(${controls}, "run")).outlineStyle`,
      );
      assert.equal(outline, "solid");
      await press(page, "Tab");
      assert.equal(await focusIn(page, controls), null, "the next Tab leaves the toolbar");
      assert.deepEqual(
        await page.evaluate(
          `[...${shadow(controls)}.querySelectorAll("[data-control]")].map((b) => b.tabIndex)`,
        ),
        [0, -1, -1, -1, -1, -1],
      );
    } finally {
      await page.close();
    }
  });

  test("Left and Right move between every control, unavailable ones too, wrapping; Home and End reach the ends", async () => {
    const page = await focused();
    try {
      const controls = `window.controls.at("focus", "focus")`;
      await page.evaluate(`window.controls.button(${controls}, "run").focus()`);
      const visited: (string | null)[] = [];
      for (let i = 0; i < 6; i++) {
        await press(page, "ArrowRight");
        visited.push(await focusIn(page, controls));
      }
      assert.deepEqual(visited, ["stop", "reset", "new", "rename", "delete", "run"]);
      await press(page, "ArrowLeft");
      assert.equal(
        await focusIn(page, controls),
        "delete",
        "Left from the first wraps to the last",
      );
      await press(page, "Home");
      assert.equal(await focusIn(page, controls), "run");
      await press(page, "End");
      assert.equal(await focusIn(page, controls), "delete");
    } finally {
      await page.close();
    }
  });

  test("the tab stop follows focus: leaving by Tab and returning by Shift+Tab lands on the control last focused", async () => {
    const page = await focused();
    try {
      const controls = `window.controls.at("focus", "focus")`;
      await page.evaluate(`window.controls.button(${controls}, "run").focus()`);
      await press(page, "ArrowRight");
      await press(page, "ArrowRight");
      assert.equal(await focusIn(page, controls), "reset");
      await press(page, "Tab");
      assert.equal(await focusIn(page, controls), null, "Tab leaves the toolbar");
      await press(page, "Tab", 8);
      assert.equal(await focusIn(page, controls), "reset", "Shift+Tab comes back to Reset");
      assert.deepEqual(
        await page.evaluate(
          `[...${shadow(controls)}.querySelectorAll("[data-control]")].map((b) => b.tabIndex)`,
        ),
        [-1, -1, 0, -1, -1, -1],
      );
    } finally {
      await page.close();
    }
  });

  test("Enter and Space press the focused control; an unavailable one sends nothing", async () => {
    const page = await focused();
    try {
      await page.evaluate(`void (window.loose = window.controls.loose())`);
      await page.evaluate(`window.loose.updateComplete`);
      await page.evaluate(`window.controls.button(window.loose, "run").focus()`);
      await press(page, "Enter");
      await press(page, " ");
      await press(page, "ArrowRight");
      assert.equal(await focusIn(page, "window.loose"), "stop");
      await press(page, "Enter");
      await press(page, " ");
      assert.deepEqual(
        await page.evaluate(`window.loose.requests.map((r) => r.type)`),
        ["run", "run"],
        "Stop, unavailable, sent nothing",
      );
    } finally {
      await page.close();
    }
  });
});

describe("requests", () => {
  test("each control sends its request, bubbling and not composed, and changes neither model", async () => {
    const page = await open();
    try {
      await page.evaluate(`(() => {
        window.loose = window.controls.loose({
          files: [{ name: "main.go", text: "a" }, { name: "b.go", text: "b" }],
        });
      })()`);
      await page.evaluate(`window.loose.updateComplete`);
      await page.evaluate(`(() => {
        window.loose.files.edit("main.go", "edited");
        window.loose.runState.start("hello");
        window.loose.files.changes = 0;
        window.loose.runState.changes = 0;
      })()`);
      await page.evaluate(`window.loose.updateComplete`);
      for (const control of ["run", "stop", "reset", "delete"]) {
        await page.evaluate(`window.controls.button(window.loose, "${control}").click()`);
      }
      assert.deepEqual(await page.evaluate(`window.loose.requests`), [
        { type: "run", detail: null, bubbles: true, composed: false },
        { type: "stop", detail: null, bubbles: true, composed: false },
        { type: "reset", detail: null, bubbles: true, composed: false },
        { type: "delete", detail: { name: "main.go" }, bubbles: true, composed: false },
      ]);
      assert.deepEqual(
        await page.evaluate(`[window.loose.files.changes, window.loose.runState.changes]`),
        [0, 0],
        "the toolbar wrote neither model",
      );
      assert.deepEqual(
        await page.evaluate(`window.loose.files.files.map((f) => [f.name, f.text])`),
        [
          ["main.go", "edited"],
          ["b.go", "b"],
        ],
      );
    } finally {
      await page.close();
    }
  });

  test("an unavailable control's click sends nothing", async () => {
    const page = await open();
    try {
      await page.evaluate(`void (window.loose = window.controls.loose())`);
      await page.evaluate(`window.loose.updateComplete`);
      for (const control of ["stop", "reset", "delete"]) {
        await page.evaluate(`window.controls.button(window.loose, "${control}").click()`);
      }
      assert.deepEqual(await page.evaluate(`window.loose.requests`), []);
    } finally {
      await page.close();
    }
  });

  test("on the page, the owner applies them: Reset restores, Delete removes, Run and Stop drive the run", async () => {
    const page = await open();
    try {
      const modified = `window.controls.at("modified")`;
      await click(page, `window.controls.button(${modified}, "reset")`);
      assert.equal(await page.evaluate(`${modified}.files.modified`), false);
      await until(page, `window.controls.available(${modified})[2][1] === "true"`, 2000);
      const editable = `window.controls.at("editable")`;
      await click(page, `window.controls.button(${editable}, "delete")`);
      assert.deepEqual(await page.evaluate(`${editable}.files.files.map((f) => f.name)`), [
        "greeting.go",
        "go.mod",
      ]);
      const tabs: string[] = await page.evaluate(`(async () => {
        const tabs = window.controls.figure("editable").querySelector("sl-file-tabs");
        await tabs.updateComplete;
        return [...tabs.shadowRoot.querySelectorAll('[role="tab"]')].map((t) => t.textContent.trim());
      })()`);
      assert.deepEqual(tabs, ["greeting.go", "go.mod"]);
      const idle = `window.controls.at("idle")`;
      await click(page, `window.controls.button(${idle}, "run")`);
      assert.equal(await page.evaluate(`${idle}.runState.running`), "hello");
      await click(page, `window.controls.button(${idle}, "stop")`);
      assert.deepEqual(await page.evaluate(`${idle}.runState.last`), {
        what: "hello",
        outcome: { kind: "stopped" },
      });
    } finally {
      await page.close();
    }
  });
});

describe("the forms", () => {
  test("New file opens its form below its button, the input focused and named by its label", async () => {
    const page = await focused();
    try {
      const controls = `window.controls.at("editable")`;
      await page.evaluate(`window.controls.button(${controls}, "new").focus()`);
      await press(page, "Enter");
      await focusReaches(page, controls, "new-name");
      assert.equal(await isOpen(page, controls, "new"), true);
      const place: { below: number; start: number } = await page.evaluate(`(() => {
        const button = window.controls.button(${controls}, "new").getBoundingClientRect();
        const form = ${popover(controls, "new")}.getBoundingClientRect();
        return { below: form.top - button.bottom, start: form.left - button.left };
      })()`);
      assert.ok(
        place.below >= 0 && place.below < 16,
        `the form sits below its button: ${place.below}`,
      );
      assert.equal(Math.round(place.start), 0, "at its button's inline start");
      assert.equal(
        await page.evaluate(
          `getComputedStyle(${popover(controls, "new")}, "::backdrop").backgroundColor`,
        ),
        "rgba(0, 0, 0, 0)",
        "a non-modal form veils nothing behind it",
      );
      const [dialog] = await axQuery(page, popover(controls, "new"), "dialog");
      assert.equal(dialog.name?.value, "New file");
      assert.deepEqual(await field(page, controls, "new"), {
        name: "New file's name",
        invalid: false,
        description: "",
      });
      const [expanded] = await axQuery(
        page,
        `window.controls.button(${controls}, "new")`,
        "button",
      );
      assert.equal(property(expanded, "expanded"), true);
    } finally {
      await page.close();
    }
  });

  test("a refused name is said on submit, invalid and described, then checked again as typed; a taken one closes the form, focus back on New file, and sends new", async () => {
    const page = await focused();
    try {
      await page.evaluate(`void (window.loose = window.controls.loose({
        files: [{ name: "main.go", text: "" }],
      }))`);
      await page.evaluate(`window.loose.updateComplete`);
      await page.evaluate(`window.controls.button(window.loose, "new").focus()`);
      await press(page, "Enter");
      await focusReaches(page, "window.loose", "new-name");
      await press(page, "Enter");
      await page.evaluate(`window.loose.updateComplete`);
      assert.deepEqual(await field(page, "window.loose", "new"), {
        name: "New file's name",
        invalid: true,
        description: "A file's name can't be empty",
      });
      assert.equal(await isOpen(page, "window.loose", "new"), true, "refused, it stays open");
      await page.cdp("Input.insertText", { text: "main.go" });
      await page.evaluate(`window.loose.updateComplete`);
      assert.equal(
        (await field(page, "window.loose", "new")).description,
        'Another file is named "main.go"',
        "checked again as typed",
      );
      await page.evaluate(`${input("window.loose", "new")}.select()`);
      await page.cdp("Input.insertText", { text: "util.go" });
      await page.evaluate(`window.loose.updateComplete`);
      assert.deepEqual(await field(page, "window.loose", "new"), {
        name: "New file's name",
        invalid: false,
        description: "",
      });
      assert.deepEqual(await page.evaluate(`window.loose.requests`), [], "nothing sent yet");
      await press(page, "Enter");
      await focusReaches(page, "window.loose", "new");
      assert.equal(await isOpen(page, "window.loose", "new"), false);
      assert.deepEqual(await page.evaluate(`window.loose.requests`), [
        { type: "new", detail: { name: "util.go" }, bubbles: true, composed: false },
      ]);
      assert.equal(
        await page.evaluate(`window.loose.files.changes`),
        0,
        "the toolbar added nothing",
      );
    } finally {
      await page.close();
    }
  });

  test("a form opens afresh: the last refusal and name gone", async () => {
    const page = await focused();
    try {
      await page.evaluate(`void (window.loose = window.controls.loose())`);
      await page.evaluate(`window.loose.updateComplete`);
      await click(page, `window.controls.button(window.loose, "new")`);
      await focusReaches(page, "window.loose", "new-name");
      await page.cdp("Input.insertText", { text: "a/b" });
      await press(page, "Enter");
      await page.evaluate(`window.loose.updateComplete`);
      assert.equal((await field(page, "window.loose", "new")).invalid, true);
      await press(page, "Escape");
      await focusReaches(page, "window.loose", "new");
      await press(page, "Enter");
      await focusReaches(page, "window.loose", "new-name");
      await page.evaluate(`window.loose.updateComplete`);
      assert.equal(await page.evaluate(`${input("window.loose", "new")}.value`), "");
      assert.equal((await field(page, "window.loose", "new")).invalid, false);
    } finally {
      await page.close();
    }
  });

  test("Escape closes a form, sends nothing, and returns focus to its button, which the page's keys leave focused", async () => {
    const page = await focused();
    try {
      await page.evaluate(`void (window.loose = window.controls.loose())`);
      await page.evaluate(`window.loose.updateComplete`);
      await page.evaluate(`window.controls.button(window.loose, "new").focus()`);
      await press(page, " ");
      await focusReaches(page, "window.loose", "new-name");
      await page.cdp("Input.insertText", { text: "draft.go" });
      await press(page, "Escape");
      await focusReaches(page, "window.loose", "new");
      assert.equal(await isOpen(page, "window.loose", "new"), false);
      assert.deepEqual(await page.evaluate(`window.loose.requests`), []);
      // A moment later focus is still there: nothing blurred it.
      await new Promise((resolve) => setTimeout(resolve, 100));
      assert.equal(await focusIn(page, "window.loose"), "new");
    } finally {
      await page.close();
    }
  });

  test("Rename prefills the active file's name, its stem selected, and sends rename only for a new name", async () => {
    const page = await focused();
    try {
      await page.evaluate(`void (window.loose = window.controls.loose({
        files: [{ name: "main.go", text: "" }, { name: "go.mod", text: "" }],
      }))`);
      await page.evaluate(`window.loose.updateComplete`);
      await click(page, `window.controls.button(window.loose, "rename")`);
      await focusReaches(page, "window.loose", "rename-name");
      const prefilled = () =>
        page.evaluate(`(() => {
          const field = ${input("window.loose", "rename")};
          return [field.value, field.value.slice(field.selectionStart, field.selectionEnd)];
        })()`);
      assert.deepEqual(await prefilled(), ["main.go", "main"]);
      assert.equal((await field(page, "window.loose", "rename")).name, "Rename main.go to");
      // Its own name, unchanged, is taken, closing the form with nothing sent.
      await press(page, "Enter");
      await focusReaches(page, "window.loose", "rename");
      assert.deepEqual(await page.evaluate(`window.loose.requests`), []);
      // Another file's name is refused.
      await press(page, "Enter");
      await focusReaches(page, "window.loose", "rename-name");
      await page.evaluate(`${input("window.loose", "rename")}.select()`);
      await page.cdp("Input.insertText", { text: "go.mod" });
      await press(page, "Enter");
      await page.evaluate(`window.loose.updateComplete`);
      assert.equal(
        (await field(page, "window.loose", "rename")).description,
        'Another file is named "go.mod"',
      );
      await page.evaluate(`${input("window.loose", "rename")}.setSelectionRange(0, 2)`);
      await page.cdp("Input.insertText", { text: "app" });
      await press(page, "Enter");
      await focusReaches(page, "window.loose", "rename");
      assert.deepEqual(await page.evaluate(`window.loose.requests`), [
        {
          type: "rename",
          detail: { from: "main.go", to: "app.mod" },
          bubbles: true,
          composed: false,
        },
      ]);
    } finally {
      await page.close();
    }
  });

  test("a name with no extension, or only a leading dot, is selected whole", async () => {
    const page = await focused();
    try {
      for (const name of ["Makefile", ".gitignore"]) {
        await page.evaluate(`void (window.loose = window.controls.loose({
          files: [{ name: ${JSON.stringify(name)}, text: "" }],
        }))`);
        await page.evaluate(`window.loose.updateComplete`);
        await click(page, `window.controls.button(window.loose, "rename")`);
        await focusReaches(page, "window.loose", "rename-name");
        const selected = await page.evaluate(`(() => {
          const field = ${input("window.loose", "rename")};
          return field.value.slice(field.selectionStart, field.selectionEnd);
        })()`);
        assert.equal(selected, name);
        await press(page, "Escape");
        await focusReaches(page, "window.loose", "rename");
        await page.evaluate(`window.loose.remove()`);
      }
    } finally {
      await page.close();
    }
  });

  test("on the page, a new file is added and made active, and a rename renames its tab", async () => {
    const page = await focused();
    try {
      const controls = `window.controls.at("editable")`;
      await click(page, `window.controls.button(${controls}, "new")`);
      await focusReaches(page, controls, "new-name");
      await page.cdp("Input.insertText", { text: "util.go" });
      await press(page, "Enter");
      await focusReaches(page, controls, "new");
      assert.equal(await page.evaluate(`${controls}.files.active`), "util.go");
      await click(page, `window.controls.button(${controls}, "rename")`);
      await focusReaches(page, controls, "rename-name");
      await page.cdp("Input.insertText", { text: "helpers" });
      await press(page, "Enter");
      await focusReaches(page, controls, "rename");
      assert.deepEqual(await page.evaluate(`${controls}.files.files.map((f) => f.name)`), [
        "main.go",
        "greeting.go",
        "go.mod",
        "helpers.go",
      ]);
    } finally {
      await page.close();
    }
  });

  test("the refusing state's aid opens New file's form saying why main.go is refused", async () => {
    const page = await open();
    try {
      const controls = `window.controls.at("refused")`;
      assert.equal(await isOpen(page, controls, "new"), false, "closed as the page loads");
      await page.evaluate(
        `window.controls.figure("refused").querySelector(".readout button").click()`,
      );
      await page.evaluate(`${controls}.updateComplete`);
      assert.equal(await isOpen(page, controls, "new"), true);
      assert.deepEqual(await field(page, controls, "new"), {
        name: "New file's name",
        invalid: true,
        description: 'Another file is named "main.go"',
      });
      const shown: boolean = await page.evaluate(
        `${shadow(controls)}.querySelector("#new-problem svg").checkVisibility()`,
      );
      assert.ok(shown, "the refusal is led by its glyph");
    } finally {
      await page.close();
    }
  });
});

describe("the status", () => {
  test("says each transition: a run begun, and how it ended", async () => {
    const page = await open();
    try {
      await page.evaluate(`void (window.loose = window.controls.loose())`);
      const status = async (step: string) => {
        await page.evaluate(step);
        return page.evaluate(
          `window.loose.updateComplete.then(() => window.controls.status(window.loose))`,
        );
      };
      const state = "window.loose.runState";
      assert.equal(await status(`0`), "", "nothing said at first");
      assert.equal(await status(`${state}.start("hello")`), "Running hello…");
      assert.equal(
        await status(`${state}.finish(1, { kind: "exit", code: 0 })`),
        "Finished hello, exit code 0",
      );
      assert.equal(await status(`${state}.start("crash")`), "Running crash…");
      assert.equal(
        await status(`${state}.finish(2, { kind: "exit", code: 2 })`),
        "Finished crash, exit code 2",
      );
      assert.equal(await status(`${state}.start("spin")`), "Running spin…");
      assert.equal(await status(`${state}.start("format")`), "Running format…", "superseded");
      assert.equal(
        await status(`${state}.finish(3, { kind: "failed", message: "stopped" })`),
        "Running format…",
        "the superseded run's late finish says nothing",
      );
      assert.equal(await status(`${state}.finish(4, { kind: "ok" })`), "Finished format");
      assert.equal(await status(`${state}.start("format")`), "Running format…");
      assert.equal(
        await status(`${state}.finish(5, { kind: "failed", message: "input.go:3:1: bad" })`),
        "Failed format: input.go:3:1: bad",
      );
      assert.equal(await status(`${state}.start("spin")`), "Running spin…");
      assert.equal(await status(`${state}.finish(6, { kind: "stopped" })`), "Stopped spin");
    } finally {
      await page.close();
    }
  });

  test("says only transitions: not the state it is given, and not a change of the files", async () => {
    const page = await open();
    try {
      assert.equal(
        await page.evaluate(`window.controls.status(window.controls.at("running"))`),
        "",
        "a run pending as the page loads is not said",
      );
      await page.evaluate(`void (window.loose = window.controls.loose())`);
      await page.evaluate(`(() => {
        const state = window.loose.runState;
        state.finish(state.start("hello"), { kind: "exit", code: 0 });
      })()`);
      await page.evaluate(`window.loose.updateComplete`);
      assert.equal(
        await page.evaluate(`window.controls.status(window.loose)`),
        "Finished hello, exit code 0",
      );
      // The status is watched: a change of the files, or a new state handed in, adds nothing.
      await page.evaluate(`(() => {
        window.said = [];
        const status = window.loose.shadowRoot.querySelector('[role="status"]');
        new MutationObserver(() => window.said.push(status.textContent))
          .observe(status, { childList: true, characterData: true, subtree: true });
      })()`);
      await page.evaluate(`window.loose.files.edit("main.go", "changed")`);
      await page.evaluate(`window.loose.updateComplete`);
      assert.deepEqual(
        await page.evaluate(`window.said`),
        [],
        "a change of the files says nothing",
      );
      await page.evaluate(`(() => {
        const state = new window.controls.RunState();
        state.start("spin");
        window.loose.runState = state;
      })()`);
      await page.evaluate(`window.loose.updateComplete`);
      assert.equal(
        await page.evaluate(`window.controls.status(window.loose)`),
        "",
        "a state handed in is taken as it is, unsaid",
      );
      await page.evaluate(`window.loose.runState.finish(1, { kind: "stopped" })`);
      await page.evaluate(`window.loose.updateComplete`);
      assert.equal(await page.evaluate(`window.controls.status(window.loose)`), "Stopped spin");
    } finally {
      await page.close();
    }
  });

  test("on the page, Run's run is said as it starts and as it ends on its own", async () => {
    const page = await open();
    try {
      const controls = `window.controls.at("fails")`;
      await click(page, `window.controls.button(${controls}, "run")`);
      await until(page, `window.controls.status(${controls}) === "Running format…"`, 2000);
      await until(
        page,
        `window.controls.status(${controls}) === "Failed format: input.go:3:1: expected declaration, found '}'"`,
        3000,
      );
    } finally {
      await page.close();
    }
  });
});

describe("size, space, and motion", () => {
  test("every button, the forms' among them, is at least 24px a side in every space and type", async () => {
    const page = await open();
    try {
      const profiles: { space: string[]; type: string[] } = await page.evaluate(`(() => {
        const registry = globalThis[Symbol.for("spike-html-apps-foundation.registry")];
        return { space: [...registry.space], type: [...registry.type] };
      })()`);
      assert.ok(profiles.space.length > 1 && profiles.type.length > 1);
      const controls = `window.controls.at("editable", 1)`;
      for (const space of profiles.space) {
        for (const type of profiles.type) {
          const sizes: { name: string; width: number; height: number }[] =
            await page.evaluate(`(async () => {
            const root = document.documentElement;
            root.setAttribute("data-space", ${JSON.stringify(space)});
            root.setAttribute("data-type", ${JSON.stringify(type)});
            const form = ${popover(controls, "new")};
            form.showPopover();
            await new Promise((resolve) => requestAnimationFrame(resolve));
            const shown = [...${shadow(controls)}.querySelectorAll("button")].filter((b) => b.checkVisibility());
            const sizes = shown.map((b) => {
              const { width, height } = b.getBoundingClientRect();
              return { name: b.textContent.trim(), width, height };
            });
            form.hidePopover();
            return sizes;
          })()`);
          assert.deepEqual(
            sizes.map(({ name }) => name),
            ["Run", "Stop", "Reset", "New file", "Rename", "Delete", "Create"],
            "the six controls and the open form's submit",
          );
          for (const { name, width, height } of sizes) {
            assert.ok(
              width >= 23.5 && height >= 23.5,
              `${name} in ${space} ${type}: ${width}×${height}`,
            );
          }
        }
      }
    } finally {
      await page.close();
    }
  });

  test("at 20rem the toolbar wraps between its groups, each group whole on its row, nothing wider than the column", async () => {
    const page = await open();
    try {
      const layout: { fits: boolean; rows: number[][]; groups: number } =
        await page.evaluate(`(() => {
        const controls = window.controls.at("editable", 1);
        const figure = controls.parentElement.getBoundingClientRect();
        const groups = [...controls.shadowRoot.querySelectorAll('[role="group"]')];
        const all = [...controls.shadowRoot.querySelectorAll("*")];
        return {
          fits: all.every((e) => e.getBoundingClientRect().right <= figure.right + 0.5),
          rows: groups.map((g) => [...new Set([...g.querySelectorAll("button")].map((b) => Math.round(b.getBoundingClientRect().top)))]),
          groups: new Set(groups.map((g) => Math.round(g.getBoundingClientRect().top))).size,
        };
      })()`);
      assert.ok(layout.fits, "nothing reaches past the 20rem column");
      assert.deepEqual(
        layout.rows.map((tops) => tops.length),
        [1, 1],
        "each group's buttons share one row",
      );
      assert.equal(layout.groups, 2, "the groups wrap onto rows of their own");
    } finally {
      await page.close();
    }
  });

  test("nothing moves, with motion allowed or reduced, a form open or not", async () => {
    const page = await open();
    try {
      const controls = `window.controls.at("editable")`;
      for (const value of ["no-preference", "reduce"]) {
        await page.cdp("Emulation.setEmulatedMedia", {
          features: [{ name: "prefers-reduced-motion", value }],
        });
        for (const opened of [false, true]) {
          const moving: string[] = await page.evaluate(`(() => {
            const form = ${popover(controls, "new")};
            if (${opened}) form.showPopover();
            const found = [...${shadow(controls)}.querySelectorAll("*")].filter((element) => {
              const style = getComputedStyle(element);
              return style.animationName !== "none" || style.scrollBehavior !== "auto" ||
                style.transitionDuration.split(",").some((d) => parseFloat(d) > 0);
            }).map((element) => element.tagName);
            if (${opened}) form.hidePopover();
            return found;
          })()`);
          assert.deepEqual(moving, [], `${value}, ${opened ? "open" : "closed"}`);
        }
      }
    } finally {
      await page.close();
    }
  });
});

describe("the controls' subscription", () => {
  test("they listen only to the models they hold, only while in the document", async () => {
    const page = await open();
    try {
      await page.evaluate(`(() => {
        const { FileSet, RunState, counted } = window.controls;
        window.files = [0, 1].map((i) => counted(new FileSet([{ name: \`f\${i}.go\`, text: "" }])));
        window.states = [0, 1].map(() => counted(new RunState()));
        window.held = document.createElement("sl-controls");
        window.held.files = window.files[0];
        window.held.runState = window.states[0];
      })()`);
      const counts = () =>
        page.evaluate(
          `window.held.updateComplete.then(() => [...window.files, ...window.states].map((m) => m.listeners))`,
        );
      // Never connected, it has no update to wait for, so its listeners are read at once.
      assert.deepEqual(
        await page.evaluate(`[...window.files, ...window.states].map((m) => m.listeners)`),
        [0, 0, 0, 0],
        "never in the document, it listens to none",
      );
      await page.evaluate(`window.controls.figure("idle").append(window.held)`);
      assert.deepEqual(await counts(), [1, 0, 1, 0]);
      await page.evaluate(`window.held.remove()`);
      assert.deepEqual(await counts(), [0, 0, 0, 0], "removed, it stops");
      await page.evaluate(`window.files[0].edit("f0.go", "changed while out")`);
      await page.evaluate(`window.controls.figure("idle").append(window.held)`);
      assert.deepEqual(await counts(), [1, 0, 1, 0]);
      assert.equal(
        await page.evaluate(
          `window.controls.button(window.held, "reset").getAttribute("aria-disabled")`,
        ),
        "false",
        "back in the document, it shows the files as they now are",
      );
      await page.evaluate(
        `window.held.files = window.files[1]; window.held.runState = window.states[1]`,
      );
      assert.deepEqual(
        await counts(),
        [0, 1, 0, 1],
        "replaced, it leaves the old models for the new",
      );
      await page.evaluate(`window.held.files = null; window.held.runState = null`);
      assert.deepEqual(await counts(), [0, 0, 0, 0]);
    } finally {
      await page.close();
    }
  });
});
