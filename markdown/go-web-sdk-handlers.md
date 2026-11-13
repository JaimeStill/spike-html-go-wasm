# Call go-web-sdk's handlers in the page

This page is Markdown, rendered at build into the site's Markdown shell. The request below is an
ordinary fence, the text of one HTTP/1.1 request, and the live demo around it serves it: press Run,
or <kbd>Ctrl+Enter</kbd> in the editor, and the page loads the prebuilt go-web-sdk scenario, a Go
WebAssembly module, which serves the request through go-web-sdk's Router and answers the response
as text. There is no server and no socket: the handler is called in the page, in-process. Nothing
loads until the first Run.

## The request

<sl-go-demo scenario="websdk" handler="request" file="request.http" label="request demo">

```
GET /projects HTTP/1.1
Host: example.com
```

</sl-go-demo>

The answer is the response as HTTP/1.1 text: its status line, its headers in name order, a blank
line, and its body, here the first page of the seeded projects, ATLAS, BOREAL, and CINDER, in
go-web-sdk's page envelope. Edit the request and run it again: the request line, the headers, a
blank line, and the body, which is every byte after the blank line. Line endings may be LF or CRLF,
and the scenario sets `Content-Length` from the body, so there are no bytes to count. Text that
isn't an HTTP/1.1 request, with no request line, a header without its colon, or a version such as
`HTTP/2.0`, is rejected with the reason, and the next Run is served as before.

## Requests to try

Paste each request over the one above and press Run. Create a project, and the answer is `201
Created`, its `Location` naming the new project's id, at version 1:

```http
POST /projects HTTP/1.1
Content-Type: application/json

{"code":"DELTA","name":"Delta"}
```

Read one project by its id, the new one's from `Location` or a seeded one's, and its `ETag` is its
version. A list run again now holds the new project too.

```http
GET /projects/01933b5e-8a00-7000-8000-000000000002 HTTP/1.1
```

Update a project, naming the version you read in `If-Match`. The answer is the project at its next
version, `ETag: "2"`:

```http
PUT /projects/01933b5e-8a00-7000-8000-000000000001 HTTP/1.1
If-Match: "1"
Content-Type: application/json

{"code":"ATLAS","name":"Atlas II"}
```

Run the same update again and it is stale: the project is at version 2 now, so the answer is `412
Precondition Failed`. Leave out `If-Match` and it is `428 Precondition Required`; write it
unquoted, `If-Match: 1`, and it is `400 Bad Request`.

Ask for an id that isn't a UUID, and the answer is `400 Bad Request`, naming the path parameter:

```http
GET /projects/nope HTTP/1.1
```

A path the Router doesn't know, `GET /tasks`, is `404 Not Found`, and a known path with another
method, `DELETE /projects`, is `405 Method Not Allowed` with `Allow: GET, HEAD, POST`.
`GET /projects?page=2&size=2` asks for the second page of two.

## What's running

The scenario is a small service written as a go-web-sdk service is: a projects resource, each
project an id, a code, a name, and a version.

- A `Group` declares the routes under `/projects`: `GET` and `POST` on the prefix, `GET` and `PUT`
  on `/{id}`. Each route is a handler that returns an error, which the group's error writer turns
  into the response.
- `NewModule` compiles the group into a `Module` once, every route under its full pattern, and
  seals it, so no route can be added after.
- The `Router` mounts the module and dispatches each request to it. A path no route matches is a
  `404` problem, and a known path with another method a `405` problem with `Allow`.
- The Router runs two middleware around everything it serves, a miss included. `RequestID` gives
  each request a correlation id, 16 random bytes as hex, set as the `X-Request-Id` header and on
  the request's context. `Recoverer` turns a handler's panic into a `500` problem and logs it, so
  one defect never takes the service down; no route here panics.

The routes use go-web-sdk's request helpers: `ParseQuery` reads the list's `page` and `size`, 10 a
page unless the request names a size, at most 50, and `NewPage` answers the envelope with the
total; `PathUUID` reads the id; `DecodeJSON` reads a create's or an update's body, refusing an
unknown field or an empty body; and `IfMatch` reads the version an update names.

Every error is answered as an RFC 9457 problem, `application/problem+json`, carrying the request's
id. go-web-sdk's own errors map themselves, a bad query or path parameter or body to `400` and a
missing or malformed `If-Match` to `428` or `400`. The scenario maps its store's two, an unknown id
to `404` and a stale version to `412`, their text the problem's detail. The stale update above
answers this problem, its body printed on one line, laid out here over several:

```json
{
  "detail": "project 01933b5e-8a00-7000-8000-000000000001 is at version 2, not 1",
  "instance": "/projects/01933b5e-8a00-7000-8000-000000000001",
  "request_id": "<the response's X-Request-Id>",
  "status": 412,
  "title": "Precondition Failed",
  "type": "about:blank"
}
```

The scenario is one long-lived instance. Its three projects are seeded when the module starts,
under fixed ids at version 1, and kept in memory for the instance's life: a create is listed and
readable by later Runs, and an update raises the version a later stale update is refused against.
Stop, or a reload, starts a new instance from the seed again.

The handler calls the Router in-process. It reads the request's text with net/http's own
`ReadRequest`, calls the Router's `ServeHTTP` with an in-memory response recorder, and prints what
was recorded, so the request goes through the same Router, middleware, and handlers a server would
run, with no listener, connection, or network between them.

## How the page is made

The page is written in the spike's own `markdown/` directory and rendered by the hosting SDK's
Markdown pages. The demo is raw HTML around the fence: an `sl-go-demo` naming its scenario,
`websdk`, its handler, `request`, and its file, `request.http`, which names the fence, since a
rendered fence carries no name of its own. The fence names no language, so the build leaves it
plain, and the editor has no grammar for `.http`, so the request shows as plain text before the
demo upgrades and after. The requests to try are `http` fences, which the build highlights. The
shell's script gives the demo the page's one runner, the same runtime and bridge the hand pages
use, and the first Run fetches the worker and the scenario's module; each Run after it calls the
instance already loaded, fetching nothing.
