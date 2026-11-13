# spike-html-go-wasm

spike-html-go-wasm runs workspace Go live in the browser through `GOOS=js` WebAssembly, on a
GitHub Pages project site over experiment.html's stack: four Go programs of our own and the
sqlate, go-core, and go-web-sdk demos, all editable in the page, and a playground that compiles
arbitrary Go in the page with Go's own compiler and linker. Its answer is evidence for
experiment.html's intake on whether v1.repository-docs and the Pages sites embed live Go demos.
The spike decides nothing itself.

The spike is the sub-goal `experiment.html.spike-html-go-wasm` in the coordinator's roadmap,
`standards-lab/context/roadmap.toml`, where its tasks live. Its question is framed in
`standards-lab/context/html-artifacts.md`, under "Experiment: spike-html-go-wasm".

## The question

Can a page run workspace Go live in the browser through `GOOS=js` WebAssembly (library demos,
service handlers called in-process, and a general Go playground that compiles arbitrary Go in the
page) with acceptable capability and performance? Sizes are measured and reported, not held to a
budget.

## The evidence

1. Workspace Go by published tag, built by standard Go for `GOOS=js` in the check and the Pages
   workflow; no committed .wasm.
2. A live sqlate page under `/<repo>/`: edit a statement, see its compiled SQL with `$n`
   placeholders and its compile errors.
3. A statement run in-process over sqltest's scripted driver, with no socket.
4. Each module's raw, gzip-as-Pages-serves, and brotli-11 bytes: README.md, "Measurements".
5. Cold-load cost on the live site: the page readable before the module, time to first result
   after the click, and cold, cached, and in-place-switch timings: README.md, "Measurements".
6. `wasm_exec.js` copied from the pinned toolchain with provenance; .wasm served as
   application/wasm.
7. The screenshot review, every palette's editor included, leaving no capture file; Firefox and
   Safari where available.
8. The verdict for v1.repository-docs and the Pages sites.
9. A playground where the reader edits and runs arbitrary Go in the page, with load, compile,
   link, and run timings.
10. The go-core graph and go-web-sdk demos live, their sizes reported.
11. The bridge, the runtime, and sl-go-demo used unchanged by every scenario, embedded in a
    rendered Markdown page and in a hand page.
12. The four programs (basics, generics, concurrency, standard library) edited and run in the
    page.
13. The performance, optimization, and ergonomics review, with what it changed.

## Capabilities

One repository, one Go module, one Pages site, in Elemental layers; dependencies flow downward.
The check holds the direction: `eslint.config.js` for the web tiers and `test/unit/go-module.ts`
for the Go packages.

- **Go bridge** (`bridge/`, infrastructure): `Serve` installs named Go handlers on
  `globalThis.goBridge` from one long-lived instance. Each call runs in its own goroutine and
  answers a Promise that resolves with JSON text, or rejects with the handler's error, its panic's
  message, or the unknown name.
- **Scenarios** (`internal/<scenario>`, composition roots; `cmd/<scenario>`, entrypoints, one
  wasm each): `cmd/hello`, a standard-library program; the probe (`internal/probe`,
  `cmd/probe`), which imports only the standard library and the bridge and serves four handlers
  that prove the runtime: format, files, spin, and crash; and sqlate (`internal/sqlate`,
  `cmd/sqlate`), which imports only the standard library, the bridge, and sqlate and serves one
  handler, compile: one statement's text compiled for PostgreSQL against PostgreSQL's patterns
  plus the sqlate program's sample app patterns, embedded byte for byte (the unit tier holds
  it), answering its `$n` SQL and printing its tier and parameters, or rejecting with sqlate's
  message; and websdk (`internal/websdk`, `cmd/websdk`), which imports only the standard library,
  the bridge, and go-web-sdk's and go-core's packages (the unit tier holds its import listing) and
  serves one handler, request: one raw HTTP/1.1 request's text, parsed by net/http's
  `ReadRequest` and served through go-web-sdk's Router's `ServeHTTP` into an `httptest` recorder,
  with no socket, answered as the response's text. The Router serves a sample projects resource,
  seeded at startup and kept for the instance's life; `README.md`, "go-web-sdk", documents the
  request format and the routes.
- **Runtime** (`web/runtime`, the SDK tier): `runner.ts` exports the `Runner` type (load, build,
  run, stop; output, exit, and timing events), and starts one dedicated worker, `worker.ts`, on
  the first load or build. The worker fetches a module over the HTTP cache, compiles it, and runs
  instances of it through `wasm_exec.js` over the in-memory fs in `fs.ts`, which `install-fs.ts`
  installs first. `protocol.ts` holds the events and the messages between the runner and the
  worker. The runner runs one load, build, or run at a time: a new request first stops the
  pending one, so every event belongs to the request that is pending. Stop terminates the worker
  and posts the compiled program, compiler, and linker to a fresh one. When an instance exits, the
  worker clears its scheduled timeouts in the Go object's `exit` hook, so no timer `wasm_exec.js`
  leaves scheduled resumes the exited program; `wasm_exec.js` stays the pinned Go's copy.
  `README.md`, "Runtime", documents each request and the guard.
- **Go tests on the in-memory fs** (`test/memfs`): a Go test program that the check runs under
  node on the runtime's fs, through package `os`.
- **Playground**: the runner's build request (`web/runtime/build.ts`) runs Go's own
  `cmd/compile` and `cmd/link`, built by the pinned Go for `GOOS=js`
  (`scripts/build-toolchain.ts`), in the worker, and fetches each package's archive per import
  through `go/toolchain/manifest.json`, which names the standard library's, under `std/`, and the
  site's pinned modules', under `mod/`: every package of go.mod's requirements the repository's
  own packages depend on, which are sqlate's, go-core's, and go-web-sdk's and their dependencies'.
  A program imports the standard library and the site's pinned modules. The runner reuses the
  last build when only non-Go files change (`isGo` in `build.ts`), so editing `input.txt` alone
  reruns the program without building.
  `playground.html` is one screen: the heading with the Program select beside it, a two-sentence
  lede, and one fixed, source-mode sl-go-demo that shows the chosen program, fills the rest of the
  viewport, and ends one gutter above its bottom. The select offers the starter and the four
  programs; the page keeps one `FileSet` per program, built from its fences by the demo's own rules
  (`web/components/fences.ts`), and gives the chosen one to the demo as its `files` property, so
  edits survive switching within the tab. The fragment (`#calc`, `#basics`, `#generics`,
  `#concurrency`, `#stdlib`) names the program shown, and each choice writes it as a new history
  entry; no fragment, or an unknown one, opens the calculator. The page's detail, what a program can
  be and how Run and Stop behave, is in an About dialog that the header's About button opens. The
  check's layout tests run twice: in the machine's fonts, and in a pinned DejaVu font set, the six
  faces of Ubuntu's fonts-dejavu-core.
- **Programs** (`playground/<program>`, each a package main outside `cmd/`, not a scenario): the
  starter, `calc`, a calculator language whose files are the playground demo's own fences, which
  runs the script in `input.txt`; and four programs whose files are templates in the page:
  `basics` (structs, methods, function values, interfaces), `generics` (a constraint, a generic
  type, range-over-func iterators), `concurrency` (goroutines, channels, select, a WaitGroup, a
  pipeline), and `stdlib` (release notes from a commit log in `input.json`, through
  encoding/json, regexp, slices, and text/template). The check vets each and runs its tests
  under `GOOS=js` on both filesystems; the build never writes them to `dist/`. The browser tier
  reports each one's cold and warm phase timings and its closure, never as a gate
  (`mise run report:programs`). Beside them, `sqlate`, not in the Program select: it compiles the
  `.sql` files in its working directory with sqlate for PostgreSQL, each `<ns>.<name>.sql` a
  pattern in namespace `ns` and any other `.sql` a statement, and prints each statement; then
  `guard.go` runs the edit statement, guarded by the version statement, over sqltest's scripted
  driver, its outcome set by `input.json`. A catalog or compile error prints sqlate's message on
  one stderr line and exits 1. And `graph`, also not in the Program select: it wires a small
  service on go-core's graph, prints the System's layer table, and runs it under lifecycle's
  Coordinator, each participant printing its start in layer order and its stop in reverse; a
  constructor's error prints graph's message on one stderr line and exits 1, and a dependency
  cycle makes Build panic, exit 2.
- **Components** (`web/components`, the component tier, Lit, `sl-` prefix): sl-code-editor,
  sl-file-tabs, sl-console, sl-controls, sl-timings, and sl-go-demo, which composes the other five
  over a runner the page passes in. With `fixed`, sl-go-demo is as tall as its parent's layout
  makes it, never below a floor of six editor lines and two console lines
  (`--sl-go-demo-editor-lines`, `--sl-go-demo-console-lines`), and divides that height among its
  parts in three width bands. For it, sl-console's `fill` takes the height given, at least
  `--sl-console-min-lines` lines tall; sl-controls' `steady` keeps the status to one line of a
  reserved width, `--sl-controls-status-inline-size`; and sl-controls, given an `Arrangement`,
  shows a Layout group, which the demo shows from 64rem. sl-timings states its table's least
  width once, `--sl-timings-min-inline-size`, and the demo's timings track reads it. Popovers
  (the Layout menu and the New file and Rename forms) are as wide as their content, bounded by
  their containing block and a form's `--popover-max-inline-size`. The file tabs and the fixed
  demo's output tabs share one sheet, `tabs.css`. No component holds authoritative state:
  DOM-free models, `Arrangement`, `EditorSettings`, `FileSet`, `ConsoleLog`, `RunTimings`, and
  `RunState`, hold it, each written by one owner, sl-go-demo or the page. sl-go-demo builds its
  `FileSet` from its fences unless the page gives it one as its `files` property; `fences.ts`
  holds the fence-reading rules, so a page reads a template's fences as the demo would, and
  `file-names.ts` the naming: a fence's own name wins, then sl-go-demo's `file` attribute, which
  names a fence that names none, as a rendered Markdown fence can't, then a default by language
  (`query.sql` for sql). sl-code-editor highlights Go, JSON, and SQL. No component imports the
  runtime. `README.md`, "Components", documents each module.
- **Pages** (`web/pages`, the apps tier, for the scripts and the stylesheet the pages load):
  `web/pages/page.css` holds every hand page's and the Markdown shell's own rules in the `page`
  cascade layer, which comes after the foundation's layers and the SDK's `site`; a hand page holds
  no inline `<style>`. A body of class `app` makes the page an app page: one column, main a grid of
  named lines with the prose (`.prose`) on an 80ch `content` column and the demo on the `full`
  column, and one gutter, `--page-gutter`, on the inline sides and the block end. `components.html`
  is a hand page whose script, `web/pages/components.ts`, shows every component's states once; its
  Go demos run hello and the probe's handlers over the page's one runner. `playground.html` is a
  hand page whose script, `web/pages/playground.ts`, gives its one source demo the page's runner,
  the reader's arrangement, and the chosen program's `FileSet`, and keeps the select and the
  fragment in step. `web/pages/arrangement.ts` owns that stored preference: its `keep()` reads the
  placement from localStorage under `spike-html-go-wasm.arrangement`, gives one `Arrangement` to
  every fixed demo on the page, and stores each Layout menu choice. `sqlate.html` is an app page,
  laid out as the playground is, whose script, `web/pages/sqlate.ts`, gives its one fixed source
  demo, on the sqlate program's files, the page's runner and the reader's arrangement; Run builds
  the program in the page.
- **Markdown pages** (`markdown/`, the spike's own tree, never copied into `content/`):
  `vite.config.ts` gives the SDK's `markdownPages` the directory as one tree's source, its
  repository URL and a ref it reads only for external links, which the tree has none of, so
  each `markdown/<page>.md` builds to `<page>.html`, filled into `markdown-shell.html`, the
  index's shell with the Pages and Contents drawers and no site nav. The shell's script,
  `web/pages/markdown.ts`, gives every `<sl-go-demo>` on the page the page's one runner and wires
  the drawers; Go loads only on a Run. `sqlate-compile.html` embeds the sqlate scenario's compile
  handler around an ordinary sql fence, which the plugin highlights at build, named
  `statement.sql` by the demo's `file` attribute. `go-core-graph.html` embeds a source demo around
  one go fence, byte for byte `playground/graph/main.go` (the unit tier holds it), which a Run
  builds in the page. `go-web-sdk-handlers.html` embeds the websdk scenario's request handler
  around a fence naming no language, named `request.http`, plain text before and after the demo
  upgrades; its prose's `http` and `json` fences are highlighted at build. A demo's fence isn't
  shown once the demo upgrades, so each page's prose also holds highlighted fences for the palette
  check. Each page passes the SDK's shell checks, palette check, and crawl. `content.json`
  records no tree, so the site test (`test/browser/site.test.ts`) crawls from a scratch root under
  TMPDIR whose `content.json` records `markdown/` as one copied tree, and the crawl checks each
  rendered page as a copied page, pagers and site index included.
- **Measurement** (`scripts/measure.ts`, `scripts/measure-timings.ts`, and
  `scripts/measure-report.ts`, tooling outside the check): `mise run measure` prints the live
  site's deployed commit, sizes, build drift, and desktop timings, judging no number. `README.md`,
  "Tasks", documents the command, and "Measurements" holds its output.

## Path

The tasks, in the order they run; each cites the evidence it proves.

1. `site`: the repository scaffolded from spike-html-hosting-sdk, the layout and both direction
   checks, Go built for `GOOS=js`, deployed by Pages (evidence 1, 6).
2. `runtime`: the Go bridge, the loader, the worker, the in-memory filesystem, and Stop
   (evidence 6, 11).
3. `components`: the six elements and the components page (evidence 11).
4. `playground`: the toolchain, the archives and manifest, and the playground page (evidence 9).
5. `programs`: the four programs, run from source in the playground (evidence 12).
6. `sqlate`: the compile demo and the in-process sqltest run, on a hand page and a Markdown page
   (evidence 2, 3, 11).
7. `scenarios`: the go-core graph and go-web-sdk demos (evidence 10).
8. `measure`: sizes and timings on the live site, on desktop and on an iPhone (evidence 4, 5).
9. `review`: the screenshot review (evidence 7).
10. `final-review`: the performance, optimization, and ergonomics reviews, landing what's within
    reach (evidence 13).
11. `answer`: the verdict (evidence 8).

## References

The spike reads these repositories and never writes to them. Each is a key in the coordinator's
`references.toml`, with its local checkout in `references.local.toml`:

- `sqlate`, `go-core`, and `go-web-sdk`: the demos' Go, each at its latest release when a task
  plans; graph-ergonomics is updating the Go stack.
- `spike-html-hosting-sdk` at v0.6.2, `spike-html-hosting-components` at v0.5.0, and
  `spike-html-hosting-icons` at v0.1.0: the site scaffold, shell, and Shiki 4.6.0 themes.
- `spike-html-apps-foundation` at v0.3.0, through the SDK: the visual baseline.
- `spike-html-apps-tooling` at v0.3.0: the screenshot review.
- `spike-html-hosting` at 421254d: the cost command.
- `spike-html-apps` at dae9a77: the ESLint boundaries table.

## The answer

Pending: the `answer` task writes it.
