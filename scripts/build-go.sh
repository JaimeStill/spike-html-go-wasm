#!/usr/bin/env bash
# The site build's Go step, after Vite's, which empties dist/ (vite.config.ts): cmd/'s
# entrypoints, hello, probe, sqlate, and websdk, built for GOOS=js GOARCH=wasm by the pinned Go
# into dist/go/<name>.wasm (scripts/build-go-modules.sh), which the preview and Pages serve at
# <base>go/ and the runtime's worker fetches; never playground/'s programs, the starter, calc, the
# others the Program select offers, sqlate, which the sqlate page builds from source, and graph,
# which go-core-graph.html builds from source, each vetted and tested by the check
# (scripts/check-go.sh). wasm_exec.js isn't copied there: Vite bundles the
# committed web/runtime/wasm_exec.js into the worker. Then the playground's toolchain, Go's compiler
# and linker, the standard library's archives and the site's pinned modules', and their manifest,
# into dist/go/toolchain/ (scripts/build-toolchain.ts). Reads no network (GOPROXY=off,
# GOTOOLCHAIN=local); writes dist/go/.
set -euo pipefail

scripts/build-go-modules.sh dist/go
node scripts/build-toolchain.ts dist/go/toolchain
