//go:build js && wasm

// Package websdk is the go-web-sdk scenario's composition root: one handler, request, served
// through the bridge on one long-lived instance, which serves one raw HTTP/1.1 request's text
// through go-web-sdk's Router in-process and answers the response's text. It imports only the
// standard library, the bridge, and go-web-sdk's and go-core's packages, which the unit tier holds
// by the package's import listing (test/unit/go-module.test.ts).
//
// There is no socket and no server: the request's text is parsed by net/http's own ReadRequest,
// served by the Router's ServeHTTP into an httptest recorder, and the recorded response printed
// back. The Router serves a sample projects resource (projects.go), seeded at startup and kept for
// the instance's life, so a create, an update, and a stale update are each seen by later calls.
package websdk

import (
	"bufio"
	"fmt"
	"io"
	"log/slog"
	"maps"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strconv"
	"strings"

	"github.com/JaimeStill/spike-html-go-wasm/bridge"
)

// Serve serves the scenario's handler, logging to standard error, and never returns.
func Serve() {
	bridge.Serve(Handlers(os.Stderr))
}

// Handlers is the scenario's handlers by name, request alone, over one Router and its seeded
// projects, built once, here, as a service builds its router where it starts. logs receives what
// the Router's error writer and Recoverer log: the cause of a 5xx, which no route answers but a
// defect would.
func Handlers(logs io.Writer) map[string]bridge.Handler {
	router := newRouter(slog.New(slog.NewTextHandler(logs, nil)), seed())
	return map[string]bridge.Handler{
		"request": func(input string) (any, error) { return serve(router, input) },
	}
}

// serve parses input, one HTTP/1.1 request's text, serves it through handler into a recorder, and
// answers the response's text; or it rejects text that isn't an HTTP/1.1 request, naming why.
func serve(handler http.Handler, input string) (any, error) {
	req, err := parse(input)
	if err != nil {
		return nil, fmt.Errorf("request: %w", err)
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return format(rec.Result()), nil
}

// parse reads input as an HTTP/1.1 request: a request line and headers, each line ended by LF or
// CRLF, up to the first blank line, and then the body, every byte after that line as written. The
// head's line endings are made CRLF for net/http.ReadRequest, which reads it alone; the body is
// never parsed as HTTP, so the request's own Content-Length and Transfer-Encoding are replaced by
// the body's length, and the reader counts no bytes.
func parse(input string) (*http.Request, error) {
	var head []string
	body := ""
	for rest := input; ; {
		line, after, found := strings.Cut(rest, "\n")
		line = strings.TrimSuffix(line, "\r")
		if line == "" {
			body = after
			break
		}
		head = append(head, line)
		if !found {
			break
		}
		rest = after
	}
	if len(head) == 0 {
		return nil, fmt.Errorf("no request line")
	}
	text := strings.Join(head, "\r\n") + "\r\n\r\n"
	req, err := http.ReadRequest(bufio.NewReader(strings.NewReader(text)))
	if err != nil {
		return nil, err
	}
	// ReadRequest takes any HTTP/major.minor; this is an HTTP/1.1 reader.
	if req.ProtoMajor != 1 {
		return nil, fmt.Errorf("%s isn't HTTP/1.x", req.Proto)
	}
	req.TransferEncoding = nil
	req.Header.Del("Transfer-Encoding")
	req.ContentLength = int64(len(body))
	if body == "" {
		req.Body = http.NoBody
		req.Header.Del("Content-Length")
	} else {
		req.Body = io.NopCloser(strings.NewReader(body))
		req.Header.Set("Content-Length", strconv.Itoa(len(body)))
	}
	return req, nil
}

// format prints res as HTTP/1.1 text, each line ended by LF for reading: the status line, each
// header the handler set, one line a value, in name order, a blank line, and the body as written.
func format(res *http.Response) string {
	var b strings.Builder
	_, _ = fmt.Fprintf(&b, "HTTP/1.1 %d", res.StatusCode)
	if text := http.StatusText(res.StatusCode); text != "" {
		b.WriteString(" " + text)
	}
	b.WriteString("\n")
	for _, name := range slices.Sorted(maps.Keys(res.Header)) {
		for _, value := range res.Header[name] {
			b.WriteString(name + ": " + value + "\n")
		}
	}
	b.WriteString("\n")
	// The recorder's body is in memory, so the read never fails.
	body, _ := io.ReadAll(res.Body)
	b.Write(body)
	return b.String()
}
