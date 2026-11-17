# spike-html-go-wasm

spike-html-go-wasm runs workspace Go live in the browser through `GOOS=js` WebAssembly, on a
GitHub Pages project site over experiment.html's stack: four Go programs of our own and the
sqlate, go-core, and go-web-sdk demos, all editable in the page, and a playground that compiles
arbitrary Go in the page with Go's own compiler and linker. Its answer, under
[The answer](#the-answer), gives experiment.html's intake the evidence and the architect's verdict
on whether v1.repository-docs and the Pages sites embed live Go demos. The intake decides; the
spike decides nothing itself.

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
   Safari where available: README.md, "Review".
8. [The verdict](#the-answer) for v1.repository-docs and the Pages sites.
9. A playground where the reader edits and runs arbitrary Go in the page, with load, compile,
   link, and run timings.
10. The go-core graph and go-web-sdk demos live, their sizes reported.
11. The bridge, the runtime, and sl-go-demo used unchanged by every scenario, embedded in a
    rendered Markdown page and in a hand page.
12. The four programs (basics, generics, concurrency, standard library) edited and run in the
    page.

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
  (`query.sql` for sql), and `input.txt` for a fence naming no language. sl-code-editor highlights
  Go, JSON, and SQL. No component imports the runtime. `README.md`, "Components", documents each
  module.
- **Pages** (`web/pages`, the apps tier, for the scripts and the stylesheet the pages load):
  `web/pages/page.css` holds every hand page's and the Markdown shell's own rules in the `page`
  cascade layer, which comes after the foundation's layers and the SDK's `site`; a hand page holds
  no inline `<style>`. The build writes the Site nav into every page's header from one list,
  `SITE_NAV` in `scripts/site-nav.ts`; where its row doesn't fit beside the header's buttons, as
  `web/pages/site-nav.ts` measures, it collapses into a drawer, which that script opens and
  closes (`README.md`, "Pages"). A body of class `app` makes the page an app page: one column,
  main a grid of named lines with the prose (`.prose`) on an 80ch `content` column and the demo
  on the `full` column, and one gutter, `--page-gutter`, on the inline sides and the block end.
  `components.html` is a hand page whose script, `web/pages/components.ts`, shows every
  component's states once; its Go demos run hello and the probe's handlers over the
  page's one runner. `playground.html` is a hand page whose script, `web/pages/playground.ts`, gives
  its one source demo the page's runner, the reader's arrangement, and the chosen program's
  `FileSet`, and keeps the select and the fragment in step. `web/pages/arrangement.ts` owns that
  stored preference: its `keep()` reads the placement from localStorage under
  `spike-html-go-wasm.arrangement`, gives one `Arrangement` to every fixed demo on the page, and
  stores each Layout menu choice. `sqlate.html` is an app page, laid out as the playground is, whose
  script, `web/pages/sqlate.ts`, gives its one fixed source demo, on the sqlate program's files, the
  page's runner and the reader's arrangement; Run builds the program in the page.
- **Markdown pages** (`markdown/`, the spike's own tree, never copied into `content/`):
  `vite.config.ts` gives the SDK's `markdownPages` the directory as one tree's source, its
  repository URL and a ref it reads only for external links, which the tree has none of, so
  each `markdown/<page>.md` builds to `<page>.html`, filled into `markdown-shell.html`, the
  index's shell with the Pages and Contents drawers and the Site nav. The shell's script,
  `web/pages/markdown.ts`, gives every `<sl-go-demo>` on the page the page's one runner and wires
  the drawers; Go loads only on a Run. `sqlate-compile.html` embeds the sqlate scenario's compile
  handler around an ordinary sql fence, which the plugin highlights at build, named
  `statement.sql` by the demo's `file` attribute. `go-core-graph.html` embeds a source demo around
  one go fence, byte for byte `playground/graph/main.go` (the unit tier holds it), which a Run
  builds in the page. `go-web-sdk-handlers.html` embeds the websdk scenario's request handler
  around a fence naming no language, named `request.http`, plain text before and after the demo
  upgrades; its prose's `http` and `json` fences are highlighted at build. A demo's fence isn't
  shown once the demo upgrades, so each page's prose also holds highlighted fences for the palette
  check. Each page passes the SDK's shell checks, palette check, and crawl. The site has no
  `content.json`, so the site test (`test/browser/site.test.ts`) crawls from a scratch root under
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
10. `answer`: the verdict (evidence 8).

## References

The spike reads these repositories and never writes to them, with one exception: the `review`
task, by the architect's decision, fixed the defects it found in the reference layers at their
root and released them there. Each is a key in the coordinator's `references.toml`, with its local
checkout in `references.local.toml`:

- `sqlate`, `go-core`, and `go-web-sdk`: the demos' Go, each at its latest release when a task
  plans; graph-ergonomics is updating the Go stack.
- `spike-html-hosting-sdk` at v0.6.4, `spike-html-hosting-components` at v0.5.1, and
  `spike-html-hosting-icons` at v0.1.0: the site scaffold, shell, and Shiki 4.6.0 themes.
- `spike-html-apps-foundation` at v0.3.1, through the SDK: the visual baseline.
- `spike-html-apps-tooling` at v0.3.0: the screenshot review.
- `spike-html-hosting` at 421254d: the cost command.
- `spike-html-apps` at dae9a77: the ESLint boundaries table.

## The answer

**Question:** Can a page run workspace Go live in the browser through GOOS=js WebAssembly (library
demos, service handlers called in-process, and a Go playground that compiles arbitrary Go in the
page with Go's own compiler and linker) with acceptable capability and performance? Sizes are
measured, not gated.

**Answer:** Yes: live Go demos are viable on v1.repository-docs' guides and on every Pages site,
in both proven kinds, a prebuilt handler module and source built in the page by Go's own compiler
and linker; both stay options, each goal chooses its demos and their kinds as it plans, and no
site is pre-selected.

The live demo is <https://jaimestill.github.io/spike-html-go-wasm/>. Every figure below is
README.md, "Measurements", measured on 2026-11-13 against the deployed commit 13d8348, unless it
says otherwise.

1. Built from published tags, served as wasm (evidence 1, 6): go.mod requires each module by its
   tag, with no replace directive or local path; the check and the Pages workflow build the Go
   for `GOOS=js`; no `.wasm` or `.a` is tracked; `wasm_exec.js` is the pinned Go's copy below
   one provenance line. Proven by `mise run check` (`test/unit/go-module.test.ts`, "go.mod";
   `scripts/check-go.sh` for the tracked files and `wasm_exec.js`), by the deploy of
   `.github/workflows/pages.yml`, and by `mise run live`, which holds `go/hello.wasm` and the
   compiler as `application/wasm`, gzip-encoded, on the live site (its logic held by
   `test/unit/live.test.ts`). `mise run measure` read the deployed commit from the live
   `go/hello.wasm`'s `vcs.revision`.
2. sqlate compiled live (evidence 2): edit a statement, see its `$n` SQL or sqlate's error, from
   the prebuilt `go/sqlate.wasm` on
   [sqlate-compile.html](https://jaimestill.github.io/spike-html-go-wasm/sqlate-compile.html) and
   from source built in the page on
   [sqlate.html](https://jaimestill.github.io/spike-html-go-wasm/sqlate.html). Proven by
   `test/browser/sqlate-compile.test.ts`, `test/browser/sqlate.test.ts`, and `internal/sqlate`'s
   and `playground/sqlate`'s Go tests, and by the live pages.
3. A statement run in-process over sqltest's scripted driver, no socket (evidence 3): the sqlate
   page's guarded edit. Proven by `playground/sqlate`'s Go tests, run as wasm under node in the
   check, and `test/browser/sqlate.test.ts`, and by
   [sqlate.html](https://jaimestill.github.io/spike-html-go-wasm/sqlate.html); that it opens no
   socket is proven only by tests.
4. Sizes and cold-load cost (evidence 4, 5): each module's raw, gzip-as-served, and brotli-11
   bytes; each page readable before any module, no `.wasm` requested before Run on any page,
   and first result, cold, cached, and in place. Proven by `mise run measure` on 2026-11-13, and
   on the iPhone by hand; "no Go before a Run" also by `test/browser/go-demo.test.ts` and each
   demo page's browser test. The figures are under Cost, below.
5. The review (evidence 7): every page in chrome-headless-shell at 390, 900, 1120, and 1376px,
   the first pass across every palette and scheme, the editor included, leaving no capture file;
   Firefox 158.0.1 and the iPhone's Safari by hand, on the review branch's build over the local
   network, with no findings. Proven by the architect's
   review (README.md, "Review") over `mise run screenshots`, with
   `test/browser/screenshots.test.ts` holding that the command leaves nothing. Desktop Safari and
   WebKitGTK are gaps.
6. The verdict (evidence 8): this section, the architect's ruling of 2026-11-17.
7. The playground (evidence 9): arbitrary Go edited, compiled, linked, and run in the page, with
   load, compile, link, and run timings. Proven by `test/browser/playground.test.ts` and
   `test/browser/go-build.test.ts`, by `test/unit/toolchain.test.ts`, which holds each program's
   closure to Go's own `go list -deps` and runs the compiler and linker on the in-memory fs, and
   live on [playground.html](https://jaimestill.github.io/spike-html-go-wasm/playground.html).
8. go-core's graph and go-web-sdk's handlers (evidence 10): the graph built from source in the
   page; the handlers called in-process through go-web-sdk's Router in the prebuilt
   `go/websdk.wasm`; sizes under Cost. Proven by `test/browser/go-core-graph.test.ts`,
   `test/browser/go-web-sdk-handlers.test.ts`, and `playground/graph`'s and `internal/websdk`'s
   Go tests, and live on
   [go-core-graph.html](https://jaimestill.github.io/spike-html-go-wasm/go-core-graph.html) and
   [go-web-sdk-handlers.html](https://jaimestill.github.io/spike-html-go-wasm/go-web-sdk-handlers.html).
9. One bridge, runtime, and sl-go-demo for every scenario (evidence 11), on three rendered
   Markdown pages and three hand pages, the components page, the playground, and the sqlate page.
   That they are used unchanged is proven only by tests: `test/browser/go-demo.test.ts`,
   `test/browser/go-runs.test.ts`, each demo page's browser test, the layer direction
   (`eslint.config.js`, `test/unit/go-module.test.ts`), and `test/unit/go-demo-fences.test.ts`,
   which holds each page's fences to its program's files byte for byte.
10. The four programs (evidence 12): basics, generics, concurrency, and the standard library,
    edited and run in the page. Proven by `test/browser/playground-programs.test.ts` and each
    `playground/<program>`'s Go tests, which hold its exact output, and live on
    [playground.html#basics](https://jaimestill.github.io/spike-html-go-wasm/playground.html#basics)
    and its siblings `#generics`, `#concurrency`, and `#stdlib`; `mise run report:programs`
    reports each one's cost.

**Cost,** as measured facts and Pages arithmetic, with no budget; the intake sets any:

- Prebuilt modules, gzip as Pages serves them (brotli 11): hello 0.74 MB (0.55), probe 1.31 MB
  (0.94), sqlate 2.24 MB (1.59), websdk 2.22 MB (1.58).
- The toolchain: the compiler 10.76 MB (6.90), the linker 3.33 MB (2.31). A program's closure of
  archives: calc 5.14 MB (3.81) in 58 files, stdlib 8.26 MB (6.12) in 85, graph 6.99 MB (5.19) in
  77, sqlate 20.38 MB (14.89) in 219.
- Pages serves gzip alone, even when br is accepted, with a max-age of 600 s. After it expires, a
  building page's worker revalidates the manifest, some 100 to 200 B a build, and every module
  and archive comes from the HTTP cache.
- No page requests a `.wasm` before Run; desktop pages are readable (first-contentful-paint) in
  192 to 364 ms cold, medians.
- Desktop, first result after Run's click, median ms, cold / cached / in place: the components
  page 151 / 52 / 68 (a scenario switch); sqlate-compile 199 / 84 / 15; go-web-sdk-handlers
  197 / 67 / 17; calc 1,893 / 1,461 / 433 (main.go edited and rebuilt); stdlib 2,565 / 2,029 /
  733; graph 2,137 / 1,688 / 573; the sqlate page 3,338 / 2,592 / 1,158. A rerun with no rebuild
  is 15 to 17 ms.
- iPhone 16 Pro Max, one reading each, total ms: the sqlate page 3,301 cold in an Incognito tab;
  the graph page's first run 1,429; the components page's first run 183; calc's first run 1,357;
  a rerun 5 to 21. Cached reloads weren't taken.
- Deployed weight, measured live on 2026-11-17 from the live manifest: 371 standard-library
  archives, 144.3 MB raw and 34.4 MB gzip; 35 module archives, 31.0 MB raw; with the compiler and
  the linker, 52.6 and 12.3 MB raw by "Sizes", about 240 MB raw for the toolchain and its
  archives; the four prebuilt modules add 22.7 MB. Pages' published-site limit is 1 GB. Every
  archive deploys, though a program fetches only its closure.
- Pages' soft bandwidth limit, 100 GB a month, divided by one cold run's transfer: calc
  19.3 MB, about 5,190; graph 21.1 MB, about 4,730; stdlib 22.4 MB, about 4,470; the sqlate
  page's source build 34.6 MB, about 2,890; prebuilt, sqlate-compile 2.24 MB, about 44,700,
  go-web-sdk-handlers 2.22 MB, about 45,100, and the components page 1.31 MB, about 76,500. A
  cached run transfers about 100 to 200 B.

**The playground** is proven: arbitrary Go against the standard library and the site's pinned
modules, compiled, linked, and run in the page. It is recommended to no site.

**Two corrections to the framing** (`html-artifacts.md`, "Experiment: spike-html-go-wasm"), which
stays as posed:

- The sqlate prebuilt module serves at 2.24 MB gzip, not 1.2 MB. The framing's minimal build
  (0.74 MB gzip) and the playground's 19 MB on demand (calc's 19.3 MB cold) hold.
- "A service can't run there" holds only for sockets. Go's js port fakes the network in-process,
  so go-web-sdk's Service.Run binds and serves under node in the library's own wasm tests;
  that is unproven in a browser. The spike's demos call handlers through the Router instead.

**A candidate principle** for the web standard experiment.html's intake may found: a component
holds no authoritative state; a DOM-free model below it, written by one owner (the composing
element or the page), holds the state, its rules, and its validation. Evidence: this spike's
FileSet and EditorSettings, written by sl-go-demo, and its Arrangement, a reader's stored
preference the page owns and gives to every fixed demo.

For the intake:

- Warm the worker on intent, the architect's lead optimization: calc's first Run totals
  1,848 ms cold and 1,426 cached against 412 in place, mostly the compiler's own warm-up inside
  Go compile (854 / 875 / 198) and Link (331 / 334 / 185). The worker could fetch, compile, and
  run a throwaway build before the click; a page-load preload spends 19 to 35 MB a view against
  the 100 GB month, so preload on intent (editor focus, pointer over Run) and never under a
  data-saver signal.
- Chrome's lazy compilation of the compiler: its cold WebAssembly.compile of the 52 MB module
  reads about 74 to 123 ms locally and 33 to 38 ms live, so its real cost may sit inside Go
  compile.
- Build drift: the live module differs from a local build only in Go's `vcs.revision`,
  `vcs.time`, and `vcs.modified` stamps; `-buildvcs=false` would remove it.
- The sqlate page's 36 s cold Run on the iPhone (2026-11-12) didn't reproduce (3.3 s on
  2026-11-13); its cause is unknown.
- A `timings.test.ts` stall seen once under the parallel browser tier's load; the per-test bound
  now fails it by name.
- spike-html-design v0.7.0's bare `::backdrop` still veils every top-layer backdrop, a popover's
  included; spike-html-apps-foundation v0.3.1 fixes it there.
- spike-html-hosting-sdk gaps:
  - no nav for a site's own pages; the spike's Site nav stands in;
  - a Markdown fence can't name its file; sl-go-demo's `file` attribute stands in;
  - the crawl counts a page missing from `content.json` as a hand page, so a site's own Markdown
    tree needs a scratch-root crawl; the SDK could take a site's own Markdown trees;
  - markdownPages has no hook for marked extensions;
  - its drawer-focus check helpers are private, so `test/browser/site-nav.test.ts` copies them;
  - `web/pages/site-nav.ts` and `web/pages/markdown.ts` repeat the template's drawer wiring;
  - no page mode for tools; holdsReadingWidth assumes a reading page.
- `sl-drawer` has no modal-only mode; the Site drawer's unreachable dock stands in.
- A page-layout sheet (gutter, section spacing, content and full named lines) in the SDK or the
  foundation, so no page sets its own section spacing.
- The foundation has no token for `outline-offset`.
- `@custom-media` isn't shipped, so complementary container queries repeat their breakpoint.
- A browser-test helper that runs a suite in a pinned font set, in the architecture or the SDK.
- Go's `wasm_exec.js` exit race, a pending timeout resuming an exited program, is upstream Go's;
  the worker guards it.
- Shiki's http grammar statically imports the JavaScript, TypeScript, and Java grammars, which
  matters if the SDK's client-side fences highlight http.
- A browser running a wasm build is another runtime layer; this answer bears on the
  `elemental-runtime-layers` backlog goal.
- Deploy the toolchain once and share it across one owner's project sites, which share an origin
  and so its HTTP cache; unproven.
- Ship only the closures of a site's demos, not every standard-library archive.
- SDK v0.6.3 draws no focus outline on a shortcut dialog's script-focused heading, which isn't a
  control; spike-html-hosting-sqlate's STANDARDS.md says "Focus is always visible", so its next
  review may raise it.
- sl-code-editor's paste: pasting into an empty file stores an extra trailing newline, and
  pasting a whole file that ends in a newline over the content doubles it; likely an editor bug.
- The SDK's Release workflow tags a release itself, on a release commit above the merge, so a
  tag pushed by hand is rejected as existing; marathon's release steps assume a hand-pushed tag.
- For the goal that next locks sqlate, today v1.ai.processing's `providers` task:
  - `sqltest.Open` requires a `testing.TB`; a constructor that takes none would serve a demo;
  - sqlate's own currency trails its latest pins: pgx 5.12.0, golangci-lint 2.15.0, and go
    1.27.4.
