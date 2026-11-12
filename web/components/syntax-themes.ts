// The editor's syntax themes: each palette's Shiki theme, its light and dark pair merged into one
// whose every color is light-dark(<light>, <dark>), and the palette the foundation applies to a
// root with no data-palette. The build writes this module: scripts/syntax-themes.ts merges the
// SDK's built-in syntax themes and loads the result in place of this file's source, so the empty
// list below is what tsc and ESLint read, and no page runs it. Only tokenizer.ts imports it, so the
// themes load with the tokenizer, never with the page.

import type { ThemeRegistration } from "shiki/core";

/** The palette the foundation applies to a root with no data-palette. */
export const defaultPalette: string = "flexoki";

/** Each palette's merged theme, named for the palette. */
export const syntaxThemes: readonly ThemeRegistration[] = [];
