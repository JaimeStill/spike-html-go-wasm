# goal · experiment.html.spike-html-go-wasm

- **State:** idle
- **Task:** none
- **Branch:** none

## Tasks

1. [x] site
2. [x] runtime
3. [ ] components
4. [ ] playground
5. [ ] programs
6. [ ] sqlate
7. [ ] scenarios
8. [ ] measure
9. [ ] review
10. [ ] answer

## Task brief · runtime

Problem       hello runs only by hand on the main thread, through wasm_exec.js's stub fs, and
              nothing can call Go, stream its output, give it files, or stop it. Every later task
              needs the Go bridge, the on-demand loader, one worker per page, the in-memory fs,
              and Stop, used unchanged by every scenario (evidence 6, 11).
Behaviors     1. The bridge registers named Go handlers on one long-lived instance; each call runs
                 in its own goroutine and answers a Promise: a string in, JSON out, a Go error a
                 rejection carrying its message. A handler that blocks (a channel, a sleep, a
                 file call) resolves without deadlock; an unknown name rejects naming it.
              2. A panic in a handler rejects that call with the panic's message, and the instance
                 keeps answering later calls.
              3. The bridge's Go tests run in the check as GOOS=js go test under node, with an
                 environment trimmed below wasm_exec.js's 12 KB argv+env cap; reads no network.
              4. The runtime's own in-memory fs implements every call Go's syscall package makes:
                 open (Node's O_* constants), close, read and write (positional too), fstat with
                 isDirectory, stat, lstat, mkdir, readdir, rmdir, unlink, rename, truncate,
                 ftruncate, fsync, chmod, fchmod, utimes, and process.cwd and chdir. link,
                 symlink, readlink, and the chown calls answer ENOSYS; every error carries a Node
                 code Go maps (ENOENT, EEXIST, ENOTDIR, EISDIR, ENOTEMPTY, EBADF, ENOSYS). It
                 imports nothing beyond the runtime's own files.
              5. Under node in the check, a Go test program running on the in-memory fs in place
                 of node's passes: create, read, write, seek, stat, readdir, rename, remove,
                 MkdirTemp, and Getwd/Chdir through package os.
              6. Writes to fds 1 and 2, through writeSync (runtime prints, panics) or write
                 (os.Stdout, os.Stderr), become output events labelled stdout or stderr, in order,
                 as written and unbuffered.
              7. A page requests no .wasm and no worker script on load. The first run starts one
                 dedicated worker, and the page never has more than one. The worker loads
                 wasm_exec.js bundled after the in-memory fs, so the shim's stub fs never
                 installs.
              8. The runtime exports a runner type with load (a scenario's module by name), run,
                 and stop, and with output, exit, and timing events. Timings per run: fetch,
                 compile, instantiate, start (main running to handlers registered), and call or
                 run. A cached load fetches over the HTTP cache. Switching scenarios happens in
                 place in the one worker, dropping the previous instance.
              9. A program scenario runs main to completion: hello, moved onto the runtime,
                 prints its one line as stdout output and exits 0. A Go program that exits
                 (os.Exit, or a panic outside a handler) emits its stderr and its exit code, and
                 the next run instantiates afresh from the held module, with no new fetch.
              10. Stop terminates the worker and reposts the held compiled module to a fresh
                  one. After Stop ends probe's spin, a format call answers with no new .wasm
                  request; Stop while idle leaves the runner ready.
              11. The probe scenario, an entrypoint and its composition root on the bridge,
                  imports only the standard library and the bridge. Its handlers: format (JSON
                  text in, indented JSON or the parse error out, one line to stdout); files
                  (writes, lists, reads back, and removes files under a temporary directory
                  through package os, reporting each step); spin (a busy loop with no yield
                  that only Stop ends). The build writes probe's wasm beside hello's.
              12. A published runtime hand page, linked from the index, runs hello and probe's
                  three handlers through the runner with plain controls (no components): an
                  input, Run per handler, Stop, the output, and the timings. It passes every SDK
                  shell check, the crawl reaches it, and it loads Go only on a Run.
              13. Both direction checks still pass. The runtime imports only its own files, the
                  runtime page's script imports only the runtime and the shell's packages, and
                  the probe's layers hold under the go list test.
Test seams    `mise run check`: the Go tests under node for 1–5; the browser tier, the runtime page
              in chrome-headless-shell over the built site under its base, for 6–12; the lint and
              unit tiers for 13.
Slices        1. Bridge: the handler registry and probe's format handler, with the Go tests under
                 node in the check.
              2. In-memory fs: every call, the Go test program under node in the check, and
                 probe's files handler.
              3. Worker and runner: the runner type, the on-demand loader, one worker with
                 wasm_exec.js bundled after the fs, the long-lived instance, output, exit, and
                 timing events. hello moves onto the runtime, and the runtime page runs hello,
                 format, and files, proven in the browser tier.
              4. Stop: probe's spin handler, terminate and repost, and the browser tier's proof
                 of no refetch and a working next call.
              5. Upgrade (added by escalation, after brief ready): spike-html-hosting-sdk v0.6.2,
                 Help's heading taking focus as it opens, on both pages; node 26.13.1.
Out of scope  the six components and the specimen page; the playground's toolchain, archives,
              manifest, and compiling or linking in the page; persistence (OPFS, IndexedDB, Cache
              Storage); any workspace module or go.mod requirement; sizes, TinyGo, and timings on
              the live site; Markdown pages; Firefox and Safari runs; any change to the live
              command, or a reference repository other than the help dialog fix escalation 1
              approved.
Door          one-way for the SDK tag (released); the rest two-way: the runtime page is a public
              page that can be removed.
Release       spike-html-hosting-sdk v0.6.2 (released during BUILD, by escalation 1).

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

## Notes

- sqlate's own currency trails (pgx 5.12.0, golangci-lint 2.15.0, mise go 1.27.4); that belongs to
  the goal that next locks sqlate.
- spike-html-hosting-sdk's markdownPages has no hook for marked extensions; an intake candidate.
- A browser running a wasm build is another runtime layer; this spike's answer bears on the
  `elemental-runtime-layers` backlog goal.
- `GOOS=js` go test under node needs a trimmed environment: wasm_exec.js caps argv+env at 12 KB,
  and mise's environment overflows it.
- SDK v0.6.1's site.css places header-actions at the inline end only beside a site nav; an
  intake candidate.
- Vite's preview doesn't gzip, so the live command alone proves the gzip assertion, against the
  deployed site.
- After Stop, a handler call's timings are instantiate, start, and call; a program's are
  instantiate and run.
- Switching back to a scenario refetches it over the HTTP cache, because the worker holds only the
  current module.
- The page's CDP Network domain doesn't see the worker's requests, so the browser tests auto-attach
  to workers through CDP to count them.
- When Go exits during a call, wasm_exec.js deletes the instance, so the worker races the exit's
  rejection ahead of the call.
- The SDK's Release workflow tags a release itself, on a release commit above the merge; pushing
  the tag by hand is rejected as already existing.
- The SDK removes the focus outline on Help's heading, which isn't a control; spike-html-hosting-
  sqlate's STANDARDS.md says "Focus is always visible", so its next review may raise it.
- staticcheck SA5002 flags an empty `for {}`; the probe's spin loops on a counter.

## Pending edits

- none
