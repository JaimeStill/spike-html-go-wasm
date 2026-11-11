//go:build js && wasm

// The probe's handlers called as the bridge calls them, each with its stdout captured. The check
// runs them on node's fs and on the runtime's in-memory fs (scripts/check-go.sh).
package probe_test

import (
	"encoding/json"
	"errors"
	"io/fs"
	"os"
	"strings"
	"testing"

	"github.com/JaimeStill/spike-html-go-wasm/internal/probe"
)

func TestFormatIndentsJSON(t *testing.T) {
	var stdout strings.Builder
	got, err := probe.Handlers(&stdout)["format"](`{"a":[1,2],"b":{}}`)
	if err != nil {
		t.Fatalf("format rejected: %v", err)
	}
	want := "{\n  \"a\": [\n    1,\n    2\n  ],\n  \"b\": {}\n}"
	if got != want {
		t.Fatalf("format = %q, want %q", got, want)
	}
	if line := "format: 18 bytes in, 40 bytes out\n"; stdout.String() != line {
		t.Fatalf("stdout = %q, want %q", stdout.String(), line)
	}
}

func TestFormatRejectsInvalidJSON(t *testing.T) {
	var stdout strings.Builder
	got, err := probe.Handlers(&stdout)["format"](`{"a":`)
	if err == nil {
		t.Fatalf("format resolved %v, want a parse error", got)
	}
	if want := "format: unexpected end of JSON input"; err.Error() != want {
		t.Fatalf("format rejected with %q, want %q", err.Error(), want)
	}
	if stdout.Len() != 0 {
		t.Fatalf("stdout = %q, want nothing", stdout.String())
	}
}

func TestFilesWritesListsReadsAndRemoves(t *testing.T) {
	var stdout strings.Builder
	got, err := probe.Handlers(&stdout)["files"]("hello, files")
	if err != nil {
		t.Fatalf("files rejected: %v", err)
	}
	result, ok := got.(probe.FilesResult)
	if !ok {
		t.Fatalf("files = %T, want probe.FilesResult", got)
	}
	if !strings.HasPrefix(result.Dir, os.TempDir()+"/probe-files-") {
		t.Fatalf("dir = %q, want a probe-files-* directory in %s", result.Dir, os.TempDir())
	}
	steps, err := json.Marshal(result.Steps)
	if err != nil {
		t.Fatalf("marshal steps: %v", err)
	}
	want := `[{"op":"mkdirtemp","path":"` + result.Dir + `"},` +
		`{"op":"write","path":"input.txt","bytes":12},` +
		`{"op":"write","path":"notes/length.txt","bytes":2},` +
		`{"op":"list","path":".","entries":` +
		`[{"name":"input.txt","kind":"file","size":12},{"name":"notes","kind":"dir"}]},` +
		`{"op":"read","path":"input.txt","bytes":12,"text":"hello, files"},` +
		`{"op":"remove","path":"` + result.Dir + `"}]`
	if string(steps) != want {
		t.Fatalf("steps =\n%s\nwant\n%s", steps, want)
	}
	if _, err := os.Stat(result.Dir); !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("Stat(%s) after files = %v, want ErrNotExist", result.Dir, err)
	}
	if line := "files: 6 steps in " + result.Dir + "\n"; stdout.String() != line {
		t.Fatalf("stdout = %q, want %q", stdout.String(), line)
	}
}

func TestFilesRejectsWithoutATempDir(t *testing.T) {
	t.Setenv("TMPDIR", "/nonexistent-probe-tmp")
	var stdout strings.Builder
	got, err := probe.Handlers(&stdout)["files"]("x")
	if err == nil {
		t.Fatalf("files resolved %v, want a mkdirtemp error", got)
	}
	if !strings.HasPrefix(err.Error(), "files: mkdirtemp: ") || !errors.Is(err, fs.ErrNotExist) {
		t.Fatalf("files rejected with %v, want files: mkdirtemp: and ErrNotExist", err)
	}
	if stdout.Len() != 0 {
		t.Fatalf("stdout = %q, want nothing", stdout.String())
	}
}
