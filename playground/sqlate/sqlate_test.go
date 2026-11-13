//nolint:testpackage // A main package can't be imported, so its tests run inside it, through run.

// sqlate's run over the .sql files and input.json in its working directory, a fresh temporary one
// per test, its whole output and its exit, as the page shows them: the shipped files, embedded
// here because the check also runs this test on the runtime's in-memory fs, which holds no package
// directory (scripts/check-go.sh), printing each statement and the guarded edit's success with
// exit 0; a pattern in a namespace of the reader's own included by a statement; and each kind of
// catalog or compile error printing sqlate's message on one stderr line, with exit 1, and nothing
// else. Then the run's outcomes, each its call log and result, set by input.json's stored
// version: equal to the version read, the new version; another, the version mismatch; null,
// sql.ErrNoRows; and each reason it can't run, a missing edit.sql, version.sql, or input.json, or
// an input.json that isn't the JSON it reads, after the statements, on one stderr line, with exit
// 1. Then parameters and bound, which list the placeholders, on their own.
package main

import (
	"embed"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"testing"
)

// shipped is the package's .sql files and input.json, the sample patterns, statements, and
// run.
//
//go:embed *.sql input.json
var shipped embed.FS

// runFiles runs sqlate over the shipped files, but those without names, with files written over
// them, each name its text, answering its stdout, stderr, and exit code.
func runFiles(t *testing.T, files map[string]string, without ...string) (stdout, stderr string, code int) {
	t.Helper()
	t.Chdir(t.TempDir())
	names, err := fs.Glob(shipped, "*")
	if err != nil {
		t.Fatalf("list the shipped files: %v", err)
	}
	for _, name := range names {
		if slices.Contains(without, name) {
			continue
		}
		text, err := shipped.ReadFile(name)
		if err != nil {
			t.Fatalf("read %s: %v", name, err)
		}
		write(t, name, string(text))
	}
	for name, text := range files {
		write(t, name, text)
	}
	return capture(t)
}

// write writes text to name in the working directory.
func write(t *testing.T, name, text string) {
	t.Helper()
	if err := os.WriteFile(name, []byte(text), 0o644); err != nil {
		t.Fatalf("write %s: %v", name, err)
	}
}

// capture calls run with os.Stdout and os.Stderr each a file of its own, answering what run wrote
// to each and its exit code. Files, since js/wasm has no os.Pipe.
func capture(t *testing.T) (stdout, stderr string, code int) {
	t.Helper()
	dir := t.TempDir()
	open := func(name string) *os.File {
		f, err := os.Create(filepath.Join(dir, name))
		if err != nil {
			t.Fatalf("create %s: %v", name, err)
		}
		t.Cleanup(func() { _ = f.Close() })
		return f
	}
	saved := [2]*os.File{os.Stdout, os.Stderr}
	os.Stdout, os.Stderr = open("stdout"), open("stderr")
	defer func() { os.Stdout, os.Stderr = saved[0], saved[1] }()
	code = run()
	read := func(name string) string {
		text, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			t.Fatalf("read %s: %v", name, err)
		}
		return string(text)
	}
	return read("stdout"), read("stderr"), code
}

// create, edit, and version are what sqlate prints for each shipped statement, every run.
const (
	create = `-- create: native, parameters $1 code, $2 name
INSERT INTO project (code, name)
VALUES ($1, $2)
RETURNING id, version
`
	edit = `-- edit: standard, parameters $1 code, $2 name, $3 id, $4 version
UPDATE project
SET code = $1, name = $2, updated_at = CURRENT_TIMESTAMP, version = version + 1
WHERE id = $3 AND version = $4
`
	version = `-- version: standard, parameters $1 id
SELECT version FROM project WHERE id = $1
`
)

// statements is what sqlate prints for the shipped statements, before the run.
const statements = create + "\n" + edit + "\n" + version

// The run's call log: the edit's exec, at the shipped input.json's arguments and the version
// read, 3, and, when it changes no row, version's query of the id.
const (
	execEdit = `
-- exec, $1 = "LAB", $2 = "Standards Lab", $3 = 42, $4 = 3
UPDATE project
SET code = $1, name = $2, updated_at = CURRENT_TIMESTAMP, version = version + 1
WHERE id = $3 AND version = $4
`
	queryVersion = `
-- query, $1 = 42
SELECT version FROM project WHERE id = $1
`
)

// succeeded is what the run prints for the shipped input.json, the row stored at the version read.
const succeeded = `
-- run: edit guarded by version, version 3 read; the row stored at version 3
` + execEdit + `
-- result: version 4
`

// output is what sqlate prints for the shipped files, every run.
const output = statements + succeeded

// inputStored is the shipped input.json with the row's stored version stored, a JSON value.
func inputStored(stored string) map[string]string {
	return map[string]string{
		"input.json": `{"id": 42, "code": "LAB", "name": "Standards Lab", "version": 3, "stored": ` + stored + "}\n",
	}
}

func TestShippedFilesPrintEachStatementAndExitZero(t *testing.T) {
	for range 2 {
		stdout, stderr, code := runFiles(t, nil)
		if stdout != output || stderr != "" || code != 0 {
			t.Fatalf("run = %q, %q, exit %d; want %q, no stderr, exit 0", stdout, stderr, code, output)
		}
	}
}

// A pattern file in a namespace no other file names publishes that namespace, and a statement
// includes it, printed in its name order among the shipped ones.
func TestReadersNamespaceIsIncluded(t *testing.T) {
	stdout, stderr, code := runFiles(t, map[string]string{
		"audit.stamp.sql": "--| tier: standard\n-- When the row was read.\nCURRENT_TIMESTAMP AS read_at\n",
		"stamped.sql":     "--| tier: standard\nSELECT name, {{> audit.stamp}}\nFROM project WHERE id = {{id}}\n",
	})
	want := create + "\n" + edit + `
-- stamped: standard, parameters $1 id
SELECT name, CURRENT_TIMESTAMP AS read_at
FROM project WHERE id = $1

` + version + succeeded
	if stdout != want || stderr != "" || code != 0 {
		t.Fatalf("run = %q, %q, exit %d; want %q, no stderr, exit 0", stdout, stderr, code, want)
	}
}

// Each catalog or compile error, the one line of sqlate's own it prints on stderr, and nothing on
// stdout.
func TestCatalogAndCompileErrorsPrintOneLineAndExitOne(t *testing.T) {
	for _, tt := range []struct {
		name  string
		files map[string]string
		want  string
	}{
		{
			// The library's patterns register sql first, so a reader's sql is its second.
			name:  "a pattern in the library's sql namespace, reserved and so repeated",
			files: map[string]string{"sql.stamp.sql": "--| tier: standard\nCURRENT_TIMESTAMP\n"},
			want:  "query: namespace \"sql\" is registered twice; alias one source with As\n",
		},
		{
			name:  "a pattern with no tier",
			files: map[string]string{"app.stamp.sql": "-- When the row was read.\nCURRENT_TIMESTAMP\n"},
			want:  "query: pattern stamp.sql (app): no tier declaration\n",
		},
		{
			name:  "a statement with no tier",
			files: map[string]string{"count.sql": "SELECT count(*) FROM project\n"},
			want:  "query: count.sql: no tier declaration\n",
		},
		{
			name:  "an include of a pattern its namespace doesn't publish",
			files: map[string]string{"count.sql": "--| tier: standard\nSELECT count(*) FROM project {{> app.missing}}\n"},
			want:  "query: count.sql: include of unknown pattern \"app.missing\"\n",
		},
		{
			name:  "an include of a namespace no file publishes",
			files: map[string]string{"count.sql": "--| tier: standard\nSELECT {{> audit.stamp}}\n"},
			want:  "query: count.sql: include of unknown namespace \"audit\" (registered: app, sql)\n",
		},
		{
			name: "a native pattern included in a standard statement",
			files: map[string]string{
				"create.sql": "--| tier: standard\nINSERT INTO project (code, name)\nVALUES ({{code}}, {{name}})\n{{> app.identity}}\n",
			},
			want: "query: create.sql: include of native pattern \"app.identity\" in a standard-tier statement\n",
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			stdout, stderr, code := runFiles(t, tt.files)
			if stdout != "" || stderr != tt.want || code != 1 {
				t.Fatalf("run = %q, %q, exit %d; want only %q, exit 1", stdout, stderr, code, tt.want)
			}
		})
	}
}

// Each outcome of the guarded edit, set by input.json's stored version, its whole call log and
// its result, after the statements, with exit 0: the row stored at the version read is one exec
// and the new version; at another, the exec and version's query, which reads it back, and the
// mismatch; no row, the same two calls and sql.ErrNoRows' message.
func TestRunPrintsEachCallAndTheOutcomeTheStoredVersionSets(t *testing.T) {
	for _, tt := range []struct {
		name, stored, want string
	}{
		{
			name:   "stored at the version read",
			stored: "3",
			want:   succeeded,
		},
		{
			name:   "stored at another version",
			stored: "5",
			want: `
-- run: edit guarded by version, version 3 read; the row stored at version 5
` + execEdit + queryVersion + `
-- result: version mismatch: expected 3, current 5
`,
		},
		{
			name:   "no row stored",
			stored: "null",
			want: `
-- run: edit guarded by version, version 3 read; no row stored
` + execEdit + queryVersion + `
-- result: sql: no rows in result set
`,
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			stdout, stderr, code := runFiles(t, inputStored(tt.stored))
			if want := statements + tt.want; stdout != want || stderr != "" || code != 0 {
				t.Fatalf("run = %q, %q, exit %d; want %q, no stderr, exit 0", stdout, stderr, code, want)
			}
		})
	}
}

// Each reason the run can't start, after the statements print: one stderr line saying why, no run
// on stdout, and exit 1.
func TestRunThatCantStartPrintsWhyAndExitsOne(t *testing.T) {
	for _, tt := range []struct {
		name    string
		files   map[string]string
		without []string
		stdout  string
		want    string
	}{
		{
			name:    "no edit.sql",
			without: []string{"edit.sql"},
			stdout:  create + "\n" + version,
			want:    "the run needs edit.sql, and there is none\n",
		},
		{
			name:    "no version.sql",
			without: []string{"version.sql"},
			stdout:  create + "\n" + edit,
			want:    "the run needs version.sql, and there is none\n",
		},
		{
			name:    "no input.json",
			without: []string{"input.json"},
			stdout:  statements,
			want:    "input.json: no such file in the working directory\n",
		},
		{
			name:   "input.json not JSON",
			files:  map[string]string{"input.json": `{"id": 42,`},
			stdout: statements,
			want:   "input.json: unexpected EOF\n",
		},
		{
			name:   "a stored version that isn't a number",
			files:  inputStored(`"3"`),
			stdout: statements,
			want:   "input.json: json: cannot unmarshal string into Go struct field Input.stored of type int64\n",
		},
		{
			name:   "a key the run doesn't read",
			files:  map[string]string{"input.json": `{"id": 42, "verison": 3}`},
			stdout: statements,
			want:   "input.json: json: unknown field \"verison\"\n",
		},
		{
			name:   "a second value after the object",
			files:  map[string]string{"input.json": `{"id": 42} {}`},
			stdout: statements,
			want:   "input.json: more than one JSON value\n",
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			stdout, stderr, code := runFiles(t, tt.files, tt.without...)
			if stdout != tt.stdout || stderr != tt.want || code != 1 {
				t.Fatalf("run = %q, %q, exit %d; want %q, %q, exit 1", stdout, stderr, code, tt.stdout, tt.want)
			}
		})
	}
}

func TestParametersListsEachPlaceholderInOrder(t *testing.T) {
	for _, tt := range []struct {
		names []string
		want  string
	}{
		{nil, "no parameters"},
		{[]string{"id"}, "parameters $1 id"},
		{[]string{"code", "name", "id"}, "parameters $1 code, $2 name, $3 id"},
	} {
		if got := parameters(tt.names); got != tt.want {
			t.Errorf("parameters(%q) = %q; want %q", tt.names, got, tt.want)
		}
	}
}

func TestBoundListsEachValueByItsPlaceholder(t *testing.T) {
	for _, tt := range []struct {
		values []any
		want   string
	}{
		{nil, ""},
		{[]any{int64(42)}, ", $1 = 42"},
		{[]any{"LAB", int64(3)}, `, $1 = "LAB", $2 = 3`},
	} {
		if got := bound(tt.values); got != tt.want {
			t.Errorf("bound(%v) = %q; want %q", tt.values, got, tt.want)
		}
	}
}
