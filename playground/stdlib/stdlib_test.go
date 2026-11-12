//nolint:testpackage // A main package can't be imported, so its tests run inside it, through run.

// stdlib's run over an input.json in its working directory, a fresh temporary one per test, its
// whole output and its exit, as the playground shows them: the shipped input.json, embedded here
// because the check also runs this test on the runtime's in-memory fs, which holds no package
// directory (scripts/check-go.sh), printing its report with exit 0, the same every run; each kind
// of malformed input.json printing one line on stderr naming its JSON error, with exit 1; and no
// input.json at all, likewise. Then position, which places a decoder's offset, on its own.
package main

import (
	_ "embed"
	"os"
	"path/filepath"
	"testing"
)

//go:embed input.json
var shipped string

// runInput runs stdlib over text as its input.json, answering its stdout, stderr, and exit code.
func runInput(t *testing.T, text string) (stdout, stderr string, code int) {
	t.Helper()
	t.Chdir(t.TempDir())
	if err := os.WriteFile(input, []byte(text), 0o644); err != nil {
		t.Fatalf("write %s: %v", input, err)
	}
	return capture(t)
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

// output is what stdlib prints for the shipped input.json, every run.
const output = `calc v1.1.0: 8 commits by 3 authors

Features:
  c47d2a6  -       comments start with # and run to the end of the line
  e2a9d48  eval    report division by zero (#9, #14)
  4d1e7a2  parser  parse a leading minus as negation (#14)

Fixes:
  b83f0c9  lexer   accept a number that starts with a dot (#12)
  93ac27f  parser  reject a let with no name (#17)

Other:
  71c5e30  -       explain let in the doc comment
  5be8c14  lexer   cover numbers with two dots

Not in the conventional form:
  0f6b1d5  "tidy up before the release"

By author, most commits first:
  Ada   4
  Grace 3
  Linus 1

Issues referenced: #9, #12, #14, #17
`

func TestShippedInputPrintsTheReportAndExitsZero(t *testing.T) {
	for range 2 {
		stdout, stderr, code := runInput(t, shipped)
		if stdout != output || stderr != "" || code != 0 {
			t.Fatalf("run = %q, %q, exit %d; want %q, no stderr, exit 0", stdout, stderr, code, output)
		}
	}
}

// Each malformed input.json, the one line it prints on stderr, and nothing on stdout.
func TestMalformedInputPrintsOneLineAndExitsOne(t *testing.T) {
	for _, tt := range []struct{ name, text, want string }{
		{
			name: "a trailing comma, a SyntaxError",
			text: "{\n  \"commits\": [\n    { \"hash\": \"4d1e7a2\" },\n  ]\n}\n",
			want: "input.json:4:3: syntax error: invalid character ']' looking for beginning of value\n",
		},
		{
			name: "cut short, a SyntaxError",
			text: `{"project": `,
			want: "input.json:1:12: syntax error: unexpected end of JSON input\n",
		},
		{
			name: "a number for a string, an UnmarshalTypeError",
			text: "{\n  \"commits\": [\n    { \"author\": 7 }\n  ]\n}\n",
			want: "input.json:3:17: commits.0.author is a JSON number, not a Go string\n",
		},
		{
			name: "an array for the whole file, an UnmarshalTypeError",
			text: `[]`,
			want: "input.json:1:1: the whole file is a JSON array, not a Go main.Log\n",
		},
	} {
		t.Run(tt.name, func(t *testing.T) {
			stdout, stderr, code := runInput(t, tt.text)
			if stdout != "" || stderr != tt.want || code != 1 {
				t.Fatalf("run = %q, %q, exit %d; want only %q, exit 1", stdout, stderr, code, tt.want)
			}
		})
	}
}

func TestMissingInputPrintsOneLineAndExitsOne(t *testing.T) {
	t.Chdir(t.TempDir())
	stdout, stderr, code := capture(t)
	want := "input.json: no such file in the working directory\n"
	if stdout != "" || stderr != want || code != 1 {
		t.Fatalf("run = %q, %q, exit %d; want only %q, exit 1", stdout, stderr, code, want)
	}
}

func TestPositionCountsLinesAndColumnsFromOne(t *testing.T) {
	src := []byte("ab\ncd\n")
	for _, tt := range []struct {
		offset int64
		want   string
	}{
		{0, "1:1"}, {1, "1:2"}, {2, "1:3"}, {3, "2:1"}, {4, "2:2"},
		{-1, "1:1"}, {99, "3:1"},
	} {
		if got := position(src, tt.offset); got != tt.want {
			t.Errorf("position(%q, %d) = %q; want %q", src, tt.offset, got, tt.want)
		}
	}
}
