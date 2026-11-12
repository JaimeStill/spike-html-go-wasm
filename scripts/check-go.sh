#!/usr/bin/env bash
# The check's Go lint, the module under GOOS=js GOARCH=wasm, which every entrypoint is built for:
# gofmt, go vet, go fix, go mod tidy, and golangci-lint (.golangci.yml), each failing on what it
# finds, without -race, which js/wasm doesn't support. Then the runtime's wasm_exec.js, which must
# be the pinned Go's lib/wasm/wasm_exec.js byte for byte below its one provenance line, so a Go
# bump fails here until it's recopied; and no .wasm or .a archive tracked in git, the build's
# output alone.
# Then the module's Go tests, run as wasm under node twice: on node's fs, by the pinned Go's
# lib/wasm/go_js_wasm_exec, all but test/memfs, which refuses any fs but the runtime's; and on the
# runtime's in-memory fs, web/runtime/fs.ts, by scripts/go-memfs-exec.sh, every package.
# Reads no network (GOPROXY=off, GOTOOLCHAIN=local); writes nothing outside Go's caches and TMPDIR.
# Adapted from go-core (f1686fb): mise.toml, its check task, for one module, under GOOS=js, with
# no build.
set -euo pipefail

export GOOS=js GOARCH=wasm GOWORK=off GOPROXY=off GOTOOLCHAIN=local

# The module's own package directories, never node_modules/, whose packages may carry Go files,
# and never dist/, which go.mod's ignore directive keeps out of ./... while Vite empties it.
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

# wasm_exec.js caps the test binary's argv and environment together at 12 KB, and the go command
# passes its whole environment on, so the tests run under env -i with only what go and node need:
# PATH to the pinned go and node and the system's tools, HOME, Go's caches, and TMPDIR. A handler
# that blocks the event loop deadlocks the instance rather than failing a test, so -timeout bounds
# the run.
# The in-memory run never takes a cached result (-count=1), which go test might otherwise reuse
# from the run on node's fs.
path="$(dirname "$(command -v go)"):$(dirname "$(command -v node)"):/usr/bin:/bin"
trimmed=(env -i PATH="$path" HOME="$HOME" TMPDIR="${TMPDIR:-/tmp}"
  GOCACHE="$(go env GOCACHE)" GOMODCACHE="$(go env GOMODCACHE)"
  GOOS=js GOARCH=wasm GOWORK=off GOPROXY=off GOTOOLCHAIN=local)
module=$(go list -m)
mapfile -t on_node < <(go list ./... | grep -vx "$module/test/memfs")
"${trimmed[@]}" go test -timeout=1m -exec "$(go env GOROOT)/lib/wasm/go_js_wasm_exec" "${on_node[@]}"
"${trimmed[@]}" go test -count=1 -timeout=1m -exec "$PWD/scripts/go-memfs-exec.sh" ./...

tracked=$(git ls-files '*.wasm' '*.a')
if [[ -n "$tracked" ]]; then
  printf 'a .wasm or an archive is tracked; the build writes it to dist/:\n%s\n' "$tracked" >&2
  exit 1
fi
