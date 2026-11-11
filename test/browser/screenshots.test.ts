// mise run screenshots' command, the tooling's spike-html-apps-screenshots on
// scripts/screenshots.config.ts, run as the task runs it. With the SDK's capture run, the index,
// light, to the terminal, under a scratch TMPDIR, it leaves nothing there, and with --keep leaves
// what it printed, so the first run's empty TMPDIR is the output's cleanup, not a capture that
// never wrote. A component's capture, --page components/<component>, takes its section alone: the
// capture file names a page for every section of the components page, its open step hides every
// other section and leaves the component's focus-start mark the page's first, or none for a
// component with no focus state, and a run of one prints that component's few tiles alone and
// leaves nothing under its TMPDIR.
// Adapted from spike-html-hosting-architecture (27d70e1): test/browser/screenshots.test.ts, its
// run and assertions the SDK's.
// From spike-html-hosting-sdk (v0.6.2): template/test/browser/screenshots.test.ts.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { keepsCaptures, leavesNoCapture } from "@jaimestill/spike-html-hosting-sdk/screenshots.js";
import { command, served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import description, { COMPONENTS } from "../../scripts/screenshots.config.ts";

const root = join(import.meta.dirname, "../..");
const config = join(root, "scripts/screenshots.config.ts");

/** A run's bound: the build is served and one page captured in a few seconds. */
const RUN = 120_000;

describe("mise run screenshots' command", () => {
  test("captures the index under TMPDIR and leaves nothing there", () => {
    leavesNoCapture(root, config);
  });

  test("with --keep, leaves every capture file it printed", () => {
    keepsCaptures(root, config);
  });
});

describe("a component's capture", () => {
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

  test("the capture file names a page for each of the components page's sections, in its order", () => {
    const html = readFileSync(join(root, "components.html"), "utf8");
    const sections = [...html.matchAll(/<section id="([^"]+)"/g)].map(([, id]) => id);
    assert.deepEqual([...COMPONENTS], sections);
    const named = description.pages
      .map(({ name }) => name)
      .filter((name) => name.startsWith("components"));
    assert.deepEqual(
      named,
      sections.map((id) => `components/${id}`),
    );
  });

  test("its open step hides every other section and leaves its own focus-start mark, if any, the page's first; the controls' opens New file's form", async () => {
    for (const component of COMPONENTS) {
      const described = description.pages.find(({ name }) => name === `components/${component}`);
      const [state] = described?.states ?? [];
      assert.ok(state?.open, `components/${component} has an open step`);
      assert.equal(state.full, true);
      assert.deepEqual(state.viewport, { width: 1280, height: 800 });
      const page = await browser.open(`${server.origin}components.html`);
      try {
        await state.open(page);
        const { shown, mark, own } = await page.evaluate(`(() => ({
          shown: [...document.querySelectorAll("main > section")]
            .filter((section) => section.checkVisibility())
            .map((section) => section.id),
          mark: document.querySelector("[data-focus-start]")?.closest("section")?.id ?? null,
          own: !!document.querySelector("#${component} [data-focus-start]"),
        }))()`);
        assert.deepEqual(shown, [component]);
        assert.equal(mark, own ? component : null);
        // The controls' capture opens New file's form in its refusing state.
        const forms: number =
          await page.evaluate(`[...document.querySelectorAll("#${component} sl-controls")]
          .filter((controls) => controls.shadowRoot.querySelector(".form-popover:popover-open")).length`);
        assert.equal(forms, component === "controls" ? 1 : 0, `${component}'s open forms`);
      } finally {
        await page.close();
      }
    }
  });

  test("a run of one component prints its section's few tiles alone and leaves nothing under TMPDIR", () => {
    const dir = mkdtempSync(join(tmpdir(), "screenshots."));
    try {
      const args = [
        config,
        "--page",
        "components/console",
        "--scheme",
        "light",
        "--output",
        "terminal",
      ];
      const { status, stdout, stderr, error } = spawnSync(
        command(root, "spike-html-apps-screenshots"),
        args,
        {
          cwd: root,
          env: { ...process.env, TMPDIR: dir, NODE_DISABLE_COMPILE_CACHE: "1" },
          encoding: "utf8",
          timeout: RUN,
        },
      );
      assert.ifError(error);
      assert.equal(status, 0, stderr);
      const printed = stdout
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.endsWith(".png"));
      assert.ok(printed.length > 0, "it printed its captures");
      for (const path of printed)
        assert.match(path, /-components-console--flexoki-regular-mono-light/);
      // The console's section alone is a few tiles of 1200px; the whole page is over twenty.
      assert.ok(printed.length <= 8, `${printed.length} tiles: ${printed.join(", ")}`);
      assert.deepEqual(readdirSync(dir, { recursive: true }), [], "TMPDIR is left empty");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
