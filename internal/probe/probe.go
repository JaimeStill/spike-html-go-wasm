//go:build js && wasm

// Package probe is the probe scenario's composition root: the handlers that prove the runtime,
// served through the bridge on one long-lived instance. It imports only the standard library and
// the bridge, and stays on the site as a bridge-sized baseline.
package probe

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"os"

	"github.com/JaimeStill/spike-html-go-wasm/bridge"
)

// Serve serves the probe's handlers, printing to standard output, and never returns.
func Serve() {
	bridge.Serve(Handlers(os.Stdout))
}

// Handlers is the probe's handlers by name, each printing its one line to stdout.
func Handlers(stdout io.Writer) map[string]bridge.Handler {
	return map[string]bridge.Handler{
		"format": func(input string) (any, error) { return format(stdout, input) },
	}
}

// format answers input, JSON text, indented by two spaces, or its parse error; it prints one line
// naming the sizes in and out.
func format(stdout io.Writer, input string) (any, error) {
	var out bytes.Buffer
	if err := json.Indent(&out, []byte(input), "", "  "); err != nil {
		return nil, fmt.Errorf("format: %w", err)
	}
	_, _ = fmt.Fprintf(stdout, "format: %d bytes in, %d bytes out\n", len(input), out.Len())
	return out.String(), nil
}
