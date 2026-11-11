// Command hello is the spike's first program built for GOOS=js GOARCH=wasm: it imports only the
// standard library and prints one line. A program scenario on the runtime: the runtime page runs
// its main to completion in the runtime's worker, its line an output event on stdout and its exit
// code 0, and it stays the standard-library baseline.
package main

import (
	"fmt"
	"runtime"
)

func main() {
	fmt.Printf("hello from Go %s on %s/%s\n", runtime.Version(), runtime.GOOS, runtime.GOARCH)
}
