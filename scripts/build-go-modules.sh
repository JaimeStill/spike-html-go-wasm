#!/usr/bin/env bash
# The Go entrypoints alone, into the directory given: each one under cmd/, hello, probe, sqlate,
# the compile handler sqlate-compile.html calls, and websdk, the request handler over go-web-sdk's
# Router that go-web-sdk-handlers.html calls, built for GOOS=js GOARCH=wasm by the pinned Go into
# <dir>/<name>.wasm. -trimpath and -s -w keep the build free of local paths and of the symbol and
# DWARF tables; Go stamps the checkout's commit, its time, and whether the tree is modified into
# each (vcs.revision, vcs.time, vcs.modified). The site build runs it into dist/go/
# (scripts/build-go.sh); mise run measure runs it twice into TMPDIR, each with a GOCACHE of its
# own, to hold two builds against each other (scripts/measure.ts). Runs from the repository's
# root, where go.mod is. Reads no network (GOPROXY=off, GOTOOLCHAIN=local); writes the directory
# and Go's caches.
set -euo pipefail

out=${1:?usage: scripts/build-go-modules.sh <dir>}

export GOOS=js GOARCH=wasm GOWORK=off GOPROXY=off GOTOOLCHAIN=local

mkdir -p "$out"
for name in hello probe sqlate websdk; do
  go build -trimpath -ldflags="-s -w" -o "$out/$name.wasm" "./cmd/$name"
done
