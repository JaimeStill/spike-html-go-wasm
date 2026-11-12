// The playground's script (playground.html): it defines sl-go-demo, by importing its module, and
// gives the page's one demo, written in the page in the source mode, the page's one runner, the
// runtime's Runner, which TypeScript checks against the demo's declared subset, DemoRunner, where
// the page creates it. Nothing here loads Go on load: the runner starts its worker and fetches the
// toolchain only on the demo's Run.
//
// The demo is fixed, as tall as the dynamic viewport less --sl-go-demo-inset: the page sets it to
// its header's height, as the header lays out, since that height follows the reader's space and
// type profiles and the viewport's width, which no length in the page's CSS could know.

import "../components/go-demo.ts";
import type { DemoRunner } from "../components/go-demo.ts";
import { Runner } from "../runtime/runner.ts";

/** The page's one runner: the runtime's Runner, checked here, at compile time, against the subset
 * sl-go-demo declares. It starts no worker and fetches nothing until the demo's Run. */
const runner = new Runner() satisfies DemoRunner;

const demo = document.querySelector("sl-go-demo");
if (!demo) throw new Error("playground.html has no sl-go-demo");
demo.runner = runner;

const header = document.querySelector("body > header");
if (!header) throw new Error("playground.html has no header");
// The header's border-box block size, the demo's inset, each time the header lays out anew.
new ResizeObserver(([entry]) => {
  const height = entry.borderBoxSize[0]?.blockSize ?? header.getBoundingClientRect().height;
  demo.style.setProperty("--sl-go-demo-inset", `${height}px`);
}).observe(header);
