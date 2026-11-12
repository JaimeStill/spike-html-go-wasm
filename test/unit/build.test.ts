// The playground's build steps (web/runtime/build.ts) under node, over the toolchain
// scripts/build-toolchain.ts builds into a scratch directory, as test/unit/toolchain.test.ts does:
// Go's compiler and linker, compiled once, compile and link a program's files over its closure's
// archives on the runtime's in-memory fs, and the built program runs over a fresh fs whose
// working directory holds the program's other files. hello builds and runs; a compile error
// reaches the output as the compiler wrote it, positions relative to the file's name, with its
// exit code and the step named; an import the manifest lacks fails before the compiler runs; a
// package clause other than main fails in the compiler; and a program reads a non-Go file from
// its working directory, and what a run writes is gone from the next. Writes nothing outside
// TMPDIR and Go's caches; node's process.cwd and chdir, which install() replaces, are restored.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { buildToolchain } from "../../scripts/build-toolchain.ts";
import {
  BuildError,
  type BuildFile,
  goImports,
  installProgramFs,
  prepare,
  programClosure,
  type Toolchain,
} from "../../web/runtime/build.ts";
import type { OutputSink } from "../../web/runtime/fs.ts";

// The suite's types carry no WebAssembly declarations (lib es2024, node's types), so the shim's Go
// and WebAssembly are typed here, the members this test uses.
interface Go {
  argv: string[];
  env: Record<string, string>;
  exit: (code: number) => void;
  importObject: object;
  run(instance: object): Promise<void>;
}
const host = globalThis as unknown as {
  Go: new () => Go;
  WebAssembly: {
    compile(bytes: Uint8Array): Promise<object>;
    instantiate(module: object, imports: object): Promise<object>;
  };
};

/** Every write to fds 1 and 2, decoded, per fd. */
function capture() {
  const decoder = new TextDecoder();
  const written = { 1: "", 2: "" };
  const sink: OutputSink = (fd, bytes) => {
    written[fd] += decoder.decode(bytes);
  };
  return { written, sink };
}

const hello: BuildFile = {
  name: "main.go",
  text: `package main

import "fmt"

func main() {
	fmt.Println("hello")
}
`,
};

describe("the build steps", () => {
  let out: string;
  let toolchain: Toolchain;
  const archives = (name: string) => new Uint8Array(readFileSync(join(out, name)));
  // install() replaces node's own; the test file's process gets them back.
  const scope = globalThis as unknown as Record<string, unknown>;
  const saved = {
    fs: scope.fs,
    path: scope.path,
    cwd: process.cwd.bind(process),
    chdir: process.chdir.bind(process),
  };

  before(async () => {
    out = mkdtempSync(join(tmpdir(), "build-toolchain-"));
    const manifest = await buildToolchain(out);
    // The fs first, so wasm_exec.js finds one and installs no stub.
    installProgramFs([]);
    await import(join(import.meta.dirname, "../../web/runtime/wasm_exec.js"));
    const [compile, link] = await Promise.all(
      [manifest.compile, manifest.link].map((name) => host.WebAssembly.compile(archives(name))),
    );
    toolchain = { manifest, compile, link };
  });

  after(() => {
    rmSync(out, { recursive: true, force: true });
    Object.assign(scope, { fs: saved.fs, path: saved.path });
    Object.assign(process, { cwd: saved.cwd, chdir: saved.chdir });
  });

  /** Builds files, timing each step, writing the tools' output to sink. */
  async function build(files: BuildFile[], sink?: OutputSink) {
    const steps = prepare(toolchain, files, archives, sink);
    let start = performance.now();
    await steps.compile();
    const compiled = performance.now() - start;
    start = performance.now();
    const wasm = await steps.link();
    return { wasm, ms: { compile: compiled, link: performance.now() - start } };
  }

  /** Runs a built program's main to its exit over a fresh program fs, answering its exit code
   * and output. */
  async function run(wasm: Uint8Array, files: BuildFile[]) {
    const { written, sink } = capture();
    installProgramFs(files, sink);
    const go = new host.Go();
    go.argv = ["main"];
    let code = 0;
    go.exit = (exited) => {
      code = exited;
    };
    const module = await host.WebAssembly.compile(wasm);
    await go.run(await host.WebAssembly.instantiate(module, go.importObject));
    return { code, stdout: written[1], stderr: written[2] };
  }

  test("hello builds, and runs printing hello with exit 0", async (t) => {
    const { written, sink } = capture();
    const { wasm, ms } = await build([hello], sink);
    assert.deepEqual(written, { 1: "", 2: "" }, "a clean build writes nothing");
    assert.deepEqual([...wasm.subarray(0, 4)], [0, 0x61, 0x73, 0x6d], "a WebAssembly module");
    // Run once more, warm, for the timings the diagnostic reports.
    const warm = await build([hello]);
    const kb = (wasm.length / 1024).toFixed(0);
    const ms0 = (n: number) => n.toFixed(0);
    t.diagnostic(
      `cold compile ${ms0(ms.compile)} ms, link ${ms0(ms.link)} ms; ` +
        `warm compile ${ms0(warm.ms.compile)} ms, link ${ms0(warm.ms.link)} ms; ${kb} KB`,
    );
    assert.deepEqual(await run(wasm, [hello]), { code: 0, stdout: "hello\n", stderr: "" });
  });

  test("a compile error reaches the output as written, relative to the file's name", async () => {
    const { written, sink } = capture();
    const broken: BuildFile = {
      name: "main.go",
      text: `package main

import "fmt"

func main() { fmt.Println(x) }
`,
    };
    const steps = prepare(toolchain, [broken], archives, sink);
    await assert.rejects(steps.compile(), (error: unknown) => {
      assert.ok(error instanceof BuildError);
      assert.equal(error.step, "compile");
      assert.equal(error.message, `compile exited with code ${error.code}`);
      assert.notEqual(error.code, 0);
      return true;
    });
    // The compiler writes its diagnostics to stdout, the go command merging them with stderr.
    assert.deepEqual(written, { 1: "main.go:5:27: undefined: x\n", 2: "" });
    await assert.rejects(steps.link(), { message: "link runs only after a successful compile" });
  });

  test("an import the manifest lacks fails before the compiler runs, naming it", () => {
    const { written, sink } = capture();
    const files: BuildFile[] = [
      { name: "main.go", text: 'package main\n\nimport (\n\t"fmt"\n\t"example.com/nope"\n)\n' },
    ];
    const message = "package example.com/nope is not in the manifest";
    assert.throws(() => programClosure(toolchain.manifest, files), { message });
    assert.throws(() => prepare(toolchain, files, archives, sink), { message });
    assert.deepEqual(written, { 1: "", 2: "" });
  });

  test("a package clause other than main fails in the compiler", async () => {
    const { written, sink } = capture();
    const steps = prepare(toolchain, [{ name: "lib.go", text: "package lib\n" }], archives, sink);
    await assert.rejects(steps.compile(), { name: "BuildError", step: "compile" });
    assert.deepEqual(written, { 1: "lib.go:1:1: package lib; expected package main\n", 2: "" });
  });

  test("a program reads a non-Go file from its working directory, and no write outlives a run", async () => {
    const files: BuildFile[] = [
      {
        name: "main.go",
        text: `package main

import (
	"fmt"
	"os"
)

func main() {
	text, err := os.ReadFile("input.txt")
	if err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
	fmt.Print(string(text))
	if _, err := os.Stat("written.txt"); err == nil {
		fmt.Println("written.txt outlived its run")
		os.Exit(1)
	}
	if err := os.WriteFile("written.txt", []byte("x"), 0o644); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
`,
      },
      { name: "input.txt", text: "from input.txt\n" },
    ];
    const { wasm } = await build(files);
    const expected = { code: 0, stdout: "from input.txt\n", stderr: "" };
    assert.deepEqual(await run(wasm, files), expected);
    assert.deepEqual(await run(wasm, files), expected, "the second run finds no written.txt");
  });

  test("the import declarations are read in every form, and nothing after them", () => {
    const source = `// A comment before the clause.
package main /* inline */

import "fmt"
import f "fmt"; import . \`strings\`
import (
	_ "embed" // trailing
	m "math"

	/* between */ "os"
)

var _ = "not/an/import"
`;
    assert.deepEqual(goImports(source), ["fmt", "fmt", "strings", "embed", "math", "os"]);
    assert.deepEqual(goImports('import "fmt"'), [], "no package clause, no imports");
  });
});
