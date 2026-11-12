// Command stdlib prints release notes for the commits listed in input.json, using only the
// standard library: encoding/json decodes the file, regexp takes each commit message apart,
// slices sorts and groups what it finds, and text/template lays out the report.
//
// A message in the conventional form, type(scope): subject, such as
// fix(lexer): accept a leading dot (#12), goes under its type's heading: Features for feat,
// Fixes for fix, and Other for any other type. A message in any other form is listed on its own.
// Each #<number> in a message is an issue it references.
//
// If input.json is missing, or isn't the JSON stdlib expects, the program prints one line on
// stderr saying why, with the line and column of a JSON error, and exits 1.
package main

import (
	"bytes"
	"cmp"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"regexp"
	"slices"
	"strconv"
	"text/template"
)

// input is the file stdlib reads, from the working directory.
const input = "input.json"

// Log is input.json's shape. A field the JSON doesn't name stays its zero value, and a key no
// field names is skipped.
type Log struct {
	Project string   `json:"project"`
	Version string   `json:"version"`
	Commits []Commit `json:"commits"`
}

// Commit is one entry of the log's commits.
type Commit struct {
	Hash    string `json:"hash"`
	Author  string `json:"author"`
	Message string `json:"message"`
}

func main() {
	os.Exit(run())
}

// run reads and decodes input.json and prints its report to stdout, or one line on stderr saying
// why it can't, and answers the exit code.
func run() int {
	src, err := os.ReadFile(input)
	if errors.Is(err, fs.ErrNotExist) {
		fmt.Fprintf(os.Stderr, "%s: no such file in the working directory\n", input)
		return 1
	}
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	var log Log
	if err := json.Unmarshal(src, &log); err != nil {
		fmt.Fprintln(os.Stderr, describe(src, err))
		return 1
	}
	if err := report.Execute(os.Stdout, notes(log)); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	return 0
}

// describe says what's wrong with src, which json.Unmarshal refused with err. errors.As finds the
// error's concrete type, even were it wrapped: a SyntaxError, where src isn't JSON, or an
// UnmarshalTypeError, where a value's JSON type doesn't fit its field. Each carries the offset in
// src where the decoder stopped, just past the byte it couldn't take or the value that didn't fit,
// so the line and column given are those of the last byte it read.
func describe(src []byte, err error) string {
	var syntax *json.SyntaxError
	var mistyped *json.UnmarshalTypeError
	switch {
	case errors.As(err, &syntax):
		return fmt.Sprintf("%s:%s: syntax error: %v", input, position(src, syntax.Offset-1), syntax)
	case errors.As(err, &mistyped):
		return fmt.Sprintf("%s:%s: %s is a JSON %s, not a Go %s",
			input, position(src, mistyped.Offset-1), cmp.Or(mistyped.Field, "the whole file"), mistyped.Value, mistyped.Type)
	default:
		return fmt.Sprintf("%s: %v", input, err)
	}
}

// position gives the byte at offset in src as line:column, each counted from 1, the column in
// bytes. An offset outside src is held to its ends.
func position(src []byte, offset int64) string {
	before := src[:min(max(offset, 0), int64(len(src)))]
	line := bytes.Count(before, []byte("\n")) + 1
	column := len(before) - bytes.LastIndexByte(before, '\n')
	return fmt.Sprintf("%d:%d", line, column)
}

var (
	// conventional matches a message in the form type(scope): subject, its scope optional.
	conventional = regexp.MustCompile(`^(\w+)(?:\(([\w-]+)\))?: (.+)$`)
	// issue matches a reference to an issue, #<number>.
	issue = regexp.MustCompile(`#(\d+)\b`)
)

// Notes is what the report shows.
type Notes struct {
	Project, Version string
	Commits          int
	Sections         []Section
	Unconventional   []Commit
	Authors          []Author
	Issues           []int
}

// Section is a heading's changes, sorted by scope.
type Section struct {
	Title   string
	Changes []Change
}

// Change is a conventional commit's scope and subject, and its hash.
type Change struct{ Scope, Subject, Hash string }

// Author is a commit author, with the number of commits they made.
type Author struct {
	Name    string
	Commits int
}

// kinds are the types with a heading of their own, in the report's order, before Other.
var kinds = []string{"feat", "fix"}

// notes works out the report from the log.
func notes(log Log) Notes {
	sections := []Section{{Title: "Features"}, {Title: "Fixes"}, {Title: "Other"}}
	n := Notes{Project: log.Project, Version: log.Version, Commits: len(log.Commits)}
	for _, c := range log.Commits {
		if m := conventional.FindStringSubmatch(c.Message); m != nil {
			// A type with no heading of its own is Other's, the last.
			kind := slices.Index(kinds, m[1])
			if kind < 0 {
				kind = len(kinds)
			}
			sections[kind].Changes = append(sections[kind].Changes, Change{m[2], m[3], c.Hash})
		} else {
			n.Unconventional = append(n.Unconventional, c)
		}
		for _, ref := range issue.FindAllStringSubmatch(c.Message, -1) {
			if number, err := strconv.Atoi(ref[1]); err == nil {
				n.Issues = append(n.Issues, number)
			}
		}
		if at := slices.IndexFunc(n.Authors, func(a Author) bool { return a.Name == c.Author }); at >= 0 {
			n.Authors[at].Commits++
		} else {
			n.Authors = append(n.Authors, Author{c.Author, 1})
		}
	}
	// Stable sorts, so changes in one scope, and authors with as many commits, keep the log's order.
	for _, s := range sections {
		slices.SortStableFunc(s.Changes, func(a, b Change) int { return cmp.Compare(a.Scope, b.Scope) })
	}
	n.Sections = slices.DeleteFunc(sections, func(s Section) bool { return len(s.Changes) == 0 })
	slices.SortStableFunc(n.Authors, func(a, b Author) int { return cmp.Compare(b.Commits, a.Commits) })
	slices.Sort(n.Issues)
	n.Issues = slices.Compact(n.Issues)
	return n
}

// report lays out Notes. Each action that ends with -}} trims the newline after it, so the
// template's lines are the report's.
var report = template.Must(template.New("report").Parse(
	`{{.Project}} {{.Version}}: {{.Commits}} commits by {{len .Authors}} authors
{{range .Sections}}
{{.Title}}:
{{range .Changes -}}
{{"  "}}{{.Hash}}  {{printf "%-8s" (or .Scope "-")}}{{.Subject}}
{{end -}}
{{end -}}
{{with .Unconventional}}
Not in the conventional form:
{{range . -}}
{{"  "}}{{.Hash}}  {{printf "%q" .Message}}
{{end -}}
{{end}}
By author, most commits first:
{{range .Authors -}}
{{"  "}}{{printf "%-6s" .Name}}{{.Commits}}
{{end}}
Issues referenced: {{range $i, $n := .Issues}}{{if $i}}, {{end}}#{{$n}}{{else}}none{{end}}
`))
