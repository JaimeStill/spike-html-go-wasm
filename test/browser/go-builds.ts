// The browser tier's hold on a build in the page, shared by go-build.test.ts, which proves the
// build through the components page's source demo, and playground.test.ts, which proves it on the
// playground: the manifest the site build wrote, the archives of an import closure by its names,
// the toolchain's requests a watched page sent (go-demos.ts), and a source demo's edit, Run, and
// timings. Every wait is bounded.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Page } from "@jaimestill/spike-html-apps-tooling/browser.js";

import { closure, type Manifest } from "../../web/runtime/manifest.ts";
import { pressControl, says, shown, type Shown, type Watched } from "./go-demos.ts";

const root = join(import.meta.dirname, "../..");

/** How long a build and its run may take to settle: a cold one fetches and compiles the 52 MB
 * compiler. */
export const BUILD = 120_000;

/** How long a build of the sqlate program may take to settle: a cold one fetches and compiles the
 * compiler too, and fetches, reads, and links a closure of about 220 archives, PostgreSQL's
 * driver's pgtype the largest. */
export const SQLATE_BUILD = 2 * BUILD;

/** The phases a build and its run show, in phase order. */
export const BUILT_PHASES = ["Fetch", "Wasm compile", "Go compile", "Link", "Instantiate", "Run"];

/** The status of a built main that exited 0. */
export const DONE = "Finished main, exit code 0";

/** The manifest the build wrote, which the page's builds read. */
export const manifest = JSON.parse(
  readFileSync(join(root, "dist/go/toolchain/manifest.json"), "utf8"),
) as Manifest;

/** The archives of the imports' closure, as the manifest names them. */
export const archivesOf = (imports: string[]) =>
  closure(manifest, imports).flatMap((path) => manifest.packages[path].archive ?? []);

/** The compiler and the linker, as the manifest names them. */
export const TOOLS = [manifest.compile, manifest.link];

/** The toolchain's files requested, by path under go/toolchain/, from the index'th request on. */
export const toolchainRequests = ({ origin, requests }: Watched, from = 0) =>
  requests
    .slice(from)
    .map((url) => new URL(url, origin).pathname)
    .flatMap((path) => {
      const at = path.indexOf("/go/toolchain/");
      return at < 0 ? [] : [path.slice(at + "/go/toolchain/".length)];
    });

/** Replaces the demo's active file's text by typing it over the editor's selected text. */
export async function retype(page: Page, target: string, text: string) {
  await page.evaluate(`(() => {
    const text = window.demos.editor(${target}).shadowRoot.querySelector(".text");
    text.focus();
    getSelection().selectAllChildren(text);
  })()`);
  await page.cdp("Input.insertText", { text });
}

/** Presses the demo's Run and answers what it shows once its status says the text, within a
 * build's bound, BUILD unless another is given. */
export async function build(
  page: Page,
  target: string,
  finished: string,
  bound = BUILD,
): Promise<Shown> {
  await pressControl(page, target, "run");
  await says(page, target, finished, bound);
  return shown(page, target);
}

/** The phases as the timings show them, each with its time, for a test's diagnostics. */
export const timed = ({ phases, times }: Shown) =>
  phases.map((phase, index) => `${phase} ${times[index]} ms`).join(", ");
