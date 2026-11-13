// A Go demo's file names: the rules a fence is named by, from what its markup says and the demo's
// mode and `file` attribute (fences.ts reads the markup, go-demo.ts the attribute), and the grammar
// a file's name gives it in the editor. Plain functions over strings, holding no DOM, so the unit
// tier reads them under node.
//
// A fence's name is the one its markup gives, data-file or title; else the demo's `file`, unless
// empty, which names every fence that names none; else a default from the language its markup
// names: main.go for go, input.json for json, query.sql for sql, input.txt for any other; and,
// with no language, main.go on a program or source demo and input.json on a handler demo. A file's
// grammar follows its name's extension, .go, .json, or .sql, any other plain: the languages the
// editor's tokenizer highlights (tokenizer.ts).

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

/** A fence's file name, by its markup, for the mode, program or not, and the demo's file: the
 * name the markup gives, else the file, unless empty, else a default from its language, or, with
 * none named, the mode's: main.go when program, a program or source demo, else input.json. */
export function fenceName(
  { named, language }: FenceMarkup,
  program: boolean,
  file?: string | null,
): string {
  if (named !== undefined) return named;
  if (file) return file;
  if (language === undefined) return program ? DEFAULT_NAMES.go : DEFAULT_NAMES.json;
  return DEFAULT_NAMES[language] ?? "input.txt";
}
