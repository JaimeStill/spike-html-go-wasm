// The web tiers' import rules: eslint.config.js run over test/unit/web-layers-tree.ts's tree,
// passing only when ESLint flags exactly the files that break a rule, each with exactly the rules
// its case names.
// Adapted from spike-html-apps (dae9a77): test/unit/apps.test.ts, on the web tiers' tree.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import {
  allowed,
  lint,
  manifest,
  sources,
  violations,
  watched,
  writeTree,
} from "./web-layers-tree.ts";

const root = join(import.meta.dirname, "../..");

describe("web-tier imports", () => {
  test("the eslint installed is the one package.json pins", () => {
    const eslint = join(root, "node_modules", ".bin", "eslint");
    const run = spawnSync(eslint, ["--version"], { encoding: "utf8" });
    assert.equal(run.stdout.trim(), `v${manifest.devDependencies.eslint}`);
  });

  // One tree, so each case is judged beside the others, as the site's files will be.
  const files = { ...sources(violations), ...allowed };
  let scratch: string;
  /** Each file the lint flags, by its path in the tree, to the watched rules it draws, sorted. */
  let found: Record<string, string[]>;
  before(() => {
    scratch = mkdtempSync(join(tmpdir(), "web-layers-"));
    const code = writeTree(scratch, files);
    const report = lint(scratch);
    assert.deepEqual(
      report.map((file) => file.filePath.slice(scratch.length + 1)).sort(),
      code.sort(),
      "ESLint lints every code file under web/ but wasm_exec.js",
    );
    const fatal = report.filter((file) => file.messages.some((m) => m.fatal));
    assert.deepEqual(
      fatal.map((file) => file.filePath),
      [],
      "every file parses, so each import is judged",
    );
    found = {};
    for (const file of report) {
      const rules = [...new Set(file.messages.map((m) => m.ruleId))].filter(
        (id): id is string => id !== null && watched.includes(id),
      );
      if (rules.length > 0) found[file.filePath.slice(scratch.length + 1)] = rules.sort();
    }
  });
  after(() => rmSync(scratch, { recursive: true, force: true }));

  test("every forbidden import draws exactly the rules its case names", () => {
    const expected = Object.fromEntries(
      Object.entries(violations).map(([path, { rules }]) => [path, rules]),
    );
    const caught = Object.fromEntries(Object.keys(expected).map((path) => [path, found[path]]));
    assert.deepEqual(caught, expected);
  });

  test("a tree of allowed imports draws none", () => {
    assert.deepEqual(
      Object.keys(allowed).filter((path) => path in found),
      [],
    );
  });

  test("no file outside the cases draws a rule", () => {
    assert.deepEqual(
      Object.keys(found).filter((path) => !(path in files)),
      [],
    );
  });
});
