// The playground's script (playground.html): it defines sl-go-demo, by importing its module, and
// gives the page's one demo, written in the page in the source mode, the page's one runner, the
// runtime's Runner, which TypeScript checks against the demo's declared subset, DemoRunner, where
// the page creates it. Nothing here loads Go on load: the runner starts its worker and fetches the
// toolchain only on the demo's Run.
//
// The demo is fixed, as tall as its row of the page's grid, which the page's CSS makes the
// viewport's rows left under the header, the heading, and the lede, less the page's gutter;
// nothing here measures or sizes it.
//
// The page owns the reader's arrangement, which places the demo's parts from 64rem: it reads the
// stored choice before first paint, this module blocking render, and stores each choice the demo's
// Layout menu requests (arrangement.ts).
//
// The page owns the programs' files too, one FileSet per program, each the only writer's, the
// demo's, while the demo shows it. The Program select, beside the heading, names the programs, an
// option each, its value the program's name; the calculator's files are the demo's own fences, and
// every other program's are the fences of the page's template whose data-program names it. Each
// set is built once, on load, from those fences by the demo's own rules (fences.ts), editable, its
// first file active, and kept for the tab's life: choosing a program gives the demo its set, in
// place, with no reload and no request, so a program's edits, its added files, and its active file
// are as the reader left them when they come back to it. Reset, the demo's, restores the set on
// screen alone. A choice while a run is pending stops it, and clears the console and the timings,
// as the demo does on any switch. A reload builds every set afresh, as shipped: the select's
// autocomplete is off, so the browser restores no choice over a fresh set, and the page opens on
// the select's default, Calculator.

import { readFences } from "../components/fences.ts";
import { FileSet } from "../components/file-set.ts";
import "../components/go-demo.ts";
import type { DemoRunner } from "../components/go-demo.ts";
import { Runner } from "../runtime/runner.ts";
import { keep } from "./arrangement.ts";

/** The page's one runner: the runtime's Runner, checked here, at compile time, against the subset
 * sl-go-demo declares. It starts no worker and fetches nothing until the demo's Run. */
const runner = new Runner() satisfies DemoRunner;

const demo = document.querySelector("sl-go-demo");
if (!demo) throw new Error("playground.html has no sl-go-demo");
const picker = document.querySelector<HTMLSelectElement>("select#program");
if (!picker) throw new Error("playground.html has no Program select");

/** The program whose files are the demo's own fences, not a template's. */
const CALCULATOR = "calc";

/** The program's files as shipped, a set built from its fences, editable, its first file active:
 * the demo's own fences for the calculator, else its template's. */
const shipped = (program: string): FileSet => {
  const template = document.querySelector<HTMLTemplateElement>(
    `template[data-program="${CSS.escape(program)}"]`,
  );
  if (program !== CALCULATOR && !template) {
    throw new Error(`playground.html has no template for the program ${program}`);
  }
  const fences = readFences(template ? template.content : demo, true);
  return new FileSet(fences.map(({ name, text }) => ({ name, text })));
};

/** Every program's set, by the program's name, the select's options' values. */
const programs = new Map([...picker.options].map(({ value }) => [value, shipped(value)]));

/** Gives the demo the chosen program's set. */
const show = () => {
  demo.files = programs.get(picker.value) ?? null;
};

demo.runner = runner;
show();
picker.addEventListener("change", show);
keep();
