// The timings, Lit with a shadow root: a RunTimings (run-timings.ts) shown as a labelled table of
// the last run's phases, each phase's time in ms, and their total. The timings' owner, the page or
// the element composing the timings over a runner, writes them; the table renders from them,
// re-renders on their change event, and never writes them. It shows only the phases the run had,
// in the runtime's phase order, so a held instance's call is one row, a cold load five, and a
// built program's cold run six; a new run replaces the last, as the timings do. The runtime's
// compile phase, WebAssembly's, is "Wasm compile", apart from a build's "Go compile".
//
// The table is a table to assistive technology: named by its caption, the phases' names its row
// headers, under a column header for each. The times are right-aligned in tabular numerals, so
// their digits line up, formatted by Intl.NumberFormat as ms: a tenth of a ms under 10 ms, where a
// tenth is a tenth of the time, and whole ms from there. Nothing moves.

import { html, LitElement, nothing, type PropertyDeclarations } from "lit";

import elements from "@jaimestill/spike-html-apps-foundation/baseline/elements.css" with { type: "css" };
import reset from "@jaimestill/spike-html-apps-foundation/baseline/reset.css" with { type: "css" };
import { define } from "@jaimestill/spike-html-apps-foundation/dom.js";

import type { Phase, RunTimings } from "./run-timings.ts";
import { Subscription } from "./subscription.ts";
import styles from "./timings.css" with { type: "css" };

/** The tag the element defines. */
export const tagName = "sl-timings";

/** Each phase's name as the table's row header gives it. */
const NAMES: Readonly<Record<Phase, string>> = Object.freeze({
  fetch: "Fetch",
  compile: "Wasm compile",
  "go-compile": "Go compile",
  link: "Link",
  instantiate: "Instantiate",
  start: "Start",
  call: "Call",
  run: "Run",
});

/** Times under 10 ms, to a tenth, and from 10 ms, whole. */
const tenths = new Intl.NumberFormat("en-US", {
  style: "unit",
  unit: "millisecond",
  unitDisplay: "short",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const whole = new Intl.NumberFormat("en-US", {
  style: "unit",
  unit: "millisecond",
  unitDisplay: "short",
  maximumFractionDigits: 0,
});

/** A time as the table shows it, "0.4 ms", "9.9 ms", "10 ms", "1,234 ms": to a tenth while it
 * rounds to under 10 ms, and whole from there, so 9.96 shows as "10 ms", never "10.0 ms". */
export function formatMs(ms: number): string {
  return Math.round(ms * 10) < 100 ? tenths.format(ms) : whole.format(ms);
}

/**
 * The last run's timings as a table. `timings`, a RunTimings its owner writes and the table only
 * reads, gives a row for each phase the current run has, in the runtime's phase order, its name
 * and its time, and a total row; with no run yet, or a run with no phase timed yet, the table says
 * so in a row of its own and has no total. The table is named by its caption, `label`, "Timings"
 * by default.
 *
 * Events: none; Slots: none; Keyboard: none, as the table holds nothing to operate.
 */
export class TimingsTable extends LitElement {
  static styles = [reset, elements, styles];

  static properties = {
    timings: { attribute: false },
    label: { type: String },
  } satisfies PropertyDeclarations;

  /** The timings the table renders from, which their owner writes and the table never does; null
   * shows no run yet. */
  declare timings: RunTimings | null;
  /** The table's accessible name, its caption. */
  declare label: string;

  constructor() {
    super();
    this.timings = null;
    this.label = "Timings";
    // Renders again as the timings it holds change, while it is in the document.
    new Subscription(
      this,
      () => this.timings,
      () => this.requestUpdate(),
    );
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Reconnected, it shows the timings as they now are.
    if (this.hasUpdated) this.requestUpdate();
  }

  render() {
    const timings = this.timings;
    const phases = timings?.phases ?? [];
    const body =
      phases.length === 0
        ? html`<tr>
            <td class="empty" colspan="2">
              ${(timings?.runs ?? 0) === 0 ? "No run yet." : "No phase timed yet."}
            </td>
          </tr>`
        : phases.map(
            ({ phase, ms }) =>
              html`<tr data-phase=${phase}>
                <th scope="row">${NAMES[phase]}</th>
                <td class="time">${formatMs(ms)}</td>
              </tr>`,
          );
    // The total row, only under phases: with none, there is nothing to total.
    const total =
      phases.length === 0
        ? nothing
        : html`<tfoot>
            <tr>
              <th scope="row">Total</th>
              <td class="time">${formatMs(timings?.total ?? 0)}</td>
            </tr>
          </tfoot>`;
    return html`<table>
      <caption>
        ${this.label}
      </caption>
      <thead>
        <tr>
          <th scope="col">Phase</th>
          <th scope="col" class="time">Time</th>
        </tr>
      </thead>
      <tbody>
        ${body}
      </tbody>
      ${total}
    </table>`;
  }
}

define(tagName, TimingsTable);

declare global {
  interface HTMLElementTagNameMap {
    "sl-timings": TimingsTable;
  }
}
