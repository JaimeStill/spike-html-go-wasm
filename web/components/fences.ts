// A Go demo's fences, read as files: the rules sl-go-demo builds its files by (go-demo.ts), stated
// once here so that a page building a FileSet for the demo, from a template's fences, say, reads
// them by the same rules. A model's helper with no element: it reads the markup it is given and
// changes nothing.
//
// The fences: each `pre` that is a child of the parent, the demo's host or a template's content,
// is one file, in order: its text is the pre's text content, so marked's plain
// `<pre><code class="language-go">` and the SDK's Shiki-rendered `<pre class="shiki">`, its tokens
// in spans, read alike. A fence's name is its `data-file`, on the pre or its code, else the pre's
// `title`; else a default from its language, a `data-language` on either, or a `language-<name>`
// class, as marked writes it: main.go for go, input.json for json, input.txt for any other; and,
// with no language, as Shiki's output carries none, main.go on a program or source demo and
// input.json on a handler demo.

/** A fence's file, as read from the markup, before a set holds it: its name and its text. */
export interface Fence {
  name: string;
  text: string;
}

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
 * demo, else input.json. */
function fenceName(pre: HTMLPreElement, program: boolean): string {
  const code = pre.querySelector(":scope > code");
  const named = pre.dataset.file ?? code?.getAttribute("data-file") ?? (pre.title || undefined);
  if (named !== undefined) return named;
  const language = fenceLanguage(pre);
  if (language === undefined) return program ? DEFAULT_NAMES.go : DEFAULT_NAMES.json;
  return DEFAULT_NAMES[language] ?? "input.txt";
}

/** The fences' pres: the parent's pre children, in order. The parent is an element, the demo's
 * host, or a fragment, a template's content, which holds no element to scope a selector to, so the
 * children are walked rather than queried. */
const fencesOf = (parent: ParentNode): HTMLPreElement[] =>
  [...parent.children].filter((child): child is HTMLPreElement => child.localName === "pre");

/** The parent's fences as files, in order, each named by fenceName for the mode, program or not,
 * its text the pre's text content. */
export const readFences = (parent: ParentNode, program: boolean): Fence[] =>
  fencesOf(parent).map((pre) => ({ name: fenceName(pre, program), text: pre.textContent ?? "" }));
