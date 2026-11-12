# goal · experiment.html.spike-html-go-wasm

- **State:** handoff
- **Task:** components
- **Branch:** components

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

## Task brief · components

Problem       Go runs in the page only through the runtime page's plain controls: a textarea,
              a button per handler, and bare output, timings, and result. No scenario can show
              editable, highlighted Go beside its live output. sl-go-demo needs a source editor
              in every palette, a file set, a console, controls, and timings, composed over the
              page's runner and used unchanged by every later scenario, hand page and Markdown
              page alike (evidence 11). Two demos on one page also share one runner whose
              output events name no caller, so the runner must run one request at a time.
              The architect asked for well-crafted components: each one finished in every
              state, palette, and space profile, with its keyboard model, accessibility tree,
              and documentation.
Behaviors     1. The runner runs one load or run at a time. A load or run started while another
                 is pending first stops the pending one, which rejects with "stopped", and then
                 proceeds, so every event between a request's start and its settling belongs to
                 that request. A load of the scenario already held, with nothing pending, stays
                 a no-op, and Stop behaves as before.
              2. The editor's colours are each palette's syntax theme, merged per palette into
                 light-dark() colours by a build step adapted from the SDK's merge of its
                 built-in syntax themes. In each palette and each scheme, every token of a go
                 fence and of a JSON input paints in the editor the same colour the SDK's
                 rendered fence gives the same code, through Custom Highlight ranges, with no
                 span in the editor's text. A palette with no syntax theme paints plain text.
                 Several editors on one page share the document's highlight registry, and
                 removing one leaves the others painted.
              3. sl-code-editor is a plaintext-only contenteditable in its shadow root, exposed
                 as a labelled multiline textbox, named by its label or aria-labelledby.
                 Highlighting loads lazily on first upgrade: Shiki 4.6.0's core, its
                 JavaScript regex engine, and the Go and JSON grammars, the build emitting no
                 other grammar. Until it loads, and for any other language, the text shows
                 plain. A re-highlight after an edit never blocks typing or moves the caret or
                 the selection.
              4. The editor's line-number gutter is hidden from assistive technology and holds
                 no text the editor's value includes. It stays aligned with each line at every
                 space and type profile, and with wrapped and long lines.
              5. Enter inserts a line break carrying the current line's leading whitespace. Tab
                 inserts a tab, or with a selection indents every selected line. Shift+Tab
                 outdents the current or selected lines. Each edit goes through insertText, so
                 one undo reverts it and redo restores it. Escape releases Tab, so the next Tab
                 or Shift+Tab moves focus out of the editor, never trapping it; typing or a
                 click re-arms it. IME composition commits as typed.
              6. A read-only editor keeps its highlighting, selection, copy, and focus. It
                 rejects every edit, Tab and Enter included, and is exposed as read-only.
                 The editor sends input on every edit and change once focus leaves with its
                 value changed. value reads and sets the whole text, and setting it sends
                 neither event.
              7. A DOM-free file set in the components tier holds files (name, text, the text
                 as given, modified, read-only) and the active file, and sends a change event
                 on each change. It refuses an empty name, a duplicate, or a name holding a
                 path separator, naming the reason. Reset restores a file's text as given.
                 Under the unit tier, select, edit, reset, new, rename, and delete each change
                 it as stated, and deleting the active file activates its neighbour.
              8. sl-file-tabs renders a file set it never writes, as the ARIA tabs pattern:
                 a tablist with one tab per file, roving tabindex, Left and Right wrapping,
                 Home and End, and activation on focus. A modified file shows a marker that is
                 also exposed in its accessible name. Each tab controls the editor panel.
                 Selecting a tab sends a select request, and the element changes only when the
                 set does.
              9. sl-console shows output in order, as written, keeping Go's line breaks and
                 wrapping long lines. stdout is plain. stderr has its own colour plus a cue
                 that doesn't depend on colour, exposed to assistive technology. An exit shows
                 as a status line naming the scenario and its code, and a handler's result or
                 error shows as its own block. ANSI escapes show as text. The console keeps
                 the latest 10,000 lines and a count of those dropped. It follows the tail
                 unless the reader has scrolled up, and follows again once they return to the
                 end. Copy puts the kept text on the clipboard; Clear empties it. It is a log
                 that announces no write.
              10. sl-timings shows the last run's phases (fetch, compile, instantiate, start,
                  call or run) as a table in ms with a total, and only the phases the run had.
                  A new run replaces it.
              11. sl-controls is an ARIA toolbar with arrow-key movement between its controls:
                  a run group (Run, Stop, Reset), a separator, and a files group (New file,
                  Rename, Delete) present only under editable-files. Stop is enabled only
                  while a run is pending, and Reset only when a file differs from its text as
                  given. New file and Rename open a small form in a popover anchored to their
                  button, validating as the file set does and naming the reason in the form,
                  with Escape or a submit returning focus to the button. Delete sends a delete
                  request. The toolbar announces a run's start and finish through a polite
                  status. Every control sends a request event and changes nothing itself.
              12. sl-go-demo declares the runner's structural subset it reads (load, run, stop,
                  and listen, with the output, exit, and timing events re-declared) and takes
                  the runner as a runner property, which TypeScript checks against the
                  runtime's Runner in the page. It imports nothing from the runtime and fetches
                  nothing. It builds its file set from its light-DOM go fences, the only writer
                  of that set, and applies the requests its parts send. Before the element
                  upgrades, and without script, the fence reads as the page's code.
              13. With a handler named, Run loads the scenario and calls the handler with the
                  one file's text, and the result or error shows in the console. A handler
                  demo with more than one fence shows a visible authoring error and does not
                  run. With no handler named, Run runs the prebuilt program's main, its fences
                  read-only, its tabs shown, its exit in the console. Ctrl or Cmd+Enter runs
                  only from inside the focused demo, declared by aria-keyshortcuts on Run. The
                  foundation's shortcut registry is untouched.
              14. Under editable-files, New file, Rename, and Delete change the demo's file set
                  as the file set validates them. After a delete, focus moves to the tab now
                  active, and the last file can't be deleted.
              15. A components page, linked from the index, replaces the runtime page. It shows
                  each component's states, every state labelled, again at 20rem, with keyboard
                  focus shown on one instance of each control. Its sl-go-demo elements run
                  hello, format, files, spin, and crash, and Stop, over one runner. Two demos
                  on it prove behavior 1: starting a run in one stops the other's pending run,
                  and each console holds only its own output. Go loads only on a Run. The page
                  passes every SDK shell check, and the crawl reaches the index and the
                  components page alone.
              16. Every proof the runtime page held still holds through sl-go-demo on the
                  components page: hello's line and exit 0; format's answer and its parse
                  error; files' steps; timings by phase; a held module reused with no fetch;
                  scenarios switched in place in one worker; Stop ending spin with no refetch
                  and one live worker; crash's stderr and exit 2, and the next call afresh.
              17. Every program demo's go fence on the components page equals its scenario's
                  entrypoint source byte for byte.
              18. Each element is defined by its module, exports its tag name, adopts the
                  foundation's reset and elements sheets and then its own as a CSS module
                  script, takes its spacing from the foundation's tokens, keeps focus visible,
                  and runs no motion under reduced motion. Each has a README entry covering its
                  attributes, properties, events, slots, and keyboard. The direction check
                  admits shiki to the components tier, and nothing else new, and still holds
                  every other tier.
Test seams    `mise run check`: the unit tier for 7 and 17 and the direction table in 18; the
              browser tier, the components page in chrome-headless-shell over the built site
              under its base, for 1–6 and 8–16 and the rest of 18, each component's
              accessibility tree read through CDP, its keyboard driven through CDP input, and
              reduced motion and each palette and scheme emulated or set through Settings.
Slices        1. One request at a time: the runner stops a pending request before a new one,
                 proven on the runtime page in the browser tier.
              2. Highlighting: Shiki pinned and admitted to the components tier, the
                 per-palette merge as a build step, and sl-code-editor's rendering (the
                 lazily loaded tokenizer, ranges, gutter, read-only, label). The components
                 page is created beside the runtime page with the editor's states, and the
                 colour test runs in every palette and scheme. README entry.
              3. Editing: Enter, Tab, Shift+Tab, Escape's release, undo and redo, IME, the
                 events, and value, each proven in the browser tier with its specimen states.
              3b. Editor settings (added after approval): a DOM-free EditorSettings model (wrap,
                 default off so long lines scroll; tab size, default 4, 1 to 8) that
                 sl-code-editor renders from and never writes, the gutter aligned in both
                 modes, Tab and Shift+Tab reading the tab size, specimen states for each; with
                 paste inserting plain text through the editor's own edit path and a read-only
                 editor not firing the page's single-key shortcuts.
              4. The file set and sl-file-tabs: the model under the unit tier, and the tabs'
                 keyboard model, modified marker, and accessibility tree on the components
                 page. README entry.
              5. sl-console: streams, the exit line, the result block, the cap and dropped
                 count, tail following, Copy and Clear, and the quiet log, with specimen
                 states fed by scripted events. README entry.
              6. sl-timings: the phase table and total, its specimen states. README entry.
              7. sl-controls: the toolbar, both groups, the popover forms and their
                 validation, enabled states, the status announcements, and focus return.
                 README entry.
              8. sl-go-demo: the runner subset, the fence contract, both Run modes, the
                 authoring error, Ctrl/Cmd+Enter, editable-files actions with focus after a
                 delete, and two demos sharing the runner, on the components page. README
                 entry.
              9. The takeover: the runtime page's runs and their proofs move onto sl-go-demo,
                 the runtime page goes, and the index link, shell checks, crawl, captures, and
                 docs follow. The fence-equality unit test runs.
Out of scope  compiling or linking source in the page, and running an edited program; argv
              and stdin for programs; persisting files; any Markdown page and the Markdown
              shell's entry (the sqlate task), though the light-DOM fence contract holds for
              it; bracket auto-close and matching, completion, find, and folding; grammars
              beyond Go and JSON; a timings history; ANSI colour; axe-core; Firefox and Safari
              runs; any release, or any change to a reference repository; moving any
              component to a shared layer.
Door          two-way: the components stay in this repository unreleased, the runtime change
              is local, and the components page is a public page that can be removed.

## Handoff

PR #3's check fails in CI: "at 20rem the toolbar wraps between its groups, each group whole on
its row" (test/browser/controls.test.ts): the files group (New file, Rename, Delete) splits over two
rows on the runner, whose monospace fallback is wider than the local font. Next move: fix the
files group's fit at 20rem on this branch, push, then merge PR #3.

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

## Pending edits

- coordinator · html-artifacts.md: under "Experiment: spike-html-go-wasm", a candidate principle
  for the web standard experiment.html's intake may found: a component holds no authoritative
  state; a DOM-free model below it, written by one owner (the composing element or the page),
  holds the state, its rules, and its validation. Evidence: this spike's FileSet and
  EditorSettings.
- coordinator · roadmap.toml: in the components task's summary, "sl-run-controls" becomes
  "sl-controls", and "with a specimen page" becomes "with a components page".
