<!-- Adapted from spike-html-hosting-sdk (v0.6.2): template/README.md, its site a hand index with
     no copied tree. -->

# spike-html-go-wasm

The GitHub Pages site of spike-html-go-wasm, made from the template of
[spike-html-hosting-sdk](https://github.com/JaimeStill/spike-html-hosting-sdk) v0.6.2. Its index,
`index.html`, is a hand page served under `/spike-html-go-wasm/`, beside two more hand pages:
`runtime.html`, which runs Go through the runtime in `web/runtime/`, and `components.html`, the
components page, which shows the components in `web/components/` in each of their states. The site copies no Markdown
tree: `content.json` records none, and `content/` holds nothing. The spike's question, evidence,
and path are in `context/README.md`.

## Tasks

- `mise run install`: install the pinned tools, node_modules, and go.mod's requirements; reads
  the network.
- `mise run check`: run every check, reading no network. It lints with ESLint (the web tiers'
  import direction, and the check that the build left no CSS module script), Prettier,
  shellcheck, and actionlint. It lints the Go module under `GOOS=js GOARCH=wasm` and fails unless
  `web/runtime/wasm_exec.js` matches the pinned Go's copy and no `.wasm` is tracked. It runs the
  Go tests as wasm under node twice: on node's fs, and on the runtime's in-memory fs, where
  `test/memfs` drives it through package `os`. It type-checks the configs, the web tiers, and the
  suite with tsc and runs `mise run build`. The unit tier checks `content/` against
  `content.json`, both layer directions, go.mod's by-tag rule, the currency and live commands'
  logic, and the in-memory fs's error codes. The browser tier, in the pinned
  chrome-headless-shell, runs the SDK's checks on every hand page and the crawl, runs hello
  and the probe's handlers on the runtime page, and holds the code editor on the components
  page: its colors to the SDK's fences in every palette and scheme, its accessibility tree, its
  gutter, and its loading. It proves that Stop ends the probe's spin and the
  next call fetches nothing new, and that the probe's crash, a panic outside any handler, prints
  to stderr and exits 2.
- `mise run build`: build the site with Vite into `dist/`, the runtime's worker with
  `web/runtime/wasm_exec.js` bundled in it and the editor's syntax themes merged per palette
  (`scripts/syntax-themes.ts`), then the Go entrypoints into `dist/go/`. A bare `vite build`
  omits the wasm.
- `mise run screenshots`: capture the pages, light and dark, at 390px, 1120px, and 1376px.
- `mise run currency`: report every pin behind its latest, the SDK's tag and go.mod's direct
  requirements among them.
- `mise run live [base URL]`: check that the deployed site, at its Pages URL or the base given,
  serves the index as HTML and `go/hello.wasm` as `application/wasm`, gzip-encoded. It reads the
  network and isn't part of the check.

## Components

The components are Lit elements with shadow roots, prefixed `sl-`, in `web/components/`. Each
module defines its element when it is imported and exports its tag name as `tagName`; the
element's shadow root adopts the foundation's reset and elements sheets, then its own, a CSS
module script beside it. A page imports a component's module, and the build bundles it.
`components.html` shows each component's states, labelled, again at 20rem, and focused by the
keyboard.

- `./code-editor.js`: `sl-code-editor`, a plain-text source editor: a `contenteditable` element
  in plaintext-only mode, exposed as a multiline textbox, beside a gutter of line numbers. Its Go
  and JSON are highlighted by Shiki 4.6.0, through CSS Custom Highlight ranges, so no element
  ever enters the text and highlighting never moves the caret or the selection. The colors are
  each palette's syntax theme, the SDK's built-in ones, merged per palette at build into
  `light-dark()` colors, so each token takes the color the SDK's own fence of the same code gives
  it in every palette and scheme; a palette with no syntax theme shows the text plain. The
  `::highlight()` rules paint color only, so the italics of Catppuccin's and Everforest's comments
  don't show. The tokenizer, Shiki's core, its JavaScript regex engine, and the Go and JSON
  grammars, loads lazily as the first editor upgrades; until then, and for any other language,
  the text is plain. After an edit it re-highlights once typing pauses. Every editor on a page
  paints into the document's one set of highlights, and one removed leaves the others painted.
  Long lines wrap, and each number stays beside its line's first row at every width and profile.
  The gutter is hidden from assistive technology and holds no text: its numbers are generated
  content, outside the editable element. The editor grows with its text; a page that holds it to
  a block size gets a frame that scrolls inside.
  - Attributes: `language` (`go` or `json`; any other shows plain; reflected), `label` (the
    textbox's accessible name, "Code" by default), `readonly` (reflected), and `aria-labelledby`
    (ids in the host's tree whose elements name the textbox, taking precedence over `label`).
  - Properties: `value`, the whole text, which reading gives as edited and setting replaces,
    sending no event; and `language`, `label`, and `readonly`, as their attributes.
  - Events: none yet.
  - Slots: none.
  - Keyboard: it takes focus in the page's tab order and types as a plain-text field does. While
    `readonly` it takes no edit and is exposed as read-only, and keeps focus, selection, copy,
    and highlighting; Ctrl or Cmd+A selects its text alone.

## Keeping pace with the SDK

The SDK is pinned by its release tag, in `package.json` and in both workflows' `uses:` lines.
To move to a newer release, bump the tag in all three, run `pnpm install`, and run
`mise run check`.
