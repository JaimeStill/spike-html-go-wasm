//go:build js && wasm

// Package sqlate is the sqlate scenario's composition root: one handler, compile, served through
// the bridge on one long-lived instance, which compiles one statement with sqlate for PostgreSQL.
// It imports only the standard library, the bridge, and sqlate, and is the prebuilt half of the
// sqlate demos: a rendered Markdown page calls it with a statement a reader edits, where the
// sqlate page builds playground/sqlate, the whole program, in the page.
//
// A statement compiles against the catalog playground/sqlate builds from its shipped files:
// PostgreSQL's spelling of the library's patterns, then the sample app patterns, embedded here
// under patterns/<ns>/<name>.sql, the directory layout query.Publish reads, each byte for byte
// the program's playground/sqlate/<ns>.<name>.sql, which the unit tier holds
// (test/unit/sqlate-patterns.test.ts).
package sqlate

import (
	"embed"
	"fmt"
	"io"
	"io/fs"
	"os"
	"strings"
	"testing/fstest"

	"github.com/JaimeStill/spike-html-go-wasm/bridge"
	"github.com/standards-lab/sqlate/postgres"
	"github.com/standards-lab/sqlate/query"
)

// patterns is the sample app patterns, one directory a namespace.
//
//go:embed patterns
var patterns embed.FS

// statement is the name the compile handler gives the statement it is called with, the file it
// compiles it as, statement.sql, which sqlate's messages name.
const statement = "statement"

// Serve serves the scenario's handler, printing to standard output, and never returns.
func Serve() {
	bridge.Serve(Handlers(os.Stdout))
}

// Handlers is the scenario's handlers by name, compile alone, printing its one line to stdout.
// The catalog is built once, here, as a program builds it where it starts. A catalog that won't
// build is a defect in the embedded patterns, a wiring mistake, so it panics with sqlate's
// message, at startup, before any call.
func Handlers(stdout io.Writer) map[string]bridge.Handler {
	catalog, err := newCatalog()
	if err != nil {
		panic(fmt.Sprintf("sqlate: the embedded patterns: %v", err))
	}
	return map[string]bridge.Handler{
		"compile": func(input string) (any, error) { return compile(stdout, catalog, input) },
	}
}

// newCatalog is the catalog every statement compiles against: PostgreSQL's patterns first, then
// each embedded namespace, in name order, as playground/sqlate builds its own.
func newCatalog() (*query.Catalog, error) {
	root, err := fs.Sub(patterns, "patterns")
	if err != nil {
		return nil, err
	}
	// ReadDir answers the namespaces sorted by name.
	entries, err := fs.ReadDir(root, ".")
	if err != nil {
		return nil, err
	}
	sources := []query.Source{postgres.Patterns()}
	for _, e := range entries {
		if e.IsDir() {
			sources = append(sources, query.Publish(e.Name(), root, e.Name()))
		}
	}
	return query.NewCatalog(sources...)
}

// compile compiles input, one statement's text, as statement.sql, for PostgreSQL, and answers its
// SQL with $n placeholders, printing one line naming its tier and its parameters in the order
// they bind; or it rejects with sqlate's message, printing nothing.
func compile(stdout io.Writer, catalog *query.Catalog, input string) (any, error) {
	files := fstest.MapFS{statement + ".sql": {Data: []byte(input)}}
	statements, err := catalog.Compile(files, ".", postgres.Dialect{})
	if err != nil {
		return nil, err
	}
	st := statements.Statement(statement)
	_, _ = fmt.Fprintf(stdout, "compile: %s, %s\n", st.Tier(), parameters(st.Params()))
	return st.Text(), nil
}

// parameters lists a statement's parameters by their placeholders, as playground/sqlate prints
// them: $1 code, $2 name.
func parameters(names []string) string {
	if len(names) == 0 {
		return "no parameters"
	}
	listed := make([]string, len(names))
	for i, name := range names {
		listed[i] = fmt.Sprintf("$%d %s", i+1, name)
	}
	return "parameters " + strings.Join(listed, ", ")
}
