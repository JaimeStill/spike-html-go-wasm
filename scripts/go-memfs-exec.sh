#!/usr/bin/env bash
# go test's -exec for the Go tests on the runtime's in-memory fs: scripts/go-memfs-exec.ts under
# node, with the V8 stack the pinned Go's lib/wasm/go_js_wasm_exec gives a test binary.
set -euo pipefail
exec node --stack-size=8192 "$(dirname "${BASH_SOURCE[0]}")/go-memfs-exec.ts" "$@"
