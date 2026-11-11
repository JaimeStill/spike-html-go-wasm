// The runtime's in-memory fs, web/runtime/fs.ts, called as Go's syscall package calls it: each
// call in Node's callback form, its error's code the one Go maps. The Go test program under node
// (test/memfs, scripts/check-go.sh) drives it through package os; these hold the codes and edges
// that program reaches only indirectly, and the output routing and install.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { constants, createFs, install, type GoFs, type OutputSink } from "../../web/runtime/fs.ts";

/** Calls fs[name](...args, callback), answering the callback's result, or throwing its error.
 * The fs answers before the call returns, so a call that never answers fails here. */
function call(goFs: GoFs, name: string, ...args: unknown[]): unknown {
  let answered: { err: unknown; result: unknown } | undefined;
  const fn = (goFs.fs as unknown as Record<string, (...a: unknown[]) => void>)[name];
  fn.call(goFs.fs, ...args, (err: unknown, result: unknown) => {
    answered = { err, result };
  });
  assert.ok(answered, `${name} didn't answer before returning`);
  if (answered.err) throw answered.err;
  return answered.result;
}

/** The code call's error carries; fails when the call succeeds. */
function code(goFs: GoFs, name: string, ...args: unknown[]): string {
  try {
    call(goFs, name, ...args);
  } catch (err) {
    return (err as { code: string }).code;
  }
  assert.fail(`${name}(${args.join(", ")}) succeeded`);
}

const { O_RDONLY, O_WRONLY, O_RDWR, O_CREAT, O_EXCL, O_TRUNC, O_APPEND, O_DIRECTORY } = constants;
const bytes = (text: string) => new TextEncoder().encode(text);
const text = (data: Uint8Array) => new TextDecoder().decode(data);

/** A file at path holding content, through open, write, and close. */
function writeFile(goFs: GoFs, path: string, content: string) {
  const fd = call(goFs, "open", path, O_WRONLY | O_CREAT | O_TRUNC, 0o644) as number;
  const data = bytes(content);
  call(goFs, "write", fd, data, 0, data.length, null);
  call(goFs, "close", fd);
}

function readFile(goFs: GoFs, path: string): string {
  const fd = call(goFs, "open", path, O_RDONLY, 0) as number;
  const buf = new Uint8Array(256);
  const n = call(goFs, "read", fd, buf, 0, buf.length, null) as number;
  call(goFs, "close", fd);
  return text(buf.subarray(0, n));
}

describe("the in-memory fs", () => {
  test("starts with /tmp and the cwd at /", () => {
    const goFs = createFs();
    assert.deepEqual(call(goFs, "readdir", "/"), ["tmp"]);
    assert.equal(goFs.process.cwd(), "/");
  });

  test("open answers ENOENT, EEXIST, EISDIR, and ENOTDIR as Linux does", () => {
    const goFs = createFs();
    writeFile(goFs, "/tmp/f", "x");
    assert.equal(code(goFs, "open", "/tmp/missing", O_RDONLY, 0), "ENOENT");
    assert.equal(code(goFs, "open", "/nope/f", O_WRONLY | O_CREAT, 0o644), "ENOENT");
    assert.equal(code(goFs, "open", "/tmp/f", O_WRONLY | O_CREAT | O_EXCL, 0o644), "EEXIST");
    assert.equal(code(goFs, "open", "/tmp", O_WRONLY, 0), "EISDIR");
    assert.equal(code(goFs, "open", "/tmp", O_RDONLY | O_CREAT, 0o644), "EISDIR");
    assert.equal(code(goFs, "open", "/tmp/f", O_RDONLY | O_DIRECTORY, 0), "ENOTDIR");
    assert.equal(code(goFs, "open", "/tmp/f/under", O_RDONLY, 0), "ENOTDIR");
    assert.equal(code(goFs, "open", "/tmp/f/", O_RDONLY, 0), "ENOTDIR");
  });

  test("read and write honour the fd's access, a directory's EISDIR, and EBADF", () => {
    const goFs = createFs();
    writeFile(goFs, "/tmp/f", "abc");
    const buf = new Uint8Array(4);
    const reader = call(goFs, "open", "/tmp/f", O_RDONLY, 0) as number;
    assert.equal(code(goFs, "write", reader, buf, 0, 1, null), "EBADF");
    assert.equal(code(goFs, "ftruncate", reader, 0), "EINVAL");
    const writer = call(goFs, "open", "/tmp/f", O_WRONLY, 0) as number;
    assert.equal(code(goFs, "read", writer, buf, 0, 1, null), "EBADF");
    const dir = call(goFs, "open", "/tmp", O_RDONLY, 0) as number;
    assert.equal(code(goFs, "read", dir, buf, 0, 1, null), "EISDIR");
    assert.equal((call(goFs, "fstat", dir) as { isDirectory(): boolean }).isDirectory(), true);
    call(goFs, "close", dir);
    for (const name of ["close", "fstat", "fsync"]) assert.equal(code(goFs, name, dir), "EBADF");
    assert.equal(code(goFs, "read", 99, buf, 0, 1, null), "EBADF");
  });

  test("a null position reads and writes at the fd's own, a number at that offset only", () => {
    const goFs = createFs();
    const fd = call(goFs, "open", "/tmp/f", O_RDWR | O_CREAT, 0o644) as number;
    call(goFs, "write", fd, bytes("hello"), 0, 5, null);
    call(goFs, "write", fd, bytes("XY"), 0, 2, 1);
    call(goFs, "write", fd, bytes("!"), 0, 1, null);
    assert.equal(readFile(goFs, "/tmp/f"), "hXYlo!");
    const buf = new Uint8Array(3);
    assert.equal(call(goFs, "read", fd, buf, 1, 2, 4), 2);
    assert.deepEqual([...buf], [0, ...bytes("o!")]);
    assert.equal(call(goFs, "read", fd, buf, 0, 3, null), 0, "the fd's position is at the end");
    call(goFs, "write", fd, bytes("Z"), 0, 1, 9);
    assert.equal(readFile(goFs, "/tmp/f"), "hXYlo!\0\0\0Z");
  });

  test("O_APPEND writes at the end whatever the position", () => {
    const goFs = createFs();
    writeFile(goFs, "/tmp/f", "ab");
    const fd = call(goFs, "open", "/tmp/f", O_WRONLY | O_APPEND, 0) as number;
    call(goFs, "write", fd, bytes("c"), 0, 1, 0);
    assert.equal(readFile(goFs, "/tmp/f"), "abc");
  });

  test("truncate cuts and zero-extends, never showing cut bytes again", () => {
    const goFs = createFs();
    writeFile(goFs, "/tmp/f", "abcdef");
    call(goFs, "truncate", "/tmp/f", 2);
    call(goFs, "truncate", "/tmp/f", 4);
    assert.equal(readFile(goFs, "/tmp/f"), "ab\0\0");
    assert.equal(code(goFs, "truncate", "/tmp", 0), "EISDIR");
    assert.equal(code(goFs, "truncate", "/tmp/f", -1), "EINVAL");
  });

  test("stat reports Node's fields, the type in mode", () => {
    const goFs = createFs();
    writeFile(goFs, "/tmp/f", "12345");
    call(goFs, "chmod", "/tmp/f", 0o600);
    call(goFs, "utimes", "/tmp/f", 10, 20);
    const st = call(goFs, "stat", "/tmp/f") as Record<string, number> & {
      isDirectory(): boolean;
    };
    assert.equal(st.mode, 0o100600);
    assert.equal(st.size, 5);
    assert.equal(st.atimeMs, 10_000);
    assert.equal(st.mtimeMs, 20_000);
    assert.equal(st.isDirectory(), false);
    for (const field of ["dev", "ino", "nlink", "uid", "gid", "rdev", "blksize", "blocks"]) {
      assert.equal(typeof st[field], "number", field);
    }
    assert.equal((call(goFs, "lstat", "/tmp") as Record<string, number>).mode, 0o41777);
  });

  test("mkdir, rmdir, and unlink answer EEXIST, ENOENT, ENOTDIR, EISDIR, and ENOTEMPTY", () => {
    const goFs = createFs();
    call(goFs, "mkdir", "/tmp/d", 0o755);
    writeFile(goFs, "/tmp/d/f", "");
    assert.equal(code(goFs, "mkdir", "/tmp/d", 0o755), "EEXIST");
    assert.equal(code(goFs, "mkdir", "/", 0o755), "EEXIST");
    assert.equal(code(goFs, "mkdir", "/no/d", 0o755), "ENOENT");
    assert.equal(code(goFs, "rmdir", "/tmp/d"), "ENOTEMPTY");
    assert.equal(code(goFs, "rmdir", "/tmp/d/f"), "ENOTDIR");
    assert.equal(code(goFs, "rmdir", "/tmp/none"), "ENOENT");
    assert.equal(code(goFs, "rmdir", "/"), "EBUSY");
    assert.equal(code(goFs, "unlink", "/tmp/d"), "EISDIR");
    assert.equal(code(goFs, "readdir", "/tmp/d/f"), "ENOTDIR");
    call(goFs, "unlink", "/tmp/d/f");
    assert.equal(code(goFs, "unlink", "/tmp/d/f"), "ENOENT");
    call(goFs, "rmdir", "/tmp/d");
    assert.deepEqual(call(goFs, "readdir", "/tmp"), []);
  });

  test("rename replaces as POSIX does and refuses the rest", () => {
    const goFs = createFs();
    call(goFs, "mkdir", "/tmp/a", 0o755);
    call(goFs, "mkdir", "/tmp/a/inner", 0o755);
    call(goFs, "mkdir", "/tmp/empty", 0o755);
    call(goFs, "mkdir", "/tmp/full", 0o755);
    writeFile(goFs, "/tmp/full/f", "");
    writeFile(goFs, "/tmp/f", "one");
    writeFile(goFs, "/tmp/g", "two");
    assert.equal(code(goFs, "rename", "/tmp/none", "/tmp/x"), "ENOENT");
    assert.equal(code(goFs, "rename", "/tmp/a", "/tmp/a/inner/a"), "EINVAL");
    assert.equal(code(goFs, "rename", "/tmp/f", "/tmp/empty"), "EISDIR");
    assert.equal(code(goFs, "rename", "/tmp/a", "/tmp/f"), "ENOTDIR");
    assert.equal(code(goFs, "rename", "/tmp/a", "/tmp/full"), "ENOTEMPTY");
    call(goFs, "rename", "/tmp/f", "/tmp/f");
    assert.equal(readFile(goFs, "/tmp/f"), "one", "a rename onto itself changes nothing");
    call(goFs, "rename", "/tmp/f", "/tmp/g");
    assert.equal(readFile(goFs, "/tmp/g"), "one");
    call(goFs, "rename", "/tmp/a", "/tmp/empty");
    assert.deepEqual(call(goFs, "readdir", "/tmp"), ["empty", "full", "g"]);
    assert.deepEqual(call(goFs, "readdir", "/tmp/empty"), ["inner"]);
  });

  test("an unlinked file stays readable through an open fd", () => {
    const goFs = createFs();
    writeFile(goFs, "/tmp/f", "kept");
    const fd = call(goFs, "open", "/tmp/f", O_RDONLY, 0) as number;
    call(goFs, "unlink", "/tmp/f");
    const buf = new Uint8Array(8);
    assert.equal(text(buf.subarray(0, call(goFs, "read", fd, buf, 0, 8, null) as number)), "kept");
  });

  test("paths resolve against the cwd, which chdir moves and refuses with the walk's code", () => {
    const goFs = createFs();
    call(goFs, "mkdir", "/tmp/d", 0o755);
    writeFile(goFs, "/tmp/f", "");
    goFs.process.chdir("/tmp/d");
    writeFile(goFs, "rel", "relative");
    assert.equal(readFile(goFs, "/tmp/d/rel"), "relative");
    goFs.process.chdir("../..");
    assert.equal(goFs.process.cwd(), "/");
    assert.equal(goFs.path.resolve("tmp/./d/../f"), "/tmp/f");
    assert.throws(() => goFs.process.chdir("/tmp/none"), { code: "ENOENT" });
    assert.throws(() => goFs.process.chdir("/tmp/f"), { code: "ENOTDIR" });
  });

  test("links and ownership answer ENOSYS", () => {
    const goFs = createFs();
    assert.equal(code(goFs, "link", "/tmp", "/l"), "ENOSYS");
    assert.equal(code(goFs, "symlink", "/tmp", "/l"), "ENOSYS");
    assert.equal(code(goFs, "readlink", "/tmp"), "ENOSYS");
    assert.equal(code(goFs, "chown", "/tmp", 0, 0), "ENOSYS");
    assert.equal(code(goFs, "fchown", 3, 0, 0), "ENOSYS");
    assert.equal(code(goFs, "lchown", "/tmp", 0, 0), "ENOSYS");
  });

  test("the console sink prints whole lines per fd, a split character decoded whole", (t) => {
    const log = t.mock.method(console, "log", () => {});
    const error = t.mock.method(console, "error", () => {});
    const goFs = createFs();
    const euro = bytes("€");
    goFs.fs.writeSync(1, bytes("a"));
    goFs.fs.writeSync(2, bytes("err\n"));
    goFs.fs.writeSync(1, euro.subarray(0, 1));
    goFs.fs.writeSync(1, euro.subarray(1));
    assert.equal(log.mock.callCount(), 0, "no line until its newline");
    goFs.fs.writeSync(1, bytes("\nrest"));
    assert.deepEqual(
      log.mock.calls.map((c) => c.arguments),
      [["a€"]],
    );
    assert.deepEqual(
      error.mock.calls.map((c) => c.arguments),
      [["err"]],
    );
  });

  test("writes to fds 1 and 2, by write or writeSync, reach the sink in order, as copies", () => {
    const seen: [number, string][] = [];
    const goFs = createFs((fd, data) => seen.push([fd, text(data)]));
    const view = bytes("sync");
    assert.equal(goFs.fs.writeSync(2, view), 4);
    view.fill(0);
    call(goFs, "write", 1, bytes("out"), 0, 3, null);
    call(goFs, "write", 2, bytes("xerrx"), 1, 3, null);
    assert.deepEqual(seen, [
      [2, "sync"],
      [1, "out"],
      [2, "err"],
    ]);
    assert.equal(call(goFs, "read", 0, new Uint8Array(4), 0, 4, null), 0, "stdin reads empty");
    assert.equal(code(goFs, "write", 0, bytes("x"), 0, 1, null), "EBADF");
  });

  test("install sets fs and path, and a process in the stub's shape on a scope with none", () => {
    const scope: Record<string, unknown> = {};
    const sink: OutputSink = () => {};
    const goFs = install(scope, sink);
    assert.equal(scope.fs, goFs.fs);
    assert.equal(scope.path, goFs.path);
    const process = scope.process as Record<string, () => unknown>;
    assert.equal(process.cwd(), "/");
    assert.equal(process.getuid(), -1);
    assert.throws(() => process.umask(), { code: "ENOSYS" });

    const host = { process: { cwd: () => "/host", pid: 7 } } as Record<string, unknown>;
    install(host, sink);
    const patched = host.process as { cwd(): string; pid: number };
    assert.equal(patched.cwd(), "/", "an existing process keeps its members, its cwd replaced");
    assert.equal(patched.pid, 7);
  });
});
