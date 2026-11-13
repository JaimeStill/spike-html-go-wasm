// mise run measure: evidence of the deployed site, as Pages serves it to a browser, printed and
// never judged. The base is the Pages URL, or the URL given as the one positional argument.
//
// Flags, so a development run spares the Pages bandwidth: --readings N, the readings of each
// timing, 5 by default, 0 for none and no browser; --pages a,b, the demo pages timed, by their keys
// (scripts/measure-timings.ts's PAGES), every page by default; and --skip-sizes, which leaves out
// the size table and the drift report, and with them the local builds and every module's fetch but
// hello's, which the head reads the deployed commit from.
//
// Sizes: each prebuilt module, <base>go/<name>.wasm for every entrypoint
// scripts/build-go-modules.sh builds, and the playground's compiler and linker, as the live
// manifest, <base>go/toolchain/manifest.json, names them; then each program the site builds in the
// page, its closure, the archives that program's build fetches: the closure the runtime computes
// (web/runtime/build.ts's programClosure) of playground/<program>/'s files, its tests left out, as
// the pages' fences hold them (test/unit/go-demo-fences.test.ts), against the live manifest. Every
// file is fetched with a browser's Accept-Encoding, gzip, deflate, br, its wire bytes counted
// undecoded (Pages serves gzip alone), then decoded for its raw bytes and weighed at brotli 11.
//
// Drift: the entrypoints built twice into TMPDIR by scripts/build-go-modules.sh, the site build's
// own flags, each with a GOCACHE of its own so neither reuses the other's work, held against each
// other byte for byte, and the live module against the first; each difference gives its byte
// counts and the build settings Go stamped differently (vcs.revision, vcs.time, vcs.modified).
//
// Timings: each demo page's Run, cold, cached, and in place, in the pinned chrome-headless-shell
// with the network allowed, each timing the median and max of the readings, one table per page;
// scripts/measure-timings.ts reads them.
//
// The head names the deployed commit: the vcs.revision Go stamped into the live hello.wasm, and,
// for the Pages URL, the latest successful github-pages deployment gh reports for the checkout's
// repository, with whether the two agree. Exits 0 whatever it measured, a failed reading reported
// by its reason; exits 1 only when an argument can't be taken, the manifest can't be read, as
// nothing can be weighed against it, the local build fails, or BROWSER_EXECUTABLE names no
// browser. Never a part of mise run check. Reads the network and gh; writes nothing outside
// TMPDIR, the browser's profiles among it. scripts/measure-report.ts holds the pure parts, which
// test/unit/measure.test.ts runs.

import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { get as httpGet, type IncomingMessage } from "node:http";
import { get as httpsGet } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

import type { BuildFile } from "../web/runtime/build.ts";
import { programClosure } from "../web/runtime/build.ts";
import type { Manifest } from "../web/runtime/manifest.ts";
import {
  buildSettings,
  closureRow,
  compare,
  type Drift,
  driftSection,
  moduleRow,
  report,
  type SizeRow,
  sizeSection,
  timingLegend,
  timingSection,
  weigh,
  type Weight,
} from "./measure-report.ts";
import { pagesFor, timings } from "./measure-timings.ts";

/** The site's URL on Pages, the base when no argument gives one. */
const pages = "https://jaimestill.github.io/spike-html-go-wasm/";

/** The repository's root, where go.mod and playground/ are. */
const root = join(import.meta.dirname, "..");

/** The programs the site builds in the page, each playground/<name>/: the playground's five, the
 * starter first, then the sqlate page's and the graph page's. */
const programs = ["calc", "basics", "generics", "concurrency", "stdlib", "sqlate", "graph"];

/** The Accept-Encoding a browser sends. */
const accept = "gzip, deflate, br";

/** How many files are fetched at once. */
const parallel = 8;

/** One response as it came over the wire: its status, the headers read here, and its body's bytes
 * undecoded. */
interface Wire {
  status: number;
  encoding: string | null;
  cacheControl: string | null;
  bytes: Buffer;
}

/** `url` fetched with a browser's Accept-Encoding, its body left as served: fetch() would decode
 * it, losing the wire's count. Rejects when no response comes back. */
function wire(url: URL): Promise<Wire> {
  const get = url.protocol === "http:" ? httpGet : httpsGet;
  return new Promise((resolve, reject) => {
    get(url, { headers: { "Accept-Encoding": accept } }, (response: IncomingMessage) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer) => chunks.push(chunk));
      response.on("error", reject);
      response.on("end", () =>
        resolve({
          status: response.statusCode ?? 0,
          encoding: response.headers["content-encoding"] ?? null,
          cacheControl: response.headers["cache-control"] ?? null,
          bytes: Buffer.concat(chunks),
        }),
      );
    }).on("error", reject);
  });
}

/** A file weighed, with its decoded body, or the reason it couldn't be. */
type Weighed = { weight: Weight; body: Buffer; cacheControl: string | null } | string;

/** `url` fetched and weighed; a status other than 200 or a failed request is its reason. */
async function weighed(url: URL): Promise<Weighed> {
  try {
    const response = await wire(url);
    if (response.status !== 200) return `${url.pathname}: ${response.status}`;
    const { weight, body } = await weigh(response.bytes, response.encoding);
    return { weight, body, cacheControl: response.cacheControl };
  } catch (error) {
    return `${url.pathname}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

/** Each of `items` mapped by `work`, at most `parallel` at once, in order. */
async function pooled<T, R>(items: readonly T[], work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const at = next++;
      results[at] = await work(items[at]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, items.length) }, worker));
  return results;
}

/** `command args` in the repository's root under `env`, its stdout; rejects with its stderr. */
function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
    child.on("error", (error) => reject(new Error(`${command} didn't run: ${error.message}`)));
    child.on("close", (code) =>
      code === 0
        ? resolve(stdout)
        : reject(new Error(`${command} ${args.join(" ")} exited ${code}: ${stderr.trim()}`)),
    );
  });
}

/** The entrypoints built into `scratch`/<label>/, with a GOCACHE of their own; each one's bytes
 * by its name. */
async function localBuild(scratch: string, label: string): Promise<Map<string, Buffer>> {
  const out = join(scratch, label);
  await run("scripts/build-go-modules.sh", [out], {
    ...process.env,
    GOCACHE: join(scratch, `${label}-cache`),
  });
  return new Map(
    readdirSync(out)
      .filter((file) => file.endsWith(".wasm"))
      .toSorted()
      .map((file) => [file.slice(0, -".wasm".length), readFileSync(join(out, file))]),
  );
}

/** playground/<program>/'s files, its tests left out, as the page builds them. */
function programFiles(program: string): BuildFile[] {
  const directory = join(root, "playground", program);
  return readdirSync(directory)
    .filter((name) => !name.endsWith("_test.go"))
    .toSorted()
    .map((name) => ({ name, text: readFileSync(join(directory, name), "utf8") }));
}

/** The latest successful github-pages deployment of the checkout's repository, as gh reports it:
 * its commit and when it was created; or the reason it couldn't be read. */
async function deployment(): Promise<{ sha: string; created: string } | string> {
  try {
    const listed = JSON.parse(
      await run("gh", [
        "api",
        "repos/{owner}/{repo}/deployments?environment=github-pages&per_page=10",
      ]),
    ) as { id: number; sha: string; created_at: string }[];
    for (const { id, sha, created_at } of listed) {
      const statuses = JSON.parse(
        await run("gh", ["api", `repos/{owner}/{repo}/deployments/${id}/statuses?per_page=1`]),
      ) as { state: string }[];
      if (statuses[0]?.state === "success") return { sha, created: created_at };
    }
    return "no successful github-pages deployment among the latest 10";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

/** The deployed commit, as the head names it: the live hello module's stamp, and for the Pages
 * URL, gh's deployment beside it. */
async function deployedCommit(base: string, hello: Buffer | undefined): Promise<string> {
  const stamped = hello && buildSettings(hello);
  const revision = stamped?.get("vcs.revision");
  const fromModule = revision
    ? `${revision} (go/hello.wasm's vcs.revision, vcs.time ${stamped?.get("vcs.time") ?? "none"}, vcs.modified ${stamped?.get("vcs.modified") ?? "none"})`
    : "not stamped in go/hello.wasm";
  if (base !== pages) return fromModule;
  const deployed = await deployment();
  const fromPages =
    typeof deployed === "string"
      ? `github-pages deployment not read: ${deployed}`
      : `github-pages deployment ${deployed.sha} at ${deployed.created}, ${deployed.sha === revision ? "agrees" : "differs"}`;
  return `${fromModule}; ${fromPages}`;
}

/** What the command line asks: the base, the readings of each timing, the pages timed by their
 * keys, every page when none are named, and whether the sizes and the drift are left out. */
interface Options {
  base: string;
  readings: number;
  pages: string[] | undefined;
  skipSizes: boolean;
}

/** The options the arguments give; throws naming an argument it can't take. */
function options(args: string[]): Options {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      readings: { type: "string", default: "5" },
      pages: { type: "string" },
      "skip-sizes": { type: "boolean", default: false },
    },
  });
  if (positionals.length > 1) throw new Error(`one base URL, not ${positionals.join(" ")}`);
  const readings = Number(values.readings);
  if (!Number.isInteger(readings) || readings < 0) {
    throw new Error(`--readings takes a whole number, 0 or more, not ${values.readings}`);
  }
  return {
    base: positionals[0] ?? pages,
    readings,
    pages: values.pages?.split(",").map((key) => key.trim()),
    skipSizes: values["skip-sizes"],
  };
}

/** The size table's and the drift report's sections for the site, the local builds in `scratch`,
 * and the live hello module's bytes, which the head reads. */
async function sizesAndDrift(
  site: URL,
  scratch: string,
): Promise<{ sections: string[][]; hello: Buffer | undefined }> {
  // The two local builds run first, one after the other, so they never contend with each other
  // or with the brotli weighing for the machine.
  const first = await localBuild(scratch, "first");
  const second = await localBuild(scratch, "second");

  const manifestURL = new URL("go/toolchain/manifest.json", site);
  const manifestWire = await wire(manifestURL);
  if (manifestWire.status !== 200) {
    throw new Error(`${manifestURL.href}: ${manifestWire.status}, nothing to weigh against`);
  }
  const { body: manifestBody } = await weigh(manifestWire.bytes, manifestWire.encoding);
  const manifest = JSON.parse(manifestBody.toString("utf8")) as Manifest;

  const names = [...first.keys()];
  const modules = await pooled(names, (name) => weighed(new URL(`go/${name}.wasm`, site)));
  const tools = await pooled([manifest.compile, manifest.link], (path) =>
    weighed(new URL(path, manifestURL)),
  );

  const closures = programs.map((program) => {
    try {
      const archives = programClosure(manifest, programFiles(program)).flatMap((path) => {
        const archive = manifest.packages[path]?.archive;
        return archive ? [archive] : [];
      });
      return { program, archives };
    } catch (error) {
      return { program, archives: error instanceof Error ? error.message : String(error) };
    }
  });
  const wanted = [
    ...new Set(closures.flatMap(({ archives }) => (Array.isArray(archives) ? archives : []))),
  ];
  const fetched = await pooled(wanted, (path) => weighed(new URL(path, manifestURL)));
  const archives = new Map(wanted.map((path, at) => [path, fetched[at]]));

  const failures: string[] = [];
  const rows: SizeRow[] = [];
  const row = (name: string, file: Weighed) => {
    if (typeof file === "string") failures.push(`${name}: ${file}`);
    else rows.push(moduleRow(name, file.weight));
  };
  names.forEach((name, at) => row(`${name}.wasm`, modules[at]));
  row("compile (toolchain)", tools[0]);
  row("link (toolchain)", tools[1]);
  for (const { program, archives: paths } of closures) {
    if (typeof paths === "string") {
      failures.push(`${program} closure: ${paths}`);
      continue;
    }
    const weights = paths.flatMap((path) => {
      const file = archives.get(path);
      if (typeof file === "string" || file === undefined) {
        failures.push(`${program} closure: ${file ?? `${path} not fetched`}`);
        return [];
      }
      return [{ path, weight: file.weight }];
    });
    rows.push(closureRow(`${program} closure`, weights));
  }

  const drifts: Drift[] = names.map((name, at) => {
    const local = first.get(name)!;
    const live = modules[at];
    return {
      name,
      local: compare(local, second.get(name)!),
      live: typeof live === "string" ? live : compare(local, live.body),
    };
  });

  const hello = modules[names.indexOf("hello")];
  const maxAge =
    [...modules, ...tools]
      .map((file) => (typeof file === "string" ? null : file.cacheControl))
      .find((value) => value)
      ?.match(/max-age=(\d+)/)?.[1] ?? null;

  const sizes = sizeSection(rows, maxAge === null ? "not sent" : `${maxAge} s`);
  if (failures.length > 0) sizes.push("", "Not weighed:", ...failures.map((f) => `  ${f}`));
  return {
    sections: [sizes, driftSection(drifts)],
    hello: typeof hello === "string" ? undefined : hello?.body,
  };
}

/** Prints the report the options ask for. */
async function main({ base, readings, pages: keys, skipSizes }: Options): Promise<void> {
  const site = new URL(base.endsWith("/") ? base : `${base}/`);
  const date = new Date().toISOString();
  // Before anything is fetched, so a key no page has fails at once.
  const timed = pagesFor(keys);
  const scratch = mkdtempSync(join(tmpdir(), "measure-"));
  try {
    const sections: string[][] = [];
    let hello: Buffer | undefined;
    if (skipSizes) {
      const file = await weighed(new URL("go/hello.wasm", site));
      hello = typeof file === "string" ? undefined : file.body;
    } else {
      const measured = await sizesAndDrift(site, scratch);
      sections.push(...measured.sections);
      hello = measured.hello;
    }
    if (readings > 0) {
      sections.push(timingLegend(readings));
      for (const { page, states } of await timings(site.href, timed, readings, scratch)) {
        sections.push(timingSection(page.name, page.path, states));
      }
    }
    const commit = await deployedCommit(site.href, hello);
    process.stdout.write(report({ base: site.href, commit, date }, sections));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  await main(options(process.argv.slice(2)));
}
