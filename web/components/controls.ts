// The controls, Lit with a shadow root: one ARIA toolbar of a demo's controls, a run group (Run,
// Stop, and Reset) and, under editable-files, a separator and a files group (New file, Rename, and
// Delete). It renders from two models its owner, the page or the element composing the controls
// over a runner, writes: a FileSet (file-set.ts), for Reset's and Delete's availability and the
// names the forms validate, and a RunState (run-state.ts), for Stop's availability and the status.
// It re-renders on each one's change event and never writes either: every control sends a request
// the owner applies, so a request no owner applies changes nothing.
//
// The keyboard is the APG toolbar's: one tab stop, the control last focused, a roving tabindex;
// Left and Right move focus to the previous and next control, wrapping, and Home and End to the
// first and last. An unavailable control is aria-disabled, never disabled, so it stays focusable,
// as the APG recommends inside a toolbar, and a press of it sends nothing. Each control is a glyph
// button showing its name beside its glyph, so it needs no hint.
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
// The status, a polite live region beside the toolbar, says a run's start and its end, derived
// from the RunState's transitions: a run beginning, or a pending run ending. The state as it is
// when the controls first hold it is never said, so a page that loads with a run pending, or one
// finished, announces nothing until something changes.

import {
  html,
  LitElement,
  nothing,
  type PropertyDeclarations,
  type PropertyValues,
  type TemplateResult,
} from "lit";

import elements from "@jaimestill/spike-html-apps-foundation/baseline/elements.css" with { type: "css" };
import reset from "@jaimestill/spike-html-apps-foundation/baseline/reset.css" with { type: "css" };
import { define } from "@jaimestill/spike-html-apps-foundation/dom.js";
import glyphButton from "@jaimestill/spike-html-hosting-components/glyph-button.css" with { type: "css" };

import styles from "./controls.css" with { type: "css" };
import type { FileSet } from "./file-set.ts";
import { fileAdded, pencil, play, squareFill, trash, undo, xCircle } from "./glyphs.ts";
import type { Finished, RunState } from "./run-state.ts";

/** The tag the element defines. */
export const tagName = "sl-controls";

/** The controls, by key, in the toolbar's order. */
export type Control = "run" | "stop" | "reset" | "new" | "rename" | "delete";

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
 *
 * The toolbar is named by `label`, "Controls" by default. Run carries aria-keyshortcuts,
 * "Control+Enter Meta+Enter", the shortcut its owner handles from inside the demo.
 *
 * Events, each bubbling and not composed, a request that changes nothing until the owner applies
 * it: `run`, `stop`, and `reset`, Events; `new`, a CustomEvent whose detail names the new file;
 * `rename`, whose detail names the active file and the name it is to take, sent only when the name
 * differs; and `delete`, whose detail names the active file. An unavailable control sends nothing.
 *
 * Keyboard: Tab reaches the toolbar's one tab stop, the control last focused, Run at first. Left
 * and Right move to the previous and next control, wrapping, and Home and End to the first and the
 * last; Enter and Space press the focused one. In a form, Enter submits and Escape closes it, each
 * returning focus to the control that opened it.
 */
export class Controls extends LitElement {
  static styles = [reset, elements, glyphButton, styles];

  static properties = {
    files: { attribute: false },
    runState: { attribute: false },
    editableFiles: { type: Boolean, attribute: "editable-files" },
    label: { type: String },
    status: { state: true },
    current: { state: true },
    renaming: { state: true },
    problems: { state: true },
  } satisfies PropertyDeclarations;

  /** The files, which the owner writes and the controls never do; null leaves Reset unavailable
   * and the files group out. */
  declare files: FileSet | null;
  /** The run state, which the owner writes and the controls never do; null leaves Stop
   * unavailable. */
  declare runState: RunState | null;
  /** Whether the files group shows. */
  declare editableFiles: boolean;
  /** The toolbar's accessible name. */
  declare label: string;
  /** What the status says: the last transition's words, or nothing. */
  declare private status: string;
  /** The control holding the toolbar's tab stop. */
  declare private current: Control;
  /** The name the rename form renames, while it is open. */
  declare private renaming: string;
  /** Each form's refusal, while it shows. */
  declare private problems: Record<Form, string | null>;

  /** The models the controls listen to: those held, while the element is in the document. */
  #heardFiles: FileSet | null = null;
  #heardRun: RunState | null = null;
  /** The run state as last seen, whose change from it is a transition. */
  #seen = { pending: false, run: 0 };
  /** Each form, whether focus was in it as it began to close, so its closing returns focus. */
  readonly #restore: Record<Form, boolean> = { new: false, rename: false };
  /** Renders again as the files change. */
  readonly #filesChanged = () => this.requestUpdate();
  /** Says a transition, and renders again, as the run state changes. */
  readonly #runChanged = () => this.#transition();

  constructor() {
    super();
    this.files = null;
    this.runState = null;
    this.editableFiles = false;
    this.label = "Controls";
    this.status = "";
    this.current = "run";
    this.renaming = "";
    this.problems = { new: null, rename: null };
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#listen();
    if (this.hasUpdated) this.requestUpdate();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#listen();
  }

  /** Listens to the models the controls hold while in the document, and to no others. Taking a run
   * state, from no state or another, starts from it as it is: nothing is said of it. */
  #listen(): void {
    const files = this.isConnected ? this.files : null;
    if (files !== this.#heardFiles) {
      this.#heardFiles?.removeEventListener("change", this.#filesChanged);
      files?.addEventListener("change", this.#filesChanged);
      this.#heardFiles = files;
    }
    const run = this.isConnected ? this.runState : null;
    if (run !== this.#heardRun) {
      this.#heardRun?.removeEventListener("change", this.#runChanged);
      run?.addEventListener("change", this.#runChanged);
      this.#heardRun = run;
      this.#seen = { pending: run?.pending ?? false, run: run?.run ?? 0 };
      this.status = "";
    }
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
    return this.#filesShown
      ? ["run", "stop", "reset", "new", "rename", "delete"]
      : ["run", "stop", "reset"];
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
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const buttons = this.#buttons;
    const from = buttons.indexOf(event.target as HTMLButtonElement);
    if (from === -1) return;
    // Left and Right follow the toolbar's direction: in a right-to-left page, Right is previous.
    const step = getComputedStyle(this).direction === "rtl" ? -1 : 1;
    const to = {
      ArrowLeft: from - step,
      ArrowRight: from + step,
      Home: 0,
      End: buttons.length - 1,
    }[event.key];
    if (to === undefined) return;
    event.preventDefault();
    buttons[(to + buttons.length) % buttons.length].focus();
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
    this.#restore[form] = false;
    this.#popover(form)?.hidePopover();
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

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("files") || changed.has("runState")) this.#listen();
    if (!this.#shown.includes(this.current)) this.current = "run";
  }

  /** A control's button: its glyph and its name, the tab stop's tabindex, and its availability. */
  #control(
    control: Control,
    name: string,
    glyph: TemplateResult,
    attributes: { press?: () => void; opens?: Form; keys?: string } = {},
  ): TemplateResult {
    const { press, opens, keys } = attributes;
    return html`<button
      type="button"
      class="glyph-button"
      data-control=${control}
      tabindex=${control === this.current ? "0" : "-1"}
      aria-disabled=${this.#available(control) ? "false" : "true"}
      aria-keyshortcuts=${keys ?? nothing}
      aria-haspopup=${opens ? "dialog" : nothing}
      commandfor=${opens ? `${opens}-form` : nothing}
      command=${opens ? "toggle-popover" : nothing}
      @click=${press ?? nothing}
    >
      ${glyph}<span>${name}</span>
    </button>`;
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
    return html`<div class="bar">
        <div
          class="toolbar"
          role="toolbar"
          aria-label=${this.label}
          @keydown=${this.#keydown}
          @focusin=${this.#focusin}
        >
          <div class="group" role="group" aria-label="Run">
            ${this.#control("run", "Run", play, {
              press: () => this.#press("run"),
              keys: "Control+Enter Meta+Enter",
            })}
            ${this.#control("stop", "Stop", squareFill, { press: () => this.#press("stop") })}
            ${this.#control("reset", "Reset", undo, { press: () => this.#press("reset") })}
          </div>
          ${
            filesShown
              ? html`<div class="separator" role="separator" aria-orientation="vertical"></div>
                <div class="group" role="group" aria-label="Files">
                  ${this.#control("new", "New file", fileAdded, { opens: "new" })}
                  ${this.#control("rename", "Rename", pencil, { opens: "rename" })}
                  ${this.#control("delete", "Delete", trash, { press: () => this.#press("delete") })}
                </div>`
              : nothing
          }
        </div>
        <p class="status" role="status">${this.status}</p>
      </div>
      ${
        filesShown
          ? html`${this.#form("new", "New file", "New file's name", "Create")}
          ${this.#form("rename", `Rename ${this.renaming}`, `Rename ${this.renaming} to`, "Rename")}`
          : nothing
      }`;
  }
}

define(tagName, Controls);

declare global {
  interface HTMLElementTagNameMap {
    "sl-controls": Controls;
  }
}
