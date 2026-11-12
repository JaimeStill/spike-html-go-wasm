// The playground's script (playground.html): it defines sl-go-demo, by importing its module, and
// gives the page's one demo, written in the page in the source mode, the page's one runner, the
// runtime's Runner, which TypeScript checks against the demo's declared subset, DemoRunner, where
// the page creates it. Nothing here loads Go on load: the runner starts its worker and fetches the
// toolchain only on the demo's Run.
//
// The demo is fixed, as tall as its row of the page's grid, which the page's CSS makes the
// viewport's rows left under the header, the heading, the intro, and the disclosure, less the
// page's gutter; nothing here measures or sizes it.
//
// The page owns the reader's arrangement, which places the demo's parts from 64rem: it reads the
// stored choice before first paint, this module blocking render, and stores each choice the demo's
// Layout menu requests (arrangement.ts).

import "../components/go-demo.ts";
import type { DemoRunner } from "../components/go-demo.ts";
import { Runner } from "../runtime/runner.ts";
import { keep } from "./arrangement.ts";

/** The page's one runner: the runtime's Runner, checked here, at compile time, against the subset
 * sl-go-demo declares. It starts no worker and fetches nothing until the demo's Run. */
const runner = new Runner() satisfies DemoRunner;

const demo = document.querySelector("sl-go-demo");
if (!demo) throw new Error("playground.html has no sl-go-demo");
demo.runner = runner;
keep();
