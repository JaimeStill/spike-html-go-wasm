//go:build js && wasm

// The probe's handlers called as the bridge calls them, each with its stdout captured.
package probe_test

import (
	"strings"
	"testing"

	"github.com/JaimeStill/spike-html-go-wasm/internal/probe"
)

func TestFormatIndentsJSON(t *testing.T) {
	var stdout strings.Builder
	got, err := probe.Handlers(&stdout)["format"](`{"a":[1,2],"b":{}}`)
	if err != nil {
		t.Fatalf("format rejected: %v", err)
	}
	want := "{\n  \"a\": [\n    1,\n    2\n  ],\n  \"b\": {}\n}"
	if got != want {
		t.Fatalf("format = %q, want %q", got, want)
	}
	if line := "format: 18 bytes in, 40 bytes out\n"; stdout.String() != line {
		t.Fatalf("stdout = %q, want %q", stdout.String(), line)
	}
}

func TestFormatRejectsInvalidJSON(t *testing.T) {
	var stdout strings.Builder
	got, err := probe.Handlers(&stdout)["format"](`{"a":`)
	if err == nil {
		t.Fatalf("format resolved %v, want a parse error", got)
	}
	if want := "format: unexpected end of JSON input"; err.Error() != want {
		t.Fatalf("format rejected with %q, want %q", err.Error(), want)
	}
	if stdout.Len() != 0 {
		t.Fatalf("stdout = %q, want nothing", stdout.String())
	}
}
