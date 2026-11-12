// The controls, Lit with a shadow root: one ARIA toolbar of a demo's controls, a run group (Run,
// Stop, and Reset), under editable-files a separator and a files group (New file, Rename, and
// Delete), and, given an arrangement, a separator and a layout group (Layout). It renders from the
// models its owner, the page or the element composing the controls over a runner, writes: a
// FileSet (file-set.ts), for Reset's and Delete's availability and the names the forms validate; a
// RunState (run-state.ts), for Stop's availability and the status; and an Arrangement
// (arrangement.ts), for the placement the Layout menu checks. It re-renders on each one's change
// event and never writes one: every control sends a request the owner applies, so a request no
// owner applies changes nothing.
//
// The keyboard is the APG toolbar's: one tab stop, the control last focused, a roving tabindex;
// Left and Right move focus to the previous and next control, wrapping, and Home and End to the
// first and last. An unavailable control is aria-disabled, never disabled, so it stays focusable,
// as the APG recommends inside a toolbar, and a press of it sends nothing. Each control is a glyph
// button named by aria-label, whose name shows beside its glyph where the toolbar's widest group
// fits with its names; narrower, the glyph shows alone and the name shows as the hosting
// components' hint (glyph-button.css), on hover and keyboard focus, as sl-console's Copy and Clear
// do. controls.css's container query on the host decides which, so the font's width never does.
//
// New file and Rename each open a small form in a popover, anchored to its button by CSS anchor
// positioning. The form names its input by a label and validates the name as the file set does,
// by the set's nameProblem, which reads the set and changes nothing. A refused name is said in the
// form on submit, the input aria-invalid and described by the reason, in a polite live region; from
// then on it is checked again as the reader types, so the reason clears, or changes, as they fix
// it. A valid submit closes the form, returns focus to its button, and sends the request. Escape
// closes it, sends nothing, and returns focus to the button. The form closes on Escape's keydown
// itself, so focus is back on the button before the page's key handling (keys.js) sees the key,
// which would otherwise blur the field and leave focus nowhere; the keydown is marked handled.
//
// Layout is the APG menu button: it opens a menu, a popover anchored to it as the forms are, of
// three radio items, Editor left, Editor top, and Editor right, the arrangement's placement
// checked. Enter, Space, or Down on the button opens the menu with focus on the checked item; in
// it, Up and Down move focus, wrapping, and Home and End to the first and the last; Enter or Space,
// or a click, chooses the item, closes the menu, returns focus to the button, and sends the
// request; Escape closes it and returns focus to the button; Tab closes it and moves on from the
// button. Every key the menu takes is marked handled, as the forms' Escape is, so no page shortcut
// fires from it. The button keeps its place in the toolbar's roving tabindex; the menu's items
// rove by their own keys, outside the toolbar's.
//
// The status, a polite live region beside the toolbar, says a run's start and its end, derived
// from the RunState's transitions: a run beginning, or a pending run ending. The state as it is
// when the controls first hold it is never said, so a page that loads with a run pending, or one
// finished, announces nothing until something changes. With `steady`, as a fixed Go demo sets it,
// the status keeps one line, so what it says never changes the toolbar's box (controls.css).

import { html, LitElement, nothing, type PropertyDeclarations, type TemplateResult } from "lit";

import elements from "@jaimestill/spike-html-apps-foundation/baseline/elements.css" with { type: "css" };
import reset from "@jaimestill/spike-html-apps-foundation/baseline/reset.css" with { type: "css" };
import { define } from "@jaimestill/spike-html-apps-foundation/dom.js";
import glyphButton from "@jaimestill/spike-html-hosting-components/glyph-button.css" with { type: "css" };

import { roved } from "./aria.ts";
import styles from "./controls.css" with { type: "css" };
import type { Arrangement, Placement } from "./arrangement.ts";
import { PLACEMENTS } from "./arrangement.ts";
import type { FileSet } from "./file-set.ts";
import {
  check,
  fileAdded,
  pencil,
  play,
  splitView,
  squareFill,
  trash,
  undo,
  xCircle,
} from "./glyphs.ts";
import type { Finished, RunState } from "./run-state.ts";
import { Subscription } from "./subscription.ts";

/** The tag the element defines. */
export const tagName = "sl-controls";

/** The controls, by key, in the toolbar's order. */
export type Control = "run" | "stop" | "reset" | "new" | "rename" | "delete" | "layout";

/** The detail of a new request: the new file's name. */
export interface NewDetail {
  name: string;
}

/** The detail of a rename request: the file's name and the name it is to take. */
export interface RenameDetail {
  from: string;
  to: string;
}

/** The detail of a delete request: the name of the file to delete, the active one. */
export interface DeleteDetail {
  name: string;
}

/** The detail of an arrange request: the placement chosen for the editor. */
export interface ArrangeDetail {
  placement: Placement;
}

/** Each control's name: its accessible name, the words beside its glyph, and its hint. */
const names: Record<Control, string> = {
  run: "Run",
  stop: "Stop",
  reset: "Reset",
  new: "New file",
  rename: "Rename",
  delete: "Delete",
  layout: "Layout",
};

/** Each placement's menu item, as the Layout menu names it. */
const placementNames: Record<Placement, string> = {
  left: "Editor left",
  top: "Editor top",
  right: "Editor right",
};

/** The forms, by the control that opens each. */
type Form = "new" | "rename";

/** What the status says as a run of what begins. */
export const startedText = (what: string) => `Running ${what}…`;

/** What the status says as a run ends, by its outcome. */
export function finishedText({ what, outcome }: Finished): string {
  switch (outcome.kind) {
    case "ok":
      return `Finished ${what}`;
    case "exit":
      return `Finished ${what}, exit code ${outcome.code}`;
    case "stopped":
      return `Stopped ${what}`;
    case "failed":
      return `Failed ${what}: ${outcome.message}`;
  }
}

/** A reason as the form shows it: the file set's, its first letter capitalized. */
const sentence = (reason: string) => reason.charAt(0).toUpperCase() + reason.slice(1);

/** The part of a file's name before its extension: all of it, when it has none or only a leading
 * dot, as ".gitignore". */
export function stem(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

/**
 * A demo's controls as one toolbar. `files`, a FileSet, and `runState`, a RunState, both written by
 * the owner and only read here, give what is available: Run always; Stop while a run is pending;
 * Reset while a file differs from its text as given; and, under `editable-files`, New file and
 * Rename always, and Delete unless the set refuses to remove the active file, as the last. With no
 * set, Reset is unavailable and the files group isn't shown; with no run state, Stop is.
 * `arrangement`, an Arrangement the owner writes, shows the layout group, after the files group,
 * its Layout menu checking the arrangement's placement; with none, the group isn't shown.
 *
 * `steady` keeps the status to one line whatever it says, beside the toolbar where the row leaves
 * it room, else on a line of its own, its words cut short with an ellipsis where they outrun it, so
 * the controls' box follows their width alone.
 *
 * The toolbar is named by `label`, "Controls" by default. Run carries aria-keyshortcuts,
 * "Control+Enter Meta+Enter", the shortcut its owner handles from inside the demo.
 *
 * Events, each bubbling and not composed, a request that changes nothing until the owner applies
 * it: `run`, `stop`, and `reset`, Events; `new`, a CustomEvent whose detail names the new file;
 * `rename`, whose detail names the active file and the name it is to take, sent only when the name
 * differs; `delete`, whose detail names the active file; and `arrange`, whose detail names the
 * placement the Layout menu chose, sent only when it differs from the arrangement's. An unavailable
 * control sends nothing.
 *
 * Keyboard: Tab reaches the toolbar's one tab stop, the control last focused, Run at first. Left
 * and Right move to the previous and next control, wrapping, and Home and End to the first and the
 * last; Enter and Space press the focused one. In a form, Enter submits and Escape closes it, each
 * returning focus to the control that opened it. On Layout, Enter, Space, and Down open its menu on
 * the checked item; in the menu, Up and Down move, wrapping, Home and End go to the first and the
 * last, Enter and Space choose and close, and Escape closes, each returning focus to Layout.
 */
export class Controls extends LitElement {
  static styles = [reset, elements, glyphButton, styles];

  static properties = {
    files: { attribute: false },
    runState: { attribute: false },
    arrangement: { attribute: false },
    editableFiles: { type: Boolean, attribute: "editable-files" },
    label: { type: String },
    steady: { type: Boolean, reflect: true },
    status: { state: true },
    current: { state: true },
    renaming: { state: true },
    problems: { state: true },
    menuOpen: { state: true },
  } satisfies PropertyDeclarations;

  /** The files, which the owner writes and the controls never do; null leaves Reset unavailable
   * and the files group out. */
  declare files: FileSet | null;
  /** The run state, which the owner writes and the controls never do; null leaves Stop
   * unavailable. */
  declare runState: RunState | null;
  /** The arrangement, which the owner writes and the controls never do; null leaves the layout
   * group out. */
  declare arrangement: Arrangement | null;
  /** Whether the files group shows. */
  declare editableFiles: boolean;
  /** The toolbar's accessible name. */
  declare label: string;
  /** Whether the status keeps one line, so its words never change the controls' box. */
  declare steady: boolean;
  /** What the status says: the last transition's words, or nothing. */
  declare private status: string;
  /** The control holding the toolbar's tab stop. */
  declare private current: Control;
  /** The name the rename form renames, while it is open. */
  declare private renaming: string;
  /** Each form's refusal, while it shows. */
  declare private problems: Record<Form, string | null>;
  /** Whether the Layout menu is open. */
  declare private menuOpen: boolean;

  /** The run state as last seen, whose change from it is a transition. */
  #seen = { pending: false, run: 0 };
  /** Each form, whether focus was in it as it began to close, so its closing returns focus. */
  readonly #restore: Record<Form, boolean> = { new: false, rename: false };
  /** Whether focus was in the Layout menu as it began to close, so its closing returns focus. */
  #menuRestore = false;

  constructor() {
    super();
    this.files = null;
    this.runState = null;
    this.arrangement = null;
    this.editableFiles = false;
    this.label = "Controls";
    this.steady = false;
    this.status = "";
    this.current = "run";
    this.renaming = "";
    this.problems = { new: null, rename: null };
    this.menuOpen = false;
    // Renders again as the files it holds change, and says each transition of the run state it
    // holds, while it is in the document. Taking a run state, from no state or another, starts
    // from it as it is: nothing is said of it.
    new Subscription(
      this,
      () => this.files,
      () => this.requestUpdate(),
    );
    new Subscription(
      this,
      () => this.arrangement,
      () => this.requestUpdate(),
    );
    new Subscription(
      this,
      () => this.runState,
      () => this.#transition(),
      (run) => {
        this.#seen = { pending: run?.pending ?? false, run: run?.run ?? 0 };
        this.status = "";
      },
    );
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.hasUpdated) this.requestUpdate();
  }

  /** Says the run state's transition from the state last seen: a run begun, or the pending run
   * ended. Anything else, as no change at all, says nothing new. */
  #transition(): void {
    const state = this.runState;
    if (!state) return;
    if (state.pending && state.run !== this.#seen.run) {
      this.status = startedText(state.running ?? "");
    } else if (!state.pending && this.#seen.pending && state.last) {
      this.status = finishedText(state.last);
    }
    this.#seen = { pending: state.pending, run: state.run };
    this.requestUpdate();
  }

  /** The controls shown, in the toolbar's order. */
  get #shown(): Control[] {
    return [
      ...(["run", "stop", "reset"] as const),
      ...(this.#filesShown ? (["new", "rename", "delete"] as const) : []),
      ...(this.arrangement ? (["layout"] as const) : []),
    ];
  }

  /** Whether the files group shows: under editable-files, with a set. */
  get #filesShown(): boolean {
    return this.editableFiles && this.files !== null;
  }

  /** Whether the control can be pressed now. */
  #available(control: Control): boolean {
    const files = this.files;
    switch (control) {
      case "run":
      case "new":
      case "rename":
      case "layout":
        return true;
      case "stop":
        return this.runState?.pending ?? false;
      case "reset":
        return files?.modified ?? false;
      case "delete":
        return files !== null && files.removeProblem(files.active) === null;
    }
  }

  /** The toolbar's buttons, in order. */
  get #buttons(): HTMLButtonElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLButtonElement>("[data-control]")];
  }

  /** The button of the control, once rendered. */
  #button(control: Control): HTMLButtonElement | null {
    return this.renderRoot.querySelector(`[data-control="${control}"]`);
  }

  /** The form's popover and its input, once rendered. */
  #popover(form: Form): HTMLElement | null {
    return this.renderRoot.querySelector(`#${form}-form`);
  }

  #input(form: Form): HTMLInputElement | null {
    return this.renderRoot.querySelector(`#${form}-name`);
  }

  /** Sends a request: an Event, or a CustomEvent with the detail. */
  #request(type: string, detail?: unknown): void {
    this.dispatchEvent(
      detail === undefined
        ? new Event(type, { bubbles: true })
        : new CustomEvent(type, { detail, bubbles: true }),
    );
  }

  /** A press of a control that sends its request directly, unless it is unavailable. */
  #press(control: "run" | "stop" | "reset" | "delete"): void {
    if (!this.#available(control)) return;
    if (control === "delete") {
      const name = this.files?.active;
      if (name !== undefined) this.#request("delete", { name } satisfies DeleteDetail);
    } else {
      this.#request(control);
    }
  }

  /** The toolbar's keys: Left and Right, wrapping, Home and End, each moving focus to a control.
   * Any other key, or one with a modifier, is the control's or the page's. */
  #keydown(event: KeyboardEvent): void {
    // Left and Right follow the toolbar's direction: in a right-to-left page, Right is previous.
    const button = roved(event, this.#buttons, this);
    if (!button) return;
    event.preventDefault();
    button.focus();
  }

  /** Focus reaching a control gives it the toolbar's tab stop. */
  #focusin(event: FocusEvent): void {
    const control = (event.target as HTMLElement).dataset.control as Control | undefined;
    if (control) this.current = control;
  }

  /** A form about to open is filled afresh: empty for a new file, the active file's name for a
   * rename, and no refusal. One about to close notes whether focus was in it. */
  #beforetoggle(form: Form, event: ToggleEvent): void {
    const input = this.#input(form);
    const popover = event.currentTarget as HTMLElement;
    if (event.newState === "closed") {
      this.#restore[form] = popover.contains(this.shadowRoot?.activeElement ?? null);
      return;
    }
    this.problems = { ...this.problems, [form]: null };
    if (form === "rename") this.renaming = this.files?.active ?? "";
    if (input) input.value = form === "rename" ? this.renaming : "";
  }

  /** A form opened takes focus in its input, a rename's stem selected; one closed with focus in
   * it gives focus back to its button. */
  #toggle(form: Form, event: ToggleEvent): void {
    if (event.newState === "open") {
      const input = this.#input(form);
      input?.focus();
      if (form === "rename") input?.setSelectionRange(0, stem(input.value).length);
    } else if (this.#restore[form]) {
      this.#restore[form] = false;
      this.#button(form)?.focus();
    }
  }

  /** Why the form's name can't be taken, or null when it can, as the set says. */
  #problem(form: Form, value: string): string | null {
    const files = this.files;
    if (!files) return "there are no files";
    return form === "rename" ? files.nameProblem(value, this.renaming) : files.nameProblem(value);
  }

  /** A submit: the name refused, the form says why and stays open; taken, it closes, focus back on
   * its button, and the request goes. */
  #submit(form: Form, event: SubmitEvent): void {
    event.preventDefault();
    const value = this.#input(form)?.value ?? "";
    const problem = this.#problem(form, value);
    this.problems = { ...this.problems, [form]: problem };
    if (problem) return;
    // Closing notes focus in the form, which would return focus to the button once the toggle
    // event comes, a task later, after the owner may have moved it on, as to the editor of a new
    // file: the submit returns focus itself, so the note is cleared after the close.
    this.#popover(form)?.hidePopover();
    this.#restore[form] = false;
    this.#button(form)?.focus();
    if (form === "new") {
      this.#request("new", { name: value } satisfies NewDetail);
    } else if (value !== this.renaming && this.files?.file(this.renaming)) {
      this.#request("rename", { from: this.renaming, to: value } satisfies RenameDetail);
    }
  }

  /** Typing, once a refusal shows, checks the name again, so the reason follows the name. */
  #typed(form: Form): void {
    if (this.problems[form] === null) return;
    this.problems = {
      ...this.problems,
      [form]: this.#problem(form, this.#input(form)?.value ?? ""),
    };
  }

  /** Escape in a form closes it during its keydown, which returns focus to its button before the
   * page's keys see the key, and marks the key handled. */
  #formKeydown(form: Form, event: KeyboardEvent): void {
    if (event.key !== "Escape" || event.isComposing) return;
    event.preventDefault();
    this.#popover(form)?.hidePopover();
  }

  /** The Layout menu's popover and its items, once rendered. */
  get #menu(): HTMLElement | null {
    return this.renderRoot.querySelector("#layout-menu");
  }

  get #items(): HTMLElement[] {
    return [
      ...this.renderRoot.querySelectorAll<HTMLElement>('#layout-menu [role="menuitemradio"]'),
    ];
  }

  /** Down on Layout opens its menu, as Enter and Space do by their click; the key is handled. */
  #layoutKeydown(event: KeyboardEvent): void {
    if (event.key !== "ArrowDown" || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    this.#menu?.showPopover();
  }

  /** The menu about to close notes whether focus was in it; opened, it focuses the checked item. */
  #menuBeforetoggle(event: ToggleEvent): void {
    if (event.newState === "closed") {
      this.#menuRestore = this.#menu?.contains(this.shadowRoot?.activeElement ?? null) ?? false;
    }
  }

  /** The menu opened takes focus on its checked item; closed with focus in it, it gives focus back
   * to Layout. aria-expanded follows it either way. */
  #menuToggle(event: ToggleEvent): void {
    this.menuOpen = event.newState === "open";
    if (this.menuOpen) {
      const items = this.#items;
      (items.find((item) => item.ariaChecked === "true") ?? items[0])?.focus();
    } else if (this.#menuRestore) {
      this.#menuRestore = false;
      this.#button("layout")?.focus();
    }
  }

  /** Closes the menu, focus back on Layout, during the key or click that closes it. */
  #closeMenu(): void {
    this.#menu?.hidePopover();
    this.#menuRestore = false;
    this.#button("layout")?.focus();
  }

  /** Chooses the placement: the menu closes, and the request goes when it differs. */
  #choose(placement: Placement): void {
    this.#closeMenu();
    if (this.arrangement && placement !== this.arrangement.placement) {
      this.#request("arrange", { placement } satisfies ArrangeDetail);
    }
  }

  /** The menu's keys: Up and Down move, wrapping, Home and End to the ends; Enter and Space choose;
   * Escape closes; Tab closes and moves on from Layout. Each but Tab is marked handled. */
  #menuKeydown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    const items = this.#items;
    const from = items.indexOf(event.target as HTMLElement);
    if (event.key === "Tab") {
      // Focus goes back to Layout before the key's default moves it on, from there.
      this.#closeMenu();
      return;
    }
    const to = {
      ArrowUp: from - 1,
      ArrowDown: from + 1,
      Home: 0,
      End: items.length - 1,
    }[event.key];
    if (to !== undefined) {
      event.preventDefault();
      items[(to + items.length) % items.length]?.focus();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const placement = items[from]?.dataset.placement as Placement | undefined;
      if (placement) this.#choose(placement);
    } else if (event.key === "Escape") {
      event.preventDefault();
      this.#closeMenu();
    }
  }

  protected override willUpdate(): void {
    if (!this.#shown.includes(this.current)) this.current = "run";
    // With no arrangement the menu is gone, and with it whatever it showed.
    if (!this.arrangement) this.menuOpen = false;
  }

  /** A control's button: its glyph and its name, the tab stop's tabindex, and its availability.
   * The name is its aria-label, so it stays the accessible name whether its words show or the glyph
   * shows alone; its hint, the popover <control>-hint, shows it then. Chromium makes an interest target's text
   * its invoker's description, so the empty aria-description comes first and leaves none, and
   * aria-hidden keeps the hint out of the tree while it shows. */
  #control(
    control: Control,
    glyph: TemplateResult,
    attributes: { press?: () => void; opens?: Form; keys?: string } = {},
  ): TemplateResult {
    const name = names[control];
    const { press, opens, keys } = attributes;
    return html`<button
      type="button"
      class="glyph-button"
      data-control=${control}
      aria-label=${name}
      interestfor="${control}-hint"
      aria-description=""
      tabindex=${control === this.current ? "0" : "-1"}
      aria-disabled=${this.#available(control) ? "false" : "true"}
      aria-keyshortcuts=${keys ?? nothing}
      aria-haspopup=${opens ? "dialog" : nothing}
      commandfor=${opens ? `${opens}-form` : nothing}
      command=${opens ? "toggle-popover" : nothing}
      @click=${press ?? nothing}
    >
      ${glyph}<span class="name">${name}</span>
    </button>`;
  }

  /** Layout, the menu button: its glyph and name as every control's, the tab stop's tabindex, and
   * the menu it opens, whether open or not. */
  #layoutControl(): TemplateResult {
    const name = names.layout;
    return html`<button
      type="button"
      class="glyph-button"
      data-control="layout"
      aria-label=${name}
      interestfor="layout-hint"
      aria-description=""
      tabindex=${this.current === "layout" ? "0" : "-1"}
      aria-haspopup="menu"
      aria-expanded=${this.menuOpen ? "true" : "false"}
      aria-controls="layout-menu"
      commandfor="layout-menu"
      command="toggle-popover"
      @keydown=${this.#layoutKeydown}
    >
      ${splitView}<span class="name">${name}</span>
    </button>`;
  }

  /** The Layout menu: a popover menu of a radio item for each placement, the arrangement's checked,
   * each item focused by the menu's keys alone. */
  #layoutMenu(arrangement: Arrangement): TemplateResult {
    return html`<div
      id="layout-menu"
      class="menu-popover"
      popover="auto"
      role="menu"
      aria-label="Layout"
      @beforetoggle=${this.#menuBeforetoggle}
      @toggle=${this.#menuToggle}
      @keydown=${this.#menuKeydown}
    >
      ${PLACEMENTS.map((placement) => {
        const checked = placement === arrangement.placement;
        return html`<div
          role="menuitemradio"
          class="item"
          tabindex="-1"
          data-placement=${placement}
          aria-checked=${checked ? "true" : "false"}
          @click=${() => this.#choose(placement)}
        >
          <span class="check">${checked ? check : nothing}</span>${placementNames[placement]}
        </div>`;
      })}
    </div>`;
  }

  /** A control's hint: its name, shown under its button while the glyph shows alone. */
  #hint(control: Control): TemplateResult {
    const name = names[control];
    return html`<div id="${control}-hint" class="glyph-hint" popover="hint" aria-hidden="true">${name}</div>`;
  }

  /** A form's popover: a non-modal dialog holding a labelled input, its refusal, and its submit. */
  #form(form: Form, title: string, label: string, submit: string): TemplateResult {
    const problem = this.problems[form];
    return html`<div
      id="${form}-form"
      class="form-popover"
      popover="auto"
      role="dialog"
      aria-label=${title}
      @beforetoggle=${(event: ToggleEvent) => this.#beforetoggle(form, event)}
      @toggle=${(event: ToggleEvent) => this.#toggle(form, event)}
      @keydown=${(event: KeyboardEvent) => this.#formKeydown(form, event)}
    >
      <form novalidate @submit=${(event: SubmitEvent) => this.#submit(form, event)}>
        <label for="${form}-name">${label}</label>
        <div class="row">
          <input
            id="${form}-name"
            name="name"
            type="text"
            autocomplete="off"
            spellcheck="false"
            aria-invalid=${problem ? "true" : "false"}
            aria-describedby=${problem ? `${form}-problem` : nothing}
            @input=${() => this.#typed(form)}
          />
          <button type="submit">${submit}</button>
        </div>
        <p id="${form}-problem" class=${problem ? "problem shown" : "problem"} aria-live="polite">
          ${problem ? html`${xCircle}<span>${sentence(problem)}</span>` : nothing}
        </p>
      </form>
    </div>`;
  }

  render() {
    const filesShown = this.#filesShown;
    const arrangement = this.arrangement;
    return html`<div class="bar">
        <div
          class="toolbar"
          role="toolbar"
          aria-label=${this.label}
          @keydown=${this.#keydown}
          @focusin=${this.#focusin}
        >
          <div class="group" role="group" aria-label="Run">
            ${this.#control("run", play, {
              press: () => this.#press("run"),
              keys: "Control+Enter Meta+Enter",
            })}
            ${this.#control("stop", squareFill, { press: () => this.#press("stop") })}
            ${this.#control("reset", undo, { press: () => this.#press("reset") })}
          </div>
          ${
            filesShown
              ? html`<div class="separator" role="separator" aria-orientation="vertical"></div>
                <div class="group" role="group" aria-label="Files">
                  ${this.#control("new", fileAdded, { opens: "new" })}
                  ${this.#control("rename", pencil, { opens: "rename" })}
                  ${this.#control("delete", trash, { press: () => this.#press("delete") })}
                </div>`
              : nothing
          }
          ${
            arrangement
              ? html`<div class="separator" role="separator" aria-orientation="vertical"></div>
                <div class="group" role="group" aria-label="Layout">${this.#layoutControl()}</div>`
              : nothing
          }
        </div>
        <p class="status" role="status">${this.status}</p>
      </div>
      ${this.#shown.map((control) => this.#hint(control))}
      ${
        filesShown
          ? html`${this.#form("new", "New file", "New file's name", "Create")}
          ${this.#form("rename", `Rename ${this.renaming}`, `Rename ${this.renaming} to`, "Rename")}`
          : nothing
      }
      ${arrangement ? this.#layoutMenu(arrangement) : nothing}`;
  }
}

define(tagName, Controls);

declare global {
  interface HTMLElementTagNameMap {
    "sl-controls": Controls;
  }
}
