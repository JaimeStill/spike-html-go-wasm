// The sqlate page's script (sqlate.html): it defines sl-go-demo, by importing its module, and gives
// the page's one demo, written in the page in the source mode, the page's one runner, the
// runtime's Runner, which TypeScript checks against the demo's declared subset, DemoRunner, where
// the page creates it. The demo builds its files from its own fences, playground/sqlate's, so the
// page keeps no file set of its own. Nothing here loads Go on load: the runner starts its worker
// and fetches the toolchain, sqlate's archives among the standard library's, only on the demo's
// Run.
//
// The demo is fixed, as tall as its row of the page's grid, as the playground's is; nothing here
// measures or sizes it. The page owns the reader's arrangement, which places the demo's parts from
// 64rem, shared with the playground under the spike's one key (arrangement.ts): it reads the stored
// choice before first paint, this module blocking render, and stores each choice the demo's Layout
// menu requests.

import "../components/go-demo.ts";
import type { DemoRunner } from "../components/go-demo.ts";
import { Runner } from "../runtime/runner.ts";
import { keep } from "./arrangement.ts";

/** The page's one runner, checked here, at compile time, against the subset sl-go-demo declares.
 * It starts no worker and fetches nothing until the demo's Run. */
const runner = new Runner() satisfies DemoRunner;

const demo = document.querySelector("sl-go-demo");
if (!demo) throw new Error("sqlate.html has no sl-go-demo");

demo.runner = runner;
keep();
