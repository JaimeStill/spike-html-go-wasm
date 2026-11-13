//go:build js && wasm

// Command websdk is the go-web-sdk scenario's entrypoint: one long-lived instance serving its
// request handler through the bridge, for the runtime to call.
package main

import "github.com/JaimeStill/spike-html-go-wasm/internal/websdk"

func main() {
	websdk.Serve()
}
