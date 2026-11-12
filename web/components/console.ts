// The console, Lit with a shadow root: a ConsoleLog (console-log.ts) shown as a labelled log, its
// output lines, exits, and results in the order they arrived. The log's owner, the page or the
// element composing the console over a runner, writes it; the console renders from it, follows
// its change events, and never writes it. Clear sends a clear request the owner applies, so the
// console empties only when the log does. Copy changes nothing: it puts the log's text on the
// clipboard itself, and says so in a polite status that clears after a moment.
//
// Throughput: a chatty program sends thousands of writes, each a change. The console never
// re-renders on a change: it asks for one animation frame, and renders once in it whatever changed
// since the last, so a frame costs the entries it adds, the one at the end that changed, and those
// the limit dropped from the front, and never the whole log. The lines are the console's own
// elements, appended and removed by the entries' sequence numbers, outside Lit's template, which
// renders only the frame, the bar above it, and the empty state; an entry's row is built once, and
// again only if it is the last and changed, a line a later write continued. The frame is sized by
// its own max-block-size, never as a flex item of the host: a flex column sizes an item by its
// content, laying out every row again on each append, which cost a frame about 50 ms at the limit
// in Chrome 157; a block's layout steps over the rows that didn't change. A filling console's
// frame is a grid item, its size contained, so no container measures its rows at all.
//
// The log is quiet: role log, which would announce every addition, with aria-live off, so no write
// is read out as it arrives; a reader moves through it as through any text. It is in the tab order,
// so the keyboard scrolls it. It follows the tail, showing the newest entry as it arrives, unless
// the reader has scrolled up from the end; once they scroll back to the end it follows again. The
// jump to the end is instant, never smooth, so there is no motion to reduce, and a fast run's
// output can't outrun it.
// From spike-html-apps-components (19d4f59): src/event-log.ts, its atEnd.

import { html, LitElement, nothing, render, type PropertyDeclarations } from "lit";

import elements from "@jaimestill/spike-html-apps-foundation/baseline/elements.css" with { type: "css" };
import reset from "@jaimestill/spike-html-apps-foundation/baseline/reset.css" with { type: "css" };
import { define } from "@jaimestill/spike-html-apps-foundation/dom.js";
import glyphButton from "@jaimestill/spike-html-hosting-components/glyph-button.css" with { type: "css" };

import styles from "./console.css" with { type: "css" };
import { type ConsoleEntry, type ConsoleLog, entryText } from "./console-log.ts";
import { checkCircle, copy, trash, xCircle } from "./glyphs.ts";
import { Subscription } from "./subscription.ts";

/** The tag the element defines. */
export const tagName = "sl-console";

/** How long Copy's confirmation shows, in ms, before the status clears. */
const CONFIRMATION = 2000;

/** The text as the console shows it: a control character other than a tab or a line break as its
 * Unicode control picture, so an ANSI escape shows as "␛[31m" rather than as nothing, and DEL as
 * "␡". The log, and so Copy, keep the characters themselves. */
export function visible(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, (character) => {
    const code = character.charCodeAt(0);
    return String.fromCharCode(code === 0x7f ? 0x2421 : 0x2400 + code);
  });
}

/**
 * Whether a frame is scrolled to its end, as far as the browser can tell, as sl-event-log's: its
 * integer heights and its scroll position, snapped to the device pixel, leave up to two pixels
 * between, and more under a CSS zoom below 1, where a device pixel is more than a CSS one.
 */
function atEnd(frame: HTMLElement): boolean {
  const zoom = Math.min((frame.currentCSSZoom as number | undefined) ?? 1, 1);
  return frame.scrollHeight - frame.clientHeight - frame.scrollTop <= 2 / zoom;
}

/** The count of dropped lines as the bar says it. */
const droppedText = (count: number) =>
  `${count.toLocaleString("en-US")} earlier ${count === 1 ? "line" : "lines"} dropped`;

/** A row element of the tag and class, its data-* attributes set. */
function element(tag: string, className: string, data: Record<string, string> = {}): HTMLElement {
  const row = document.createElement(tag);
  row.className = className;
  Object.assign(row.dataset, data);
  return row;
}

/** An entry's row. An output line is its text, a stderr line led by its cue; an exit is a status
 * line, and a result a block of its own, each led by a glyph and naming whether it went well in
 * words, so nothing rests on color alone. */
function row(entry: ConsoleEntry): HTMLElement {
  switch (entry.kind) {
    case "output": {
      const line = element("div", "line", { stream: entry.stream });
      // The cue: "err", seen in the gutter; "stderr", said. Neither is selected with the text.
      if (entry.stream === "stderr") {
        const seen = element("span", "seen");
        seen.textContent = "err";
        seen.ariaHidden = "true";
        const said = element("span", "hidden");
        said.textContent = "stderr: ";
        const cue = element("span", "cue");
        cue.append(seen, said);
        line.append(cue);
      }
      line.append(visible(entry.text));
      return line;
    }
    case "exit": {
      const ok = entry.code === 0;
      const line = element("div", "exit", { ok: String(ok) });
      render(html`${ok ? checkCircle : xCircle}<span>${entryText(entry)}</span>`, line);
      return line;
    }
    case "result": {
      const block = element("div", "result", { ok: String(entry.ok) });
      render(
        html`<div class="head">${entry.ok ? checkCircle : xCircle}<span
            >${entry.ok ? "Result" : "Error"}</span
          ></div>
          <div class="body">${visible(entry.text)}</div>`,
        block,
      );
      return block;
    }
  }
}

/**
 * A console. `log`, a ConsoleLog its owner writes and the console only reads, gives what it shows:
 * each output line as written, keeping its line breaks and wrapping where it is longer than the
 * console is wide; stdout plain; stderr on its own color, the palette's red mixed into the
 * surface, with a red rule at its start and a cue, "err", in its gutter, said as "stderr"; an exit
 * as a status line, "<scenario> exited with code <code>", led by a tick for 0 and a cross for any
 * other; and a result as a block of its own, headed "Result" or "Error" with the same glyphs. A
 * control character shows as its control picture, an ANSI escape's ESC as "␛". With no entry, it
 * says there is no output yet; with entries dropped, the bar above the log says how many, and the
 * log is described by it. With no log, it shows the empty state.
 *
 * The log is named by `label`, "Output" by default. It grows with its lines up to 24rem, or the
 * length the page sets as --sl-console-max-block-size on the host, and scrolls inside. With `fill`,
 * it grows with nothing: the console fills the block size its container gives the host, the bar
 * above and the log taking the rest, whatever it holds, and the log scrolls inside that.
 *
 * Copy, a glyph button, puts the log's text (ConsoleLog's text()) on the clipboard and confirms it
 * in a polite status for two seconds. Clear, another, sends a clear request. Both are named, show
 * their names on hover and keyboard focus, and are aria-disabled, staying focusable, while the log
 * is empty.
 *
 * Events: `clear`, an Event, bubbling and not composed, when Clear is pressed with entries shown:
 * a request, which changes nothing until the owner applies it with the log's clear().
 *
 * Keyboard: Tab reaches Copy and Clear, in the bar above the log, each pressed by Enter or Space,
 * then the log, whose arrow, Page Up and Down, Home, and End keys scroll it.
 */
export class ConsoleView extends LitElement {
  static styles = [reset, elements, glyphButton, styles];

  static properties = {
    log: { attribute: false },
    label: { type: String },
    fill: { type: Boolean, reflect: true },
    status: { state: true },
  } satisfies PropertyDeclarations;

  /** The log the console renders from, which its owner writes and it never does; null shows the
   * empty state. */
  declare log: ConsoleLog | null;
  /** The log's accessible name. */
  declare label: string;
  /** Whether the console fills the host's given block size, rather than growing with its log. */
  declare fill: boolean;
  /** Copy's confirmation, while it shows. */
  declare private status: string;

  /** The log the rows show, and the rows' range: the sequence numbers from #first to #next, the
   * last row showing #last. */
  #shown: ConsoleLog | null = null;
  #first = 0;
  #next = 0;
  #last: ConsoleEntry | undefined;
  /** Whether the log follows its tail: true until the reader scrolls up from the end. */
  #follow = true;
  /** The animation frame a change asked for, until it renders. */
  #frame = 0;
  #confirmation: ReturnType<typeof setTimeout> | undefined;
  /** Asks for one render in the next frame, however many changes come before it. */
  readonly #changed = () => {
    this.#frame ||= requestAnimationFrame(() => {
      this.#frame = 0;
      this.requestUpdate();
    });
  };

  constructor() {
    super();
    this.log = null;
    this.label = "Output";
    this.fill = false;
    this.status = "";
    // Follows the log it holds, while it is in the document, a frame at a time.
    new Subscription(this, () => this.log, this.#changed);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Reconnected, it shows the log as it now is.
    if (this.hasUpdated) this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    cancelAnimationFrame(this.#frame);
    this.#frame = 0;
    clearTimeout(this.#confirmation);
    this.status = "";
  }

  /** The scrolling log, once rendered. */
  get #frameElement(): HTMLElement | null {
    return this.renderRoot.querySelector(".frame");
  }

  /** Whether the log shows no entry. */
  get #empty(): boolean {
    return (this.log?.size ?? 0) === 0;
  }

  /** The reader's scroll: following while at the end, not once scrolled up from it. */
  #scrolled(event: Event): void {
    this.#follow = atEnd(event.currentTarget as HTMLElement);
  }

  /** Copy: the log's text on the clipboard, confirmed, or the failure said, in the status. */
  async #copy(): Promise<void> {
    const log = this.log;
    if (!log || this.#empty) return;
    let said: string;
    try {
      await navigator.clipboard.writeText(log.text());
      said = "Copied";
    } catch {
      said = "Couldn't copy";
    }
    clearTimeout(this.#confirmation);
    this.status = said;
    this.#confirmation = setTimeout(() => (this.status = ""), CONFIRMATION);
  }

  /** Clear: a request, unless there is nothing to clear. */
  #clear(): void {
    if (this.#empty) return;
    this.dispatchEvent(new Event("clear", { bubbles: true }));
  }

  protected override updated(): void {
    this.#sync();
    const frame = this.#frameElement;
    if (frame && this.#follow) frame.scrollTo({ top: frame.scrollHeight, behavior: "instant" });
  }

  /** Brings the rows to the log: drops those whose entries it no longer keeps, replaces the last
   * when its entry changed, and appends one for each entry after it. A new log starts afresh. */
  #sync(): void {
    const lines = this.renderRoot.querySelector(".lines");
    if (!lines) return;
    const log = this.log;
    if (log !== this.#shown) {
      lines.replaceChildren();
      this.#shown = log;
      this.#first = this.#next = log?.first ?? 0;
      this.#last = undefined;
      this.#follow = true;
    }
    if (!log) return;
    if (log.first >= this.#next) {
      // Every row's entry is gone, cleared or dropped.
      lines.replaceChildren();
      this.#first = this.#next = log.first;
      this.#last = undefined;
    } else {
      for (; this.#first < log.first; this.#first++) lines.firstElementChild?.remove();
    }
    if (this.#next > this.#first) {
      const entry = log.at(this.#next - 1);
      if (entry && entry !== this.#last) {
        lines.lastElementChild?.replaceWith(row(entry));
        this.#last = entry;
      }
    }
    const fresh = log.since(this.#next);
    if (fresh.length === 0) return;
    const rows = document.createDocumentFragment();
    for (const entry of fresh) rows.append(row(entry));
    lines.append(rows);
    this.#next = log.next;
    this.#last = fresh.at(-1);
  }

  render() {
    const dropped = this.log?.dropped ?? 0;
    const empty = this.#empty;
    // The glyph buttons' hints, as the hosting components draw them: Chromium makes an interest
    // target's text its invoker's description, so the name would be read twice; the empty
    // aria-description comes first and leaves none, and aria-hidden keeps the hint out of the
    // tree while it shows.
    return html`<div class="bar">
        <p id="dropped" class="dropped" ?hidden=${dropped === 0}>${droppedText(dropped)}</p>
        <p class="status" role="status">${this.status}</p>
        <button
          type="button"
          class="glyph-button"
          aria-label="Copy"
          aria-disabled=${empty ? "true" : "false"}
          interestfor="copy-hint"
          aria-description=""
          @click=${() => void this.#copy()}
        >
          ${copy}
        </button>
        <div id="copy-hint" class="glyph-hint" popover="hint" aria-hidden="true">Copy</div>
        <button
          type="button"
          class="glyph-button"
          aria-label="Clear"
          aria-disabled=${empty ? "true" : "false"}
          interestfor="clear-hint"
          aria-description=""
          @click=${this.#clear}
        >
          ${trash}
        </button>
        <div id="clear-hint" class="glyph-hint" popover="hint" aria-hidden="true">Clear</div>
      </div>
      <div
        class="frame"
        role="log"
        aria-live="off"
        aria-label=${this.label}
        aria-describedby=${dropped === 0 ? nothing : "dropped"}
        tabindex="0"
        @scroll=${this.#scrolled}
      >
        <p class="empty" ?hidden=${!empty}>No output yet.</p>
        <div class="lines"></div>
      </div>`;
  }
}

define(tagName, ConsoleView);

declare global {
  interface HTMLElementTagNameMap {
    "sl-console": ConsoleView;
  }
}
