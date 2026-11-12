// The playground's build steps: Go's own compiler and linker, cmd/compile and cmd/link built for
// GOOS=js (scripts/build-toolchain.ts), run as wasm_exec.js instances over a fresh in-memory fs
// (fs.ts) seeded with the program's files and its import closure's archives. The go command
// can't start processes under GOOS=js, so the build runs the two commands `go build -a -n`
// prints for a main package itself:
//
//   compile -p main -lang=<go1.N> -complete -goversion <manifest.go> -trimpath "/work=>"
//           -importcfg importcfg -pack -o main.a /clause/main.go <the .go files>
//   link -importcfg importcfg.link -buildmode=exe -s -w -o main.wasm main.a
//
// The compiler takes a package's name from its first file and fails each later file whose clause
// differs ("lib.go:1:1: package lib; expected package main"), but given -p main alone it builds a
// package lib, which only the linker refuses. The go command checks the clause itself; here a
// first file of the build's own, /clause/main.go, holding the clause alone, has the compiler do
// it. It lies outside the working directory, so it never takes a reader's file name, and declares
// nothing, so no message or symbol ever names it.
//
// The compiler writes its diagnostics to stdout, the linker to stderr; the go command merges the
// two, and the build writes both to its output as each tool wrote them.
//
// Each package list goes in an importcfg file, never on argv, which wasm_exec.js caps with the
// environment at 12 KB. The compiler's importcfg names the .go files' direct imports, the
// linker's the whole closure. -trimpath strips the working directory, so the tools' messages
// name each file as the reader does ("main.go:5:27: undefined: x").
//
// This module fetches nothing and touches no DOM: its caller, the worker, fetches the manifest and
// the archives and compiles the toolchain's modules, and hands them in. prepare() resolves the
// imports and seeds the fs, then the build's compile and link run one step each, so the caller
// can time them apart. wasm_exec.js must have loaded first: the steps read its Go from
// globalThis, and run on the fs installed on globalThis, which Go's syscall package and
// wasm_exec.js read there.
//
// A built program runs over another fresh fs, installProgramFs(), whose working directory holds
// every file of the build that isn't Go, so a run reads them by name and nothing it writes
// outlives it.

import { install, type GoFs, type OutputSink } from "./fs.ts";
import { closure, type Manifest } from "./manifest.ts";

/** One file of a program, as the reader's editor holds it: a name in one flat directory, and its
 * text. A .go file is Go source of package main; any other is placed in the run's working
 * directory. */
export interface BuildFile {
  name: string;
  text: string;
}

/** A compiled WebAssembly.Module, opaque here: the suite's types (lib es2024 and node's) declare
 * no WebAssembly, and this module only hands one to instantiate. */
export type CompiledModule = object;

/** What a build runs on: the manifest it resolves imports against, and the compiler and linker
 * it names, compiled. */
export interface Toolchain {
  manifest: Manifest;
  compile: CompiledModule;
  link: CompiledModule;
}

/** The archive the manifest names by `name`, its path relative to the manifest (std/fmt.<hash>.a),
 * or undefined when the caller holds none. Keyed by the hashed name, not the package, so a held
 * archive never pairs with a manifest naming other bytes. */
export type ArchiveLookup = (name: string) => Uint8Array | undefined;

/** The build's two steps, each a run of one of Go's tools. */
export type BuildStep = "compile" | "link";

/** A step that ran and failed: the tool's exit code, its diagnostics already written to the
 * build's output as the tool wrote them. */
export class BuildError extends Error {
  readonly step: BuildStep;
  readonly code: number;

  constructor(step: BuildStep, code: number) {
    super(`${step} exited with code ${code}`);
    this.name = "BuildError";
    this.step = step;
    this.code = code;
  }
}

/** The directory the build and a built program's run each work in, on their own fs. */
export const workdir = "/work";

/** Where the archives are seeded, each under its manifest name. */
const archiveDir = "/pkg";

/** The compile's first file, which makes main the package's name; see the header. */
const clauseFile = "/clause/main.go";

/** Whether a file is Go source, which the compiler reads; every other file only the run reads. */
export const isGo = (file: BuildFile) => file.name.endsWith(".go");

/** One token of Go source, as far as the import declarations need: an identifier or keyword, an
 * import path's string literal, unquoted, or one punctuation character. */
type Token = { kind: "word" | "string" | "punct"; text: string };

/** The tokens of source up to the first that can't open or continue an import declaration:
 * comments, white space, and semicolons are skipped. */
function* tokens(source: string): Generator<Token> {
  let at = 0;
  while (at < source.length) {
    const rest = source.slice(at);
    const skip = /^(?:[\s;]+|\/\/[^\n]*|\/\*[\s\S]*?\*\/)/.exec(rest);
    if (skip) {
      at += skip[0].length;
      continue;
    }
    const word = /^[\p{L}_][\p{L}\p{N}_]*/u.exec(rest);
    const raw = /^`([^`]*)`/.exec(rest);
    const quoted = /^"((?:[^"\\\n]|\\.)*)"/.exec(rest);
    if (word) {
      yield { kind: "word", text: word[0] };
      at += word[0].length;
    } else if (raw) {
      yield { kind: "string", text: raw[1] };
      at += raw[0].length;
    } else if (quoted) {
      // Import paths hold no escapes in practice; one that does is unquoted as JSON reads it,
      // and the compiler judges the result.
      let text = quoted[1];
      try {
        text = JSON.parse(quoted[0]) as string;
      } catch {
        // Kept as written.
      }
      yield { kind: "string", text };
      at += quoted[0].length;
    } else {
      yield { kind: "punct", text: source[at] };
      at += 1;
    }
  }
}

/** The import paths of one Go file's import declarations, in source order: each `import "p"`,
 * `import name "p"`, and grouped `import ( … )` spec, after the package clause. Reading stops at
 * the first token that isn't part of one, so malformed source yields what it declared well, and
 * the compiler reports the rest. */
export function goImports(source: string): string[] {
  const paths: string[] = [];
  const next = tokens(source);
  const take = () => next.next().value as Token | undefined;
  const is = (token: Token | undefined, kind: Token["kind"], text?: string) =>
    token?.kind === kind && (text === undefined || token.text === text);

  /** One import spec from its first token: an optional name, "." or "_" or an identifier, then
   * the path. Answers whether it read one. */
  const spec = (first: Token | undefined): boolean => {
    let token = first;
    if (is(token, "word") || is(token, "punct", ".")) token = take();
    if (!is(token, "string")) return false;
    paths.push(token!.text);
    return true;
  };

  if (!is(take(), "word", "package") || !is(take(), "word")) return paths;
  while (is(take(), "word", "import")) {
    const first = take();
    if (is(first, "punct", "(")) {
      for (let token = take(); !is(token, "punct", ")"); token = take()) {
        if (!spec(token)) return paths;
      }
    } else if (!spec(first)) {
      return paths;
    }
  }
  return paths;
}

/** The names of the program's .go files, in order; throws when it has none, as nothing builds. */
export function goSources(files: readonly BuildFile[]): string[] {
  const sources = files.filter(isGo).map((file) => file.name);
  if (sources.length === 0) throw new Error("the program has no .go file to build");
  return sources;
}

/** The standard packages the program's .go files import, each once, sorted. */
export function programImports(files: readonly BuildFile[]): string[] {
  return [...new Set(files.filter(isGo).flatMap((file) => goImports(file.text)))].sort();
}

/** The packages the program links, its imports' closure with runtime's (manifest.ts): the
 * archives a caller must hold before prepare(). Throws naming the first import the manifest
 * doesn't hold. */
export function programClosure(manifest: Manifest, files: readonly BuildFile[]): string[] {
  return closure(manifest, programImports(files));
}

/** wasm_exec.js's Go, the members the steps use. */
interface Go {
  argv: string[];
  env: Record<string, string>;
  exit: (code: number) => void;
  importObject: object;
  run(instance: object): Promise<void>;
}

/** The global scope's members the steps use, typed here for the reason CompiledModule is. */
interface Host {
  Go?: new () => Go;
  WebAssembly: { instantiate(module: CompiledModule, imports: object): Promise<object> };
}

const encoder = new TextEncoder();

/** Throws the error a synchronous fs callback answered; the in-memory fs calls back before it
 * returns. */
function check(err: Error | null) {
  if (err) throw err;
}

/** mkdir -p through the fs's own calls, an existing directory skipped. */
function mkdirAll(goFs: GoFs, path: string) {
  let at = "";
  for (const name of path.split("/").filter(Boolean)) {
    at += `/${name}`;
    goFs.fs.mkdir(at, 0o755, (err) => {
      if (err && err.code !== "EEXIST") throw err;
    });
  }
}

/** Writes bytes to the file at path, creating it and its directories. */
function writeFile(goFs: GoFs, path: string, bytes: Uint8Array) {
  mkdirAll(goFs, path.slice(0, path.lastIndexOf("/")));
  const { O_WRONLY, O_CREAT, O_TRUNC } = goFs.fs.constants;
  let fd = -1;
  goFs.fs.open(path, O_WRONLY | O_CREAT | O_TRUNC, 0o644, (err, opened) => {
    check(err);
    fd = opened!;
  });
  goFs.fs.write(fd, bytes, 0, bytes.length, 0, check);
  goFs.fs.close(fd, check);
}

/** The bytes of the file at path. */
function readFile(goFs: GoFs, path: string): Uint8Array {
  let fd = -1;
  goFs.fs.open(path, goFs.fs.constants.O_RDONLY, 0, (err, opened) => {
    check(err);
    fd = opened!;
  });
  let size = 0;
  goFs.fs.fstat(fd, (err, stats) => {
    check(err);
    size = stats!.size;
  });
  const bytes = new Uint8Array(size);
  goFs.fs.read(fd, bytes, 0, size, 0, check);
  goFs.fs.close(fd, check);
  return bytes;
}

/** An importcfg naming each package's archive on the fs; unsafe, which has none, is left out. */
function importcfg(manifest: Manifest, packages: readonly string[]): Uint8Array {
  const lines = packages.flatMap((path) => {
    const { archive } = manifest.packages[path];
    return archive ? [`packagefile ${path}=${archiveDir}/${archive}\n`] : [];
  });
  return encoder.encode(lines.join(""));
}

/** Runs one tool's module to its exit, over the fs on globalThis; throws a BuildError naming the
 * step when it exits nonzero, and an Error naming it when it traps. */
async function runTool(step: BuildStep, module: CompiledModule, args: string[]): Promise<void> {
  const host = globalThis as unknown as Host;
  if (!host.Go) throw new Error("wasm_exec.js hasn't loaded: there is no Go to run the build");
  const go = new host.Go();
  go.argv = [step, ...args];
  go.env = {};
  let code = 0;
  go.exit = (exited) => {
    code = exited;
  };
  const instance = await host.WebAssembly.instantiate(module, go.importObject);
  try {
    await go.run(instance);
  } catch (error) {
    throw new Error(`${step} trapped: ${error instanceof Error ? error.message : String(error)}`, {
      cause: error,
    });
  }
  if (code !== 0) throw new BuildError(step, code);
}

/** A prepared build: its fs seeded, its steps ready to run in order, compile, then link. */
export interface Build {
  /** The packages the program links, sorted. */
  readonly packages: readonly string[];
  /** Compiles every .go file as package main into main.a. */
  compile(): Promise<void>;
  /** Links main.a with the closure's archives, answering the program's .wasm. */
  link(): Promise<Uint8Array>;
}

/**
 * Prepares a build of `files`: resolves the .go files' imports to their closure through the
 * toolchain's manifest, then installs a fresh in-memory fs on globalThis, its fds 1 and 2 written
 * to `output`, holding each archive of the closure, from `archives`, the two importcfg files,
 * and the files themselves in the working directory, which becomes the fs's cwd.
 *
 * Throws before any tool runs, and before the fs is installed: naming the first import the manifest
 * doesn't hold ("package example.com/x is not in the manifest"), an archive the lookup lacks, or
 * a program with no .go file.
 *
 * Each step's failure rejects with a BuildError, its diagnostics already on `output`; a file
 * whose package clause isn't main fails in compile. The fs stays installed until the caller
 * installs another, as a run does; nothing else may run on globalThis's fs between the steps.
 */
export function prepare(
  toolchain: Toolchain,
  files: readonly BuildFile[],
  archives: ArchiveLookup,
  output?: OutputSink,
): Build {
  const { manifest } = toolchain;
  const sources = goSources(files);
  const imports = programImports(files);
  const packages = closure(manifest, imports);
  const held = packages.flatMap((path) => {
    const { archive } = manifest.packages[path];
    if (!archive) return [];
    const bytes = archives(archive);
    if (!bytes) throw new Error(`the archive ${archive} of package ${path} isn't held`);
    return [[archive, bytes] as const];
  });

  const goFs = install(globalThis as unknown as Record<string, unknown>, output);
  for (const [archive, bytes] of held) writeFile(goFs, `${archiveDir}/${archive}`, bytes);
  writeFile(goFs, clauseFile, encoder.encode("package main\n"));
  writeFile(goFs, `${workdir}/importcfg`, importcfg(manifest, imports));
  writeFile(goFs, `${workdir}/importcfg.link`, importcfg(manifest, packages));
  for (const file of files) writeFile(goFs, `${workdir}/${file.name}`, encoder.encode(file.text));
  goFs.process.chdir(workdir);

  // -lang is the version's language part, go1.27 of go1.27.4.
  const lang = /^go\d+\.\d+/.exec(manifest.go)?.[0] ?? manifest.go;
  let compiled = false;
  return {
    packages,
    async compile() {
      // A failed compile leaves no main.a a later link could take for this one's.
      compiled = false;
      await runTool("compile", toolchain.compile, [
        "-p",
        "main",
        `-lang=${lang}`,
        "-complete",
        "-goversion",
        manifest.go,
        "-trimpath",
        `${workdir}=>`,
        "-importcfg",
        "importcfg",
        "-pack",
        "-o",
        "main.a",
        clauseFile,
        ...sources,
      ]);
      compiled = true;
    },
    async link() {
      if (!compiled) throw new Error("link runs only after a successful compile");
      await runTool("link", toolchain.link, [
        "-importcfg",
        "importcfg.link",
        "-buildmode=exe",
        "-s",
        "-w",
        "-o",
        "main.wasm",
        "main.a",
      ]);
      return readFile(goFs, `${workdir}/main.wasm`);
    },
  };
}

/**
 * Installs a fresh in-memory fs for a run of a built program on scope, globalThis by default, as
 * install() does, its fds 1 and 2 written to `output`: its cwd the working directory, holding
 * every file of `files` that isn't Go, so os.ReadFile("input.txt") reads that file's text. Each
 * run installs its own, so nothing a run writes outlives it. Answers the fs.
 */
export function installProgramFs(
  files: readonly BuildFile[],
  output?: OutputSink,
  scope: Record<string, unknown> = globalThis as unknown as Record<string, unknown>,
): GoFs {
  const goFs = install(scope, output);
  mkdirAll(goFs, workdir);
  for (const file of files.filter((file) => !isGo(file))) {
    writeFile(goFs, `${workdir}/${file.name}`, encoder.encode(file.text));
  }
  goFs.process.chdir(workdir);
  return goFs;
}
