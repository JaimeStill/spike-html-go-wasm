// mise run screenshots' command, the tooling's spike-html-apps-screenshots on
// scripts/screenshots.config.ts, run by scripts/screenshots.ts as the task runs it. With the SDK's
// capture run, the index, light, to the terminal, under a scratch TMPDIR, it leaves nothing there,
// and with --keep leaves what it printed, so the first run's empty TMPDIR is the output's cleanup,
// not a capture that never wrote. A component's capture, --page components/<component>, takes its
// section alone: the capture file names a page for every section of the components page, a state
// at each of the SDK's widths, its open step hides every other section and leaves the component's
// focus-start mark the page's first, or none for a component with no focus state, and a run of one
// at one --width prints that component's few tiles at that width alone and leaves nothing under
// its TMPDIR; the Go demo's is captured again at each width after its runs. A --width not among the SDK's, or with no value, is a usage error naming the widths,
// capturing nothing. The playground's capture, --page playground, is the viewport alone in each
// band of its fixed demo, the phone's also with its Timings tab, and the wide band's in each
// arrangement and with the Layout menu open, each chosen by the menu, the widest with the About
// dialog open, and each of the SDK's widths with each of Basics, Generics, Concurrency, and
// Standard library chosen in the Program select, and again after a Run of the starter, the phone's
// and the widest's, editor left, also with its Timings tab. The states after a Run reach their
// endings when their open steps run on a served page, no capture taken: the Go demo's format
// result, hello's line and exit 0, and crash's panic on stderr and exit 2, from their prebuilt
// modules; and the playground's starter built in the page and run to exit 0, every phase of a
// build timed, in editor left at 1376px, and on the Timings tab at 390px and at 1376px in editor
// left. The sqlate page's, --page sqlate, is the viewport alone at each of the SDK's widths, and
// each rendered Markdown page's, --page sqlate-compile, --page go-core-graph, and --page
// go-web-sdk-handlers, the page whole at each. Every page, the components page once on
// its first component, is also captured at 390px with the Site drawer open, the viewport alone,
// and each such state's open step, run on a served page at 390px, no capture taken, leaves the
// drawer open, a modal, with SITE_NAV's links, the page's own marked current.
// Adapted from spike-html-hosting-architecture (27d70e1): test/browser/screenshots.test.ts, its
// run and assertions the SDK's.
// From spike-html-hosting-sdk (v0.6.4): template/test/browser/screenshots.test.ts.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import {
  keepsCaptures,
  leavesNoCapture,
  WIDTHS,
} from "@jaimestill/spike-html-hosting-sdk/screenshots.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import { SITE_NAV } from "../../scripts/site-nav.ts";
import description, { COMPONENTS, MIDDLE, SITE_DRAWER } from "../../scripts/screenshots.config.ts";
import { BUILT_PHASES, DONE } from "./go-builds.ts";
import { demo, open as openPage, shown, wasmRequests } from "./go-demos.ts";

const root = join(import.meta.dirname, "../..");
const config = join(root, "scripts/screenshots.config.ts");
const script = join(root, "scripts/screenshots.ts");

/** A run's bound: the build is served and one page captured in a few seconds. */
const RUN = 120_000;

/** The playground's one demo. */
const PLAYGROUND = `document.querySelector("sl-go-demo")`;

/** Lays the page out at the width, at the capture's height for it, as the capture does. */
const sized = (page: Page, width: number) =>
  page.cdp("Emulation.setDeviceMetricsOverride", {
    width,
    height: WIDTHS.find((viewport) => viewport.width === width)?.height ?? 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

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
        [
          ...widths.map((width) => [`components-${component}-${width}`, width, true]),
          // The page's one Site drawer state, on its first component.
          ...(component === COMPONENTS[0]
            ? [[`components-${component}-site-390`, 390, false]]
            : []),
          // The Go demo's again after its runs.
          ...(component === "go-demo"
            ? widths.map((width) => [`components-go-demo-run-${width}`, width, true])
            : []),
        ],
        component,
      );
    }
  });

  test("the Go demo's run state runs format, hello, and crash to their endings: format's result, hello's line and exit 0, crash's stderr and exit 2", async () => {
    const described = description.pages.find(({ name }) => name === "components/go-demo");
    const state = described?.states?.find(({ name }) => name === "components-go-demo-run-390");
    assert.ok(state?.open, "the run state has an open step");
    const watched = await openPage(browser, server.origin);
    const { page } = watched;
    try {
      await sized(page, 390);
      await state.open(page);
      const [format, hello, crash] = await Promise.all(
        ["handler", "program", "crash"].map((figure) => shown(page, demo(figure))),
      );
      assert.equal(format.status, "Finished format");
      assert.equal(format.result?.ok, true, JSON.stringify(format.rows));
      assert.equal(hello.status, "Finished hello, exit code 0");
      assert.match(hello.lines.map(({ text }) => text).join(""), /^hello from Go go1\.\d+/);
      assert.ok(hello.rows.some(({ kind, text }) => kind === "exit" && text.endsWith("code 0")));
      assert.equal(crash.status, "Failed crash: probe exited with code 2");
      assert.ok(
        crash.lines.some(({ stream, text }) => stream === "stderr" && text.startsWith("panic: ")),
        JSON.stringify(crash.lines),
      );
      assert.ok(crash.rows.some(({ kind, text }) => kind === "exit" && text.endsWith("code 2")));
      // Each ran its prebuilt module, and nothing was built.
      assert.deepEqual(wasmRequests(watched), ["go/probe.wasm", "go/hello.wasm", "go/probe.wasm"]);
    } finally {
      await page.close();
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

  test("the capture file captures the playground's viewport in each band of its fixed demo, the phone's Timings tab, the wide band in each arrangement and with the Layout menu open, the About dialog open, the Site drawer open, and Basics, Generics, Concurrency, and Standard library each chosen at each of the SDK's widths", () => {
    const described = description.pages.find(({ name }) => name === "playground");
    const [phone, ...wide] = WIDTHS.map(({ width }) => width);
    assert.deepEqual(
      described?.states?.map(({ name, viewport, full }) => [name, viewport?.width, full]),
      [
        [`playground-${phone}`, phone, false],
        [`playground-timings-${phone}`, phone, false],
        [`playground-${MIDDLE.width}`, MIDDLE.width, false],
        ...wide.flatMap((width) => [
          [`playground-${width}`, width, false],
          [`playground-top-${width}`, width, false],
          [`playground-right-${width}`, width, false],
          [`playground-menu-${width}`, width, false],
        ]),
        [`playground-about-${wide.at(-1)}`, wide.at(-1), false],
        [`playground-site-${phone}`, phone, false],
        ...["basics", "generics", "concurrency", "stdlib"].flatMap((program) =>
          [phone, ...wide].map((width) => [`playground-${program}-${width}`, width, false]),
        ),
        ...[phone, ...wide].map((width) => [`playground-run-${width}`, width, false]),
        [`playground-run-timings-${phone}`, phone, false],
        [`playground-run-timings-${wide.at(-1)}`, wide.at(-1), false],
      ],
    );
  });

  test("the playground's run states build and run the starter to exit 0, the wide ones in editor left, and the Timings ones on the Timings tab", async () => {
    const described = description.pages.find(({ name }) => name === "playground");
    for (const [name, width, tab] of [
      ["playground-run-timings-390", 390, "timings"],
      ["playground-run-1376", 1376, null],
      ["playground-run-timings-1376", 1376, "timings"],
    ] as const) {
      const state = described?.states?.find((each) => each.name === name);
      assert.ok(state?.open, `${name} has an open step`);
      const { page } = await openPage(browser, server.origin, "playground.html");
      try {
        await sized(page, width);
        await state.open(page);
        const run = await shown(page, PLAYGROUND);
        assert.equal(run.status, DONE, name);
        assert.ok(run.rows.some(({ kind, text }) => kind === "exit" && text.endsWith("code 0")));
        // A build in the page: the compiler and linker ran in the worker.
        assert.deepEqual(run.phases, BUILT_PHASES, name);
        const root = `${PLAYGROUND}.shadowRoot`;
        if (tab === "timings") {
          const selected = await page.evaluate(
            `${root}.querySelector('.output-tabs [aria-selected="true"]').dataset.part`,
          );
          assert.equal(selected, "timings", name);
        }
        if (width > 390) {
          const placement = await page.evaluate(`${root}.querySelector(".demo").dataset.placement`);
          assert.equal(placement, "left", name);
        }
      } finally {
        await page.close();
      }
    }
  });

  test("the playground's wide states choose their arrangement by the Layout menu, and the menu's state leaves it open", async () => {
    const described = description.pages.find(({ name }) => name === "playground");
    const wide = (described?.states ?? []).filter(
      ({ name, viewport }) =>
        viewport?.width === 1376 &&
        !["about", "basics", "generics", "concurrency", "stdlib", "run"].some((variant) =>
          name?.includes(variant),
        ),
    );
    const expected = [
      ["left", false],
      ["top", false],
      ["right", false],
      ["left", true],
    ];
    assert.equal(wide.length, expected.length);
    for (const [index, state] of wide.entries()) {
      const page = await browser.open(`${server.origin}playground.html`);
      try {
        await page.cdp("Emulation.setDeviceMetricsOverride", {
          width: 1376,
          height: 900,
          deviceScaleFactor: 1,
          mobile: false,
        });
        await state.open?.(page);
        const shown = await page.evaluate(`(() => {
          const root = document.querySelector("sl-go-demo").shadowRoot;
          return [
            root.querySelector(".demo").dataset.placement,
            root.querySelector("sl-controls").shadowRoot
              .querySelector("#layout-menu").matches(":popover-open"),
          ];
        })()`);
        assert.deepEqual(shown, expected[index], `the state at ${index}`);
      } finally {
        await page.close();
      }
    }
  });

  test("the capture file captures the sqlate page's viewport at each of the SDK's widths, and at 390px with the Site drawer open", () => {
    const described = description.pages.find(({ name }) => name === "sqlate");
    assert.deepEqual(
      described?.states?.map(({ name, viewport, full }) => [name, viewport?.width, full]),
      [
        ...WIDTHS.map(({ width }) => [`sqlate-${width}`, width, false]),
        ["sqlate-site-390", 390, false],
      ],
    );
  });

  for (const rendered of ["sqlate-compile", "go-core-graph", "go-web-sdk-handlers"]) {
    test(`the capture file captures the rendered Markdown page ${rendered} whole at each of the SDK's widths, and its viewport at 390px with the Site drawer open`, () => {
      const described = description.pages.find(({ name }) => name === rendered);
      assert.deepEqual(
        described?.states?.map(({ name, viewport, full }) => [name, viewport?.width, full]),
        [
          ...WIDTHS.map(({ width }) => [`${rendered}-${width}`, width, true]),
          [`${rendered}-site-390`, 390, false],
        ],
      );
    });
  }

  test("the capture file captures every page once at 390px with the Site drawer open, the viewport alone: the index, the components page on its first component, the playground, the sqlate page, and each rendered Markdown page", () => {
    const site = description.pages.flatMap(({ name, path, states }) =>
      (states ?? [])
        .filter((state) => state.name?.includes("-site-"))
        .map((state) => [name, path, state.name, state.viewport?.width, state.full]),
    );
    const base = description.pages.find(({ name }) => name === "index")?.path ?? "";
    assert.deepEqual(site, [
      ["index", base, "index-site-390", 390, false],
      [
        `components/${COMPONENTS[0]}`,
        `${base}components.html`,
        `components-${COMPONENTS[0]}-site-390`,
        390,
        false,
      ],
      ...["playground", "sqlate", "sqlate-compile", "go-core-graph", "go-web-sdk-handlers"].map(
        (name) => [name, `${base}${name}.html`, `${name}-site-390`, 390, false],
      ),
    ]);
  });

  test("each Site drawer state's open step, at 390px, leaves the Site drawer open, a modal, with SITE_NAV's links, the page's own current, and the components page's first section alone", async () => {
    const states = description.pages.flatMap(({ path, states }) =>
      (states ?? [])
        .filter((state) => state.name?.includes("-site-"))
        .map((state) => ({ path, state })),
    );
    assert.equal(states.length, 7, "a state for each of the seven pages");
    const base = description.pages.find(({ name }) => name === "index")?.path ?? "";
    for (const { path, state } of states) {
      assert.ok(state.open, `${state.name} has an open step`);
      const file = path.slice(base.length) || "index.html";
      const page = await browser.open(`${server.origin}${path.slice(base.length)}`);
      try {
        await sized(page, 390);
        await state.open(page);
        const read = await page.evaluate(`(() => {
          const drawer = ${SITE_DRAWER};
          return {
            open: drawer.open,
            modal: drawer.shadowRoot.querySelector("dialog").matches(":modal"),
            links: [...drawer.querySelectorAll("a")].filter((a) => a.checkVisibility())
              .map((a) => [a.textContent.trim(), a.href, a.getAttribute("aria-current")]),
            sections: [...document.querySelectorAll("main > section")]
              .filter((section) => section.checkVisibility()).map((section) => section.id),
          };
        })()`);
        const { open, modal, links, sections } = read;
        assert.deepEqual(
          { open, modal, links },
          {
            open: true,
            modal: true,
            links: SITE_NAV.map(({ label, href, pages }) => [
              label,
              new URL(href, server.origin).href,
              pages.includes(file) ? "page" : null,
            ]),
          },
          state.name ?? "",
        );
        if (file === "components.html") {
          assert.deepEqual(sections, [COMPONENTS[0]], `${state.name ?? ""}: its section alone`);
        }
      } finally {
        await page.close();
      }
    }
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
