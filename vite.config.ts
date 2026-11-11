// The site's build (mise run build): the hand index, index.html, and the foundation modules it
// loads, into dist/: static files GitHub Pages serves as the repository's project site, under
// /<repository>/. The base is that path, and the repository's name is package.json's name, the one
// place it is written; the SDK's served(), which the browser tier and the captures serve the build
// with, reads the same name.
//
// The plugins, each the SDK's: cssModuleScripts, the CSS module script rewrite of the foundation's
// modules, first; markdownPages, here with no copied tree, which renders no page but fills every
// hand page's glyph markers, the header's and the dialogs', with the icons layer's svg; and
// renderBlocking, which keeps each page's one entry script render-blocking.
// Adapted from spike-html-apps (529ec52): vite.external.config.ts, its plugins, with the base the
// Pages path and no preview host.
// Adapted from spike-html-hosting (cb0511c): vite.config.ts, its one page a page for each copied
// Markdown file.
// Adapted from spike-html-hosting-architecture (27d70e1): vite.config.ts, its plugins and its base
// the SDK's.
// Adapted from spike-html-hosting-sdk (v0.6.1): template/vite.config.ts, its trees none and its one
// page the hand index, as the SDK's README gives a root-style site.

import { fileURLToPath } from "node:url";

import { cssModuleScripts } from "@jaimestill/spike-html-hosting-sdk/css-module-scripts.js";
import { markdownPages } from "@jaimestill/spike-html-hosting-sdk/markdown-pages.js";
import { renderBlocking } from "@jaimestill/spike-html-hosting-sdk/render-blocking.js";
import { base } from "@jaimestill/spike-html-hosting-sdk/served.js";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: base(root),
  plugins: [
    cssModuleScripts(),
    // No copied tree, so no rendered page and no shell to fill: the plugin is here for its glyph
    // markers, which it fills in every page the build writes, hand pages among them.
    markdownPages({ dir: "content", trees: [] }),
    renderBlocking(),
  ],
  // No public directory: the pages and what they import are the whole site.
  publicDir: false,
  build: {
    outDir: "dist",
    target: "es2024",
    // The hand pages: Vite builds index.html by default only with no input given, and the plugin
    // gives its pages, none here, as an input list.
    rolldownOptions: {
      input: [`${root}index.html`],
    },
  },
  // A multi-page site: a path no page builds to is a 404 in the preview, as it is on Pages, never
  // a fallback to the index.
  appType: "mpa",
});
