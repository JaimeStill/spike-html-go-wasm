// The components page's script (components.html): it defines the components, by importing their
// modules, and builds each component's states into its section, every state once in the states
// list, again in the 20rem list, and the focus state after the page's focus-start mark, which the
// screenshot command focuses before pressing Tab to reach it. Each state is a figure, its label the
// caption, built fresh for each list, so no element is shared between them. Nothing here loads Go:
// the components page runs nothing yet.
//
// The code editor's states (sl-code-editor): Go and JSON highlighted, another language plain,
// read-only, long lines wrapped beside the gutter, empty and named by its caption through
// aria-labelledby, and two editors whose highlights share the document's registry. The browser
// tier reads each by its figure's data-state.

import "../components/code-editor.ts";

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

// A comment long enough to wrap at any width the page gives the editor, so its continuation rows sit under the gutter's blank space.
func main() {
	println("a string literal with no space to break at: https://example.com/a/very/long/path/that/keeps/going/and/going/until/it/wraps")
	println("short")
}
`;

/** An editor of the fields. */
const editor = (fields: Partial<HTMLElementTagNameMap["sl-code-editor"]>, attributes = {}) =>
  make("sl-code-editor", fields, attributes);

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
      label: "Long lines, wrapped, each number beside its line's first row",
      build: () => [editor({ language: "go", label: "long.go", value: long })],
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
  ],
  {
    key: "focus",
    label: "Focused by Tab",
    build: () => [editor({ language: "go", label: "shapes.go", value: go })],
  },
);
