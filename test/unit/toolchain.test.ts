// The playground's toolchain, scripts/build-toolchain.ts, built into a scratch directory, since
// the site build empties dist/ beside this tier: every file the manifest names exists under its
// content's hash, and nothing else is written; and the import closure the manifest gives
// (web/runtime/manifest.ts) equals the pinned Go's own `go list -deps` for a fixture program, for
// an import-free main, which still closes over runtime's packages, and for playground/sqlate and
// playground/graph, whose closures reach the site's pinned modules, sqlate's and go-core's; and
// the modules' packages are exactly the ones the repository's own packages depend on, go-core's
// graph and lifecycle and go-web-sdk's root and middleware packages among them, which the
// go-web-sdk scenario's closure reaches, each archive under mod/. Writes nothing outside TMPDIR
// and Go's caches.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { after, before, describe, test } from "node:test";

import { buildToolchain, hashedName } from "../../scripts/build-toolchain.ts";
import { programImports } from "../../web/runtime/build.ts";
import { closure, type Manifest } from "../../web/runtime/manifest.ts";

const root = join(import.meta.dirname, "../..");

const scratches: string[] = [];
const scratch = (prefix: string) => {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  scratches.push(dir);
  return dir;
};
after(() => scratches.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

/** `go list args` in `dir` for js/wasm, reading no network: its lines, sorted. */
function goList(dir: string, args: string[]): string[] {
  const run = spawnSync("go", ["list", ...args], {
    cwd: dir,
    encoding: "utf8",
    env: {
      ...process.env,
      GOOS: "js",
      GOARCH: "wasm",
      GOWORK: "off",
      GOPROXY: "off",
      GOTOOLCHAIN: "local",
    },
  });
  assert.equal(run.status, 0, run.stderr);
  return run.stdout.split("\n").filter(Boolean).sort();
}

/** The pinned Go's dependency list for a main package of `source`, built for js/wasm: every
 * package `go list -deps` names but the program's own, sorted. */
function goDeps(source: string): string[] {
  const dir = scratch("toolchain-program-");
  writeFileSync(join(dir, "go.mod"), "module example.com/program\n\ngo 1.27\n");
  writeFileSync(join(dir, "main.go"), source);
  return goList(dir, ["-deps", "."]).filter((path) => path !== "example.com/program");
}

/** The standard library's packages and the repository's, by Go's own patterns. */
const standard = () => new Set(goList(root, ["std"]));
const own = () => new Set(goList(root, ["./..."]));

/** Every file under `dir`, relative to it, sorted. */
const files = (dir: string) =>
  readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name).slice(dir.length + 1))
    .sort();

describe("the toolchain", () => {
  let out: string;
  let manifest: Manifest;
  before(async () => {
    out = scratch("toolchain-");
    manifest = await buildToolchain(out);
  });

  test("the manifest on disk is the one returned, naming the pinned Go", () => {
    assert.deepEqual(JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")), manifest);
    assert.match(manifest.go, /^go1\.\d+/);
  });

  test("every file the manifest names exists under its content's hash, and no other", () => {
    const named = [
      manifest.compile,
      manifest.link,
      ...Object.values(manifest.packages).flatMap(({ archive }) => (archive ? [archive] : [])),
    ];
    assert.deepEqual(files(out), [...named, "manifest.json"].sort());
    for (const name of named) {
      const [stem, extension] = [name.replace(/\.[0-9a-f]+\.\w+$/, ""), name.split(".").pop()!];
      assert.equal(name, hashedName(stem, extension, readFileSync(join(out, name))), name);
    }
    assert.match(basename(manifest.compile), /^compile\.[0-9a-f]{16}\.wasm$/);
    assert.match(basename(manifest.link), /^link\.[0-9a-f]{16}\.wasm$/);
  });

  test("unsafe alone is listed without an archive, and runtime and fmt with one", () => {
    const archiveless = Object.entries(manifest.packages).filter(([, { archive }]) => !archive);
    assert.deepEqual(archiveless, [["unsafe", { imports: [] }]]);
    assert.match(manifest.packages.runtime.archive!, /^std\/runtime\.[0-9a-f]{16}\.a$/);
    assert.match(manifest.packages.fmt.archive!, /^std\/fmt\.[0-9a-f]{16}\.a$/);
  });

  test("a program's closure is Go's own dependency list for it", () => {
    // net/http reaches vendored packages, which the closure names by their vendor/ paths.
    const imports = ["encoding/json", "fmt", "net/http", "os"];
    const source = `package main

import (
${imports.map((path) => `\t_ "${path}"`).join("\n")}
)

func main() {}
`;
    const deps = goDeps(source);
    assert.ok(deps.some((path) => path.startsWith("vendor/")));
    assert.deepEqual(closure(manifest, imports), deps);
  });

  test("an import-free main still closes over runtime's packages", () => {
    const deps = goDeps("package main\n\nfunc main() {}\n");
    assert.ok(deps.includes("runtime"));
    assert.deepEqual(closure(manifest, []), deps);
  });

  test("the modules' packages are every package of a pinned module the repository's packages depend on, each archive under mod/, and none of the repository's own", () => {
    const std = standard();
    const mine = own();
    const wanted = goList(root, ["-deps", "./..."]).filter(
      (path) => !std.has(path) && !mine.has(path),
    );
    assert.ok(wanted.includes("github.com/standards-lab/sqlate/postgres"), "sqlate's");
    assert.ok(wanted.includes("github.com/standards-lab/go-core/graph"), "graph's");
    assert.ok(wanted.includes("github.com/standards-lab/go-core/lifecycle"), "lifecycle's");
    assert.ok(wanted.includes("github.com/standards-lab/go-web-sdk"), "go-web-sdk's");
    assert.ok(
      wanted.includes("github.com/standards-lab/go-web-sdk/middleware"),
      "its middleware's",
    );
    const held = Object.keys(manifest.packages).filter((path) => !std.has(path));
    assert.deepEqual(held.sort(), wanted);
    for (const path of held) {
      const { archive } = manifest.packages[path];
      assert.match(archive!, new RegExp(`^mod/${path.replace(/\./g, "\\.")}\\.[0-9a-f]{16}\\.a$`));
    }
    for (const path of std) {
      const { archive } = manifest.packages[path] ?? {};
      if (archive) assert.match(archive, /^std\//, path);
    }
  });

  for (const [program, module] of [
    ["sqlate", "github.com/standards-lab/sqlate"],
    ["graph", "github.com/standards-lab/go-core"],
  ]) {
    test(`playground/${program}'s closure, through the site's pinned modules, is Go's own dependency list for it`, () => {
      const dir = join(root, "playground", program);
      const files = readdirSync(dir)
        .filter((name) => name.endsWith(".go") && !name.endsWith("_test.go"))
        .map((name) => ({ name, text: readFileSync(join(dir, name), "utf8") }));
      const imports = programImports(files);
      assert.ok(imports.some((path) => path.startsWith(module)));
      const mine = own();
      const deps = goList(root, ["-deps", `./playground/${program}`]).filter(
        (path) => !mine.has(path),
      );
      assert.deepEqual(closure(manifest, imports), deps);
    });
  }

  test("an import the manifest doesn't hold is named", () => {
    assert.throws(() => closure(manifest, ["fmt", "example.com/nope"]), {
      message: "package example.com/nope is not in the manifest",
    });
  });
});
