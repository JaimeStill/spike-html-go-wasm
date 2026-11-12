package main

import (
	"errors"
	"fmt"
	"strings"
)

// An expr is a node of a line's syntax tree: a literal, a variable, a negation, or a binary
// operation, each holding the smaller expressions it is made of.
type expr any

type (
	// A literal is a number as written, such as 4.25.
	literal float64
	// A variable is a name to look up, such as subtotal.
	variable string
	// A negation is a leading minus, such as -discount.
	negation struct{ operand expr }
	// A binary is an operation on two expressions, such as price * 3.
	binary struct {
		op          string
		left, right expr
	}
)

// A statement is one line's syntax tree: an expression to print, bound to a name first when the
// line starts with let.
type statement struct {
	name  string // the name a let binds, or "" for a plain expression
	value expr
}

// parse builds the statement a line's tokens spell, or nil for a line with none, by this grammar,
// one method each, so * and / bind tighter than + and -:
//
//	statement = [ "let" name "=" ] sum
//	sum       = product { ( "+" | "-" ) product }
//	product   = factor { ( "*" | "/" ) factor }
//	factor    = "-" factor | number | name | "(" sum ")"
func parse(tokens []token) (*statement, error) {
	p := &parser{tokens: tokens}
	if p.peek().kind == end {
		return nil, nil
	}
	var s statement
	if p.peek().kind == keyword {
		p.next()
		t := p.next()
		if t.kind != name {
			return nil, unexpected(t)
		}
		s.name = t.text
		if t := p.next(); t.text != "=" {
			return nil, unexpected(t)
		}
	}
	value, err := p.sum()
	if err != nil {
		return nil, err
	}
	if t := p.next(); t.kind != end {
		return nil, unexpected(t)
	}
	s.value = value
	return &s, nil
}

// A parser reads a line's tokens from first to last.
type parser struct {
	tokens []token
	pos    int
}

// peek answers the next token without reading it.
func (p *parser) peek() token {
	return p.tokens[p.pos]
}

// next reads the next token; past the last, it answers end again.
func (p *parser) next() token {
	t := p.tokens[p.pos]
	if t.kind != end {
		p.pos++
	}
	return t
}

// sum parses products joined by + and -.
func (p *parser) sum() (expr, error) { return p.chain("+-", p.product) }

// product parses factors joined by * and /.
func (p *parser) product() (expr, error) { return p.chain("*/", p.factor) }

// chain parses operands joined by any of ops, grouping from the left, so 8 - 2 - 1 is 5.
func (p *parser) chain(ops string, operand func() (expr, error)) (expr, error) {
	left, err := operand()
	if err != nil {
		return nil, err
	}
	for p.peek().kind == operator && strings.Contains(ops, p.peek().text) {
		op := p.next().text
		right, err := operand()
		if err != nil {
			return nil, err
		}
		left = binary{op, left, right}
	}
	return left, nil
}

// factor parses a negation, a number, a name, or a sum in parentheses.
func (p *parser) factor() (expr, error) {
	t := p.next()
	switch {
	case t.text == "-":
		operand, err := p.factor()
		if err != nil {
			return nil, err
		}
		return negation{operand}, nil
	case t.kind == number:
		return literal(t.value), nil
	case t.kind == name:
		return variable(t.text), nil
	case t.text == "(":
		inner, err := p.sum()
		if err != nil {
			return nil, err
		}
		if t := p.next(); t.text != ")" {
			return nil, unexpected(t)
		}
		return inner, nil
	}
	return nil, unexpected(t)
}

// unexpected is the error for a token the grammar has no place for.
func unexpected(t token) error {
	if t.kind == end {
		return errors.New("unexpected end of line")
	}
	return fmt.Errorf("unexpected %q", t.text)
}
