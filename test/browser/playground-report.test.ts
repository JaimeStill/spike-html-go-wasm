// The playground's programs' report, never a gate: for each program the Program select offers,
// opened by its fragment in a browser of its own, so its worker is fresh and its cache empty, the
// phase timings of its first Run, cold, and of a Run after an edit to main.go, warm, each phase as
// the demo's timings show it, and its closure, the standard-library archives its cold Run fetched:
// their count, their bytes as fetched, and their bytes gzipped here, by node's zlib at its default
// level, as Vite's preview serves them raw. The report is the test's diagnostics, written nowhere
// else; nothing here asserts a number, only that each Run finishes, exit 0, so the report has
// numbers to give. mise run report:programs runs it alone, on a quiet machine; the browser tier
// runs it beside its other files, so its timings there are a busier machine's. The build as Pages
// serves it, dist/ under the base by the SDK's served(), Vite's preview, in the pinned
// chrome-headless-shell. The helpers are go-demos.ts's, go-builds.ts's, and
// playground-layouts.ts's. Every wait is bounded.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { gzipSync } from "node:zlib";

import { launch } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import { build, DONE, manifest, toolchainRequests } from "./go-builds.ts";
import type { Shown } from "./go-demos.ts";
import { open } from "./go-demos.ts";
import { paste, PLAYGROUND } from "./playground-layouts.ts";

const root = join(import.meta.dirname, "../..");

/** The programs, each its fragment and its option's text, in the select's order. */
const PROGRAMS = [
  ["calc", "Calculator"],
  ["basics", "Basics"],
  ["generics", "Generics"],
  ["concurrency", "Concurrency"],
  ["stdlib", "Standard library"],
] as const;

/** The phases a build and its run can show, as the timings name them, in phase order. */
const PHASES = ["Fetch", "Wasm compile", "Go compile", "Link", "Instantiate", "Start", "Run"];

/** A program's measures: its cold and warm Runs' timings and its closure's archives. */
interface Measured {
  label: string;
  cold: Shown;
  warm: Shown;
  archives: string[];
}

let server: Server;

before(async () => {
  server = await served(root);
});
after(async () => {
  await server?.stop();
});

/** Opens the program by its fragment in a browser of its own, runs it cold, appends a comment to
 * main.go, which the demo opens on, and runs it warm. */
async function measure(program: string, label: string): Promise<Measured> {
  const browser = await launch();
  try {
    const watched = await open(browser, server.origin, `playground.html#${program}`);
    const { page } = watched;
    const cold = await build(page, PLAYGROUND, DONE);
    const fetched = toolchainRequests(watched);
    const tools = new Set(["manifest.json", manifest.compile, manifest.link]);
    const archives = fetched.filter((path) => !tools.has(path));
    await paste(page, "\n// Edited for the report.\n");
    const warm = await build(page, PLAYGROUND, DONE);
    return { label, cold, warm, archives };
  } finally {
    await browser.close();
  }
}

/** The ms shown for the phase, or a dash where the Run had no such phase. */
const ms = ({ phases, times }: Shown, phase: string) => {
  const at = phases.indexOf(phase);
  return at < 0 ? "-" : String(times[at]);
};

/** The sum of the times shown. */
const total = ({ times }: Shown) => String(Math.round(times.reduce((sum, time) => sum + time, 0)));

/** A number of bytes, grouped by thousands. */
const bytes = (count: number) => count.toLocaleString("en-US");

/** The rows as a table, each column padded to its widest cell, the first left columns' text left
 * and the rest's numbers right. */
function table(rows: string[][], left: number): string[] {
  const widths = rows[0].map((_, column) => Math.max(...rows.map((row) => row[column].length)));
  return rows.map((row) =>
    row
      .map((cell, column) =>
        column < left ? cell.padEnd(widths[column]) : cell.padStart(widths[column]),
      )
      .join("  ")
      .trimEnd(),
  );
}

describe("the playground's programs' report", () => {
  test("each program's cold and warm phase timings, in ms, and its closure's archives, count, bytes as fetched, and gzip bytes", async (t) => {
    const measured: Measured[] = [];
    for (const [program, label] of PROGRAMS) measured.push(await measure(program, label));

    const phases = PHASES.filter((phase) =>
      measured.some(({ cold, warm }) => cold.phases.includes(phase) || warm.phases.includes(phase)),
    );
    const timings = table(
      [
        ["Program", "Run", ...phases, "Total"],
        ...measured.flatMap(({ label, cold, warm }) =>
          (
            [
              ["cold", cold],
              ["warm", warm],
            ] as const
          ).map(([run, shown]) => [
            run === "cold" ? label : "",
            run,
            ...phases.map((phase) => ms(shown, phase)),
            total(shown),
          ]),
        ),
      ],
      2,
    );
    const closures = table(
      [
        ["Program", "Archives", "Bytes", "Gzip bytes"],
        ...measured.map(({ label, archives }) => {
          const files = archives.map((path) => readFileSync(join(root, "dist/go/toolchain", path)));
          return [
            label,
            String(archives.length),
            bytes(files.reduce((sum, file) => sum + file.length, 0)),
            bytes(files.reduce((sum, file) => sum + gzipSync(file).length, 0)),
          ];
        }),
      ],
      1,
    );
    for (const line of [
      "Phase timings, ms: cold from a fresh worker and an empty cache, warm after an edit to main.go",
      ...timings,
      "",
      "Closure: the standard-library archives the cold Run fetched, gzip by node's zlib",
      ...closures,
    ]) {
      t.diagnostic(line);
    }
  });
});
