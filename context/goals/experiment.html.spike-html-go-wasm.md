# goal · experiment.html.spike-html-go-wasm

- **State:** idle
- **Task:** none
- **Branch:** none

## Tasks

1. [x] site
2. [x] runtime
3. [x] components
4. [x] playground
5. [x] programs
6. [x] sqlate
7. [x] scenarios
8. [x] measure
9. [ ] review
10. [ ] final-review
11. [ ] answer

## Task brief · measure

```
Problem       The spike's sizes and timings are local, partial, and taken by
              hand. Evidence 4 and 5 need what the live site actually serves
              and how fast it runs, on desktop and on an iPhone over Wi-Fi.
              The answer task and final-review read them; sqlate's 36 s cold
              Run on a phone is the one phone reading so far. The architect
              rejected the TinyGo comparison, because the spike's question is
              native Go. The unused TinyGo pin goes, and evidence 4 is restated
              without it.
Behaviors     1. TinyGo leaves the spike. No tool pin, comment, evidence item,
                 index text, or Path line names it. The goal record gains the
                 Decision "measure: TinyGo comparison rejected; the spike's
                 question is native Go. TinyGo can't build the sqlate module
                 (pgx's crypto/tls) or the playground's toolchain, and its
                 modules need TinyGo's own wasm_exec.js, not the runtime's."
                 The setup Decision naming TinyGo is marked superseded. The
                 roadmap's measure summary, minus "the TinyGo comparison",
                 joins the Pending edits. The check passes.
              2. `mise run measure` reads the live site, or a base URL given.
                 It is never part of the check and writes nothing outside
                 TMPDIR.
              3. Sizes: one row per shipped module (hello, probe, sqlate,
                 websdk, the compiler, and the linker), and one per closure,
                 one for each of the seven programs the site builds in the
                 page. Each row gives raw bytes, gzip bytes as Pages serves
                 them to the browser's Accept-Encoding, and brotli-11 bytes.
                 A closure row also gives its file count, which is the number
                 of requests a revalidation makes once max-age has expired.
              4. Reproducibility: the command reports whether two local builds
                 of each prebuilt module match byte for byte, and whether the
                 live module matches the local one. Where they differ, it
                 gives the byte counts. It reports the drift and never fails
                 on it.
              5. Desktop timings: the pinned chrome-headless-shell, launched
                 with the network allowed (the tooling's launch() resolves
                 loopback only), loads each demo page on the live site:
                 - "Page readable before the module": the page's first
                   contentful paint, and no .wasm requested before Run.
                 - "First result": the time from Run's click to the first
                   output.
                 - The run's phases as the timings table shows them (Fetch,
                   Wasm compile, Go compile, Link, Instantiate, Start, Run,
                   and the total).
                 Each is read in three states:
                 - cold: a fresh profile with an empty cache
                 - cached: a fresh page and worker within max-age, the
                   module from the HTTP cache with no bytes transferred
                 - in-place: a second request on the held worker. That is a
                   components-page scenario switch, a Markdown demo's rerun
                   on its held instance, a playground program switch, and an
                   edit to main.go rebuilt.
              6. Every desktop timing is the median and the max of five
                 readings. The command prints one table for sizes and one per
                 page for timings, and states the deployed commit it read and
                 the date.
              7. iPhone: the architect reads each demo's timings table on an
                 iPhone over Wi-Fi in the same three states, one reading each.
                 Cold is a fresh Private tab. Cached is a reload within 10
                 minutes. In-place is as in behavior 5. The architect records
                 phases and total, and whether the page was readable before
                 Run. BUILD collects these at a named point (see Slices).
              8. The spike's README gains a "Measurements" section. It is
                 dated, names the deployed commit and each device (machine
                 and network, iPhone model and Wi-Fi), and holds the size,
                 reproducibility, desktop, and iPhone tables. Evidence 4 and 5
                 point to it.
Test seams    The command's pure report layer, run in the unit tier on
              fixtures: weighing a response (raw, gzip as served, brotli-11),
              median and max over readings, a closure's revalidation count,
              the drift comparison, and the tables' formatting. The live run
              itself is evidence, never a test.
Slices        No upgrade slice: currency is current.
              1. TinyGo out (behavior 1): the check passes with no TinyGo pin,
                 and the Decision and the Pending edit are recorded.
                 Demo: mise lists no tinygo; the check passes.
              2. Sizes and drift (behaviors 2-4, sizes half of 6): mise run
                 measure prints the size table and the drift report from the
                 live site. Sizing adapts spike-html-hosting 421254d's cost
                 weighing.
                 Demo: the size table against the live site.
              3. Desktop timings (behaviors 5-6): the command adds the
                 per-page timing tables from five readings each. It reuses
                 the browser tier's demo helpers, in a browser launched with
                 the network allowed.
                 Demo: a full mise run measure.
              4. iPhone and the record (behaviors 7-8): at the start of this
                 slice the session stops and prints the architect a checklist,
                 one line per page and state, for the iPhone readings. The
                 architect replies with the numbers or screenshots. BUILD then
                 writes the Measurements section from slice 3's output and
                 the architect's readings.
                 Demo: the README section; evidence 4 and 5 point to it.
Out of scope  TinyGo in any form; finding the cause of the build drift
              (final-review); optimizations (final-review); expired-cache
              (304) timings beyond the revalidation count; Firefox and Safari
              on desktop (review); gating any number; changes to the runtime,
              the components, or the pages beyond the index's evidence text;
              any write to the coordinator outside the Pending edits.
Door          two-way: the task adds a command, a README section, and a goal
              record Decision; removes an unused pin, which can be pinned
              again; and releases nothing. The coordinator's roadmap edit
              waits in the Pending edits for the sync.
```

## Decisions

- setup: one repository, one Go module, one Pages project site scaffolded from
  spike-html-hosting-sdk v0.6.1, laid out in Elemental layers (Go bridge, scenario composition
  roots and entrypoints, the web runtime, components, pages), with the check holding the web
  tiers' import direction by an ESLint boundaries table, as spike-html-apps did, and the Go
  direction by a `go list` test. Rejected: layer repositories; this spike settles Go WASM
  conventions, and the intake decides what moves to the SDK and documentation components layer.
- setup: standard Go 1.27.4 ships; TinyGo 0.44.0 builds the same demos as a comparison.
  Superseded by measure: no TinyGo.
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
  actionlint, chrome-headless-shell). Superseded by measure: no TinyGo.
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
- site: `content.json` stays `{ "trees": [] }`, because the SDK's crawl and content check read it
  without checking that it exists.
- site: one unlayered CSS rule in the index pushes the header-actions group to the inline end;
  SDK v0.6.1's site.css places it there only beside a site nav.
- site: the template's palette check is dropped until a page holds highlighted code.
- site: no `internal/hello`; the hello entrypoint imports only the standard library.
- site: the Go build is the second step of `mise run build` (`scripts/build-go.sh`), not a Vite
  plugin, so a bare `vite build` omits the wasm.
- site: the Go lint and build export `GOOS=js GOARCH=wasm GOWORK=off GOPROXY=off
  GOTOOLCHAIN=local`, so the check reads no network.
- site: page scripts live in `web/pages/`. Components may import lit, the foundation, and the
  hosting components; pages may import components, the runtime, the foundation, and the hosting
  components, but not lit directly; the runtime imports only its own files. `web/**` gets browser
  globals with node's turned off; `globals` 17.14.0 is added as a pin.
- site: the Go direction check is a unit-tier TypeScript test running host `go list -e` under
  GOOS=js, and test imports count. Widened by the session, per the Go Elemental topology page:
  every root-level package, `bridge/` included, imports no `internal/` and no `cmd/`.
- site: every replace directive fails the check, not only a local one.
- site: currency's go.mod part queries direct requirements on a scratch copy of go.mod and
  go.sum, so it never writes the tree.
- site: `mise run live` makes three checks (index 200 text/html; hello.wasm 200
  application/wasm; gzip) with one module request that accepts gzip.
- site: preflight checks shellcheck and actionlint too, closing a gap in the SDK template.
- site: the no-site-nav test reads the custom element registry, because Vite bundles
  site-nav.js into a hashed chunk.
- runtime: a prebuilt scenario is one long-lived instance whose main registers named Go handlers
  through the bridge; each call runs in its own goroutine and answers a Promise (string in, JSON
  out, an error or recovered panic a rejection), because a blocking syscall/js callback stops the
  event loop. A program scenario (hello, the playground's linked programs) runs main to
  completion. Rejected: a fresh run of main per click with input on argv or stdin (argv+env capped
  at 12 KB, instantiate and init paid every run, bridge/ left empty), and //go:wasmexport (builds
  under GOOS=js but passes only numbers and pointers).
- runtime: the in-memory globalThis.fs is the runtime's own, in its own files, implementing every
  call Go's syscall package makes with Node error codes; writeSync serves fds 1 and 2 alone.
  Rejected: memfs 4.80.0 (needs node:buffer, events, stream, url, and path polyfilled in a worker,
  about 15 packages) and @zenfs/core 2.9.0 (1.27 MB plus a buffer polyfill); either breaks the
  runtime tier's own-files-only import rule.
- runtime: the fs keeps files in memory only; persistence is the playground task's to decide.
  Every call but writeSync is callback-shaped, so a storage-backed directory can mount behind the
  same calls without changing Go, the bridge, or the worker protocol. Deferred: OPFS (sync handles
  in dedicated workers, Chrome 102 / Firefox 111 / Safari 15.2, exclusive per-file lock), IndexedDB
  (async only; can't hold a compiled module), and Cache Storage (the HTTP cache already returns
  0 B). Storage is one origin across every jaimestill.github.io project site, evictable without
  persist(), and cleared by Safari after 7 days without interaction.
- runtime: the fs is built whole in this task and proven under node in the check by a Go test
  program over package os; the playground task doesn't reopen it. Rejected: only the calls the
  probe scenario uses, with the playground adding the rest.
- runtime: the runtime exports the runner type (load, run, stop; output, exit, and timing
  events); the components task declares the structural subset sl-go-demo reads, and TypeScript
  checks the match in the page. Rejected: a shared contract tier both import, which would add a
  tier to the boundaries table.
- runtime: the worker bundles wasm_exec.js after the in-memory fs module, so the shim's stub fs
  never installs and the shim's hash changes with the worker's; the repository copy and its byte
  check stay as evidence 6's provenance. Rejected: a classic worker's importScripts of the copy at
  its stable go/ path, which a deploy could pair with a newer module for Pages' max-age=600.
- runtime: the browser tier proves the runtime on a published runtime hand page with plain
  controls, linked from the index, in the crawl and the SDK shell checks; the components task's
  specimen page later takes it over. Rejected: a test-only entry never deployed, which needs a
  second build that differs from what Pages serves.
- runtime: bridge/'s Go tests run in the check as GOOS=js go test under node, with an environment
  trimmed below wasm_exec.js's 12 KB argv+env cap. Rejected: proving bridge/ only through the
  browser tier.
- runtime: the probe scenario proves the runtime with three handlers (format, files, spin),
  imports only the standard library and the bridge, and stays on the site as a bridge-sized
  baseline for the measure task. Rejected: folding them into hello, which stays the stdlib-only
  baseline with no internal/hello.
- runtime: hello moves onto the runtime and runs in the worker; the main-thread hand load in the
  browser tier goes.
- runtime: the bridge resolves a call with JSON text, and the runner parses it.
- runtime: the ready signal is an optional globalThis.goBridgeReady, which Serve calls once it has
  installed the goBridge global; a host without one waits for goBridge.
- runtime: the fs runs each callback before the call returns, as wasm_exec.js's stub does.
- runtime: the storage seam is the FileNode and DirectoryNode interfaces, each node carrying a
  device number; rename across devices answers EXDEV. Nothing mounts yet.
- runtime: the fs stores and reports permission bits but never enforces them; it starts with /tmp
  and cwd /.
- runtime: the build no longer copies wasm_exec.js to go/; Vite bundles it into the worker.
- runtime: the worker answers each load with the compiled Module, and the runner holds it. Stop
  terminates the worker first, then starts a fresh one at once and posts it the module, so the
  scenario stays loaded.
- runtime: the probe's fourth handler, `crash`, proves the nonzero exit path and stderr through
  writeSync.
- runtime: `ignore ./dist` in go.mod keeps `./...` off the build output.
- runtime: `mise run types:web`, over tsconfig.web.json, type-checks web/.
- runtime: the probe's format handler prints its line only on success.
- runtime: review and a comment in install-fs.ts hold the fs-before-shim import order, because no
  test can fail on it.
- runtime (escalation 1, after brief ready): Help opened by `?` focused its Close, whose
  interestfor hint showed at once. The fix lands in spike-html-hosting-sdk v0.6.2 this session,
  before runtime ships, with runtime adding an upgrade slice; components' docs and tests change on
  main with no release; the architect chose to fix every affected site now, not leave
  spike-html-hosting to the intake.
- runtime (escalation 2): `autofocus` on <dialog> does nothing in Chromium 155 and 157, so Help's
  heading takes focus: `<h2 id="help-title" tabindex="-1" autofocus>`; SDK site.css drops its
  outline. Rejected: script suppressing Close's hint on the opening focus, and `dialog.focus()`
  from the shell's keys module.
- runtime: shipped with the fix: spike-html-hosting-sdk v0.6.2 (PR #12, tagged by its Release
  workflow as release commit e0baeac), spike-html-hosting-components (PR #12, no tag),
  spike-html-hosting (PR #13), spike-html-hosting-architecture (PR #10), and
  spike-html-hosting-sqlate (PR #11), each site's Pages deploy green.

- components: one task of nine slices, the editor in two. Rejected: a separate components-editor
  task, which adds a branch and pull request and retires no unknown.
- components: the runner runs one load or run at a time, and a new request first stops the
  pending one, because output events name no caller. Rejected: each demo showing every event
  while a run of its own is pending, and one live demo per page.
- components: sl-go-demo has two Run modes: with a handler named, the editor's text is the
  handler's input; with none, Run runs the prebuilt program's main, its go fence read-only.
  Rejected: handler demos only until the playground.
- components: a components page replaces the runtime page, and the runtime page's runs and
  proofs move onto sl-go-demo. Rejected: keeping the plain-controls page beside it.
- components: sl-code-editor lazily imports Shiki 4.6.0's core, its JavaScript regex engine,
  and its grammars itself; shiki is pinned directly and admitted to the components tier.
  Rejected: the page passing a tokenize function, which every page would have to wire.
- components: the editor's per-palette colours come from a build step adapted from the SDK's
  light-dark() merge, held by a test that each editor token matches the SDK fence's colour in
  each palette and scheme, in place of highlightsEachPalette for the editor. Rejected: an SDK
  release exporting the merged themes (a one-way release from a spike task), and Shiki's bundled
  themes named in the spike.
- components: the editor's scope: Go and JSON grammars, other languages plain; an aria-hidden
  line-number gutter; Enter keeping indentation; Tab and Shift+Tab indenting and outdenting
  through insertText; Escape releasing Tab; read-only; label, value, input and change events.
  Rejected: bracket auto-close and matching, which fight plaintext-only editing and IME.
- components: sl-console: stdout plain, stderr in colour plus a non-colour cue, the exit as a
  status line, the handler's result as its own block, ANSI as text, the latest 10,000 lines with
  a dropped count, tail following, Copy and Clear, a log announcing no write. Rejected: no cap,
  Copy, or Clear; @xterm/xterm 6.0.0, a terminal emulator for plain-text output.
- components: sl-timings shows the last run's phases in ms with a total. Rejected: a history;
  the measure task reads the runner's events itself.
- components: accessibility is proven by CDP accessibility-tree and keyboard assertions.
  Rejected: axe-core 4.14.0.
- components: a DOM-free file set in the components tier holds the files and the active file;
  sl-go-demo builds it from its go fences and is its only writer; sl-file-tabs,
  sl-code-editor, and sl-controls are controlled and send request events sl-go-demo applies.
  Rejected: sl-file-tabs owning the file list with read-only and editable modes.
- components: New file, Rename, and Delete are built now, on the file set and in the UI,
  validated for empty, duplicate, and path-separator names, shown only under editable-files.
  Rejected: leaving file actions to the playground.
- components: a handler demo holds exactly one file; more than one fence is a visible authoring
  error; tabs show only on program demos.
- components: a unit test holds each program demo's go fence to its scenario's entrypoint source.
- components: one sl-controls ARIA toolbar, a run group and a files group, replaces
  sl-run-controls; New file and Rename open a validated form in a popover anchored to their
  button. Rejected: a separate sl-file-actions toolbar, and actions in a tab context menu (a tab
  can't contain a button).
- components: Ctrl/Cmd+Enter runs only from inside the focused demo, declared by
  aria-keyshortcuts on Run; the foundation's shortcut registry is untouched. Rejected: a
  page-wide shortcut listed in Help, which can't choose between demos.
- components: the editor and tabs are the spike's own. Rejected: CodeMirror (@codemirror/view
  6.43.15) and Monaco (@shikijs/monaco 4.6.0), which bring their own model and theming; Web
  Awesome 3.14.0, Shoelace 2.20.1, and Material Web 2.5.0 tabs, which bring their own tokens.

- components (after approval): the editor's wrap and tab size live in a DOM-free EditorSettings
  model that sl-code-editor renders from and never writes; each sl-go-demo builds its own from
  its `wrap` and `tab-size` attributes. Long lines scroll unless wrap is set; tab size defaults to
  4. Rejected: attributes owned by the editor, a Settings-dialog preference (an SDK change), and
  one page-wide model.
- components (after approval): the architect promoted the state rule to a web principle: a
  component holds no authoritative state; a DOM-free model below it, written by one owner, holds
  the state, its rules, and its validation. It lands in STANDARDS.md now and is offered to
  experiment.html's intake as a page for the web standard, not the Go standard or the
  cross-language principles.
- components: line breaks go through execCommand("insertLineBreak"), since insertText of "\n" in
  plaintext-only splits the text into divs; one edit's insertions form one undo step.
- components: Escape works in two steps in the editor: the first releases Tab and keeps focus;
  the next passes to the page (keys.js blur, a dialog's close). Tab is re-armed on focus, typing,
  or a click.
- components: the Tab model is described by aria-description on the textbox and a visible
  aria-hidden hint popover while focused, not aria-keyshortcuts, which names activating keys.
- components: a read-only editor is contenteditable="false" with tabindex 0, role textbox, and
  aria-readonly, because Chrome ignores aria-readonly on an editable element; it has no keyboard
  caret.
- components: lit 3.3.3 and vite-plugin-standard-css-modules 0.3.0 are pinned at the root, the
  latter for the components' own CSS module scripts; the boundaries table gains only shiki.
- components (after approval): the components are captured one capture name per component over
  the one components page, `--page components/<component>`, each whole at 1280px, an open step
  hiding the other sections; the index stays on the SDK's description. Rejected: one specimen page
  per component (changes the one components page), and the page whole at one width (still grows
  with every component). The SDK's three widths wrote 68 images for the editor alone.
- components: ConsoleLog caps entries, not visual lines; a write joins the previous line only when
  it's the same stream's open last entry, so no line mixes streams.
- components: the console's frame is a block with its own max block size
  (--sl-console-max-block-size, 24rem), because as a flex item each append re-laid every row
  (~50 ms against ~3 ms at 10,000 rows). Rejected: content-visibility, which drops rows from the
  accessibility tree.
- components: stderr keeps the foreground colour on a red tint with a red rule and a hidden
  "stderr: " for assistive technology, because red text falls below 4.5:1 in some palettes.
- components: Octicons glyphs are copied into the components tier, since no tier may import the
  icons layer and the boundaries table gains only shiki.
- components: sl-go-demo reads each `pre` child as one file, its text the pre's text content, so
  marked's plain fence and the SDK's Shiki markup read alike. A file's name is `data-file` on the
  pre or its code, else the pre's `title`, else its language's default (`main.go`, `input.json`,
  `input.txt`), and its grammar follows the name's extension.
- components: an authoring error (no scenario, no fence, two fences on a handler demo, a name the
  file set refuses, a tab size the settings refuse) shows its reason in the demo and its region's
  description, slots the fences back as written, and never runs; mending the attribute rebuilds
  the demo.
- components: each Run clears the console and begins the timings afresh, so both show that run
  alone.
- components: after New file, sl-go-demo selects the new file and focuses the editor; the session
  accepted this over behavior 11's focus return. Rejected: focus staying on New file.
- components: Delete removes the active file with no confirmation.
- components: Run stays available while a run is pending, since a new run stops the pending one;
  Stop is available only then.
- components: RunState numbers each run; `start` returns the number, and `finish` for any run but
  the pending one changes nothing, so a superseded run settling late can't overwrite the newer
  run's state. A superseded run is recorded as stopped.
- components: a read-only editor marks a character key handled, so the foundation's keys fire no
  single-key shortcut from it; Ctrl or Cmd+A selects its text alone, and Escape is the page's at
  once.
- components: in scroll mode the editor's gutter is sticky at the frame's inline start, and the
  frame's scroll padding is the gutter's width, so a caret revealed at a line's start stops clear
  of it.
- components: the editor refuses a drop, since the browser's own inserts a block per line; text
  enters by paste.
- components: the components page's files and crash demos take plain-text fences ("hello, files",
  "boom"), named `input.txt`.
- components: the fence-equality unit test reads components.html with a small reader held to the
  HTML parser's rules for a fence's text (comments, the newline after `<pre>`, character
  references), and fails on anything it can't read. Rejected: an HTML parser dependency.
- components: the components tier shares three internal modules: `subscription.ts`, a Lit
  reactive controller listening to a held model only while the host is connected; `aria.ts`, id
  references across the shadow boundary and the roving focus keys; and `reasons.ts`, how a
  model's refusal names a value. Rejected: each component repeating them.
- components: side by side, from the demo's 44rem container query, the timings take a fixed 16rem
  track and the console the rest. Rejected: an auto track, which measured the inline-size-contained
  timings as 0 and let the table run past the demo.
- components: the file tabs' rule is the row's background, which the selected tab's bar paints
  over, so every tab stays inside the row. Rejected: a border overlapped by each tab's negative
  margin, which overflowed the row by a line and drew a vertical scrollbar.
- components (after brief, CI redirect): below the width where a toolbar group's labels fit,
  measured by a container query, sl-controls' buttons show the glyph alone, the name kept as the
  accessible name and shown as a hint. Rejected: a group wrapping onto rows of its own, and
  shorter labels, both still dependent on the font's width (CI's monospace fallback is wider
  than the local font and split the files group at 20rem).
- components (after brief, architect): the components page shows each state once, with no 20rem
  copies; the layout responds to the viewport, and the tests and captures prove the narrow
  layout at real widths. `mise run screenshots` takes an optional `--width <px>` (one of 390,
  1120, 1376, the SDK's widths) and captures each component at every width otherwise, one pass
  per width. Rejected: labelled breakpoint copies on the page, which doubled its height.
- playground: the in-page playground is a third mode of sl-go-demo, built from source, in which
  Run compiles, links, and runs the editor's Go files; the playground page is one editable-files
  demo in that mode, and the programs task authors only go fences. Rejected: a separate
  sl-go-playground element.
- playground: the runtime gains a build request that compiles and links the files and holds the
  linked program as the loaded scenario, which the existing run then runs. Stop's re-adopt,
  reuse of the held module, and run attribution work unchanged. The worker calls compile and
  link itself, because the go command can't start processes under GOOS=js. Rejected: one
  request that builds and runs together.
- playground: Stop keeps the compiled compiler and linker, re-adopting them into the fresh worker.
  Rejected: dropping them, so that every Stop revalidates and recompiles the 52.6 MB compiler.
- playground: a built program is one package main from every .go file in the editor, with
  standard imports only. Rejected: go.mod and local subpackages.
- playground: the editor's non-Go files are placed in the program's working directory. Rejected:
  the build ignoring them.
- playground: the manifest holds standard-library archives only; the sqlate and scenarios tasks
  add their modules' archives when they first need them. Rejected: requiring sqlate, go-core,
  and go-web-sdk now.
- playground: the toolchain and archives get content-hashed names that only the manifest gives,
  and the manifest is revalidated on every build. Rejected: stable names, which can pair an old
  cached compiler with new archives for up to Pages' 10-minute max-age.
- playground: the timings add Go compile and link phases and label WebAssembly's compile "Wasm
  compile". Rejected: renaming the existing compile phase.
- playground: no persistence; a reload restores the program as given. Rejected: localStorage,
  OPFS, and a URL fragment.
- playground: no Format button. Rejected: a gofmt handler scenario.
- playground: the toolchain's unit test builds the toolchain into a temporary directory, because
  test:unit doesn't depend on the build, and the build empties `dist/`. Rejected: reading the
  toolchain from `dist/`.
- playground: `closure()` and the `Manifest` types live in the runtime tier,
  `web/runtime/manifest.ts`.
- playground: a toolchain file's name is `<stem>.<the first 16 hex digits of its SHA-256>.<ext>`,
  and each archive sits under `std/<import path>`. The manifest lists `unsafe` with no archive and
  leaves out six test-only standard packages. The archives come from `go list -trimpath -export`.
- playground: the compiler writes its diagnostics to stdout, not stderr, and the build passes both
  streams to the console as written.
- playground: the compiler doesn't check the package clause, and only the linker refuses a program
  that isn't package main, so the build passes the compiler a hidden first file,
  `/clause/main.go` (`package main`), and the compiler refuses the reader's file of any other
  package ("lib.go:1:1: package lib; expected package main").
- playground: a build and a built program's run both use `/work` as the working directory.
- playground: the worker doesn't keep archives across Stop, because fmt's closure is ~22 MB and a
  copy posted from the page would double the memory; the next build fetches them again, over the
  HTTP cache, under their hashed names. Rejected: posting the archives to the fresh worker.
- playground: the runner decides whether an unchanged build reuses the held program, and sends the
  worker an adopt of it, so reuse survives a Stop or a load in between, and an unchanged rebuild
  requests nothing, not even the manifest.
- playground: the worker posts the tools as soon as it compiles them (a "tools" reply), so a Stop
  during Go compile or link keeps them.
- playground: the runner holds a built program as the scenario `main`.
- playground: a source demo that names a scenario or a handler is an authoring error.
- playground: a failed build shows the step's exit line and the error as the result block.
- playground: the worker drops the tools and archives the current manifest no longer names.
- playground: the compiler exits with code 2 on a compile error.
- playground: the live command resolves the compiler's path against the manifest's URL.
- playground: the playground's browser tests don't prove a missing import or Stop during a build
  again; `test/browser/go-build.test.ts` proves both through the components page's source demo.
- playground (redirect): the layout is fixed through a `fixed` opt-in on sl-go-demo. Rejected:
  the page's own CSS sizing each part through custom properties.
- playground (redirect): the shares are measured against the dynamic viewport's height, so the
  tool fits one screen at every width. Rejected: an aspect ratio of the demo's width.
- playground (redirect): below 44rem the console and the timings are two tabs of one output
  panel. Rejected: three stacked shares, a few lines each at 390 px.
- playground (redirect): from 44rem to 64rem, the editor over a row of the console and the
  timings, as before with fixed heights. Rejected: the timings in the toolbar's row.
- playground (redirect): from 64rem the reader chooses editor left, top, or right, editor left by
  default, as codepen.io's Editor Layout. Rejected: one wide layout; only left and top.
- playground (redirect): fixed proportions. Rejected: draggable dividers.
- playground (redirect): no single-part views. Rejected: codepen.io's "Editors" and "Preview".
- playground (redirect): the choice is a Layout menu button in the demo's toolbar. Rejected: a
  row in the page's Settings dialog, the SDK's sl-settings in a reference repository.
- playground (redirect): the arrangement is kept in localStorage under the spike's own key, as
  the foundation keeps the theme. Rejected: forgetting it on reload.
- playground (redirect 2): a fixed demo is as tall as its size container, and the page decides
  that height. Rejected: `100dvh` less a measured header inset, which ignores the content
  around the demo (round 2's viewport-height decision, reversed).
- playground (redirect 2): the playground is one screen: the header, the heading, the intro,
  then the demo taking the rest, in CSS alone. Rejected: a viewport-tall demo with the prose
  scrolling past it.
- playground (redirect 2): the program's limits sit in a disclosure under the intro, written in
  a plain voice ("What you can build here"). Rejected: the "What a program holds" section below
  the demo.
- playground (slice 6): the demo's container breaks out of main's 80ch to the body's width
  through an inline-size container on the body, so the 64rem band is reachable; main keeps 80ch.
  Rejected: widening main, which failed the SDK's shell check.
- playground (slice 6): sl-console gains `fill`: the console takes the height it is given, its
  frame `contain: size`, at ~4 ms an append at 10,000 rows.
- playground (slice 6): sl-controls gains `steady`: the status keeps one line, asks for 12rem,
  ends in an ellipsis, and stays whole to assistive technology. Rejected: a wrapping status, which
  grew the toolbar.
- playground (slice 6): the demo learns its band from a `--band` custom property its container
  queries set, so the breakpoints live in CSS alone.
- playground (slice 6): below 44rem the unselected output panel is hidden by `visibility`, so it
  keeps its scroll position.
- playground (slice 6): the code editor's rows are `align-content: start`, which fixes line
  numbers drifting in a frame taller than its text.
- playground (slice 6): the playground's captures are the viewport alone.
- playground (slice 7): the page owns the stored arrangement (`web/pages/arrangement.ts`,
  `keep()`), one `Arrangement` per page given to every fixed demo, as the state-outside-components
  principle asks.
- playground (slice 7): the page follows another tab's choice through the storage event, and
  stores the placement as a bare JSON string.
- playground (slice 7): a fixed demo given no arrangement places the editor left and shows no
  Layout group.
- playground (slice 7): on the Layout button, Up doesn't open the menu; the menu has no
  typeahead; Home and End move within it.
- playground (slice 8): the floor is `minmax(50dvh, 1fr)` on main's grid row, a page rule.
  Rejected: `min-block-size` on the size container, which Chrome laid out with the demo 0px tall.
- playground (slice 8): the demo reads no viewport unit: it is `100cqb`, which falls back to the
  small viewport with no size container. The size container is a `.demo-container` div carrying
  slice 6's breakout.
- playground (reviews): the standards review cut the tests in `arrangement.test.ts` that asserted
  constants and merged the Layout menu's duplicated close into `closeMenu`; the spec review found
  no gaps.

- playground (architect, after the brief): the demo ends the page's inline gutter above the
  viewport's bottom, the same space as at its sides. Rejected: the demo meeting the viewport's
  bottom edge, where every part's bottom border sat on the last pixel and read as cut off.
- playground (layout foundation): the playground is an app page whose main spans the body's
  content width, laid out by named lines (the prose on an 80ch column, the demo on the full
  column). It runs every SDK shell check except holdsReadingWidth, plus a spike check that its
  prose holds 80ch, centred. Rejected: the reading shell with the demo breaking out through
  100cqi and negative margins (reverses slice 6's "Rejected: widening main").
- playground (layout foundation): a fixed demo fills the box its parent's layout gives it, by
  grid stretch. Rejected: 100cqb of a size-container wrapper, which needs the wrapper, falls back
  to the small viewport, and lays out 0px tall in Chrome when given a minimum.
- playground (layout foundation): the floor is counted in lines of the demo's parts, stated once
  by the component. Rejected: 50dvh, which is 300px on a short phone and 450px on a desktop.
- playground (layout foundation): every hand page's rules sit in one shared sheet in `@layer
  page`, after `site`. Rejected: unlayered inline <style> per page (Vite places it before the
  bundled sheets, and the header-actions rule was copied into three pages).
- playground (layout foundation): the script keeps reading the band named in CSS, but only for
  the tabpanel roles and the Layout group. Rejected: a CSS-only band, since no shipped API
  reports container-query state to script and CSS can't set a role.
- playground (layout foundation): the status's reserved width (in ch) and the timings' track are
  each one named property. Rejected: the room left on the toolbar's line, about 104px at 390,
  which would cut most statuses to a word.
- playground (layout foundation, slice 9): each hand page links `web/pages/page.css` after
  `site.css`. Rejected: importing it from a page script, since the index has no script.
- playground (layout foundation, slice 9): a body of class `app` scopes the playground's rules,
  so the index and the components page keep the reading layout; moving the rules into the layer
  changed no cascade outcome.
- playground (layout foundation, slice 10): one gutter token, `--page-gutter`, set from
  `--space-m` (site.css's side padding), spaces the inline sides and the block end.
- playground (layout foundation, slice 10): the floor is 6 editor lines and 2 console lines, each
  in its part's own `lh`, with `contain: size` on the editor and the timings so their content
  never raises it.
- playground (layout foundation, slice 10): the playground's shell checks skip only
  holdsReadingWidth, and a spike check holds the prose column instead.
- playground (layout foundation, slice 10): the floor's line counts can't rise at 390x844 without
  a change to the brief.
- playground (layout foundation, slice 11): the steady status reserves 24ch, the old 12rem in its
  own text.
- playground (layout foundation, slice 11): the timings' least width is 28ch of the table's text,
  and the timings' track is `auto`, reading it on the element; the two 44rem container queries
  became one. Rejected: rem, which doesn't follow the table's font.
- playground (layout foundation, slice 11): each popover is `max-content` wide, with a `--within`
  position-try fallback as the last resort. Rejected: `max-inline-size: 100%` in the base
  position, which never flips; `position-try-order: most-inline-size`, which flipped the menu at
  1120px.
- playground (layout foundation, slice 11): the New file form, which overflowed the viewport at
  390px, now fits inside it.
- playground (layout foundation, standards review): removed two overrides of site.css that
  changed nothing, restored the forms' 22rem cap that the `--within` fallback had dropped, and
  prefixed the floor's properties with the component's name.
- playground (layout foundation, after the standards review): the floor's rationale is the least
  a reader can work in, the component's own. Rejected: a rationale from the page's screenshots.
- playground (layout foundation, after the standards review): the prose is one `.prose` block, so
  main's two named rows don't count the prose's children. Rejected: `repeat(3, auto)` rows.
- playground (layout foundation, after the standards review): README.md states no pixel figures
  for the layout, and the menu-gap test reads `--space-3xs`.
- playground (layout foundation, spec review): no gaps.

- playground (starter): the playground opens on a calculator language (main.go, lexer.go,
  parser.go, eval.go, and input.txt). Rejected: hello, which the components page already shows;
  a log analyzer; a concurrent ASCII Mandelbrot (it overlaps the programs task's concurrency
  program); a JSON inventory report (encoding/json makes the cold Run heavy).
- playground (starter): its source is cmd/calc, built and tested in the check, with the fences
  checked byte for byte against it. Rejected: fences only in playground.html. (Superseded: the
  source moved to playground/calc and is never built; see "starter placement".)
- playground (starter): the shipped script runs clean and exits 0, and a comment suggests a line
  to try that fails. Rejected: shipping a failing line.
- playground (starter): a build is reused when only non-Go files change. Rejected: reusing it
  only when every file is unchanged (editing input.txt recompiled and relinked for nothing).

- playground (starter, architect): the disclosure's last sentence ends "reload, and you're back
  to where you started". Rejected: "back to the calculator", which a later starter would make
  untrue.
- playground (starter placement): the starter lives in playground/calc, a root-level package
  main outside cmd/, since it isn't a scenario and no page loads it prebuilt. Rejected: keeping
  cmd/calc with a STANDARDS.md exception to "`cmd/<scenario>` holds only the entrypoint".
- playground (starter placement): the starter is only vetted and tested under GOOS=js in the
  check, never written to dist/. Rejected: building calc.wasm like hello, which ships bytes no
  page loads (minimal-footprint).
- playground (starter placement): a result of negative zero prints 0. Rejected: -0, as Go's
  float formatting gives it.
- playground (starter, build): numbers are float64, printed to 12 significant digits, which hides
  floating point's last-digit error.
- playground (starter, build): `#` starts a comment to the end of the line, and `let` is a
  keyword.
- playground (starter, build): a failing line binds nothing, so a failing `let` leaves its name
  as it was.
- playground (starter, build): the tests sit in package main with `//nolint:testpackage`, because
  a main package can't be imported.
- playground (starter, build): run() writes to os.Stdout and os.Stderr, and the tests swap them
  for temporary files. Rejected: io.Writer parameters, which make errcheck demand error handling
  in the reader's showcase code; os.Pipe, which js/wasm lacks.
- playground (starter, build): the test embeds input.txt, because the in-memory fs holds no
  package directory to read it from.
- playground (starter, standards review): errors are checked where they occur; the tests use one
  quoting style; TestLines gained a left-associativity case, which nothing tested; runner.ts and
  build.ts share build.ts's `isGo`.
- playground (starter, open): the four .go files are ~350 lines with doc comments, against the
  brief's "about 200". Settled by the architect: accepted (the next line).

- playground (starter, architect): behavior 21's size is "about 350 lines with doc comments".
  The session's own brief draft had said "about 200", a guess no round asked for.
- playground (fix): the playground's prose is its heading and a one-line lede with
  <kbd>Ctrl+Enter</kbd> beside "press Run". The detail lives in an About dialog opened from the
  header. Rejected: the disclosure, which costs a line and grows with the reader's font; a
  section on the index page, which navigates away and loses unsaved edits.
- playground (fix): one screen is proven in the machine's fonts and in a pinned DejaVu font
  set. Rejected: the machine's fonts alone, which made every local run optimistic (46px of
  headroom locally, -1.77px under DejaVu); pinning one font, which would hide real overflows.
- playground (fix): the status-line test derives its expectation from measured widths.
  Rejected: asserting one font's outcome at a fixed width.
- playground (session error): PR #6 merged with CI red, because `gh pr checks --watch` was
  piped through `tail` and its exit code was lost. SHIP runs `[remote] merge` exactly as
  configured, unpiped.
- playground (fix, build): About comes first in the header's group, so Help and Settings keep
  their places at the inline end.
- playground (fix, build): About's shortcut is A, which no other binding on the page or in the
  shell takes.
- playground (fix, build): mise fetches DejaVu as a pinned http tool, `http:dejavu-fonts` 2.37,
  its sha256 taken from the download by hand. Preflight fails when the installed version doesn't
  match the pin. Rejected: the TTFs vendored in git.
- playground (fix, build): the layout tests are one shared suite, `playground-layout-suite.ts`,
  and two entry files, one for each font set.
- playground (fix, build): `web/pages/page.css` lets the header-actions group shrink and wrap on
  every page. A test at 200% text zoom found the page scrolling 30px sideways at 390px, because
  site.css sets the group `flex: none`.
- playground (fix, build): the short-screen floor test moved from 1376x500 to 1376x400:
  without the disclosure, 1376x500 no longer pushes the demo down to its floor.
- playground (fix, standards review): the About test dropped the assertions that restated its
  markup; it holds the dialog's behavior.
- programs: the four programs live in a picker on the playground that switches its one demo in
  place. Rejected: a hand page per program; four demos stacked on one page.
- programs: each program is a package main beside the starter's, vetted and tested under GOOS=js
  on both filesystems, never built into the site, its fences checked byte for byte. Rejected:
  fences only in the page.
- programs: every program prints the same output every run, asserted exactly. Rejected: printed
  timings.
- programs: only the standard-library program reads an input file, input.json, which reruns
  without a build when edited. Rejected: all four self-contained.
- programs: the standard-library program keeps encoding/json and text/template (85 archives,
  ~8.0 MB gzip on a cold Run). Rejected: dropping text/template (75 archives, 6.9 MB).
- programs: no line target; each program is sized by its topic, and performance (load, compile,
  link, and run timings, and closure bytes) is what the programs exercise. Rejected: ~100–150
  lines each (architect).
- programs: the picker is a native select labelled "Program" beside the heading. Rejected: a menu
  button in the demo's toolbar.
- programs: sl-go-demo takes a FileSet as a property, and the page keeps one per program,
  superseding "the programs task authors only go fences". Rejected: swapping in a new demo per
  program.
- programs: edits survive switching within the tab, and Reset restores only the program on
  screen. Rejected: switching back to the program as shipped.
- programs: the other programs' text is a template per program in the page, checked by the fence
  reader. Rejected: Vite ?raw imports of the Go files.
- programs: the fragment names the program, choosing writes it, Back and Forward follow it, and an
  unknown fragment opens the calculator. Rejected: no deep link.
- programs: the playground opens on the calculator. Rejected: basics.
- programs: About gains the goroutine and deadlock sentences as drafted in round 2.
- programs: the programs are illustrations sized by their topics. Rejected: programs built to load
  one phase heavily.
- programs: the browser tier reports each program's cold and warm phase timings and closure bytes,
  never as a gate, with the table in the session brief. Rejected: leaving every number to the
  measure task.
- programs: switching back to a program compiles and links it again from the archives the worker
  holds. Rejected: holding one built program per program.
- programs (build): a switch keeps the demo's `RunState` and editor settings and makes a new
  `ConsoleLog` and `RunTimings`. A pending run is stopped and finished as stopped, so the status
  reads "Stopped main" over an empty console and timings; after a switch from a finished run, the
  status still shows that run's outcome.
- programs (build): a handler demo given `files` shows an authoring error, on its first build and
  on a later one.
- programs (build): the fence rules live in their own components module, `fences.ts` (`readFences`,
  `Fence`). Rejected: exporting them from `go-demo.ts`.
- programs (build): each option's value is its program's fragment name; the select has
  `autocomplete="off"`; at narrow widths and large text, the select wraps under the heading.
- programs (build): About's goroutine and deadlock sentences sit inside the paragraph, after
  "Stop to cancel."
- programs (build): generics uses `strings.FieldsSeq` and `slices.Backward`, as `go fix` proposes.
- programs (build): concurrency doesn't print GOMAXPROCS; a test asserts it is 1 under `GOOS=js`.
- programs (build): stdlib prints release notes from a commit log, in one `.go` file plus
  `input.json` (Prettier-formatted). A JSON error's line names `input.json:<line>:<column>`, from
  the error's Offset less one; a missing `input.json` exits 1, found through
  `errors.Is(fs.ErrNotExist)`.
- programs (build): each template's `id` is its program's name, so the SDK's crawl accepts the
  index's fragment links; an unknown fragment shows the calculator and leaves the URL as it is.
- programs (build): the report launches a fresh browser profile per program; its raw bytes are the
  `dist/` files' sizes, its gzip bytes node zlib's at the default level; the warm Run follows a
  comment appended to `main.go`. It runs in the browser tier (≈53 s of the check) and alone as
  `mise run report:programs`. It has no Start column, since a source build records no Start
  phase.
- programs (standards review): the fence test covers every program file and requires the
  templates to be exactly the programs; the About test checks elements, not class names;
  `playground.ts` passes `readFences`' output straight to `FileSet`.
- programs (spec review): added tests for each program's closure, the archives a program adds in
  one tab, an edit rerunning, a reload restoring every program, and file actions surviving a
  switch.
- programs (brief): the architect accepted the brief with the report test kept in the browser
  tier (≈53 s of each check), as behavior 13 has it; moving it to `mise run report:programs` alone
  stays open for a later task.
- sqlate: sqltest's scripted pool is opened outside a test through a commented testing.TB
  stand-in (sqltest.Open calls only Helper and Cleanup). Rejected: waiting on a sqlate release
  with a constructor that takes no test.
- sqlate: the reader composes the demo: editable pattern and statement files, and a main.go that
  builds a catalog of sqlate's patterns plus theirs and prints the compiled statements, seeded in
  go-web-service's style. Rejected: a fixed run of sqlate's README guarded edit.
- sqlate: PostgreSQL's dialect and patterns (sqlate/postgres), since a reader wants a real
  engine. Rejected: sqltest's stub dialect, despite ~0.6 MB gzip less prebuilt and ~8.5 MB less
  in-page.
- sqlate: the demo editor highlights SQL with Shiki's grammar; a sql fence defaults to a .sql
  name, and sl-go-demo gains a `file` attribute for a fence that names none.
- sqlate: the Markdown page is the spike's own writing in its own directory, rendered as its own
  tree. Rejected: copying it into content/ at a commit of its own.
- sqlate: the playground's manifest adds the site's pinned workspace modules' archives; "standard
  imports only" becomes "standard and the site's pinned modules".
- sqlate: the reader's sqlate program compiles in the page (cold Run ~34 MB gzip, reported as a
  finding). Rejected: a prebuilt program with a runtime change to give it the demo's files.
- sqlate: in the demo's flat file set, <ns>.<name>.sql is a pattern in namespace ns and any
  other .sql is a statement. Rejected: a directory level in the file set.
- sqlate: evidence 3 runs in the same program, a second Go file over sqltest set by input.json.
  Rejected: a separate prebuilt run demo.
- sqlate: the Markdown page embeds a prebuilt compile handler around a ```sql fence named by
  `file`. Rejected: the multi-file program as raw-HTML pre blocks.
- sqlate (build): the program prints each statement under a `-- <name>: <tier>, parameters $1 a,
  …` header and prints sqlate's messages unchanged. sqlate's patterns register first, as in
  go-web-service, so a reader's `sql.*` file gets sqlate's "registered twice".
- sqlate (build): the playground's manifest takes the repository's own `go list -deps ./...`
  closure of non-standard, non-main packages, each as `mod/<path>.<hash>.a`, so a later module
  joins the manifest by being imported.
- sqlate (build): a version mismatch and no row are results on stdout with exit 0; `input.json`
  rejects unknown keys and trailing values; a missing `input.json` exits 1.
- sqlate (build): the fence naming rules live in the DOM-free `file-names.ts`: a fence's own name,
  then the demo's `file`, then the language's default (`query.sql`), then the mode's default.
- sqlate (build): markdownPages takes the spike's `markdown/` directory as its one tree's source
  (SDK v0.6.2 reads the repository and ref only for an external file's blob link); `content.json`
  stays `{ "trees": [] }`; the Markdown can't link relatively to the hand pages.
- sqlate (build): the compile scenario embeds its patterns as
  `internal/sqlate/patterns/<ns>/<name>.sql`, held byte for byte to the program's by a unit test,
  and panics at startup if they don't build a catalog, as a composition root should.
- plan (2026-11-13): a final-review task joins between review and answer: performance,
  optimization, and ergonomics reviews of the whole spike that land the optimizations within
  reach and record anything larger or one-way for the answer (evidence 13). Rejected: folding
  them into the screenshot review. measure times each page on desktop and on an iPhone over Wi-Fi.
- scenarios: go.mod requires go-core v0.12.0 and go-web-sdk v0.17.0, the latest releases on the
  remotes and proxy.golang.org when the task was planned.
- scenarios: the go-core demo is a source program the reader edits and builds in the page.
  Rejected: a prebuilt graph scenario over a node notation of the spike's own.
- scenarios: the go-core demo shows graph plus lifecycle's Coordinator. Rejected: graph alone,
  which costs ~1.7 MB less gzip in the page.
- scenarios: the go-web-sdk demo is a prebuilt scenario with one handler that takes a raw HTTP/1.1
  request's text and answers the response's text (2.10 MB gzip). Rejected: a source program built
  in the page (~212 archives, ~32 MB gzip cold), and both.
- scenarios: the handlers are called at the handler level, through the Router's ServeHTTP into an
  httptest recorder. Rejected: web.Service.Run over Go's in-memory fake network, which is unproven
  in a browser and recorded as a note for the answer.
- scenarios: the scenario serves a sample projects resource API alone. Rejected: the health
  probes, which answer an orchestrator.
- scenarios: each library's demo sits on its own rendered Markdown page. Rejected: one page for
  both, and hand pages.
- scenarios: the graph program is not offered in the playground's Program select, as sqlate's
  program isn't.
- scenarios: request.http shows as plain text, and the editor stays unchanged. Rejected: Shiki's
  http grammar, which adds ~80 KB gzip to the tokenizer.
- scenarios: the sample API's data is seeded at startup and kept for the instance's life; a Stop
  or a reload reseeds it. Rejected: resetting to the seed on every call.
- scenarios (escalation 1): wasm_exec.js's timer callback resumes Go again after wasmExit, which
  never clears _scheduledTimeouts, so a program that exits in a timer-driven resume throws "Go
  program has already exited" (Go 1.27.4's shim). The runtime's worker guards it as the program's
  own exit, landed as its own slice; wasm_exec.js stays byte for byte the pinned Go's. Rejected:
  patching the copied shim, and dropping the browser exit-1 case.
- scenarios (escalation 2): the browser tier gets a per-test timeout, so a stall fails naming the
  test instead of hanging the check; a timings.test.ts stall under the parallel tier's load is
  recorded for final-review. Rejected: rerunning by hand.
- scenarios (build): the site test hands the SDK's crawl a scratch root whose content.json records
  markdown/ as one tree, so the crawl checks the rendered pages as copied pages (SDK v0.6.2's crawl
  counts any page not in content.json a hand page, which may have no pager).
- scenarios (build): go.mod requires go-web-sdk only from the slice whose scenario imports it;
  `go mod tidy` drops a requirement nothing imports, and the check's `go mod tidy -diff` fails on it.
- scenarios (build): the graph program has one lifecycle participant per layer, the store and the
  server, so its start order is deterministic. `wire()` returns the Graph and a struct of node
  handles in graphtest's shape, so the tests use Replace and add a node.
- scenarios (build): the exit-race guard clears the exited instance's pending timers in the Go
  object's `exit` hook. The real trigger: a stderr write's nested event schedules an idle timeout
  that outlives the exit.
- scenarios (build): the browser tier bounds each test at 300 s (`--test-timeout`), since node
  doesn't bound a describe block.
- scenarios (build): the scenario is named websdk. Its response uses LF line endings and prints
  only the handler's own headers, `Etag` as Go canonicalizes it.
- scenarios (build): RequestID and Recoverer sit on the Router's Use, so a 404 or 405 carries
  X-Request-Id too. 404 and 412 come from ProblemMatchers, with detail. A project answers its
  version as its ETag, and a create its Location. Paging defaults to 10 a page, at most 50. New
  ids come from the standard library's `uuid.NewV7`.
- scenarios (build): the go-web-sdk page's demo fence names no language, so its markup is plain
  before the demo upgrades; its prose's http and json fences are highlighted at build. Each
  Markdown page's prose holds fences outside its demo, so the palette check reads highlighted code.
- scenarios (build): a unit import-listing check holds websdk's dependencies (`scenarioDeps`,
  `test/unit/go-module.ts`); sqlate's scenario has none.
- measure: a committed `mise run measure` reads the live site from the desktop; the architect
  reads the iPhone by hand from each demo's timings table. Rejected: a measure page on the site.
- measure: the numbers land in a dated "Measurements" section of the README, which evidence 4 and
  5 point to.
- measure: each desktop timing is the median and max of five readings; the iPhone gets one
  reading per state, taken by hand.
- measure: "cached" means within Pages' 10-minute max-age; an expired cache is reported only as
  the number of files its revalidation requests.
- measure: build drift (builds that aren't byte-reproducible) is reported, never failed on; its
  cause goes to final-review.
- measure: sizes cover the four prebuilt modules, the compiler, the linker, and the seven program
  closures; no measured number fails the command.
- measure: TinyGo comparison rejected; the spike's question is native Go. TinyGo can't build the
  sqlate module (pgx's crypto/tls) or the playground's toolchain, and its modules need TinyGo's own
  wasm_exec.js, not the runtime's. The pin is removed.
- measure (build): the iPhone reads a subset, cold and cached for sqlate, go-core graph,
  components, and the calc playground (8 readings); the README names the rows measured. Rejected:
  all 37 by hand; Chrome emulation of an iPhone (V8, not WebKit's engine) as a substitute or a
  supplement; WebKit through Playwright, left for the Safari checks the review task owns.
- measure (build): the module build loop moves into `scripts/build-go-modules.sh`, which the site
  build and the measure command both run, so the drift report builds with the site build's flags.
- measure (build): the drift report builds each module twice into TMPDIR, each build with its own
  `GOCACHE`, so neither build reuses the other's work.
- measure (build): the deployed commit is the `vcs.revision` Go stamped into the live
  `go/hello.wasm`, cross-checked against gh's latest successful github-pages deployment for the
  Pages URL.
- measure (build): a closure is the runtime's own `programClosure` over the local
  `playground/<program>/` sources, resolved against the live manifest, so the sizes match what a
  page's build fetches.
- measure (build): wire bytes are read through node:http(s), not fetch(), because fetch() decodes
  the body and hides the served size.
- measure (build): the browser runs with the network allowed through a shell wrapper in TMPDIR
  that drops `--host-resolver-rules` from the tooling's launch(), which otherwise resolves loopback
  only.
- measure (build): the phases come from sl-timings' model, and the first result from a
  MutationObserver on the console.
- measure (build): `--readings`, `--pages`, and `--skip-sizes` narrow a development run, sparing
  the Pages bandwidth.
- measure (build): a failed reading is listed under "Not measured" and never fails the command.
- measure (build): the iPhone readings were taken in Chrome for iOS, which runs WebKit, and
  recorded as first runs and in-place reruns; sqlate's cold run was confirmed in an Incognito tab.
  No cached reloads were taken on the phone.

## Notes

- sqlate's own currency trails (pgx 5.12.0, golangci-lint 2.15.0, mise go 1.27.4); that belongs to
  the goal that next locks sqlate.
- spike-html-hosting-sdk's markdownPages has no hook for marked extensions; an intake candidate.
- A browser running a wasm build is another runtime layer; this spike's answer bears on the
  `elemental-runtime-layers` backlog goal.
- wasm_exec.js caps argv and the environment together at 12 KB; `GOOS=js` go test under node
  needs a trimmed environment. The playground's compile and link argv fit, because the build
  passes the archives' paths in importcfg files.
- SDK v0.6.1's site.css places header-actions at the inline end only beside a site nav; an
  intake candidate.
- Vite's preview doesn't gzip, so the live command alone proves the gzip assertion, against the
  deployed site.
- The SDK's Release workflow tags a release itself, on a release commit above the merge; pushing
  the tag by hand is rejected as already existing.
- The SDK removes the focus outline on Help's heading, which isn't a control; spike-html-hosting-
  sqlate's STANDARDS.md says "Focus is always visible", so its next review may raise it.

- The state-outside-components principle is a native web principle for the intake's web
  standard; the answer section carries it.
- Chrome exposes an editing host as editable whatever aria-readonly says; a read-only textbox must
  not be contenteditable.
- In a plaintext-only contenteditable, execCommand insertText of "\n" splits the text into a div
  per line; insertLineBreak writes "\n" as text.
- A scroller laid out as a flex item lays out every row again on each append (~50 ms against
  ~3 ms at 10,000 rows); a block with its own max block size doesn't.
- Visually hidden text placed `position: absolute` inside a scroller needs a positioned ancestor
  inside the scroller; otherwise its containing block is the page's, and it grows the page.
- An element with `contain: inline-size` measures 0 in an auto grid track; give the element a
  `min-inline-size`, which the track takes, or size the track.
- The foundation's elements layer veils `::backdrop`, which a popover in the top layer has too; a
  popover that veils nothing sets its backdrop transparent.
- The foundation's keys.js passes over a keydown whose default is prevented, so a component keeps
  a key from firing a page shortcut by preventing its default.
- CDP Fetch enabled on the page intercepts the worker's .wasm fetch, which the page's Network
  domain doesn't see; a paused request of a terminated worker may be gone when continued.
- The foundation's elements layer zeroes a container's first-child heading's top margin and leaves
  the space between sections to the page, so every page on it must set its own section spacing
  (the components page's `main > section` rule, from spike-html-apps-components' demo.css); the
  components page shipped without it. An intake candidate: a page-layout sheet the SDK or the
  foundation ships, so no page has to know.

- For the answer: Pages gzips the toolchain and the archives, so the 100 GB/month soft bandwidth
  limit on Pages works out to about 5,000 cold playground runs a month; a cold calc run transfers
  19.3 MB (README.md, "Measurements").
- All 144 MB of standard-library archives deploy to Pages, though each program fetches only its
  closure.
- Chrome's cold WebAssembly.compile of the 52 MB compiler reads ~74–123 ms locally and 33–38 ms
  live, which suggests lazy compilation, so its real cost may fall inside the Go compile phase.
  For final-review.
- sqlate v0.7.0 and its dependencies build archives for js/wasm. go-core v0.12.0 and go-web-sdk
  v0.17.0, both on their remotes and proxy.golang.org, build and vet for js/wasm and pass their
  own tests as wasm under node, Server.Start and Service.Run included.

- The playground's floor is counted in lines, so it follows the space and type profiles. On a
  short screen, such as 390x600, the demo holds its floor and the page scrolls down, never
  sideways.
- CDP's Input.insertText loses line breaks in the editor, so browser tests set the editor's text
  through a paste event.
- In Chrome, an element with `min-block-size` on a size container in a grid row laid out 0px
  tall. The playground no longer uses a size container; the note stays as a pitfall for any page
  that does.

- Intake candidates: the SDK has no page mode for tools, and holdsReadingWidth assumes a
  reading page; a page-layout sheet (gutter, section spacing, content and full named lines) in
  the SDK or foundation. Pitfall: Vite places a hand page's inline <style> before the bundled
  sheets, so an inline @layer declares ahead of the foundation's.
- `@custom-media` isn't shipped, so complementary container queries repeat their breakpoint.
- The foundation has no token for `outline-offset`.
- A `@position-try` fallback's `max-inline-size` replaces the element's own, so the fallback must
  restate any cap the element sets.

- The SDK's crawl fails on a fragment link that names no element on the page, so a deep link to
  a page's state needs an element carrying that id.
- Pasting into an empty file in the editor stores an extra trailing newline, and pasting a whole
  file that ends in a newline over the editor's content doubles it; likely an editor bug. Tests
  paste without a final newline.
- In browser tests, retyping a whole main.go through CDP may not finish building; appending
  through a paste event works.

- With the minimal lede, the demo stands 230px above its floor at 390x844, in the machine's fonts
  and in the DejaVu set alike.
- The local machine's fonts (CaskaydiaMono, Liberation Sans) differ from CI's, so a layout test
  proves little until it also runs in a pinned font set.
- A pipe in a gating command loses the command's exit code; the merge command runs unpiped.
- Intake candidate: the SDK's site.css sets `.header-actions { flex: none }`, which fails reflow
  (WCAG 1.4.10) on a page with no nav at a phone's width and large text. The SDK should let the
  group shrink and wrap.
- Intake candidate: the coordinator's architecture or the SDK could offer a browser-test helper
  that runs a suite in a pinned font set.

- `sqltest.Open` requires a `testing.TB`; a constructor that takes no test is a candidate for
  sqlate's next goal.
- Intake candidates for the SDK: markdownPages has no notion of a tree the site writes itself; its
  Shiki markup drops a fence's language; a Markdown fence can't name its file. v0.6.2's crawl
  counts any page not in content.json a hand page, so a site's own multi-page Markdown tree needs
  the site test's scratch-root workaround; the SDK could take the site's own Markdown trees.
- golang.org/x/text and golang.org/x/sync arrive indirectly through pgx and trail their latest;
  `mise run currency` reports direct requirements only.

- sqlate.html's 36 s cold Run on an iPhone 16 Pro Max (2026-11-12) did not reproduce: the
  2026-11-13 cold run, in an Incognito tab, took 3.3 s. The cause is unknown. For final-review.
- The iPhone readings lack cached reloads, and some phases weren't captured: sqlate's
  Fetch, Wasm compile, and Go compile, and calc's phases before Link (README.md, "Measurements").
- Build drift is Go's VCS stamping alone: two local builds match byte for byte, and the live
  module differs from them only in `vcs.revision`, `vcs.time`, and `vcs.modified`. Building with
  `-buildvcs=false`, or an equivalent, would make the live module match a local build. For
  final-review.
- The review task owns the WebKit and desktop Safari checks; measure considered Playwright's
  WebKit and left it to review.

- For the answer: Go's js port has an in-memory fake network (`net_fake.go`), so go-web-sdk's
  Service.Run binds and serves inside the wasm under node. In a browser, net/http's client uses
  fetch unless its Transport sets a Dial function; that path is unproven in a browser. This
  qualifies the framing's "a service can't run there": sockets can't, but an in-process service
  can.
- A `timings.test.ts` stall was seen once under the parallel browser tier's load and isn't
  reproduced alone; the per-test bound now fails it by name. For final-review.
- Intake candidate: Shiki's http grammar statically imports the JavaScript, TypeScript, and Java
  grammars, which matters if the SDK's client-side fences ever highlight http.
- Intake candidate: the exit race in Go's `wasm_exec.js` (a pending timeout resuming an exited
  program) is upstream Go's.

## Pending edits

- coordinator · html-artifacts.md: under "Experiment: spike-html-go-wasm", a candidate principle
  for the web standard experiment.html's intake may found: a component holds no authoritative
  state; a DOM-free model below it, written by one owner (the composing element or the page),
  holds the state, its rules, and its validation. Evidence: this spike's FileSet and
  EditorSettings, written by sl-go-demo, and its Arrangement, a reader's stored preference the
  page owns and gives to every fixed demo.
- coordinator · roadmap.toml: in the components task's summary, "sl-run-controls" becomes
  "sl-controls", and "with a specimen page" becomes "with a components page".
- coordinator · roadmap.toml: in the playground task's summary, "per-package standard-library
  and workspace archives" becomes "per-package standard-library archives", since the sqlate and
  scenarios tasks add their modules' archives; and "the playground page" becomes "the playground
  page, an app page around sl-go-demo's fixed layout with a Layout menu whose choice the page
  stores, opening on a calculator-language starter program, its detail in an About dialog", since
  the summary otherwise omits the redirect's, the layout foundation's, the starter's, and the
  fix's work.
- coordinator · roadmap.toml: the programs task's summary becomes "Basics, generics,
  concurrency, and standard-library programs of the spike's own, edited and run from source in the
  playground, chosen by a Program select and a URL fragment, each keeping its edits within the tab,
  with a report of each one's cold and warm timings and closure. Evidence 12."
- coordinator · roadmap.toml: the sqlate task's summary becomes "sqlate's compile demo: a program
  the reader composes from sqlate's PostgreSQL patterns and their own, compiled in the page over
  the pinned modules' archives, with a guarded run over sqltest's scripted driver; and a prebuilt
  compile handler on a rendered Markdown page. Evidence 2, 3, 11."
- coordinator · roadmap.toml: the scenarios task's summary becomes "go-core's graph, built
  from source in the page, and go-web-sdk handlers called in-process, live on two rendered Markdown
  pages, with the modules'
  js/wasm archives added to the playground's manifest. Evidence 10."
- coordinator · roadmap.toml: in the measure task's summary, "the TinyGo comparison, " goes, so
  it reads "Each module's raw, gzip, and brotli sizes, and cold, cached, and in-place timings on
  the live site, a playground build's Go compile and link among them, on desktop and on an iPhone
  over Wi-Fi. Evidence 4, 5."
