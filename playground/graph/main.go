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
