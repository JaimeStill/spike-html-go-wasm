# goal · experiment.html.spike-html-go-wasm

- **State:** building
- **Task:** site
- **Branch:** site

## Tasks

1. [ ] site
2. [ ] runtime
3. [ ] components
4. [ ] playground
5. [ ] programs
6. [ ] sqlate
7. [ ] scenarios
8. [ ] measure
9. [ ] review
10. [ ] answer

## Task brief · site

Problem       No site, Go module, or build yet. Every later task needs a Pages project site on
              spike-html-hosting-sdk v0.6.1, the Elemental layers with both direction checks, Go
              built for GOOS=js in the check and the Pages workflow, and wasm_exec.js with its
              provenance (evidence 1, 6).
Behaviors     1. Scaffolded from SDK v0.6.1; template files carry a provenance line ending in the
                 SDK tag. SDK, foundation v0.3.0, tooling v0.3.0, components v0.5.0, icons v0.1.0
                 pinned by tag; everything else at latest (vite 8.3.8, prettier 3.10.0, eslint
                 10.14.0, boundaries 7.4.2, import-x 4.18.1, typescript-go 7.0.2, actionlint
                 1.7.12, golangci-lint 2.15.0, chrome-headless-shell 157.0.8103.50).
              2. `mise run check` reads no network and runs ESLint (incl. the SDK's leftover check),
                 Prettier, shellcheck, actionlint; gofmt, vet, go fix -diff, go mod tidy -diff,
                 golangci-lint under GOOS=js GOARCH=wasm; types; Go + site builds; unit + browser
                 tiers. A missing tool/module fails naming `mise run install`, which fetches both.
              3. The build writes the site under /spike-html-go-wasm/: hand index, plus a stdlib
                 hello built by the pinned Go for js/wasm at a stable path beside wasm_exec.js. No
                 .wasm is tracked; the check fails if one is.
              4. The hand index passes every SDK shell check, the crawl reaches it, and it requests
                 no Go module.
              5. Under the SDK preview, hello answers 200 with application/wasm and, run in
                 chrome-headless-shell through the committed wasm_exec.js, prints its line.
              6. wasm_exec.js is byte-for-byte the pinned Go's lib/wasm copy below one provenance
                 line naming the release; the check fails when they differ; Prettier/ESLint skip it.
              7. An ESLint boundaries table holds the web direction (components ↛ runtime/pages;
                 runtime ↛ pages/components; pages → both; each tier only its listed packages); a
                 unit test lints a fixture tree, exact rules per forbidden case, none per allowed.
              8. A `go list` test under GOOS=js holds the Go direction (cmd/<s> → only
                 internal/<s>; internal/<s> ↛ other scenarios or cmd/; bridge ↛ internal/, cmd/);
                 passes on the module and names each planted violation in a fixture module.
              9. The check fails on any replace directive or local-path requirement in go.mod.
              10. `mise run currency` reports what the SDK bin reports plus each go.mod requirement
                  behind latest as `go.mod: MODULE PIN -> LATEST`; silent and exit 0 when current.
              11. PRs run the SDK site CI; a push to main runs the SDK Pages deploy; the site is live
                  at https://jaimestill.github.io/spike-html-go-wasm/.
              12. A live command (network, outside the check) asserts the index 200 and hello 200
                  application/wasm under the base, gzip-encoded when asked.
              13. The header carries no site nav, only its header-actions group; the SDK shell
                  checks pass without one.
              14. `mise run screenshots` captures the index at the SDK widths, light and dark, and
                  leaves no capture file; the browser tier proves it.
Test seams    `mise run check` (unit + browser tiers over the built site under its base) for 1–11,
              13, 14; the live command for 12.
Slices        1. Site scaffold: template over the repo, hand index, no site nav, pins at latest, CI
                 and Pages callers, JS-side check green.
              2. Go for js: module, hello, wasm_exec.js + byte check, Go lints, build into the site;
                 browser tier proves application/wasm and the printed line.
              3. Direction checks: boundaries table + fixture tree, go list test + fixture module,
                 by-tag go.mod check.
              4. Currency over go.mod.
              5. Pages live: enable Pages (Actions source), first merge deploys, live command passes.
              (No upgrade slice: the repo is current.)
Out of scope  bridge, loader, worker, in-memory fs, Stop; components and specimen page; playground;
              any workspace module demo or requirement; TinyGo and all size/timing measurement;
              any change to the SDK, components' site list, or any reference repository.
Door          two-way — enabling Pages and the first deploy publish a public site, which can be
              unpublished; nothing tagged.

## Progress

slices 4/5 committed · standards — · spec — · editor —

## Decisions

- setup: one repository, one Go module, one Pages project site scaffolded from
  spike-html-hosting-sdk v0.6.1, laid out in Elemental layers (Go bridge, scenario composition
  roots and entrypoints, the web runtime, components, pages), with the check holding the web
  tiers' import direction by an ESLint boundaries table, as spike-html-apps did, and the Go
  direction by a `go list` test. Rejected: layer repositories; this spike settles Go WASM
  conventions, and the intake decides what moves to the SDK and documentation components layer.
- setup: standard Go 1.27.4 ships; TinyGo 0.44.0 builds the same demos as a comparison.
- setup: sizes are measured and reported, never gated; the spike focuses on capability and
  performance. Measured at setup (Go 1.27.4, `-s -w`): hello 706 KB gzip, the sqlate compile demo
  1.20 MB gzip, a bare net/http handler 1.61 MB gzip; Pages serves gzip, not brotli.
- setup: modules load only when the reader starts a demo.
- setup: one plain worker per page over the HTTP cache; the playground switches programs in place;
  Stop terminates the worker and reposts the compiled module to a fresh one. Measured in Chrome
  157: a cached reload downloads 0 B, compiles the wasm in ~66 ms and instantiates in ~7 ms; a
  warm compiler compiles hello in ~35 ms and links in ~170 ms. Rejected: SharedWorker with
  `extendedLifetime` (Chrome 148+ only; survived ≥40 s idle, gone by 70 s), a service worker
  (saves one 304 round trip; Pages sends max-age=600 + ETag), and storing the compiled module in
  IndexedDB (DataCloneError in Chrome 157).
- setup: the playground runs Go's own `cmd/compile` and `cmd/link` built to wasm in the worker,
  over an in-memory `globalThis.fs`, with the whole standard library plus sqlate, go-core, and
  go-web-sdk as per-package archives fetched per import through a manifest. Measured under node:
  compile + link + run of hello in 0.8 s; compiler 10.5 MB and linker 3.3 MB gzip; the Tour's
  imports 5.6 MB gzip of archives, the full standard library 33.6 MB. Rejected: the yaegi
  interpreter v0.16.3 (stdlib to go1.22, a generic Map fails, a 10M-step loop takes 4.1 s), the
  play.golang.org remote service (its terms ask for a unique user agent a page can't set), and
  GopherJS (pinned to go1.21).
- setup: under `GOOS=js`, GOMAXPROCS is 1: sleeps, channels, select, and mutexes behave as
  natively, but CPU work doesn't run in parallel and nothing preempts a busy loop, so Stop must
  terminate the worker.
- setup: Go scenarios: four programs of our own run from source in the playground (basics:
  structs, methods, function values, interfaces; generics: constraints, a generic type,
  range-over-func iterators; concurrency: goroutines, channels, select, WaitGroup, a pipeline,
  noting GOMAXPROCS 1; standard library: json, text/template, slices, regexp, errors.Is/As),
  beneath three workspace demos: sqlate (compile plus an in-process sqltest run), go-core graph,
  and go-web-sdk handlers called in-process. Rejected: porting A Tour of Go's lessons.
- setup: reusable components, Lit, `sl-` prefix, each one feature area: sl-code-editor,
  sl-file-tabs, sl-console, sl-run-controls, sl-timings, and sl-go-demo composing them over a
  runner the page passes in; no component imports the runtime.
- setup: the editor is `contenteditable="plaintext-only"` with Shiki 4.6.0 tokens painted as CSS
  Custom Highlight ranges, on the SDK's palette themes. Measured in Chrome 157: ~10 ms a keystroke
  on 296 lines; Enter, Tab via insertText, undo/redo, and IME held; exposed as a multiline
  textbox. Degrades: `::highlight` paints colour only, so Catppuccin and Everforest lose their
  italics; needs Firefox 140 and Safari 17.2, untested there. Rejected: a transparent textarea
  over a highlighted layer, and EditContext (Chrome only).
- setup: Markdown pages embed `<sl-go-demo scenario="…">` wrapping an ordinary go fence; the
  shell's entry defines the element on every page and loads Go only on demand. Works with SDK
  v0.6.1's markdownPages unchanged.
- setup: the evidence is the twelve items in `context/README.md`, "The evidence".
- setup: kind code, check `mise run check`, currency `mise run currency`, no gate, github remote,
  merge `gh pr checks --watch && gh pr merge --merge --delete-branch`, and a `[remote] ci` that
  waits for the push run, the Pages deploy, as spike-html-hosting.
- setup: toolchain at init: go 1.27.4, node 26.13.0, pnpm 12.19.0, shellcheck 0.11.0, tinygo
  0.44.0; the site task adds the SDK's toolchain (Vite, typescript-go, ESLint, Prettier,
  actionlint, chrome-headless-shell).
- setup: references: sqlate, go-core, and go-web-sdk at their latest release when each task
  plans (graph-ergonomics is updating the Go stack; the architect flags a critical release);
  spike-html-hosting-sdk v0.6.1, -components v0.5.0, -icons v0.1.0, spike-html-apps-foundation
  v0.3.0, spike-html-apps-tooling v0.3.0, spike-html-hosting at 421254d, and spike-html-apps at
  dae9a77.
- site: the session enables GitHub Pages with GitHub Actions as its source, before the first merge
  to main.
- site: the first GOOS=js program is a standard-library hello, the measure task's baseline; the
  by-tag rule on go.mod is enforced now, and the sqlate task is the first to require a workspace
  module.
- site: golangci-lint 2.15.0 with go-core's standard set, beside vet, gofmt, go fix -diff, and go
  mod tidy -diff, all under GOOS=js GOARCH=wasm; no -race, which js doesn't support.
- site: the index is a hand page holding the spike's question and evidence, markdownPages on an
  empty tree list; the Markdown shell arrives with the sqlate task.
- site: no header site nav. The SDK v0.6.1 shell checks treat sl-site-nav as optional, and this
  site isn't in components v0.5.0's built list. Rejected: a sites list served under the base.

## Notes

- sqlate's own currency trails (pgx 5.12.0, golangci-lint 2.15.0, mise go 1.27.4); that belongs to
  the goal that next locks sqlate.
- spike-html-hosting-sdk's markdownPages has no hook for marked extensions; an intake candidate.
- A browser running a wasm build is another runtime layer; this spike's answer bears on the
  `elemental-runtime-layers` backlog goal.
- `GOOS=js` go test under node needs a trimmed environment: wasm_exec.js caps argv+env at 12 KB,
  and mise's environment overflows it.

## Pending edits

- none
