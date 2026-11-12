// The Go demo, Lit with a shadow root: the composing element. It takes the page's runner as a
// property, builds its files from the go fences in its light DOM, and composes the controls, the
// file tabs, the editor, the console, and the timings over them. It is the one owner of every
// model its parts render from: it creates a FileSet, an EditorSettings, a ConsoleLog, a
// RunTimings, and a RunState, is the only writer of each, and applies every request its parts
// send. The parts render from the models and re-render on their change events; none writes one.
// One model it renders from is the page's: a fixed demo's Arrangement, the reader's preference,
// which the page gives every fixed demo and writes alone; the demo passes the Layout menu's choice
// on as its own request, which the page applies.
//
// The runner: the demo reads a structural subset of the runtime's Runner, DemoRunner, its load,
// build, run, stop, and listen, with the output, exit, and timing events re-declared here, since
// the components tier imports nothing from the runtime (the boundaries table holds it). The page,
// which may import both, assigns the runtime's Runner to a DemoRunner, so TypeScript checks the
// runner and its events against this subset there. A callback's parameter is compared strictly,
// so a runner sending an event, or a field's value, the demo doesn't declare fails the check.
// The demo fetches nothing: Go loads only as the runner loads it, on a Run.
//
// The fences: each `pre` that is a child of the host is one file, in order: its text is the
// pre's text content, so marked's plain `<pre><code class="language-go">` and the SDK's
// Shiki-rendered `<pre class="shiki">`, its tokens in spans, read alike. A fence's name is its
// `data-file`, on the pre or its code, else the pre's `title`; else a default from its language,
// a `data-language` on either, or a `language-<name>` class, as marked writes it: main.go for go,
// input.json for json, input.txt for any other; and, with no language, as Shiki's output carries
// none, main.go on a program or source demo and input.json on a handler demo. Each file's grammar
// follows its name's extension, .go or .json, any other plain. The fences are read once the
// document has parsed the demo's children, and again when `handler` or `source` changes, which
// rebuilds the files, or, while an authoring error shows, when an attribute it validates changes,
// which may mend it.
//
// The fences stay in the light DOM, never moved or changed: before the element upgrades, and
// without script, they render as the page's code, as any fence does. Once upgraded, the shadow
// root holds no slot, so the fences are no part of the flat tree: they neither render nor reach
// assistive technology, and the editor alone shows their text, with no duplicate read. Where the
// demo can't run, an authoring error, the shadow root shows the error and slots the fences back,
// so the page still reads the code as written.
//
// The three modes: with `handler` named, Run loads the scenario and calls that handler with the
// one file's text, editable, and its answer or error shows as the console's result block. A
// handler demo holds exactly one fence, so more than one is an authoring error: the demo shows it
// and doesn't run. With no handler, Run runs the prebuilt program's main; the fences are
// read-only, the file tabs show over the editor, a tabpanel, and the exit shows as the console's
// status line. With `source`, the demo is built from source: Run builds its files through the
// runner, every .go file as package main, then runs the built program's main, as the program mode
// runs the prebuilt one; the fences are editable. A source demo names no scenario and no handler:
// the program is its files. A failed build shows the compiler's or linker's output and its exit
// in the console, and its error as the result block, and runs nothing. `editable-files` adds New
// file, Rename, and Delete on a program or source demo; a handler demo, holding its one input,
// ignores it.
//
// Event attribution: the runner runs one request at a time, and a new one stops the pending one
// first, so every event between a request's start and its settling is that request's. A demo
// takes the runner's events only while a request of its own is pending, from its load's or
// build's call to its run's settling; every other event, another demo's, it ignores. When another
// demo's Run stops this demo's pending run, its promise rejects with "stopped", and the demo
// records the run as stopped. A Run while the demo's own run is pending supersedes it, as the RunState does: the
// superseded run's late settling changes nothing.
//
// Each Run clears the console and begins the timings afresh, so they show the latest run alone.
// Stop sends stop to the runner, only while the demo's own run is pending. Reset restores every
// file's text as given. New file adds the file, selects it, and focuses the editor; Rename renames
// the active file, focus staying on Rename; Delete removes the active file and focuses the tab
// now active.
//
// The fixed layout: with `fixed`, the demo is as tall as the box its parent's layout gives it,
// never below its floor, six lines of the editor and two of the console's log over the toolbar and
// the tabs, reading no viewport or container block unit, running no script to size itself, and
// needing no size container; each part keeps a share of that height and scrolls inside it, so no
// edit, output, or timing changes any part's box.
// Its arrangement follows its own width, by container queries in go-demo.css: below 44rem, the
// editor over one output panel whose tablist, Output and Timings, shows the console or the timings;
// from 44rem to 64rem, the editor over the console and the timings side by side; and from 64rem,
// the arrangement the page's Arrangement places: the editor left or right of a column of the
// console over the timings, or the editor top, over the console and the timings side by side, as
// from 44rem. With no arrangement given, the editor is left. From 64rem, and only given an
// arrangement, the toolbar shows its Layout menu, whose choice the demo sends on as an arrange
// request; the page applies it to the arrangement, and the demo, rendering from it, places its
// parts again. The parts are the same elements in every band and arrangement, only placed again, so
// a band or arrangement change keeps each part's content and scroll position, and the panel the
// tablist doesn't show is hidden by visibility, keeping its own. The output tablist is the tabs
// pattern, with activation on focus, as the file tabs' (aria.ts's roved, tabs.css's look); its
// panels are tabpanels only while it shows. The demo reads its band from the one the stylesheet
// names, --band, as its width changes, for two things alone, the two CSS can't do: whether the
// output parts are tabpanels, which changes the accessibility tree, as no stylesheet can set a
// role; and whether Layout shows, the toolbar's own group, which sl-controls renders only given an
// arrangement. No shipped API reports a container query's state to script, so the demo reads the
// name the query sets. Everything else a band changes, the placement and every size, is CSS's.
//
// Ctrl or Cmd+Enter runs the demo from inside it: the keydown is the host's, from any of its
// parts, the editor included, so it reaches no other demo and no page-wide shortcut. Run declares
// it by aria-keyshortcuts. The foundation's shortcut registry isn't touched.

import { html, LitElement, nothing, type PropertyDeclarations, type PropertyValues } from "lit";

import elements from "@jaimestill/spike-html-apps-foundation/baseline/elements.css" with { type: "css" };
import reset from "@jaimestill/spike-html-apps-foundation/baseline/reset.css" with { type: "css" };
import { define } from "@jaimestill/spike-html-apps-foundation/dom.js";

import "./code-editor.ts";
import "./console.ts";
import "./controls.ts";
import "./file-tabs.ts";
import "./timings.ts";
import type { Arrangement } from "./arrangement.ts";
import { roved } from "./aria.ts";
import type { CodeEditor } from "./code-editor.ts";
import { ConsoleLog, type Stream } from "./console-log.ts";
import type { ArrangeDetail, DeleteDetail, NewDetail, RenameDetail } from "./controls.ts";
import { defaults, EditorSettings } from "./editor-settings.ts";
import { FileSet, type GivenFile } from "./file-set.ts";
import type { FileTabs, SelectDetail } from "./file-tabs.ts";
import styles from "./go-demo.css" with { type: "css" };
import { RunState } from "./run-state.ts";
import { type Phase, RunTimings } from "./run-timings.ts";
import { Subscription } from "./subscription.ts";
import tabs from "./tabs.css" with { type: "css" };

/** The tag the element defines. */
export const tagName = "sl-go-demo";

/** A write to stdout or stderr, as the runtime's output event carries it. */
export interface DemoOutputEvent {
  type: "output";
  stream: Stream;
  text: string;
}

/** A scenario's exit, as the runtime's exit event carries it. */
export interface DemoExitEvent {
  type: "exit";
  scenario: string;
  code: number;
}

/** A program's file as the runtime's build takes it: its name and its text. */
export interface DemoFile {
  name: string;
  text: string;
}

/** A phase's timing, as the runtime's timing event carries it. */
export interface DemoTimingEvent {
  type: "timing";
  scenario: string;
  phase: Phase;
  ms: number;
}

/** Every event the demo takes from its runner. */
export type DemoEvent = DemoOutputEvent | DemoExitEvent | DemoTimingEvent;

/**
 * The runner as the demo reads it, the runtime's Runner's structural subset: `load` a scenario by
 * name, or `build` a program from its files, held as the scenario loaded; `run` its program's
 * main, with no handler, resolving with the exit code, or call a handler with input, resolving
 * with its answer; `stop` whatever runs; and `listen` to every event, answering the function that
 * stops listening. A request started while another is pending
 * stops that one first, which rejects with "stopped".
 */
export interface DemoRunner {
  load(scenario: string): Promise<void>;
  build(files: readonly DemoFile[]): Promise<void>;
  run(handler?: string, input?: string): Promise<unknown>;
  stop(): Promise<void>;
  listen(listener: (event: DemoEvent) => void): () => void;
}

/** The output panel's parts, as a fixed demo's output tablist selects them below 44rem. */
type OutputPart = "console" | "timings";

/** The output tablist's tabs, in order, each its part, which is its element's id too, and its
 * name. */
const OUTPUT_TABS: readonly { part: OutputPart; name: string }[] = Object.freeze([
  { part: "console", name: "Output" },
  { part: "timings", name: "Timings" },
]);

/** The bands go-demo.css names in --band, by a fixed demo's width: below 44rem, from 44rem to
 * 64rem, and from 64rem; "" while the demo isn't fixed. */
type Band = "phone" | "middle" | "wide" | "";

/** The band where a fixed demo's output parts are tabs. */
const TABBED_BAND: Band = "phone";

/** The band where a fixed demo's arrangement applies, and its toolbar shows Layout. */
const ARRANGED_BAND: Band = "wide";

/** A fence's file, as read from the light DOM, before the set holds it. */
interface Fence {
  name: string;
  text: string;
}

/** What a source demo's run runs, as its status names it: the built program's main package. */
const SOURCE_PROGRAM = "main";

/** The fences' default names, by language. */
const DEFAULT_NAMES: Readonly<Record<string, string>> = Object.freeze({
  go: "main.go",
  json: "input.json",
});

/** The language a fence's markup names: a data-language on the pre or its code, else a
 * language-<name> class on either, as marked writes it; undefined when it names none, as the
 * SDK's Shiki output doesn't. */
function fenceLanguage(pre: HTMLPreElement): string | undefined {
  const code = pre.querySelector(":scope > code");
  for (const element of [pre, code]) {
    const named = element?.getAttribute("data-language");
    if (named) return named.toLowerCase();
  }
  for (const element of [pre, code]) {
    for (const name of element?.classList ?? []) {
      const match = /^(?:language|lang)-(.+)$/.exec(name);
      if (match) return match[1].toLowerCase();
    }
  }
  return undefined;
}

/** A fence's file name: data-file on the pre or its code, else the pre's title, else a default
 * from its language, or, with none named, the mode's: main.go when program, a program or source
 * demo. */
function fenceName(pre: HTMLPreElement, program: boolean): string {
  const code = pre.querySelector(":scope > code");
  const named = pre.dataset.file ?? code?.getAttribute("data-file") ?? (pre.title || undefined);
  if (named !== undefined) return named;
  const language = fenceLanguage(pre);
  if (language === undefined) return program ? DEFAULT_NAMES.go : DEFAULT_NAMES.json;
  return DEFAULT_NAMES[language] ?? "input.txt";
}

/** The grammar of a file's name: go or json by its extension, any other plain. */
export const languageOf = (name: string): string => /\.(go|json)$/.exec(name)?.[1] ?? "";

/** The tab size the attribute gives: a number as written, which the settings validate; the
 * default when absent. */
const tabSizeOf = (value: string | null): number | undefined =>
  value === null ? undefined : Number(value.trim() === "" ? NaN : value);

/** A request's error as the console says it. */
const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** A handler's answer as the console shows it: text as it is, anything else as indented JSON. */
const answerText = (value: unknown) =>
  typeof value === "string" ? value : (JSON.stringify(value, null, 2) ?? String(value));

/** Whether the press is the run shortcut: Ctrl or Cmd with Enter, nothing else held. */
const isRunShortcut = (event: KeyboardEvent) =>
  event.key === "Enter" &&
  (event.ctrlKey || event.metaKey) &&
  !event.altKey &&
  !event.shiftKey &&
  !event.isComposing;

/** The models a demo owns, built together from its fences and attributes. */
interface Owned {
  files: FileSet;
  settings: EditorSettings;
  log: ConsoleLog;
  timings: RunTimings;
  state: RunState;
}

/**
 * A live Go demo. `runner`, the page's runner, a DemoRunner, runs it; with none, Run does nothing.
 * `scenario` names the scenario Run loads; `handler`, when given, the handler Run calls with the
 * one file's text, else Run runs the program's main. `source` builds the program from the files
 * instead, every .go file as package main, and runs its main, naming no scenario. The files are
 * the light DOM's fences (see the module's note). `editable-files` adds New file, Rename, and
 * Delete on a program or source demo. `wrap` wraps long lines, and `tab-size` sets a tab's width, 1
 * to 8 columns, 4 by default. `fixed` makes the demo as tall as the box its parent's layout gives
 * it, never below its floor in lines of its parts (go-demo.css); each part keeps its share of that
 * height, scrolling inside it, in a layout that follows the demo's width (see the module's note). `arrangement`, an
 * Arrangement the page writes, places a fixed demo's parts from 64rem and shows its toolbar's
 * Layout menu there; with none, the editor is left and the menu isn't shown. `label` names the
 * demo, a region; by default it names the scenario and the handler, "probe format demo", or, on a
 * source demo, "Go source demo".
 *
 * An authoring error, a missing scenario, a source demo naming a scenario or a handler, no fence,
 * more than one fence on a handler demo, a fence's name the file set refuses, or a tab size the
 * settings refuse, shows in place of the demo, naming the reason, as the region's description too,
 * over the fences as authored; the demo doesn't run. `problem` gives the reason, or null.
 *
 * Events: `arrange`, a CustomEvent, bubbling, whose detail names the placement the Layout menu
 * chose, a request for the page, which owns the arrangement, to apply; until it does, nothing
 * changes. Every other part's request is the demo's to apply, and goes no further.
 *
 * Keyboard: each part's own, in order: the toolbar, its Layout menu's included, the tabs on a
 * program or source demo, the editor, a fixed demo's output tablist below 44rem, and the console.
 * The output tablist's are the file tabs': Tab reaches the selected tab alone; Left and Right
 * select the previous and the next, wrapping, and Home and End the first and the last. Ctrl or
 * Cmd+Enter, from anywhere inside the demo, runs it.
 */
export class GoDemo extends LitElement {
  static styles = [reset, elements, tabs, styles];

  static properties = {
    runner: { attribute: false },
    scenario: { type: String },
    handler: { type: String },
    source: { type: Boolean },
    editableFiles: { type: Boolean, attribute: "editable-files" },
    wrap: { type: Boolean },
    tabSize: { type: String, attribute: "tab-size" },
    label: { type: String },
    fixed: { type: Boolean, reflect: true },
    arrangement: { attribute: false },
    owned: { state: true },
    problem: { state: true },
    outputPart: { state: true },
    band: { state: true },
  } satisfies PropertyDeclarations;

  /** The page's runner, which the demo reads and never replaces; null runs nothing. */
  declare runner: DemoRunner | null;
  /** The scenario Run loads. */
  declare scenario: string | null;
  /** The handler Run calls; null, or empty, runs the program's main. */
  declare handler: string | null;
  /** Whether Run builds the program from the files, then runs its main. */
  declare source: boolean;
  /** Whether a program or source demo's files group shows. */
  declare editableFiles: boolean;
  /** Whether long lines wrap. */
  declare wrap: boolean;
  /** A tab's width in columns, as the attribute gives it. */
  declare tabSize: string | null;
  /** The demo's accessible name, unless the default. */
  declare label: string | null;
  /** Whether the demo is as tall as its parent's layout makes it, above its floor, each part to
   * its share. */
  declare fixed: boolean;
  /** The page's arrangement, which the demo renders from and never writes; null places the editor
   * left and shows no Layout menu. */
  declare arrangement: Arrangement | null;
  /** The models, once built from the fences. */
  declare private owned: Owned | null;
  /** Why the demo can't run, or null. */
  declare problem: string | null;
  /** The output part a fixed demo's output tablist selects. */
  declare private outputPart: OutputPart;
  /** A fixed demo's band at its width, as go-demo.css names it; "" while the demo isn't fixed. */
  declare private band: Band;

  readonly #internals = this.attachInternals();
  /** The runner listened to, and the function that stops listening to it. */
  #heard: DemoRunner | null = null;
  #unlisten: (() => void) | null = null;
  /** The number of the run whose request is pending, the only one the runner's events belong to;
   * null while none of the demo's is. */
  #current: number | null = null;
  /** Shows the active file in the editor, as the files change. */
  readonly #filesChanged = () => this.#show();
  /** The layout the band was last read from. */
  #layout: Element | null = null;
  /** Reads the band as a fixed demo's width changes; a demo without `fixed` has no band, and isn't
   * observed. */
  readonly #resized = new ResizeObserver(() => this.#measure());
  /** Builds the models once the document has parsed the demo's children. */
  readonly #parsed = () => {
    this.#build();
  };

  constructor() {
    super();
    this.runner = null;
    this.scenario = null;
    this.handler = null;
    this.source = false;
    this.editableFiles = false;
    this.wrap = false;
    this.tabSize = null;
    this.label = null;
    this.fixed = false;
    this.arrangement = null;
    this.owned = null;
    this.problem = null;
    this.outputPart = "console";
    this.band = "";
    this.#internals.role = "region";
    // Renders again as the page's arrangement changes, while the demo is in the document.
    new Subscription(
      this,
      () => this.arrangement,
      () => this.requestUpdate(),
    );
    this.addEventListener("keydown", (event) => this.#keydown(event));
  }

  /** Whether the demo runs a program's main, prebuilt or built from source, naming no handler. */
  get #program(): boolean {
    return !this.handler;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#listen();
    if (this.fixed) this.#resized.observe(this);
    if (!this.owned && !this.problem) this.#build();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#listen();
    this.#resized.disconnect();
    document.removeEventListener("DOMContentLoaded", this.#parsed);
  }

  /** A fixed demo's band: the one go-demo.css's container queries name on the layout, read once it
   * lays out at a new width or as the demo becomes fixed; "" once it isn't, with nothing read. */
  #measure(): void {
    const layout = this.fixed ? this.renderRoot.querySelector(".demo") : null;
    const band = (layout ? getComputedStyle(layout).getPropertyValue("--band").trim() : "") as Band;
    if (band !== this.band) this.band = band;
  }

  /** The output tablist's tabs, in order, once rendered. */
  get #outputTabs(): HTMLElement[] {
    return [...this.renderRoot.querySelectorAll<HTMLElement>('.output-tabs [role="tab"]')];
  }

  /** The output tablist's keys, the file tabs': Left and Right, wrapping, Home and End, each
   * moving focus to a tab and selecting its part. Any other key is the demo's or the page's. */
  #outputKeydown(event: KeyboardEvent): void {
    const tab = roved(event, this.#outputTabs, this);
    if (!tab) return;
    event.preventDefault();
    tab.focus();
    this.outputPart = tab.dataset.part as OutputPart;
  }

  /** Listens to the runner the demo holds while it is in the document, and to no other. */
  #listen(): void {
    const next = this.isConnected ? this.runner : null;
    if (next === this.#heard) return;
    this.#unlisten?.();
    this.#unlisten = next ? next.listen((event) => this.#event(event)) : null;
    this.#heard = next;
  }

  /** A runner's event: the demo's own while its request is pending, else ignored. */
  #event(event: DemoEvent): void {
    const owned = this.owned;
    if (!owned || this.#current === null) return;
    switch (event.type) {
      case "output":
        owned.log.output(event);
        break;
      case "exit":
        owned.log.exit(event);
        break;
      case "timing":
        owned.timings.record(event);
        break;
    }
  }

  /** The fences: the host's pre children, in order. */
  get #fences(): HTMLPreElement[] {
    return [...this.querySelectorAll<HTMLPreElement>(":scope > pre")];
  }

  /** Builds the models from the fences and the attributes, or names why it can't. While the
   * document is still parsing, it waits until it has, so every fence is read. */
  #build(): void {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", this.#parsed, { once: true });
      return;
    }
    this.#retire();
    this.owned = null;
    this.problem = null;
    try {
      this.owned = this.#models();
    } catch (error) {
      this.problem = messageOf(error);
    }
    this.owned?.files.addEventListener("change", this.#filesChanged);
  }

  /** Lets the models built before go: their listener removed, and their run's events no longer
   * taken. */
  #retire(): void {
    this.owned?.files.removeEventListener("change", this.#filesChanged);
    this.#current = null;
  }

  /** The models, built afresh; throws the reason when the demo can't run. */
  #models(): Owned {
    if (this.source) {
      if (this.scenario || this.handler) {
        throw new Error(
          "a source demo builds its program from its fences, so it names no scenario and no handler",
        );
      }
    } else if (!this.scenario) {
      throw new Error("a demo names its Go scenario in its scenario attribute");
    }
    const program = this.#program;
    const fences: Fence[] = this.#fences.map((pre) => ({
      name: fenceName(pre, program),
      text: pre.textContent ?? "",
    }));
    if (fences.length === 0) {
      throw new Error("a demo holds its code in at least one fence, a pre among its children");
    }
    if (!program && fences.length > 1) {
      throw new Error(
        `a handler demo holds one fence, its handler's input; this one holds ${fences.length}`,
      );
    }
    // A prebuilt program's source is what it was built from; a source demo's is the reader's.
    const readonly = program && !this.source;
    const given: GivenFile[] = fences.map(({ name, text }) => ({ name, text, readonly }));
    return {
      files: new FileSet(given),
      settings: new EditorSettings({ wrap: this.wrap, tabSize: tabSizeOf(this.tabSize) }),
      log: new ConsoleLog(),
      timings: new RunTimings(),
      state: new RunState(),
    };
  }

  /** The editor, once rendered. */
  get #editor(): CodeEditor | null {
    return this.renderRoot.querySelector("sl-code-editor");
  }

  /** The file tabs, once rendered on a program demo. */
  get #tabs(): FileTabs | null {
    return this.renderRoot.querySelector("sl-file-tabs");
  }

  /** Shows the active file in the editor: its text, set only when it differs, so an edit coming
   * back from the set leaves the caret where it is; its name; its grammar; and whether it is
   * read-only. The tabpanel is named by the file too. */
  #show(): void {
    const editor = this.#editor;
    const files = this.owned?.files;
    if (!editor || !files) return;
    const file = files.activeFile;
    editor.label = file.name;
    editor.readonly = file.readonly;
    editor.language = languageOf(file.name);
    if (editor.value !== file.text) editor.value = file.text;
    this.renderRoot.querySelector("#panel")?.setAttribute("aria-label", file.name);
  }

  /** An edit in the editor: the active file's text, unless it is read-only. */
  #edited(): void {
    const editor = this.#editor;
    const files = this.owned?.files;
    if (editor && files && !files.activeFile.readonly) files.edit(files.active, editor.value);
  }

  /** Run: loads the scenario, or builds the files, and runs it, a handler called with the one
   * file's text or the program's main, its events the console's and the timings' until it
   * settles. */
  async #run(): Promise<void> {
    const owned = this.owned;
    const runner = this.runner;
    const source = this.source;
    const scenario = source ? SOURCE_PROGRAM : this.scenario;
    if (!owned || !runner || !scenario) return;
    const handler = this.handler || undefined;
    const run = owned.state.start(handler ?? scenario);
    this.#current = run;
    owned.log.clear();
    owned.timings.begin();
    /** Whether this run is still the demo's pending one: a later Run, or a rebuild, ends it. */
    const mine = () => this.#current === run && this.owned === owned;
    try {
      if (source) {
        // The files as they stand at the Run, each its name and text.
        await runner.build(owned.files.files.map(({ name, text }) => ({ name, text })));
      } else {
        await runner.load(scenario);
      }
      if (!mine()) return;
      if (handler === undefined) {
        const code = await runner.run();
        if (!mine()) return;
        this.#current = null;
        owned.state.finish(run, { kind: "exit", code: Number(code) });
      } else {
        const value = await runner.run(handler, owned.files.activeFile.text);
        if (!mine()) return;
        this.#current = null;
        owned.log.result({ ok: true, text: answerText(value) });
        owned.state.finish(run, { kind: "ok" });
      }
    } catch (error) {
      if (!mine()) return;
      this.#current = null;
      const message = messageOf(error);
      if (message === "stopped") {
        owned.state.finish(run, { kind: "stopped" });
        return;
      }
      owned.log.result({ ok: false, text: message });
      owned.state.finish(run, { kind: "failed", message });
    }
  }

  /** Stop: the runner stops, only while the demo's own run is pending, never another's. */
  #stop(): void {
    if (this.#current !== null) void this.runner?.stop();
  }

  /** The Layout menu's choice, sent on to the page as the demo's own request. */
  #arrange(event: CustomEvent<ArrangeDetail>): void {
    this.dispatchEvent(
      new CustomEvent<ArrangeDetail>("arrange", {
        detail: { placement: event.detail.placement },
        bubbles: true,
      }),
    );
  }

  /** Ctrl or Cmd+Enter from anywhere inside the demo runs it. */
  #keydown(event: KeyboardEvent): void {
    if (!isRunShortcut(event) || !this.owned) return;
    event.preventDefault();
    void this.#run();
  }

  /** New file: added, selected, and the editor focused to write it. */
  #new(event: CustomEvent<NewDetail>): void {
    const files = this.owned?.files;
    if (!files) return;
    files.add(event.detail.name);
    files.select(event.detail.name);
    this.#editor?.focus();
  }

  /** Rename: the file renamed in its place; focus stays on Rename, where the form returned it. */
  #rename(event: CustomEvent<RenameDetail>): void {
    this.owned?.files.rename(event.detail.from, event.detail.to);
  }

  /** Delete: the file removed, unless the last, and focus on the tab now active. */
  async #delete(event: CustomEvent<DeleteDetail>): Promise<void> {
    const files = this.owned?.files;
    if (!files || files.removeProblem(event.detail.name) !== null) return;
    files.remove(event.detail.name);
    const tabs = this.#tabs;
    if (!tabs) return;
    await tabs.updateComplete;
    tabs.focus();
  }

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has("runner")) this.#listen();
    // The handler and source set the mode, so a change to either rebuilds the files from the
    // fences; so does a change to anything the demo validates while it shows an authoring error,
    // which may mend it.
    const validated = changed.has("scenario") || changed.has("wrap") || changed.has("tabSize");
    const mode = changed.has("handler") || changed.has("source");
    if (this.hasUpdated && (mode || (this.problem !== null && validated))) {
      this.#build();
    }
    const owned = this.owned;
    if (owned && (changed.has("wrap") || changed.has("tabSize"))) {
      try {
        owned.settings.wrap = this.wrap;
        owned.settings.tabSize = tabSizeOf(this.tabSize) ?? defaults.tabSize;
      } catch (error) {
        this.#retire();
        this.owned = null;
        this.problem = messageOf(error);
      }
    }
    const named = [this.scenario, this.handler].filter((part) => part).join(" ");
    const fallback = this.source ? "Go source demo" : "Go demo";
    this.#internals.ariaLabel = this.label || (named ? `${named} demo` : fallback);
    this.#internals.ariaDescription = this.problem ? `Authoring error: ${this.problem}` : null;
  }

  protected override updated(changed: PropertyValues<this>): void {
    this.#show();
    // A layout appears with the models, and becomes fixed or not with the attribute, neither of
    // which need change the demo's width, so the band is read again here too.
    // Only a fixed demo's width is observed.
    const layout = this.renderRoot.querySelector(".demo");
    if (changed.has("fixed") && this.isConnected) {
      if (this.fixed) this.#resized.observe(this);
      else this.#resized.unobserve(this);
    }
    if (changed.has("fixed") || layout !== this.#layout) {
      this.#layout = layout;
      this.#measure();
    }
  }

  /** The output part's class: unselected on a fixed demo when its tablist selects the other, which
   * go-demo.css hides only while the tablist shows. */
  #placed(part: OutputPart): string {
    return this.fixed && this.outputPart !== part ? "unselected" : "";
  }

  /** A fixed demo's output tablist, Output and Timings, each tab controlling its part; go-demo.css
   * shows it below 44rem alone. The timings, holding nothing to focus, take focus as a panel. */
  #outputTablist() {
    return html`<div
      class="tablist output-tabs"
      role="tablist"
      aria-label="Output panel"
      @keydown=${this.#outputKeydown}
    >
      ${OUTPUT_TABS.map(({ part, name }) => {
        const selected = part === this.outputPart;
        return html`<button
          type="button"
          role="tab"
          class="tab"
          id=${`${part}-tab`}
          data-part=${part}
          aria-selected=${selected ? "true" : "false"}
          aria-controls=${part}
          tabindex=${selected ? "0" : "-1"}
          @click=${() => (this.outputPart = part)}
        >
          ${name}
        </button>`;
      })}
    </div>`;
  }

  render() {
    if (this.problem !== null) {
      return html`<div class="error">
          <p><strong>Authoring error:</strong> ${this.problem}.</p>
        </div>
        <slot></slot>`;
    }
    const owned = this.owned;
    // Until the fences are read, they show as authored.
    if (!owned) return html`<slot></slot>`;
    const program = this.#program;
    // A fixed demo's output parts are tabpanels only while its tablist shows; its arrangement
    // applies, and Layout shows, from 64rem.
    const tabbed = this.fixed && this.band === TABBED_BAND;
    const arrangement = this.fixed ? this.arrangement : null;
    const arranged = arrangement !== null && this.band === ARRANGED_BAND;
    // The editor's edits are the active file's, applied to the set; a read-only file takes none.
    const editor = html`<sl-code-editor
      .settings=${owned.settings}
      @input=${this.#edited}
    ></sl-code-editor>`;
    return html`<div class="demo" data-placement=${arrangement?.placement ?? nothing}>
      <sl-controls
        .files=${owned.files}
        .runState=${owned.state}
        .arrangement=${arranged ? arrangement : null}
        ?editable-files=${program && this.editableFiles}
        ?steady=${this.fixed}
        @run=${() => void this.#run()}
        @stop=${this.#stop}
        @reset=${() => owned.files.resetAll()}
        @new=${this.#new}
        @rename=${this.#rename}
        @delete=${(event: CustomEvent<DeleteDetail>) => void this.#delete(event)}
        @arrange=${this.#arrange}
      ></sl-controls>
      ${
        program
          ? html`<div class="files">
            <sl-file-tabs
              .files=${owned.files}
              panel="panel"
              @select=${(event: CustomEvent<SelectDetail>) => owned.files.select(event.detail.name)}
            ></sl-file-tabs>
            <div id="panel" role="tabpanel">${editor}</div>
          </div>`
          : html`<div class="files">${editor}</div>`
      }
      <div class="output">
        ${this.fixed ? this.#outputTablist() : nothing}
        <sl-console
          id="console"
          class=${this.#placed("console")}
          role=${tabbed ? "tabpanel" : nothing}
          aria-labelledby=${tabbed ? "console-tab" : nothing}
          ?fill=${this.fixed}
          .log=${owned.log}
          @clear=${() => owned.log.clear()}
        ></sl-console>
        <sl-timings
          id="timings"
          class=${this.#placed("timings")}
          role=${tabbed ? "tabpanel" : nothing}
          aria-labelledby=${tabbed ? "timings-tab" : nothing}
          tabindex=${tabbed ? "0" : nothing}
          .timings=${owned.timings}
        ></sl-timings>
      </div>
    </div>`;
  }
}

define(tagName, GoDemo);

declare global {
  interface HTMLElementTagNameMap {
    "sl-go-demo": GoDemo;
  }
}
