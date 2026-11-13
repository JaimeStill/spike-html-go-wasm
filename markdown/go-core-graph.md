# Wire a service on go-core's graph

This page is Markdown, rendered at build into the site's Markdown shell. The program below is an
ordinary `go` fence, and the live demo around it builds it from source in the page: press Run, or
<kbd>Ctrl+Enter</kbd> in the editor, and the page fetches Go's compiler and linker, built for
WebAssembly, and the archives of the packages the program imports, go-core's `graph` and
`lifecycle` among them, then compiles, links, and runs it. Nothing loads until the first Run.

## The program

<sl-go-demo source file="main.go" label="graph demo">

```go
// Command graph wires a small service on go-core's graph and runs it under lifecycle's
// Coordinator. wire describes the service's nodes, which construct nothing yet: the settings, a
// fixed Value; the router, a Fresh, new and empty in each Build; the store; two routes in the
// routes Group; and the server, ordered After the routes. Build constructs what its roots reach,
// each constructor reaching its dependencies through Use, and run prints the System's layers.
// The Coordinator then starts each layer in order and stops them in reverse: the store and the
// server print their start and their stop.
//
// A constructor that returns an error fails the Build: the program prints graph's message, which
// names the node, and exits 1. A wiring mistake, such as a dependency cycle, makes Build panic.
package main

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/standards-lab/go-core/graph"
	"github.com/standards-lab/go-core/lifecycle"
)

// Settings is the service's configuration.
type Settings struct {
	Addr, DSN string
}

// Router collects the routes the server serves.
type Router struct{ routes []string }

// Handle adds a route.
func (r *Router) Handle(route string) { r.routes = append(r.routes, route) }

// Store is the service's database: it starts and stops, so the Coordinator runs it.
type Store struct{ dsn string }

func (s *Store) Start(context.Context) error {
	fmt.Println("start store:", s.dsn)
	return nil
}

func (s *Store) Shutdown(context.Context) error {
	fmt.Println("stop store")
	return nil
}

// Server serves the router's routes on its address.
type Server struct {
	addr   string
	router *Router
}

func (s *Server) Start(context.Context) error {
	fmt.Printf("start server: %s %s\n", s.addr, strings.Join(s.router.routes, ", "))
	return nil
}

func (s *Server) Shutdown(context.Context) error {
	fmt.Println("stop server")
	return nil
}

// Service holds the handles wire defines: what Build takes as roots, and what a test replaces.
type Service struct {
	Settings *graph.Node[Settings]
	Router   *graph.Node[*Router]
	Store    *graph.Node[*Store]
	Routes   *graph.Group
	Health   *graph.Node[string]
	Projects *graph.Node[string]
	Server   *graph.Node[*Server]
}

// wire describes the service on a new Graph. A route adds itself to the router, and the server,
// ordered After the routes without using them, sits in the layer above theirs.
func wire() (*graph.Graph, *Service) {
	g := graph.New()
	s := &Service{Routes: g.Group("routes")}
	s.Settings = g.Value("settings", Settings{Addr: ":8080", DSN: "postgres://db/app"})
	s.Router = g.Fresh[Router]("router")
	s.Store = g.Define("store", func(sc *graph.Scope) (*Store, error) {
		return &Store{dsn: sc.Use(s.Settings).DSN}, nil
	})
	route := func(pattern string) func(*graph.Scope) (string, error) {
		return func(sc *graph.Scope) (string, error) {
			sc.Use(s.Store)
			sc.Use(s.Router).Handle(pattern)
			return pattern, nil
		}
	}
	s.Health = g.Define("health", route("GET /healthz"), graph.In(s.Routes))
	s.Projects = g.Define("projects", route("GET /projects"), graph.In(s.Routes))
	s.Server = g.Define("server", func(sc *graph.Scope) (*Server, error) {
		return &Server{addr: sc.Use(s.Settings).Addr, router: sc.Use(s.Router)}, nil
	}, graph.After(s.Routes))
	return g, s
}

func main() {
	os.Exit(run(wire()))
}

// run builds the service from its roots, prints its layers, and runs it, answering the exit code.
func run(g *graph.Graph, s *Service) int {
	sys, err := g.Build(s.Routes, s.Server)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	fmt.Printf("%s\n\n", sys)

	var cfg lifecycle.Config
	if err := cfg.Finalize(""); err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	err = lifecycle.New(sys, cfg).Exec(context.Background(), func(context.Context) error {
		fmt.Println("ready")
		return nil
	})
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		return 1
	}
	return 0
}
```

</sl-go-demo>

The program wires a small service, a router, a store, two routes, and a server, prints the layers
graph built it in, then runs it: each part with a start prints it in layer order, and each with a
stop prints it in reverse. Edit `main.go` and run it again: the page compiles and links the edit.

Make the store's constructor fail, and the Build fails before anything starts: the program prints
graph's message, which names the node, `store: connection refused`, and exits 1.

```go
s.Store = g.Define("store", func(sc *graph.Scope) (*Store, error) {
	return nil, fmt.Errorf("connection refused")
})
```

Add a route that uses the server, in `wire` before it returns, and the routes and the server form a
cycle, since the server is ordered after every route. A cycle is a wiring mistake, so Build panics,
graph's message naming the cycle's path, `server -> routes -> status -> server`, and the program
exits 2.

```go
g.Define("status", func(sc *graph.Scope) (string, error) {
	sc.Use(s.Server)
	return "GET /status", nil
}, graph.In(s.Routes))
```

## How graph describes it

A `Graph` describes nodes and constructs nothing until `Build`. Each node is a name and a
constructor, and each call that adds one returns a typed handle the rest of the program names it by:

- `Define` adds a node with its constructor, which receives a `Scope` and answers the node's value
  or an error.
- `Value` adds a node whose value is a fixed value in every Build: here the settings.
- `Fresh` adds a node whose value is a new, empty pointer in each Build: here the router, which the
  routes fill.
- `Use`, a Scope's, answers a dependency's value, building it first if this Build hasn't, and
  records the edge. The edges are discovered as the constructors run, and a node shared by several
  dependents is built once.
- `After` orders a node after nodes or a group without using their values: the server is after the
  routes, so every route has reached the router before the server reads it.
- `In` makes a node a member of a group, which `Group` defines; a group stands for its members, as
  a root or as an After's target.

`Build` takes the roots, here the routes group and the server, and constructs what they reach into
a `System`, its nodes in layers: every node's dependencies, used or ordered After, sit in lower
layers. The System prints its layer table, one line a layer:

| Layer | Nodes            | Why there                                               |
| ----- | ---------------- | ------------------------------------------------------- |
| 0     | settings, router | they depend on nothing                                  |
| 1     | store            | it uses the settings                                    |
| 2     | health, projects | each uses the store and the router                      |
| 3     | server           | it uses the settings and the router, after the routes   |

A constructor's error fails the Build, its message labelled with the node's name. A wiring mistake,
a dependency cycle among them, makes Build panic with a message that begins `graph:`.

## How lifecycle runs it

lifecycle's `Coordinator` runs one System. A node takes part through its value's methods: a value
with `Start` starts, and one with `Shutdown` stops; the store and the server have both, and the
settings, the router, and the routes take no part. `Exec` starts the layers lowest first, a layer
starting only once the one below it has, runs its function, here the line `ready`, and then stops
the layers in reverse, so the server stops before the store it was started over.

## How the page is made

The page is written in the spike's own `markdown/` directory and rendered by the hosting SDK's
Markdown pages. The demo is raw HTML around the fence: an `sl-go-demo` marked `source`, naming no
scenario and no handler, since the program is its file, and naming that file `main.go`, since a
rendered fence carries no name of its own. The fence is the program's `main.go` byte for byte. The
shell's script gives the demo the page's one runner, the same runtime and bridge the hand pages
use, and a Run builds the file in the page, as the playground does.
