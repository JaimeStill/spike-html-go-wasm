// sl-console on the components page, the build as Pages serves it: dist/ under the base by the
// SDK's served(), Vite's preview, in the pinned chrome-headless-shell.
//
// The accessibility tree, read through CDP: a log named Output whose live setting is off, so no
// write is announced, holding stderr's cue as "stderr: ", an exit's words, and a result's head,
// with Copy and Clear named and their hints out of the tree; Copy's confirmation the only live
// region. Rendering: entries in arrival order, partial lines joined, Go's line breaks and blank
// lines kept, long lines wrapped, ANSI escapes shown as text; stderr's cue seen and its text
// readable on its tint in every palette and scheme; exits and results told apart beyond color; the
// limit's 10,000 rows and the count dropped, the rows' hidden cues held inside the frame, not the
// page. Following: the tail followed, held once the reader scrolls up by the keyboard, followed
// again at the end. Copy puts the log's text on the clipboard and confirms it; Clear sends a
// request, and nothing changes until the owner applies it.
// Throughput: 10,000 writes, each its own task, render in a few frames, never one render a write.
// The console listens only to the log it holds, only while in the document; focus shows, and
// nothing moves. Nothing here names the site: its base is package.json's name.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch, SETTLED, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

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

/** The page's helpers, installed on window.consoles once the page has loaded:
 *
 * - figure(state, list): the figure data-state names in the states list of #console, or in its
 *   .focus when list is "focus"; at(state, list) its sl-console.
 * - frame(console): its scrolling log.
 * - rendered(console): resolves once a frame has passed and the update it asked for is done, so a
 *   change made before it shows.
 * - rows(console): each row as it renders: its kind (the row's class), its stream or whether it
 *   went well, its text, the cue's text seen, and the text said.
 * - loose(log): a console of the log, in the "empty" figure, with no owner applying its requests,
 *   which it records in console.requests, each whether it bubbles and is composed.
 * - counted(log): the log, its change listeners counted in log.listeners as consoles add and
 *   remove them.
 * - renders(console): counts the console's renders from then on in console.renders.
 */
const HELPERS = `(() => {
  const scope = (list) =>
    document.querySelector("#console")
      .querySelectorAll(list === "focus" ? ".focus" : ".states")[list === "focus" ? 0 : (list ?? 0)];
  const figure = (state, list) => scope(list).querySelector(\`figure[data-state="\${state}"]\`);
  const frame = (console) => console.shadowRoot.querySelector(".frame");
  window.consoles = {
    figure,
    frame,
    at: (state, list) => figure(state, list).querySelector("sl-console"),
    rendered: (console) =>
      new Promise((resolve) => requestAnimationFrame(resolve)).then(() => console.updateComplete),
    rows(console) {
      return [...console.shadowRoot.querySelectorAll(".lines > *")].map((row) => ({
        kind: row.className,
        stream: row.dataset.stream ?? null,
        ok: row.dataset.ok ?? null,
        seen: row.querySelector(".cue .seen")?.textContent ?? null,
        // The row's text, without the cue's, the glyphs' white space, or Lit's comment markers.
        text: [...row.childNodes]
          .filter((node) => node.nodeType !== Node.COMMENT_NODE)
          .filter((node) => !(node instanceof Element && node.matches(".cue, svg")))
          .map((node) => node.textContent)
          .join(""),
      }));
    },
    loose(log) {
      const console = document.createElement("sl-console");
      console.log = log;
      console.requests = [];
      console.addEventListener("clear", (event) =>
        console.requests.push({ bubbles: event.bubbles, composed: event.composed }));
      figure("empty").append(console);
      return console;
    },
    counted(log) {
      log.listeners = 0;
      const add = log.addEventListener.bind(log);
      const remove = log.removeEventListener.bind(log);
      log.addEventListener = (type, listener) => {
        if (type === "change") log.listeners++;
        add(type, listener);
      };
      log.removeEventListener = (type, listener) => {
        if (type === "change") log.listeners--;
        remove(type, listener);
      };
      return log;
    },
    renders(console) {
      console.renders = 0;
      const update = console.update;
      console.update = function (changed) {
        console.renders++;
        return update.call(this, changed);
      };
    },
    ConsoleLog: figure("empty").querySelector("sl-console").log.constructor,
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

/** A row as it renders. */
interface Row {
  kind: string;
  stream: string | null;
  ok: string | null;
  seen: string | null;
  text: string;
}

/** The rows of the console the expression gives, once its pending render is done. */
const rows = async (page: Page, console: string): Promise<Row[]> =>
  page.evaluate(
    `window.consoles.rendered(${console}).then(() => window.consoles.rows(${console}))`,
  );

/** An output row as it renders. */
const line = (stream: "stdout" | "stderr", text: string): Row => ({
  kind: "line",
  stream,
  ok: null,
  seen: stream === "stderr" ? "err" : null,
  text,
});

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

/** The text the accessibility tree holds under the element the expression gives: its static
 * text nodes' names, in order. */
async function said(page: Page, expression: string): Promise<string[]> {
  return (await axQuery(page, expression, "StaticText")).map((node) => node.name?.value ?? "");
}

describe("the console in the accessibility tree", () => {
  test("a log named Output, live off, holding the lines; Copy and Clear named, their hints out of the tree", async () => {
    const page = await open();
    try {
      const figure = `window.consoles.figure("exit-fail")`;
      const logs = await axQuery(page, figure, "log");
      assert.equal(logs.length, 1);
      assert.equal(logs[0].name?.value, "Output");
      assert.equal(
        await page.evaluate(`window.consoles.frame(window.consoles.at("exit-fail")).ariaLive`),
        "off",
      );
      assert.equal(property(logs[0], "live"), undefined, "the log is no live region");
      const buttons = await axQuery(page, figure, "button");
      assert.deepEqual(
        buttons.map((node) => ({ name: node.name?.value, description: node.description?.value })),
        [
          { name: "Copy", description: undefined },
          { name: "Clear", description: undefined },
        ],
      );
      const hints = await axQuery(page, figure, "tooltip");
      assert.deepEqual(hints, [], "the hints are hidden from the tree");
    } finally {
      await page.close();
    }
  });

  test("stderr's cue is said, err seen as stderr; an exit's and a result's words are said", async () => {
    const page = await open();
    try {
      const log = (state: string) => `window.consoles.frame(window.consoles.at("${state}"))`;
      const text = (await said(page, log("mixed"))).join("|");
      assert.match(text, /^loading config…\|stderr:\|warning: no cache, building from source\|/);
      assert.ok(!text.includes("|err|"), "the seen cue isn't said again");
      assert.match((await said(page, log("exit-fail"))).join("|"), /\|crash exited with code 2$/);
      assert.match(
        (await said(page, log("result-error"))).join("|"),
        /\|Error\|input\.go:3:1: expected declaration, found '}'$/,
      );
    } finally {
      await page.close();
    }
  });

  test("no write is announced: the only live region is Copy's status, and a write changes nothing in it", async () => {
    const page = await open();
    try {
      const console = `window.consoles.at("exit-ok")`;
      const live: { role: string | null; live: string | null }[] = await page.evaluate(`(() => {
        const all = [...${console}.shadowRoot.querySelectorAll("*")];
        return all
          .filter((e) => e.matches('[aria-live], [role="status"], [role="alert"], [role="log"], output'))
          .map((e) => ({ role: e.getAttribute("role"), live: e.getAttribute("aria-live") }));
      })()`);
      assert.deepEqual(live, [
        { role: "status", live: null },
        { role: "log", live: "off" },
      ]);
      await page.evaluate(`${console}.log.output({ stream: "stdout", text: "more\\n" })`);
      await rows(page, console);
      assert.equal(
        await page.evaluate(`${console}.shadowRoot.querySelector('[role="status"]').textContent`),
        "",
      );
    } finally {
      await page.close();
    }
  });
});

describe("the console's rendering", () => {
  test("entries show in arrival order, partial lines joined, line breaks and blank lines kept", async () => {
    const page = await open();
    try {
      assert.deepEqual(await rows(page, `window.consoles.at("mixed")`), [
        line("stdout", "loading config…"),
        line("stderr", "warning: no cache, building from source"),
        line("stdout", "step 1 of 3"),
        line("stdout", "step 2 of 3"),
        line("stderr", "warning: slow disk"),
        line("stdout", "step 3 of 3"),
        line("stdout", ""),
        line("stdout", "done"),
      ]);
      const blank: number = await page.evaluate(
        `window.consoles.at("mixed").shadowRoot.querySelectorAll(".line")[6].getBoundingClientRect().height`,
      );
      assert.ok(blank > 0, "a blank line keeps its height");
    } finally {
      await page.close();
    }
  });

  test("a stream's write continues its open line in place, and the other stream's starts a line of its own", async () => {
    const page = await open();
    try {
      const console = `window.consoles.loose(new window.consoles.ConsoleLog())`;
      await page.evaluate(`void (window.loose = ${console})`);
      await page.evaluate(`window.loose.log.output({ stream: "stdout", text: "50" })`);
      assert.deepEqual(await rows(page, "window.loose"), [line("stdout", "50")]);
      await page.evaluate(`window.loose.log.output({ stream: "stdout", text: "%" })`);
      assert.deepEqual(await rows(page, "window.loose"), [line("stdout", "50%")]);
      await page.evaluate(`window.loose.log.output({ stream: "stderr", text: "!" })`);
      await page.evaluate(`window.loose.log.output({ stream: "stdout", text: " done\\n" })`);
      assert.deepEqual(await rows(page, "window.loose"), [
        line("stdout", "50%"),
        line("stderr", "!"),
        line("stdout", " done"),
      ]);
    } finally {
      await page.close();
    }
  });

  test("ANSI escapes and other control characters show as text, and the log keeps them as written", async () => {
    const page = await open();
    try {
      const shown = await rows(page, `window.consoles.at("ansi")`);
      assert.deepEqual(
        shown.map((row) => row.text),
        ["␛[1;32mPASS␛[0m TestSum (0.00s)", "␛[31mFAIL␛[0m TestParse"],
      );
      assert.equal(
        await page.evaluate(`window.consoles.at("ansi").log.text()`),
        "\u001b[1;32mPASS\u001b[0m TestSum (0.00s)\n\u001b[31mFAIL\u001b[0m TestParse",
      );
    } finally {
      await page.close();
    }
  });

  test("at a phone's width a long line wraps, and nothing scrolls sideways", async () => {
    const page = await open();
    try {
      await viewport(page, PHONE);
      const wrap: { tall: boolean; sideways: boolean; width: number; figure: number } =
        await page.evaluate(`(() => {
          const console = window.consoles.at("long");
          const frame = window.consoles.frame(console);
          const row = frame.querySelector(".line");
          return {
            tall: row.getBoundingClientRect().height > parseFloat(getComputedStyle(row).lineHeight) * 1.5,
            sideways: frame.scrollWidth > frame.clientWidth,
            width: console.getBoundingClientRect().width,
            figure: console.parentElement.getBoundingClientRect().width,
          };
        })()`);
      assert.ok(wrap.tall, "the line wraps onto more rows");
      assert.equal(wrap.sideways, false);
      assert.ok(wrap.width <= wrap.figure, "the console is no wider than its figure");
    } finally {
      await page.close();
    }
  });

  test("stderr's cue is seen in its gutter and its line tinted; stdout has neither", async () => {
    const page = await open();
    try {
      const look: { cue: number; hidden: string; stdout: string; stderr: string; rule: string } =
        await page.evaluate(`(() => {
          const root = window.consoles.at("mixed").shadowRoot;
          const [out, err] = root.querySelectorAll(".line");
          const cue = err.querySelector(".cue .seen");
          return {
            cue: cue.getBoundingClientRect().width,
            hidden: cue.getAttribute("aria-hidden"),
            stdout: getComputedStyle(out).backgroundColor,
            stderr: getComputedStyle(err).backgroundColor,
            rule: getComputedStyle(err).borderInlineStartStyle,
            outCue: out.querySelector(".cue"),
          };
        })()`);
      assert.ok(look.cue > 0, "the cue shows");
      assert.equal(look.hidden, "true", "the seen cue isn't said; the hidden one is");
      assert.notEqual(look.stderr, look.stdout, "stderr has its own color");
      assert.equal(look.rule, "solid");
    } finally {
      await page.close();
    }
  });

  test("stderr's text, and an error's, holds 4.5:1 on its tint, in every palette and scheme", async () => {
    const page = await open();
    try {
      const palettes: string[] = await page.evaluate(
        `[...(globalThis[Symbol.for("spike-html-apps-foundation.registry")]?.color ?? [])]`,
      );
      assert.ok(palettes.length >= 4);
      for (const scheme of ["light", "dark"]) {
        for (const palette of palettes) {
          const ratios: number[] = await page.evaluate(`(() => {
            const root = document.documentElement;
            root.setAttribute("data-palette", ${JSON.stringify(palette)});
            root.setAttribute("data-scheme", ${JSON.stringify(scheme)});
            // Each color as the canvas paints it, so any color syntax resolves to sRGB bytes.
            const canvas = new OffscreenCanvas(1, 1);
            const context = canvas.getContext("2d", { willReadFrequently: true });
            const rgb = (color) => {
              context.clearRect(0, 0, 1, 1);
              context.fillStyle = color;
              context.fillRect(0, 0, 1, 1);
              return [...context.getImageData(0, 0, 1, 1).data.slice(0, 3)].map((c) => c / 255);
            };
            const luminance = (color) => {
              const [r, g, b] = rgb(color).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
              return 0.2126 * r + 0.7152 * g + 0.0722 * b;
            };
            const ratio = (a, b) => {
              const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
              return (x + 0.05) / (y + 0.05);
            };
            const err = window.consoles.at("mixed").shadowRoot.querySelectorAll(".line")[1];
            const error = window.consoles.at("result-error").shadowRoot.querySelector(".result");
            const body = error.querySelector(".body");
            return [
              ratio(getComputedStyle(err).color, getComputedStyle(err).backgroundColor),
              ratio(getComputedStyle(err.querySelector(".cue")).color, getComputedStyle(err).backgroundColor),
              ratio(getComputedStyle(body).color, getComputedStyle(error).backgroundColor),
            ];
          })()`);
          for (const [i, what] of ["stderr's text", "its cue", "an error's text"].entries()) {
            assert.ok(
              ratios[i] >= 4.5,
              `${what} in ${palette} ${scheme}: ${ratios[i].toFixed(2)}:1`,
            );
          }
        }
      }
    } finally {
      await page.close();
    }
  });
});

describe("exits and results", () => {
  test("an exit is a status line naming the scenario and its code, 0 and nonzero told apart by words and glyph", async () => {
    const page = await open();
    try {
      const ok = await rows(page, `window.consoles.at("exit-ok")`);
      assert.deepEqual(ok.at(-1), {
        kind: "exit",
        stream: null,
        ok: "true",
        seen: null,
        text: "hello exited with code 0",
      });
      const failed = await rows(page, `window.consoles.at("exit-fail")`);
      assert.deepEqual(failed.at(-1), {
        kind: "exit",
        stream: null,
        ok: "false",
        seen: null,
        text: "crash exited with code 2",
      });
      // The panic's lines before it, its blank line and tab kept.
      assert.deepEqual(
        failed.slice(0, 5).map((row) => row.text),
        [
          "panic: runtime error: index out of range [3] with length 3",
          "",
          "goroutine 1 [running]:",
          "main.main()",
          "\t/src/crash/main.go:12 +0x1d",
        ],
      );
      const glyphs: string[] = await page.evaluate(
        `["exit-ok", "exit-fail"].map((state) => window.consoles.at(state).shadowRoot.querySelector(".exit path").getAttribute("d"))`,
      );
      assert.notEqual(glyphs[0], glyphs[1], "a tick for 0, a cross for any other");
    } finally {
      await page.close();
    }
  });

  test("a result is a block of its own, headed Result or Error, its text whole", async () => {
    const page = await open();
    try {
      const block = (state: string) =>
        page.evaluate(`(() => {
          const block = window.consoles.at("${state}").shadowRoot.querySelector(".result");
          return {
            ok: block.dataset.ok,
            head: block.querySelector(".head").textContent.trim(),
            body: block.querySelector(".body").textContent,
            glyph: block.querySelector(".head path").getAttribute("d"),
          };
        })()`);
      const answer = await block("result-ok");
      const error = await block("result-error");
      assert.deepEqual(
        { ok: answer.ok, head: answer.head, body: answer.body },
        {
          ok: "true",
          head: "Result",
          body: '{\n  "formatted": "package main\\n",\n  "changed": true\n}',
        },
      );
      assert.deepEqual(
        { ok: error.ok, head: error.head, body: error.body },
        { ok: "false", head: "Error", body: "input.go:3:1: expected declaration, found '}'" },
      );
      assert.notEqual(answer.glyph, error.glyph);
      assert.deepEqual(
        (await rows(page, `window.consoles.at("result-error")`)).map((row) => row.kind),
        ["line", "result"],
        "the result follows the output before it",
      );
    } finally {
      await page.close();
    }
  });
});

describe("the limit", () => {
  test("a log past its limit shows its latest 10,000 lines and the count dropped, which describes the log", async () => {
    const page = await open();
    try {
      const console = `window.consoles.at("capped")`;
      const shown = await rows(page, console);
      assert.equal(shown.length, 10_000);
      assert.equal(shown[0].text, "step 501");
      assert.equal(shown.at(-1)?.text, "step 10500");
      assert.equal(
        await page.evaluate(`${console}.shadowRoot.querySelector(".dropped").textContent`),
        "500 earlier lines dropped",
      );
      const [log] = await axQuery(page, `window.consoles.figure("capped")`, "log");
      assert.equal(log.description?.value, "500 earlier lines dropped");
      // Another write drops one more, its row gone from the front.
      await page.evaluate(`${console}.log.output({ stream: "stdout", text: "step 10501\\n" })`);
      const next = await rows(page, console);
      assert.equal(next.length, 10_000);
      assert.equal(next[0].text, "step 502");
      assert.equal(next.at(-1)?.text, "step 10501");
      assert.equal(
        await page.evaluate(`${console}.shadowRoot.querySelector(".dropped").textContent`),
        "501 earlier lines dropped",
      );
    } finally {
      await page.close();
    }
  });

  test("a log past its limit stays inside its frame: its hidden stderr cues grow the page no taller", async () => {
    const page = await open();
    try {
      // The page's scroll height against the height of its root's box, which holds the body's
      // content: a cue outside the frame's scroller would reach below it, by the log's height.
      const { scroll, box } = await page.evaluate(`(() => ({
        scroll: document.documentElement.scrollHeight,
        box: document.documentElement.getBoundingClientRect().height,
      }))()`);
      assert.ok(scroll <= Math.ceil(box), `the page scrolls ${scroll}px, its content ${box}px`);
    } finally {
      await page.close();
    }
  });

  test("with nothing dropped, no count shows and nothing describes the log", async () => {
    const page = await open();
    try {
      const console = `window.consoles.at("mixed")`;
      assert.equal(
        await page.evaluate(`${console}.shadowRoot.querySelector(".dropped").checkVisibility()`),
        false,
      );
      const [log] = await axQuery(page, `window.consoles.figure("mixed")`, "log");
      assert.equal(log.description?.value ?? "", "");
    } finally {
      await page.close();
    }
  });

  test("an empty log says so, and its buttons are unavailable but focusable", async () => {
    const page = await open();
    try {
      const empty: {
        shown: boolean;
        text: string;
        disabled: (string | null)[];
        focusable: boolean[];
      } = await page.evaluate(`(() => {
          const root = window.consoles.at("empty").shadowRoot;
          const note = root.querySelector(".empty");
          const buttons = [...root.querySelectorAll("button")];
          return {
            shown: note.checkVisibility(),
            text: note.textContent,
            disabled: buttons.map((b) => b.getAttribute("aria-disabled")),
            focusable: buttons.map((b) => !b.disabled),
          };
        })()`);
      assert.deepEqual(empty, {
        shown: true,
        text: "No output yet.",
        disabled: ["true", "true"],
        focusable: [true, true],
      });
      assert.deepEqual(await said(page, `window.consoles.figure("empty")`), [
        "Empty",
        "No output yet.",
      ]);
      assert.equal(
        await page.evaluate(
          `window.consoles.at("mixed").shadowRoot.querySelector(".empty").checkVisibility()`,
        ),
        false,
      );
    } finally {
      await page.close();
    }
  });
});

describe("following the tail", () => {
  test("follows new lines, holds once the reader scrolls up by the keyboard, and follows again from the end", async () => {
    const page = await focused();
    try {
      await page.evaluate(`(() => {
        const log = new window.consoles.ConsoleLog();
        for (let i = 0; i < 100; i++) log.output({ stream: "stdout", text: \`line \${i}\\n\` });
        window.loose = window.consoles.loose(log);
      })()`);
      await rows(page, "window.loose");
      const position = () =>
        page.evaluate(`window.consoles.rendered(window.loose).then(() => {
          const frame = window.consoles.frame(window.loose);
          return { top: frame.scrollTop, end: frame.scrollHeight - frame.clientHeight };
        })`);
      // The browser animates a keyboard scroll: it is read once the log has stopped moving, its
      // position the same over five frames, within 5 s.
      const still = () =>
        page.evaluate(`new Promise((resolve, reject) => {
          const frame = window.consoles.frame(window.loose);
          const deadline = performance.now() + 5000;
          let last = -1;
          let same = 0;
          const check = () => {
            same = frame.scrollTop === last ? same + 1 : 0;
            last = frame.scrollTop;
            if (same >= 5) resolve();
            else if (performance.now() > deadline) reject(new Error("the log never stopped scrolling"));
            else requestAnimationFrame(check);
          };
          requestAnimationFrame(check);
        })`);
      const write = (text: string) =>
        page.evaluate(
          `window.loose.log.output({ stream: "stdout", text: ${JSON.stringify(text)} })`,
        );
      let at = await position();
      assert.ok(at.end > 0, "the log overflows its frame");
      assert.ok(Math.abs(at.top - at.end) <= 2, "it opens at its tail");
      await write("more\n");
      at = await position();
      assert.ok(Math.abs(at.top - at.end) <= 2, "it follows a new line");
      // The reader scrolls up, by the keyboard, from the focused log.
      await page.evaluate(`window.consoles.frame(window.loose).focus()`);
      await press(page, "Home", "Home", 36);
      await still();
      assert.equal((await position()).top, 0, "Home scrolls to the start");
      await write("held\n");
      at = await position();
      assert.equal(at.top, 0, "scrolled up, it holds the reader's place");
      await press(page, "PageDown", "PageDown", 34);
      await still();
      const paged = (await position()).top;
      assert.ok(paged > 0 && paged < at.end - 2, "Page Down scrolls, short of the end");
      await write("still held\n");
      assert.equal((await position()).top, paged, "short of the end, it still holds");
      // Back at the end, it follows again.
      await press(page, "End", "End", 35);
      await still();
      await write("followed\n");
      at = await position();
      assert.ok(Math.abs(at.top - at.end) <= 2, "back at the end, it follows");
    } finally {
      await page.close();
    }
  });

  test("the stream specimen writes nothing until its button is pressed, then streams, the console following", async () => {
    const page = await open();
    try {
      const console = `window.consoles.at("stream")`;
      const button = `window.consoles.figure("stream").querySelector(".readout button")`;
      await new Promise((resolve) => setTimeout(resolve, 400));
      assert.equal(await page.evaluate(`${console}.log.size`), 0, "nothing streams on its own");
      await page.evaluate(`${button}.click()`);
      await until(page, `${console}.log.size >= 3`);
      await page.evaluate(`${button}.click()`);
      assert.equal(await page.evaluate(`${button}.textContent`), "Start streaming");
      const size = await page.evaluate(`${console}.log.size`);
      await new Promise((resolve) => setTimeout(resolve, 400));
      assert.equal(await page.evaluate(`${console}.log.size`), size, "stopped, it writes no more");
    } finally {
      await page.close();
    }
  });
});

describe("Copy and Clear", () => {
  test("Copy puts the log's text on the clipboard and confirms it, politely, for a moment", async () => {
    const page = await focused();
    try {
      await page.cdp("Browser.grantPermissions", {
        origin: new URL(server.origin).origin,
        permissions: ["clipboardReadWrite", "clipboardSanitizedWrite"],
      });
      const console = `window.consoles.at("exit-fail")`;
      const status = `${console}.shadowRoot.querySelector('[role="status"]').textContent`;
      await click(page, `${console}.shadowRoot.querySelector('[aria-label="Copy"]')`);
      await until(page, `${status} === "Copied"`);
      assert.equal(
        await page.evaluate(`navigator.clipboard.readText()`),
        await page.evaluate(`${console}.log.text()`),
      );
      assert.match(await page.evaluate(`navigator.clipboard.readText()`), /^panic: runtime error/);
      await until(page, `${status} === ""`, 4000);
    } finally {
      await page.close();
    }
  });

  test("Clear sends a request, and nothing changes until the owner applies it", async () => {
    const page = await open();
    try {
      await page.evaluate(`(() => {
        const log = new window.consoles.ConsoleLog();
        log.output({ stream: "stdout", text: "kept\\n" });
        log.changes = 0;
        log.addEventListener("change", () => log.changes++);
        window.loose = window.consoles.loose(log);
      })()`);
      await rows(page, "window.loose");
      await page.evaluate(`window.loose.shadowRoot.querySelector('[aria-label="Clear"]').click()`);
      assert.deepEqual(await page.evaluate(`window.loose.requests`), [
        { bubbles: true, composed: false },
      ]);
      assert.deepEqual(await rows(page, "window.loose"), [line("stdout", "kept")]);
      assert.equal(await page.evaluate(`window.loose.log.changes`), 0, "the console wrote nothing");
      // The owner applies it.
      await page.evaluate(`window.loose.log.clear()`);
      assert.deepEqual(await rows(page, "window.loose"), []);
      assert.equal(
        await page.evaluate(`window.loose.shadowRoot.querySelector(".empty").checkVisibility()`),
        true,
      );
      // Empty, Clear sends nothing more.
      await page.evaluate(`window.loose.shadowRoot.querySelector('[aria-label="Clear"]').click()`);
      assert.equal(await page.evaluate(`window.loose.requests.length`), 1);
      // On the page, the owner applies it at once.
      const owned = `window.consoles.at("mixed")`;
      await page.evaluate(`${owned}.shadowRoot.querySelector('[aria-label="Clear"]').click()`);
      assert.deepEqual(await rows(page, owned), []);
      assert.equal(await page.evaluate(`${owned}.log.size`), 0);
    } finally {
      await page.close();
    }
  });
});

describe("throughput", () => {
  test("10,000 writes, each its own task, render in a few frames, never a render a write", async () => {
    const page = await open();
    try {
      const result: { took: number; renders: number; rows: number; last: string } =
        await page.evaluate(`(async () => {
          const log = new window.consoles.ConsoleLog();
          const console = window.consoles.loose(log);
          await console.updateComplete;
          window.consoles.renders(console);
          const start = performance.now();
          // Each write a message of its own, posted at once, as a worker posts a chatty
          // program's output events without waiting on the page.
          const channel = new MessageChannel();
          let i = 0;
          await new Promise((resolve) => {
            channel.port1.onmessage = () => {
              log.output({ stream: i % 10 ? "stdout" : "stderr", text: \`write \${i}\\n\` });
              i++;
              if (i === 10000) resolve();
            };
            for (let n = 0; n < 10000; n++) channel.port2.postMessage(0);
          });
          await window.consoles.rendered(console);
          const took = performance.now() - start;
          const rows = window.consoles.rows(console);
          return { took, renders: console.renders, rows: rows.length, last: rows.at(-1).text };
        })()`);
      assert.equal(result.rows, 10_000);
      assert.equal(result.last, "write 9999");
      assert.ok(result.renders < 100, `${result.renders} renders for 10,000 writes`);
      assert.ok(result.took < 2000, `took ${result.took.toFixed(0)} ms, ${result.renders} renders`);
    } finally {
      await page.close();
    }
  });

  test("writes within one task render once", async () => {
    const page = await open();
    try {
      const renders: number = await page.evaluate(`(async () => {
        const log = new window.consoles.ConsoleLog();
        const console = window.consoles.loose(log);
        await console.updateComplete;
        window.consoles.renders(console);
        for (let i = 0; i < 10000; i++) log.output({ stream: "stdout", text: \`\${i}\\n\` });
        await window.consoles.rendered(console);
        return console.renders;
      })()`);
      assert.equal(renders, 1);
    } finally {
      await page.close();
    }
  });
});

describe("the console's subscription", () => {
  test("it listens only to the log it holds, only while in the document", async () => {
    const page = await open();
    try {
      await page.evaluate(`(() => {
        window.a = window.consoles.counted(new window.consoles.ConsoleLog());
        window.b = window.consoles.counted(new window.consoles.ConsoleLog());
        window.a.output({ stream: "stdout", text: "a\\n" });
        window.b.output({ stream: "stderr", text: "b\\n" });
        window.held = document.createElement("sl-console");
        window.held.log = window.a;
      })()`);
      const counts = () =>
        page.evaluate(
          `window.held.updateComplete.then(() => [window.a.listeners, window.b.listeners])`,
        );
      assert.deepEqual(
        await page.evaluate(`[window.a.listeners, window.b.listeners]`),
        [0, 0],
        "never in the document, it listens to none",
      );
      await page.evaluate(`window.consoles.figure("empty").append(window.held)`);
      assert.deepEqual(await counts(), [1, 0], "in the document, it listens to the log it holds");
      await page.evaluate(`window.held.remove()`);
      assert.deepEqual(await counts(), [0, 0], "removed, it stops");
      await page.evaluate(`window.a.output({ stream: "stdout", text: "while out\\n" })`);
      await page.evaluate(`window.consoles.figure("empty").append(window.held)`);
      assert.deepEqual(await counts(), [1, 0]);
      assert.deepEqual(await rows(page, "window.held"), [
        line("stdout", "a"),
        line("stdout", "while out"),
      ]);
      await page.evaluate(`window.held.log = window.b`);
      assert.deepEqual(await counts(), [0, 1], "replaced, it leaves the old log for the new");
      assert.deepEqual(await rows(page, "window.held"), [line("stderr", "b")]);
      await page.evaluate(`window.held.log = null`);
      assert.deepEqual(await counts(), [0, 0]);
      assert.deepEqual(await rows(page, "window.held"), []);
    } finally {
      await page.close();
    }
  });
});

describe("focus and motion", () => {
  test("Tab from the section's focus mark reaches Copy and Clear, then the log, which shows the focus outline", async () => {
    const page = await focused();
    try {
      await page.evaluate(`document.querySelector("#console [data-focus-start]").focus()`);
      await press(page, "Tab", "Tab", 9);
      const where = () =>
        page.evaluate(`(() => {
          const active = window.consoles.at("focus", "focus").shadowRoot.activeElement;
          const style = active && getComputedStyle(active);
          return {
            role: active?.getAttribute("role") ?? null,
            name: active?.getAttribute("aria-label") ?? null,
            outline: style?.outlineStyle ?? "",
            width: parseFloat(style?.outlineWidth ?? "0"),
          };
        })()`);
      assert.equal((await where()).name, "Copy");
      await press(page, "Tab", "Tab", 9);
      assert.equal((await where()).name, "Clear");
      await press(page, "Tab", "Tab", 9);
      const log = await where();
      assert.equal(log.role, "log");
      assert.equal(log.outline, "solid");
      assert.ok(log.width > 0);
    } finally {
      await page.close();
    }
  });

  test("nothing moves, with motion allowed or reduced", async () => {
    const page = await open();
    try {
      for (const value of ["no-preference", "reduce"]) {
        await page.cdp("Emulation.setEmulatedMedia", {
          features: [{ name: "prefers-reduced-motion", value }],
        });
        const moving: string[] = await page.evaluate(`(() => {
          const root = window.consoles.at("exit-fail").shadowRoot;
          return [...root.querySelectorAll("*")].filter((element) => {
            const style = getComputedStyle(element);
            return style.animationName !== "none" || style.scrollBehavior !== "auto" ||
              style.transitionDuration.split(",").some((d) => parseFloat(d) > 0);
          }).map((element) => element.className);
        })()`);
        assert.deepEqual(moving, [], value);
      }
    } finally {
      await page.close();
    }
  });
});
