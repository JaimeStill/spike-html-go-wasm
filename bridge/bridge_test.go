//go:build js && wasm

// The bridge at its seam: TestMain serves the test handlers on this one instance, as a scenario's
// main does, and each test calls globalThis.goBridge.call through syscall/js, as JavaScript does,
// awaiting the Promise it answers. Every test runs on the same instance, so a later test also
// proves the instance still answers after an earlier one's panic.
package bridge_test

import (
	"errors"
	"fmt"
	"os"
	"slices"
	"syscall/js"
	"testing"
	"time"

	"github.com/JaimeStill/spike-html-go-wasm/bridge"
)

// release lets wait return; release closes it.
var release = make(chan struct{})

var handlers = map[string]bridge.Handler{
	"echo": func(input string) (any, error) { return map[string]string{"input": input}, nil },
	"fail": func(input string) (any, error) { return nil, fmt.Errorf("fail: %s", input) },
	"panic": func(input string) (any, error) {
		panic("boom: " + input)
	},
	"unmarshalable": func(string) (any, error) { return func() {}, nil },
	"sleep": func(string) (any, error) {
		time.Sleep(20 * time.Millisecond)
		return "slept", nil
	},
	// A file call: node's fs answers by callback, which needs the event loop running.
	"file": func(input string) (any, error) {
		f, err := os.CreateTemp("", "bridge-*")
		if err != nil {
			return nil, err
		}
		defer func() { _ = os.Remove(f.Name()) }()
		if _, err := f.WriteString(input); err != nil {
			return nil, err
		}
		if err := f.Close(); err != nil {
			return nil, err
		}
		text, err := os.ReadFile(f.Name())
		return string(text), err
	},
	"wait": func(string) (any, error) {
		<-release
		return "released", nil
	},
	"release": func(string) (any, error) {
		close(release)
		return "releasing", nil
	},
}

func TestMain(m *testing.M) {
	ready := make(chan struct{})
	onReady := js.FuncOf(func(js.Value, []js.Value) any {
		close(ready)
		return nil
	})
	js.Global().Set(bridge.Ready, onReady)
	go bridge.Serve(handlers)
	select {
	case <-ready:
	case <-time.After(5 * time.Second):
		fmt.Fprintln(os.Stderr, "bridge.Serve never called", bridge.Ready)
		os.Exit(1)
	}
	onReady.Release()
	os.Exit(m.Run())
}

// call starts globalThis.goBridge.call(name, input) and answers its Promise.
func call(name, input string) js.Value {
	return js.Global().Get(bridge.Global).Call("call", name, input)
}

// await waits for promise to settle: its resolved value, which must be a string, or an error
// carrying the message of the Error it rejected with.
func await(promise js.Value) (string, error) {
	type settled struct {
		value string
		err   error
	}
	done := make(chan settled, 1)
	onResolve := js.FuncOf(func(_ js.Value, args []js.Value) any {
		if args[0].Type() != js.TypeString {
			done <- settled{err: fmt.Errorf("resolved with a %s, not a string", args[0].Type())}
			return nil
		}
		done <- settled{value: args[0].String()}
		return nil
	})
	onReject := js.FuncOf(func(_ js.Value, args []js.Value) any {
		if !args[0].InstanceOf(js.Global().Get("Error")) {
			done <- settled{err: fmt.Errorf("rejected with a non-Error: %s", args[0].String())}
			return nil
		}
		done <- settled{err: errors.New(args[0].Get("message").String())}
		return nil
	})
	defer onResolve.Release()
	defer onReject.Release()
	promise.Call("then", onResolve, onReject)
	s := <-done
	return s.value, s.err
}

// resolves calls name with input and fails t unless the call resolves to want.
func resolves(t *testing.T, name, input, want string) {
	t.Helper()
	got, err := await(call(name, input))
	if err != nil {
		t.Fatalf("%s(%q) rejected: %v", name, input, err)
	}
	if got != want {
		t.Fatalf("%s(%q) resolved %s, want %s", name, input, got, want)
	}
}

// rejects calls name with input and fails t unless the call rejects with message want.
func rejects(t *testing.T, name, input, want string) {
	t.Helper()
	got, err := await(call(name, input))
	if err == nil {
		t.Fatalf("%s(%q) resolved %s, want a rejection: %s", name, input, got, want)
	}
	if err.Error() != want {
		t.Fatalf("%s(%q) rejected with %q, want %q", name, input, err.Error(), want)
	}
}

func TestHandlersListsNamesSorted(t *testing.T) {
	list := js.Global().Get(bridge.Global).Get("handlers")
	var got []string
	for i := range list.Length() {
		got = append(got, list.Index(i).String())
	}
	want := []string{"echo", "fail", "file", "panic", "release", "sleep", "unmarshalable", "wait"}
	if !slices.Equal(got, want) {
		t.Fatalf("handlers = %v, want %v", got, want)
	}
}

func TestResultResolvesAsJSON(t *testing.T) {
	resolves(t, "echo", `say "hi"`, `{"input":"say \"hi\""}`)
}

func TestMissingInputIsEmpty(t *testing.T) {
	got, err := await(js.Global().Get(bridge.Global).Call("call", "echo"))
	if err != nil || got != `{"input":""}` {
		t.Fatalf("echo() = %s, %v; want {\"input\":\"\"}", got, err)
	}
}

func TestErrorRejectsWithItsMessage(t *testing.T) {
	rejects(t, "fail", "x", "fail: x")
}

func TestUnknownNameRejectsNamingIt(t *testing.T) {
	rejects(t, "nope", "", `bridge: no handler named "nope"`)
}

func TestUnmarshalableResultRejects(t *testing.T) {
	rejects(t, "unmarshalable", "", "bridge: unmarshalable's result: json: unsupported type: func()")
}

func TestPanicRejectsAndTheInstanceKeepsAnswering(t *testing.T) {
	rejects(t, "panic", "x", "bridge: panic panicked: boom: x")
	resolves(t, "echo", "after", `{"input":"after"}`)
	rejects(t, "panic", "y", "bridge: panic panicked: boom: y")
	resolves(t, "echo", "again", `{"input":"again"}`)
}

func TestBlockingHandlersResolve(t *testing.T) {
	resolves(t, "sleep", "", `"slept"`)
	resolves(t, "file", "on disk", `"on disk"`)
}

// wait blocks until a later call, release, runs: only with each call on its own goroutine does
// release run while wait is still blocked.
func TestCallsRunConcurrently(t *testing.T) {
	waiting := call("wait", "")
	resolves(t, "release", "", `"releasing"`)
	got, err := await(waiting)
	if err != nil || got != `"released"` {
		t.Fatalf("wait = %s, %v; want \"released\"", got, err)
	}
}
