// The Go module's two checks, each a list of problems, empty when the module holds: its go.mod
// names no replace directive and no local-path requirement, so the module builds from the module
// cache alone, as the Pages build does; and its packages' direct imports flow downward through
// the Go layers. go-module.test.ts runs both on the module and on fixture modules.
//
// The layers, by a package's path within the module: cmd/<s>, a scenario's entrypoint, imports
// of the module's packages only its own composition root, internal/<s> and below; internal/<s>
// imports no other scenario's internal/<t> and no cmd/; bridge/ and below, the infrastructure,
// imports no internal/ and no cmd/. The standard library and other modules are never ruled here.
// A package's test imports count with its imports: a test is code in the package's layer.

import { spawnSync } from "node:child_process";

/** The environment every go command here runs in: the GOOS=js GOARCH=wasm build each
 * entrypoint is made for, so the files under those build constraints are the ones read, with no
 * network and no workspace, as mise run lint:go runs. `go list` runs natively, never as wasm. */
const env = {
  ...process.env,
  GOOS: "js",
  GOARCH: "wasm",
  GOWORK: "off",
  GOPROXY: "off",
  GOTOOLCHAIN: "local",
};

/** `go args` in `dir`, its stdout; throws with its stderr when it fails. */
function go(dir: string, args: string[]): string {
  const run = spawnSync("go", args, { cwd: dir, env, encoding: "utf8" });
  if (run.error) throw new Error(`go didn't run: ${run.error}`);
  if (run.status !== 0) throw new Error(`go ${args.join(" ")} exited ${run.status}: ${run.stderr}`);
  return run.stdout;
}

/** go.mod as `go mod edit -json` reads it, the fields the checks use. */
interface GoMod {
  Module: { Path: string };
  Require?: { Path: string; Version: string }[];
  Replace?: { Old: { Path: string; Version?: string }; New: { Path: string; Version?: string } }[];
}

const readGoMod = (dir: string): GoMod => JSON.parse(go(dir, ["mod", "edit", "-json"]));

/** A module path that is a directory rather than a module: the form a replace's local target
 * takes, and one a requirement must never. */
const local = (path: string) => /^\.\.?(\/|$)/.test(path) || path.startsWith("/");

/** The go.mod problems in the module at `dir`: each replace directive, local or not, which would
 * build the module from other code than its requirements name, and each requirement by a local
 * path. */
export function goModProblems(dir: string): string[] {
  const mod = readGoMod(dir);
  const at = (path: string, version?: string) => (version ? `${path} ${version}` : path);
  return [
    ...(mod.Replace ?? []).map(
      ({ Old, New }) =>
        `go.mod: replace ${at(Old.Path, Old.Version)} => ${at(New.Path, New.Version)}: ` +
        "no replace directive; require each module at a published version",
    ),
    ...(mod.Require ?? [])
      .filter(({ Path }) => local(Path))
      .map(
        ({ Path, Version }) =>
          `go.mod: require ${Path} ${Version}: a local-path requirement; require a module path`,
      ),
  ];
}

/** Why `from` may not import `to`, both paths within the module, or undefined when it may. */
function forbidden(from: string, to: string): string | undefined {
  const [layer, scenario] = from.split("/");
  const [target, targetScenario] = to.split("/");
  const own = (path: string) => path === to || to.startsWith(`${path}/`);
  if (layer === "cmd") {
    return own(`internal/${scenario}`)
      ? undefined
      : `cmd/${scenario} imports only its own internal/${scenario}`;
  }
  if (layer === "internal") {
    if (target === "cmd") return "an internal/<s> imports no cmd/";
    if (target === "internal" && targetScenario !== scenario) {
      return `internal/${scenario} imports no other scenario's internal/`;
    }
    return undefined;
  }
  if (layer === "bridge" && (target === "internal" || target === "cmd")) {
    return `bridge imports no ${target}/`;
  }
  return undefined;
}

/** The direction problems among the module's own packages at `dir`, by each package's direct
 * imports, its tests' included, under GOOS=js GOARCH=wasm, one line per forbidden edge naming
 * both packages within the module. -e lists a package's imports even where Go itself refuses
 * them, a cycle or a main package imported, so each forbidden edge is named rather than only
 * Go's first error; mise run lint:go fails on those errors. */
export function goLayerProblems(dir: string): string[] {
  const module = readGoMod(dir).Module.Path;
  const listing = go(dir, [
    "list",
    "-e",
    "-f",
    '{{.ImportPath}}\t{{join .Imports " "}} {{join .TestImports " "}} {{join .XTestImports " "}}',
    "./...",
  ]);
  /** A path within the module, or undefined for a package outside it. */
  const within = (path: string) =>
    path === module
      ? ""
      : path.startsWith(`${module}/`)
        ? path.slice(module.length + 1)
        : undefined;
  const problems = new Set<string>();
  for (const line of listing.split("\n").filter(Boolean)) {
    const [path, imports] = line.split("\t");
    const from = within(path)!;
    for (const imported of imports.split(" ").filter(Boolean)) {
      const to = within(imported);
      if (to === undefined || to === from) continue;
      const why = forbidden(from, to);
      if (why) problems.add(`${from} imports ${to}: ${why}`);
    }
  }
  return [...problems].sort();
}
