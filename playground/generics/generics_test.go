//nolint:testpackage // A main package can't be imported, so its tests run inside it, through main.

// generics' main, its whole output and its exit, as the playground shows them: main returns, so
// the program exits 0, and a call to os.Exit would end this test binary instead. The check runs
// this test on node's fs and on the runtime's in-memory fs (scripts/check-go.sh). Then the
// generic functions, the Stack, and the iterators on their own: a single argument, an empty stack, and each
// iterator stopping when the loop over it does.
package main

import (
	"os"
	"path/filepath"
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

// output is what generics prints, every run.
const output = `Sum:
  ints     10
  floats   0.75
  Celsius  18.5C

Largest:
  of 3, 9, 4            9
  of pear, apple, plum  plum

A Stack[string]:
  top down: out last in first
  popped "out", 3 left
  an empty Stack[int] pops 0, false

Iterators:
  Fibonacci under 100: 0 1 1 2 3 5 8 13 21 34 55 89
  first five even, labelled: [#0 #2 #8 #34 #144]
`

func TestMainPrintsTheTourAndExitsZero(t *testing.T) {
	stdout, stderr := capture(t)
	if stdout != output || stderr != "" {
		t.Fatalf("main printed %q, %q; want %q and no stderr", stdout, stderr, output)
	}
	// The same lines again: nothing in the tour depends on the run.
	if again, _ := capture(t); again != output {
		t.Fatalf("a second run printed %q; want %q", again, output)
	}
}

func TestLargestOfAnyOrderedType(t *testing.T) {
	if got := Largest(Celsius(-3), Celsius(-1.5), Celsius(-2)); got != -1.5 {
		t.Errorf("Largest(-3C, -1.5C, -2C) = %v; want -1.5C", got)
	}
	if got := Largest("b", "a", "b"); got != "b" {
		t.Errorf(`Largest("b", "a", "b") = %q; want "b"`, got)
	}
	if got := Largest(7); got != 7 {
		t.Errorf("Largest(7) = %d; want 7", got)
	}
}

func TestStackPopsLastInFirstAndEmptyAnswersTheZeroValue(t *testing.T) {
	var s Stack[int]
	for i := range 3 {
		s.Push(i)
	}
	if got := slices.Collect(s.All()); !slices.Equal(got, []int{2, 1, 0}) || s.Len() != 3 {
		t.Fatalf("All = %v, Len = %d; want [2 1 0] and 3, nothing popped", got, s.Len())
	}
	for want := 2; want >= 0; want-- {
		if got, ok := s.Pop(); got != want || !ok {
			t.Fatalf("Pop = %d, %t; want %d, true", got, ok, want)
		}
	}
	if got, ok := s.Pop(); got != 0 || ok {
		t.Fatalf("Pop on empty = %d, %t; want 0, false", got, ok)
	}
}

func TestIteratorsStopWhenTheLoopDoes(t *testing.T) {
	var s Stack[string]
	s.Push("a")
	s.Push("b")
	for v := range s.All() {
		if v != "b" {
			t.Fatalf("All's first value %q; want the top, b", v)
		}
		break
	}
	if got := slices.Collect(Take(Fibonacci(), 0)); len(got) != 0 {
		t.Errorf("Take(0) = %v; want none", got)
	}
	odd := func(n int) bool { return n%2 == 1 }
	double := func(n int) int { return 2 * n }
	if got := slices.Collect(Take(Map(Filter(Fibonacci(), odd), double), 4)); !slices.Equal(
		got, []int{2, 2, 6, 10}) {
		t.Errorf("the first four odd Fibonacci numbers doubled = %v; want [2 2 6 10]", got)
	}
}
