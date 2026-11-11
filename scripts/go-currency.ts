// mise run currency's go.mod part, after the SDK's currency bin: each direct requirement of
// go.mod behind its latest release, one line each as `go.mod: MODULE PIN -> LATEST`. Indirect
// requirements are left to Go's resolver. Go itself names the latest release and judges whether
// it's newer: `go list -m -u -json` over the direct requirements, run on a scratch copy of go.mod
// and go.sum, so the query's -mod=mod can never rewrite the module's own. Prints nothing and
// exits 0 when every requirement is current, and nothing when go.mod requires nothing; exits 1
// with a line per trailing requirement; when a go command fails, exits 2 with no stdout line and
// its stderr on stderr. Reads the network; writes nothing outside TMPDIR and Go's caches.
// test/unit/go-currency.test.ts runs trailing() over recorded output.

import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A go.mod requirement as `go mod edit -json` reads it. */
export interface Requirement {
  Path: string;
  Version: string;
  Indirect?: boolean;
}

/** A module as `go list -m -u -json` prints it, the fields read here; Update only when a newer
 * release than Version exists. */
interface Listed {
  Path: string;
  Update?: { Version: string };
}

/** The objects in `go list -json`'s output, a stream of top-level objects, one after another;
 * only a top-level object closes with a brace in the first column. */
function parseStream(listing: string): Listed[] {
  const text = listing.trim();
  return text ? JSON.parse(`[${text.replace(/^}\s*\n\{/gm, "},{")}]`) : [];
}

/** The line for each of `requires`' direct requirements that `listing`, the output of
 * `go list -m -u -json` over them, shows behind its latest release, in go.mod's order. */
export function trailing(requires: Requirement[], listing: string): string[] {
  const listed = new Map(parseStream(listing).map((module) => [module.Path, module]));
  return requires
    .filter(({ Indirect }) => !Indirect)
    .flatMap(({ Path, Version }) => {
      const update = listed.get(Path)?.Update;
      return update ? [`go.mod: ${Path} ${Version} -> ${update.Version}`] : [];
    });
}

/** `go args` in `dir` under `env`, its stdout; throws with its stderr when it fails. Its stderr
 * is kept either way, so a current tree's run prints nothing, not even Go's downloads. */
function go(dir: string, args: string[], env: NodeJS.ProcessEnv): string {
  const run = spawnSync("go", args, { cwd: dir, env, encoding: "utf8" });
  if (run.error) throw new Error(`go didn't run: ${run.error}`);
  if (run.status !== 0) throw new Error(`go ${args.join(" ")} exited ${run.status}: ${run.stderr}`);
  return run.stdout;
}

/** The go.mod part over the module at `root`, or the module given as the first argument: prints
 * each trailing requirement's line, and exits 1 when any trails; throws, printing nothing, when a
 * go command fails. */
function main(root: string): void {
  // The module alone, never a workspace, at the pinned Go; GOPROXY as the environment has it.
  const env = { ...process.env, GOWORK: "off", GOTOOLCHAIN: "local" };
  const mod = JSON.parse(go(root, ["mod", "edit", "-json"], env)) as { Require?: Requirement[] };
  const requires = mod.Require ?? [];
  const direct = requires.filter(({ Indirect }) => !Indirect).map(({ Path }) => Path);
  if (direct.length === 0) return;

  const scratch = mkdtempSync(join(tmpdir(), "go-currency-"));
  let listing: string;
  try {
    for (const file of ["go.mod", "go.sum"]) {
      if (existsSync(join(root, file))) copyFileSync(join(root, file), join(scratch, file));
    }
    listing = go(scratch, ["list", "-m", "-u", "-json", ...direct], {
      ...env,
      GOFLAGS: "-mod=mod",
    });
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  const lines = trailing(requires, listing);
  for (const line of lines) process.stdout.write(`${line}\n`);
  if (lines.length > 0) process.exitCode = 1;
}

if (import.meta.main) {
  try {
    main(process.argv[2] ?? join(import.meta.dirname, ".."));
  } catch (error) {
    process.stderr.write(`go.mod currency: ${error instanceof Error ? error.message : error}\n`);
    process.exitCode = 2;
  }
}
