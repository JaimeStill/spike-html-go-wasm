//go:build js && wasm

// Command sqlate is the sqlate scenario's entrypoint: one long-lived instance serving its compile
// handler through the bridge, for the runtime to call.
package main

import "github.com/JaimeStill/spike-html-go-wasm/internal/sqlate"

func main() {
	sqlate.Serve()
}
