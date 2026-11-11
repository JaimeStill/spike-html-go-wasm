// sl-go-demo on the components page, running real Go: the build as Pages serves it, dist/ under
// the base by the SDK's served(), Vite's preview, in the pinned chrome-headless-shell, the page's
// one runner shared by every demo.
//
// No Go is requested, and no worker started, until a Run. A handler demo's Run calls format with
// its file's text, its output line, its answer as the console's result block, and its timings by
// phase, each a duration; a program demo's Run runs hello's main, its line as stdout and its exit
// 0, in the one worker the Run starts. A handler's error shows as the console's error block, and
// the instance outlives it: the next call answers on it. Ctrl+Enter from inside a demo's editor
// runs that demo, and from outside any demo runs none. A handler demo with two fences shows its
// authoring error, in the page and in the accessibility tree, the fences as written, and doesn't
// run. Stop ends spin. Two demos on the runner: format's Run while spin's is pending stops spin,
// whose demo records it stopped, each console holds only its own output, and the module goes to
// the fresh worker unfetched, one worker live. Editable files: New file, Rename, and Delete change
// the set, a new file selected with the editor focused, focus on the tab now active after a
// delete, and the last file kept. Reset restores an edited file. A tab size the settings refuse is
// an authoring error a valid one mends, and a handler's change rebuilds the files in its mode. A
// demo's accessibility tree: a region named by its label, the toolbar, the tabs and the panel on
// a program demo, the editor, the log, and the timings, its fences no part of it. The fences: the
// SDK's Shiki markup read as plain text and run, and without script, every fence shows as the
// page's code. At 20rem each demo fits its column. The rest of the runtime's proofs, through the
// same demos, are go-runs.test.ts's; the page's watch and helpers are go-demos.ts's. Every wait is
// bounded. Nothing here names the site: its base is package.json's name.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import {
  demo,
  goRequests,
  open as openPage,
  pressControl,
  says,
  settle,
  settles,
  shown,
  spin,
  wasmRequests,
} from "./go-demos.ts";

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

/** Opens the components page, watched, its helpers installed (go-demos.ts). */
const open = () => openPage(browser, server.origin);

/** Enter pressed and released on the focused element, carrying its text as a keyboard's does,
 * with the modifiers (2 is Ctrl). */
async function enter(page: Page, modifiers = 0) {
  for (const type of ["keyDown", "keyUp"]) {
    await page.cdp("Input.dispatchKeyEvent", {
      type,
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
      modifiers,
      ...(type === "keyDown" ? { text: "\r" } : {}),
    });
  }
}

const ctrlEnter = (page: Page) => enter(page, 2);

/** A node of the accessibility tree, as CDP gives it. */
interface AXNode {
  ignored: boolean;
  nodeId: string;
  childIds?: string[];
  role?: { value: string };
  name?: { value: string };
  description?: { value: string };
  properties?: { name: string; value: { value?: unknown } }[];
}

/** The unignored nodes under the element the expression gives, of the role when named. */
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

const helloSource = readFileSync(join(root, "cmd/hello/main.go"), "utf8");
const helloLine = /^hello from Go go1\.\d+\.\d+ on js\/wasm$/;

describe("loading", () => {
  test("no Go is requested until a Run, and a Run requests it", async () => {
    const watched = await open();
    try {
      const { page } = watched;
      assert.equal(await page.evaluate(`document.querySelectorAll("sl-go-demo").length`), 19);
      assert.deepEqual(goRequests(watched), []);
      assert.deepEqual(watched.workers, []);
      await pressControl(page, demo("program"), "run");
      await says(page, demo("program"), "Finished hello, exit code 0");
      assert.deepEqual(goRequests(watched), ["assets/worker.js", "go/hello.wasm"]);
    } finally {
      await watched.page.close();
    }
  });
});

describe("Run", () => {
  test("a handler demo calls format with its file's text: its line, its answer, its timings", async () => {
    const { page } = await open();
    try {
      const target = demo("handler");
      const input: string = await page.evaluate(`window.demos.editor(${target}).value`);
      const answer = JSON.stringify(JSON.parse(input), null, 2);
      await pressControl(page, target, "run");
      await says(page, target, "Finished format");
      const result = await shown(page, target);
      assert.deepEqual(result.rows, [
        {
          kind: "line",
          // Go's json.Indent keeps the input's trailing newline.
          text: `format: ${input.length} bytes in, ${answer.length + 1} bytes out`,
        },
        { kind: "result", text: `Result ${answer.replace(/\s+/g, " ")}` },
      ]);
      assert.deepEqual(result.phases, ["Fetch", "Compile", "Instantiate", "Start", "Call"]);
      assert.ok(
        result.times.length === 5 && result.times.every((ms) => Number.isFinite(ms) && ms >= 0),
        `each phase's time is a duration: ${result.times}`,
      );
    } finally {
      await page.close();
    }
  });

  test("a program demo runs hello's main: its line as stdout and its exit 0, in the one worker its Run starts", async () => {
    const watched = await open();
    const { page } = watched;
    try {
      const target = demo("program");
      await pressControl(page, target, "run");
      await says(page, target, "Finished hello, exit code 0");
      const result = await shown(page, target);
      assert.equal(result.rows.length, 2, JSON.stringify(result.rows));
      assert.equal(result.rows[0].kind, "line");
      assert.match(result.rows[0].text, helloLine);
      assert.deepEqual(
        result.lines.map(({ stream }) => stream),
        ["stdout"],
      );
      assert.deepEqual(result.rows[1], { kind: "exit", text: "hello exited with code 0" });
      assert.deepEqual(result.phases, ["Fetch", "Compile", "Instantiate", "Run"]);
      assert.ok(
        result.times.length === 4 && result.times.every((ms) => Number.isFinite(ms) && ms >= 0),
        `each phase's time is a duration: ${result.times}`,
      );
      assert.equal(watched.workers.length, 1, `one worker: ${watched.workers}`);
    } finally {
      await page.close();
    }
  });

  test("a handler's error shows as the console's error block, and the status names it", async () => {
    const { page } = await open();
    try {
      const target = demo("handler");
      // The editor's text selected and typed over with JSON cut short.
      await page.evaluate(`(() => {
        const text = window.demos.editor(${target}).shadowRoot.querySelector(".text");
        text.focus();
        getSelection().selectAllChildren(text);
      })()`);
      await page.cdp("Input.insertText", { text: '{"a":' });
      await pressControl(page, target, "run");
      await says(page, target, "Failed format: format: unexpected end of JSON input");
      assert.deepEqual((await shown(page, target)).rows, [
        { kind: "result", text: "Error format: unexpected end of JSON input" },
      ]);
      // The instance outlives the error: the next call, the file reset, answers on it.
      await pressControl(page, target, "reset");
      await pressControl(page, target, "run");
      await says(page, target, "Finished format");
      const next = await shown(page, target);
      assert.equal(next.result?.ok, true, JSON.stringify(next.result));
      assert.deepEqual(next.phases, ["Call"]);
    } finally {
      await page.close();
    }
  });
});

describe("Ctrl+Enter", () => {
  test("from inside the demo's editor runs that demo alone, inserting nothing", async () => {
    const watched = await open();
    const { page } = watched;
    try {
      const target = demo("handler");
      const before: string = await page.evaluate(`window.demos.editor(${target}).value`);
      await page.evaluate(`window.demos.editor(${target}).focus()`);
      assert.deepEqual(await page.evaluate(`window.demos.focusPath()`), [
        "sl-go-demo",
        "sl-code-editor",
        "div.text",
      ]);
      await ctrlEnter(page);
      await says(page, target, "Finished format");
      assert.equal(await page.evaluate(`window.demos.editor(${target}).value`), before);
      // No other demo ran.
      assert.equal(await page.evaluate(`window.demos.status(${demo("program")})`), "");
      assert.deepEqual(await page.evaluate(`window.demos.rows(${demo("focus", 0, "focus")})`), []);
    } finally {
      await page.close();
    }
  });

  test("from the toolbar runs the demo too: the keydown is the host's, from any part", async () => {
    const { page } = await open();
    try {
      const target = demo("program");
      await page.evaluate(`window.demos.button(${target}, "reset").focus()`);
      await ctrlEnter(page);
      await says(page, target, "Finished hello, exit code 0");
    } finally {
      await page.close();
    }
  });

  test("from outside every demo runs none, and requests no Go", async () => {
    const watched = await open();
    const { page } = watched;
    try {
      await page.evaluate(`document.querySelector("#go-demo [data-focus-start]").focus()`);
      await ctrlEnter(page);
      // Give a run every chance to begin: a Run says so in its status at once.
      await new Promise((resolve) => setTimeout(resolve, 300));
      const statuses: string[] = await page.evaluate(
        `[...document.querySelectorAll("#go-demo sl-go-demo")]
          .filter((demo) => demo.problem === null)
          .map((demo) => window.demos.status(demo))`,
      );
      assert.ok(statuses.length > 0);
      assert.deepEqual(new Set(statuses), new Set([""]));
      assert.deepEqual(goRequests(watched), []);
    } finally {
      await page.close();
    }
  });
});

describe("an authoring error", () => {
  test("a handler demo with two fences says why, in the page and the tree, shows the fences, and doesn't run", async () => {
    const watched = await open();
    const { page } = watched;
    try {
      const target = demo("authoring-error");
      const seen = await page.evaluate(`(() => {
        const demo = ${target};
        return {
          error: window.demos.part(demo, ".error").textContent.replace(/\\s+/g, " ").trim(),
          toolbar: window.demos.part(demo, "sl-controls") !== null,
          editor: window.demos.part(demo, "sl-code-editor") !== null,
          fences: [...demo.querySelectorAll(":scope > pre")].map((pre) =>
            [pre.checkVisibility(), pre.textContent]),
        };
      })()`);
      assert.deepEqual(seen, {
        error:
          "Authoring error: a handler demo holds one fence, its handler's input; this one holds 2.",
        toolbar: false,
        editor: false,
        fences: [
          [true, "[1, 2]\n"],
          [true, "[3, 4]\n"],
        ],
      });
      const [region] = await axQuery(page, target, "region");
      assert.equal(region.name?.value, "format demo, two fences");
      assert.equal(
        region.description?.value,
        "Authoring error: a handler demo holds one fence, its handler's input; this one holds 2",
      );
      // Ctrl+Enter inside it runs nothing.
      await page.evaluate(`${target}.querySelector("pre").tabIndex = 0`);
      await page.evaluate(`${target}.querySelector("pre").focus()`);
      await ctrlEnter(page);
      await new Promise((resolve) => setTimeout(resolve, 300));
      assert.deepEqual(goRequests(watched), []);
    } finally {
      await page.close();
    }
  });
});

describe("attributes after the first render", () => {
  test("a tab size the settings refuse is an authoring error a valid one mends; a handler's change rebuilds the files in its mode", async () => {
    const { page } = await open();
    try {
      await page.evaluate(`(() => {
        const demo = document.createElement("sl-go-demo");
        demo.setAttribute("scenario", "probe");
        demo.setAttribute("handler", "format");
        demo.setAttribute("tab-size", "9");
        demo.innerHTML = '<pre><code class="language-go">package main\\n</code></pre>';
        document.querySelector('#go-demo figure[data-state="handler"]').append(demo);
        window.made = demo;
      })()`);
      const state = () =>
        page.evaluate(`window.made.updateComplete.then(() => ({
          problem: window.made.problem,
          tabs: window.demos.part(window.made, "sl-file-tabs") !== null,
          readonly: window.demos.editor(window.made)?.readonly ?? null,
          tabSize: window.demos.editor(window.made)?.settings?.tabSize ?? null,
        }))`);
      assert.deepEqual(await state(), {
        problem: "a tab size must be from 1 to 8 columns, not 9",
        tabs: false,
        readonly: null,
        tabSize: null,
      });
      await page.evaluate(`window.made.setAttribute("tab-size", "2")`);
      assert.deepEqual(await state(), { problem: null, tabs: false, readonly: false, tabSize: 2 });
      await page.evaluate(`window.made.removeAttribute("handler")`);
      assert.deepEqual(await state(), { problem: null, tabs: true, readonly: true, tabSize: 2 });
    } finally {
      await page.close();
    }
  });
});

describe("Stop and the shared runner", () => {
  test("Stop ends spin, its demo's status saying so", async () => {
    const { page } = await open();
    try {
      const target = demo("shared", 0);
      await spin(page, target);
      assert.equal(await page.evaluate(`window.demos.status(${target})`), "Running spin…");
      await pressControl(page, target, "stop");
      await says(page, target, "Stopped spin", 5000);
      assert.deepEqual((await shown(page, target)).rows, [
        { kind: "line", text: "spin: looping until Stop" },
      ]);
    } finally {
      await page.close();
    }
  });

  test("format's Run while spin is pending stops spin, and each console holds only its own output", async () => {
    const watched = await open();
    const { page } = watched;
    try {
      const spinner = demo("shared", 0);
      const formatter = demo("shared", 1);
      await spin(page, spinner);
      await pressControl(page, formatter, "run");
      await says(page, formatter, "Finished format");
      assert.equal(await page.evaluate(`window.demos.status(${spinner})`), "Stopped spin");
      assert.deepEqual((await shown(page, spinner)).rows, [
        { kind: "line", text: "spin: looping until Stop" },
      ]);
      const format = await shown(page, formatter);
      assert.deepEqual(format.rows, [
        { kind: "line", text: "format: 4 bytes in, 8 bytes out" },
        { kind: "result", text: "Result [ 5 ]" },
      ]);
      // Format's own run: a fresh instance of the module spin held, its timings alone.
      assert.deepEqual(format.phases, ["Instantiate", "Start", "Call"]);
      // The module was reposted to the fresh worker, not fetched again; the stopped worker is gone.
      assert.deepEqual(wasmRequests(watched), ["go/probe.wasm"]);
      assert.equal(watched.workers.length, 2, `two workers: ${watched.workers}`);
      await settles(() => watched.live.size === 1, `one live worker, not ${watched.live.size}`);
      // Stop in the stopped demo, idle now, stops nothing of the other's.
      assert.equal(
        await page.evaluate(
          `window.demos.button(${spinner}, "stop").getAttribute("aria-disabled")`,
        ),
        "true",
      );
    } finally {
      await page.close();
    }
  });
});

describe("editable files", () => {
  /** Opens the form of the control, types the name, and submits it. */
  async function submit(page: Page, target: string, control: "new" | "rename", name: string) {
    await page.evaluate(`window.demos.button(${target}, ${JSON.stringify(control)}).click()`);
    const input = `window.demos.part(${target}, "sl-controls").shadowRoot.querySelector("#${control}-name")`;
    await until(page, `${input}.matches(":focus")`, 2000);
    await page.evaluate(`${input}.select()`);
    await page.cdp("Input.insertText", { text: name });
    await enter(page);
  }

  const tabs = (page: Page, target: string): Promise<string[]> =>
    page.evaluate(
      `[...window.demos.part(${target}, "sl-file-tabs").shadowRoot.querySelectorAll('[role="tab"]')]
        .map((tab) => tab.dataset.name)`,
    );

  test("New file adds and selects it, the editor focused; Rename renames it; Delete focuses the tab now active", async () => {
    const { page } = await open();
    try {
      const target = demo("editable-files");
      await submit(page, target, "new", "notes.go");
      await until(page, `window.demos.tab(${target}) === "notes.go"`, 2000);
      assert.deepEqual(await tabs(page, target), ["main.go", "notes.go"]);
      // Focus, moved on by the demo, stays where it went once the closed form's events are done.
      await settle(page);
      assert.deepEqual(await page.evaluate(`window.demos.focusPath()`), [
        "sl-go-demo",
        "sl-code-editor",
        "div.text",
      ]);
      assert.deepEqual(
        await page.evaluate(`(() => {
          const editor = window.demos.editor(${target});
          return [editor.value, editor.readonly, editor.label];
        })()`),
        ["", false, "notes.go"],
      );

      await submit(page, target, "rename", "util.go");
      await until(page, `window.demos.tab(${target}) === "util.go"`, 2000);
      assert.deepEqual(await tabs(page, target), ["main.go", "util.go"]);

      await pressControl(page, target, "delete");
      await until(page, `window.demos.tab(${target}) === "main.go"`, 2000);
      assert.deepEqual(await tabs(page, target), ["main.go"]);
      await settle(page);
      assert.deepEqual(await page.evaluate(`window.demos.focusPath()`), [
        "sl-go-demo",
        "sl-file-tabs",
        "tab[main.go]",
      ]);
      assert.equal(
        await page.evaluate(`window.demos.editor(${target}).value`),
        helloSource,
        "the editor shows main.go again",
      );
    } finally {
      await page.close();
    }
  });

  test("the last file can't be deleted: Delete unavailable, and a press removes nothing", async () => {
    const { page } = await open();
    try {
      const target = demo("editable-files");
      assert.equal(
        await page.evaluate(
          `window.demos.button(${target}, "delete").getAttribute("aria-disabled")`,
        ),
        "true",
      );
      await pressControl(page, target, "delete");
      // The demo applies a delete request for the last file as the set refuses it: nothing.
      await page.evaluate(
        `window.demos.part(${target}, "sl-controls").dispatchEvent(
          new CustomEvent("delete", { detail: { name: "main.go" }, bubbles: true }))`,
      );
      assert.deepEqual(await tabs(page, target), ["main.go"]);
    } finally {
      await page.close();
    }
  });

  test("a program demo without editable-files has no Files group", async () => {
    const { page } = await open();
    try {
      assert.equal(await page.evaluate(`window.demos.button(${demo("program")}, "new")`), null);
      assert.equal(await page.evaluate(`window.demos.button(${demo("handler")}, "new")`), null);
    } finally {
      await page.close();
    }
  });
});

describe("Reset", () => {
  test("restores an edited file as given, and Reset is available only while one is edited", async () => {
    const { page } = await open();
    try {
      const target = demo("handler");
      const given: string = await page.evaluate(`window.demos.editor(${target}).value`);
      const reset = `window.demos.button(${target}, "reset").getAttribute("aria-disabled")`;
      assert.equal(await page.evaluate(reset), "true");
      await page.evaluate(`window.demos.editor(${target}).focus()`);
      await page.cdp("Input.insertText", { text: "edited " });
      await until(page, `${reset} === "false"`, 2000);
      assert.notEqual(await page.evaluate(`window.demos.editor(${target}).value`), given);
      await pressControl(page, target, "reset");
      await until(page, `window.demos.editor(${target}).value === ${JSON.stringify(given)}`, 2000);
      assert.equal(await page.evaluate(reset), "true");
    } finally {
      await page.close();
    }
  });
});

describe("the demo in the accessibility tree", () => {
  test("a handler demo: a region named by its label, holding the toolbar, the editor, the log, and the timings", async () => {
    const { page } = await open();
    try {
      const target = demo("handler");
      const [region] = await axQuery(page, target, "region");
      assert.equal(region.name?.value, "format demo");
      assert.equal(region.description, undefined);
      const named = async (role: string) =>
        (await axQuery(page, target, role)).map((node) => node.name?.value);
      assert.deepEqual(await named("toolbar"), ["Controls"]);
      assert.deepEqual(await named("textbox"), ["input.json"]);
      assert.deepEqual(await named("log"), ["Output"]);
      assert.deepEqual(await named("table"), ["Timings"]);
      assert.deepEqual(await named("tablist"), [], "a handler demo shows no tabs");
      const [run] = await axQuery(page, `window.demos.button(${target}, "run")`, "button");
      assert.equal(property(run, "keyshortcuts"), "Control+Enter Meta+Enter");
    } finally {
      await page.close();
    }
  });

  test("a program demo: its tabs control the panel holding the read-only editor; its fence no part of the tree", async () => {
    const { page } = await open();
    try {
      const target = demo("program");
      const named = async (role: string) =>
        (await axQuery(page, target, role)).map((node) => node.name?.value);
      assert.deepEqual(await named("region"), ["hello demo"]);
      assert.deepEqual(await named("tablist"), ["Files"]);
      assert.deepEqual(await named("tab"), ["main.go"]);
      assert.deepEqual(await named("tabpanel"), ["main.go"]);
      const [textbox] = await axQuery(page, target, "textbox");
      assert.equal(textbox.name?.value, "main.go");
      assert.equal(property(textbox, "readonly"), true);
      // The fence stays in the light DOM, unrendered and out of the tree: the editor alone reads.
      const fence = `${target}.querySelector(":scope > pre")`;
      assert.equal(await page.evaluate(`${fence}.textContent`), helloSource);
      assert.equal(await page.evaluate(`${fence}.checkVisibility()`), false);
      assert.deepEqual(await axQuery(page, fence), []);
    } finally {
      await page.close();
    }
  });
});

describe("the fences", () => {
  test("a program demo's editor holds hello's source as cmd/hello/main.go has it", async () => {
    const { page } = await open();
    try {
      for (const target of [demo("program"), demo("editable-files"), demo("program", 0, 1)]) {
        assert.equal(await page.evaluate(`window.demos.editor(${target}).value`), helloSource);
      }
    } finally {
      await page.close();
    }
  });

  test("the SDK's Shiki markup reads as its text, a handler demo's input.json, and runs", async () => {
    const { page } = await open();
    try {
      const target = demo("markdown");
      const input = '{ "shiki": true, "list": [3, 1, 2] }\n';
      assert.deepEqual(
        await page.evaluate(`(() => {
          const editor = window.demos.editor(${target});
          return [editor.value, editor.label, editor.language];
        })()`),
        [input, "input.json", "json"],
      );
      await pressControl(page, target, "run");
      await says(page, target, "Finished format");
      const answer = JSON.stringify(JSON.parse(input), null, 2);
      assert.deepEqual((await shown(page, target)).rows.at(-1), {
        kind: "result",
        text: `Result ${answer.replace(/\s+/g, " ")}`,
      });
    } finally {
      await page.close();
    }
  });

  test("without script, every demo's fences show as the page's code", async () => {
    const page = await browser.open("about:blank");
    try {
      await page.cdp("Emulation.setScriptExecutionDisabled", { value: true });
      await page.goto(`${server.origin}components.html`);
      const fences = await page.evaluate(`[...document.querySelectorAll("#go-demo sl-go-demo")].map(
        (demo) => [...demo.querySelectorAll(":scope > pre")].map((pre) => [
          pre.checkVisibility(),
          pre.getBoundingClientRect().height > 0,
          pre.textContent,
        ]))`);
      // The states list and the focus state: the 20rem copy is the script's.
      assert.equal(fences.length, 10);
      for (const demoFences of fences) {
        for (const [visible, tall] of demoFences) assert.ok(visible && tall);
      }
      assert.equal(fences[1][0][2], helloSource);
      assert.equal(fences[5][0][2], '{ "shiki": true, "list": [3, 1, 2] }\n');
    } finally {
      await page.close();
    }
  });
});

describe("layout", () => {
  test("at 20rem every demo fits its column, nothing reaching past it", async () => {
    const { page } = await open();
    try {
      const overflows: string[] = await page.evaluate(`(() => {
        const narrow = document.querySelectorAll("#go-demo .states")[1];
        const limit = narrow.getBoundingClientRect().right + 0.5;
        const out = [];
        for (const demo of narrow.querySelectorAll("sl-go-demo")) {
          const parts = [demo, ...demo.shadowRoot.querySelectorAll("*")];
          for (const part of parts) {
            const box = part.getBoundingClientRect();
            if (box.width > 0 && box.right > limit) out.push(demo.label + ": " + part.localName);
          }
        }
        return out;
      })()`);
      assert.deepEqual(overflows, []);
      assert.ok(
        await page.evaluate(
          `document.querySelectorAll("#go-demo .states")[1].getBoundingClientRect().width <= 320`,
        ),
      );
    } finally {
      await page.close();
    }
  });
});
