//go:build js && wasm

package websdk

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"slices"
	"strconv"
	"sync"
	"uuid"

	"github.com/standards-lab/go-web-sdk"
	"github.com/standards-lab/go-web-sdk/middleware"
)

// project is the sample resource: its id, a UUID; its code and name, which a create sets and an
// update replaces; and its version, 1 at create and one more at each update, which an update's
// If-Match names.
type project struct {
	ID      string `json:"id"`
	Code    string `json:"code"`
	Name    string `json:"name"`
	Version int64  `json:"version"`
}

// draft is a create's or an update's body: the fields a request may set, and no others.
type draft struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

// seed is the projects the instance starts with, fixed rows under fixed ids, so a reader's first
// list is always the same; a Stop or a reload, a new instance, starts from them again.
func seed() []project {
	return []project{
		{ID: "01933b5e-8a00-7000-8000-000000000001", Code: "ATLAS", Name: "Atlas", Version: 1},
		{ID: "01933b5e-8a00-7000-8000-000000000002", Code: "BOREAL", Name: "Boreal", Version: 1},
		{ID: "01933b5e-8a00-7000-8000-000000000003", Code: "CINDER", Name: "Cinder", Version: 1},
	}
}

// limits is the list's paging policy: 10 a page unless a request names a size, at most 50, by
// page number alone.
var limits = web.Limits{DefaultSize: 10, MaxSize: 50}

// bodyLimit bounds a create's or an update's JSON body.
const bodyLimit = 64 << 10

// newRouter is the scenario's Router: the projects Group compiled into a Module and mounted under
// RequestID and Recoverer, on the Router itself so a miss, which reaches no route, carries a
// request id too. Every problem is go-web-sdk's: its own errors map themselves, and the store's
// two, an unknown id and a stale version, map by this package's matchers, their text the detail.
func newRouter(logger *slog.Logger, rows []project) *web.Router {
	s := newStore(rows)
	ew := web.NewErrorWriter(logger,
		func(err error) (web.Problem, bool) {
			_, ok := errors.AsType[*notFoundError](err)
			return web.Problem{Status: http.StatusNotFound}, ok
		},
		func(err error) (web.Problem, bool) {
			_, ok := errors.AsType[*staleError](err)
			return web.Problem{Status: http.StatusPreconditionFailed}, ok
		},
	)
	ew.Detail(http.StatusNotFound, http.StatusPreconditionFailed)

	g := web.NewGroup("/projects")
	g.SetErrorWriter(ew)
	g.HandleErr(http.MethodGet, "", s.list)
	g.HandleErr(http.MethodPost, "", s.create)
	g.HandleErr(http.MethodGet, "/{id}", s.get)
	g.HandleErr(http.MethodPut, "/{id}", s.update)

	router := web.NewRouter()
	router.Use(middleware.RequestID(middleware.RequestIDOptions{}), middleware.Recoverer(logger))
	router.Mount(web.NewModule(g))
	return router
}

// notFoundError is a request for an id the store doesn't hold: a 404.
type notFoundError struct{ id string }

func (e *notFoundError) Error() string { return fmt.Sprintf("no project %s", e.id) }

// staleError is an update whose If-Match names a version other than the project's: a 412.
type staleError struct {
	id             string
	named, current int64
}

func (e *staleError) Error() string {
	return fmt.Sprintf("project %s is at version %d, not %d", e.id, e.current, e.named)
}

// store is the projects, in the order they were made, kept for the instance's life behind a
// mutex: the bridge runs each call in its own goroutine.
type store struct {
	mu   sync.Mutex
	rows []project
}

func newStore(rows []project) *store { return &store{rows: rows} }

// find is the index of the project with id, or -1; the caller holds the mutex.
func (s *store) find(id string) int {
	for i, p := range s.rows {
		if p.ID == id {
			return i
		}
	}
	return -1
}

// list answers GET /projects: the page ParseQuery's page and size name, in NewPage's envelope,
// with the total counted.
func (s *store) list(w http.ResponseWriter, r *http.Request) error {
	q, err := web.ParseQuery(r.URL.Query(), limits)
	if err != nil {
		return err
	}
	s.mu.Lock()
	total := len(s.rows)
	start := min((q.Page-1)*q.Size, total)
	end := min(start+q.Size, total)
	items := slices.Clone(s.rows[start:end])
	s.mu.Unlock()
	return web.WriteJSON(w, http.StatusOK, web.NewPage(items, q, web.Paging{
		Total: &total,
		More:  end < total,
	}))
}

// get answers GET /projects/{id}: the project, with its version as its ETag, the If-Match an
// update names.
func (s *store) get(w http.ResponseWriter, r *http.Request) error {
	id, err := web.PathUUID(r, "id")
	if err != nil {
		return err
	}
	s.mu.Lock()
	i := s.find(id)
	var p project
	if i >= 0 {
		p = s.rows[i]
	}
	s.mu.Unlock()
	if i < 0 {
		return &notFoundError{id: id}
	}
	return writeProject(w, http.StatusOK, p)
}

// create answers POST /projects: the body's code and name as a new project under a new UUIDv7, at
// version 1, 201 with its Location.
func (s *store) create(w http.ResponseWriter, r *http.Request) error {
	d, err := web.DecodeJSON[draft](w, r, bodyLimit)
	if err != nil {
		return err
	}
	p := project{ID: uuid.NewV7().String(), Code: d.Code, Name: d.Name, Version: 1}
	s.mu.Lock()
	s.rows = append(s.rows, p)
	s.mu.Unlock()
	w.Header().Set("Location", "/projects/"+p.ID)
	return writeProject(w, http.StatusCreated, p)
}

// update answers PUT /projects/{id}: with If-Match naming the project's version, the body's code
// and name replace its own at the next version. IfMatch's own errors answer a missing (428) or a
// malformed (400) If-Match; a version other than the project's is stale (412).
func (s *store) update(w http.ResponseWriter, r *http.Request) error {
	id, err := web.PathUUID(r, "id")
	if err != nil {
		return err
	}
	version, err := web.IfMatch(r)
	if err != nil {
		return err
	}
	d, err := web.DecodeJSON[draft](w, r, bodyLimit)
	if err != nil {
		return err
	}
	s.mu.Lock()
	i := s.find(id)
	var p project
	switch {
	case i < 0:
		err = &notFoundError{id: id}
	case s.rows[i].Version != version:
		err = &staleError{id: id, named: version, current: s.rows[i].Version}
	default:
		s.rows[i] = project{ID: id, Code: d.Code, Name: d.Name, Version: version + 1}
		p = s.rows[i]
	}
	s.mu.Unlock()
	if err != nil {
		return err
	}
	return writeProject(w, http.StatusOK, p)
}

// writeProject sends p as JSON with status and its version as a strong ETag, "3".
func writeProject(w http.ResponseWriter, status int, p project) error {
	w.Header().Set("ETag", strconv.Quote(strconv.FormatInt(p.Version, 10)))
	return web.WriteJSON(w, status, p)
}
