// The pure parts of mise run measure (scripts/measure.ts): the median and max over readings, the
// weighing of a response as it came over the wire, its raw bytes, its bytes as served, and its
// bytes at brotli 11; a size row for one module and for one closure, whose file count is the
// requests a revalidation makes; the comparison of two builds of a module, byte for byte, with
// the build settings Go stamped into each; and the report's sections, each a list of lines, the
// size table and the drift report, under a head naming the site, its deployed commit, and the
// date; and the desktop timings, each state's readings of a page's run (scripts/measure-timings.ts
// reads them) aggregated into its median and max, one table per page under a legend. Nothing here
// reads the network or the disk; the unit tier (test/unit/measure.test.ts) runs each on fixtures.
// Adapted from spike-html-hosting (421254d): scripts/cost-report.ts, its median, max, brotli, and
// table.

import { promisify } from "node:util";
import {
  brotliCompress,
  constants,
  gunzipSync,
  inflateSync,
  brotliDecompressSync,
} from "node:zlib";

import { PHASES } from "../web/components/run-timings.ts";

/** The median of the values, the mean of the middle two when they are even in number; NaN when
 * there are none. */
export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** The largest of the values; NaN when there are none. */
export function max(values: number[]): number {
  return values.length === 0 ? NaN : Math.max(...values);
}

const compress = promisify(brotliCompress);

/** The body's size compressed with brotli at quality 11, node:zlib's, the most a static host could
 * serve it at. Asynchronous, on libuv's pool, so several bodies compress at once: the compiler's
 * 52 MB takes over a minute. */
export async function brotli(body: Uint8Array): Promise<number> {
  const compressed = await compress(body, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 11,
      [constants.BROTLI_PARAM_SIZE_HINT]: body.length,
    },
  });
  return compressed.length;
}

/** A body's bytes as a Content-Encoding left them, decoded: gzip, deflate, and br as a browser
 * accepts them; none, or identity, as they came. Throws naming any other. */
export function decode(wire: Uint8Array, encoding: string): Buffer {
  switch (encoding.trim().toLowerCase()) {
    case "":
    case "identity":
      return Buffer.from(wire);
    case "gzip":
      return gunzipSync(wire);
    case "deflate":
      return inflateSync(wire);
    case "br":
      return brotliDecompressSync(wire);
    default:
      throw new Error(`an encoding measure can't decode: ${encoding}`);
  }
}

/** One response weighed: its body's raw bytes, decoded; its bytes as served, the wire's, under the
 * encoding the host chose for a browser's Accept-Encoding ("identity" when it chose none); and the
 * raw body's bytes at brotli 11. */
export interface Weight {
  raw: number;
  served: number;
  encoding: string;
  brotli: number;
}

/** The response's weight from its wire bytes and Content-Encoding, and its decoded body. */
export async function weigh(
  wire: Uint8Array,
  encoding: string | null,
): Promise<{ weight: Weight; body: Buffer }> {
  const body = decode(wire, encoding ?? "");
  return {
    weight: {
      raw: body.length,
      served: wire.length,
      encoding: encoding?.trim().toLowerCase() || "identity",
      brotli: await brotli(body),
    },
    body,
  };
}

/** A size table's row: a module, one file, or a closure, its files summed. files is the requests a
 * revalidation makes once the cache's max-age expires, one conditional request per file; encodings
 * are each encoding the host served the files with, sorted. */
export interface SizeRow {
  name: string;
  kind: "module" | "closure";
  files: number;
  raw: number;
  served: number;
  brotli: number;
  encodings: string[];
}

/** A module's row: its one file. */
export function moduleRow(name: string, weight: Weight): SizeRow {
  return { name, kind: "module", files: 1, ...sums([weight]) };
}

/** The requests a revalidation of the closure makes once the max-age expires: one per distinct
 * file, however many packages share an archive. */
export function revalidations(archives: readonly string[]): number {
  return new Set(archives).size;
}

/** A closure's row: the program's archives, each by its path and weight, each distinct path
 * counted and summed once. */
export function closureRow(
  name: string,
  archives: readonly { path: string; weight: Weight }[],
): SizeRow {
  const distinct = new Map(archives.map(({ path, weight }) => [path, weight]));
  return {
    name,
    kind: "closure",
    files: revalidations(archives.map(({ path }) => path)),
    ...sums([...distinct.values()]),
  };
}

/** The weights summed, and their encodings, each once, sorted. */
function sums(weights: readonly Weight[]): Omit<SizeRow, "name" | "kind" | "files"> {
  const total = (key: "raw" | "served" | "brotli") =>
    weights.reduce((sum, weight) => sum + weight[key], 0);
  return {
    raw: total("raw"),
    served: total("served"),
    brotli: total("brotli"),
    encodings: [...new Set(weights.map(({ encoding }) => encoding))].toSorted(),
  };
}

/** The build settings Go stamped into a module's build info, each `build\tkey=value` line as its
 * key and value: -trimpath=true, GOOS=js, vcs.revision=<commit>, vcs.modified=false, and the rest.
 * A module stripped with -s -w keeps them; one with none gives an empty map. */
export function buildSettings(module: Uint8Array): Map<string, string> {
  const text = Buffer.from(module).toString("latin1");
  const settings = new Map<string, string>();
  for (const [, key, value] of text.matchAll(/\nbuild\t([^=\n\t]+)=([^\n]*)/g)) {
    if (!settings.has(key)) settings.set(key, value);
  }
  return settings;
}

/** Two builds of a module held against each other: whether they match byte for byte; each one's
 * length and the second's less the first's; where their lengths match, how many bytes differ; and
 * each build setting whose value differs, as key: first → second. */
export interface Compared {
  same: boolean;
  a: number;
  b: number;
  delta: number;
  differing: number | null;
  settings: string[];
}

/** `a` against `b`, byte for byte. */
export function compare(a: Uint8Array, b: Uint8Array): Compared {
  const same = Buffer.from(a).equals(Buffer.from(b));
  let differing: number | null = null;
  if (a.length === b.length) {
    differing = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) differing++;
  }
  const first = buildSettings(a);
  const second = buildSettings(b);
  const keys = [...new Set([...first.keys(), ...second.keys()])];
  const settings = keys.flatMap((key) =>
    first.get(key) === second.get(key)
      ? []
      : [`${key}: ${first.get(key) ?? "none"} → ${second.get(key) ?? "none"}`],
  );
  return { same, a: a.length, b: b.length, delta: b.length - a.length, differing, settings };
}

/** One prebuilt module's drift: two local builds against each other, and the live module against
 * the first, or the reason the live one couldn't be read. */
export interface Drift {
  name: string;
  local: Compared;
  live: Compared | string;
}

/** A number of bytes, grouped by thousands. */
export const bytes = (count: number) => count.toLocaleString("en-US");

/** A difference in bytes, signed: +5, -5, or 0. */
export const signed = (count: number) => (count > 0 ? `+${bytes(count)}` : bytes(count));

/** The rows as a table, each column padded to its widest cell, the first `left` columns' text left
 * and the rest's numbers right, with a rule under the header, the first row. */
export function table(rows: string[][], left: number): string[] {
  const widths = rows[0].map((_, column) =>
    Math.max(...rows.map((row) => (row[column] ?? "").length)),
  );
  const line = (row: string[]) =>
    widths
      .map((width, column) =>
        column < left ? (row[column] ?? "").padEnd(width) : (row[column] ?? "").padStart(width),
      )
      .join("  ")
      .trimEnd();
  const [header, ...body] = rows;
  return [line(header), widths.map((width) => "-".repeat(width)).join("  "), ...body.map(line)];
}

/** What the report's head names: the base read, the deployed commit and where it was read from,
 * and the date of the run. */
export interface Head {
  base: string;
  commit: string;
  date: string;
}

/** The head's lines. */
export function head({ base, commit, date }: Head): string[] {
  return [`measure  ${base}`, `deployed commit: ${commit}`, `date: ${date}`];
}

/** The size table's section: a caption, then one row per module and per closure, its kind, its
 * files, raw bytes, bytes as served, and brotli-11 bytes, with the encodings served. `maxAge` is
 * the cache's max-age as the host sent it, which the files column's revalidation follows. */
export function sizeSection(rows: readonly SizeRow[], maxAge: string): string[] {
  return [
    `Sizes, live: raw bytes, bytes as served for Accept-Encoding: gzip, deflate, br, and brotli 11 by node's zlib; files, the requests a revalidation makes once max-age (${maxAge}) expires`,
    ...table(
      [
        ["Name", "Kind", "Files", "Raw", "Served", "Encoding", "Brotli 11"],
        ...rows.map(({ name, kind, files, raw, served, encodings, brotli }) => [
          name,
          kind,
          String(files),
          bytes(raw),
          bytes(served),
          encodings.join(", "),
          bytes(brotli),
        ]),
      ],
      2,
    ),
  ];
}

/** One comparison's cell: "same", or each length, the difference, and where the lengths match,
 * the bytes that differ. */
function compared({ same, a, b, delta, differing }: Compared): string {
  if (same) return `same, ${bytes(a)} B`;
  const count = differing === null ? "" : `, ${bytes(differing)} bytes differ`;
  return `differ: ${bytes(a)} B vs ${bytes(b)} B (${signed(delta)})${count}`;
}

/** The drift report's section: per prebuilt module, whether two local builds match byte for byte,
 * and whether the live module matches the first, each difference's byte counts and the build
 * settings that differ beneath it. */
export function driftSection(drifts: readonly Drift[]): string[] {
  const lines = [
    "Drift: two local builds, each with a GOCACHE of its own, against each other; the live module against the first local build",
  ];
  for (const { name, local, live } of drifts) {
    lines.push(`${name}.wasm`, `  local vs local: ${compared(local)}`);
    lines.push(...local.settings.map((setting) => `    ${setting}`));
    if (typeof live === "string") {
      lines.push(`  local vs live: not read: ${live}`);
    } else {
      lines.push(`  local vs live:  ${compared(live)}`);
      lines.push(...live.settings.map((setting) => `    ${setting}`));
    }
  }
  return lines;
}

/** A median and a max over readings. */
export interface Spread {
  median: number;
  max: number;
}

/** The values' median and max, or null when there are none. */
export function spread(values: readonly number[]): Spread | null {
  return values.length === 0 ? null : { median: median([...values]), max: max([...values]) };
}

/** One phase of a run as the demo's timings recorded it: the runtime's name for it, as
 * web/components/run-timings.ts's PHASES gives it, the timings table's row header, and its ms. */
export interface PhaseTime {
  phase: string;
  label: string;
  ms: number;
}

/** One reading of a page's run: the page's first-contentful-paint, in ms from its navigation, and
 * whether any .wasm was requested before Run's click, each null for a run on a page already open;
 * the time from Run's click to the console's first output, null when none appeared; the run's
 * phases as its timings show them; and the bytes the page and its workers transferred over the
 * network from the click to the run's end, 0 for every response the HTTP cache answered. */
export interface Reading {
  readable: number | null;
  wasmBeforeRun: boolean | null;
  first: number | null;
  phases: PhaseTime[];
  transferred: number;
}

/** A state's readings of one page, cold, cached, or in place, and why any reading failed. */
export interface StateReadings {
  state: string;
  readings: Reading[];
  failures: string[];
}

/** A state's readings aggregated: their count; the median and max of each timing, null where no
 * reading had it; whether .wasm was requested before Run, in words; each phase's median and max,
 * by its runtime name; the total, each reading's phases summed; and the bytes transferred. */
export interface TimingRow {
  state: string;
  count: number;
  readable: Spread | null;
  wasmBeforeRun: string;
  first: Spread | null;
  phases: Map<string, Spread>;
  total: Spread | null;
  transferred: Spread | null;
}

/** The readings' answers to whether .wasm was requested before Run: "no" or "yes" when every
 * reading agrees, "yes in k of n" when they don't, and "-" when no reading asked. */
function before(answers: readonly boolean[]): string {
  if (answers.length === 0) return "-";
  const yes = answers.filter(Boolean).length;
  if (yes === 0) return "no";
  return yes === answers.length ? "yes" : `yes in ${yes} of ${answers.length}`;
}

/** The values the readings have, each reading's null left out. */
const present = (values: readonly (number | null)[]) =>
  values.filter((value): value is number => value !== null);

/** The state's readings aggregated into its row. */
export function aggregate({ state, readings }: StateReadings): TimingRow {
  const phases = new Map<string, Spread>();
  for (const phase of new Set(readings.flatMap((reading) => reading.phases.map((p) => p.phase)))) {
    const times = readings.flatMap((reading) =>
      reading.phases.filter((p) => p.phase === phase).map(({ ms }) => ms),
    );
    phases.set(phase, spread(times)!);
  }
  return {
    state,
    count: readings.length,
    readable: spread(present(readings.map(({ readable }) => readable))),
    wasmBeforeRun: before(
      readings.flatMap(({ wasmBeforeRun }) => (wasmBeforeRun === null ? [] : [wasmBeforeRun])),
    ),
    first: spread(present(readings.map(({ first }) => first))),
    phases,
    total: spread(readings.map((reading) => reading.phases.reduce((sum, { ms }) => sum + ms, 0))),
    transferred: spread(readings.map(({ transferred }) => transferred)),
  };
}

/** A time in ms as the tables give it: to a tenth under 10 ms, whole and grouped from there, as
 * the demo's timings table shows it. */
export const ms = (time: number) =>
  Math.round(time * 10) < 100 ? time.toFixed(1) : Math.round(time).toLocaleString("en-US");

/** A spread's cell, "median / max" in the unit's format, or "-" where there is none. */
const cell = (value: Spread | null | undefined, format: (n: number) => string) =>
  value ? `${format(value.median)} / ${format(value.max)}` : "-";

/** The timings' legend, before the pages' tables: what each state and each column reads, and how
 * many readings each timing is the median and max of. */
export function timingLegend(readings: number): string[] {
  return [
    `Desktop timings, live, in the pinned chrome-headless-shell at 1280×720: each cell the median / max of ${readings} ${readings === 1 ? "reading" : "readings"}, in ms, bytes in bytes`,
    "  cold: a fresh browser profile, its HTTP cache empty, the page opened and its demo's Run pressed",
    "  cached: then a fresh page, and its fresh worker, in that browser within the max-age, its Run answered from the HTTP cache",
    "  in place: then, on the cold page, a further Run on the worker it holds",
    "  Readable: the page's first-contentful-paint; .wasm before Run: whether any .wasm was requested before Run's click",
    "  First result: Run's click to the console's first output; the phases as the demo's timings show them, Total their sum",
    "  Run bytes: what the page and its workers transferred over the network from Run's click to the run's end, 0 when the HTTP cache answered all",
  ];
}

/** A page's timings: its name and path, then one table row per state, a column per phase any
 * state's run had, in the runtime's phase order, each labelled as the demo's timings label it;
 * then each reading that failed, by its state and reason. */
export function timingSection(
  name: string,
  path: string,
  states: readonly StateReadings[],
): string[] {
  const rows = states.map(aggregate);
  const labels = new Map(
    states.flatMap(({ readings }) =>
      readings.flatMap(({ phases }) => phases.map(({ phase, label }) => [phase, label] as const)),
    ),
  );
  const phases = [
    ...(PHASES as readonly string[]).filter((phase) => labels.has(phase)),
    ...[...labels.keys()].filter((phase) => !(PHASES as readonly string[]).includes(phase)),
  ];
  const lines = [
    `${name}, ${path}`,
    ...table(
      [
        [
          "State",
          "N",
          "Readable",
          ".wasm before Run",
          "First result",
          ...phases.map((phase) => labels.get(phase)!),
          "Total",
          "Run bytes",
        ],
        ...rows.map((row) => [
          row.state,
          String(row.count),
          cell(row.readable, ms),
          row.wasmBeforeRun,
          cell(row.first, ms),
          ...phases.map((phase) => cell(row.phases.get(phase), ms)),
          cell(row.total, ms),
          cell(row.transferred, bytes),
        ]),
      ],
      1,
    ),
  ];
  const failures = states.flatMap(({ state, failures }) =>
    failures.map((failure) => `  ${state}: ${failure}`),
  );
  if (failures.length > 0) lines.push("Not measured:", ...failures);
  return lines;
}

/** The report: the head, then each section, a blank line between. */
export function report(top: Head, sections: readonly string[][]): string {
  return `${[head(top), ...sections].map((lines) => lines.join("\n")).join("\n\n")}\n`;
}
