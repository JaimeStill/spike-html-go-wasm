// Command calc runs a tiny calculator language, one line at a time, over the script in input.txt.
//
// A line is an expression, such as (2 + 3) * 4, whose value it prints, or a binding,
// such as let rate = 0.07, which names a value for the lines after it and prints
// rate = 0.07. Numbers are decimal and may have a fraction; the operators are + - * /,
// with * and / binding tighter than + and -, a leading - to negate, and parentheses to
// group. A # starts a comment that runs to the end of the line.
//
// A line that fails prints input.txt:<line>: <reason> on stderr, and the run goes on with
// the next line. calc exits 1 if any line failed, and 0 otherwise.
//
// Each line goes through three steps, one file each: lexer.go splits it into tokens,
// parser.go builds a syntax tree from them, and eval.go works out its value.
package main

import (
	"fmt"
	"os"
	"strings"
)

// script is the file calc reads, from the working directory.
const script = "input.txt"

func main() {
	os.Exit(run())
}

// run runs the script, printing each line's result to stdout and each failure to stderr, and
// answers the exit code.
func run() int {
	src, err := os.ReadFile(script)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	vars := env{}
	code := 0
	for i, line := range strings.Split(string(src), "\n") {
		result, err := vars.exec(line)
		switch {
		case err != nil:
			fmt.Fprintf(os.Stderr, "%s:%d: %v\n", script, i+1, err)
			code = 1
		case result != "":
			fmt.Println(result)
		}
	}
	return code
}
