//nolint:testpackage // A main package can't be imported, so its tests run inside it, through run.

// calc's run over a script in its working directory, a fresh temporary one per test: the shipped
// input.txt, embedded here because the check also runs this test on the runtime's in-memory fs,
// which holds no package directory (scripts/check-go.sh), and a script whose failing lines report
// and let the run go on. Then single lines through exec, for the grammar's precedence, grouping,
// and errors.
package main

import (
	_ "embed"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

//go:embed input.txt
var shipped string

// runScript runs calc over script as its input.txt, answering its stdout, stderr, and exit code.
func runScript(t *testing.T, script string) (stdout, stderr string, code int) {
	t.Helper()
	t.Chdir(t.TempDir())
	if err := os.WriteFile("input.txt", []byte(script), 0o644); err != nil {
		t.Fatalf("write input.txt: %v", err)
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

func TestShippedInputRunsClean(t *testing.T) {
	stdout, stderr, code := runScript(t, shipped)
	want := "apples = 3\nbread = 4.25\ncoffee = 17.5\nsubtotal = 24.75\n" +
		"coupon = -4.75\nrate = 0.08\ntotal = 21.6\n5.4\n3.4\n"
	if stdout != want || stderr != "" || code != 0 {
		t.Fatalf("run = %q, %q, exit %d; want %q, no stderr, exit 0", stdout, stderr, code, want)
	}
}

func TestFailingLinesReportAndTheRunGoesOn(t *testing.T) {
	script := strings.Join([]string{
		"let x = 6 # six",
		"x / (3 - 3)",
		"let y = x * tip",
		"(x + 1",
		"x $ 2",
		"let = 4",
		"1.2.3",
		"-x - -2 * 3",
		"y",
	}, "\n")
	stdout, stderr, code := runScript(t, script)
	wantOut := "x = 6\n0\n"
	wantErr := "input.txt:2: division by zero\n" +
		"input.txt:3: undefined: tip\n" +
		"input.txt:4: unexpected end of line\n" +
		"input.txt:5: unexpected \"$\"\n" +
		"input.txt:6: unexpected \"=\"\n" +
		"input.txt:7: bad number \"1.2.3\"\n" +
		"input.txt:9: undefined: y\n"
	if stdout != wantOut || stderr != wantErr || code != 1 {
		t.Fatalf("run = %q, %q, exit %d; want %q, %q, exit 1", stdout, stderr, code, wantOut, wantErr)
	}
}

func TestMissingInputFails(t *testing.T) {
	t.Chdir(t.TempDir())
	stdout, stderr, code := capture(t)
	if stdout != "" || !strings.Contains(stderr, "input.txt") || code != 1 {
		t.Fatalf("run = %q, %q, exit %d; want only an error naming input.txt, exit 1", stdout, stderr, code)
	}
}

// Each line on its own, as exec runs it: what it prints, or why it fails.
func TestLines(t *testing.T) {
	for _, tt := range []struct{ line, want, err string }{
		{line: "2 + 3 * 4", want: "14"},
		{line: "(2 + 3) * 4", want: "20"},
		{line: "8 - 2 - 1", want: "5"},
		{line: "16 / 4 / 2", want: "2"},
		{line: "-2 * -(1 + 2)", want: "6"},
		{line: "0.1 + 0.2 # rounded", want: "0.3"},
		{line: "0 * -1", want: "0"},
		{line: "-0", want: "0"},
		{line: "let half = 1 / 2", want: "half = 0.5"},
		{line: "  # only a comment", want: ""},
		{line: "2 3", err: `unexpected "3"`},
		{line: "let let = 1", err: `unexpected "let"`},
		{line: "1 +", err: "unexpected end of line"},
		{line: "(1 + 2))", err: `unexpected ")"`},
		{line: ".", err: `bad number "."`},
	} {
		got, err := env{}.exec(tt.line)
		if got != tt.want || (err == nil) != (tt.err == "") || (err != nil && err.Error() != tt.err) {
			t.Errorf("exec(%q) = %q, %v; want %q, %q", tt.line, got, err, tt.want, tt.err)
		}
	}
}
