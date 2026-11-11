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
// Settings: whether long lines wrap, and a tab's width, come from an EditorSettings
// (editor-settings.ts) its owner, the page or the element composing the editor, passes in and
// writes; the editor renders from it, re-renders on its change event, and never writes it. With
// none, it shows the defaults: long lines scroll sideways inside the frame, the gutter held in
// place beside them, and a tab shows four columns wide. A tab is always a tab character in the
// text, as gofmt writes Go; the tab size sets only its width, and how many spaces an outdent takes
// from a line indented with spaces.
//
// Editing: Enter, Tab, and Shift+Tab are the editor's own, and each makes its edit through
// execCommand, obsolete in the editing spec but the only insertion that enters the browser's undo
// history: a line break as insertLineBreak, which writes "\n" as text, the rest as insertText,
// which would split text holding a "\n" into a block per line. The browser joins one edit's
// insertions into one step, so its own undo and redo, by key or by menu, revert and restore each
// edit whole. An indent or outdent of several lines replaces the span of those lines that changes,
// then selects the same text it selected before. The first Escape releases Tab, so the next Tab or
// Shift+Tab moves focus as it would anywhere; typing, a click, or focus coming back arms it again.
// No key is taken while an input method composes, so a composition commits as typed. The
// browser's own input event, composed, reaches the host from typing, undo, and redo; an editing
// key's edit holds back its insertions' inputs and sends one of its own. The editor sends change
// itself, as a field does, when focus leaves with the value changed.
//
// A paste is the editor's too: it takes the clipboard's plain text and inserts it through the
// same path as an editing key, so its line breaks stay "\n", it is one undo step, and it sends one
// input. A drop is refused, since the browser's own would insert a block per line: text moves in
// by paste. Read-only, the editor takes no paste, and a plain character key goes no further than it
// would in a field: the foundation's keys, which pass over a press already handled, fire no
// single-key shortcut from it.

import { html, LitElement, nothing, type PropertyDeclarations, type PropertyValues } from "lit";

import elements from "@jaimestill/spike-html-apps-foundation/baseline/elements.css" with { type: "css" };
import reset from "@jaimestill/spike-html-apps-foundation/baseline/reset.css" with { type: "css" };
import { define } from "@jaimestill/spike-html-apps-foundation/dom.js";

import { idrefs } from "./aria.ts";
import styles from "./code-editor.css" with { type: "css" };
import { defaults, EditorSettings } from "./editor-settings.ts";
import { highlightName, highlightSheet, Painted } from "./highlights.ts";
import { Subscription } from "./subscription.ts";

/** The tag the element defines. */
export const tagName = "sl-code-editor";

/** The editable textbox's description: its Tab model, which the hint shows while it has focus. */
const DESCRIPTION = "Tab indents. Press Escape, then Tab, to move focus out.";

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

/** The offset in root's text of a DOM position inside it, a br counting as its "\n". */
function offsetOf(root: Node, node: Node, offset: number): number {
  const before = new Range();
  before.setStart(root, 0);
  before.setEnd(node, offset);
  return segments(before.cloneContents()).text.length;
}

/** A selection as offsets in the text, start before end, and whether it was made backward. */
interface Selected {
  start: number;
  end: number;
  backward: boolean;
}

/** The leading whitespace an outdent removes from a line: one tab, or up to a tab's width of
 * spaces. */
const outdented = (width: number) => (line: string) =>
  line.startsWith("\t") ? 1 : Math.min(width, /^ */.exec(line)?.[0].length ?? 0);

/** Whether the press types a character: one character, with no Ctrl, Cmd, or Alt. */
const typesCharacter = (event: KeyboardEvent) =>
  [...event.key].length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey;

/**
 * A source editor. `value` is the whole text: reading it gives the text as edited, and setting it
 * replaces the text and sends no event. `language`, reflected, names the grammar, `go` or `json`,
 * any other showing the text plain. The editor is a multiline textbox named by `label`, or by the
 * elements its host's `aria-labelledby` names in the host's tree, which take precedence. While
 * `readonly`, reflected, it keeps its highlighting, selection, copy, and focus, rejects every
 * edit, and is exposed as read-only: its element is then no editing host, since a browser exposes
 * an editing host as editable whatever aria-readonly says, but a focusable read-only textbox whose
 * Ctrl or Cmd+A selects its text.
 *
 * `settings`, an EditorSettings its owner writes and the editor only reads, sets whether long
 * lines wrap or scroll sideways and how wide a tab shows; with none, long lines scroll and a tab
 * shows four columns wide. The editor follows each change it sends, and stops listening to
 * settings it no longer holds or while it is out of the document.
 *
 * Enter breaks the line, the new line carrying the leading whitespace before the caret on the
 * current one. Tab inserts a tab, or, with a selection, indents every line it touches; Shift+Tab
 * outdents the current or selected lines, a tab or up to a tab's width of spaces each. A paste
 * inserts the clipboard's plain text, replacing any selection; a drop is refused. One undo
 * reverts each, and redo restores it. Escape releases Tab: the next Tab or Shift+Tab moves focus
 * out, and typing, a click, or focus coming back arms Tab again, and a second Escape is the
 * page's. A hint below the editor shows the model while it has focus, and the textbox's
 * description says it. Read-only, the editor takes none of these keys
 * and no paste, Tab moves focus, and a character key fires none of the page's single-key
 * shortcuts, as in a field.
 *
 * Events: `input`, composed out of the shadow root, once for every edit, undo and redo included;
 * `change`, bubbling, once focus leaves the text with the value changed since focus
 * came in. Setting `value` sends neither, and while focused it becomes the value focus is measured
 * from.
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
    settings: { attribute: false },
    lines: { state: true },
    released: { state: true },
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
  /** The settings the editor renders from, which its owner writes and it never does; null shows
   * the defaults. */
  declare settings: EditorSettings | null;
  /** The text's lines, which the gutter's rows follow. */
  declare private lines: string[];
  /** Whether Escape has released Tab, so the next Tab moves focus. */
  declare private released: boolean;

  #text = "";
  /** The value as focus came in, which change compares the value with as focus leaves. */
  #focused = "";
  /** Whether one of the editor's own edits is under way, its insertions' inputs held back. */
  #batching = false;
  #painted = new Painted();
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    super();
    this.language = "";
    this.label = "Code";
    this.readonly = false;
    this.labelledBy = null;
    this.settings = null;
    this.lines = [""];
    this.released = false;
    // Renders again as the settings it holds change, while it is in the document.
    new Subscription(
      this,
      () => this.settings,
      () => this.requestUpdate(),
    );
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
    this.#focused = this.#text;
    const editable = this.#editable;
    if (editable) editable.replaceChildren(this.#text);
    this.#schedule(0);
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Reconnected, it paints again, looks up the elements naming it in its new tree, and shows
    // the settings as they now are.
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

  /** The settings shown: those held, else the defaults. */
  get #shown(): { wrap: boolean; tabSize: number } {
    return this.settings ?? defaults;
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

  /** The editing keys. While an input method composes, no key is taken, so the composition
   * commits as typed. Read-only, only Ctrl or Cmd+A is: it selects the text alone, since the
   * element isn't an editing host then and the browser's own select-all would take the whole
   * page; Tab moves focus and Enter does nothing, as anywhere that takes no edit. */
  #keydown(event: KeyboardEvent): void {
    const editable = this.#editable;
    if (!editable || event.isComposing) return;
    const modified = event.ctrlKey || event.metaKey || event.altKey;
    if (this.readonly) {
      // A character key would type in a field, so in a field the foundation's keys fire no
      // shortcut on it; a read-only editor is no field to them, being no editing host, so it
      // marks the press handled, which they pass over. Nothing else is taken by the default it
      // prevents: there is no caret to move, and no text to insert.
      if (typesCharacter(event)) {
        event.preventDefault();
        return;
      }
      if (event.key.toLowerCase() !== "a" || !(event.ctrlKey || event.metaKey)) return;
      if (event.altKey || event.shiftKey) return;
      event.preventDefault();
      getSelection()?.selectAllChildren(editable);
      return;
    }
    if (modified) return;
    // The first Escape releases Tab and is the editor's alone, so the foundation's keys, which
    // release a field on Escape by blurring it, pass it over. Once released, Escape is the page's:
    // a second releases the field, or closes the dialog holding the editor.
    if (event.key === "Escape" && !event.shiftKey) {
      if (this.released) return;
      event.preventDefault();
      this.released = true;
      return;
    }
    if (event.key === "Tab") {
      if (this.released) return;
      event.preventDefault();
      if (event.shiftKey) this.#outdent();
      else this.#indent();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      this.#newline();
    }
  }

  /** The selection, as offsets in the text, when it lies in the editable element. */
  #selection(): Selected | null {
    const editable = this.#editable;
    const selection = getSelection();
    if (!editable || !selection || selection.rangeCount === 0) return null;
    const [range] = selection.getComposedRanges({ shadowRoots: [this.renderRoot as ShadowRoot] });
    if (!range || !editable.contains(range.startContainer)) return null;
    if (!editable.contains(range.endContainer)) return null;
    return {
      start: offsetOf(editable, range.startContainer, range.startOffset),
      end: offsetOf(editable, range.endContainer, range.endOffset),
      backward: selection.direction === "backward",
    };
  }

  /** Selects the text from start to end, its focus at start when backward. */
  #select(start: number, end: number, backward = false): void {
    const editable = this.#editable;
    if (!editable) return;
    const { runs } = segments(editable);
    const from = position(runs, start, editable);
    const to = position(runs, end, editable);
    if (backward) getSelection()?.setBaseAndExtent(...to, ...from);
    else getSelection()?.setBaseAndExtent(...from, ...to);
  }

  /** Replaces the text from start to end with text, as one step of the browser's undo history,
   * sending one input, of inputType. A "\n" goes in as insertLineBreak, which writes it as text
   * where white space is preserved, as it is here: insertText would split the text into a block
   * per line.
   * The browser joins the insertions, made with no selection change between them, into one undo
   * step, and sends an input for each, which go no further than the text: one input for the edit
   * goes to the host after them. Selecting after the edit ends the step, so typing that follows
   * is a step of its own. */
  #replace(start: number, end: number, text: string, inputType = "insertText"): void {
    const editable = this.#editable;
    if (!editable || (start === end && text === "")) return;
    this.#select(start, end);
    this.#batching = true;
    try {
      // The editing spec obsoletes execCommand, but nothing else enters the undo history.
      if (text === "") document.execCommand("delete");
      for (const [i, line] of text.split("\n").entries()) {
        if (i > 0) document.execCommand("insertLineBreak");
        if (line !== "") document.execCommand("insertText", false, line);
      }
    } finally {
      this.#batching = false;
    }
    editable.dispatchEvent(
      new InputEvent("input", {
        inputType,
        data: text,
        bubbles: true,
        composed: true,
      }),
    );
    const selected = this.#selection();
    if (selected) this.#select(selected.start, selected.end);
  }

  /** Enter: a line break, the new line carrying the leading whitespace before the caret on the
   * current line, replacing any selection. */
  #newline(): void {
    const selected = this.#selection();
    if (!selected) return;
    const { start, end } = selected;
    const line = this.#text.slice(this.#text.lastIndexOf("\n", start - 1) + 1, start);
    this.#replace(start, end, `\n${/^[\t ]*/.exec(line)?.[0] ?? ""}`);
  }

  /** Tab: a tab at the caret, or a tab before every line the selection touches. */
  #indent(): void {
    const selected = this.#selection();
    if (!selected) return;
    if (selected.start === selected.end) this.#replace(selected.start, selected.end, "\t");
    else this.#lines(selected, () => 0, "\t");
  }

  /** Shift+Tab: a tab, or up to a tab's width of spaces, off the start of every line the caret or the
   * selection touches. */
  #outdent(): void {
    const selected = this.#selection();
    if (selected) this.#lines(selected, outdented(this.#shown.tabSize), "");
  }

  /** A paste: the clipboard's plain text, its line breaks as "\n", in place of the selection,
   * through the editor's own edit, so it is one undo step and sends one input. Read-only, or with
   * no plain text on the clipboard, nothing is pasted. */
  #paste(event: ClipboardEvent): void {
    event.preventDefault();
    if (this.readonly) return;
    const text = (event.clipboardData?.getData("text/plain") ?? "").replace(/\r\n?/g, "\n");
    const selected = this.#selection();
    if (!selected || text === "") return;
    this.#replace(selected.start, selected.end, text, "insertFromPaste");
  }

  /** A drag over the text: refused, so the pointer shows no drop and none comes. */
  #dragover(event: DragEvent): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
  }

  /** A drop: refused, should one come; the browser's own would insert a block per line. */
  #drop(event: DragEvent): void {
    event.preventDefault();
  }

  /** Edits the start of each line the selection touches, removing remove(line) characters and
   * inserting add, in one replacement of the span of those lines that changes, then selects the text it selected before,
   * each end moving with the text before it. A selection ending at a line's start doesn't touch
   * that line. Nothing changed, nothing is replaced. */
  #lines(selected: Selected, remove: (line: string) => number, add: string): void {
    const { start, end, backward } = selected;
    const text = this.#text;
    const from = text.lastIndexOf("\n", start - 1) + 1;
    const last = end > start && text[end - 1] === "\n" ? end - 1 : end;
    const next = text.indexOf("\n", last);
    const to = next === -1 ? text.length : next;
    // Each line's start in the text, and the characters it loses there.
    const edits: { at: number; removed: number }[] = [];
    let at = from;
    const lines = text
      .slice(from, to)
      .split("\n")
      .map((line) => {
        const removed = remove(line);
        edits.push({ at, removed });
        at += line.length + 1;
        return add + line.slice(removed);
      });
    const block = lines.join("\n");
    const was = text.slice(from, to);
    if (block === was) return;
    // Only the span that differs is replaced: the lines' unchanged ends stay as they are, and the
    // browser, deleting up to the text's last line break, would drop it.
    let same = 0;
    while (same < block.length && block[same] === was[same]) same += 1;
    let tail = 0;
    while (
      tail < block.length - same &&
      tail < was.length - same &&
      block[block.length - 1 - tail] === was[was.length - 1 - tail]
    ) {
      tail += 1;
    }
    // An offset after a line's start moves by what the line gained there; one inside what it lost
    // moves to the line's start.
    const moved = (offset: number) =>
      edits.reduce(
        (sum, { at, removed }) =>
          offset > at ? sum + add.length - Math.min(removed, offset - at) : sum,
        offset,
      );
    this.#replace(from + same, to - tail, block.slice(same, block.length - tail));
    this.#select(moved(start), moved(end), backward);
  }

  /** Takes the text as edited, arms Tab, and re-highlights once typing pauses. An input from
   * within one of the editor's own edits stops at the text: the edit sends one when it ends. */
  #input(event: Event): void {
    const editable = this.#editable;
    if (!editable) return;
    if (this.#batching) event.stopPropagation();
    this.#text = segments(editable).text;
    this.lines = this.#text.split("\n");
    this.released = false;
    this.#schedule(PAUSE);
  }

  /** Focus coming in: Tab armed, the value to measure change from, and the hint shown. */
  #focus(): void {
    this.released = false;
    this.#focused = this.#text;
    if (!this.readonly) this.#hint?.showPopover();
  }

  /** Focus leaving: change if the value changed since focus came in, and the hint hidden. */
  #blur(): void {
    if (this.#hint?.matches(":popover-open")) this.#hint.hidePopover();
    if (this.#text === this.#focused) return;
    this.#focused = this.#text;
    this.dispatchEvent(new Event("change", { bubbles: true }));
  }

  /** The keyboard hint, while the editor is editable. */
  get #hint(): HTMLElement | null {
    return this.hasUpdated ? this.renderRoot.querySelector(".hint") : null;
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
      const named = idrefs(this, this.labelledBy);
      editable.ariaLabelledByElements = named.length > 0 ? named : null;
    }
    if (changed.has("language")) this.#schedule(0);
  }

  render() {
    const named = idrefs(this, this.labelledBy).length > 0;
    // Each row: its number, drawn by the gutter's counter, and its line, invisible, which sizes
    // the row as the editable element lays the same line out above it. Each is placed in its row
    // by number: the editable element holds the second column across every row, and auto-placement
    // would put the lines below it.
    // The hint and the description say the Tab model, which only an editable editor has.
    // The settings set the frame's mode, wrapping or scrolling, and the tab's width; the gutter's
    // width, in digits, keeps a caret revealed at a scrolled line's start clear of it.
    const editable = !this.readonly;
    const { wrap, tabSize } = this.#shown;
    const rows = this.lines.length;
    const style = `--lines: ${rows}; --digits: ${String(rows).length}; --tab-size: ${tabSize}`;
    return html`<div
        class=${wrap ? "editor wrap" : "editor"}
        style=${style}
        @pointerdown=${this.#arm}
        @focus=${this.#frameFocus}
      >
        ${this.lines.map(
          (line, i) =>
            html`<span class="number" style="grid-row: ${i + 1}" aria-hidden="true"></span
              ><span class="ghost" style="grid-row: ${i + 1}" aria-hidden="true">${line}</span>`,
        )}
        <div
          class="text"
          contenteditable=${editable ? "plaintext-only" : "false"}
          tabindex="0"
          role="textbox"
          aria-multiline="true"
          aria-readonly=${editable ? nothing : "true"}
          aria-label=${named ? nothing : this.label}
          aria-description=${editable ? DESCRIPTION : nothing}
          spellcheck="false"
          autocapitalize="off"
          autocorrect="off"
          translate="no"
          @keydown=${this.#keydown}
          @input=${this.#input}
          @focus=${this.#focus}
          @blur=${this.#blur}
          @paste=${this.#paste}
          @dragover=${this.#dragover}
          @drop=${this.#drop}
        ></div>
      </div>
      ${
        editable
          ? html`<div class="hint" popover="manual" aria-hidden="true">
            ${
              this.released
                ? html`<kbd>Tab</kbd> moves focus`
                : html`<kbd>Tab</kbd> indents · <kbd>Esc</kbd> then <kbd>Tab</kbd> moves focus`
            }
          </div>`
          : nothing
      }`;
  }

  /** Focus on the frame itself, passed to the text. A frame that overflows is a scroller, which
   * the browser makes focusable, and the first focusable element in the shadow root is the one
   * the host's delegated focus, and a click on the gutter, focus. The frame scrolls nowhere: the
   * text takes focus where it stands. */
  #frameFocus(event: FocusEvent): void {
    if (event.target === event.currentTarget) this.#editable?.focus({ preventScroll: true });
  }

  /** A click in the editor arms Tab. */
  #arm(): void {
    this.released = false;
  }
}

define(tagName, CodeEditor);

declare global {
  interface HTMLElementTagNameMap {
    "sl-code-editor": CodeEditor;
  }
}
