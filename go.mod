module github.com/JaimeStill/spike-html-go-wasm

go 1.27

// The build's output is never a package: ./... skips it, so the check's go commands never walk
// dist/ while Vite empties it in parallel (mise run check).
ignore ./dist
