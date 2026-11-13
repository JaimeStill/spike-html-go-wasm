// mise run measure's desktop timings: each demo page of the live site, its Run read cold, cached,
// and in place, in the pinned chrome-headless-shell the browser tier uses, which the task names in
// BROWSER_EXECUTABLE. scripts/measure.ts runs it and prints the tables scripts/measure-report.ts
// formats.
//
// The browser is the tooling's launch() (@jaimestill/spike-html-apps-tooling/browser.js), its
// DevTools Protocol client on a pipe, its profile a fresh user-data-dir in TMPDIR for each launch,
// with one change: launch() maps every name but the loopback address to NOTFOUND, so no request
// leaves the machine, and this reads the network. BROWSER_EXECUTABLE is pointed, for the run, at a
// wrapper written into the scratch directory that drops that --host-resolver-rules flag and execs
// the pinned browser with every other argument as launch() gave it; launch() itself is unchanged.
//
// The pages and their demos are the browser tier's (test/browser/): a page opened through
// go-demos.ts's open(), every request it and its workers send watched, with the bytes each
// response transferred, and its helpers installed; a source demo's main.go edited by
// playground-layouts.ts's paste(); the playground's program chosen by playground-programs.ts's
// choose(). Each reading launches a fresh browser: the page opened cold, its first-contentful-paint
// read and whether any .wasm was requested before Run's click, then its Run, the first output's
// time from the click read in the page by a MutationObserver on the console's lines, the phases
// read from the demo's sl-timings, as the worker timed them (web/runtime/worker.ts), and the bytes
// transferred from the click to the run's end; then each in-place step on that page's held worker;
// then, the cold page closed, a fresh page in the same browser, within the max-age, the cached
// reading. A reading that fails, a run that doesn't finish or finishes with an error or a nonzero
// exit, is reported by its reason, never thrown: no number fails the run.

import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { launch, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";

import { demo, open, settle, wasmRequests, type Watched } from "../test/browser/go-demos.ts";
import { paste, PLAYGROUND } from "../test/browser/playground-layouts.ts";
import { choose } from "../test/browser/playground-programs.ts";
import type { PhaseTime, Reading, StateReadings } from "./measure-report.ts";

/** How long one Run may take to finish: a cold sqlate build fetches the 52 MB compiler and about
 * 220 archives over the live network. */
const BOUND = 300_000;

/** A Run on a page already open, on the worker it holds: its state's name in the table, the demo
 * it runs, the page's own unless another is named, and what changes before it. */
interface InPlace {
  state: string;
  target?: string;
  before?: (page: Page) => Promise<void>;
}

/** A demo page: its key for --pages, its name in the report, its path under the base, the demo
 * whose Run is read, and its in-place Runs, in order. */
export interface DemoPage {
  key: string;
  name: string;
  path: string;
  target: string;
  inPlace: InPlace[];
}

/** A page's one demo, the first sl-go-demo, as the Markdown pages', the sqlate page's, and the
 * playground's are. */
const ONLY = PLAYGROUND;

/** A comment appended to main.go, the demo's active file, which a source demo's next Run compiles
 * and links again, as the programs' report edits it (test/browser/playground-report.test.ts). */
const editMain: InPlace = {
  state: "in place: main.go edited, rebuilt",
  before: (page) => paste(page, "\n// Edited for the measure.\n"),
};

/** A Run of the same demo again, its files unchanged. */
const rerun: InPlace = { state: "in place: rerun" };

/** The playground's programs, in the Program select's order. */
const PROGRAMS = ["calc", "basics", "generics", "concurrency", "stdlib"];

/** The demo pages, in the site's order: the components page, its handler demo calling probe's
 * format cold, then its program demo running hello, a switch of the one runner's scenario; the
 * rendered Markdown pages, each handler demo's rerun a call on its held instance and the graph
 * page's source demo's a rerun of its held build and a rebuild after an edit; the sqlate page,
 * likewise; and the playground, once per program, opened by its fragment, then main.go edited and
 * rebuilt, and the next program chosen and built. */
export const PAGES: DemoPage[] = [
  {
    key: "components",
    name: "Components page",
    path: "components.html",
    target: demo("handler"),
    inPlace: [{ state: "in place: scenario switch, probe to hello", target: demo("program") }],
  },
  {
    key: "sqlate-compile",
    name: "sqlate compile (Markdown)",
    path: "sqlate-compile.html",
    target: ONLY,
    inPlace: [rerun],
  },
  {
    key: "go-web-sdk-handlers",
    name: "go-web-sdk handlers (Markdown)",
    path: "go-web-sdk-handlers.html",
    target: ONLY,
    inPlace: [rerun],
  },
  {
    key: "go-core-graph",
    name: "go-core graph (Markdown)",
    path: "go-core-graph.html",
    target: ONLY,
    inPlace: [rerun, editMain],
  },
  {
    key: "sqlate",
    name: "sqlate page",
    path: "sqlate.html",
    target: ONLY,
    inPlace: [rerun, editMain],
  },
  ...PROGRAMS.map((program, at) => {
    const next = PROGRAMS[(at + 1) % PROGRAMS.length];
    return {
      key: `playground-${program}`,
      name: `Playground, ${program}`,
      path: `playground.html#${program}`,
      target: ONLY,
      inPlace: [
        editMain,
        {
          state: `in place: program switch to ${next}`,
          before: (page: Page) => choose(page, next),
        },
      ],
    };
  }),
];

/** The pages the keys name, every page with none; throws naming a key no page has. */
export function pagesFor(keys: readonly string[] | undefined): DemoPage[] {
  if (keys === undefined) return PAGES;
  const unknown = keys.filter((key) => !PAGES.some((page) => page.key === key));
  if (unknown.length > 0) {
    throw new Error(
      `no page ${unknown.join(", ")}; the pages are ${PAGES.map(({ key }) => key).join(", ")}`,
    );
  }
  return PAGES.filter(({ key }) => keys.includes(key));
}

/** The message an error gives, or the value as text. */
const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** `text` as one sh word, single-quoted, so the shell expands nothing in it: JSON's double quotes
 * would leave $, `, and \ to the shell. */
const quoted = (text: string) => `'${text.replaceAll("'", `'\\''`)}'`;

/** Writes into `scratch` a wrapper for the browser at `executable` that runs it with every
 * argument but --host-resolver-rules, so the browser resolves every name, and returns its path. */
function networked(scratch: string, executable: string): string {
  const wrapper = join(scratch, "browser-networked.sh");
  writeFileSync(
    wrapper,
    `#!/bin/sh
# Written by scripts/measure-timings.ts: the pinned browser with launch()'s arguments, less the
# host-resolver rule that keeps every request on the machine.
for argument do
  shift
  case $argument in
    --host-resolver-rules=*) ;;
    *) set -- "$@" "$argument" ;;
  esac
done
exec ${quoted(executable)} "$@"
`,
  );
  chmodSync(wrapper, 0o755);
  return wrapper;
}

/** The page's first-contentful-paint, in ms from its navigation, or null when it reports none
 * within 5 s. A paint entry is queued once the frame is presented, which may be after the frames
 * open() waits for, so a buffered observer waits for it. */
const readable = (page: Page): Promise<number | null> =>
  page.evaluate(`new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 5000);
    new PerformanceObserver((list, observer) => {
      const paint = list.getEntries().find((entry) => entry.name === "first-contentful-paint");
      if (paint) {
        clearTimeout(timer);
        observer.disconnect();
        resolve(paint.startTime);
      }
    }).observe({ type: "paint", buffered: true });
  })`);

/** Presses the demo's Run and reads the run once it ends: the first output's time from the click,
 * its phases as its timings show them, and the bytes transferred meanwhile. Throws naming the
 * status when the run ends any way but finishing with exit 0 or its handler's answer. */
async function measureRun(
  watched: Watched,
  target: string,
): Promise<Omit<Reading, "readable" | "wasmBeforeRun">> {
  const { page } = watched;
  const from = watched.transfers.length;
  const runs: number = await page.evaluate(
    `window.demos.part(${target}, "sl-timings").timings.runs`,
  );
  // The observer and the click in one task, so the clock starts as Run is pressed; a Run clears
  // the console, removing rows, so the first output is the first row added.
  await page.evaluate(`(() => {
    const demo = ${target};
    const lines = window.demos.part(demo, "sl-console").shadowRoot.querySelector(".lines");
    const start = performance.now();
    window.measureFirst = null;
    const observer = new MutationObserver((records) => {
      if (records.some((record) => record.addedNodes.length > 0)) {
        window.measureFirst = performance.now() - start;
        observer.disconnect();
      }
    });
    observer.observe(lines, { childList: true });
    window.demos.button(demo, "run").click();
  })()`);
  await until(
    page,
    `window.demos.part(${target}, "sl-timings").timings.runs > ${runs}
      && !window.demos.status(${target}).startsWith("Running")`,
    BOUND,
  );
  await settle(page);
  const { status, phases, first } = (await page.evaluate(`(() => {
    const table = window.demos.part(${target}, "sl-timings");
    return {
      status: window.demos.status(${target}),
      phases: table.timings.phases.map(({ phase, ms }) => ({
        phase,
        label: table.shadowRoot.querySelector(\`tr[data-phase="\${phase}"] th\`)?.textContent.trim() ?? phase,
        ms,
      })),
      first: window.measureFirst,
    };
  })()`)) as { status: string; phases: PhaseTime[]; first: number | null };
  if (!status.startsWith("Finished") || /exit code [1-9]/.test(status)) {
    throw new Error(status);
  }
  const transferred = watched.transfers.slice(from).reduce((sum, { bytes }) => sum + bytes, 0);
  return { first, phases, transferred };
}

/** Opens the page and reads its Run as a fresh page does: readable, .wasm before Run, and the
 * run. Returns the page watched, open. */
async function fresh(
  browser: Browser,
  base: string,
  spec: DemoPage,
): Promise<{ watched: Watched; reading: Reading }> {
  const watched = await open(browser, base, spec.path);
  const paint = await readable(watched.page);
  const wasmBeforeRun = wasmRequests(watched).length > 0;
  const run = await measureRun(watched, spec.target);
  return { watched, reading: { readable: paint, wasmBeforeRun, ...run } };
}

/** One reading of every state of the page, each state's reading or reason appended to its own:
 * a fresh browser, the cold page, its in-place Runs, then the cached page. */
async function reading(base: string, spec: DemoPage, states: StateReadings[]): Promise<void> {
  const [cold, cached, ...inPlace] = states;
  const browser = await launch();
  try {
    let watched: Watched | null = null;
    try {
      const opened = await fresh(browser, base, spec);
      watched = opened.watched;
      cold.readings.push(opened.reading);
    } catch (error) {
      cold.failures.push(reason(error));
    }
    for (const [at, step] of spec.inPlace.entries()) {
      if (watched === null) {
        inPlace[at].failures.push("no cold page to run on");
        continue;
      }
      try {
        await step.before?.(watched.page);
        const run = await measureRun(watched, step.target ?? spec.target);
        inPlace[at].readings.push({ readable: null, wasmBeforeRun: null, ...run });
      } catch (error) {
        inPlace[at].failures.push(reason(error));
      }
    }
    await watched?.page.close();
    try {
      const opened = await fresh(browser, base, spec);
      cached.readings.push(opened.reading);
      await opened.watched.page.close();
    } catch (error) {
      cached.failures.push(reason(error));
    }
  } finally {
    await browser.close();
  }
}

/** The pages' readings, `count` of each state of each, each page's states in the order cold,
 * cached, then its in-place Runs; the browser at BROWSER_EXECUTABLE, wrapped in `scratch` to read
 * the network. Each page's progress is written to stderr, so stdout holds the report alone. */
export async function timings(
  base: string,
  pages: readonly DemoPage[],
  count: number,
  scratch: string,
): Promise<{ page: DemoPage; states: StateReadings[] }[]> {
  const executable = process.env.BROWSER_EXECUTABLE;
  if (!executable) {
    throw new Error("BROWSER_EXECUTABLE names no browser; mise run measure names the pinned one");
  }
  process.env.BROWSER_EXECUTABLE = networked(scratch, executable);
  try {
    const measured = [];
    for (const page of pages) {
      const states: StateReadings[] = [
        "cold",
        "cached",
        ...page.inPlace.map(({ state }) => state),
      ].map((state) => ({ state, readings: [], failures: [] }));
      for (let at = 1; at <= count; at++) {
        process.stderr.write(`measure: ${page.key}, reading ${at} of ${count}\n`);
        await reading(base, page, states);
      }
      measured.push({ page, states });
    }
    return measured;
  } finally {
    process.env.BROWSER_EXECUTABLE = executable;
  }
}
