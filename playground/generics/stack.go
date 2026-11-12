package main

import (
	"iter"
	"slices"
)

// A Stack is a generic type: a last-in, first-out stack of values of one type, T, its type
// parameter. Stack[string] and Stack[int] are two types, each as if written out by hand, and the
// zero Stack of either is empty and ready to use.
type Stack[T any] struct {
	items []T
}

// Push puts v on top.
func (s *Stack[T]) Push(v T) {
	s.items = append(s.items, v)
}

// Pop takes the top value off and answers it and true, or T's zero value and false if the stack
// is empty.
func (s *Stack[T]) Pop() (T, bool) {
	if len(s.items) == 0 {
		var zero T
		return zero, false
	}
	top := s.items[len(s.items)-1]
	s.items = s.items[:len(s.items)-1]
	return top, true
}

// Len answers how many values the stack holds.
func (s *Stack[T]) Len() int {
	return len(s.items)
}

// All is an iterator over the stack's values from the top down, leaving them in place. A for
// range over it calls it with a yield function holding the loop's body; when the body breaks,
// yield answers false, and All returns. It ranges over slices.Backward, the standard library's
// own iterator over a slice from its end.
func (s *Stack[T]) All() iter.Seq[T] {
	return func(yield func(T) bool) {
		for _, v := range slices.Backward(s.items) {
			if !yield(v) {
				return
			}
		}
	}
}
