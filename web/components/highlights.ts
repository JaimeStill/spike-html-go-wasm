// The editors' shared highlights: one Highlight per token color, in the document's one registry,
// CSS.highlights, which every editor on the page paints into. A token's color is its colors in
// every palette at once, each a light-dark() pair, so one highlight serves every palette and
// scheme, and the page's palette picks the color in CSS, never in script.
//
// Each color has a name, sl-code-<n>, numbered as it is first met, and two rules:
//
// - In highlightSheet, which every editor's shadow root adopts after its own sheet:
//   ::highlight(sl-code-<n>) { color: var(--sl-code-<n>); }. A ::highlight() rule paints only
//   ranges in its own tree, so the rule is the shadow root's; its var() resolves on the
//   highlighted text's element, so it reads what the page sets around the editor.
// - In the document's sheet, which the first color adopts into the document: --sl-code-<n> is
//   each palette's color under that palette's data-palette, the default palette's also on a root
//   with none, as the foundation's own color profiles select themselves, and is reset to the
//   guaranteed-invalid value under any other data-palette, so a palette with no syntax theme,
//   anywhere in the tree, paints its code in the text's own color, plain.
//
// The names and rules only grow: a color met once keeps its name for the page's life. Ranges are
// each editor's own: Painted holds one editor's ranges, replaces them as it re-highlights, and
// removes them as it disconnects, leaving every other editor's ranges in the same highlights.

/** The sheet every editor's shadow root adopts: a ::highlight() rule per color. */
export const highlightSheet = new CSSStyleSheet();

/** A palette's syntax colors, as the tokenizer gives them: its name, and whether the foundation
 * applies it to a root with no data-palette. */
export interface Palettes {
  names: readonly string[];
  defaultPalette: string;
}

/** The document's sheet and the rule each palette sets its colors in, made with the first
 * color. */
interface DocumentRules {
  reset: CSSStyleRule;
  palettes: Map<string, CSSStyleRule>;
}

let documentRules: DocumentRules | undefined;

/** Each color's highlight name, by its key: its palettes' colors in the palettes' order. */
const names = new Map<string, string>();

/** The document's sheet: a reset rule under any data-palette, then a rule per palette, each at
 * zero specificity, so the later rule wins on an element both select, as a root with a palette set
 * is selected by the reset and its palette's rule. Adopted into the document once. */
function rulesFor({ names: palettes, defaultPalette }: Palettes): DocumentRules {
  if (documentRules) return documentRules;
  const sheet = new CSSStyleSheet();
  const selector = (palette: string) =>
    palette === defaultPalette
      ? `:where(:root:not([data-palette]), [data-palette="${palette}"])`
      : `:where([data-palette="${palette}"])`;
  sheet.insertRule(`:where([data-palette]) {}`, 0);
  for (const palette of palettes)
    sheet.insertRule(`${selector(palette)} {}`, sheet.cssRules.length);
  const rules = [...sheet.cssRules] as CSSStyleRule[];
  document.adoptedStyleSheets.push(sheet);
  documentRules = {
    reset: rules[0],
    palettes: new Map(palettes.map((palette, i) => [palette, rules[i + 1]])),
  };
  return documentRules;
}

/** The highlight name of a token's color, its colors by palette: the name it already has, or a new
 * one, with its rules and its Highlight registered. */
export function highlightName(
  colors: Readonly<Record<string, string>>,
  palettes: Palettes,
): string {
  const key = palettes.names.map((palette) => colors[palette] ?? "").join("\n");
  const known = names.get(key);
  if (known) return known;
  const name = `sl-code-${names.size}`;
  names.set(key, name);
  const rules = rulesFor(palettes);
  rules.reset.style.setProperty(`--${name}`, "initial");
  for (const [palette, rule] of rules.palettes) {
    const color = colors[palette];
    if (color) rule.style.setProperty(`--${name}`, color);
  }
  highlightSheet.insertRule(
    `::highlight(${name}) { color: var(--${name}); }`,
    highlightSheet.cssRules.length,
  );
  CSS.highlights.set(name, new Highlight());
  return name;
}

/** One editor's ranges in the shared highlights. */
export class Painted {
  #ranges: [Highlight, Range][] = [];

  /** Replaces this editor's ranges with these, each by its highlight's name. */
  replace(ranges: Iterable<readonly [string, Range]>): void {
    this.clear();
    for (const [name, range] of ranges) {
      const highlight = CSS.highlights.get(name);
      if (!highlight) continue;
      highlight.add(range);
      this.#ranges.push([highlight, range]);
    }
  }

  /** Removes this editor's ranges, leaving every other editor's. */
  clear(): void {
    for (const [highlight, range] of this.#ranges) highlight.delete(range);
    this.#ranges = [];
  }
}
