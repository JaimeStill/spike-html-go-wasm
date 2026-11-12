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
// autocomplete is off, so the browser restores no choice over a fresh set.
//
// The fragment names the program shown, #calc, #basics, #generics, #concurrency, or #stdlib, the
// select's values: the page opens on the program it names, and with no fragment, or one that names
// no program, on the calculator. A choice in the select writes its fragment as a new history entry,
// so Back and Forward step through the reader's choices; those steps, and a fragment the reader
// edits, show the program it then names, with its edits as they left them, and the select follows.
// Each other program's template carries its fragment as its id, so a link to it names an element
// on the page; a template renders nothing, so following one scrolls nothing.

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
  return new FileSet(readFences(template ? template.content : demo, true));
};

/** Every program's set, by the program's name, the select's options' values. */
const programs = new Map([...picker.options].map(({ value }) => [value, shipped(value)]));

/** The program the fragment names, or the calculator when it names none. */
const named = (): string => {
  const program = location.hash.slice(1);
  return programs.has(program) ? program : CALCULATOR;
};

/** Shows the program: the select chooses it and the demo is given its set. Giving the set the
 * demo already holds changes nothing. */
const show = (program: string) => {
  picker.value = program;
  demo.files = programs.get(program) ?? null;
};

demo.runner = runner;
show(named());
picker.addEventListener("change", () => {
  history.pushState(null, "", `#${picker.value}`);
  show(picker.value);
});
// Back, Forward, and an edited fragment: a fragment's change by any of them fires hashchange, but a
// pushState doesn't, so the select's own choice isn't shown twice.
addEventListener("hashchange", () => show(named()));
keep();
