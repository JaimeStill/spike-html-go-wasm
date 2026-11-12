# goal · experiment.html.spike-html-go-wasm

- **State:** building
- **Task:** playground
- **Branch:** playground

## Tasks

1. [x] site
2. [x] runtime
3. [x] components
4. [ ] playground
5. [ ] programs
6. [ ] sqlate
7. [ ] scenarios
8. [ ] measure
9. [ ] review
10. [ ] answer

## Task brief · playground

Problem       The page runs only Go the build compiled ahead of time: a reader can edit a
              program demo's fences but can't run what they wrote, so the spike can't yet show
              whether arbitrary Go compiles in the page (evidence 9), and the programs task has
              nothing to run its four programs from source on. Go's own compiler and linker,
              built unchanged for GOOS=js, already compile, link, and run hello on the runtime's
              in-memory fs under node. What's missing is their packaging for the site, the
              standard library's archives fetched per import through a manifest, a build request
              in the runtime, a third sl-go-demo mode, and the playground page.
Behaviors     1. The site build writes Go's compiler and linker, built by the pinned Go for
                 GOOS=js; an archive for every standard-library package that builds for js/wasm;
                 and a manifest naming the Go version, the compiler and linker, and each
                 package's archive and direct imports. Every file but the manifest has a
                 content-hashed name that only the manifest gives. No .wasm or archive is
                 tracked, and the build reads no network. Under the unit tier, each file the
                 manifest names exists, and its name matches its content hash. For a fixture
                 program, the closure the manifest gives equals the pinned Go's own dependency
                 list for it, and an import-free main still closes over runtime's packages.
              2. The runner gains a build request, which takes the program's files. In the
                 worker it reads the manifest, revalidated on every build. It resolves the
                 imports of the .go files and fetches the compiler, the linker, and the archives
                 of the import closure that the worker doesn't hold yet. It compiles every .go
                 file as package main and links the result. It compiles the linked module and
                 holds it as the loaded scenario, so the existing run runs its main to its exit.
                 A build of files identical to the last successful build holds that program
                 again and fetches, compiles, and links nothing.
              3. A build runs alone as a load does. Started while another request is pending,
                 it first stops that request, which rejects with "stopped". Every event between
                 a build's start and its settling belongs to that build.
              4. A failed build runs nothing. The compiler's or linker's stderr reaches the
                 console as written, its positions relative to the reader's file names (e.g.
                 "main.go:5:27: undefined: x"), with its exit code, and the build rejects naming
                 the failed step. An import the manifest doesn't hold fails before the compiler
                 runs, naming the package. A file whose package clause isn't main fails in the
                 compiler.
              5. A built program runs over a fresh in-memory fs whose working directory holds
                 every non-Go file of the build, so os.ReadFile of "input.txt" reads that file's
                 text. Nothing a run writes outlives the run.
              6. Stop during a build or a run ends it as Stop does now. The fresh worker adopts
                 the compiled compiler and linker beside the built program, so the next build
                 fetches and compiles no toolchain module, and the next run runs the program
                 with no build.
              7. A build's timings add two phases beside the existing ones: Go compile and link.
                 The phase order is fetch, compile, Go compile, link, instantiate, start, call,
                 run. The timings label the existing compile phase "Wasm compile", and a phase
                 timed in several parts (the toolchain's and the program's Wasm compile) reports
                 its sum once. Runs that build nothing show the same phases as before.
              8. sl-go-demo gains a third mode, built from source. Run builds the demo's files
                 through the runner and then runs the program's main, its exit in the console.
                 The fences are editable, and editable-files applies. Ctrl or Cmd+Enter, Stop,
                 Reset, the timings, and the file tabs behave as in the program mode. A failed
                 build shows behavior 4's output and exit and runs nothing. The demo's runner
                 subset gains build, which TypeScript checks against the runtime's Runner in
                 the page. The handler and program modes are unchanged, and the demo still
                 imports nothing from the runtime and fetches nothing itself.
              9. A playground page, linked from the index, holds one editable-files sl-go-demo
                 in the source mode. It opens on hello's source, equal byte for byte to the hello
                 entrypoint under the unit tier. The page requests no Go before a Run. It passes
                 every SDK shell check, and the crawl reaches the index, the components page,
                 and the playground alone.
              10. On the playground page in the browser tier, the first Run fetches the
                  manifest, the compiler, the linker, and only hello's closure of archives, and
                  prints hello with exit 0 and every phase of behavior 7. A Run after an edit
                  fetches no toolchain module and no archive already held. A new standard import
                  fetches only the archives its closure adds. An edited program that prints
                  something else prints it. A compile error, Stop during a busy loop, and a
                  non-Go file read through os.ReadFile each behave as behaviors 4, 6, and 5 say.
              11. mise run live also holds the deployed manifest at 200 and the compiler it names
                  as application/wasm, gzip-encoded when gzip is accepted.
              12. The README documents the build request, the source mode (its attributes, the
                  program's limits, and the working directory's files), and the playground page.
                  The context's capabilities list the playground as built, and the direction
                  checks hold every tier unchanged.
Test seams    mise run check: the unit tier for 1 and the fence equality in 9, and the build's
              compile and link steps over the runtime's in-memory fs under node for 2, 4, and 5.
              The browser tier, the built site under its base in chrome-headless-shell with the
              worker's fetches read through CDP, for 2 to 10 through the runner and sl-go-demo.
              The live command's assertions against local servers for 11.
Slices        1. Upgrade: chrome-headless-shell 157.0.8103.78 (its sha256 and size taken by hand)
                 and prettier 3.10.1. Done when mise run currency exits 0 and the check passes.
              2. The toolchain and the archives: the build step writes the compiler, the linker,
                 the standard library's archives, and the manifest, each file under its hashed
                 name. The manifest and closure tests run in the unit tier.
              3. The build steps: compile and link of given files over seeded archives on the
                 in-memory fs, proven under node in the unit tier: hello builds and runs, a
                 compile error with relative positions, an import the manifest lacks, a package
                 clause other than main, and a non-Go file read from the working directory.
              4. Building in the page: the runner's build request in the worker (the manifest
                 revalidated, archives fetched per closure and held, an unchanged build reused),
                 the Go compile and link phases with the timings' labels, Stop re-adopting the
                 toolchain, and sl-go-demo's source mode. A source demo on the components page
                 proves them in the browser tier, with a README entry.
              5. The playground page: hello's source, the index link, the shell checks, the
                 crawl, the fence test, behavior 10's fetch and run proofs, the live command's
                 two checks, the captures, and the docs.
Out of scope  persisting files, sharing, and a Format button; workspace modules' archives (the
              sqlate and scenarios tasks add them as they first require them); go.mod, local
              subpackages, cgo, assembly, and go:embed in a built program; argv and stdin for a
              built program; go vet and go test in the page; the four programs (the programs
              task); timings on the live site and the size report (the measure task); Firefox and
              Safari runs; any release, or any change to a reference repository.
Door          two-way: nothing is released, the build outputs are regenerated on every build
              and never tracked, go.mod gains no requirement, and the playground is a public
              page that can be removed.

## Progress

slices 1/5 committed · standards — · spec — · editor —

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
## Notes

- sqlate's own currency trails (pgx 5.12.0, golangci-lint 2.15.0, mise go 1.27.4); that belongs to
  the goal that next locks sqlate.
- spike-html-hosting-sdk's markdownPages has no hook for marked extensions; an intake candidate.
- A browser running a wasm build is another runtime layer; this spike's answer bears on the
  `elemental-runtime-layers` backlog goal.
- wasm_exec.js caps argv and the environment together at 12 KB; `GOOS=js` go test under node
  needs a trimmed environment, and the playground's compile and link argv must fit too.
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
- An element with `contain: inline-size` measures 0 in an auto grid track; size the track.
- The foundation's elements layer veils `::backdrop`, which a popover in the top layer has too; a
  popover that veils nothing sets its backdrop transparent.
- The foundation's keys.js passes over a keydown whose default is prevented, so a component keeps
  a key from firing a page shortcut by preventing its default.
- node --test sets no timeout by default, so a browser-tier wait that never resolves hangs the
  check; every wait needs its own bound.
- CDP Fetch enabled on the page intercepts the worker's .wasm fetch, which the page's Network
  domain doesn't see; a paused request of a terminated worker may be gone when continued.
- The foundation's elements layer zeroes a container's first-child heading's top margin and leaves
  the space between sections to the page, so every page on it must set its own section spacing
  (the components page's `main > section` rule, from spike-html-apps-components' demo.css); the
  components page shipped without it. An intake candidate: a page-layout sheet the SDK or the
  foundation ships, so no page has to know.

- The 100 GB/month soft bandwidth limit on Pages works out to about 5,000 cold playground runs a
  month. This belongs in the answer task's verdict.
- Whether sqlate, go-core, and go-web-sdk build archives for js/wasm is unknown. The sqlate and
  scenarios tasks settle it. The newest versions so far come from local tags only, so check
  them against the remotes when those tasks plan.

## Pending edits

- coordinator · html-artifacts.md: under "Experiment: spike-html-go-wasm", a candidate principle
  for the web standard experiment.html's intake may found: a component holds no authoritative
  state; a DOM-free model below it, written by one owner (the composing element or the page),
  holds the state, its rules, and its validation. Evidence: this spike's FileSet and
  EditorSettings.
- coordinator · roadmap.toml: in the components task's summary, "sl-run-controls" becomes
  "sl-controls", and "with a specimen page" becomes "with a components page".
