// The lint the check runs: the SDK's configuration, the recommended rules over the site's code,
// and the leftover check over its build, dist/, which fails on any CSS module script the build
// left in it. The check lints after the build (mise.toml), so the leftover check reads it. Then
// the web tiers' direction in web/, by the file each import resolves to, which
// test/unit/web-layers.test.ts runs over test/unit/web-layers-tree.ts's tree.
// Adapted from spike-html-hosting-architecture (27d70e1): eslint.config.js, its configuration the
// SDK's.
// Adapted from spike-html-hosting-sdk (v0.6.1): template/eslint.config.js, ignoring the copied
// wasm_exec.js, the pinned Go's own file, which mise run lint:go checks byte for byte.
// Adapted from spike-html-apps (dae9a77): eslint.config.js, its app tier's table replaced by the
// three web tiers', each a directory in web/.

import { config } from "@jaimestill/spike-html-hosting-sdk/eslint.js";
import { defineConfig } from "eslint/config";
import boundaries from "eslint-plugin-boundaries";
import importX from "eslint-plugin-import-x";
import globals from "globals";

const foundation = "@jaimestill/spike-html-apps-foundation";
const hostingComponents = "@jaimestill/spike-html-hosting-components";

/** The packages the tiers import by name, at any subpath: lit, which the hosting components pin,
 * so the site's elements and theirs share one copy; and the shell's packages, the foundation and
 * the hosting components, which index.html loads. */
export const packages = ["lit", foundation, hostingComponents];

// The web tiers' table, top down: the pages (the apps tier), the modules a hand or rendered page
// loads, which may import both tiers below them and the shell's packages; the components (the
// component tier, Lit elements prefixed sl-), which may import lit and the shell's packages, and
// never the runtime, whose runner a page passes in; and the runtime (the SDK tier: the loader, the
// worker, the in-memory filesystem, and wasm_exec.js), which imports nothing beyond its own files.
// Each tier may import its own files; nothing imports upward.
export const layers = [
  {
    name: "pages",
    path: "web/pages",
    may: ["pages", "components", "runtime", foundation, hostingComponents],
  },
  { name: "components", path: "web/components", may: ["components", ...packages] },
  { name: "runtime", path: "web/runtime", may: ["runtime"] },
];

/** The tier names, which the policies tell from the packages. */
const tiers = layers.map(({ name }) => name);

// Each tier is an element by its directory, matched from the root (partialMatch false), with a
// second pattern for a file in a directory whose name starts with a dot, which micromatch's **
// never enters, so ./.well-known/ and ./..x/ stay in their tier. A file elsewhere in web/ is a
// "loose" element with no policy, so it imports nothing.
const elements = [
  ...layers.map(({ name, path }) => ({
    type: name,
    pattern: [path, `${path}/**/.*`],
    partialMatch: false,
  })),
  { type: "loose", pattern: ["web"], partialMatch: false },
];

// The rule's default is disallow, and it checks every origin (a package is external) and local
// files no element holds: an import passes only when a policy names its target, a tier or a
// package the table names, which the rule matches by its name, any subpath of it.
const policies = layers.map(({ name, may }) => ({
  from: { element: { type: name } },
  allow: {
    to: may.map((target) =>
      tiers.includes(target)
        ? { element: { type: target } }
        : { module: { origin: "external", source: target } },
    ),
  },
}));

// The web tiers run in the browser, so their globals are the browser's: the SDK's configuration
// gives every file node's, which each node-only name turns off here.
const browserOnly = {
  ...Object.fromEntries(
    Object.keys(globals.node)
      .filter((name) => !(name in globals.browser))
      .map((name) => [name, "off"]),
  ),
  ...globals.browser,
};

export default defineConfig([
  { ignores: ["web/runtime/wasm_exec.js"] },
  ...config,
  { files: ["web/**"], languageOptions: { globals: browserOnly } },
  {
    files: ["web/**"],
    plugins: { boundaries, "import-x": importX },
    settings: {
      "import/resolver": { typescript: true },
      "import-x/resolver": { typescript: true },
      "boundaries/elements": elements,
    },
    // The rule judges the file an import resolves to, never the specifier's text, and
    // no-unresolved fails a specifier that names no file, so no import passes by naming none;
    // no-relative-packages fails a relative path that reaches a package's files, which would
    // otherwise pass as a local file rather than by the package's name.
    rules: {
      "import-x/no-unresolved": "error",
      "import-x/no-relative-packages": "error",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          checkAllOrigins: true,
          checkUnknownLocals: true,
          policies,
        },
      ],
    },
  },
]);
