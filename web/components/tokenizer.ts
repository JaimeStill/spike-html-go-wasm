// The editor's tokenizer, which sl-code-editor imports lazily, on the first editor's upgrade, so a
// page loads it only when it holds an editor, and after its own first paint: Shiki 4.6.0's core,
// its JavaScript regex engine, which needs no wasm, the Go and JSON grammars, and the palettes'
// merged syntax themes (syntax-themes.ts). The build emits no other grammar; Shiki's core bundles
// none of its own. The SDK's fences use Shiki's Oniguruma engine at build time; the JavaScript
// engine runs the same grammars, and the browser tier holds every token's color to the fence's.

import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import go from "shiki/langs/go.mjs";
import json from "shiki/langs/json.mjs";

import type { Palettes } from "./highlights.ts";
import { defaultPalette, syntaxThemes } from "./syntax-themes.ts";

/** A token of the text: where it starts and how long it is, in UTF-16 code units, and its color in
 * each palette, a light-dark() pair, by the palette's name. */
export interface Token {
  offset: number;
  length: number;
  colors: Record<string, string>;
}

/** The languages the tokenizer highlights, by the name a fence or an editor gives them. */
const languages = new Set(["go", "json"]);

/** The palettes the themes color, in the themes' order, and the foundation's default. */
export const palettes: Palettes = {
  names: syntaxThemes.map(({ name }) => name ?? ""),
  defaultPalette,
};

const highlighter = await createHighlighterCore({
  themes: [...syntaxThemes],
  langs: [go, json],
  engine: createJavaScriptRegexEngine(),
});

/** Every theme by its own name, as Shiki's multi-theme tokenizing takes them. */
const themes = Object.fromEntries(palettes.names.map((name) => [name, name]));

/** Whether the tokenizer highlights the language, named in any case. */
export const highlights = (language: string): boolean => languages.has(language.toLowerCase());

/** The text's tokens in the language, each colored in every palette; whitespace alone is no
 * token, since it paints nothing. Empty for a language the tokenizer doesn't highlight. */
export function tokenize(text: string, language: string): Token[] {
  if (!highlights(language)) return [];
  const lines = highlighter.codeToTokensWithThemes(text, {
    lang: language.toLowerCase(),
    themes,
  });
  const tokens: Token[] = [];
  for (const line of lines) {
    for (const { content, offset, variants } of line) {
      if (content.trim() === "") continue;
      const colors: Record<string, string> = {};
      for (const [palette, { color }] of Object.entries(variants)) {
        if (color) colors[palette] = color;
      }
      tokens.push({ offset, length: content.length, colors });
    }
  }
  return tokens;
}
