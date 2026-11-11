// Command hello is the spike's first program built for GOOS=js GOARCH=wasm: it imports only the
// standard library and prints one line. It is a program scenario: the runtime page runs its main
// to completion in the runtime's worker, which reports the line as stdout output and the exit
// code 0. It stays the standard-library baseline.
package main

import (
	"fmt"
	"runtime"
)

func main() {
	fmt.Printf("hello from Go %s on %s/%s\n", runtime.Version(), runtime.GOOS, runtime.GOARCH)
}
