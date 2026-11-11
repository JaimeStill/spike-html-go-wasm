//go:build js && wasm

// Package bridge serves named Go handlers to JavaScript from one long-lived GOOS=js instance.
// A scenario's main hands its handlers to Serve, which never returns; JavaScript then calls
// globalThis.goBridge.call(name, input), which answers a Promise: it resolves with the handler's
// result as JSON text, or rejects with an Error carrying the handler's error, or its panic's
// message, or the unknown name.
//
// Each call runs in its own goroutine. A syscall/js callback that blocks stops JavaScript's event
// loop, and with it every async call Go's runtime makes beneath a sleep, a channel, or a file
// call, so a handler run inside the callback would deadlock (go1.27.4
// src/syscall/js/func.go). The callback only starts the goroutine and returns the Promise.
package bridge

import (
	"encoding/json"
	"fmt"
	"maps"
	"slices"
	"syscall/js"
)

// Handler answers one call: input is the string JavaScript passed, and the result is marshalled
// to JSON. A non-nil error rejects the call with its message.
type Handler func(input string) (any, error)

// Global is the name of the object Serve installs on globalThis: call(name, input), which answers
// a Promise, and handlers, the registered names, sorted.
const Global = "goBridge"

// Ready is the name of the function on globalThis that Serve calls, with no arguments, once
// Global is installed, when the page or worker defined one before running the instance; one that
// defines none can wait for Global to appear instead.
const Ready = "goBridgeReady"

// Serve installs handlers on globalThis as Global, calls globalThis's Ready function if there is
// one, and blocks forever, keeping the instance, and so every handler, alive.
func Serve(handlers map[string]Handler) {
	call := js.FuncOf(func(_ js.Value, args []js.Value) any {
		name, input := arg(args, 0), arg(args, 1)
		return promise(func() (string, error) { return invoke(handlers, name, input) })
	})
	names := make([]any, 0, len(handlers))
	for _, name := range slices.Sorted(maps.Keys(handlers)) {
		names = append(names, name)
	}
	js.Global().Set(Global, map[string]any{"call": call, "handlers": names})
	if ready := js.Global().Get(Ready); ready.Type() == js.TypeFunction {
		ready.Invoke()
	}
	select {}
}

// arg is args[i] as a string, or "" when JavaScript passed fewer arguments.
func arg(args []js.Value, i int) string {
	if i >= len(args) || args[i].IsUndefined() || args[i].IsNull() {
		return ""
	}
	return args[i].String()
}

// invoke runs the named handler and marshals its result, turning an unknown name, an error, a
// result that won't marshal, and a panic each into the error the Promise rejects with.
func invoke(handlers map[string]Handler, name, input string) (out string, err error) {
	handler, ok := handlers[name]
	if !ok {
		return "", fmt.Errorf("bridge: no handler named %q", name)
	}
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("bridge: %s panicked: %v", name, r)
		}
	}()
	result, err := handler(input)
	if err != nil {
		return "", err
	}
	text, err := json.Marshal(result)
	if err != nil {
		return "", fmt.Errorf("bridge: %s's result: %w", name, err)
	}
	return string(text), nil
}

// promise answers a new Promise that run settles from its own goroutine: resolved with run's
// string, or rejected with an Error carrying its error's message.
func promise(run func() (string, error)) js.Value {
	executor := js.FuncOf(func(_ js.Value, args []js.Value) any {
		resolve, reject := args[0], args[1]
		go func() {
			out, err := run()
			if err != nil {
				reject.Invoke(js.Global().Get("Error").New(err.Error()))
				return
			}
			resolve.Invoke(out)
		}()
		return nil
	})
	// The Promise constructor runs the executor before it returns, so it's done with.
	defer executor.Release()
	return js.Global().Get("Promise").New(executor)
}
