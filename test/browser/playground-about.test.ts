// The playground's prose and its About dialog, playground.html: the build as Pages serves it,
// dist/ under the base by the SDK's served(), Vite's preview, in the pinned chrome-headless-shell.
//
// The prose is the title row, the heading and the Program select's label beside it, and the lede
// alone, the lede's text as approved, Ctrl+Enter in a kbd, and the page holds no disclosure; the
// select itself is playground-programs.test.ts's. The header's group is About, Help, and Settings, in that
// order: About a glyph button in the shell's pattern, its glyph the icons layer's info-16, its key
// A shown in a kbd, its hint "About". A, a click, or Enter on About opens the dialog, its title
// heading focused and its Close's hint closed past the interest delay; Tab moves focus to Close;
// Escape, or Close, closes it, focus back where it was before it opened. A typed into the editor
// types and opens nothing. In the accessibility tree the button is named About and the dialog
// "About the playground", modal. The dialog holds, after its header row, the three paragraphs
// approved with the brief, then what a Run downloads, then the link to the spike's question and
// evidence, the index, in that order and in those words. The SDK's shell checks hold the button
// and the dialog to the components' shortcut dialog pattern, and Help's list to the page's
// bindings, A's among them (site.test.ts). Every wait is bounded.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch, SETTLED, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import infoIcon from "@jaimestill/spike-html-hosting-icons/octicon/info-16";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import { axQuery, press, property } from "./playground-layouts.ts";

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

/** Opens the playground, settled. */
async function open(): Promise<Page> {
  const page = await browser.open(`${server.origin}playground.html`);
  await page.evaluate(SETTLED);
  return page;
}

/** The About button. */
const ABOUT = `document.querySelector("body > header button[commandfor=about]")`;

/** The About dialog is open, modal. */
const OPEN = `document.getElementById("about").matches(":modal")`;

/** The dialog's title heading. */
const TITLE = `document.getElementById("about-title")`;

/** The lede, as approved, its kbd's text in place. */
const LEDE =
  "Edit the Go below and press Run (Ctrl+Enter). Go's own compiler and linker build it right " +
  "here in your browser.";

/** The dialog's content after its header row, each block's text, in order: the three paragraphs
 * approved with the brief, what a Run downloads, and the link. */
const ABOUT_TEXT = [
  "Your .go files build together as one main package, using only the standard library. There's " +
    "no go.mod, no other packages of your own, no cgo or assembly, and nothing passed in as " +
    "arguments or standard input.",
  'Any other file you add sits next to your program, so os.ReadFile("input.txt") will find it. ' +
    "Each Run starts fresh from your files, so anything the program writes is gone by the next one.",
  "Press Ctrl+Enter (Cmd+Enter on a Mac) to run, and Stop to cancel. The compiler stays loaded " +
    "after a Stop, so the next Run is quick. Your edits live only in this tab: reload, and you're " +
    "back to where you started.",
  "The first Run downloads the compiler, the linker, and the standard-library packages your " +
    "program imports; later Runs download only what a new import adds.",
  "The spike's question and evidence",
];

/** A, pressed and released on the focused element, as a reader types it. */
async function pressA(page: Page): Promise<void> {
  for (const type of ["keyDown", "keyUp"]) {
    await page.cdp("Input.dispatchKeyEvent", {
      type,
      key: "a",
      code: "KeyA",
      windowsVirtualKeyCode: 65,
      ...(type === "keyDown" ? { text: "a" } : {}),
    });
  }
}

/** Waits for the dialog to open, then past its toggle event, a task after the open. */
async function opened(page: Page, how: string): Promise<void> {
  await until(page, OPEN, 5000).catch(() => assert.fail(`${how} opens About`));
  await page.evaluate(SETTLED);
}

/** Waits for the dialog to close, then past its close event, and answers whether focus is back on
 * the element marked as focused before it opened. */
async function closed(page: Page, how: string): Promise<boolean> {
  await until(page, `!${OPEN}`, 5000).catch(() => assert.fail(`${how} closes About`));
  await page.evaluate(SETTLED);
  return page.evaluate(`document.activeElement === globalThis.aboutOpenedFrom`);
}

describe("the playground's prose and About", () => {
  test("the prose is the title row, the heading and the Program select's label, and the lede alone, Ctrl+Enter in a kbd, and the page holds no disclosure", async () => {
    const page = await open();
    try {
      const prose: {
        children: string[];
        title: string[];
        lede: string;
        kbd: string[];
        details: number;
      } = await page.evaluate(`(() => {
          const prose = document.querySelector("main > .prose");
          const lede = prose.querySelector(":scope > p");
          const said = (element) => element.textContent.replace(/\\s+/g, " ").trim();
          return {
            children: [...prose.children].map((child) => child.localName + "." + child.className),
            title: [...prose.querySelector(":scope > .title").children].map((child) =>
              child.localName + ": " + (child.localName === "h1" ? said(child) : said(child.firstChild))),
            lede: said(lede),
            kbd: [...lede.querySelectorAll("kbd")].map((kbd) => kbd.textContent),
            details: document.querySelectorAll("details").length,
          };
        })()`);
      assert.deepEqual(prose, {
        children: ["div.title", "p."],
        title: ["h1: Playground", "label: Program"],
        lede: LEDE,
        kbd: ["Ctrl+Enter"],
        details: 0,
      });
    } finally {
      await page.close();
    }
  });

  test("About leads the header's group, a glyph button of info-16 showing A, its hint About", async () => {
    const page = await open();
    try {
      const header: {
        names: string[];
        glyph: string;
        kbd: string;
        hint: string;
      } = await page.evaluate(`(() => {
          const about = ${ABOUT};
          const glyph = about.querySelector("svg").cloneNode(true);
          glyph.removeAttribute("class");
          return {
            names: [...document.querySelectorAll("body > header .header-actions > button")]
              .map((button) => button.getAttribute("aria-label")),
            glyph: glyph.outerHTML,
            kbd: [...about.querySelectorAll("kbd")].map((kbd) => kbd.textContent).join(" "),
            hint: document.getElementById(about.getAttribute("interestfor")).textContent.trim(),
          };
        })()`);
      // The icons module's svg as the page's parser serializes it.
      const icon: string = await page.evaluate(`(() => {
        const template = document.createElement("template");
        template.innerHTML = ${JSON.stringify(infoIcon)};
        return template.content.firstElementChild.outerHTML;
      })()`);
      assert.deepEqual(header, {
        names: ["About", "Help", "Settings"],
        glyph: icon,
        kbd: "A",
        hint: "About",
      });
    } finally {
      await page.close();
    }
  });

  test("A opens About on its title, Close's hint closed; Tab reaches Close; Escape closes it, focus back where it was", async () => {
    const page = await open();
    try {
      await page.evaluate(`globalThis.aboutOpenedFrom = document.activeElement`);
      await pressA(page);
      await opened(page, "A");
      assert.ok(
        await page.evaluate(`document.activeElement === ${TITLE}`),
        "About opens with its title heading focused",
      );
      // Past Chrome's interest delay, half a second, by which a focused Close's hint would show.
      await page.evaluate(`new Promise((resolve) => setTimeout(resolve, 1000))`);
      assert.equal(
        await page.evaluate(`document.getElementById("about-close-hint").matches(":popover-open")`),
        false,
        "Close's hint is closed",
      );
      await press(page, "Tab");
      assert.ok(
        await page.evaluate(
          `document.activeElement.matches("dialog#about > header.dialog-header > button[command=close]")`,
        ),
        "Tab moves focus from the title to Close",
      );
      await press(page, "Escape");
      assert.ok(await closed(page, "Escape"), "focus is back where it was before About opened");
    } finally {
      await page.close();
    }
  });

  test("Enter or a click on About opens it; Close or Escape closes it, focus back on About", async () => {
    const page = await open();
    try {
      await page.evaluate(`${ABOUT}.focus(); globalThis.aboutOpenedFrom = ${ABOUT}`);
      await press(page, "Enter");
      await opened(page, "Enter on About");
      await page.evaluate(`document.querySelector("dialog#about button[command=close]").click()`);
      assert.ok(await closed(page, "Close"), "Close returns focus to About");
      await page.evaluate(`${ABOUT}.click()`);
      await opened(page, "a click on About");
      await press(page, "Escape");
      assert.ok(await closed(page, "Escape"), "Escape returns focus to About");
    } finally {
      await page.close();
    }
  });

  test("A typed into the editor types and opens nothing", async () => {
    const page = await open();
    try {
      const editor = `document.querySelector("sl-go-demo").shadowRoot
        .querySelector("sl-code-editor")`;
      const before: string = await page.evaluate(`${editor}.value`);
      await page.evaluate(`(() => {
        const text = ${editor}.shadowRoot.querySelector(".text");
        text.focus();
        const selection = getSelection();
        selection.selectAllChildren(text);
        selection.collapseToEnd();
      })()`);
      await pressA(page);
      await page.evaluate(SETTLED);
      assert.equal(await page.evaluate(OPEN), false, "About stays closed");
      // The caret sits where the selection collapsed, before the text's last line break.
      const typed: string = await page.evaluate(`${editor}.value`);
      assert.equal(typed, `${before.slice(0, -1)}a\n`, "the editor holds the a");
    } finally {
      await page.close();
    }
  });

  test("in the accessibility tree, the button is named About and the dialog About the playground, modal", async () => {
    const page = await open();
    try {
      const buttons = await axQuery(page, `document.querySelector("body > header")`, "button");
      assert.deepEqual(
        buttons.map(({ name }) => name?.value),
        ["About", "Help", "Settings"],
        "the header's buttons",
      );
      await page.evaluate(`${ABOUT}.click()`);
      await opened(page, "a click on About");
      const [dialog, ...others] = await axQuery(page, `document.getElementById("about")`, "dialog");
      assert.ok(dialog, "the dialog is in the tree");
      assert.equal(others.length, 0, "one dialog");
      assert.equal(dialog.name?.value, "About the playground", "the dialog's name");
      assert.equal(property(dialog, "modal"), true, "the dialog is modal");
      const [link] = await axQuery(page, `document.getElementById("about")`, "link");
      assert.equal(link?.name?.value, "The spike's question and evidence", "the link's name");
    } finally {
      await page.close();
    }
  });

  test("the dialog holds, after its header row, the three approved paragraphs, what a Run downloads, and the link to the index, in that order", async () => {
    const page = await open();
    try {
      const content: { blocks: string[]; href: string; index: string; heading: string } =
        await page.evaluate(`(() => {
          const dialog = document.getElementById("about");
          const [header, ...blocks] = dialog.children;
          return {
            heading: header.matches("header.dialog-header") ? header.querySelector("h2").textContent : "",
            blocks: blocks.map((block) => block.textContent.replace(/\\s+/g, " ").trim()),
            href: blocks.at(-1).querySelector("a")?.href ?? "",
            index: new URL("./", location.href).href,
          };
        })()`);
      assert.equal(content.heading, "About the playground", "the header row's heading");
      assert.deepEqual(content.blocks, ABOUT_TEXT);
      assert.equal(content.href, content.index, "the link goes to the index");
    } finally {
      await page.close();
    }
  });
});
