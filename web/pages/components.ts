// The components page's script (components.html): it defines the components, by importing their
// modules, and builds each component's states into its section, every state once in the states
// list, again in the 20rem list, and the focus state after its section's focus-start mark; the
// screenshot command captures each section alone, the others hidden, and focuses its mark, then
// the page's first, before pressing Tab to reach it, and the browser tier each. Each state is a
// figure, its label the caption, built fresh for each list, so no element is shared between them.
// Nothing here loads Go: the components page runs nothing yet.
//
// The code editor's states (sl-code-editor): Go and JSON highlighted, another language plain,
// read-only, long lines scrolled sideways (the default) and wrapped, a tab two columns wide, empty
// and named by its caption through aria-labelledby, two editors whose highlights share the
// document's registry, an editable editor for its keyboard model, and an editor whose input and
// change events a readout beside it counts, a specimen aid that is no part of the editor. The page
// owns each editor's settings: it creates an EditorSettings for each state that sets one, fresh
// for each list, and is the only one to write it. The browser tier reads each by its figure's
// data-state.
//
// The file tabs' states (sl-file-tabs): several files, one modified, one read-only, so many they
// overflow the row, and one alone. Each state is the controlled loop a composing element runs: the
// page owns the state's FileSet, fresh for each list, and is its only writer. It applies the tabs'
// select requests to the set, and the editor's input as an edit of the active file, so the tabs'
// selection follows only the set, and a modified file's marker appears as the editor is typed in.
// The editor, in a tabpanel each tab controls, shows the active file, read-only when it is.
//
// The console's states (sl-console): stdout and stderr interleaved, an exit of 0 and of 2, a
// handler's answer and its error, ANSI escapes, long lines, a log past its limit with the count it
// dropped, an empty log, and a log that streams a line every 250 ms once a button, a specimen aid,
// is pressed, so a capture of the page never catches it moving. The page owns each state's
// ConsoleLog, fresh for each list, writes it from a script of the events a runner would send,
// with no Go, and applies the console's clear requests to it.
//
// The timings' states (sl-timings): a cold load's five phases, a held instance's call alone, a
// program's instantiate and run, the call after Stop, which instantiates and starts afresh with no
// fetch, no run yet, and the 20rem column holding them. The page owns each state's RunTimings,
// fresh for each list, recording a script of the timing events a runner would send, with no Go,
// some out of the phase order, as a runner's can arrive. One state's specimen aid, a button,
// begins a new run in place of the last when pressed, so a capture of the page never catches it
// changed. The table holds nothing to focus, so the section has no focus state.
//
// The controls' states (sl-controls): idle with nothing modified, a file modified, a run pending,
// a run that fails, the files group, New file's form refusing a taken name, and the last file,
// each over the file tabs and an editor. Each state is the controlled loop sl-go-demo runs over a
// runner, with no Go: the page owns the state's FileSet and RunState, fresh for each list, and is
// their only writer. It applies the toolbar's requests: Run starts a run of the state's scenario,
// which ends on its own after a moment with the state's outcome, or, for the pending state's
// spin, only by Stop or another Run; Stop finishes the pending run as stopped; Reset, New file,
// Rename, and Delete change the set, a new file made active. The refusing state's specimen aid, a
// button, opens New file's form, types a name the set holds, and submits it, so a capture of the
// page opens it in one step, and a page loaded shows every form closed.

import "../components/code-editor.ts";
import "../components/console.ts";
import "../components/controls.ts";
import { ConsoleLog, LIMIT } from "../components/console-log.ts";
import { EditorSettings } from "../components/editor-settings.ts";
import { FileSet, type GivenFile } from "../components/file-set.ts";
import "../components/file-tabs.ts";
import type { SelectDetail } from "../components/file-tabs.ts";
import type { DeleteDetail, NewDetail, RenameDetail } from "../components/controls.ts";
import { type Outcome, RunState } from "../components/run-state.ts";
import { type Phase, RunTimings } from "../components/run-timings.ts";
import "../components/timings.ts";

/** A state: its key, its label, and a function that builds it, fresh for each list, given an id
 * unique to the list, for an element that names another. */
interface State {
  key: string;
  label: string;
  build: (id: string) => HTMLElement[];
}

/** An element of the tag, its properties assigned and its attributes set. */
function make<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  properties: Partial<HTMLElementTagNameMap[K]> = {},
  attributes: Record<string, string> = {},
): HTMLElementTagNameMap[K] {
  const element = Object.assign(document.createElement(tag), properties);
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  return element;
}

/** A state's figure, its caption the label, with the id the state's elements may name it by. */
function figure({ key, label, build }: State, list: string): HTMLElement {
  const id = `${list}-${key}`;
  const caption = make("figcaption", { id, textContent: label });
  const state = make("figure", { className: "state" }, { "data-state": key });
  state.append(caption, ...build(id));
  return state;
}

/** Builds the states into the section's lists: every state into each .states, and the focus
 * state, when the component takes focus, into .focus. */
function specimens(section: string, states: State[], focus?: State): void {
  const root = document.querySelector(`#${section}`);
  if (!root) throw new Error(`components.html has no #${section}`);
  for (const [i, list] of root.querySelectorAll(".states").entries()) {
    list.append(...states.map((state) => figure(state, `${section}-${i}`)));
  }
  if (focus) root.querySelector(".focus")?.append(figure(focus, `${section}-focus`));
}

const go = `// Package shapes sums the areas of shapes.
package shapes

import (
	"fmt"
	"math"
)

// Shape is anything with an area.
type Shape interface {
	Area() float64
}

type Circle struct{ R float64 }

func (c Circle) Area() float64 { return math.Pi * c.R * c.R }

// Sum adds up the areas of any shapes, generic over their type.
func Sum[S Shape](shapes ...S) (total float64) {
	for _, s := range shapes {
		total += s.Area()
	}
	return total
}

const limit = 1 << 10

func Describe(s Shape) string {
	if a := s.Area(); a > limit {
		return fmt.Sprintf("%T: large, %.2f\\n", s, a)
	}
	return \`small: \` + string('✓')
}
`;

const json = `{
  "name": "probe",
  "handlers": ["format", "files", "spin", "crash"],
  "limits": { "steps": 1000000, "ratio": 0.5, "strict": true, "parent": null }
}
`;

const sql = `-- Another language shows plain.
SELECT name, count(*) FROM runs WHERE status = 'done' GROUP BY name;
`;

const long = `package main

// A comment longer than any width the page gives the editor, so it scrolls sideways, or wraps, its continuation rows under the gutter's blank space.
func main() {
	println("a string literal with no space to break at: https://example.com/a/very/long/path/that/keeps/going/and/going/until/it/wraps")
	println("short")
}
`;

const indented = `func classify(n int) string {
	switch {
	case n < 0:
		return "negative"
	default:
		return "other"
	}
}
`;

/** An editor of the fields. */
const editor = (fields: Partial<HTMLElementTagNameMap["sl-code-editor"]>, attributes = {}) =>
  make("sl-code-editor", fields, attributes);

/** The events state: an editor and, below it, a readout counting the input and change events it
 * sends. The readout is a specimen aid, labelled as
 * one, and no live region: a count announced on every keystroke would drown the editor. */
function events(): HTMLElement[] {
  const target = editor({ language: "go", label: "events.go", value: indented });
  const counts = { input: 0, change: 0 };
  const output = make("span", { className: "counts", textContent: "input 0 · change 0" });
  for (const type of ["input", "change"] as const) {
    target.addEventListener(type, () => {
      counts[type] += 1;
      output.textContent = `input ${counts.input} · change ${counts.change}`;
    });
  }
  const readout = make("p", { className: "readout" });
  readout.append("Specimen aid, events heard: ", output);
  return [target, readout];
}

specimens(
  "code-editor",
  [
    {
      key: "go",
      label: "Go, highlighted",
      build: () => [editor({ language: "go", label: "shapes.go", value: go })],
    },
    {
      key: "json",
      label: "JSON, highlighted",
      build: () => [editor({ language: "json", label: "input.json", value: json })],
    },
    {
      key: "plain",
      label: "Another language, SQL: plain",
      build: () => [editor({ language: "sql", label: "query.sql", value: sql })],
    },
    {
      key: "readonly",
      label: "Read-only: highlighted, selectable, and focusable, taking no edit",
      build: () => [editor({ language: "go", label: "shapes.go", readonly: true, value: go })],
    },
    {
      key: "long",
      label:
        "Long lines, scrolled sideways (the default): one row a line, the gutter held in place",
      build: () => [editor({ language: "go", label: "long.go", value: long })],
    },
    {
      key: "wrap",
      label: "Long lines, wrapped: each number beside its line's first row",
      build: () => [
        editor({
          language: "go",
          label: "wrapped.go",
          value: long,
          settings: new EditorSettings({ wrap: true }),
        }),
      ],
    },
    {
      key: "tab-size",
      label: "Tab size 2: each tab shows two columns wide, still a tab in the text",
      build: () => [
        editor({
          language: "go",
          label: "classify.go",
          value: indented,
          settings: new EditorSettings({ tabSize: 2 }),
        }),
      ],
    },
    {
      key: "empty",
      label: "Empty, named by this caption through aria-labelledby",
      build: (id) => [editor({ language: "go" }, { "aria-labelledby": id })],
    },
    {
      key: "shared",
      label: "Two editors, painting into the document's one set of highlights",
      build: () => [
        editor({ language: "go", label: "first.go", value: go }),
        editor({ language: "go", label: "second.go", value: go }),
      ],
    },
    {
      key: "editable",
      label:
        "Editable: Enter keeps the line's indent, Tab indents and Shift+Tab outdents the selected lines, and Escape, then Tab, moves focus out",
      build: () => [editor({ language: "go", label: "classify.go", value: indented })],
    },
    {
      key: "events",
      label: "Events: input on every edit, and change as focus leaves with the value changed",
      build: events,
    },
  ],
  {
    key: "focus",
    label: "Focused by Tab",
    build: () => [editor({ language: "go", label: "shapes.go", value: go })],
  },
);

/** The grammar of a file's name: go or json by its extension, any other plain. */
const languageOf = (name: string) => /\.(go|json)$/.exec(name)?.[1] ?? "";

/** The controlled loop over the set: tabs, and below them the tabpanel they control, holding an
 * editor that shows the active file. The page applies each select request and each edit to the set,
 * and shows the active file again as the set changes. id, unique to the list, makes the panel's. */
function workspace(set: FileSet, id: string): HTMLElement[] {
  const panel = make("div", { id: `${id}-panel`, className: "panel" }, { role: "tabpanel" });
  const tabs = make("sl-file-tabs", { files: set }, { panel: panel.id });
  const shown = editor({ language: "go" });
  panel.append(shown);
  const show = () => {
    const file = set.activeFile;
    panel.setAttribute("aria-label", file.name);
    Object.assign(shown, { label: file.name, readonly: file.readonly });
    shown.language = languageOf(file.name);
    // Set only when the text differs, so an edit coming back from the set leaves the caret.
    if (shown.value !== file.text) shown.value = file.text;
  };
  tabs.addEventListener("select", (event) => {
    set.select((event as CustomEvent<SelectDetail>).detail.name);
  });
  shown.addEventListener("input", () => set.edit(set.active, shown.value));
  set.addEventListener("change", show);
  show();
  return [tabs, panel];
}

const MAIN = `package main

import "fmt"

func main() {
	fmt.Println(greeting("world"))
}
`;

const GREETING = `package main

// greeting is the line main prints.
func greeting(name string) string {
	return "hello, " + name
}
`;

const MOD = `module example.com/hello

go 1.27
`;

/** Three files of a small program: main.go, greeting.go, and go.mod, with fields for any. */
const program = (fields: Record<string, Partial<GivenFile>> = {}): GivenFile[] =>
  [
    { name: "main.go", text: MAIN },
    { name: "greeting.go", text: GREETING },
    { name: "go.mod", text: MOD },
  ].map((file) => ({ ...file, ...fields[file.name] }));

/** The overflowing state's files: sixteen, the twelfth active, out of view at the row's start. */
const many = () =>
  new FileSet(
    Array.from({ length: 16 }, (_, i) => ({
      name: `step${String(i + 1).padStart(2, "0")}.go`,
      text: `package main\n\n// Step ${i + 1}.\n`,
    })),
    "step12.go",
  );

specimens(
  "file-tabs",
  [
    {
      key: "several",
      label: "Several files, the first active: choosing a tab shows its file",
      build: (id) => workspace(new FileSet(program()), id),
    },
    {
      key: "modified",
      label: "One file modified, its tab marked: typing in another marks it too",
      build: (id) => {
        const set = new FileSet(program());
        set.edit("greeting.go", GREETING.replace("hello", "hi"));
        return workspace(set, id);
      },
    },
    {
      key: "readonly",
      label: "A read-only file, active: its editor takes no edit",
      build: (id) =>
        workspace(new FileSet(program({ "greeting.go": { readonly: true } }), "greeting.go"), id),
    },
    {
      key: "overflow",
      label: "Sixteen files, overflowing: the row scrolls, the active tab in view",
      build: (id) => workspace(many(), id),
    },
    {
      key: "single",
      label: "A single file",
      build: (id) => workspace(new FileSet([{ name: "main.go", text: MAIN }]), id),
    },
  ],
  {
    key: "focus",
    label: "Focused by Tab",
    build: (id) => workspace(new FileSet(program()), id),
  },
);

/** A console showing the log, named by label or, with none, by the console's own default, the
 * page its owner: the console's clear requests are applied to the
 * log, and nothing else writes it but the state that made it. */
function consoleOf(log: ConsoleLog, label?: string): HTMLElement {
  const shown = make("sl-console", label === undefined ? { log } : { log, label });
  shown.addEventListener("clear", () => log.clear());
  return shown;
}

/** A log of the writes, exits, and results, in order, as a runner's events would bring them. */
function scripted(...steps: ((log: ConsoleLog) => void)[]): ConsoleLog {
  const log = new ConsoleLog();
  for (const step of steps) step(log);
  return log;
}

const out = (text: string) => (log: ConsoleLog) => log.output({ stream: "stdout", text });
const err = (text: string) => (log: ConsoleLog) => log.output({ stream: "stderr", text });
const exited = (scenario: string, code: number) => (log: ConsoleLog) =>
  log.exit({ scenario, code });
const answered = (ok: boolean, text: string) => (log: ConsoleLog) => log.result({ ok, text });

/** The capped state's log: 10,500 lines written, the first 500 dropped. */
function capped(): ConsoleLog {
  const log = new ConsoleLog();
  for (let i = 1; i <= LIMIT + 500; i++) {
    log.output({ stream: i % 100 === 0 ? "stderr" : "stdout", text: `step ${i}\n` });
  }
  return log;
}

/** The streaming state: a console and, below it, a specimen aid, a button that starts and stops
 * writing a line every 250 ms, so the console's following of its tail shows. It writes nothing
 * until pressed, so a capture of the page is the same every time. */
function streaming(): HTMLElement[] {
  const log = new ConsoleLog();
  const shown = consoleOf(log, "Streaming output");
  const button = make("button", { type: "button", textContent: "Start streaming" });
  let timer: ReturnType<typeof setInterval> | undefined;
  let count = 0;
  button.addEventListener("click", () => {
    if (timer === undefined) {
      timer = setInterval(() => {
        count += 1;
        const stream = count % 7 === 0 ? "stderr" : "stdout";
        log.output({ stream, text: `tick ${count}: ${"·".repeat(count % 40)}\n` });
      }, 250);
      button.textContent = "Stop streaming";
    } else {
      clearInterval(timer);
      timer = undefined;
      button.textContent = "Start streaming";
    }
  });
  const aid = make("p", { className: "readout" });
  aid.append("Specimen aid: ", button);
  return [shown, aid];
}

const PANIC = `panic: runtime error: index out of range [3] with length 3

goroutine 1 [running]:
main.main()
	/src/crash/main.go:12 +0x1d
exit status 2
`;

specimens(
  "console",
  [
    {
      key: "mixed",
      label: "stdout and stderr interleaved, partial lines joined, each stream's line in order",
      build: () => [
        consoleOf(
          scripted(
            out("loading "),
            out("config…\n"),
            err("warning: no cache, building from source\n"),
            out("step 1 of 3\nstep 2 of 3\n"),
            err("warning: "),
            err("slow disk\n"),
            out("step 3 of 3\n\ndone\n"),
          ),
        ),
      ],
    },
    {
      key: "exit-ok",
      label: "A program's exit, code 0",
      build: () => [consoleOf(scripted(out("hello, world\n"), exited("hello", 0)))],
    },
    {
      key: "exit-fail",
      label: "A crash: stderr, then its exit, code 2",
      build: () => [consoleOf(scripted(err(PANIC), exited("crash", 2)))],
    },
    {
      key: "result-ok",
      label: "A handler's answer, its own block",
      build: () => [
        consoleOf(
          scripted(answered(true, '{\n  "formatted": "package main\\n",\n  "changed": true\n}')),
        ),
      ],
    },
    {
      key: "result-error",
      label: "A handler's error, its own block",
      build: () => [
        consoleOf(
          scripted(
            out("parsing input\n"),
            answered(false, "input.go:3:1: expected declaration, found '}'"),
          ),
        ),
      ],
    },
    {
      key: "ansi",
      label: "ANSI escapes, shown as text, not colors",
      build: () => [
        consoleOf(
          scripted(
            out("\u001b[1;32mPASS\u001b[0m TestSum (0.00s)\n"),
            err("\u001b[31mFAIL\u001b[0m TestParse\n"),
          ),
        ),
      ],
    },
    {
      key: "long",
      label: "A long line, wrapped, a long word broken where it must be",
      build: () => [
        consoleOf(
          scripted(
            out(
              `${"a line of words longer than any width the page gives the console, so it wraps at its spaces ".repeat(2)}\n`,
            ),
            out(`https://example.com/${"a-very-long-path-segment/".repeat(8)}\n`),
          ),
        ),
      ],
    },
    {
      key: "capped",
      label: "10,500 lines written: the latest 10,000 kept, the count dropped shown",
      build: () => [consoleOf(capped())],
    },
    {
      key: "empty",
      label: "Empty",
      build: () => [consoleOf(new ConsoleLog())],
    },
    {
      key: "stream",
      label:
        "Streaming: the console follows its tail until scrolled up, and again once back at the end",
      build: streaming,
    },
  ],
  {
    key: "focus",
    label: "Focused by Tab",
    build: () => [consoleOf(scripted(out("hello, world\n"), exited("hello", 0)))],
  },
);

/** A run's timings as a runner's timing events would bring them: a run begun, then each phase's
 * time, in the order given. */
function timed(...phases: [Phase, number][]): RunTimings {
  const timings = new RunTimings();
  timings.begin();
  for (const [phase, ms] of phases) timings.record({ phase, ms });
  return timings;
}

/** A table showing the timings, the page their owner. */
const table = (timings: RunTimings) => make("sl-timings", { timings });

/** The replaced state: a cold load's table and, below it, a specimen aid, a button that begins a
 * new run, a held instance's call, in its place, and the next press another cold load. It changes
 * nothing until pressed, so a capture of the page is the same every time. */
function replaced(): HTMLElement[] {
  const timings = timed(...COLD);
  const button = make("button", { type: "button", textContent: "Run again" });
  let cold = false;
  button.addEventListener("click", () => {
    timings.begin();
    for (const [phase, ms] of cold ? COLD : HELD) timings.record({ phase, ms });
    cold = !cold;
  });
  const aid = make("p", { className: "readout" });
  aid.append("Specimen aid: ", button);
  return [table(timings), aid];
}

/** A cold load's phases: the module fetched and compiled, instantiated, its main started, and one
 * handler called. */
const COLD: [Phase, number][] = [
  ["fetch", 182.4],
  ["compile", 96.31],
  ["instantiate", 4.2],
  ["start", 12.75],
  ["call", 0.62],
];

/** A held instance's call: the handler's answer alone. */
const HELD: [Phase, number][] = [["call", 0.38]];

specimens("timings", [
  {
    key: "cold",
    label: "A cold load: fetch, compile, instantiate, start, and call",
    build: () => [table(timed(...COLD))],
  },
  {
    key: "held",
    label: "A held instance's handler call: the call alone",
    build: () => [table(timed(...HELD))],
  },
  {
    key: "program",
    label: "A program's run: instantiate and run, arriving run first, shown in phase order",
    build: () => [table(timed(["run", 1534.6], ["instantiate", 3.08]))],
  },
  {
    key: "after-stop",
    label: "A call after Stop: a fresh instance from the held module, no fetch or compile",
    build: () => [table(timed(["instantiate", 5.61], ["start", 11.94], ["call", 9.96]))],
  },
  {
    key: "empty",
    label: "No run yet",
    build: () => [table(new RunTimings())],
  },
  {
    key: "replaced",
    label: "A new run replaces the last",
    build: replaced,
  },
]);

/** How long a run on the page takes to end on its own, in ms: long enough to see Stop available,
 * short enough to wait for. */
const RUN_MS = 800;

/** A controls state's loop: its files, whether they are editable, the scenario its Run runs, and
 * the outcome the run ends with, or null for one that ends only when stopped; pending starts a run
 * as the state is built. */
interface Loop {
  set: FileSet;
  editable?: boolean;
  what: string;
  outcome: Outcome | null;
  pending?: boolean;
}

/** The controlled loop: the toolbar over the file tabs and the editor showing the active file. The
 * page owns the set and the run state and applies each request the toolbar sends to them; the
 * toolbar, the tabs, and the editor follow. id, unique to the list, makes the panel's. */
function controlled(id: string, { set, editable = false, what, outcome, pending }: Loop) {
  const state = new RunState();
  const controls = make("sl-controls", { files: set, runState: state, editableFiles: editable });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    clearTimeout(timer);
    const started = state.start(what);
    if (outcome) timer = setTimeout(() => state.finish(started, outcome), RUN_MS);
  };
  if (pending) run();
  controls.addEventListener("run", run);
  controls.addEventListener("stop", () => {
    clearTimeout(timer);
    state.finish(state.run, { kind: "stopped" });
  });
  controls.addEventListener("reset", () => set.resetAll());
  controls.addEventListener("new", (event) => {
    const { name } = (event as CustomEvent<NewDetail>).detail;
    set.add(name);
    set.select(name);
  });
  controls.addEventListener("rename", (event) => {
    const { from, to } = (event as CustomEvent<RenameDetail>).detail;
    set.rename(from, to);
  });
  controls.addEventListener("delete", (event) => {
    set.remove((event as CustomEvent<DeleteDetail>).detail.name);
  });
  return [controls, ...workspace(set, id)];
}

/** The refusing state: the editable loop and, below it, a specimen aid, a button that opens New
 * file's form, types main.go, a name the set holds, and submits it, so the form says why it
 * refuses. It opens nothing until pressed. */
function refusing(id: string): HTMLElement[] {
  const parts = controlled(id, {
    set: new FileSet(program()),
    editable: true,
    what: "files",
    outcome: { kind: "ok" },
  });
  const controls = parts[0] as HTMLElementTagNameMap["sl-controls"];
  const button = make("button", { type: "button", textContent: "Open New file with a taken name" });
  button.addEventListener("click", () => {
    const root = controls.shadowRoot;
    root?.querySelector<HTMLButtonElement>('[data-control="new"]')?.click();
    const input = root?.querySelector<HTMLInputElement>("#new-name");
    if (!input) return;
    input.value = "main.go";
    input.form?.requestSubmit();
  });
  const aid = make("p", { className: "readout" });
  aid.append("Specimen aid: ", button);
  return [...parts, aid];
}

/** One file, main.go, as given. */
const single = () => new FileSet([{ name: "main.go", text: MAIN }]);

specimens(
  "controls",
  [
    {
      key: "idle",
      label:
        "Idle, nothing modified: Reset unavailable; Run runs hello, which exits after a moment",
      build: (id) =>
        controlled(id, { set: single(), what: "hello", outcome: { kind: "exit", code: 0 } }),
    },
    {
      key: "modified",
      label: "A file modified: Reset available, restoring it as given",
      build: (id) => {
        const set = single();
        set.edit("main.go", MAIN.replace("world", "gopher"));
        return controlled(id, { set, what: "format", outcome: { kind: "ok" } });
      },
    },
    {
      key: "running",
      label: "A run pending: Stop available; Run stays available, and stops it to run again",
      build: (id) => controlled(id, { set: single(), what: "spin", outcome: null, pending: true }),
    },
    {
      key: "fails",
      label: "A run that fails: the status names its error",
      build: (id) =>
        controlled(id, {
          set: single(),
          what: "format",
          outcome: { kind: "failed", message: "input.go:3:1: expected declaration, found '}'" },
        }),
    },
    {
      key: "editable",
      label: "Editable files: New file, Rename, and Delete, after a separator",
      build: (id) =>
        controlled(id, {
          set: new FileSet(program()),
          editable: true,
          what: "files",
          outcome: { kind: "ok" },
        }),
    },
    {
      key: "refused",
      label: "New file's form, refusing a name another file holds",
      build: refusing,
    },
    {
      key: "last-file",
      label: "The last file, editable: Delete unavailable",
      build: (id) =>
        controlled(id, {
          set: single(),
          editable: true,
          what: "hello",
          outcome: { kind: "exit", code: 0 },
        }),
    },
  ],
  {
    key: "focus",
    label: "Focused by Tab",
    build: (id) =>
      controlled(id, {
        set: new FileSet(program()),
        editable: true,
        what: "files",
        outcome: { kind: "ok" },
      }),
  },
);
