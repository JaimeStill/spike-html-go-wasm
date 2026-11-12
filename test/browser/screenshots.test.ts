// mise run screenshots' command, the tooling's spike-html-apps-screenshots on
// scripts/screenshots.config.ts, run by scripts/screenshots.ts as the task runs it. With the SDK's
// capture run, the index, light, to the terminal, under a scratch TMPDIR, it leaves nothing there,
// and with --keep leaves what it printed, so the first run's empty TMPDIR is the output's cleanup,
// not a capture that never wrote. A component's capture, --page components/<component>, takes its
// section alone: the capture file names a page for every section of the components page, a state
// at each of the SDK's widths, its open step hides every other section and leaves the component's
// focus-start mark the page's first, or none for a component with no focus state, and a run of one
// at one --width prints that component's few tiles at that width alone and leaves nothing under
// its TMPDIR. A --width not among the SDK's, or with no value, is a usage error naming the widths,
// capturing nothing. The playground's capture, --page playground, is the page whole at each of the
// SDK's widths.
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
import {
  keepsCaptures,
  leavesNoCapture,
  WIDTHS,
} from "@jaimestill/spike-html-hosting-sdk/screenshots.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import description, { COMPONENTS } from "../../scripts/screenshots.config.ts";

const root = join(import.meta.dirname, "../..");
const config = join(root, "scripts/screenshots.config.ts");
const script = join(root, "scripts/screenshots.ts");

/** A run's bound: the build is served and one page captured in a few seconds. */
const RUN = 120_000;

/** A run of the task's script, as mise run screenshots runs it, light, to the terminal, with the
 * flags after, under a fresh scratch TMPDIR, removed once the run's leftovers are read: its exit
 * status, its stderr, the capture files it printed, and its TMPDIR's files after. */
function task(...flags: string[]) {
  const dir = mkdtempSync(join(tmpdir(), "screenshots."));
  try {
    const { status, stdout, stderr, error } = spawnSync(
      process.execPath,
      [script, "--scheme", "light", "--output", "terminal", ...flags],
      {
        cwd: root,
        env: { ...process.env, TMPDIR: dir, NODE_DISABLE_COMPILE_CACHE: "1" },
        encoding: "utf8",
        timeout: RUN,
      },
    );
    assert.ifError(error);
    const printed = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.endsWith(".png"));
    return { status, stderr, printed, left: readdirSync(dir, { recursive: true }) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

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

  test("the capture file captures each component at each of the SDK's widths, one state a width, the width in its name", () => {
    const widths = WIDTHS.map(({ width }) => width);
    for (const component of COMPONENTS) {
      const described = description.pages.find(({ name }) => name === `components/${component}`);
      assert.deepEqual(
        described?.states?.map(({ name, viewport, full }) => [name, viewport?.width, full]),
        widths.map((width) => [`components-${component}-${width}`, width, true]),
        component,
      );
    }
  });

  test("a run of one component at one --width prints that width's few tiles of its section alone and leaves nothing under TMPDIR", () => {
    const run = task("--page", "components/console", "--width", "390");
    assert.equal(run.status, 0, run.stderr);
    assert.ok(run.printed.length > 0, "it printed its captures");
    for (const path of run.printed) {
      assert.match(path, /-components-console-390--flexoki-regular-mono-light--\d+of\d+\.png$/);
    }
    // The console's section alone is a few tiles of 1200px; the whole page is over twenty.
    assert.ok(run.printed.length <= 8, `${run.printed.length} tiles: ${run.printed.join(", ")}`);
    assert.deepEqual(run.left, [], "TMPDIR is left empty");
  });

  test("the capture file captures the playground whole at each of the SDK's widths", () => {
    const described = description.pages.find(({ name }) => name === "playground");
    assert.deepEqual(
      described?.states?.map(({ name, viewport, full }) => [name, viewport?.width, full]),
      WIDTHS.map(({ width }) => [`playground-${width}`, width, true]),
    );
  });

  test("a --width not among the SDK's is a usage error naming them, and captures nothing", () => {
    for (const flags of [["--width", "500"], ["--width=1280"], ["--width"]]) {
      const run = task("--page", "components/console", ...flags);
      assert.equal(run.status, 2, flags.join(" "));
      assert.match(run.stderr, /390, 1120, 1376/, flags.join(" "));
      assert.deepEqual(run.printed, [], flags.join(" "));
      assert.deepEqual(run.left, [], "TMPDIR is left empty");
    }
  });
});
