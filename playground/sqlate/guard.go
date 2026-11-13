package main

// The run: after the statements print, sqlate runs edit, guarded by version, the way a service
// edits a row it read earlier: the edit changes the row only at the version the caller read, and
// when it changes nothing, version tells a row someone else changed from no row at all.
//
// No database runs in the page. The statements run over sqlate's sqltest driver, which answers
// each call from a script and records it, with no socket. input.json says what the caller sends
// and what the row holds:
//
//   - id, code, and name are the edit's arguments.
//   - version is the version the caller read.
//   - stored is the version the row holds now, or null when there is no row.
//
// The script follows from stored. Equal to version, the edit affects one row and the run prints
// the new version. Another number, the edit affects no row, version reads stored back, and the
// run prints the version mismatch. null, the edit affects no row, version reads no row, and the
// run prints sql.ErrNoRows. Edit input.json and run again to see each.
//
// If edit.sql or version.sql is missing, or input.json is missing or isn't the JSON the run
// expects, the program prints why on stderr and exits 1.

import (
	"bytes"
	"context"
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"slices"
	"strings"
	"testing"

	"github.com/standards-lab/sqlate"
	"github.com/standards-lab/sqlate/postgres"
	"github.com/standards-lab/sqlate/query"
	"github.com/standards-lab/sqlate/sqltest"
)

// input is the file the run reads, from the working directory.
const input = "input.json"

// Input is input.json's shape. A field the JSON leaves out is its zero value, stored's null; a
// key no field names is an error, so a misspelled key fails rather than run with a zero.
type Input struct {
	ID      int64  `json:"id"`
	Code    string `json:"code"`
	Name    string `json:"name"`
	Version int64  `json:"version"`
	Stored  *int64 `json:"stored"`
}

// guarded runs edit, guarded by version, over a script input.json sets, and prints each call
// the driver received and the result, or prints why it can't on stderr, and answers the exit
// code.
func guarded(statements *query.Statements) int {
	in, err := readInput()
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	for _, name := range []string{"edit", "version"} {
		// Statement panics on a name the files don't hold, so look first.
		if !slices.ContainsFunc(statements.Statements(), func(st query.Statement) bool {
			return st.Name() == name
		}) {
			fmt.Fprintf(os.Stderr, "the run needs %s.sql, and there is none\n", name)
			return 1
		}
	}
	guard := statements.Statement("edit").Guarded(statements.Statement("version"), "version")

	// sqltest.Open is written for tests, so it takes a testing.TB, and a program has none: the
	// run passes it a stand-in that does what Open asks of one, and closes the pool at the end.
	stand := &standIn{}
	defer stand.cleanUp()
	pool, recorder := sqltest.Open(stand, script(in)...)
	db := sqlate.Wrap(pool, postgres.Dialect{})

	stored := "no row stored"
	if in.Stored != nil {
		stored = fmt.Sprintf("the row stored at version %d", *in.Stored)
	}
	fmt.Printf("\n-- run: edit guarded by version, version %d read; %s\n", in.Version, stored)

	args := query.Args{"id": in.ID, "code": in.Code, "name": in.Name}
	next, err := guard.Run(context.Background(), db, in.Version, args)

	for _, call := range recorder.Calls() {
		fmt.Printf("\n-- %s%s\n%s\n", call.Op, bound(call.Args), call.SQL)
	}
	switch {
	case err == nil:
		fmt.Printf("\n-- result: version %d\n", next)
	case errors.Is(err, query.ErrVersionMismatch), errors.Is(err, sql.ErrNoRows):
		fmt.Printf("\n-- result: %v\n", err)
	default:
		// The reader's statements bind or read what the script doesn't answer.
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	if n := recorder.Pending(); n > 0 {
		fmt.Fprintf(os.Stderr, "the run left %d scripted responses unused\n", n)
		return 1
	}
	return 0
}

// readInput reads and decodes input.json: one JSON object, and nothing after it.
func readInput() (Input, error) {
	var in Input
	text, err := os.ReadFile(input)
	if errors.Is(err, fs.ErrNotExist) {
		return in, fmt.Errorf("%s: no such file in the working directory", input)
	}
	if err != nil {
		return in, err
	}
	decoder := json.NewDecoder(bytes.NewReader(text))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&in); err != nil {
		return in, fmt.Errorf("%s: %w", input, err)
	}
	if _, err := decoder.Token(); !errors.Is(err, io.EOF) {
		return in, fmt.Errorf("%s: more than one JSON value", input)
	}
	return in, nil
}

// script is what the driver answers, in call order: the edit's rows affected, and when it
// affects none, the row version reads, or no row.
func script(in Input) []sqltest.Response {
	switch {
	case in.Stored == nil:
		return []sqltest.Response{{}, {Columns: []string{"version"}}}
	case *in.Stored == in.Version:
		return []sqltest.Response{{Affected: 1}}
	default:
		return []sqltest.Response{{}, {Columns: []string{"version"}, Rows: [][]driver.Value{{*in.Stored}}}}
	}
}

// bound lists a call's values by their placeholders: , $1 = "LAB", $2 = 3.
func bound(values []any) string {
	var listed strings.Builder
	for i, v := range values {
		fmt.Fprintf(&listed, ", $%d = %#v", i+1, v)
	}
	return listed.String()
}

// standIn is a testing.TB for sqltest.Open, which a program has no test to pass. Open calls only
// Helper and Cleanup, which standIn defines; the embedded testing.TB is nil and provides the
// rest of the interface, its private method included, so any other call would panic.
type standIn struct {
	testing.TB
	cleanups []func()
}

// Helper does nothing: a program has no test log to report a caller's line in.
func (*standIn) Helper() {}

// Cleanup keeps f to run when the run ends, closing the pool Open made.
func (s *standIn) Cleanup(f func()) { s.cleanups = append(s.cleanups, f) }

// cleanUp runs the cleanups, last kept first, as testing does.
func (s *standIn) cleanUp() {
	for _, f := range slices.Backward(s.cleanups) {
		f()
	}
}
