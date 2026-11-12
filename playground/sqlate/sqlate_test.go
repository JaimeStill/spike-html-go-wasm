//nolint:testpackage // A main package can't be imported, so its tests run inside it, through run.

// sqlate's run over .sql files in its working directory, a fresh temporary one per test, its
// whole output and its exit, as the page shows them: the shipped files, embedded here because
// the check also runs this test on the runtime's in-memory fs, which holds no package directory
// (scripts/check-go.sh), printing each statement with exit 0; a pattern in a namespace of the
// reader's own included by a statement; and each kind of catalog or compile error printing
// sqlate's message on one stderr line, with exit 1. Then parameters, which lists the
// placeholders, on its own.
package main

import (
	"embed"
	"io/fs"
	"os"
	"path/filepath"
	"testing"
)

// shipped is the package's .sql files, the sample patterns and statements.
//
//go:embed *.sql
var shipped embed.FS

// runFiles runs sqlate over the shipped files with files written over them, each name its text,
// answering its stdout, stderr, and exit code.
func runFiles(t *testing.T, files map[string]string) (stdout, stderr string, code int) {
	t.Helper()
	t.Chdir(t.TempDir())
	names, err := fs.Glob(shipped, "*.sql")
	if err != nil {
		t.Fatalf("list the shipped files: %v", err)
	}
	for _, name := range names {
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

// output is what sqlate prints for the shipped files, every run.
const output = `-- create: native, parameters $1 code, $2 name
INSERT INTO project (code, name)
VALUES ($1, $2)
RETURNING id, version

-- edit: standard, parameters $1 code, $2 name, $3 id, $4 version
UPDATE project
SET code = $1, name = $2, updated_at = CURRENT_TIMESTAMP, version = version + 1
WHERE id = $3 AND version = $4

-- version: standard, parameters $1 id
SELECT version FROM project WHERE id = $1
`

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
	want := `-- create: native, parameters $1 code, $2 name
INSERT INTO project (code, name)
VALUES ($1, $2)
RETURNING id, version

-- edit: standard, parameters $1 code, $2 name, $3 id, $4 version
UPDATE project
SET code = $1, name = $2, updated_at = CURRENT_TIMESTAMP, version = version + 1
WHERE id = $3 AND version = $4

-- stamped: standard, parameters $1 id
SELECT name, CURRENT_TIMESTAMP AS read_at
FROM project WHERE id = $1

-- version: standard, parameters $1 id
SELECT version FROM project WHERE id = $1
`
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
