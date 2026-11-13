// The Go module's checks, go-module.ts: the module passes them, and fixture modules with planted
// problems draw exactly the problems they plant, each named: forbidden imports among the layers,
// beside the allowed ones, which draw none; and go.mod's replace directives and local-path
// requirement. And the go-web-sdk scenario's import listing: internal/websdk and cmd/websdk,
// tests included, depend on the standard library, the bridge, and go-web-sdk's and go-core's
// packages alone, go-web-sdk's root and middleware packages among them; a planted listing draws
// each package outside those, named.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";

import { goLayerProblems, goModProblems, scenarioDepProblems, scenarioDeps } from "./go-module.ts";

const root = join(import.meta.dirname, "../..");

const fixture = "example.com/fixture";

/** A package's source: its name, and a blank import of each of the module's packages it names. */
function source(name: string, imports: string[], extra = ""): string {
  const lines = imports.map((path) => `\t_ "${fixture}/${path}"\n`).join("");
  const main = name === "main" ? "\nfunc main() {}\n" : "";
  return `package ${name}\n\nimport (\n\t_ "fmt"\n${lines})\n${main}${extra}`;
}

/** The fixture module: two scenarios, a and b, the bridge with a subpackage, and util, a second
 * root-level package beside the bridge. Each forbidden
 * import is planted beside the allowed ones; a cycle and a main package imported among them,
 * which Go itself refuses, are named all the same. A file under another GOOS holds a forbidden
 * import the GOOS=js listing never reads, and a test file one it does. */
const tree: Record<string, string> = {
  "go.mod": `module ${fixture}\n\ngo 1.27\n`,
  "cmd/a/main.go": source("main", ["internal/b", "bridge", "internal/a", "internal/a/store"]),
  "cmd/b/main.go": source("main", ["internal/b"]),
  "internal/a/a.go": source("a", ["internal/b", "cmd/a", "internal/a/store", "bridge/js"]),
  "internal/a/store/store.go": source("store", ["bridge"]),
  "internal/a/a_test.go": source("a", ["internal/b/view"]),
  "internal/b/b.go": source("b", ["bridge"]),
  "internal/b/view/view.go": source("view", []),
  "internal/b/b_linux.go": source("b", ["cmd/b"]),
  "bridge/bridge.go": source("bridge", ["internal/a"]),
  "bridge/js/js.go": source("js", ["bridge", "cmd/b"]),
  "util/util.go": source("util", ["bridge", "internal/a"]),
  "bridge/js/js_test.go": source("js_test", ["bridge/js"]),
};

/** The problems the tree plants, each once. */
const planted = [
  "bridge imports internal/a: a root-level package imports no internal/",
  "bridge/js imports cmd/b: a root-level package imports no cmd/",
  "cmd/a imports bridge: cmd/a imports only its own internal/a",
  "cmd/a imports internal/b: cmd/a imports only its own internal/a",
  "internal/a imports cmd/a: an internal/<s> imports no cmd/",
  "internal/a imports internal/b: internal/a imports no other scenario's internal/",
  "internal/a imports internal/b/view: internal/a imports no other scenario's internal/",
  "util imports internal/a: a root-level package imports no internal/",
];

/** Writes `files` under a new scratch directory, which `after` removes; returns it. */
const scratches: string[] = [];
function write(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "go-module-"));
  scratches.push(dir);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}
after(() => scratches.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe("the Go layers", () => {
  test("the module's packages import downward", () => {
    assert.deepEqual(goLayerProblems(root), []);
  });

  let dir: string;
  before(() => {
    dir = write(tree);
  });

  test("each planted import is named, and no allowed one", () => {
    assert.deepEqual(goLayerProblems(dir), [...planted].sort());
  });
});

describe("go.mod", () => {
  test("the module's go.mod has no replace directive and no local-path requirement", () => {
    assert.deepEqual(goModProblems(root), []);
  });

  test("a requirement by its module path at a version passes", () => {
    const dir = write({
      "go.mod": `module ${fixture}\n\ngo 1.27\n\nrequire example.com/x v1.0.0\n`,
    });
    assert.deepEqual(goModProblems(dir), []);
  });

  test("each replace directive and local-path requirement is named", () => {
    const dir = write({
      "go.mod": [
        `module ${fixture}`,
        "",
        "go 1.27",
        "",
        "require (",
        "\texample.com/x v1.0.0",
        "\t./local v0.0.0",
        ")",
        "",
        "replace example.com/x => ../x",
        "",
        "replace example.com/y v1.0.0 => example.com/z v1.2.0",
        "",
      ].join("\n"),
    });
    assert.deepEqual(goModProblems(dir), [
      "go.mod: replace example.com/x => ../x: no replace directive; require each module at a " +
        "published version",
      "go.mod: replace example.com/y v1.0.0 => example.com/z v1.2.0: no replace directive; " +
        "require each module at a published version",
      "go.mod: require ./local v0.0.0: a local-path requirement; require a module path",
    ]);
  });
});

describe("the go-web-sdk scenario's import listing", () => {
  const module = "github.com/JaimeStill/spike-html-go-wasm";
  const allowed = ["github.com/standards-lab/go-web-sdk", "github.com/standards-lab/go-core"];

  test("internal/websdk and cmd/websdk depend on the standard library, the bridge, and go-web-sdk's and go-core's packages alone", () => {
    const deps = scenarioDeps(root, "websdk");
    assert.ok(deps.includes("github.com/standards-lab/go-web-sdk"), "go-web-sdk's");
    assert.ok(deps.includes("github.com/standards-lab/go-web-sdk/middleware"), "its middleware's");
    assert.ok(deps.includes(`${module}/bridge`), "the bridge");
    assert.deepEqual(scenarioDepProblems(module, "websdk", deps, allowed), []);
  });

  test("each package outside them is named", () => {
    const deps = [
      `${module}/bridge`,
      `${module}/bridge/js`,
      `${module}/cmd/websdk`,
      `${module}/internal/websdk`,
      `${module}/internal/websdk/store`,
      `${module}/internal/websdk_test`,
      "github.com/standards-lab/go-core/graph",
      "github.com/standards-lab/go-web-sdk",
      "github.com/standards-lab/go-web-sdk-template",
      "github.com/standards-lab/sqlate/query",
      `${module}/internal/sqlate`,
      module,
    ];
    const why =
      "only the standard library, the bridge, and the packages of " + allowed.join(" and ");
    assert.deepEqual(scenarioDepProblems(module, "websdk", deps, allowed), [
      `websdk depends on github.com/standards-lab/go-web-sdk-template: ${why}`,
      `websdk depends on github.com/standards-lab/sqlate/query: ${why}`,
      `websdk depends on ${module}/internal/sqlate: ${why}`,
      `websdk depends on ${module}: ${why}`,
    ]);
  });
});
