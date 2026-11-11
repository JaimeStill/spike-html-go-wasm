// The components page's script (components.html): it defines the components, by importing their
// modules, and builds each component's states into its section, every state once in the states
// list, again in the 20rem list, and the focus state after the page's focus-start mark, which the
// screenshot command focuses before pressing Tab to reach it. Each state is a figure, its label the
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

import "../components/code-editor.ts";
import { EditorSettings } from "../components/editor-settings.ts";

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
