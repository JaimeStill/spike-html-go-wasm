//go:build js && wasm

// The scenario's compile handler called as the bridge calls it, its stdout captured. The check
// runs it on node's fs and on the runtime's in-memory fs (scripts/check-go.sh); the patterns are
// embedded, so it reads no file either way. A statement compiles to its $n SQL with one line
// naming its tier and parameters; one that includes an app pattern compiles against the embedded
// sample, and one that includes a library pattern against PostgreSQL's; and each kind of compile
// error rejects with sqlate's own message, naming statement.sql, and prints nothing.
package sqlate_test

import (
	"strings"
	"testing"

	"github.com/JaimeStill/spike-html-go-wasm/internal/sqlate"
)

// compile calls the compile handler with input, answering its stdout, its result, and its error.
func compile(t *testing.T, input string) (string, any, error) {
	t.Helper()
	var stdout strings.Builder
	got, err := sqlate.Handlers(&stdout)["compile"](input)
	return stdout.String(), got, err
}

func TestHandlersAreCompileAlone(t *testing.T) {
	handlers := sqlate.Handlers(&strings.Builder{})
	if len(handlers) != 1 || handlers["compile"] == nil {
		t.Fatalf("handlers = %v, want compile alone", handlers)
	}
}

func TestCompileAnswersSQLAndPrintsParameters(t *testing.T) {
	cases := []struct {
		name, input, want, line string
	}{
		{
			name: "an app pattern",
			input: "--| tier: native\n" +
				"--| native: postgres — RETURNING.\n" +
				"INSERT INTO project (code, name)\n" +
				"VALUES ({{code}}, {{name}})\n" +
				"{{> app.identity}}\n",
			want: "INSERT INTO project (code, name)\nVALUES ($1, $2)\nRETURNING id, version",
			line: "compile: native, parameters $1 code, $2 name\n",
		},
		{
			name: "PostgreSQL's patterns",
			input: "--| tier: standard\n" +
				"UPDATE project\n" +
				"SET name = {{name}}, {{> sql.guard_set}}\n" +
				"WHERE {{> sql.guard_where}}\n",
			want: "UPDATE project\n" +
				"SET name = $1, updated_at = CURRENT_TIMESTAMP, version = version + 1\n" +
				"WHERE id = $2 AND version = $3",
			line: "compile: standard, parameters $1 name, $2 id, $3 version\n",
		},
		{
			name:  "no parameters",
			input: "--| tier: standard\nSELECT 1\n",
			want:  "SELECT 1",
			line:  "compile: standard, no parameters\n",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			stdout, got, err := compile(t, c.input)
			if err != nil {
				t.Fatalf("compile rejected: %v", err)
			}
			if got != c.want {
				t.Fatalf("compile = %q, want %q", got, c.want)
			}
			if stdout != c.line {
				t.Fatalf("stdout = %q, want %q", stdout, c.line)
			}
		})
	}
}

func TestCompileRejectsWithSqlatesMessage(t *testing.T) {
	cases := []struct {
		name, input, want string
	}{
		{
			name:  "no tier",
			input: "SELECT {{id}}\n",
			want:  "query: statement.sql: no tier declaration",
		},
		{
			name:  "an empty statement",
			input: "",
			want:  "query: statement.sql: no tier declaration",
		},
		{
			name:  "an unknown include",
			input: "--| tier: standard\nSELECT 1 {{> app.nope}}\n",
			want:  `query: statement.sql: include of unknown pattern "app.nope"`,
		},
		{
			name:  "a native include in a standard statement",
			input: "--| tier: standard\nINSERT INTO project (code) VALUES ({{code}})\n{{> app.identity}}\n",
			want: `query: statement.sql: include of native pattern "app.identity" in a ` +
				"standard-tier statement",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			stdout, got, err := compile(t, c.input)
			if err == nil {
				t.Fatalf("compile resolved %q, want a compile error", got)
			}
			if err.Error() != c.want {
				t.Fatalf("compile rejected with %q, want %q", err.Error(), c.want)
			}
			if stdout != "" {
				t.Fatalf("stdout = %q, want nothing", stdout)
			}
		})
	}
}
