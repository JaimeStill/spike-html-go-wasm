package main

import (
	"errors"
	"fmt"
	"strconv"
)

// An env holds the values that let has bound so far, by name, for the lines after.
type env map[string]float64

// exec runs one line: it lexes, parses, and evaluates it, binds a let's name, and answers what
// the line prints, or "" for a line with nothing to run. A line that fails binds nothing.
func (e env) exec(line string) (string, error) {
	tokens, err := lex(line)
	if err != nil {
		return "", err
	}
	s, err := parse(tokens)
	if err != nil || s == nil {
		return "", err
	}
	value, err := e.eval(s.value)
	if err != nil {
		return "", err
	}
	if s.name == "" {
		return format(value), nil
	}
	e[s.name] = value
	return s.name + " = " + format(value), nil
}

// errDivisionByZero is the error for dividing by zero, which would otherwise give an infinity.
var errDivisionByZero = errors.New("division by zero")

// eval works out an expression's value, its smaller expressions first.
func (e env) eval(x expr) (float64, error) {
	switch x := x.(type) {
	case literal:
		return float64(x), nil
	case variable:
		value, ok := e[string(x)]
		if !ok {
			return 0, fmt.Errorf("undefined: %s", x)
		}
		return value, nil
	case negation:
		value, err := e.eval(x.operand)
		return -value, err
	case binary:
		left, err := e.eval(x.left)
		if err != nil {
			return 0, err
		}
		right, err := e.eval(x.right)
		if err != nil {
			return 0, err
		}
		switch x.op {
		case "+":
			return left + right, nil
		case "-":
			return left - right, nil
		case "*":
			return left * right, nil
		case "/":
			if right == 0 {
				return 0, errDivisionByZero
			}
			return left / right, nil
		}
	}
	panic(fmt.Sprintf("eval: no rule for %#v", x))
}

// format writes a value to 12 significant digits, enough to hide floating point's last-digit
// noise, so 0.1 + 0.2 prints 0.3.
func format(value float64) string {
	return strconv.FormatFloat(value, 'g', 12, 64)
}
