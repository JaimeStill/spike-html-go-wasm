// The playground's toolchain manifest, which the site build writes (scripts/build-toolchain.ts) to
// <base>go/toolchain/manifest.json: the Go version, Go's compiler and linker built for GOOS=js
// GOARCH=wasm, and each package a program can import, its archive and its direct imports: every
// standard-library package that builds for js/wasm, and every package of the site's pinned modules
// that the repository's own Go depends on. A module's package resolves as a standard one does, by
// its import path. Every file it names has a content-hashed name, given nowhere but here, so a
// cached old compiler can never pair with new archives: a new build names new files.

/** One package, the standard library's or a pinned module's: its archive, the .a file whose export data the compiler reads
 * and whose object the linker reads, at a path relative to the manifest, absent for unsafe
 * alone, which the compiler provides itself; and its direct imports, as Go resolves them for
 * js/wasm (a vendored package by its vendor/ path), in Go's sorted order. */
export interface ManifestPackage {
  archive?: string;
  imports: string[];
}

export interface Manifest {
  /** The Go that built every file, as `go env GOVERSION` names it: go1.27.4. */
  go: string;
  /** cmd/compile and cmd/link as .wasm, at paths relative to the manifest. */
  compile: string;
  link: string;
  /** Each package by its import path. */
  packages: Record<string, ManifestPackage>;
}

/** The packages a main package linking `imports`, its .go files' imports, depends on: each import
 * and every package it imports, transitively, with runtime and its own imports, which the linker
 * links into every program, imported or not. Sorted. Throws naming the first import, in the order
 * given, that the manifest doesn't hold. */
export function closure(manifest: Manifest, imports: Iterable<string>): string[] {
  const held = new Set<string>();
  const visit = (path: string) => {
    if (held.has(path)) return;
    const found = manifest.packages[path];
    if (!found) throw new Error(`package ${path} is not in the manifest`);
    held.add(path);
    found.imports.forEach(visit);
  };
  [...imports, "runtime"].forEach(visit);
  return [...held].sort();
}
