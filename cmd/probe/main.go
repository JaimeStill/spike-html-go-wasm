//go:build js && wasm

// Command probe is the probe scenario's entrypoint: one long-lived instance serving the probe's
// handlers through the bridge, for the runtime to call.
package main

import "github.com/JaimeStill/spike-html-go-wasm/internal/probe"

func main() {
	probe.Serve()
}
