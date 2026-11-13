// The browser tier's hold on the playground's Program select, shared by playground-programs.test.ts,
// which proves the select, and mise run measure's desktop timings (scripts/measure-timings.ts),
// which switch the program in place: the select, each program's files in the demo's order, and a
// reader's choice of a program. Every wait is bounded.

import { until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Page } from "@jaimestill/spike-html-apps-tooling/browser.js";

import { PLAYGROUND } from "./playground-layouts.ts";

/** The Program select. */
export const PICKER = `document.querySelector("main > .prose > .title select#program")`;

/** Each program's files, in the demo's order. */
export const FILES: Record<string, string[]> = {
  calc: ["main.go", "lexer.go", "parser.go", "eval.go", "input.txt"],
  basics: ["main.go", "shapes.go"],
  generics: ["main.go", "stack.go"],
  concurrency: ["main.go", "pipeline.go"],
  stdlib: ["main.go", "input.json"],
};

/** Chooses the program in the select, as a reader's choice changes it, and waits until the demo's
 * tabs show the program's files, the names given, its shipped ones by default. */
export async function choose(page: Page, program: string, names = FILES[program]) {
  await page.evaluate(`(() => {
    const picker = ${PICKER};
    picker.value = ${JSON.stringify(program)};
    picker.dispatchEvent(new Event("input", { bubbles: true }));
    picker.dispatchEvent(new Event("change", { bubbles: true }));
  })()`);
  await until(
    page,
    `[...window.demos.part(${PLAYGROUND}, "sl-file-tabs").shadowRoot
      .querySelectorAll('[role="tab"]')].map((tab) => tab.dataset.name).join()
      === ${JSON.stringify(names.join())}`,
    2000,
  );
}
