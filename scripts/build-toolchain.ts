// The site build's toolchain step, after the Go entrypoints (scripts/build-go.sh): the playground's
// files, into dist/go/toolchain/, or the directory given as the first argument, which it empties
// first. Go's compiler and linker, cmd/compile and cmd/link built unchanged by the pinned Go for
// GOOS=js GOARCH=wasm, -trimpath and -ldflags "-s -w" as the entrypoints are; the archive of every
// standard-library package that builds for js/wasm, as `go list -export` names it in Go's build
// cache under the same -trimpath; the archive of every package of the site's pinned modules, the
// go.mod requirements, that the repository's own packages depend on, sqlate's and its
// dependencies' today, as `go list -deps -export ./...` names them, the repository's own packages
// left out; and manifest.json (web/runtime/manifest.ts), which names them.
// Every file but the manifest is named for its content's hash, so a new build never reuses a name
// for other bytes, and a page caching the old compiler can never pair it with new archives. The
// six test-only packages under std build no archive and are left out; unsafe, which the compiler
// provides itself, is listed with no archive. A standard package's archive is under std/, a module
// package's under mod/, each by its import path. The modules' packages are the ones the repository
// imports, not every package each module holds: a package no code here imports may not build for
// js/wasm, and a reader's program can import only what the site's own Go reaches. Reads no network
// (GOPROXY=off, GOTOOLCHAIN=local: install downloaded the modules); writes the output directory
// and Go's caches. test/unit/toolchain.test.ts runs buildToolchain().

import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { Manifest, ManifestPackage } from "../web/runtime/manifest.ts";

/** The environment every go command here runs in, as scripts/build-go.sh's. */
const env = {
  ...process.env,
  GOOS: "js",
  GOARCH: "wasm",
  GOWORK: "off",
  GOPROXY: "off",
  GOTOOLCHAIN: "local",
};

/** The repository's root, where go.mod is: every go command runs here, so ./... and the
 * modules' versions are the site's. */
const root = join(import.meta.dirname, "..");

/** The flags of every build here, the entrypoints' own; the archives' -trimpath matches the
 * compiler's, so the archives the page links are the ones a -trimpath build would. */
const trimpath = "-trimpath";
const ldflags = "-ldflags=-s -w";

/** `go args`, its stdout; rejects with its stderr when it fails. Asynchronous, so the compiler,
 * the linker, and the archives build at once. */
function go(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("go", args, { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
    child.on("error", (error) => reject(new Error(`go didn't run: ${error}`)));
    child.on("close", (code) =>
      code === 0
        ? resolve(stdout)
        : reject(new Error(`go ${args.join(" ")} exited ${code}: ${stderr}`)),
    );
  });
}

/** The hex digits of a file's SHA-256 that its hashed name carries: 16, 64 bits, enough that two
 * builds' different bytes never share a name. */
export const hashLength = 16;

/** The hashed name of `bytes` for `stem` and `extension`: stem.<hash>.extension. */
export function hashedName(stem: string, extension: string, bytes: Uint8Array): string {
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, hashLength);
  return `${stem}.${hash}.${extension}`;
}

/** Copies the file at `from` into `out` under `stem`'s hashed name; returns that name, relative
 * to `out`. */
function place(out: string, from: string, stem: string, extension: string): string {
  const name = hashedName(stem, extension, readFileSync(from));
  mkdirSync(dirname(join(out, name)), { recursive: true });
  copyFileSync(from, join(out, name));
  return name;
}

/** A package as `go list -json` prints it, the fields read here: Export, the archive's path in
 * the build cache, empty for a package that builds none; Standard, set for the standard library's;
 * and Module, the module a package outside it belongs to, Main set for the repository's own. */
interface Listed {
  ImportPath: string;
  Export?: string;
  Imports?: string[];
  Standard?: boolean;
  Module?: { Main?: boolean };
}

/** The fields every listing here prints. */
const fields = "-json=ImportPath,Export,Imports,Standard,Module";

/** The objects in `go list -json`'s output, a stream of top-level objects, one after another;
 * only a top-level object closes with a brace in the first column. */
function parseStream(listing: string): Listed[] {
  const text = listing.trim();
  return text ? JSON.parse(`[${text.replace(/^}\s*\n\{/gm, "},{")}]`) : [];
}

/** Builds cmd/`name` for js/wasm into `scratch`; returns its path. */
async function tool(scratch: string, name: string): Promise<string> {
  const path = join(scratch, `${name}.wasm`);
  await go(["build", trimpath, ldflags, "-o", path, `cmd/${name}`]);
  return path;
}

/** Writes the toolchain into `out`, emptied first, and returns its manifest. */
export async function buildToolchain(out: string): Promise<Manifest> {
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const scratch = mkdtempSync(join(tmpdir(), "build-toolchain-"));
  try {
    const [version, compile, link, std, deps] = await Promise.all([
      go(["env", "GOVERSION"]),
      tool(scratch, "compile"),
      tool(scratch, "link"),
      go(["list", trimpath, "-export", fields, "std"]),
      // The repository's packages' dependencies, the standard ones among them, already in std's
      // listing; only the modules' are kept from this one.
      go(["list", trimpath, "-deps", "-export", fields, "./..."]),
    ]);
    const modules = parseStream(deps).filter(
      ({ Standard, Module }) => !Standard && Module && !Module.Main,
    );

    const packages: Record<string, ManifestPackage> = {};
    for (const { ImportPath, Export, Imports = [], Standard } of [
      ...parseStream(std),
      ...modules,
    ]) {
      if (ImportPath === "unsafe") packages[ImportPath] = { imports: Imports };
      else if (Export) {
        const archive = place(out, Export, `${Standard ? "std" : "mod"}/${ImportPath}`, "a");
        packages[ImportPath] = { archive, imports: Imports };
      }
    }
    // A package with an archive imports only packages with one, or unsafe; anything else is a
    // gap in the listing that would surface as a missing archive in the page.
    for (const [path, { imports }] of Object.entries(packages)) {
      const missing = imports.filter((imported) => !packages[imported]);
      if (missing.length) throw new Error(`${path} imports ${missing.join(", ")}: not listed`);
    }

    const manifest: Manifest = {
      go: version.trim(),
      compile: place(out, compile, "compile", "wasm"),
      link: place(out, link, "link", "wasm"),
      packages,
    };
    writeFileSync(join(out, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
    return manifest;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  await buildToolchain(process.argv[2] ?? "dist/go/toolchain");
}
