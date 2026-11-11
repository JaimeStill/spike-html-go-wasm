// The code editor, Lit with a shadow root: a plaintext-only contenteditable, exposed as a labelled
// multiline textbox, its text painted by Custom Highlight ranges from Shiki's tokens, with a
// line-number gutter beside it. The text is the editable element's own, one text node as the
// value sets it, and no span ever enters it: highlighting adds ranges to the document's shared
// highlights (highlights.ts) and never touches the text, so it never moves the caret or the
// selection and never enters the undo history.
//
// The tokenizer (tokenizer.ts: Shiki's core, its JavaScript regex engine, the Go and JSON grammars,
// and the palettes' merged themes) loads lazily, once, as the first editor upgrades. Until it has,
// and for any language but Go and JSON, the text shows plain. After an edit the editor
// re-highlights once typing pauses, from a timer, so a keystroke never waits on the tokenizer.
//
// The gutter is layout, not text: each line of the value has a row in the editor's grid, its
// number drawn by a CSS counter in the first column and a copy of the line, invisible, in the
// second, wrapping as the line wraps in the editable element, which lies over the second column
// across every row. A row is as tall as its line, wrapped or not, at every space and type profile,
// so each number stays beside its line's first row with nothing measured. Both copies are hidden
// from assistive technology and from selection, and hold no text a copy of the value can take.
//
// Editing keys, input and change events come with the editing slice; plain typing re-highlights.

import { html, LitElement, nothing, type PropertyDeclarations, type PropertyValues } from "lit";

import elements from "@jaimestill/spike-html-apps-foundation/baseline/elements.css" with { type: "css" };
import reset from "@jaimestill/spike-html-apps-foundation/baseline/reset.css" with { type: "css" };
import { define } from "@jaimestill/spike-html-apps-foundation/dom.js";

import styles from "./code-editor.css" with { type: "css" };
import { highlightName, highlightSheet, Painted } from "./highlights.ts";

/** The tag the element defines. */
export const tagName = "sl-code-editor";

/** How long typing must pause, in ms, before the editor re-highlights. */
const PAUSE = 40;

/** The tokenizer, imported once, by the first editor to upgrade. */
let tokenizer: Promise<typeof import("./tokenizer.ts")> | undefined;
const loadTokenizer = () => (tokenizer ??= import("./tokenizer.ts"));

/** A run of the editable element's content: a text node, or a line break as one "\n". */
type Segment = { node: Text; start: number } | { node: HTMLBRElement; start: number };

/** The editable element's content in order, each run with its offset in the text, and the text:
 * its text nodes' data, and a "\n" for each br the browser may write as a line break. */
function segments(root: Node): { runs: Segment[]; text: string } {
  const runs: Segment[] = [];
  let text = "";
  const walk = (node: Node) => {
    for (const child of node.childNodes) {
      if (child instanceof Text) {
        runs.push({ node: child, start: text.length });
        text += child.data;
      } else if (child instanceof HTMLBRElement) {
        runs.push({ node: child, start: text.length });
        text += "\n";
      } else {
        walk(child);
      }
    }
  };
  walk(root);
  return { runs, text };
}

/** The DOM position of offset in the runs: inside a text node, or before or after a br. */
function position(runs: Segment[], offset: number, root: Node): [Node, number] {
  // The last run starting at or before offset holds it; runs are in order.
  let low = 0;
  let high = runs.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >> 1;
    if (runs[middle].start <= offset) low = middle;
    else high = middle - 1;
  }
  const run = runs[low];
  if (!run) return [root, 0];
  if (run.node instanceof Text) return [run.node, Math.min(offset - run.start, run.node.length)];
  const parent = run.node.parentNode ?? root;
  const index = Array.prototype.indexOf.call(parent.childNodes, run.node);
  return [parent, offset > run.start ? index + 1 : index];
}

/**
 * A source editor. `value` is the whole text: reading it gives the text as edited, and setting it
 * replaces the text and sends no event. `language`, reflected, names the grammar, `go` or `json`,
 * any other showing the text plain. The editor is a multiline textbox named by `label`, or by the
 * elements its host's `aria-labelledby` names in the host's tree, which take precedence. While
 * `readonly`, reflected, it keeps its highlighting, selection, copy, and focus, rejects every
 * edit, and is exposed as read-only: its element is then no editing host, since a browser exposes
 * an editing host as editable whatever aria-readonly says, but a focusable read-only textbox whose
 * Ctrl or Cmd+A selects its text.
 */
export class CodeEditor extends LitElement {
  static styles = [reset, elements, styles, highlightSheet];

  // A click on the gutter or the frame focuses the text.
  static shadowRootOptions = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  static properties = {
    language: { type: String, reflect: true },
    label: { type: String },
    readonly: { type: Boolean, reflect: true },
    labelledBy: { type: String, attribute: "aria-labelledby" },
    lines: { state: true },
  } satisfies PropertyDeclarations;

  /** The grammar the text is highlighted in, `go` or `json`; any other shows it plain. */
  declare language: string;
  /** The textbox's accessible name, unless `aria-labelledby` names it. */
  declare label: string;
  /** Rejects every edit, keeping highlighting, selection, copy, and focus; reflected. */
  declare readonly: boolean;
  /** The host's `aria-labelledby`: the ids, in the host's tree, of the elements naming the
   * textbox. */
  declare labelledBy: string | null;
  /** The text's lines, which the gutter's rows follow. */
  declare private lines: string[];

  #text = "";
  #painted = new Painted();
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.language = "";
    this.label = "Code";
    this.readonly = false;
    this.labelledBy = null;
    this.lines = [""];
    void loadTokenizer();
  }

  /** The editable element, once rendered: none before the first render, when the shadow root may
   * not exist yet. */
  get #editable(): HTMLElement | null {
    return this.hasUpdated ? this.renderRoot.querySelector(".text") : null;
  }

  /** The whole text, as edited. */
  get value(): string {
    return this.#text;
  }

  /** Replaces the text, sending no event. */
  set value(text: string) {
    this.#text = String(text ?? "");
    this.lines = this.#text.split("\n");
    const editable = this.#editable;
    if (editable) editable.replaceChildren(this.#text);
    this.#schedule(0);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Reconnected, it paints again, and looks up the elements naming it in its new tree.
    if (this.hasUpdated) {
      this.requestUpdate();
      this.#schedule(0);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    clearTimeout(this.#timer);
    this.#painted.clear();
  }

  /** Highlights after delay ms, replacing any highlight already waiting. */
  #schedule(delay: number): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => void this.#highlight(), delay);
  }

  /** Paints the text's tokens as ranges, once the tokenizer has loaded; a language it doesn't
   * highlight clears them. Everything after the import runs at once, on the text as it stands. */
  async #highlight(): Promise<void> {
    const { highlights, palettes, tokenize } = await loadTokenizer();
    const editable = this.#editable;
    if (!editable || !this.isConnected) return;
    if (!highlights(this.language)) {
      this.#painted.clear();
      return;
    }
    const { runs, text } = segments(editable);
    const ranges: [string, Range][] = [];
    for (const { offset, length, colors } of tokenize(text, this.language)) {
      const range = new Range();
      range.setStart(...position(runs, offset, editable));
      range.setEnd(...position(runs, offset + length, editable));
      ranges.push([highlightName(colors, palettes), range]);
    }
    this.#painted.replace(ranges);
  }

  /** Ctrl or Cmd+A while read-only selects the text alone: the element isn't an editing host then,
   * and the browser's own select-all would take the whole page. */
  #keydown(event: KeyboardEvent): void {
    const editable = this.#editable;
    if (!this.readonly || !editable) return;
    if (event.key.toLowerCase() !== "a" || !(event.ctrlKey || event.metaKey)) return;
    if (event.altKey || event.shiftKey) return;
    event.preventDefault();
    getSelection()?.selectAllChildren(editable);
  }

  /** Takes the text as edited and re-highlights once typing pauses. */
  #input(): void {
    const editable = this.#editable;
    if (!editable) return;
    this.#text = segments(editable).text;
    this.lines = this.#text.split("\n");
    this.#schedule(PAUSE);
  }

  /** The elements the host's aria-labelledby names, in the host's tree; none found names none. */
  #labelledBy(): Element[] {
    const root = this.getRootNode() as Document | ShadowRoot;
    return (this.labelledBy ?? "")
      .split(/\s+/)
      .filter((id) => id !== "")
      .map((id) => root.getElementById(id))
      .filter((element) => element !== null);
  }

  protected override firstUpdated(): void {
    this.#editable?.replaceChildren(this.#text);
  }

  protected override updated(changed: PropertyValues<this>): void {
    // The ids name elements outside the shadow root, which only element references reach. They
    // are looked up on every update, so a naming element parsed after the editor is found once
    // the editor next renders.
    const editable = this.#editable;
    if (editable) {
      const named = this.#labelledBy();
      editable.ariaLabelledByElements = named.length > 0 ? named : null;
    }
    if (changed.has("language")) this.#schedule(0);
  }

  render() {
    const named = this.#labelledBy().length > 0;
    // Each row: its number, drawn by the gutter's counter, and its line, invisible, which sizes
    // the row as the editable element lays the same line out above it. Each is placed in its row
    // by number: the editable element holds the second column across every row, and auto-placement
    // would put the lines below it.
    return html`<div class="editor" style="--lines: ${this.lines.length}">
      ${this.lines.map(
        (line, i) =>
          html`<span class="number" style="grid-row: ${i + 1}" aria-hidden="true"></span
            ><span class="ghost" style="grid-row: ${i + 1}" aria-hidden="true">${line}</span>`,
      )}
      <div
        class="text"
        contenteditable=${this.readonly ? "false" : "plaintext-only"}
        tabindex="0"
        role="textbox"
        aria-multiline="true"
        aria-readonly=${this.readonly ? "true" : nothing}
        aria-label=${named ? nothing : this.label}
        spellcheck="false"
        autocapitalize="off"
        autocorrect="off"
        translate="no"
        @keydown=${this.#keydown}
        @input=${this.#input}
      ></div>
    </div>`;
  }
}

define(tagName, CodeEditor);

declare global {
  interface HTMLElementTagNameMap {
    "sl-code-editor": CodeEditor;
  }
}
