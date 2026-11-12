//nolint:testpackage // A main package can't be imported, so its tests run inside it, through main.

// basics' main, its whole output and its exit, as the playground shows them: main returns, so the
// program exits 0, and a call to os.Exit would end this test binary instead. The check runs this
// test on node's fs and on the runtime's in-memory fs (scripts/check-go.sh). Then the two helpers
// main passes function values to, on their own.
package main

import (
	"os"
	"path/filepath"
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

// output is what basics prints, every run.
const output = `Shapes:
  3x4 rectangle        area 12.00  perimeter 14.00
  circle of radius 2   area 12.57  perimeter 12.57
  square of side 2     area  4.00  perimeter  8.00

Scaled by 3: 3x6 rectangle

Largest by:
  area       circle of radius 2
  perimeter  3x4 rectangle

Area over 10: [3x4 rectangle circle of radius 2]

What each shape is:
  some other shape: 3x4 rectangle
  a circle, 4 across
  a square, its sides 2
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

func TestLargestTakesTheFirstOfATie(t *testing.T) {
	shapes := []Shape{NewSquare(2), Rect{Width: 1, Height: 4}, Rect{Width: 4, Height: 1}}
	if got := largest(shapes, Shape.Area); got != shapes[0] {
		t.Errorf("largest by area = %v; want the first of the tie, %v", got, shapes[0])
	}
	if got := largest(shapes, Shape.Perimeter); got != shapes[1] {
		t.Errorf("largest by perimeter = %v; want the first of the tie, %v", got, shapes[1])
	}
}

func TestKeepKeepsOrderAndMayKeepNone(t *testing.T) {
	shapes := []Shape{Circle{Radius: 1}, NewSquare(1), Circle{Radius: 3}}
	round := func(s Shape) bool { _, ok := s.(Circle); return ok }
	if got := keep(shapes, round); len(got) != 2 || got[0] != shapes[0] || got[1] != shapes[2] {
		t.Errorf("keep(round) = %v; want %v and %v, in order", got, shapes[0], shapes[2])
	}
	if got := keep(shapes, func(Shape) bool { return false }); len(got) != 0 {
		t.Errorf("keep(none) = %v; want none", got)
	}
}
