#!/usr/bin/env bash
# The site build's Go step, after Vite's, which empties dist/ (vite.config.ts): each entrypoint
# built for GOOS=js GOARCH=wasm by the pinned Go, into dist/go/<name>.wasm, which the preview and
# Pages serve at <base>go/ and the runtime's worker fetches. wasm_exec.js isn't copied there: Vite
# bundles the committed web/runtime/wasm_exec.js into the worker. -trimpath and -s -w keep the build free of local paths and of the symbol and DWARF tables. Reads no network
# (GOPROXY=off, GOTOOLCHAIN=local); writes dist/go/.
set -euo pipefail

export GOOS=js GOARCH=wasm GOWORK=off GOPROXY=off GOTOOLCHAIN=local

mkdir -p dist/go
for name in hello probe; do
  go build -trimpath -ldflags="-s -w" -o "dist/go/$name.wasm" "./cmd/$name"
done
