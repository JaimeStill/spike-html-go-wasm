// Command generics tours Go's generics: functions and types with type parameters, which the
// compiler checks once for every type they may be given. A constraint, an interface, limits a type
// parameter to the types that have what the function needs, such as + or <; Stack, in stack.go, is
// a generic type, a stack of any one type of value; and iterators, functions a for range calls
// with the loop's body, chain small generic steps over a sequence that never ends. It prints the
// same lines on every run.
package main

import (
	"cmp"
	"fmt"
	"iter"
	"slices"
	"strings"
)

// Number is a constraint: an interface that lists types rather than methods, so it can only limit
// a type parameter. The ~ admits every type whose underlying type is listed, Celsius among them.
type Number interface {
	~int | ~float64
}

// Celsius is a temperature: a named type whose underlying type is float64, so it's a Number.
type Celsius float64

// String makes a Celsius print with its unit.
func (c Celsius) String() string {
	return fmt.Sprintf("%gC", float64(c))
}

// Sum adds xs, whichever Number type they are; the constraint is what lets it use +.
func Sum[T Number](xs ...T) T {
	var total T
	for _, x := range xs {
		total += x
	}
	return total
}

// Largest answers the largest of its arguments, the first of any tie. cmp.Ordered, the standard
// library's constraint, admits every type that < works on, strings among them.
func Largest[T cmp.Ordered](first T, rest ...T) T {
	best := first
	for _, x := range rest {
		if x > best {
			best = x
		}
	}
	return best
}

func main() {
	// The compiler infers T from the arguments, or it can be given, as Sum[Celsius] is.
	fmt.Println("Sum:")
	fmt.Printf("  %-8s %v\n", "ints", Sum(1, 2, 3, 4))
	fmt.Printf("  %-8s %v\n", "floats", Sum(0.5, 0.25))
	fmt.Printf("  %-8s %v\n", "Celsius", Sum[Celsius](21.5, -3))

	fmt.Println("\nLargest:")
	fmt.Printf("  %-21s %v\n", "of 3, 9, 4", Largest(3, 9, 4))
	fmt.Printf("  %-21s %v\n", "of pear, apple, plum", Largest("pear", "apple", "plum"))

	// Stack[string] is the generic type given string: Push takes only strings, Pop answers them.
	var words Stack[string]
	for w := range strings.FieldsSeq("first in last out") {
		words.Push(w)
	}
	fmt.Println("\nA Stack[string]:")
	fmt.Print("  top down:")
	for w := range words.All() {
		fmt.Print(" ", w)
	}
	fmt.Println()
	top, _ := words.Pop()
	fmt.Printf("  popped %q, %d left\n", top, words.Len())

	// An empty Stack[int] answers int's zero value, and false.
	var numbers Stack[int]
	n, ok := numbers.Pop()
	fmt.Printf("  an empty Stack[int] pops %d, %t\n", n, ok)

	// Fibonacci never ends, so the loop over it does, with break.
	fmt.Println("\nIterators:")
	fmt.Print("  Fibonacci under 100:")
	for n := range Fibonacci() {
		if n >= 100 {
			break
		}
		fmt.Print(" ", n)
	}
	fmt.Println()

	// Each step takes a sequence and answers another, pulling one value at a time, so the chain
	// works over an endless sequence: Take stops it after five.
	even := func(n int) bool { return n%2 == 0 }
	label := func(n int) string { return fmt.Sprintf("#%d", n) }
	fmt.Println("  first five even, labelled:",
		slices.Collect(Take(Map(Filter(Fibonacci(), even), label), 5)))
}

// Fibonacci is an iterator over the Fibonacci numbers, 0, 1, 1, 2, and on without end, until the
// loop's body stops it: yield answers false once the body breaks, and Fibonacci returns.
func Fibonacci() iter.Seq[int] {
	return func(yield func(int) bool) {
		a, b := 0, 1
		for yield(a) {
			a, b = b, a+b
		}
	}
}

// Filter answers the values of seq that keep is true of, in their order.
func Filter[T any](seq iter.Seq[T], keep func(T) bool) iter.Seq[T] {
	return func(yield func(T) bool) {
		for v := range seq {
			if keep(v) && !yield(v) {
				return
			}
		}
	}
}

// Map answers f of each value of seq, in their order: two type parameters, since f may answer
// a type of its own.
func Map[T, U any](seq iter.Seq[T], f func(T) U) iter.Seq[U] {
	return func(yield func(U) bool) {
		for v := range seq {
			if !yield(f(v)) {
				return
			}
		}
	}
}

// Take answers the first n values of seq, then stops it.
func Take[T any](seq iter.Seq[T], n int) iter.Seq[T] {
	return func(yield func(T) bool) {
		if n <= 0 {
			return
		}
		i := 0
		for v := range seq {
			if !yield(v) {
				return
			}
			i++
			if i == n {
				return
			}
		}
	}
}
