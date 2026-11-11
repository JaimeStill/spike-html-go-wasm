#!/usr/bin/env bash
# The check's Go lint, the module under GOOS=js GOARCH=wasm, which every entrypoint is built for:
# gofmt, go vet, go fix, go mod tidy, and golangci-lint (.golangci.yml), each failing on what it
# finds, without -race, which js/wasm doesn't support. Then the runtime's wasm_exec.js, which must
# be the pinned Go's lib/wasm/wasm_exec.js byte for byte below its one provenance line, so a Go
# bump fails here until it's recopied; and no .wasm tracked in git, the build's output alone.
# Reads no network (GOPROXY=off, GOTOOLCHAIN=local); writes nothing outside Go's caches.
# Adapted from go-core (f1686fb): mise.toml, its check task, for one module, under GOOS=js, with
# no build or test.
set -euo pipefail

export GOOS=js GOARCH=wasm GOWORK=off GOPROXY=off GOTOOLCHAIN=local

# The module's own package directories, never node_modules/, whose packages may carry Go files.
unformatted=$(go list -f '{{.Dir}}' ./... | xargs gofmt -l)
if [[ -n "$unformatted" ]]; then
  printf 'gofmt: unformatted files:\n%s\n' "$unformatted" >&2
  exit 1
fi
go vet ./...
go fix -diff ./...
go mod tidy -diff
golangci-lint run ./...

version=$(go env GOVERSION)
runtime=web/runtime/wasm_exec.js
provenance="// From go ($version): lib/wasm/wasm_exec.js"
if [[ "$(head -n 1 "$runtime")" != "$provenance" ]] \
  || ! tail -n +2 "$runtime" | cmp -s - "$(go env GOROOT)/lib/wasm/wasm_exec.js"; then
  echo "$runtime isn't $version's lib/wasm/wasm_exec.js below the line: $provenance" >&2
  echo "recopy it from \$(go env GOROOT)/lib/wasm/wasm_exec.js" >&2
  exit 1
fi

tracked=$(git ls-files '*.wasm')
if [[ -n "$tracked" ]]; then
  printf 'a .wasm is tracked; the build writes it to dist/:\n%s\n' "$tracked" >&2
  exit 1
fi
