// The site's build (mise run build): the hand pages, index.html, components.html,
// playground.html, and sqlate.html, and the rendered Markdown pages, sqlate-compile.html,
// go-core-graph.html, and go-web-sdk-handlers.html, the foundation modules they load, the pages'
// scripts, the components and the tokenizer they load lazily, and the runtime's worker, into dist/:
// static files GitHub Pages serves as the repository's project site, under
// /<repository>/. The base is that path, and the repository's name is package.json's name, the one
// place it is written; the SDK's served(), which the browser tier and the captures serve the build
// with, reads the same name.
//
// The plugins: the SDK's cssModuleScripts, the CSS module script rewrite of the foundation's
// modules, first; the same rewrite of the components' own, web/components/'s, which the SDK's
// leaves out, as it parses only the packages under node_modules/@jaimestill/; syntaxThemes, the
// build step that merges each palette's syntax theme into the module the editor's tokenizer
// imports (scripts/syntax-themes.ts); the SDK's markdownPages, here with no copied tree, which
// renders the spike's own Markdown, markdown/'s pages, sqlate-compile.md, go-core-graph.md, and
// go-web-sdk-handlers.md, into markdown-shell.html, its fences highlighted at build, and fills
// every page's glyph markers, the header's and the dialogs', with the icons layer's svg; and the
// SDK's renderBlocking, which keeps each page's one entry script render-blocking.
// Adapted from spike-html-apps (529ec52): vite.external.config.ts, its plugins, with the base the
// Pages path and no preview host.
// Adapted from spike-html-hosting (cb0511c): vite.config.ts, its one page a page for each copied
// Markdown file.
// Adapted from spike-html-hosting-architecture (27d70e1): vite.config.ts, its plugins and its base
// the SDK's.
// Adapted from spike-html-hosting-sdk (v0.6.2): template/vite.config.ts, its trees none and its one
// page the hand index, as the SDK's README gives a root-style site.

import { fileURLToPath } from "node:url";

import { cssModuleScripts } from "@jaimestill/spike-html-hosting-sdk/css-module-scripts.js";
import { markdownPages } from "@jaimestill/spike-html-hosting-sdk/markdown-pages.js";
import { renderBlocking } from "@jaimestill/spike-html-hosting-sdk/render-blocking.js";
import { base } from "@jaimestill/spike-html-hosting-sdk/served.js";
import { defineConfig } from "vite";
import { standardCssModules } from "vite-plugin-standard-css-modules";

import { syntaxThemes } from "./scripts/syntax-themes.ts";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: base(root),
  plugins: [
    cssModuleScripts(),
    // The components' sheets, each one constructed CSSStyleSheet, as the SDK's rewrite pins them.
    standardCssModules({ include: ["**/web/components/**/*.ts"], outputMode: "CSSStyleSheet" }),
    syntaxThemes(),
    // The spike's own tree, markdown/, rendered into markdown-shell.html, and no copied tree:
    // content.json records none, so content/ holds nothing. The plugin takes one tree's source
    // as a copied tree's, and reads its repository and ref only to write a blob URL for a link
    // to a file listed external; the tree lists none and links nothing relative outside itself
    // (the build fails on such a link), so neither is read. The tree is the spike's working
    // tree, built as it stands, so no commit pins it: ref names the branch it publishes from.
    // The plugin also fills the glyph markers in every page the build writes, hand pages among
    // them.
    markdownPages({
      dir: "markdown",
      repository: "https://github.com/JaimeStill/spike-html-go-wasm",
      ref: "main",
      shell: "markdown-shell.html",
    }),
    renderBlocking(),
  ],
  // No public directory: the pages and what they import are the whole site.
  publicDir: false,
  build: {
    outDir: "dist",
    target: "es2024",
    // The hand pages: Vite builds index.html by default only with no input given, and the plugin
    // gives its pages, the rendered sqlate-compile.html, go-core-graph.html, and
    // go-web-sdk-handlers.html, as an input list, with which these concatenate. components.html is
    // the components page, playground.html the playground, and sqlate.html the sqlate page.
    rolldownOptions: {
      input: [
        `${root}index.html`,
        `${root}components.html`,
        `${root}playground.html`,
        `${root}sqlate.html`,
      ],
    },
  },
  // The runtime's worker (web/runtime/runner.ts starts it as `new Worker(new URL(...),
  // { type: "module" })`) is bundled as an ES module, its own chunk, which the page requests only
  // when the runner starts it.
  worker: { format: "es" },
  // A multi-page site: a path no page builds to is a 404 in the preview, as it is on Pages, never
  // a fallback to the index.
  appType: "mpa",
});
