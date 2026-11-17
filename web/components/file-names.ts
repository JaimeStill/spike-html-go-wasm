// A Go demo's file names: the rules a fence is named by, from what its markup says and the demo's
// `file` attribute (fences.ts reads the markup, go-demo.ts the attribute), and the grammar
// a file's name gives it in the editor; and the rule a fence's text is read by. Plain functions
// over strings, holding no DOM, so the unit tier reads them under node.
//
// A fence's name is the one its markup gives, data-file or title; else the demo's `file`, unless
// empty, which names every fence that names none; else a default from the language its markup
// names: main.go for go, input.json for json, query.sql for sql, and input.txt for any other or
// for none, a fence with no info string being text. A file's
// grammar follows its name's extension, .go, .json, or .sql, any other plain: the languages the
// editor's tokenizer highlights (tokenizer.ts).
//
// A fence's text is its lines, the lines between its backticks: its pre's text content less one
// final newline, when it ends in one. marked renders a plain fence's code as its text and one
// newline, `TEXT\n`, the newline no line of the fence's own; the SDK's Shiki rendering writes each
// line a span, newlines between them and none after the last, `TEXT`. Both forms of a fence
// therefore read alike, TEXT. A fence whose last line is blank holds an empty last line in Shiki's
// form, `TEXT\n`, and that reads as TEXT too, as its plain form does: marked drops a fence's
// final newline before it adds its own, so its plain form can't tell a blank last line from none,
// and the rule follows it. A page's own markup with two final newlines, `TEXT\n\n`, keeps one.

/** What a fence's markup says of its name: the name it gives, data-file or title, and the
 * language it names; either undefined when the markup gives none. */
export interface FenceMarkup {
  named?: string;
  language?: string;
}

/** The fences' default names, by language. */
const DEFAULT_NAMES: Readonly<Record<string, string>> = Object.freeze({
  go: "main.go",
  json: "input.json",
  sql: "query.sql",
});

/** The grammar of a file's name: go, json, or sql by its extension, any other plain. */
export const languageOf = (name: string): string => /\.(go|json|sql)$/.exec(name)?.[1] ?? "";

/** A fence's file name, by its markup and the demo's file: the name the markup gives, else the
 * file, unless empty, else a default from its language, input.txt for a language with none of its
 * own or for no language. */
export function fenceName({ named, language }: FenceMarkup, file?: string | null): string {
  if (named !== undefined) return named;
  if (file) return file;
  return language !== undefined && Object.hasOwn(DEFAULT_NAMES, language)
    ? DEFAULT_NAMES[language]
    : "input.txt";
}

/** A fence's text, its lines, from its pre's text content: the content less one final newline,
 * the one marked's plain rendering adds, when it ends in one. */
export const fenceText = (content: string): string =>
  content.endsWith("\n") ? content.slice(0, -1) : content;
