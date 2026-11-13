//nolint:testpackage // A main package can't be imported, so its tests run inside it, through run.

// graph's run over the service wire describes, its whole output and its exit, as a page shows
// them: the layer table, then each participant's start in layer order and its stop in reverse,
// with exit 0, the same every run; a constructor that returns an error, substituted by graph's
// Replace, printing graph's message naming the node on one stderr line, nothing on stdout, and
// exit 1; and a route that uses the server, which is ordered after the routes, making Build panic
// with graph's message naming the cycle's path, which Go prints as the program's panic, exit 2.
// The check runs these tests on node's fs and on the runtime's in-memory fs (scripts/check-go.sh).
// Then wire's handles, each named for its node.
package main

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/standards-lab/go-core/graph"
	"github.com/standards-lab/go-core/graph/graphtest"
)

// capture calls run on g and s with os.Stdout and os.Stderr each a file of its own, answering
// what run wrote to each and its exit code. Files, since js/wasm has no os.Pipe.
func capture(t *testing.T, g *graph.Graph, s *Service) (stdout, stderr string, code int) {
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
	code = run(g, s)
	read := func(name string) string {
		text, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			t.Fatalf("read %s: %v", name, err)
		}
		return string(text)
	}
	return read("stdout"), read("stderr"), code
}

// output is what graph prints for the service wire describes, every run.
const output = `0: settings, router
1: store
2: health, projects
3: server

start store: postgres://db/app
start server: :8080 GET /healthz, GET /projects
ready
stop server
stop store
`

func TestServicePrintsItsLayersStartsAndStopsAndExitsZero(t *testing.T) {
	for range 2 {
		g, s := wire()
		stdout, stderr, code := capture(t, g, s)
		if stdout != output || stderr != "" || code != 0 {
			t.Fatalf("run = %q, %q, exit %d; want %q, no stderr, exit 0", stdout, stderr, code, output)
		}
	}
}

// The store's constructor failing fails the Build before anything starts: graph's message, which
// names the node and wraps the error, on one stderr line, and nothing on stdout.
func TestFailingConstructorPrintsGraphsMessageAndExitsOne(t *testing.T) {
	g, s := wire()
	g.Replace(s.Store, func(*graph.Scope) (*Store, error) {
		return nil, errors.New("connection refused")
	})
	stdout, stderr, code := capture(t, g, s)
	want := "store: connection refused\n"
	if stdout != "" || stderr != want || code != 1 {
		t.Fatalf("run = %q, %q, exit %d; want only %q, exit 1", stdout, stderr, code, want)
	}
}

// A route that uses the server closes a cycle, since the server is ordered after every route:
// Build panics with graph's message, a string, which Go prints as "panic: " and the message, with
// exit 2, since run doesn't recover it. Recovered here, since the panic would end the test binary.
func TestCycleMakesBuildPanicNamingItsPath(t *testing.T) {
	g, s := wire()
	g.Define("status", func(sc *graph.Scope) (string, error) {
		sc.Use(s.Server)
		return "GET /status", nil
	}, graph.In(s.Routes))
	defer func() {
		want := "graph: dependency cycle: server -> routes -> status -> server"
		if got, _ := recover().(string); got != want {
			t.Fatalf("run panicked with %q; want %q", got, want)
		}
	}()
	capture(t, g, s)
	t.Fatal("run returned; want a panic")
}

func TestServiceHandlesAreNamedForTheirNodes(t *testing.T) {
	_, s := wire()
	graphtest.CheckNames(t, s)
}
