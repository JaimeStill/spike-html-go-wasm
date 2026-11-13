//go:build js && wasm

// The scenario's request handler called as the bridge calls it, one instance a test, its logs
// captured. The check runs it on node's fs and on the runtime's in-memory fs
// (scripts/check-go.sh); it reads no file either way. Each route's status, headers, and body are
// matched whole, the request id and a new project's id by their shape and the rest exactly; text
// that isn't an HTTP/1.1 request is rejected naming why, and the instance serves the next call;
// and chained calls on one instance see each other's writes. No call logs: no route answers a 5xx.
package websdk_test

import (
	"regexp"
	"strings"
	"testing"

	"github.com/JaimeStill/spike-html-go-wasm/bridge"
	"github.com/JaimeStill/spike-html-go-wasm/internal/websdk"
)

// instance is one scenario instance's request handler, as the bridge holds it; the test fails if
// the instance logs anything by its end.
func instance(t *testing.T) bridge.Handler {
	t.Helper()
	var logs strings.Builder
	t.Cleanup(func() {
		if logs.Len() > 0 {
			t.Errorf("the instance logged: %s", logs.String())
		}
	})
	return websdk.Handlers(&logs)["request"]
}

// requestID is the shape of the id RequestID generates: 16 random bytes, hex-encoded.
var requestID = regexp.MustCompile(`(?m)^X-Request-Id: ([0-9a-f]{32})$`)

// newID is the shape of a new project's id, a UUIDv7.
var newID = regexp.MustCompile(`"id":"([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})"`)

// call sends text to request and answers its response's text with the request id, which must
// appear as one X-Request-Id header, replaced by <request-id> wherever it appears, a problem's
// request_id member included.
func call(t *testing.T, request bridge.Handler, text string) string {
	t.Helper()
	got, err := request(text)
	if err != nil {
		t.Fatalf("request rejected %q: %v", text, err)
	}
	response, ok := got.(string)
	if !ok {
		t.Fatalf("request answered %T, want a string", got)
	}
	ids := requestID.FindAllStringSubmatch(response, -1)
	if len(ids) != 1 {
		t.Fatalf("response has %d X-Request-Id headers, want 1:\n%s", len(ids), response)
	}
	return strings.ReplaceAll(response, ids[0][1], "<request-id>")
}

// created answers a create's response, its one project's id, which must have a UUIDv7's shape,
// replaced by <new-id>, and the id itself.
func created(t *testing.T, response string) (string, string) {
	t.Helper()
	m := newID.FindStringSubmatch(response)
	if m == nil {
		t.Fatalf("no UUIDv7 id in the response:\n%s", response)
	}
	return strings.ReplaceAll(response, m[1], "<new-id>"), m[1]
}

// expect fails unless got is want.
func expect(t *testing.T, got, want string) {
	t.Helper()
	if got != want {
		t.Fatalf("response:\n%s\nwant:\n%s", got, want)
	}
}

const (
	atlas  = `{"id":"01933b5e-8a00-7000-8000-000000000001","code":"ATLAS","name":"Atlas","version":1}`
	boreal = `{"id":"01933b5e-8a00-7000-8000-000000000002","code":"BOREAL","name":"Boreal","version":1}`
	cinder = `{"id":"01933b5e-8a00-7000-8000-000000000003","code":"CINDER","name":"Cinder","version":1}`
	unseen = "01933b5e-8a00-7000-8000-0000000000ff"
)

// head is a response's head: status, the given headers between Content-Type and X-Request-Id
// in name order, then the request id.
func head(status string, headers ...string) string {
	lines := append([]string{"HTTP/1.1 " + status}, headers...)
	return strings.Join(lines, "\n") + "\nX-Request-Id: <request-id>\n\n"
}

// problem is a problem response: its status line, Allow when given, and its document.
func problem(status, document string, allow ...string) string {
	headers := append(allow, "Content-Type: application/problem+json")
	return head(status, headers...) + document + "\n"
}

func TestHandlersAreRequestAlone(t *testing.T) {
	handlers := websdk.Handlers(&strings.Builder{})
	if len(handlers) != 1 || handlers["request"] == nil {
		t.Fatalf("handlers = %v, want request alone", handlers)
	}
}

func TestReadsAnswerTheSeed(t *testing.T) {
	cases := []struct {
		name, request, want string
	}{
		{
			name:    "the list",
			request: "GET /projects HTTP/1.1\nHost: example.com\n",
			want: head("200 OK", "Content-Type: application/json") +
				`{"items":[` + atlas + "," + boreal + "," + cinder + `],"page":1,"size":10,"total":3,"more":false}` + "\n",
		},
		{
			name:    "the list with CRLF line endings",
			request: "GET /projects HTTP/1.1\r\nHost: example.com\r\n\r\n",
			want: head("200 OK", "Content-Type: application/json") +
				`{"items":[` + atlas + "," + boreal + "," + cinder + `],"page":1,"size":10,"total":3,"more":false}` + "\n",
		},
		{
			name:    "a page by page and size",
			request: "GET /projects?page=1&size=2 HTTP/1.1\n",
			want: head("200 OK", "Content-Type: application/json") +
				`{"items":[` + atlas + "," + boreal + `],"page":1,"size":2,"total":3,"more":true}` + "\n",
		},
		{
			name:    "the last page",
			request: "GET /projects?page=2&size=2 HTTP/1.1\n",
			want: head("200 OK", "Content-Type: application/json") +
				`{"items":[` + cinder + `],"page":2,"size":2,"total":3,"more":false}` + "\n",
		},
		{
			name:    "a page past the end",
			request: "GET /projects?page=3&size=2 HTTP/1.1\n",
			want: head("200 OK", "Content-Type: application/json") +
				`{"items":[],"page":3,"size":2,"total":3,"more":false}` + "\n",
		},
		{
			name:    "a size ParseQuery refuses",
			request: "GET /projects?size=0 HTTP/1.1\n",
			want: problem("400 Bad Request",
				`{"detail":"query size=\"0\": must be an integer of at least 1","instance":"/projects",`+
					`"request_id":"<request-id>","status":400,"title":"Bad Request","type":"about:blank"}`),
		},
		{
			name:    "one project",
			request: "GET /projects/01933b5e-8a00-7000-8000-000000000002 HTTP/1.1\n",
			want:    head("200 OK", "Content-Type: application/json", `Etag: "1"`) + boreal + "\n",
		},
		{
			name:    "an id in upper case, read canonically",
			request: "GET /projects/01933B5E-8A00-7000-8000-000000000002 HTTP/1.1\n",
			want:    head("200 OK", "Content-Type: application/json", `Etag: "1"`) + boreal + "\n",
		},
		{
			name:    "an id that isn't a UUID",
			request: "GET /projects/nope HTTP/1.1\n",
			want: problem("400 Bad Request",
				`{"detail":"path id=\"nope\": must be a UUID","instance":"/projects/nope",`+
					`"request_id":"<request-id>","status":400,"title":"Bad Request","type":"about:blank"}`),
		},
		{
			name:    "an unknown id",
			request: "GET /projects/" + unseen + " HTTP/1.1\n",
			want: problem("404 Not Found",
				`{"detail":"no project `+unseen+`","instance":"/projects/`+unseen+`",`+
					`"request_id":"<request-id>","status":404,"title":"Not Found","type":"about:blank"}`),
		},
		{
			name:    "an unknown path",
			request: "GET /tasks HTTP/1.1\n",
			want: problem("404 Not Found",
				`{"instance":"/tasks","request_id":"<request-id>","status":404,"title":"Not Found",`+
					`"type":"about:blank"}`),
		},
		{
			name:    "the list's path with another method",
			request: "DELETE /projects HTTP/1.1\n",
			want: problem("405 Method Not Allowed",
				`{"instance":"/projects","request_id":"<request-id>","status":405,`+
					`"title":"Method Not Allowed","type":"about:blank"}`,
				"Allow: GET, HEAD, POST"),
		},
		{
			name:    "a project's path with another method",
			request: "DELETE /projects/" + unseen + " HTTP/1.1\n",
			want: problem("405 Method Not Allowed",
				`{"instance":"/projects/`+unseen+`","request_id":"<request-id>","status":405,`+
					`"title":"Method Not Allowed","type":"about:blank"}`,
				"Allow: GET, HEAD, PUT"),
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			expect(t, call(t, instance(t), c.request), c.want)
		})
	}
}

func TestCreateAnswersTheNewProject(t *testing.T) {
	cases := []struct {
		name, request string
	}{
		{
			name: "a JSON body",
			request: "POST /projects HTTP/1.1\nContent-Type: application/json\n\n" +
				`{"code":"DELTA","name":"Delta"}` + "\n",
		},
		{
			name: "a Content-Length the body doesn't have, replaced by the body's own",
			request: "POST /projects HTTP/1.1\r\nContent-Length: 2\r\n\r\n" +
				`{"code":"DELTA","name":"Delta"}`,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			response, _ := created(t, call(t, instance(t), c.request))
			expect(t, response, head("201 Created",
				"Content-Type: application/json", `Etag: "1"`, "Location: /projects/<new-id>")+
				`{"id":"<new-id>","code":"DELTA","name":"Delta","version":1}`+"\n")
		})
	}
}

func TestCreateRefusesABadBody(t *testing.T) {
	cases := []struct {
		name, request, detail string
	}{
		{
			name:    "an unknown field",
			request: "POST /projects HTTP/1.1\n\n" + `{"code":"DELTA","name":"Delta","owner":"me"}`,
			detail:  `body: json: unknown field \"owner\"`,
		},
		{
			name:    "an empty body",
			request: "POST /projects HTTP/1.1\nContent-Type: application/json\n\n",
			detail:  "body: empty body",
		},
		{
			name:    "no blank line, so no body",
			request: "POST /projects HTTP/1.1\nContent-Type: application/json",
			detail:  "body: empty body",
		},
		{
			name:    "a second JSON value",
			request: "POST /projects HTTP/1.1\n\n" + `{"code":"DELTA","name":"Delta"} {}`,
			detail:  "body: unexpected data after the JSON value",
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			expect(t, call(t, instance(t), c.request), problem("400 Bad Request",
				`{"detail":"`+c.detail+`","instance":"/projects","request_id":"<request-id>",`+
					`"status":400,"title":"Bad Request","type":"about:blank"}`))
		})
	}
}

func TestUpdateAnswersTheNextVersion(t *testing.T) {
	request := instance(t)
	expect(t, call(t, request,
		"PUT /projects/01933b5e-8a00-7000-8000-000000000001 HTTP/1.1\r\n"+
			"If-Match: \"1\"\r\n\r\n"+
			`{"code":"ATLAS","name":"Atlas II"}`),
		head("200 OK", "Content-Type: application/json", `Etag: "2"`)+
			`{"id":"01933b5e-8a00-7000-8000-000000000001","code":"ATLAS","name":"Atlas II","version":2}`+"\n")
}

func TestUpdateRefusesAPrecondition(t *testing.T) {
	const path = "/projects/01933b5e-8a00-7000-8000-000000000001"
	const body = `{"code":"ATLAS","name":"Atlas II"}`
	cases := []struct {
		name, request, want string
	}{
		{
			name:    "a stale version",
			request: "PUT " + path + " HTTP/1.1\nIf-Match: \"2\"\n\n" + body,
			want: problem("412 Precondition Failed",
				`{"detail":"project 01933b5e-8a00-7000-8000-000000000001 is at version 1, not 2",`+
					`"instance":"`+path+`","request_id":"<request-id>","status":412,`+
					`"title":"Precondition Failed","type":"about:blank"}`),
		},
		{
			name:    "no If-Match",
			request: "PUT " + path + " HTTP/1.1\n\n" + body,
			want: problem("428 Precondition Required",
				`{"detail":"the request requires an If-Match header","instance":"`+path+`",`+
					`"request_id":"<request-id>","status":428,"title":"Precondition Required",`+
					`"type":"about:blank"}`),
		},
		{
			name:    "an unquoted If-Match",
			request: "PUT " + path + " HTTP/1.1\nIf-Match: 1\n\n" + body,
			want: problem("400 Bad Request",
				`{"detail":"If-Match \"1\": must be one entity-tag containing an integer version, `+
					`like \"3\"","instance":"`+path+`","request_id":"<request-id>","status":400,`+
					`"title":"Bad Request","type":"about:blank"}`),
		},
		{
			name:    "an unknown id",
			request: "PUT /projects/" + unseen + " HTTP/1.1\nIf-Match: \"1\"\n\n" + body,
			want: problem("404 Not Found",
				`{"detail":"no project `+unseen+`","instance":"/projects/`+unseen+`",`+
					`"request_id":"<request-id>","status":404,"title":"Not Found","type":"about:blank"}`),
		},
		{
			name:    "an id that isn't a UUID",
			request: "PUT /projects/nope HTTP/1.1\nIf-Match: \"1\"\n\n" + body,
			want: problem("400 Bad Request",
				`{"detail":"path id=\"nope\": must be a UUID","instance":"/projects/nope",`+
					`"request_id":"<request-id>","status":400,"title":"Bad Request","type":"about:blank"}`),
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			expect(t, call(t, instance(t), c.request), c.want)
		})
	}
}

func TestCallsOnOneInstanceSeeEachOthersWrites(t *testing.T) {
	request := instance(t)
	_, id := created(t, call(t, request,
		"POST /projects HTTP/1.1\n\n"+`{"code":"DELTA","name":"Delta"}`))
	delta := `{"id":"<new-id>","code":"DELTA","name":"Delta","version":1}`

	// The new id replaced, as created replaces it: a seeded id has a UUIDv7's shape too.
	known := func(response string) string { return strings.ReplaceAll(response, id, "<new-id>") }

	listed := known(call(t, request, "GET /projects?page=2&size=2 HTTP/1.1\n"))
	expect(t, listed, head("200 OK", "Content-Type: application/json")+
		`{"items":[`+cinder+","+delta+`],"page":2,"size":2,"total":4,"more":false}`+"\n")

	read := known(call(t, request, "GET /projects/"+id+" HTTP/1.1\n"))
	expect(t, read, head("200 OK", "Content-Type: application/json", `Etag: "1"`)+delta+"\n")

	put := "PUT /projects/" + id + " HTTP/1.1\nIf-Match: \"1\"\n\n" + `{"code":"DELTA","name":"Delta II"}`
	updated := known(call(t, request, put))
	expect(t, updated, head("200 OK", "Content-Type: application/json", `Etag: "2"`)+
		`{"id":"<new-id>","code":"DELTA","name":"Delta II","version":2}`+"\n")

	stale := known(call(t, request, put))
	expect(t, stale, problem("412 Precondition Failed",
		`{"detail":"project <new-id> is at version 2, not 1","instance":"/projects/<new-id>",`+
			`"request_id":"<request-id>","status":412,"title":"Precondition Failed",`+
			`"type":"about:blank"}`))
}

func TestTextThatIsntARequestIsRejected(t *testing.T) {
	request := instance(t)
	cases := []struct {
		name, text, want string
	}{
		{name: "nothing", text: "", want: "request: no request line"},
		{name: "a blank first line", text: "\nGET /projects HTTP/1.1\n", want: "request: no request line"},
		{
			name: "no request line",
			text: "Host: example.com\n",
			want: `request: malformed HTTP request "Host: example.com"`,
		},
		{
			name: "no version",
			text: "GET /projects\n",
			want: `request: malformed HTTP request "GET /projects"`,
		},
		{
			name: "a malformed header",
			text: "GET /projects HTTP/1.1\nHost example.com\n",
			want: `request: malformed MIME header: missing colon: "Host example.com"`,
		},
		{
			name: "HTTP/2.0",
			text: "GET /projects HTTP/2.0\n",
			want: "request: HTTP/2.0 isn't HTTP/1.x",
		},
		{
			name: "a malformed version",
			text: "GET /projects HTTP/one\n",
			want: `request: malformed HTTP version "HTTP/one"`,
		},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := request(c.text)
			if err == nil {
				t.Fatalf("request answered %q, want a rejection", got)
			}
			if err.Error() != c.want {
				t.Fatalf("request rejected with %q, want %q", err.Error(), c.want)
			}
			// The instance serves the next call.
			if response := call(t, request, "GET /projects HTTP/1.1\n"); !strings.HasPrefix(response, "HTTP/1.1 200 OK\n") {
				t.Fatalf("the next call answered:\n%s", response)
			}
		})
	}
}
