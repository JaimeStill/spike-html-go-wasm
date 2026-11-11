// go test's -exec for the Go tests on the runtime's in-memory fs (scripts/go-memfs-exec.sh runs
// it): the pinned Go's lib/wasm/wasm_exec_node.js, with web/runtime/fs.ts installed as
// globalThis.fs, path, and process.cwd and chdir in place of node's, and web/runtime/wasm_exec.js,
// the runtime's copy, loaded after it, as the worker loads them. The test binary's stdout and
// stderr reach the process's own, unbuffered, for go test to read.
//
// The fs starts empty but for /tmp, which TMPDIR names, and the directory of any
// -test.testlogfile the go command passes, so the testing package can create it; the log stays in
// memory, so the go command caches no result of a run here. GOWASM_FS=memory tells a test which
// fs it runs on.

import { readFileSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";

import { install } from "../web/runtime/fs.ts";

const [binary, ...args] = process.argv.slice(2);
if (!binary) {
  console.error("usage: go-memfs-exec.sh <wasm binary> [arguments]");
  process.exit(2);
}
const wasm = readFileSync(binary);

const goFs = install(globalThis as unknown as Record<string, unknown>, (fd, bytes) => {
  writeSync(fd, bytes);
});

// The in-memory fs's mkdir -p, through its own calls, for the testlog's directory.
function mkdirAll(path: string) {
  let at = "";
  for (const name of path.split("/").filter(Boolean)) {
    at += `/${name}`;
    goFs.fs.mkdir(at, 0o755, () => {});
  }
}
const testlog = args.find((arg) => arg.startsWith("-test.testlogfile="));
if (testlog) mkdirAll(dirname(testlog.slice("-test.testlogfile=".length)));

await import(join(import.meta.dirname, "../web/runtime/wasm_exec.js"));

// The suite's types carry no WebAssembly declarations (lib es2024, node's types), so the shim's Go
// and WebAssembly are typed here, the members this host uses.
interface GoInstance {
  argv: string[];
  env: Record<string, string | undefined>;
  exit: (code: number) => void;
  exited: boolean;
  importObject: object;
  run(instance: object): Promise<void>;
}
const { Go, WebAssembly } = globalThis as unknown as {
  Go: new () => GoInstance;
  WebAssembly: {
    instantiate(bytes: Uint8Array, imports: object): Promise<{ instance: object }>;
  };
};
const go = new Go();
go.argv = [binary, ...args];
go.env = { ...process.env, TMPDIR: "/tmp", GOWASM_FS: "memory" };
go.exit = (code) => process.exit(code);
const { instance } = await WebAssembly.instantiate(wasm, go.importObject);
// As wasm_exec_node.js: node exits when no event is pending, so a run that ends with Go still
// running is a deadlock, which Go reports with its goroutines' stacks.
process.on("exit", (code) => {
  if (code === 0 && !go.exited) {
    const internals = go as unknown as { _pendingEvent: unknown; _resume(): void };
    internals._pendingEvent = { id: 0 };
    internals._resume();
  }
});
await go.run(instance);
