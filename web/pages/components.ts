// The components page's script (components.html): it defines the components, by importing their
// modules, and builds each component's states into its section, every state once in the states
// list, again in the 20rem list, and the focus state after its section's focus-start mark; the
// screenshot command focuses the page's first, the code editor's, before pressing Tab to reach it,
// and the browser tier each. Each state is a figure, its label the
// caption, built fresh for each list, so no element is shared between them. Nothing here loads Go:
// the components page runs nothing yet.
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

import "../components/code-editor.ts";
import { EditorSettings } from "../components/editor-settings.ts";
import { FileSet, type GivenFile } from "../components/file-set.ts";
import "../components/file-tabs.ts";
import type { SelectDetail } from "../components/file-tabs.ts";

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
 * state into .focus. */
function specimens(section: string, states: State[], focus: State): void {
  const root = document.querySelector(`#${section}`);
  if (!root) throw new Error(`components.html has no #${section}`);
  for (const [i, list] of root.querySelectorAll(".states").entries()) {
    list.append(...states.map((state) => figure(state, `${section}-${i}`)));
  }
  root.querySelector(".focus")?.append(figure(focus, `${section}-focus`));
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
