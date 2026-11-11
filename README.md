<!-- Adapted from spike-html-hosting-sdk (v0.6.1): template/README.md, its site a hand index with
     no copied tree. -->

# spike-html-go-wasm

The GitHub Pages site of spike-html-go-wasm, made from the template of
[spike-html-hosting-sdk](https://github.com/JaimeStill/spike-html-hosting-sdk) v0.6.1. Its index,
`index.html`, is a hand page served under `/spike-html-go-wasm/`. The site copies no Markdown
tree: `content.json` records none, and `content/` holds nothing. The spike's question, evidence,
and path are in `context/README.md`.

## Tasks

- `mise run install`: install the pinned tools, node_modules, and go.mod's requirements; reads
  the network.
- `mise run check`: run every check, reading no network. It lints with ESLint (the web tiers'
  import direction, and the check that the build left no CSS module script), Prettier,
  shellcheck, and actionlint. It lints the Go module under `GOOS=js GOARCH=wasm` and fails unless
  `web/runtime/wasm_exec.js` matches the pinned Go's copy and no `.wasm` is tracked. It
  type-checks with tsc and runs `mise run build`. The unit tier checks `content/` against
  `content.json`, both layer directions, go.mod's by-tag rule, and the currency and live
  commands' logic; the browser tier runs the SDK's checks on the build and runs the Go module in
  the pinned chrome-headless-shell.
- `mise run build`: build the site with Vite into `dist/`, then the Go entrypoints into
  `dist/go/` beside `wasm_exec.js`. A bare `vite build` omits the wasm.
- `mise run screenshots`: capture the pages, light and dark, at 390px, 1120px, and 1376px.
- `mise run currency`: report every pin behind its latest, the SDK's tag and go.mod's direct
  requirements among them.
- `mise run live [base URL]`: check that the deployed site, at its Pages URL or the base given,
  serves the index as HTML and `go/hello.wasm` as `application/wasm`, gzip-encoded. It reads the
  network and isn't part of the check.

## Keeping pace with the SDK

The SDK is pinned by its release tag, in `package.json` and in both workflows' `uses:` lines.
To move to a newer release, bump the tag in all three, run `pnpm install`, and run
`mise run check`.
