// Command basics tours four of Go's building blocks over a few shapes: structs, which hold a
// shape's sides; methods, which work out its area and perimeter; interfaces, which let one slice
// hold every kind of shape; and function values, which pass a measure or a test around like any
// other value. shapes.go declares the shapes, and this file puts them to work. It prints the same
// lines on every run.
package main

import "fmt"

func main() {
	// A slice of an interface type holds a value of any type that has the interface's methods.
	shapes := []Shape{Rect{Width: 3, Height: 4}, Circle{Radius: 2}, NewSquare(2)}

	fmt.Println("Shapes:")
	for _, s := range shapes {
		// %v calls String, since each shape is a fmt.Stringer as well as a Shape.
		fmt.Printf("  %-20v area %5.2f  perimeter %5.2f\n", s, s.Area(), s.Perimeter())
	}

	// A method with a pointer receiver changes the variable it's called on.
	r := Rect{Width: 1, Height: 2}
	r.Scale(3)
	fmt.Println("\nScaled by 3:", r)

	// Function values: a method expression, such as Shape.Area, is a function whose first argument
	// is the receiver, so a measure can be stored in a struct and passed to largest.
	measures := []struct {
		name string
		of   func(Shape) float64
	}{
		{"area", Shape.Area},
		{"perimeter", Shape.Perimeter},
	}
	fmt.Println("\nLargest by:")
	for _, m := range measures {
		fmt.Printf("  %-10s %v\n", m.name, largest(shapes, m.of))
	}

	// A function literal is a closure: it can use the variables around it, here limit.
	limit := 10.0
	big := keep(shapes, func(s Shape) bool { return s.Area() > limit })
	fmt.Printf("\nArea over %g: %v\n", limit, big)

	// A type switch asks which concrete type an interface value holds.
	fmt.Println("\nWhat each shape is:")
	for _, s := range shapes {
		switch s := s.(type) {
		case Circle:
			fmt.Printf("  a circle, %g across\n", 2*s.Radius)
		case Square:
			fmt.Printf("  a square, its sides %g\n", s.Width)
		default:
			fmt.Printf("  some other shape: %v\n", s)
		}
	}
}

// largest answers the shape that measure finds the largest, the first of any tie.
func largest(shapes []Shape, measure func(Shape) float64) Shape {
	best := shapes[0]
	for _, s := range shapes[1:] {
		if measure(s) > measure(best) {
			best = s
		}
	}
	return best
}

// keep answers the shapes that test is true of, in their order.
func keep(shapes []Shape, test func(Shape) bool) []Shape {
	var kept []Shape
	for _, s := range shapes {
		if test(s) {
			kept = append(kept, s)
		}
	}
	return kept
}
