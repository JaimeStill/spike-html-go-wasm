// Command hello is the spike's first program built for GOOS=js GOARCH=wasm: it imports only the
// standard library and prints one line, which proves the site serves a Go module the browser
// instantiates through wasm_exec.js and that its standard output reaches the page's console.
package main

import (
	"fmt"
	"runtime"
)

func main() {
	fmt.Printf("hello from Go %s on %s/%s\n", runtime.Version(), runtime.GOOS, runtime.GOARCH)
}
