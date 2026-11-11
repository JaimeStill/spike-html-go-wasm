// A set of source files, a model with no document and no element: each file's name, its text, the
// text as given, and whether it is read-only, the files' order, and which one is active. Its owner,
// the page or the element composing the file tabs and the editor, is its only writer; the tabs and
// the editor read it, render from it, and re-render on its change event, sending requests their
// owner applies. It validates its own operations, refusing one it can't apply with the reason, so
// an owner validating a form can show that reason as it is.
//
// The set always holds at least one file, and always has one active. Names are the files' keys,
// kept in the order the files were given or added; a rename keeps a file's place. A name names a
// file in one flat directory, so it holds no path separator.

/** A file as the set holds it, a frozen snapshot: replaced, never changed, when the file changes.
 * `original` is the text as given, at construction or by add; `modified` is whether `text` differs
 * from it. A read-only file's text never changes, so it is never modified. */
export interface SourceFile {
  readonly name: string;
  readonly text: string;
  readonly original: string;
  readonly modified: boolean;
  readonly readonly: boolean;
}

/** A file as an owner gives it: its name, its text, and whether it is read-only, false unless
 * said. */
export interface GivenFile {
  name: string;
  text: string;
  readonly?: boolean;
}

/** The value as a reason names it: a string as JSON, so its spaces show; anything else as it
 * prints. */
const shown = (value: unknown) =>
  typeof value === "string" ? JSON.stringify(value) : String(value);

/** Why value can't be a file's name, or null when it can: a string holding something other than
 * white space, and neither path separator, "/" or "\". Whether another file holds it is the set's
 * to say: see FileSet's nameProblem. */
export function nameProblem(value: unknown): string | null {
  if (typeof value !== "string") return `a file's name must be text, not ${shown(value)}`;
  if (value.trim() === "") return "a file's name can't be empty";
  if (/[/\\]/.test(value)) {
    return `a file's name can't hold a path separator, "/" or "\\": ${shown(value)}`;
  }
  return null;
}

/** A file's mutable record, from which its snapshot is made. */
interface Held {
  name: string;
  text: string;
  original: string;
  readonly: boolean;
}

/**
 * A set of source files, at least one, one of them active. `files` lists them, in the order given
 * or added, as frozen snapshots; `active` names the active one, and `file(name)` finds one.
 *
 * Its operations each change it as named: `select` makes a file active; `edit` replaces a file's
 * text; `reset` restores a file's text as given, and `resetAll` every file's; `add` appends a new
 * file, editable, its text as given empty unless said, and leaves the active file as it was;
 * `rename` renames a file in its place, active if it was; `remove` deletes a file, and when it was
 * active makes its neighbour active, the next, else the previous.
 *
 * An operation it can't apply throws, naming the reason, and changes nothing: a TypeError for a
 * name or text that isn't a string, a RangeError for any other refusal: a name that is empty or
 * white space alone, holds a path separator, or another file holds; a file it doesn't hold; an
 * edit to a read-only file; or removing the last file. `nameProblem` and `removeProblem` give the
 * reason, or null, without changing anything. Each operation that changes the set sends one
 * `change` event; one that changes nothing, such as selecting the active file or editing a file to
 * the text it holds, sends none.
 */
export class FileSet extends EventTarget {
  #held: Held[];
  #active: string;
  /** The snapshots, made once for each change. */
  #files: readonly SourceFile[] = [];

  /** A set of the files given, in their order, each as given and so unmodified; active names the
   * active one, the first by default. Each name is validated as add would validate it, and the
   * set must hold at least one file. */
  constructor(files: Iterable<GivenFile>, active?: string) {
    super();
    this.#held = [];
    for (const { name, text, readonly = false } of files) {
      const problem = this.nameProblem(name);
      if (problem) throw refusal(name, problem);
      checkText(text);
      if (typeof readonly !== "boolean") {
        throw new TypeError(`read-only must be true or false, not ${shown(readonly)}`);
      }
      this.#held.push({ name, text, original: text, readonly });
    }
    if (this.#held.length === 0) throw new RangeError("a file set holds at least one file");
    this.#active = this.#held[0].name;
    if (active !== undefined) this.#active = this.#find(active).name;
    this.#snapshot();
  }

  /** The files, in order, as frozen snapshots; the same array until the set changes. */
  get files(): readonly SourceFile[] {
    return this.#files;
  }

  /** The active file's name. */
  get active(): string {
    return this.#active;
  }

  /** The active file. */
  get activeFile(): SourceFile {
    return this.file(this.#active) as SourceFile;
  }

  /** The file of the name, or undefined when the set holds none. */
  file(name: string): SourceFile | undefined {
    return this.#files.find((file) => file.name === name);
  }

  /** Whether any file's text differs from its text as given. */
  get modified(): boolean {
    return this.#files.some((file) => file.modified);
  }

  /** Why value can't be a new file's name, or the name a file is renamed to, or null when it can:
   * nameProblem's reason, or that another file holds it. Renaming a file, pass its name as
   * renaming, so its own name isn't counted as another's. */
  nameProblem(value: unknown, renaming?: string): string | null {
    const problem = nameProblem(value);
    if (problem) return problem;
    if (value !== renaming && this.#held.some((file) => file.name === value)) {
      return `another file is named ${shown(value)}`;
    }
    return null;
  }

  /** Why the file of the name can't be removed, or null when it can: the set holds no such file,
   * or it is the last. */
  removeProblem(name: unknown): string | null {
    const problem = this.#missing(name);
    if (problem) return problem;
    return this.#held.length === 1 ? "the last file can't be removed" : null;
  }

  /** Makes the file of the name active. */
  select(name: string): void {
    const file = this.#find(name);
    if (file.name === this.#active) return;
    this.#active = file.name;
    this.#changed();
  }

  /** Replaces the text of the file of the name, which must be editable. */
  edit(name: string, text: string): void {
    const file = this.#find(name);
    checkText(text);
    if (file.readonly) throw new RangeError(`${shown(file.name)} is read-only`);
    if (text === file.text) return;
    file.text = text;
    this.#changed();
  }

  /** Restores the text of the file of the name to its text as given. */
  reset(name: string): void {
    const file = this.#find(name);
    if (file.text === file.original) return;
    file.text = file.original;
    this.#changed();
  }

  /** Restores every file's text to its text as given, with one change event. The files added,
   * renamed, or removed stay as they are, and so does the active file: only text is reset. */
  resetAll(): void {
    let changed = false;
    for (const file of this.#held) {
      if (file.text === file.original) continue;
      file.text = file.original;
      changed = true;
    }
    if (changed) this.#changed();
  }

  /** Appends a new file, editable, its text, as given, empty unless said. The active file stays
   * active; its owner selects the new one if it means to show it. */
  add(name: string, text = ""): void {
    const problem = this.nameProblem(name);
    if (problem) throw refusal(name, problem);
    checkText(text);
    this.#held.push({ name, text, original: text, readonly: false });
    this.#changed();
  }

  /** Renames the file named from to, in its place, active if it was. Its text, as given and as
   * edited, and its read-only state go with it. */
  rename(from: string, to: string): void {
    const file = this.#find(from);
    if (to === from) return;
    const problem = this.nameProblem(to, from);
    if (problem) throw refusal(to, problem);
    if (this.#active === from) this.#active = to;
    file.name = to;
    this.#changed();
  }

  /** Removes the file of the name, unless it is the last; when it was active, the file after it
   * becomes active, or, when it was last in order, the file before it. */
  remove(name: string): void {
    const problem = this.removeProblem(name);
    if (problem) throw refusal(name, problem);
    const at = this.#held.findIndex((file) => file.name === name);
    this.#held.splice(at, 1);
    if (this.#active === name) this.#active = this.#held[Math.min(at, this.#held.length - 1)].name;
    this.#changed();
  }

  /** Why the set holds no file of the name, or null when it does. */
  #missing(name: unknown): string | null {
    if (typeof name !== "string") return `a file's name must be text, not ${shown(name)}`;
    return this.#held.some((file) => file.name === name) ? null : `no file is named ${shown(name)}`;
  }

  /** The file of the name; else the reason it isn't held, thrown. */
  #find(name: unknown): Held {
    const problem = this.#missing(name);
    if (problem) throw refusal(name, problem);
    return this.#held.find((file) => file.name === name) as Held;
  }

  /** Remakes the snapshots and sends one change. */
  #changed(): void {
    this.#snapshot();
    this.dispatchEvent(new Event("change"));
  }

  /** Remakes the snapshots from the records. */
  #snapshot(): void {
    this.#files = Object.freeze(
      this.#held.map(({ name, text, original, readonly }) =>
        Object.freeze({ name, text, original, modified: text !== original, readonly }),
      ),
    );
  }
}

/** The refusal of the value, for the reason: a TypeError when the value isn't a string, since
 * every name is one, else a RangeError. */
function refusal(value: unknown, problem: string): Error {
  return typeof value === "string" ? new RangeError(problem) : new TypeError(problem);
}

/** Throws a TypeError unless text is a string. */
function checkText(text: unknown): void {
  if (typeof text !== "string")
    throw new TypeError(`a file's text must be text, not ${shown(text)}`);
}
