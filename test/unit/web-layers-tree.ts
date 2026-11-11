// The web tiers' import cases as one file tree in the site's shape: a file per forbidden import
// and form, each with the rules that catch it, and the imports each tier may make in the same
// layout. web-layers.test.ts lints it apart from the site's own web/, so the tree is the table's
// only subject: the three tiers in web/, wasm_exec.js in the runtime, and the packages as stubs
// in node_modules/.
// Adapted from spike-html-apps (dae9a77): test/unit/apps-tree.ts, its cases the web tiers'.

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import type { ESLint } from "eslint";

import { packages } from "../../eslint.config.js";

const root = join(import.meta.dirname, "../..");

/** The site's manifest as it stands, which the tree carries; the tests read its pins. */
export const manifest: { devDependencies: Record<string, string> } = JSON.parse(
  readFileSync(join(root, "package.json"), "utf8"),
);

const [lit, foundation, hostingComponents] = packages;

/** The SDK, a devDependency the build and the lint import, and never a tier. */
const sdk = "@jaimestill/spike-html-hosting-sdk";
/** The icons layer, whose glyphs the build fills in, and which no tier imports. */
const icons = "@jaimestill/spike-html-hosting-icons";

// The rules a case names: the table, the relative-path rule, and the resolution rule.
const table = "boundaries/dependencies";
const relativePackages = "import-x/no-relative-packages";
const unresolved = "import-x/no-unresolved";
/** The rules the lint flags the tree with. */
export const watched: string[] = [table, relativePackages, unresolved];

/** Files by their path in the tree, each to its source. */
export type Files = Record<string, string>;

/** Cases by their path in the tree, each to its source and the rules that flag it. */
export type Cases = Record<string, { source: string; rules: string[] }>;

/** An edge in each of the four import forms, one file per form, each named for the edge and its
 * form: a side-effect import, a type import, a re-export, and an import(). */
function forms(base: string, specifier: string): Files {
  return {
    [`${base}.ts`]: `import "${specifier}";`,
    [`${base}-type.ts`]: `import type { X } from "${specifier}";`,
    [`${base}-export.ts`]: `export * from "${specifier}";`,
    [`${base}-dynamic.ts`]: `await import("${specifier}");`,
  };
}

/** `files`, each path to its source and the rules that flag it, sorted. */
function by(rules: string[], files: Files): Cases {
  return Object.fromEntries(
    Object.entries(files).map(([path, source]) => [path, { source, rules: [...rules].sort() }]),
  );
}

const pages = "web/pages";
const components = "web/components";
const runtime = "web/runtime";

// Each file holds one import, named for what it imports.
export const violations: Cases = {
  ...by([table], {
    // A component imports neither the runtime, whose runner a page passes in, nor a page: in each
    // form, from deeper down, and wasm_exec.js, the runtime's too.
    ...forms(`${components}/forms/runtime`, "../../runtime/loader.js"),
    [`${components}/a/b/runtime.ts`]: `import "../../../runtime/loader.js";`,
    [`${components}/wasm-exec.ts`]: `import "../runtime/wasm_exec.js";`,
    ...forms(`${components}/forms/page`, "../../pages/main.js"),
    // The runtime imports no component and no page.
    ...forms(`${runtime}/forms/component`, "../../components/demo.js"),
    ...forms(`${runtime}/forms/page`, "../../pages/main.js"),
    // The runtime imports no package: lit, the shell's.
    [`${runtime}/lit.ts`]: `import "${lit}";`,
    [`${runtime}/foundation.ts`]: `import "${foundation}/dom.js";`,
    [`${runtime}/hosting-components.ts`]: `import "${hostingComponents}/settings.js";`,
    // A page imports lit only through a component, never by its name.
    [`${pages}/lit.ts`]: `import "${lit}";`,
    // A package no row names: lit-html, which lit re-exports, its name beginning with lit's,
    // which the table's names must not prefix; the SDK and the icons; a devDependency; and a
    // package whose name begins with the foundation's.
    [`${components}/lit-prefix.ts`]: `import "lit-html";`,
    [`${components}/sdk.ts`]: `import "${sdk}/eslint.js";`,
    [`${components}/icons.ts`]: `import "${icons}/octicon.js";`,
    [`${pages}/sdk.ts`]: `import "${sdk}/markdown-pages.js";`,
    [`${pages}/typescript.ts`]: `import ts from "typescript";`,
    [`${pages}/foundation-prefix.ts`]: `import "${foundation}x/dom.js";`,
    // A site file outside the tiers: the root's config, and web/ itself, which the bare climb
    // resolves to as its index.
    [`${pages}/root.ts`]: `import "../../vite.config.js";`,
    [`${pages}/bare-parent.ts`]: `export * from "..";`,
    // A file elsewhere in web/, in no tier, which imports nothing, a tier neither.
    "web/index.ts": `export * from "./runtime/loader.js";`,
    "web/lit.ts": `export * from "${lit}";`,
  }),
  // A package by a relative path into node_modules/, rather than by its name.
  ...by([table, relativePackages], {
    [`${components}/lit-path.ts`]: `import "../../node_modules/${lit}/index.js";`,
  }),
  // A specifier that names no file.
  ...by([table, unresolved], {
    [`${runtime}/missing.ts`]: `import "./absent.js";`,
  }),
};

/** `cases`, each path to its source alone. */
export const sources = (cases: Cases): Files =>
  Object.fromEntries(Object.entries(cases).map(([path, { source }]) => [path, source]));

// Every import a tier may make, in each form, with names that hold dots, which a rule must tell
// from . and .. segments: a page imports the runtime, the components, the shell's packages at a
// subpath, and its own files; a component lit by its name and at a subpath, the shell's packages,
// and its own files; the runtime its own files and wasm_exec.js.
export const allowed: Files = {
  ...forms(`${pages}/forms/runtime`, "../../runtime/loader.js"),
  ...forms(`${pages}/forms/component`, "../../components/demo.js"),
  [`${pages}/main.ts`]: [
    `import { define } from "${foundation}/dom.js";`,
    `import type { X } from "${hostingComponents}/settings.js";`,
    `export * from "./views/list.js";`,
    `await import("../components/demo.js");`,
  ].join("\n"),
  [`${pages}/views/list.ts`]: [
    `import type { X } from "../main.js";`,
    `export { define } from "../main.js";`,
    `await import("../../pages/main.js");`,
  ].join("\n"),
  [`${pages}/nested/index.ts`]: `import "..";\nexport * from "./";`,
  [`${pages}/dotted.ts`]: `import "./..x/y.ts";\nimport "./.well-known/a.ts";`,
  ...forms(`${components}/forms/lit`, lit),
  [`${components}/demo.ts`]: [
    `import { define } from "lit/decorators.js";`,
    `import "${foundation}/dom.js";`,
    `export * from "${hostingComponents}/shortcuts.js";`,
    `await import("./a/b/editor.js");`,
    `export const x = define;`,
  ].join("\n"),
  [`${components}/a/b/editor.ts`]: `import type { X } from "../../demo.js";`,
  ...forms(`${runtime}/forms/worker`, "../worker.js"),
  [`${runtime}/loader.ts`]: `import "./wasm_exec.js";\nexport * from "./fs/memory.js";`,
  [`${runtime}/fs/memory.ts`]: `import type { X } from "../loader.js";`,
};

/** The files the cases import that no case is: wasm_exec.js, which the lint ignores, among them. */
const targets: Files = {
  [`${pages}/index.ts`]: "export {};",
  [`${pages}/..x/y.ts`]: "export {};",
  [`${pages}/.well-known/a.ts`]: "export {};",
  [`${runtime}/worker.ts`]: "export {};",
  [`${runtime}/wasm_exec.js`]: "globalThis.Go = class {};",
  "vite.config.ts": "export {};",
};

/** The packages the cases name, as stubs in node_modules/: the table's, lit-html, the SDK, the
 * icons, typescript, and the foundation's namesake, each a module and its types at every
 * subpath. */
const externals = [...packages, "lit-html", sdk, icons, "typescript", `${foundation}x`];
const stub = (name: string): Files => ({
  "package.json": JSON.stringify({
    name,
    type: "module",
    exports: {
      ".": { types: "./index.d.ts", default: "./index.js" },
      "./*": { types: "./index.d.ts", default: "./index.js" },
    },
  }),
  "index.js": "export const define = () => {};\nexport default {};",
  "index.d.ts": [
    "export declare const define: () => void;",
    "declare const x: object;",
    "export default x;",
    "export interface X {}",
  ].join("\n"),
});

/** Writes `files` under `dir` with the manifest, the targets, and the externals, so every import
 * but the unresolved case's resolves and the lint judges it. A case's file replaces a target at
 * the same path. Returns the code files written under web/ that the lint reads: all but
 * wasm_exec.js. */
export function writeTree(dir: string, files: Files): string[] {
  const written: Files = { ...targets, ...files, "package.json": JSON.stringify(manifest) };
  for (const name of externals) {
    for (const [path, source] of Object.entries(stub(name))) {
      written[join("node_modules", name, path)] = source;
    }
  }
  for (const [path, source] of Object.entries(written)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), `${source}\n`);
  }
  return Object.keys(written).filter(
    (path) =>
      path.startsWith("web/") && /\.(js|ts)$/.test(path) && path !== `${runtime}/wasm_exec.js`,
  );
}

/** ESLint's JSON report on the tree under `dir`'s web/. -c takes the site's config, whose
 * patterns then match from the working directory, the tree, and whose plugins load from the
 * site's node_modules. Throws when ESLint doesn't run or exits other than 0 or 1. */
export function lint(dir: string): ESLint.LintResult[] {
  const eslint = join(root, "node_modules", ".bin", "eslint");
  const run = spawnSync(eslint, ["-c", join(root, "eslint.config.js"), "-f", "json", "web"], {
    cwd: dir,
    encoding: "utf8",
  });
  if (run.error) throw new Error(`eslint didn't run: ${run.error}`);
  if (run.status !== 0 && run.status !== 1) {
    throw new Error(`eslint exited ${run.status}: ${run.stderr}`);
  }
  return JSON.parse(run.stdout);
}
