// The editor's syntax themes, a build step: the SDK's built-in syntax themes, one per palette of the
// foundation's Color profile, each light and dark pair merged into one Shiki theme whose every
// color is light-dark(<light>, <dark>), as the SDK merges them for a Markdown page's fences. The
// SDK runs its merge only under node, inside markdownPages, and exports neither the merged themes
// nor the merge; the editor highlights in the browser, so the build merges the same pairs here and
// writes them into the one module the editor's tokenizer imports, web/components/syntax-themes.ts,
// through syntaxThemes(), a Vite plugin vite.config.ts lists. That file's own source, an empty
// list, is what tsc and ESLint read; the build replaces it, so a page never runs it.
//
// Each pair is held to the SDK's checkSyntax first, which the merge needs: the same rules in the
// same order in light and dark, each colored in both or neither. The merge is then the SDK's: light's
// rules, each color light-dark() of light's and dark's, and the editor's foreground and background
// paired the same way. Every token of a fence therefore takes, in each palette and scheme, the
// color the SDK's fence of the same code gives it; the browser tier holds the two equal.
// Adapted from spike-html-hosting-sdk (v0.6.2): src/syntax.ts, its theme resolution, rule list,
// foreground and background, pair, and merge, without the highlighter and stylesheet, which the
// editor does in the browser.

import { fileURLToPath } from "node:url";

import { builtinSyntax, checkSyntax } from "@jaimestill/spike-html-hosting-sdk/syntax.js";
import type { SyntaxTheme } from "@jaimestill/spike-html-hosting-sdk/syntax.js";
import { bundledThemes } from "shiki";
import type { BundledTheme, ThemeRegistration, ThemeRegistrationAny } from "shiki";
import type { Plugin } from "vite";

/** One theme rule: the scopes it matches and the color and font style it sets. */
interface Rule {
  name?: string;
  scope?: string | string[];
  settings: { foreground?: string; background?: string; fontStyle?: string };
}

/** The palette the foundation applies to a root with no data-palette, as its flexoki.css selects
 * it, `:where(:root, [data-palette="flexoki"])`, and as the SDK's stylesheet does. */
export const defaultPalette = "flexoki";

/** The module the build writes the merged themes into, the editor tokenizer's one import of
 * them. */
export const themesModule = fileURLToPath(
  new URL("../web/components/syntax-themes.ts", import.meta.url),
);

/** A theme of a pair, resolved to its object: a theme Shiki bundles by its name, or the object. */
async function resolveTheme(theme: BundledTheme | ThemeRegistrationAny) {
  if (typeof theme !== "string") return theme;
  return (await bundledThemes[theme]()).default;
}

/** A theme's rule list: tokenColors, as VS Code writes it, or settings, as a TextMate theme does. */
const rules = (theme: ThemeRegistrationAny): Rule[] =>
  ((theme as ThemeRegistration).tokenColors ?? theme.settings ?? []) as Rule[];

/** A theme's editor foreground. */
const foreground = (theme: ThemeRegistrationAny): string | undefined =>
  theme.colors?.["editor.foreground"] ?? (theme as ThemeRegistration).fg;

/** A theme's editor background. */
const background = (theme: ThemeRegistrationAny): string | undefined =>
  theme.colors?.["editor.background"] ?? (theme as ThemeRegistration).bg;

/** light-dark() of the pair's colors, either alone when the other has none. */
function pair(light: string | undefined, dark: string | undefined): string | undefined {
  if (light && dark) return `light-dark(${light}, ${dark})`;
  return light ?? dark;
}

/** The pair, which checkSyntax passes, merged into one theme named for the palette: light's rules,
 * each color light-dark() of light's and dark's. Every object is new, since Shiki rewrites the
 * themes it loads. */
function merge(
  palette: string,
  light: ThemeRegistrationAny,
  dark: ThemeRegistrationAny,
): ThemeRegistration {
  const d = rules(dark);
  const colors: Record<string, string> = {};
  const fg = pair(foreground(light), foreground(dark));
  const bg = pair(background(light), background(dark));
  if (fg) colors["editor.foreground"] = fg;
  if (bg) colors["editor.background"] = bg;
  return {
    name: palette,
    type: "light",
    colors,
    tokenColors: rules(light).map((rule, i) => {
      const settings: Rule["settings"] = {};
      const color = pair(rule.settings.foreground, d[i].settings.foreground);
      if (color) settings.foreground = color;
      if (rule.settings.fontStyle !== undefined) settings.fontStyle = rule.settings.fontStyle;
      return { scope: structuredClone(rule.scope), settings };
    }),
  };
}

/** The syntax themes merged, one Shiki theme per palette, named for it, in the themes' order;
 * throws naming each palette whose pair fails the SDK's check. */
export async function mergeSyntax(
  themes: readonly SyntaxTheme[] = builtinSyntax,
): Promise<ThemeRegistration[]> {
  const failures = (await Promise.all(themes.map(checkSyntax))).flat();
  if (failures.length > 0) {
    throw new Error(`syntax themes: a pair fails the SDK's check:\n  ${failures.join("\n  ")}`);
  }
  return Promise.all(
    themes.map(async ({ palette, light, dark }) =>
      merge(palette, await resolveTheme(light), await resolveTheme(dark)),
    ),
  );
}

/** The module's source as the build writes it: the default palette, and the merged themes as
 * JSON text, which the browser parses faster than the same object as a literal. */
export async function themesSource(): Promise<string> {
  const json = JSON.stringify(await mergeSyntax());
  return (
    `export const defaultPalette = ${JSON.stringify(defaultPalette)};\n` +
    `export const syntaxThemes = JSON.parse(${JSON.stringify(json)});\n`
  );
}

/** The build step as a Vite plugin: it loads themesModule as the merged themes, merged once a
 * build. */
export function syntaxThemes(): Plugin {
  let source: Promise<string> | undefined;
  return {
    name: "syntax-themes",
    load(id) {
      if (id !== themesModule) return null;
      source ??= themesSource();
      return source;
    },
  };
}
