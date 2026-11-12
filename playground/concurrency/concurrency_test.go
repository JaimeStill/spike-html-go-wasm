//nolint:testpackage // A main package can't be imported, so its tests run inside it, through main.

// concurrency's main, its whole output and its exit, as the playground shows them: main returns,
// so the program exits 0, and a call to os.Exit would end this test binary instead. Its goroutines
// may take their turns in any order, so it runs several times, each printing the same lines. The
// check runs this test on node's fs and on the runtime's in-memory fs (scripts/check-go.sh), where
// GOMAXPROCS is 1, as in the browser. Then tally and the pipeline's stages on their own: each
// channel closed, nothing lost, and the results in order.
package main

import (
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"testing"
)

// capture calls main with os.Stdout and os.Stderr each a file of its own, answering what main
// wrote to each. Files, since js/wasm has no os.Pipe.
func capture(t *testing.T) (stdout, stderr string) {
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
	main()
	read := func(name string) string {
		text, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			t.Fatalf("read %s: %v", name, err)
		}
		return string(text)
	}
	return read("stdout"), read("stderr")
}

// output is what concurrency prints, every run.
const output = `Goroutines, one per word, then Wait:
  goroutine  9 letters
  channel    7 letters
  select     6 letters
  pipeline   8 letters

Channels, taking turns:
  sent 1, got back 2
  sent 2, got back 4
  sent 3, got back 6

Select:
  nothing ready, so the default case ran
  nothing came within 10ms, so the timeout case ran
  from evens: 4 values, sum 20
  from odds:  3 values, sum 9

A pipeline, squared by three workers:
   1 squared is   1
   2 squared is   4
   3 squared is   9
   4 squared is  16
   5 squared is  25
   6 squared is  36
   7 squared is  49
   8 squared is  64
   9 squared is  81
  10 squared is 100
  total 385
`

func TestGOMAXPROCSIsOneUnderJS(t *testing.T) {
	if runtime.GOOS != "js" {
		t.Skip("the doc comment's claim is about GOOS=js")
	}
	if got := runtime.GOMAXPROCS(0); got != 1 {
		t.Fatalf("GOMAXPROCS = %d; want 1", got)
	}
}

func TestMainPrintsTheTourAndExitsZero(t *testing.T) {
	stdout, stderr := capture(t)
	if stdout != output || stderr != "" {
		t.Fatalf("main printed %q, %q; want %q and no stderr", stdout, stderr, output)
	}
	// The same lines again, whatever turns the goroutines take.
	for run := range 5 {
		if again, _ := capture(t); again != output {
			t.Fatalf("run %d printed %q; want %q", run+2, again, output)
		}
	}
}

func TestTallyCountsEachChannelUntilBothClose(t *testing.T) {
	a, b := tally(generate(1, 2, 3), generate())
	if a != (count{3, 6}) || b != (count{0, 0}) {
		t.Fatalf("tally = %+v, %+v; want {3 6} and {0 0}", a, b)
	}
}

func TestThePipelineLosesNothingAndAnswersInOrder(t *testing.T) {
	got := collect(merge(square(generate(3, 1)), square(generate()), square(generate(2))))
	want := []result{{1, 1}, {2, 4}, {3, 9}}
	if !slices.Equal(got, want) {
		t.Fatalf("collect = %v; want %v", got, want)
	}
	if got := collect(merge()); len(got) != 0 {
		t.Fatalf("merging no channels = %v; want none, and a closed channel", got)
	}
}
