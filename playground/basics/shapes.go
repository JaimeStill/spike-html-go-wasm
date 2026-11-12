package main

import (
	"fmt"
	"math"
)

// A Shape is anything with an area and a perimeter. An interface lists methods, and a type with
// those methods satisfies it, with nothing declaring that it does: Rect, Circle, and Square all do.
type Shape interface {
	Area() float64
	Perimeter() float64
}

// A Rect is a rectangle: a struct, its fields its two sides.
type Rect struct {
	Width, Height float64
}

// Area is a method: a function with a receiver, here a copy of the Rect it's called on.
func (r Rect) Area() float64 {
	return r.Width * r.Height
}

// Perimeter is the distance around the rectangle.
func (r Rect) Perimeter() float64 {
	return 2 * (r.Width + r.Height)
}

// String makes a Rect a fmt.Stringer, another interface, so fmt prints a Rect this way.
func (r Rect) String() string {
	return fmt.Sprintf("%gx%g rectangle", r.Width, r.Height)
}

// Scale grows the rectangle by factor. Its receiver is a pointer, so it changes the Rect it's
// called on, not a copy; called on a variable, Go takes the variable's address for you.
func (r *Rect) Scale(factor float64) {
	r.Width *= factor
	r.Height *= factor
}

// A Circle is a circle, by its radius.
type Circle struct {
	Radius float64
}

// Area is pi times the radius squared.
func (c Circle) Area() float64 {
	return math.Pi * c.Radius * c.Radius
}

// Perimeter is the circumference, two pi times the radius.
func (c Circle) Perimeter() float64 {
	return 2 * math.Pi * c.Radius
}

// String names the circle by its radius.
func (c Circle) String() string {
	return fmt.Sprintf("circle of radius %g", c.Radius)
}

// A Square is a rectangle whose sides are equal. It embeds a Rect, so the Rect's fields and
// methods are the Square's own: Width, Height, Area, Perimeter, and Scale, with no code here.
type Square struct {
	Rect
}

// NewSquare makes a square whose sides are side long.
func NewSquare(side float64) Square {
	return Square{Rect{Width: side, Height: side}}
}

// String names the square by its side. A method declared on Square itself takes the place of the
// embedded Rect's.
func (s Square) String() string {
	return fmt.Sprintf("square of side %g", s.Width)
}
