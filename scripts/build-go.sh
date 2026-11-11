#!/usr/bin/env bash
# The site build's Go step, after Vite's, which empties dist/ (vite.config.ts): each entrypoint
# built for GOOS=js GOARCH=wasm by the pinned Go, into dist/go/<name>.wasm, beside the committed
# web/runtime/wasm_exec.js, so the preview and Pages serve both at <base>go/. -trimpath and
# -s -w keep the build free of local paths and of the symbol and DWARF tables. Reads no network
# (GOPROXY=off, GOTOOLCHAIN=local); writes dist/go/.
set -euo pipefail

export GOOS=js GOARCH=wasm GOWORK=off GOPROXY=off GOTOOLCHAIN=local

mkdir -p dist/go
go build -trimpath -ldflags="-s -w" -o dist/go/hello.wasm ./cmd/hello
cp web/runtime/wasm_exec.js dist/go/wasm_exec.js
