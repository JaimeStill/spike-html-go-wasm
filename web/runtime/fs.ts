// The runtime's in-memory filesystem: the globalThis.fs, path, and process that Go's syscall
// package calls under GOOS=js (go1.27.4 src/syscall/fs_js.go), in place of wasm_exec.js's stub,
// which answers ENOSYS to every file call. install() puts it on globalThis before wasm_exec.js
// loads, so the shim finds an fs and never installs its own.
//
// Go calls each function in Node's callback form, fs.<name>(...args, callback), and reads only the
// error's code, which it maps to an Errno and panics on when it knows none; so every error here
// carries one of Node's codes (fsError). The callback runs before the call returns: Go's fsCall
// waits on a buffered channel the callback fills, and wasm_exec.js lets a callback re-enter Go
// from inside a call, as its own stub does.
//
// Writes to fds 1 and 2, through write (os.Stdout, os.Stderr) or writeSync (the runtime's prints
// and panics, wasm_exec.js's path), go to the output sink the fs is created with; the default
// prints whole lines to the console, as the stub does. fd 0 reads as empty.
//
// The tree is nodes behind two interfaces, FileNode and DirectoryNode: the fs resolves paths,
// keeps the open files, and checks what each call may do, and the nodes only store. A
// storage-backed directory would implement DirectoryNode, with its own device number, and mount
// in the tree; rename refuses to move a node between devices (EXDEV), so a node never leaves the
// storage that holds it. Paths resolve lexically against the fs's own cwd, as path.resolve does,
// and there are no links: link, symlink, readlink, and the chown calls answer ENOSYS, and lstat
// is stat. Permission bits are stored and reported, never enforced.

/** Where writes to fd 1 (stdout) and fd 2 (stderr) go: bytes, a copy the sink may keep. */
export type OutputSink = (fd: 1 | 2, bytes: Uint8Array) => void;

/** The fields every node carries, which stat reports. */
export interface Node {
  /** The device the node's storage is: rename moves a node only within one. */
  readonly dev: number;
  readonly ino: number;
  /** The permission bits, the file type excluded. */
  mode: number;
  atimeMs: number;
  mtimeMs: number;
  ctimeMs: number;
}

/** A regular file's storage. */
export interface FileNode extends Node {
  readonly kind: "file";
  readonly size: number;
  /** Copies bytes from position into dst, answering how many, 0 at or past the end. */
  read(dst: Uint8Array, position: number): number;
  /** Writes src at position, growing the file, a gap zero-filled; answers src's length. */
  write(src: Uint8Array, position: number): number;
  /** Cuts or zero-extends the file to length. */
  truncate(length: number): void;
}

/** A directory's storage: its entries by name, and the nodes it makes for new entries. */
export interface DirectoryNode extends Node {
  readonly kind: "directory";
  get(name: string): FileNode | DirectoryNode | undefined;
  /** Adds or replaces the entry name. */
  set(name: string, node: FileNode | DirectoryNode): void;
  delete(name: string): void;
  /** The entry names, sorted. */
  names(): string[];
  createFile(mode: number): FileNode;
  createDirectory(mode: number): DirectoryNode;
}

type Entry = FileNode | DirectoryNode;

/** The Node error codes the fs answers, each one Go's syscall maps to an Errno. */
type Code =
  | "EBADF"
  | "EEXIST"
  | "EINVAL"
  | "EISDIR"
  | "ENOENT"
  | "ENOSYS"
  | "ENOTDIR"
  | "ENOTEMPTY"
  | "EBUSY"
  | "EXDEV";

const messages: Record<Code, string> = {
  EBADF: "bad file descriptor",
  EBUSY: "resource busy or locked",
  EEXIST: "file already exists",
  EINVAL: "invalid argument",
  EISDIR: "illegal operation on a directory",
  ENOENT: "no such file or directory",
  ENOSYS: "function not implemented",
  ENOTDIR: "not a directory",
  ENOTEMPTY: "directory not empty",
  EXDEV: "cross-device link not permitted",
};

/** An Error shaped as Node's: code, syscall, and the path when there is one. */
export interface FsError extends Error {
  code: Code;
  syscall: string;
  path?: string;
}

function fsError(code: Code, syscall: string, path?: string): FsError {
  const where = path === undefined ? "" : ` '${path}'`;
  const err = new Error(`${code}: ${messages[code]}, ${syscall}${where}`) as FsError;
  err.code = code;
  err.syscall = syscall;
  if (path !== undefined) err.path = path;
  return err;
}

const isFsError = (err: unknown): err is FsError =>
  err instanceof Error && typeof (err as FsError).code === "string";

/** Node's open flags as Linux numbers them, which Go reads from fs.constants and passes back. */
export const constants = {
  O_RDONLY: 0,
  O_WRONLY: 1,
  O_RDWR: 2,
  O_CREAT: 0o100,
  O_EXCL: 0o200,
  O_TRUNC: 0o1000,
  O_APPEND: 0o2000,
  O_DIRECTORY: 0o200000,
} as const;

const S_IFCHR = 0o20000;
const S_IFDIR = 0o40000;
const S_IFREG = 0o100000;

/** A stat result in Node's shape: the fields Go's setStat reads, and isDirectory, which Open
 * calls. */
export class Stats {
  dev: number;
  ino: number;
  mode: number;
  nlink: number;
  uid = 0;
  gid = 0;
  rdev = 0;
  size: number;
  blksize = 4096;
  blocks: number;
  atimeMs: number;
  mtimeMs: number;
  ctimeMs: number;

  constructor(node: Node, type: number, size: number) {
    this.dev = node.dev;
    this.ino = node.ino;
    this.mode = type | node.mode;
    this.nlink = type === S_IFDIR ? 2 : 1;
    this.size = size;
    this.blocks = Math.ceil(size / 512);
    this.atimeMs = node.atimeMs;
    this.mtimeMs = node.mtimeMs;
    this.ctimeMs = node.ctimeMs;
  }

  isDirectory(): boolean {
    return (this.mode & 0o170000) === S_IFDIR;
  }
}

const statOf = (node: Entry) =>
  node.kind === "directory" ? new Stats(node, S_IFDIR, 4096) : new Stats(node, S_IFREG, node.size);

/** The memory backing's device number; a mounted storage would take another. */
const memoryDevice = 1;
let lastIno = 0;

/** A node's fields, stamped now. */
function fields(mode: number) {
  const now = Date.now();
  return { dev: memoryDevice, ino: ++lastIno, mode, atimeMs: now, mtimeMs: now, ctimeMs: now };
}

class MemoryFile implements FileNode {
  readonly kind = "file";
  readonly dev: number;
  readonly ino: number;
  mode: number;
  atimeMs: number;
  mtimeMs: number;
  ctimeMs: number;
  size = 0;
  /** The bytes, data[size:] always zero, so growing never shows old bytes. */
  private data = new Uint8Array(0);

  constructor(mode: number) {
    ({
      dev: this.dev,
      ino: this.ino,
      mode: this.mode,
      atimeMs: this.atimeMs,
      mtimeMs: this.mtimeMs,
      ctimeMs: this.ctimeMs,
    } = fields(mode));
  }

  read(dst: Uint8Array, position: number): number {
    if (position >= this.size) return 0;
    const n = Math.min(dst.length, this.size - position);
    dst.set(this.data.subarray(position, position + n));
    return n;
  }

  write(src: Uint8Array, position: number): number {
    const end = position + src.length;
    this.reserve(end);
    this.data.set(src, position);
    this.size = Math.max(this.size, end);
    this.touch();
    return src.length;
  }

  truncate(length: number): void {
    if (length < this.size) this.data.fill(0, length, this.size);
    else this.reserve(length);
    this.size = length;
    this.touch();
  }

  /** Grows the buffer to hold length bytes, at least doubling. */
  private reserve(length: number) {
    if (length <= this.data.length) return;
    const grown = new Uint8Array(Math.max(length, this.data.length * 2, 64));
    grown.set(this.data.subarray(0, this.size));
    this.data = grown;
  }

  private touch() {
    this.mtimeMs = this.ctimeMs = Date.now();
  }
}

class MemoryDirectory implements DirectoryNode {
  readonly kind = "directory";
  readonly dev: number;
  readonly ino: number;
  mode: number;
  atimeMs: number;
  mtimeMs: number;
  ctimeMs: number;
  private entries = new Map<string, Entry>();

  constructor(mode: number) {
    ({
      dev: this.dev,
      ino: this.ino,
      mode: this.mode,
      atimeMs: this.atimeMs,
      mtimeMs: this.mtimeMs,
      ctimeMs: this.ctimeMs,
    } = fields(mode));
  }

  get(name: string) {
    return this.entries.get(name);
  }

  set(name: string, node: Entry) {
    this.entries.set(name, node);
    this.mtimeMs = this.ctimeMs = Date.now();
  }

  delete(name: string) {
    this.entries.delete(name);
    this.mtimeMs = this.ctimeMs = Date.now();
  }

  names() {
    return [...this.entries.keys()].sort();
  }

  createFile(mode: number): FileNode {
    return new MemoryFile(mode);
  }

  createDirectory(mode: number): DirectoryNode {
    return new MemoryDirectory(mode);
  }
}

/** An open file: its node, which outlives an unlink while open, its access, and the position a
 * read or write with a null position uses and advances. */
interface Open {
  node: Entry;
  readable: boolean;
  writable: boolean;
  append: boolean;
  position: number;
}

/** A Node-style callback: an error, or null and the result. */
type Callback<T = unknown> = (err: FsError | null, result?: T) => void;

/** The lexical absolute path of path against cwd: "." and empty segments dropped, ".." popping
 * one, never above the root. */
function resolvePath(cwd: string, path: string): string {
  const segments: string[] = [];
  for (const segment of (path.startsWith("/") ? path : `${cwd}/${path}`).split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return `/${segments.join("/")}`;
}

/** The fs, path, and process objects Go reads from globalThis. */
export type GoFs = ReturnType<typeof createFs>;

/** The default sink: whole lines to console.log (stdout) or console.error (stderr), each fd's
 * partial line held until its newline, as wasm_exec.js's stub fs prints. */
export function consoleOutput(): OutputSink {
  // A decoder per fd, streaming, so a character split between writes decodes whole.
  const decoders = { 1: new TextDecoder("utf-8"), 2: new TextDecoder("utf-8") };
  const pending = { 1: "", 2: "" };
  return (fd, bytes) => {
    const text = pending[fd] + decoders[fd].decode(bytes, { stream: true });
    const nl = text.lastIndexOf("\n");
    pending[fd] = text.slice(nl + 1);
    if (nl !== -1) (fd === 1 ? console.log : console.error)(text.slice(0, nl));
  };
}

/** A fresh in-memory fs: a root directory holding /tmp, the cwd /, and output to sink. */
export function createFs(sink: OutputSink = consoleOutput()) {
  const root: DirectoryNode = new MemoryDirectory(0o755);
  root.set("tmp", root.createDirectory(0o1777));
  let cwd = "/";
  const opens = new Map<number, Open>();
  let lastFd = 2;

  /** The node at path, or the error a walk to it meets: ENOENT for a missing entry, ENOTDIR for
   * a file on the way, or for a file named with a trailing slash. */
  function lookup(syscall: string, path: string): Entry {
    let node: Entry = root;
    for (const name of resolvePath(cwd, path).split("/").filter(Boolean)) {
      if (node.kind !== "directory") throw fsError("ENOTDIR", syscall, path);
      const next = node.get(name);
      if (!next) throw fsError("ENOENT", syscall, path);
      node = next;
    }
    if (node.kind !== "directory" && path.endsWith("/")) throw fsError("ENOTDIR", syscall, path);
    return node;
  }

  /** The directory holding path's last entry, and that entry's name; the root has none, so it
   * answers EBUSY for a call that would change its parent. */
  function parentOf(syscall: string, path: string): [DirectoryNode, string] {
    const absolute = resolvePath(cwd, path);
    if (absolute === "/") throw fsError("EBUSY", syscall, path);
    const slash = absolute.lastIndexOf("/");
    const parent = lookup(syscall, absolute.slice(0, slash) || "/");
    if (parent.kind !== "directory") throw fsError("ENOTDIR", syscall, path);
    return [parent, absolute.slice(slash + 1)];
  }

  function directory(syscall: string, path: string): DirectoryNode {
    const node = lookup(syscall, path);
    if (node.kind !== "directory") throw fsError("ENOTDIR", syscall, path);
    return node;
  }

  function opened(syscall: string, fd: number): Open {
    const open = opens.get(fd);
    if (!open) throw fsError("EBADF", syscall);
    return open;
  }

  const isStd = (fd: number) => (fd === 0 || fd === 1 || fd === 2) && !opens.has(fd);

  /** Sends bytes to the sink, a copy: writeSync's are a view into the instance's memory. */
  function emit(fd: 1 | 2, bytes: Uint8Array): number {
    sink(fd, bytes.slice());
    return bytes.length;
  }

  function open(path: string, flags: number, mode: number): number {
    const access = flags & 3;
    const readable = access !== constants.O_WRONLY;
    const writable = access !== constants.O_RDONLY;
    let node: Entry;
    if (flags & constants.O_CREAT) {
      const [parent, name] = parentOf("open", path);
      const found = parent.get(name);
      if (found && flags & constants.O_EXCL) throw fsError("EEXIST", "open", path);
      if (found?.kind === "directory") throw fsError("EISDIR", "open", path);
      if (found) {
        node = found;
      } else {
        node = parent.createFile(mode & 0o7777);
        parent.set(name, node);
      }
    } else {
      node = lookup("open", path);
    }
    if (node.kind === "directory" && writable) throw fsError("EISDIR", "open", path);
    if (node.kind === "file" && flags & constants.O_DIRECTORY) {
      throw fsError("ENOTDIR", "open", path);
    }
    if (node.kind === "file" && writable && flags & constants.O_TRUNC) node.truncate(0);
    const fd = ++lastFd;
    opens.set(fd, {
      node,
      readable,
      writable,
      append: !!(flags & constants.O_APPEND),
      position: 0,
    });
    return fd;
  }

  /** The file an fd may read or write, by access: EBADF when the fd's access excludes it, and
   * EISDIR for a directory. */
  function file(syscall: string, fd: number, access: "readable" | "writable") {
    const open = opened(syscall, fd);
    if (open.node.kind === "directory") throw fsError("EISDIR", syscall);
    if (!open[access]) throw fsError("EBADF", syscall);
    return { open, node: open.node };
  }

  function read(
    fd: number,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number | null,
  ): number {
    if (isStd(fd)) {
      if (fd === 0) return 0;
      throw fsError("EBADF", "read");
    }
    const { open, node } = file("read", fd, "readable");
    const at = position ?? open.position;
    const n = node.read(buffer.subarray(offset, offset + length), at);
    if (position === null || position === undefined) open.position += n;
    return n;
  }

  function write(
    fd: number,
    buffer: Uint8Array,
    offset: number,
    length: number,
    position: number | null,
  ): number {
    const bytes = buffer.subarray(offset, offset + length);
    if (isStd(fd)) {
      if (fd === 0) throw fsError("EBADF", "write");
      return emit(fd as 1 | 2, bytes);
    }
    const { open, node } = file("write", fd, "writable");
    // O_APPEND writes at the end whatever the position, as Linux does.
    const at = open.append ? node.size : (position ?? open.position);
    const n = node.write(bytes, at);
    if (open.append || position === null || position === undefined) open.position = at + n;
    return n;
  }

  function fstat(fd: number): Stats {
    if (isStd(fd)) {
      const now = Date.now();
      const device = { dev: 0, ino: fd, mode: 0o620, atimeMs: now, mtimeMs: now, ctimeMs: now };
      return new Stats(device, S_IFCHR, 0);
    }
    return statOf(opened("fstat", fd).node);
  }

  function mkdir(path: string, mode: number): void {
    const [parent, name] = safeParent("mkdir", path);
    if (parent.get(name)) throw fsError("EEXIST", "mkdir", path);
    parent.set(name, parent.createDirectory(mode & 0o7777));
  }

  /** parentOf, with the root answering EEXIST, as mkdir("/") does. */
  function safeParent(syscall: string, path: string): [DirectoryNode, string] {
    if (resolvePath(cwd, path) === "/") throw fsError("EEXIST", syscall, path);
    return parentOf(syscall, path);
  }

  function rmdir(path: string): void {
    const [parent, name] = parentOf("rmdir", path);
    const node = parent.get(name);
    if (!node) throw fsError("ENOENT", "rmdir", path);
    if (node.kind !== "directory") throw fsError("ENOTDIR", "rmdir", path);
    if (node.names().length > 0) throw fsError("ENOTEMPTY", "rmdir", path);
    parent.delete(name);
  }

  function unlink(path: string): void {
    const [parent, name] = parentOf("unlink", path);
    const node = parent.get(name);
    if (!node) throw fsError("ENOENT", "unlink", path);
    if (node.kind === "directory") throw fsError("EISDIR", "unlink", path);
    parent.delete(name);
  }

  /** POSIX rename: a file replaces a file, a directory an empty directory; a directory never
   * moves into itself (EINVAL), and a node never between devices (EXDEV). */
  function rename(from: string, to: string): void {
    const [source, name] = parentOf("rename", from);
    const node = source.get(name);
    if (!node) throw fsError("ENOENT", "rename", from);
    const [target, targetName] = parentOf("rename", to);
    const fromPath = resolvePath(cwd, from);
    const toPath = resolvePath(cwd, to);
    if (fromPath === toPath) return;
    if (node.kind === "directory" && toPath.startsWith(`${fromPath}/`)) {
      throw fsError("EINVAL", "rename", from);
    }
    if (target.dev !== node.dev) throw fsError("EXDEV", "rename", from);
    const existing = target.get(targetName);
    if (existing?.kind === "directory") {
      if (node.kind !== "directory") throw fsError("EISDIR", "rename", to);
      if (existing.names().length > 0) throw fsError("ENOTEMPTY", "rename", to);
    } else if (existing && node.kind === "directory") {
      throw fsError("ENOTDIR", "rename", to);
    }
    source.delete(name);
    target.set(targetName, node);
  }

  function truncateNode(syscall: string, node: Entry, length: number, path?: string): void {
    if (node.kind === "directory") throw fsError("EISDIR", syscall, path);
    if (length < 0) throw fsError("EINVAL", syscall, path);
    node.truncate(length);
  }

  function ftruncate(fd: number, length: number): void {
    const open = opened("ftruncate", fd);
    // Linux answers EINVAL for an fd not open for writing.
    if (!open.writable) throw fsError("EINVAL", "ftruncate");
    truncateNode("ftruncate", open.node, length);
  }

  function chdir(path: string): void {
    directory("chdir", path);
    cwd = resolvePath(cwd, path);
  }

  /** Runs body and answers callback with its result, or with its fs error; any other throw is a
   * bug, and propagates. The callback runs outside the try, so a throw from Go's side is never
   * answered as a second callback. */
  function settle<T>(callback: Callback<T>, body: () => T): void {
    let result: T;
    try {
      result = body();
    } catch (err) {
      if (!isFsError(err)) throw err;
      callback(err);
      return;
    }
    callback(null, result);
  }

  const enosys =
    (syscall: string) =>
    (...args: unknown[]) =>
      (args.at(-1) as Callback)(fsError("ENOSYS", syscall));

  const fs = {
    constants,
    open(path: string, flags: number, mode: number, callback: Callback<number>) {
      settle(callback, () => open(path, flags, mode));
    },
    close(fd: number, callback: Callback<void>) {
      settle(callback, () => {
        if (!isStd(fd)) opened("close", fd);
        opens.delete(fd);
      });
    },
    read(
      fd: number,
      buffer: Uint8Array,
      offset: number,
      length: number,
      position: number | null,
      callback: Callback<number>,
    ) {
      settle(callback, () => read(fd, buffer, offset, length, position));
    },
    write(
      fd: number,
      buffer: Uint8Array,
      offset: number,
      length: number,
      position: number | null,
      callback: Callback<number>,
    ) {
      settle(callback, () => write(fd, buffer, offset, length, position));
    },
    /** The runtime's own output path, wasm_exec.js's: synchronous, throwing its error. */
    writeSync(fd: number, buffer: Uint8Array): number {
      return write(fd, buffer, 0, buffer.length, null);
    },
    fstat(fd: number, callback: Callback<Stats>) {
      settle(callback, () => fstat(fd));
    },
    stat(path: string, callback: Callback<Stats>) {
      settle(callback, () => statOf(lookup("stat", path)));
    },
    lstat(path: string, callback: Callback<Stats>) {
      settle(callback, () => statOf(lookup("lstat", path)));
    },
    mkdir(path: string, mode: number, callback: Callback<void>) {
      settle(callback, () => mkdir(path, mode));
    },
    readdir(path: string, callback: Callback<string[]>) {
      settle(callback, () => directory("readdir", path).names());
    },
    rmdir(path: string, callback: Callback<void>) {
      settle(callback, () => rmdir(path));
    },
    unlink(path: string, callback: Callback<void>) {
      settle(callback, () => unlink(path));
    },
    rename(from: string, to: string, callback: Callback<void>) {
      settle(callback, () => rename(from, to));
    },
    truncate(path: string, length: number, callback: Callback<void>) {
      settle(callback, () => truncateNode("truncate", lookup("truncate", path), length, path));
    },
    ftruncate(fd: number, length: number, callback: Callback<void>) {
      settle(callback, () => ftruncate(fd, length));
    },
    fsync(fd: number, callback: Callback<void>) {
      settle(callback, () => {
        if (!isStd(fd)) opened("fsync", fd);
      });
    },
    chmod(path: string, mode: number, callback: Callback<void>) {
      settle(callback, () => {
        lookup("chmod", path).mode = mode & 0o7777;
      });
    },
    fchmod(fd: number, mode: number, callback: Callback<void>) {
      settle(callback, () => {
        opened("fchmod", fd).node.mode = mode & 0o7777;
      });
    },
    /** atime and mtime in seconds, as Go passes them. */
    utimes(path: string, atime: number, mtime: number, callback: Callback<void>) {
      settle(callback, () => {
        const node = lookup("utimes", path);
        node.atimeMs = atime * 1000;
        node.mtimeMs = mtime * 1000;
        node.ctimeMs = Date.now();
      });
    },
    link: enosys("link"),
    symlink: enosys("symlink"),
    readlink: enosys("readlink"),
    chown: enosys("chown"),
    fchown: enosys("fchown"),
    lchown: enosys("lchown"),
  };

  return {
    fs,
    /** Go calls resolve with one path, for the open file's name Fchdir returns to. */
    path: { resolve: (...paths: string[]) => paths.reduce(resolvePath, cwd) },
    process: {
      cwd: () => cwd,
      /** Throws its fs error, which Go's Chdir recovers and maps. */
      chdir,
    },
  };
}

/** wasm_exec.js's process stub's other members, for a scope with no process: the ids it
 * answers, -1, and the calls it refuses. */
function processStub(cwd: () => string, chdir: (path: string) => void) {
  const enosys = () => {
    throw fsError("ENOSYS", "process");
  };
  return {
    getuid: () => -1,
    getgid: () => -1,
    geteuid: () => -1,
    getegid: () => -1,
    getgroups: enosys,
    pid: -1,
    ppid: -1,
    umask: enosys,
    cwd,
    chdir,
  };
}

/** Installs a fresh in-memory fs on scope, globalThis by default, before wasm_exec.js loads:
 * scope.fs and scope.path, and the cwd and chdir of scope.process, or a process in the stub's
 * shape when scope has none, as in a worker, its fds 1 and 2 written to output. Answers the fs. */
export function install(
  scope: Record<string, unknown> = globalThis as unknown as Record<string, unknown>,
  output?: OutputSink,
): GoFs {
  const goFs = createFs(output);
  scope.fs = goFs.fs;
  scope.path = goFs.path;
  const process = scope.process as Record<string, unknown> | undefined;
  if (process) {
    process.cwd = goFs.process.cwd;
    process.chdir = goFs.process.chdir;
  } else {
    scope.process = processStub(goFs.process.cwd, goFs.process.chdir);
  }
  return goFs;
}
