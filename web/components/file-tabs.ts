// The file tabs, Lit with a shadow root: a FileSet (file-set.ts) shown as the ARIA tabs pattern, a
// labelled tablist with one tab per file. The set's owner, the page or the element composing the
// tabs and the editor, writes it; the tabs render from it, re-render on its change event, and never
// write it. Choosing a tab, by click or by the keyboard, sends a select request the owner applies
// to the set: the tabs' selection changes only when the set's active file does, so a request no
// owner applies changes nothing but where focus is.
//
// The panel each tab controls, the editor showing the active file, is outside the shadow root, in
// the host's tree, named by the host's panel attribute: an id there. An id can't reach across a
// shadow boundary, so each tab's aria-controls is set as an element reference, which can reach the
// host's tree, looked up on every update, as sl-code-editor looks up its aria-labelledby.
//
// The keyboard is the tabs pattern's, with activation on focus: one tab in the page's tab order,
// the active one; Left and Right move focus to the previous and next tab, wrapping at either end,
// and Home and End to the first and last; each move sends a select request for the tab reached.
// The tablist scrolls sideways when its tabs overflow it, and scrolls the tab focus reaches, and
// the active tab as it changes, into view within itself, never scrolling the page.

import { html, LitElement, nothing, type PropertyDeclarations, type PropertyValues } from "lit";

import elements from "@jaimestill/spike-html-apps-foundation/baseline/elements.css" with { type: "css" };
import reset from "@jaimestill/spike-html-apps-foundation/baseline/reset.css" with { type: "css" };
import { define } from "@jaimestill/spike-html-apps-foundation/dom.js";

import styles from "./file-tabs.css" with { type: "css" };
import type { FileSet } from "./file-set.ts";

/** The tag the element defines. */
export const tagName = "sl-file-tabs";

/** The detail of a select request: the name of the file to make active. */
export interface SelectDetail {
  name: string;
}

/**
 * Tabs for a set of files. `files`, a FileSet its owner writes and the tabs only read, gives the
 * tabs, one for each file in order, and which is selected, the active file's; with none, nothing
 * shows. The tablist is named by `label`, "Files" by default. `panel` is the id, in the host's
 * tree, of the element each tab controls, the panel showing the active file.
 *
 * A modified file's tab shows a dot after its name, and its accessible name says so: "main.go,
 * modified". A read-only file's tab is described as read-only.
 *
 * Events: `select`, a CustomEvent whose detail names the file, bubbling and not composed, when a
 * tab other than the selected one is clicked or reached by the keyboard: a request, which changes
 * nothing until the owner applies it to the set.
 *
 * Keyboard: Tab reaches the selected tab alone. Left and Right move focus to the previous and the
 * next tab, wrapping, and Home and End to the first and the last, each requesting that tab's
 * selection. Enter and Space, and a click, request the selection of the focused tab.
 */
export class FileTabs extends LitElement {
  static styles = [reset, elements, styles];

  static properties = {
    files: { attribute: false },
    label: { type: String },
    panel: { type: String },
  } satisfies PropertyDeclarations;

  /** The set the tabs render from, which its owner writes and the tabs never do; null shows no
   * tab. */
  declare files: FileSet | null;
  /** The tablist's accessible name. */
  declare label: string;
  /** The id, in the host's tree, of the panel each tab controls. */
  declare panel: string | null;

  /** The set the tabs listen to: the one held, while the element is in the document. */
  #heard: FileSet | null = null;
  /** The active file's name at the last render, so the tabs reveal it only as it changes. */
  #shown: string | null = null;
  /** Renders again as the set changes. */
  readonly #changed = () => this.requestUpdate();

  constructor() {
    super();
    this.files = null;
    this.label = "Files";
    this.panel = null;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#listen();
    // Reconnected, it shows the set as it now is, and looks up its panel in its new tree.
    if (this.hasUpdated) this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#listen();
  }

  /** Listens to the set the tabs hold while they are in the document, and to no other. */
  #listen(): void {
    const next = this.isConnected ? this.files : null;
    if (next === this.#heard) return;
    this.#heard?.removeEventListener("change", this.#changed);
    next?.addEventListener("change", this.#changed);
    this.#heard = next;
  }

  /** The tab elements, in order. */
  get #tabs(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('[role="tab"]')];
  }

  /** The tablist, once rendered with a set. */
  get #tablist(): HTMLElement | null {
    return this.renderRoot.querySelector('[role="tablist"]');
  }

  /** Sends a select request for the file of the name, unless it is already active. */
  #request(name: string): void {
    if (name === this.files?.active) return;
    this.dispatchEvent(
      new CustomEvent<SelectDetail>("select", { detail: { name }, bubbles: true }),
    );
  }

  /** The tabs pattern's keys: Left and Right, wrapping, Home and End, each moving focus to a tab
   * and requesting its selection. Any other key, or one with a modifier, is the page's. */
  #keydown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const tabs = this.#tabs;
    const from = tabs.indexOf(event.target as HTMLElement);
    if (from === -1) return;
    // Left and Right follow the tablist's direction: in a right-to-left page, Right is previous.
    const step = getComputedStyle(this).direction === "rtl" ? -1 : 1;
    const to = {
      ArrowLeft: from - step,
      ArrowRight: from + step,
      Home: 0,
      End: tabs.length - 1,
    }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    const tab = tabs[(to + tabs.length) % tabs.length];
    tab.focus({ preventScroll: true });
    this.#reveal(tab);
    this.#request(tab.dataset.name ?? "");
  }

  /** Scrolls the tablist, and nothing around it, so the tab shows whole, by the least distance:
   * smoothly when the reader allows motion, unless instant, as on the first render, where the row
   * should arrive in place rather than slide there as the page loads. */
  #reveal(tab: HTMLElement, instant = false): void {
    const list = this.#tablist;
    if (!list) return;
    const bounds = list.getBoundingClientRect();
    const box = tab.getBoundingClientRect();
    const padding = parseFloat(getComputedStyle(list).scrollPaddingInlineStart) || 0;
    // Past the start, back to it; past the end, forward to it, but never past the tab's start.
    const before = box.left - bounds.left - padding;
    const after = box.right - bounds.right + padding;
    const left = before < 0 ? before : after > 0 ? Math.min(after, before) : 0;
    // To a position, not by a distance, so a second reveal of the same tab while the first still
    // scrolls, as a keyboard move's and then the selection's, lands in the same place.
    if (left !== 0) {
      list.scrollTo({ left: list.scrollLeft + left, behavior: instant ? "instant" : "auto" });
    }
  }

  /** The elements the panel attribute names, in the host's tree; none found names none. */
  #panels(): Element[] {
    const root = this.getRootNode() as Document | ShadowRoot;
    return (this.panel ?? "")
      .split(/\s+/)
      .filter((id) => id !== "")
      .map((id) => root.getElementById(id))
      .filter((element) => element !== null);
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("files")) this.#listen();
  }

  protected override updated(): void {
    // The panel is outside the shadow root, which only element references reach. It is looked up
    // on every update, so a panel added after the tabs is found once they next render.
    const panels = this.#panels();
    for (const tab of this.#tabs) tab.ariaControlsElements = panels.length > 0 ? panels : null;
    const active = this.files?.active ?? null;
    if (active === this.#shown) return;
    const first = this.#shown === null;
    this.#shown = active;
    const tab = this.#tabs.find((each) => each.dataset.name === active);
    if (tab) this.#reveal(tab, first);
  }

  render() {
    const set = this.files;
    if (!set) return nothing;
    // The name shows as text; the accessible name is set whole, so the marker, a dot hidden from
    // assistive technology, is said as ", modified".
    return html`<div
      class="tablist"
      role="tablist"
      aria-label=${this.label}
      @keydown=${this.#keydown}
    >
      ${set.files.map((file) => {
        const selected = file.name === set.active;
        return html`<button
          type="button"
          role="tab"
          class="tab"
          data-name=${file.name}
          aria-selected=${selected ? "true" : "false"}
          tabindex=${selected ? "0" : "-1"}
          aria-label=${file.modified ? `${file.name}, modified` : file.name}
          aria-description=${file.readonly ? "read-only" : nothing}
          @click=${() => this.#request(file.name)}
        >
          <span class="name">${file.name}</span>${
            file.modified ? html`<span class="marker" aria-hidden="true"></span>` : nothing
          }
        </button>`;
      })}
    </div>`;
  }
}

define(tagName, FileTabs);

declare global {
  interface HTMLElementTagNameMap {
    "sl-file-tabs": FileTabs;
  }
}
