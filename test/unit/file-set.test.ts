// The file set, web/components/file-set.ts, under node with no browser: each operation's change,
// the active file after each, the names' validation and the reasons it names, the refusals that
// leave the set as it was, and its change event, sent once for each change and never for an
// operation that changes nothing.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { FileSet, nameProblem, type SourceFile } from "../../web/components/file-set.ts";

/** The set's state as one value: its files, in order, and the active file's name. */
const state = (set: FileSet) => ({
  files: set.files.map((file) => ({ ...file })),
  active: set.active,
});

/** The set's state after each change event, in order, as the events arrive. */
function heard(set: FileSet): ReturnType<typeof state>[] {
  const seen: ReturnType<typeof state>[] = [];
  set.addEventListener("change", (event) => {
    assert.equal(event.target, set);
    seen.push(state(set));
  });
  return seen;
}

/** The files' names, in order. */
const names = (set: FileSet) => set.files.map((file) => file.name);

/** A file as the set gives it. */
const file = (name: string, text: string, fields: Partial<SourceFile> = {}): SourceFile => ({
  name,
  text,
  original: text,
  modified: false,
  readonly: false,
  ...fields,
});

/** Three files, b.go the read-only one. */
const three = () =>
  new FileSet([
    { name: "a.go", text: "package a\n" },
    { name: "b.go", text: "package b\n", readonly: true },
    { name: "c.go", text: "package c\n" },
  ]);

/** Asserts that act throws the kind of error, its message matching reason, and leaves the set as
 * it was, sending no change. */
function refused(set: FileSet, act: () => void, kind: ErrorConstructor, reason: RegExp): void {
  const before = state(set);
  const files = set.files;
  const seen = heard(set);
  assert.throws(act, (error: Error) => error instanceof kind && reason.test(error.message));
  assert.deepEqual(state(set), before, "a refusal changes nothing");
  assert.equal(set.files, files, "a refusal makes no new snapshot");
  assert.deepEqual(seen, [], "a refusal sends no change");
}

describe("FileSet's construction", () => {
  test("holds the files given, in order, each unmodified, the first active", () => {
    const set = three();
    assert.deepEqual(state(set), {
      files: [
        file("a.go", "package a\n"),
        file("b.go", "package b\n", { readonly: true }),
        file("c.go", "package c\n"),
      ],
      active: "a.go",
    });
    assert.deepEqual(set.activeFile, file("a.go", "package a\n"));
    assert.equal(set.modified, false);
  });

  test("makes the file named active", () => {
    const set = new FileSet(
      [
        { name: "a.go", text: "" },
        { name: "b.go", text: "" },
      ],
      "b.go",
    );
    assert.equal(set.active, "b.go");
  });

  test("refuses no files, a name it would refuse to add, a duplicate, an active file it lacks, and a text or read-only of the wrong type", () => {
    assert.throws(() => new FileSet([]), /^RangeError: a file set holds at least one file$/);
    assert.throws(() => new FileSet([{ name: " ", text: "" }]), RangeError);
    assert.throws(() => new FileSet([{ name: "a/b.go", text: "" }]), RangeError);
    assert.throws(
      () =>
        new FileSet([
          { name: "a.go", text: "" },
          { name: "a.go", text: "" },
        ]),
      /^RangeError: another file is named "a.go"$/,
    );
    assert.throws(
      () => new FileSet([{ name: "a.go", text: "" }], "z.go"),
      /no file is named "z.go"/,
    );
    assert.throws(() => new FileSet([{ name: "a.go", text: 1 as unknown as string }]), TypeError);
    assert.throws(
      () => new FileSet([{ name: "a.go", text: "", readonly: "yes" as unknown as boolean }]),
      /^TypeError: read-only must be true or false, not "yes"$/,
    );
  });

  test("its files and their snapshots are frozen, and the same until the set changes", () => {
    const set = three();
    const files = set.files;
    assert.ok(Object.isFrozen(files));
    assert.ok(files.every((each) => Object.isFrozen(each)));
    assert.equal(set.files, files);
    set.select("a.go");
    assert.equal(set.files, files, "a select of the active file makes no new snapshot");
    set.edit("a.go", "changed");
    assert.notEqual(set.files, files);
    assert.equal(files[0].text, "package a\n", "a snapshot already read keeps its text");
  });
});

describe("names", () => {
  test("a name of any text but white space alone, with no path separator, is a name", () => {
    for (const name of ["main.go", "go.mod", "a", " x ", "über.go", ".hidden", "a b.go"]) {
      assert.equal(nameProblem(name), null, name);
    }
  });

  test("refuses an empty name, white space alone, a path separator, or a value that isn't text, naming why", () => {
    const cases: [unknown, RegExp][] = [
      ["", /^a file's name can't be empty$/],
      ["   ", /^a file's name can't be empty$/],
      ["\t\n", /^a file's name can't be empty$/],
      ["a/b.go", /^a file's name can't hold a path separator, "\/" or "\\": "a\/b.go"$/],
      ["a\\b.go", /path separator.*"a\\\\b.go"$/],
      ["/", /path separator/],
      [undefined, /^a file's name must be text, not undefined$/],
      [null, /^a file's name must be text, not null$/],
      [3, /^a file's name must be text, not 3$/],
    ];
    for (const [value, reason] of cases) assert.match(nameProblem(value) ?? "", reason);
  });

  test("the set's nameProblem adds another file holding the name, but not the file renamed", () => {
    const set = three();
    assert.equal(set.nameProblem("d.go"), null);
    assert.equal(set.nameProblem("b.go"), 'another file is named "b.go"');
    assert.equal(set.nameProblem("b.go", "b.go"), null, "a file's own name is no duplicate");
    assert.equal(set.nameProblem("b.go", "a.go"), 'another file is named "b.go"');
    assert.equal(set.nameProblem(""), "a file's name can't be empty");
    assert.equal(set.nameProblem("B.go"), null, "names differ by case");
  });
});

describe("select", () => {
  test("makes the file active, with one change, and selecting the active file sends none", () => {
    const set = three();
    const seen = heard(set);
    set.select("a.go");
    assert.deepEqual(seen, []);
    set.select("c.go");
    set.select("c.go");
    set.select("b.go");
    assert.deepEqual(
      seen.map(({ active }) => active),
      ["c.go", "b.go"],
    );
    assert.equal(set.activeFile.name, "b.go");
  });

  test("refuses a file it lacks, or a name that isn't text", () => {
    const set = three();
    refused(set, () => set.select("z.go"), RangeError, /^no file is named "z.go"$/);
    refused(set, () => set.select(1 as unknown as string), TypeError, /must be text, not 1$/);
  });
});

describe("edit and reset", () => {
  test("edit replaces the text, which is then modified, and an edit back to the text as given is not", () => {
    const set = three();
    const seen = heard(set);
    set.edit("c.go", "package c // edited\n");
    assert.deepEqual(
      set.file("c.go"),
      file("c.go", "package c // edited\n", {
        original: "package c\n",
        modified: true,
      }),
    );
    assert.equal(set.modified, true);
    assert.equal(set.active, "a.go", "editing a file doesn't make it active");
    set.edit("c.go", "package c\n");
    assert.deepEqual(set.file("c.go"), file("c.go", "package c\n"));
    assert.equal(set.modified, false);
    assert.equal(seen.length, 2);
  });

  test("an edit to the text the file holds sends no change", () => {
    const set = three();
    const seen = heard(set);
    set.edit("a.go", "package a\n");
    set.edit("a.go", "x");
    set.edit("a.go", "x");
    assert.equal(seen.length, 1);
  });

  test("refuses an edit to a read-only file, a file it lacks, or text that isn't text", () => {
    const set = three();
    refused(set, () => set.edit("b.go", "package b2\n"), RangeError, /^"b.go" is read-only$/);
    refused(set, () => set.edit("b.go", "package b\n"), RangeError, /read-only/);
    refused(set, () => set.edit("z.go", ""), RangeError, /^no file is named "z.go"$/);
    refused(
      set,
      () => set.edit("a.go", null as unknown as string),
      TypeError,
      /^a file's text must be text, not null$/,
    );
  });

  test("reset restores the file's text as given, with one change, and sends none for an unmodified file", () => {
    const set = three();
    set.edit("a.go", "one");
    set.edit("c.go", "three");
    const seen = heard(set);
    set.reset("a.go");
    set.reset("a.go");
    set.reset("b.go");
    assert.deepEqual(set.file("a.go"), file("a.go", "package a\n"));
    assert.equal(set.file("c.go")?.text, "three", "other files keep their edits");
    assert.equal(seen.length, 1);
    refused(set, () => set.reset("z.go"), RangeError, /no file is named/);
  });

  test("resetAll restores every file's text as given with one change, and sends none when none is modified", () => {
    const set = three();
    const seen = heard(set);
    set.resetAll();
    assert.deepEqual(seen, []);
    set.edit("a.go", "one");
    set.edit("c.go", "three");
    set.select("c.go");
    set.resetAll();
    assert.equal(seen.length, 4);
    assert.deepEqual(state(set), { files: state(three()).files, active: "c.go" });
    assert.equal(set.modified, false);
    set.resetAll();
    assert.equal(seen.length, 4);
  });

  test("resetAll leaves added, renamed, and removed files as they are, each at its own text as given", () => {
    const set = three();
    set.add("d.go", "package d\n");
    set.edit("d.go", "package d // edited\n");
    set.rename("a.go", "first.go");
    set.remove("c.go");
    set.resetAll();
    assert.deepEqual(names(set), ["first.go", "b.go", "d.go"]);
    assert.equal(set.file("d.go")?.text, "package d\n");
  });
});

describe("add", () => {
  test("appends an editable file, its text as given empty unless said, leaving the active file, with one change", () => {
    const set = three();
    const seen = heard(set);
    set.add("d.go");
    set.add("e.go", "package e\n");
    assert.deepEqual(names(set), ["a.go", "b.go", "c.go", "d.go", "e.go"]);
    assert.deepEqual(set.file("d.go"), file("d.go", ""));
    assert.deepEqual(set.file("e.go"), file("e.go", "package e\n"));
    assert.equal(set.active, "a.go");
    assert.equal(seen.length, 2);
    set.edit("d.go", "package d\n");
    assert.equal(
      set.file("d.go")?.modified,
      true,
      "a new file is editable, modified from its text as given",
    );
  });

  test("refuses a name that is empty, white space, holds a path separator, or another file holds", () => {
    const set = three();
    refused(set, () => set.add(""), RangeError, /^a file's name can't be empty$/);
    refused(set, () => set.add("  "), RangeError, /can't be empty/);
    refused(set, () => set.add("cmd/main.go"), RangeError, /path separator/);
    refused(set, () => set.add("cmd\\main.go"), RangeError, /path separator/);
    refused(set, () => set.add("b.go"), RangeError, /^another file is named "b.go"$/);
    refused(set, () => set.add(undefined as unknown as string), TypeError, /must be text/);
    refused(set, () => set.add("d.go", 4 as unknown as string), TypeError, /text must be text/);
  });
});

describe("rename", () => {
  test("renames the file in its place, keeping its text, its text as given, and read-only, with one change", () => {
    const set = three();
    set.edit("c.go", "edited");
    const seen = heard(set);
    set.rename("c.go", "z.go");
    set.rename("b.go", "y.go");
    assert.deepEqual(names(set), ["a.go", "y.go", "z.go"]);
    assert.deepEqual(
      set.file("z.go"),
      file("z.go", "edited", {
        original: "package c\n",
        modified: true,
      }),
    );
    assert.equal(set.file("y.go")?.readonly, true);
    assert.equal(set.file("c.go"), undefined);
    assert.equal(seen.length, 2);
  });

  test("renaming the active file keeps it active under its new name; another stays inactive", () => {
    const set = three();
    set.select("c.go");
    set.rename("c.go", "main.go");
    assert.equal(set.active, "main.go");
    assert.equal(set.activeFile.text, "package c\n");
    set.rename("a.go", "first.go");
    assert.equal(set.active, "main.go");
  });

  test("a rename to the file's own name sends no change", () => {
    const set = three();
    const seen = heard(set);
    set.rename("a.go", "a.go");
    assert.deepEqual(seen, []);
  });

  test("refuses a file it lacks, or a new name it would refuse to add", () => {
    const set = three();
    refused(set, () => set.rename("z.go", "y.go"), RangeError, /^no file is named "z.go"$/);
    refused(set, () => set.rename("a.go", "b.go"), RangeError, /^another file is named "b.go"$/);
    refused(set, () => set.rename("a.go", ""), RangeError, /can't be empty/);
    refused(set, () => set.rename("a.go", "x/a.go"), RangeError, /path separator/);
    refused(set, () => set.rename("a.go", null as unknown as string), TypeError, /must be text/);
  });
});

describe("remove", () => {
  test("removes an inactive file, leaving the active one, with one change", () => {
    const set = three();
    const seen = heard(set);
    set.remove("b.go");
    assert.deepEqual(names(set), ["a.go", "c.go"]);
    assert.equal(set.active, "a.go");
    assert.equal(seen.length, 1);
  });

  test("removing the active file activates the next, else, the last in order, the previous", () => {
    const set = new FileSet(
      ["a", "b", "c", "d"].map((name) => ({ name, text: "" })),
      "b",
    );
    const seen = heard(set);
    set.remove("b");
    assert.equal(set.active, "c", "the next");
    set.select("d");
    set.remove("d");
    assert.equal(set.active, "c", "the previous, removing the last in order");
    set.select("a");
    set.remove("a");
    assert.equal(set.active, "c", "the next, removing the first");
    assert.deepEqual(names(set), ["c"]);
    assert.equal(seen.length, 5, "one change for each remove and each select");
  });

  test("refuses the last file, or a file it lacks, naming why; removeProblem says so without removing", () => {
    const set = new FileSet([{ name: "only.go", text: "" }]);
    assert.equal(set.removeProblem("only.go"), "the last file can't be removed");
    refused(set, () => set.remove("only.go"), RangeError, /^the last file can't be removed$/);
    assert.equal(set.removeProblem("z.go"), 'no file is named "z.go"');
    refused(set, () => set.remove("z.go"), RangeError, /^no file is named "z.go"$/);
    assert.equal(three().removeProblem("a.go"), null);
  });

  test("a read-only file can be renamed and removed: read-only holds its text alone", () => {
    const set = three();
    set.rename("b.go", "readonly.go");
    set.remove("readonly.go");
    assert.deepEqual(names(set), ["a.go", "c.go"]);
  });
});

test("each set is its own: changing one leaves another as it was and sends it nothing", () => {
  const first = three();
  const second = three();
  const seen = heard(second);
  first.edit("a.go", "x");
  first.select("c.go");
  first.add("d.go");
  assert.deepEqual(state(second), state(three()));
  assert.deepEqual(seen, []);
});
