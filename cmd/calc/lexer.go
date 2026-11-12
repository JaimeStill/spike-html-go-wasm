package main

import (
	"fmt"
	"strconv"
	"strings"
	"unicode"
)

// A kind says what sort of token a token is.
type kind int

const (
	number   kind = iota // 4.25
	name                 // subtotal
	keyword              // let
	operator             // + - * / ( ) =
	end                  // the end of the line, after the last token
)

// A token is one word of a line: its kind, its text as written, and a number's value.
type token struct {
	kind  kind
	text  string
	value float64
}

// operators are the characters that stand alone as tokens.
const operators = "+-*/()="

// lex splits a line into its tokens, the last one always end. Spaces only separate tokens, and a
// # ends the line: everything after it is a comment.
func lex(line string) ([]token, error) {
	var tokens []token
	chars := []rune(line)
	for i := 0; i < len(chars); {
		c, start := chars[i], i
		switch {
		case c == '#':
			i = len(chars)
		case unicode.IsSpace(c):
			i++
		case unicode.IsDigit(c) || c == '.':
			for i < len(chars) && (unicode.IsDigit(chars[i]) || chars[i] == '.') {
				i++
			}
			text := string(chars[start:i])
			value, err := strconv.ParseFloat(text, 64)
			if err != nil {
				return nil, fmt.Errorf("bad number %q", text)
			}
			tokens = append(tokens, token{kind: number, text: text, value: value})
		case unicode.IsLetter(c) || c == '_':
			for i < len(chars) && (unicode.IsLetter(chars[i]) || unicode.IsDigit(chars[i]) || chars[i] == '_') {
				i++
			}
			t := token{kind: name, text: string(chars[start:i])}
			if t.text == "let" {
				t.kind = keyword
			}
			tokens = append(tokens, t)
		case strings.ContainsRune(operators, c):
			i++
			tokens = append(tokens, token{kind: operator, text: string(c)})
		default:
			return nil, fmt.Errorf("unexpected %q", c)
		}
	}
	return append(tokens, token{kind: end}), nil
}
