<!-- Adapted from spike-html-hosting-sdk (v0.6.1): template/README.md, its site a hand index with
     no copied tree. -->

# spike-html-go-wasm

The GitHub Pages site of
spike-html-go-wasm,
made from the template of
[spike-html-hosting-sdk](https://github.com/JaimeStill/spike-html-hosting-sdk) v0.6.1.
Its index, `index.html`, is a hand page, served under `/spike-html-go-wasm/`.
The site copies no Markdown tree: `content.json` records none, and `content/` holds nothing.
The spike's question, evidence, and path are in `context/README.md`.

## Tasks

- `mise run install`: install the pinned tools and node_modules; reads the network.
- `mise run check`: ESLint, with the check that no CSS module script is left in the build and
  the web tiers' import direction; Prettier, shellcheck, and actionlint; the Go lint under
  `GOOS=js GOARCH=wasm`, with `wasm_exec.js` held to the pinned Go's and no `.wasm` tracked;
  tsc's type check; the site and Go builds; the unit tier, `content/` against `content.json`, both
  layer-direction checks, go.mod's by-tag rule, and the currency and live commands' logic; and the
  browser tier, the SDK's checks on the build and the Go module run in the pinned
  chrome-headless-shell. It reads no network.
- `mise run screenshots`: capture the pages, light and dark, at 390px, 1120px, and 1376px.
- `mise run currency`: every pin behind its latest, the SDK's tag and go.mod's direct
  requirements among them.
- `mise run live [base URL]`: the deployed site, at its Pages URL or the base given: the index
  answers as HTML, and `go/hello.wasm` as `application/wasm`, gzip-encoded; reads the network,
  and isn't part of the check.

## Keeping pace with the SDK

The SDK is pinned by its release tag, in `package.json` and in both workflows'
`uses:` lines. To move to a newer release, bump the tag in all three, run `pnpm install`, and run
`mise run check`.
