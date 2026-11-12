// Command sqlate compiles the SQL files in its working directory with sqlate, for PostgreSQL,
// and prints each statement as the engine receives it: its name, its tier, its parameters in
// the order they bind, and its SQL with PostgreSQL's $n placeholders.
//
// The files' names say what each one is:
//
//   - <ns>.<name>.sql is a pattern, published in namespace ns. app.identity.sql is the pattern
//     a statement includes as {{> app.identity}}.
//   - Any other .sql file is a statement, named by its file: create.sql is the statement create.
//
// The statements compile against PostgreSQL's patterns, the library's sql namespace with
// {{> sql.guard_set}} and {{> sql.guard_where}} among them, plus one namespace for each ns the
// pattern files name. Add a file such as audit.stamp.sql and a statement can include
// {{> audit.stamp}}.
//
// Then it runs the statement edit, guarded by the statement version, over a scripted driver that
// input.json sets up; guard.go says how.
//
// If a pattern or a statement is wrong, a missing tier, an include nothing publishes, a native
// pattern in a standard statement, or a pattern in the library's own sql namespace, the program
// prints sqlate's message on stderr and exits 1.
package main

import (
	"fmt"
	"maps"
	"os"
	"slices"
	"strings"
	"testing/fstest"

	"github.com/standards-lab/sqlate/postgres"
	"github.com/standards-lab/sqlate/query"
)

func main() {
	os.Exit(run())
}

// run compiles the working directory's files and prints the statements to stdout, then runs the
// guarded edit, or prints why it can't to stderr, and answers the exit code.
func run() int {
	files, namespaces, err := read(".")
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}

	// The catalog every statement compiles against: PostgreSQL's spelling of the library's
	// patterns first, then each of the reader's namespaces, in name order.
	sources := []query.Source{postgres.Patterns()}
	for _, ns := range namespaces {
		sources = append(sources, query.Publish(ns, files, ns))
	}
	catalog, err := query.NewCatalog(sources...)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}

	statements, err := catalog.Compile(files, ".", postgres.Dialect{})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}

	// Statements answers them in name order.
	for i, st := range statements.Statements() {
		if i > 0 {
			fmt.Println()
		}
		fmt.Printf("-- %s: %s, %s\n%s\n", st.Name(), st.Tier(), parameters(st.Params()), st.Text())
	}
	return guarded(statements)
}

// read loads the .sql files in dir into one in-memory file system, laid out the way sqlate
// reads them: each statement stays at the top, where Compile reads a directory's .sql files,
// and each pattern moves into a directory named for its namespace, which Publish reads. It
// answers the namespaces the patterns name, sorted.
func read(dir string) (fstest.MapFS, []string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, nil, err
	}
	files := fstest.MapFS{}
	namespaces := map[string]bool{}
	for _, e := range entries {
		base, isSQL := strings.CutSuffix(e.Name(), ".sql")
		if e.IsDir() || !isSQL {
			continue
		}
		text, err := os.ReadFile(dir + "/" + e.Name())
		if err != nil {
			return nil, nil, err
		}
		file := &fstest.MapFile{Data: text}
		// app.identity.sql is the pattern identity in namespace app; create.sql is a statement.
		if ns, name, isPattern := strings.Cut(base, "."); isPattern {
			files[ns+"/"+name+".sql"] = file
			namespaces[ns] = true
		} else {
			files[e.Name()] = file
		}
	}
	return files, slices.Sorted(maps.Keys(namespaces)), nil
}

// parameters lists a statement's parameters by their placeholders: $1 code, $2 name.
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
