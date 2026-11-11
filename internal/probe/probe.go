//go:build js && wasm

// Package probe is the probe scenario's composition root: the handlers that prove the runtime,
// served through the bridge on one long-lived instance. It imports only the standard library and
// the bridge, and stays on the site as a bridge-sized baseline.
package probe

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/JaimeStill/spike-html-go-wasm/bridge"
)

// Serve serves the probe's handlers, printing to standard output, and never returns.
func Serve() {
	bridge.Serve(Handlers(os.Stdout))
}

// Handlers is the probe's handlers by name, each printing its one line to stdout. spin and crash
// never answer: spin ends only when the runtime stops its instance, and crash ends the instance.
func Handlers(stdout io.Writer) map[string]bridge.Handler {
	return map[string]bridge.Handler{
		"crash":  func(input string) (any, error) { return crash(stdout, input) },
		"files":  func(input string) (any, error) { return files(stdout, input) },
		"format": func(input string) (any, error) { return format(stdout, input) },
		"spin":   func(string) (any, error) { return spin(stdout) },
	}
}

// spin prints one line, then loops without yielding and never returns. Under GOOS=js GOMAXPROCS
// is 1 and nothing preempts a goroutine, so the loop holds the instance's one thread, and with it
// the worker's event loop: no later call, timer, or message runs, and only terminating the worker
// ends it (the runtime's Stop).
func spin(stdout io.Writer) (any, error) {
	_, _ = fmt.Fprintln(stdout, "spin: looping until Stop")
	// A counter, not an empty for {}, which staticcheck flags (SA5002); nothing reads it.
	for n := uint64(0); ; n++ {
	}
}

// crash prints one line, then panics in a new goroutine, outside any handler's recover, naming
// input, and waits there for good. The Go runtime prints the panic to fd 2 through wasm_exec.js's
// writeSync and exits with code 2, which fails the call still waiting; the instance is gone, and
// the next call starts another.
func crash(stdout io.Writer, input string) (any, error) {
	_, _ = fmt.Fprintln(stdout, "crash: panicking outside any handler")
	go func() { panic("probe: crash: " + input) }()
	select {}
}

// format answers input, JSON text, indented by two spaces, or its parse error; it prints one line
// naming the sizes in and out.
func format(stdout io.Writer, input string) (any, error) {
	var out bytes.Buffer
	if err := json.Indent(&out, []byte(input), "", "  "); err != nil {
		return nil, fmt.Errorf("format: %w", err)
	}
	_, _ = fmt.Fprintf(stdout, "format: %d bytes in, %d bytes out\n", len(input), out.Len())
	return out.String(), nil
}

// FilesResult is the files handler's answer: the temporary directory it worked in, and each step
// it took there, in order.
type FilesResult struct {
	Dir   string `json:"dir"`
	Steps []Step `json:"steps"`
}

// Step is one file operation the files handler took and what it saw: the bytes a write or read
// moved, the text read back, and the entries a list found.
type Step struct {
	Op      string  `json:"op"`
	Path    string  `json:"path,omitempty"`
	Bytes   int     `json:"bytes,omitempty"`
	Text    string  `json:"text,omitempty"`
	Entries []Entry `json:"entries,omitempty"`
}

// Entry is one directory entry a list step found: its name, its kind, file or dir, and a file's
// size, omitted for a directory, whose size differs between filesystems.
type Entry struct {
	Name string `json:"name"`
	Kind string `json:"kind"`
	Size int64  `json:"size,omitempty"`
}

// files works through package os in a fresh temporary directory: it writes input to input.txt
// and its length to notes/length.txt, lists the directory, reads input.txt back, which must
// match, and removes the directory, which must then be gone. It answers each step, or the first
// step's error, and prints one line.
func files(stdout io.Writer, input string) (any, error) {
	dir, err := os.MkdirTemp("", "probe-files-*")
	if err != nil {
		return nil, fmt.Errorf("files: mkdirtemp: %w", err)
	}
	result := FilesResult{Dir: dir, Steps: []Step{{Op: "mkdirtemp", Path: dir}}}
	// The deferred RemoveAll cleans up after a failed step; after the remove step it finds
	// nothing.
	defer func() { _ = os.RemoveAll(dir) }()

	writes := []struct{ name, text string }{
		{"input.txt", input},
		{filepath.Join("notes", "length.txt"), fmt.Sprint(len(input))},
	}
	for _, w := range writes {
		path := filepath.Join(dir, w.name)
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			return nil, fmt.Errorf("files: mkdir: %w", err)
		}
		if err := os.WriteFile(path, []byte(w.text), 0o644); err != nil {
			return nil, fmt.Errorf("files: write: %w", err)
		}
		result.Steps = append(result.Steps, Step{Op: "write", Path: w.name, Bytes: len(w.text)})
	}

	list := Step{Op: "list", Path: "."}
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("files: list: %w", err)
	}
	for _, e := range entries {
		if e.IsDir() {
			list.Entries = append(list.Entries, Entry{Name: e.Name(), Kind: "dir"})
			continue
		}
		info, err := e.Info()
		if err != nil {
			return nil, fmt.Errorf("files: list: %w", err)
		}
		list.Entries = append(list.Entries, Entry{Name: e.Name(), Kind: "file", Size: info.Size()})
	}
	result.Steps = append(result.Steps, list)

	read, err := os.ReadFile(filepath.Join(dir, "input.txt"))
	if err != nil {
		return nil, fmt.Errorf("files: read: %w", err)
	}
	if string(read) != input {
		return nil, fmt.Errorf("files: read: input.txt holds %q, wrote %q", read, input)
	}
	result.Steps = append(result.Steps,
		Step{Op: "read", Path: "input.txt", Bytes: len(read), Text: string(read)})

	if err := os.RemoveAll(dir); err != nil {
		return nil, fmt.Errorf("files: remove: %w", err)
	}
	if _, err := os.Stat(dir); !errors.Is(err, fs.ErrNotExist) {
		return nil, fmt.Errorf("files: remove: %s remains: %v", dir, err)
	}
	result.Steps = append(result.Steps, Step{Op: "remove", Path: dir})

	_, _ = fmt.Fprintf(stdout, "files: %d steps in %s\n", len(result.Steps), dir)
	return result, nil
}
