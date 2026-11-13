<!-- Adapted from spike-html-hosting-sdk (v0.6.2): template/README.md, its site a hand index with
     no copied tree and the spike's own Markdown tree. -->

# spike-html-go-wasm

The GitHub Pages site of spike-html-go-wasm, made from the template of
[spike-html-hosting-sdk](https://github.com/JaimeStill/spike-html-hosting-sdk) v0.6.2. Its index,
`index.html`, is a hand page served under `/spike-html-go-wasm/`, beside three more hand pages:
`components.html`, the components page, which shows each component in `web/components/` in each
of its states, its Go demos running Go through the runtime in `web/runtime/`; `playground.html`,
the playground, where the reader edits Go and builds and runs it in the page (see "Playground");
and `sqlate.html`, the sqlate page, where the reader composes SQL statements with sqlate and runs
them, built in the page (see "sqlate"). Three more pages are rendered from Markdown, from the
spike's own `markdown/` directory: `sqlate-compile.html`, whose demo calls sqlate's prebuilt
compile handler (see "The Markdown compile page"); `go-core-graph.html`, whose demo builds a
service wired on go-core's graph in the page (see "go-core graph"); and
`go-web-sdk-handlers.html`, whose demo sends HTTP/1.1 requests to go-web-sdk's handlers, called
in-process (see "go-web-sdk"). The site copies no Markdown tree: `content.json` records none, and
`content/` holds nothing. The spike's question, evidence, and path are in `context/README.md`.

## Tasks

- `mise run install`: install the pinned tools, the browser tier's chrome-headless-shell and
  DejaVu fonts among them, node_modules, and go.mod's requirements; reads the network.
- `mise run check`: run every check, reading no network. It lints with ESLint (the web tiers'
  import direction, and the check that the build left no CSS module script), Prettier,
  shellcheck, and actionlint. It lints the Go module under `GOOS=js GOARCH=wasm` and fails unless
  `web/runtime/wasm_exec.js` matches the pinned Go's copy and no `.wasm` or `.a` archive is
  tracked. It runs the Go tests as wasm under node twice: on node's fs, and on the runtime's
  in-memory fs, where `test/memfs` drives it through package `os`. Among them, `playground/calc`'s
  tests run the playground's starter over its shipped `input.txt` and over a script with failing
  lines, and hold its output and its exit code. Each of the four programs' tests holds its exact
  output and exit 0; `playground/concurrency`'s hold it over six runs and hold `GOMAXPROCS` at 1,
  and `playground/stdlib`'s hold the one stderr line and exit 1 of a malformed and of a missing
  `input.json`. `playground/sqlate`'s hold its statements compiled from its shipped `.sql` files,
  a namespace of the reader's included, each catalog or compile error's one stderr line with exit
  1, and each outcome of its guarded run; `internal/sqlate`'s hold the compile handler's answers,
  lines, and refusals. `playground/graph`'s hold its layer table and lifecycle trace with exit 0, a
  failing constructor's one stderr line with exit 1, and a cycle's panic with exit 2;
  `internal/websdk`'s hold each route's status, headers, and body, each rejection with the next
  call served, and writes chained on one instance. It type-checks the configs, the web tiers, and
  the suite with tsc and runs `mise run build`.
  - The unit tier checks `content/` against `content.json`, both layer directions, go.mod's
    by-tag rule, the currency and live commands' logic, and the in-memory fs's error codes. It
    checks the playground's toolchain: each file its manifest names exists under its content's
    hash, and the manifest's import closure equals Go's own `go list -deps`, for
    `playground/sqlate` and `playground/graph` through the site's pinned modules, whose packages
    are exactly those the repository's own packages depend on, go-core's `graph` and `lifecycle`
    and go-web-sdk's root and `middleware` among them. It holds the go-web-sdk scenario's imports
    to the standard library, the bridge, and go-web-sdk's and go-core's packages. It runs Go's
    compiler and linker over that toolchain on the in-memory fs: hello built and run, a compile
    error and a package clause other than main reported as the compiler writes them, an import the
    manifest lacks refused before the compiler runs, and a non-Go file read from the run's working
    directory. It tests the components' six
    models (`Arrangement`, `EditorSettings`, `FileSet`, `ConsoleLog`, `RunTimings`, and `RunState`):
    their operations, refusals, and change events. It holds each program demo's go fence on the
    components page to its scenario's source, byte for byte, the playground's demo to the starter's
    files in `playground/calc/`, its four `.go` files and its `input.txt`, each program template's
    fences to its files in `playground/<program>/`, the sqlate page's fences to
    `playground/sqlate/`'s files, the graph page's one source demo to `playground/graph/main.go`,
    and the go-web-sdk page's demo to one handler demo, websdk's `request`, its file
    `request.http`, around one fence naming no language. It holds the sqlate scenario's embedded
    patterns to the program's pattern files, byte for byte (`test/unit/sqlate-patterns.test.ts`),
    and tests a Go demo's fence naming rules (`web/components/file-names.ts`). It fails if a module
    under `web/components` or `web/pages` registers a page shortcut through the foundation's
    `keys.js`.
  - The browser tier, in the pinned chrome-headless-shell, each test bounded at 5 minutes so a
    stalled one fails by its name, runs the SDK's shell checks on every hand page and on each
    rendered Markdown page, the crawl, and the SDK's palette check on each rendered page's fences,
    reads each page's cascade layers (the foundation's, then `site`, then `page`) and finds no
    inline `<style>` in its source, and proves each component on the components page:
    - the code editor: its colors against the SDK's fences in every palette and scheme, its
      accessibility tree, its gutter, its loading, its editing keys and events, its settings,
      paste, and read-only;
    - the file tabs: their accessibility tree, keyboard, control by the page's file set, modified
      marker, sideways overflow with no row overflowing up or down, and subscription;
    - the console: its quiet log in the accessibility tree, stderr's cue and its contrast in every
      palette and scheme, entries in arrival order, exits and results, the 10,000-entry limit and
      the dropped count, tail following, Copy and Clear, throughput, focus, motion, and
      subscription;
    - the timings: their table in the accessibility tree, only the run's phases in order with
      their total, the times' format and alignment, the empty state, a new run replacing the
      last, and subscription;
    - the controls: their toolbar in the accessibility tree, keyboard, availability following the
      models, requests that change nothing, the New file and Rename forms' validation and focus
      return, each form inside the viewport at 280px, a phone's width, and wide, the status's
      transitions, target sizes, the glyphs alone and the groups whole at a
      phone's width in a wide font, the names' hints, motion, and subscription;
    - the Go demo, running real Go over the page's one runner: no Go before a Run, a handler's run
      and a program's, Ctrl or Cmd+Enter from inside a demo alone, Alt or Shift with Enter running
      nothing, Help listing no Run, the authoring error, Stop, two demos sharing the runner,
      editable files and focus after a delete, Reset, its accessibility tree, its fences with and
      without script, and every part inside the demo at wide widths, either side of the
      side-by-side threshold, and at a phone's width;
    - the runtime, through the Go demos: hello and the probe's handlers in one worker, a held
      module reused and scenarios switched in place with no fetch, Stop ending the probe's spin
      with the next call fetching nothing new and one worker live, a Run while another run or a
      load is pending stopping it first, and the probe's crash, a panic outside any handler,
      printing to stderr and exiting 2;
    - building in the page, through the components page's source demo: a cold build fetching the
      manifest, the compiler, the linker, and only its import closure's archives, then running
      main, which reads `input.txt` from its working directory, with every phase of a build; the
      same files again building nothing; an edit fetching only the archives its new imports add;
      a compile error as the compiler writes it, with its exit, running nothing; an import the
      manifest lacks refused before the compiler runs; and Stop, while idle, during a built
      program's busy loop, and during a build, the next build fetching and compiling no toolchain
      module; a build started while spin is pending stopping spin first, each console holding only
      its own output; a program's Run, or the runner's load or run, while a build is pending
      stopping the build, which rejects as stopped, the source demo's console holding none of the
      other request's events; a built program exiting with a goroutine's timer still pending,
      each of two runs answering its exit code; and Ctrl+Enter and Cmd+Enter building and running
      the edited program, and Reset restoring the source as given;
    - the playground: the starter's five files, `main.go` active, and no Go before a Run; the
      first Run fetching the manifest, the compiler, the linker, and only the starter's closure of
      archives, and printing its results with exit 0 and every phase of a build; an edit to
      `input.txt` alone building nothing, the Run fetching nothing and printing the new input's
      results, a failing line's `input.txt:<n>: <reason>` on stderr with exit 1; a Run after an
      edit to `main.go` fetching no toolchain module and no archive held, a new standard import
      only the archives its closure adds, and the edited program's output; a compile error; Stop
      ending a busy loop, the next build fetching no toolchain module; and a file the reader adds
      read through `os.ReadFile` from the working directory, nothing a run writes outliving it;
    - the playground's programs: the Program select beside the heading, a combobox named Program
      offering the five programs, Calculator chosen; each program shown in the one demo in place,
      `main.go` active, with no reload and no request, and its Run printing its exact output with
      exit 0; an edit to stdlib's `input.json` alone rerunning it with no Go compile or link, and
      a malformed one's stderr line with exit 1; edits and the active file surviving a switch,
      Reset restoring the program on screen alone, a switch stopping a pending run and clearing
      the console and the timings; switching back to a program built earlier compiling and
      linking it again, fetching no archive the worker holds; and the fragment: the page opening
      on the program it names, and on the calculator with none or an unknown one, a choice
      writing it as a new history entry, and Back, Forward, and an edited fragment showing the
      program it names, with its edits, the select following;
    - the programs' report, never a gate (`test/browser/playground-report.test.ts`, which
      `mise run report:programs` runs alone), the sqlate page's program among them;
    - the sqlate page: its source demo on `playground/sqlate`'s files, `main.go` active, and no Go
      before a Run; the first Run fetching the manifest, the compiler, the linker, and only the
      program's closure of archives, the site's pinned modules' among them, and printing every
      statement and the guarded edit exactly, with exit 0; an edit to a `.sql` file or to
      `input.json` alone rerunning it with no Go compile or link, each of the run's outcomes, a
      statement with no tier printing sqlate's one stderr line with exit 1, and a pattern file in
      a new namespace, added by New file, included by a new statement; each `.sql` file shown in
      SQL's grammar;
    - the Markdown compile page (`test/browser/sqlate-compile.test.ts`): its one handler demo named
      `statement.sql` by its `file` attribute, in SQL's grammar, and no Go before a Run; the first
      Run fetching the worker and `go/sqlate.wasm` alone and answering the statement's `$n` SQL
      with its tier and parameters' line; an edit recompiling on the instance held, fetching
      nothing; and a statement sqlate refuses answering sqlate's message, the instance outliving
      it; then a report, never a gate, of `go/sqlate.wasm`'s bytes, raw and gzip, and the cold
      Run's phase timings;
    - the graph page (`test/browser/go-core-graph.test.ts`): no Go before a Run; the first Run
      fetching the manifest, the compiler, the linker, and only the program's closure of archives,
      and printing its layer table and lifecycle trace exactly, with exit 0; an edit rebuilding and
      running the edit; a failing constructor's one stderr line with exit 1; and a cycle's panic
      with exit 2;
    - the go-web-sdk page (`test/browser/go-web-sdk-handlers.test.ts`): its one handler demo named
      `request.http` by its `file` attribute, plain in the page's markup and in the editor, and no
      Go before a Run; the first Run fetching the worker and `go/websdk.wasm` alone and answering
      the seeded list; a POST, then a GET of the new id, on the instance held, fetching nothing;
      an update, then the same update again answering 412; and text that isn't an HTTP/1.1
      request rejected naming why, the instance outliving it with every write kept; then a report,
      never a gate, of `go/websdk.wasm`'s bytes, raw and gzip, and the cold Run's phase timings;
    - the playground's prose and About: the prose is the heading and the lede alone, and the page
      holds no disclosure; About leads the header's group, a glyph button showing A; A, a click, or
      Enter opens the About dialog on its title, Tab reaches its Close, and Close or Escape closes
      it, focus back where it was; A typed into the editor types; the accessibility tree names the
      button and the dialog; and the dialog's text is the approved text, in order, its last
      sentence on each program's edits;
    - the playground's one screen, at 390px, 1120px, and 1376px, each at its capture height and
      at 900px, at 1120x800, and at 900x700: the demo takes every row left and ends a gutter above
      the viewport's bottom edge, the one gutter that holds the page off both sides, every part's
      bottom border inside the demo and in view, in each arrangement from 64rem; the page doesn't
      scroll, and no script sizes the demo; at each capture size the demo stands above its floor,
      where the editor's frame holds six of its lines and the console's log two, and the test
      reports by how much; on a short screen, 390x600 or 1376x400, or at twice the text size at
      390x844 and 1120x700, the demo holds its floor, one part exactly at it, and the page scrolls
      down, the demo a gutter above its end, but never sideways;
    - the playground's fixed layout, at 390px, 1120px, and 1376px, and with the demo half a rem
      either side of 44rem and 64rem: each width lays out its band, and from 64rem each
      arrangement places the parts as it says; a paste of 500 lines, 10,000 printed lines, and a
      full timings table change no part's box; the page never scrolls sideways and every part
      stays inside the demo; a Run, a Stop, a failed build, a band change, and an arrangement
      change keep the editor's and the console's content and scroll position and the chosen
      output tab; the phone's output tablist has the expected accessibility tree and keys, and
      no tablist or tabpanel shows from 44rem; a demo without `fixed` keeps its flowing layout;
      the timings' track is `sl-timings`' least width, 28ch of its table, and the steady status
      asks for 24ch of its own text, sharing the toolbar's line at 50rem and taking its own at a
      phone's width, each one property that moves every reader when set on its element;
    - the playground's one screen, fixed layout, and reservations again in a pinned DejaVu font
      set, the six faces of Ubuntu's `fonts-dejavu-core`, from `http:dejavu-fonts`:
      `test/browser/playground-layout-dejavu.test.ts` runs the suite that
      `playground-layout.test.ts` runs in the machine's fonts, under a test-only fontconfig
      (`test/browser/fonts.ts`, written under TMPDIR) that shows the browser those six faces
      alone, and first proves the page draws in DejaVu Sans and DejaVu Sans Mono alone, so a
      layout that holds in one font set and not the other fails on any machine;
    - the playground's Layout menu: Layout is a menu button in its own group from 64rem and
      absent below; the menu opens `--space-3xs` below Layout, at its inline start, as wide as its
      items and inside the viewport, and has the expected accessibility tree and the APG keys;
      choosing an arrangement applies it in place, with no reload or request, leaving the run's
      status, output, and timings as they were; the choice is the only write to storage, under
      the spike's key, and a reload and another page open in it; the page follows another tab's
      choice and a cleared store; an empty store, text that isn't JSON, a refused value, and
      blocked storage each open with the editor left and write nothing.
- `mise run build`: build the site with Vite into `dist/`, the hand pages and the Markdown pages
  the SDK's `markdownPages` renders from `markdown/`, the runtime's worker with
  `web/runtime/wasm_exec.js` bundled in it and the editor's syntax themes merged per palette
  (`scripts/syntax-themes.ts`), then the Go entrypoints, `cmd/hello`, `cmd/probe`, `cmd/sqlate`,
  and `cmd/websdk`, into `dist/go/`, and the playground's toolchain into `dist/go/toolchain/`
  (`scripts/build-toolchain.ts`): Go's compiler and linker built for `GOOS=js`, an archive for
  each standard-library package, under `std/`, and for each package of the site's pinned modules
  the repository's own packages depend on, sqlate's, go-core's, and go-web-sdk's and their
  dependencies', under `mod/`, and
  `manifest.json`, the one file that names them, each by its content's hash. A bare `vite build`
  omits the wasm.
- `mise run screenshots`: capture the pages, light and dark. The index and each component on the
  components page, alone, are captured at the SDK's widths, 390px, 1120px, and 1376px; a
  component's capture is `--page components/<component>`, as `--page components/console`. The
  playground, `--page playground`, is captured as its viewport alone, the page's one screen, in
  each band of its fixed demo: 390px with the output panel's Output tab and again with its
  Timings tab; 900px, between 44rem and 64rem; 1120px and 1376px in editor left, top, and right,
  each chosen through the Layout menu, and with the menu open; 1376px with the About dialog
  open; and 390px, 1120px, and 1376px with each of Basics, Generics, Concurrency, and Standard
  library chosen in the Program select. The sqlate page, `--page sqlate`, is captured as its
  viewport alone at the SDK's widths, and each Markdown page, `--page sqlate-compile`,
  `--page go-core-graph`, and `--page go-web-sdk-handlers`, whole at each.
  `--width <px>`, one of the SDK's three, captures that width alone on every page, as
  `mise run screenshots --page components/controls --width 390`; the playground's 900px capture
  is taken only when no width is given. Any other width is a usage error naming the three.
  `scripts/screenshots.ts` takes `--width`, which the capture bin doesn't know, and hands it to the
  capture file.
- `mise run report:programs`: report, never as a gate, what each of the playground's programs
  costs, the sqlate page's program, and the graph page's. For each, in a browser of its own, so
  its worker is fresh and its cache empty, opened by its fragment, it prints the phase timings of
  the first Run, cold, and of a Run after an edit to `main.go`, warm, as the demo's timings show
  them, and its closure: the count of archives the cold Run fetched, the standard library's and,
  for sqlate and graph, the pinned modules', their bytes as `dist/` holds them and Vite's preview
  serves them, and their bytes gzipped by node's zlib at its default level, since the preview
  doesn't gzip.
  The timings table has a column only for a phase some Run recorded, so it has no Start column: a
  source build records no Start phase. The tables are the test's diagnostics, written nowhere
  else; only a Run that doesn't finish fails it. The browser tier runs the same file among its
  others, so its timings there are a busier machine's.
- `mise run currency`: report every pin behind its latest, the SDK's tag and go.mod's direct
  requirements among them.
- `mise run live [base URL]`: check that the deployed site, at its Pages URL or the base given,
  serves the index as HTML, `go/hello.wasm` as `application/wasm`, gzip-encoded, the playground's
  `go/toolchain/manifest.json`, and the compiler it names as `application/wasm`, gzip-encoded. It
  reads the network and isn't part of the check; the unit tier holds its assertions against local
  servers.
- `mise run measure [base URL]`: print evidence of the deployed site, at its Pages URL or the base
  given, judging no number. Its head names the deployed commit, the `vcs.revision` Go stamped into
  the live `go/hello.wasm`, and for the Pages URL the latest successful github-pages deployment
  `gh` reports, with whether they agree, and the date. Its size table has one row per prebuilt
  module, `hello`, `probe`, `sqlate`, and `websdk`, per toolchain module, the compiler and the
  linker the live manifest names, and per program the site builds in the page, its closure: the
  archives the runtime's `programClosure` resolves for `playground/<program>/`'s files, tests left
  out, against the live manifest. Each row gives the raw bytes, the bytes on the wire for a
  browser's `Accept-Encoding: gzip, deflate, br` (Pages serves gzip alone), and the bytes at
  brotli 11 by node's zlib; a closure's row gives its file count, the requests a revalidation
  makes once the 10-minute max-age expires. Its drift report builds each prebuilt module twice into
  TMPDIR with `scripts/build-go-modules.sh`, the site build's flags, each build with a `GOCACHE` of
  its own, and holds the two against each other and the live module against the first, byte for
  byte, giving each difference's byte counts and the build settings Go stamped differently, as
  `vcs.revision` and `vcs.modified`. Its desktop timings, `scripts/measure-timings.ts`, give one
  table per demo page, the components page, the Markdown pages, the sqlate page, and the
  playground once per program, read in the pinned chrome-headless-shell with the network allowed:
  cold, in a fresh profile; cached, a fresh page and worker within the max-age; and in place, a
  further Run on the held worker. Each row gives the page's first-contentful-paint, whether any
  `.wasm` was requested before Run, Run's click to the first output, the run's phases as the
  demo's timings show them, and the bytes transferred during the run, each the median and max of
  five readings. `--readings N`, `--pages a,b`, and `--skip-sizes` narrow a development run. It
  reads the network and `gh`, writes nothing outside TMPDIR and Go's caches, and isn't part of the check; the unit
  tier holds its report layer, `scripts/measure-report.ts`, on fixtures.

## Measurements

Measured on 2026-11-13 against the deployed site, commit 13d8348, which `mise run measure` read
from the live `go/hello.wasm`'s `vcs.revision` and which gh's latest github-pages deployment
agrees with. The sizes, the drift, and the desktop timings below are its output, the tables cut to
fit; the iPhone readings were taken by hand. To reproduce, run `mise run measure` (see "Tasks");
the command prints what it reads and never fails on a number, so these are evidence, not gates.

- **Desktop:** this Linux machine, an Intel Core Ultra 9 185H, in the pinned chrome-headless-shell
  157.0.8103.78 at 1280×720, over wired Ethernet on home broadband.
- **iPhone:** an iPhone 16 Pro Max, in Chrome for iOS (WebKit, as every iOS browser must be), over
  Wi-Fi.

### Sizes

Each row's raw bytes, its bytes as Pages served them for `Accept-Encoding: gzip, deflate, br`, and
its bytes at brotli 11 by node's zlib. Pages serves gzip alone, even when br is accepted, with a
max-age of 600 s. A closure's Files is its archive count, the requests a revalidation makes once
the max-age expires.

| Name | Files | Raw | Served (gzip) | Brotli 11 |
| --- | ---: | ---: | ---: | ---: |
| hello.wasm | 1 | 2,473,987 | 737,953 | 546,453 |
| probe.wasm | 1 | 4,611,666 | 1,306,343 | 935,804 |
| sqlate.wasm | 1 | 7,805,306 | 2,236,249 | 1,591,807 |
| websdk.wasm | 1 | 7,772,444 | 2,216,568 | 1,582,333 |
| compile (toolchain) | 1 | 52,647,487 | 10,756,470 | 6,904,791 |
| link (toolchain) | 1 | 12,291,570 | 3,331,171 | 2,313,778 |
| calc closure | 58 | 22,644,840 | 5,142,991 | 3,809,962 |
| basics closure | 57 | 22,208,134 | 5,025,935 | 3,720,168 |
| generics closure | 58 | 22,644,840 | 5,142,991 | 3,809,962 |
| concurrency closure | 57 | 22,208,134 | 5,025,935 | 3,720,168 |
| stdlib closure | 85 | 36,402,466 | 8,258,489 | 6,120,924 |
| sqlate closure | 219 | 96,118,342 | 20,375,470 | 14,892,704 |
| graph closure | 77 | 30,468,458 | 6,988,025 | 5,185,798 |

### Reproducibility

Each prebuilt module, hello, probe, sqlate, and websdk, built twice locally with a `GOCACHE` of
its own, matched byte for byte. Against the live module, each local build differed only in the
build settings Go stamped from version control: `vcs.modified` is true when the tree is dirty, and
the local tree was dirty, the live build's clean.

| Module | Local vs local | Local bytes | Live bytes | Live − local | Differing build settings |
| --- | --- | ---: | ---: | ---: | --- |
| hello.wasm | match | 2,473,992 | 2,473,987 | −5 | `vcs.revision`, `vcs.time`, `vcs.modified` (local true, live false) |
| probe.wasm | match | 4,611,671 | 4,611,666 | −5 | `vcs.revision`, `vcs.time`, `vcs.modified` (local true, live false) |
| sqlate.wasm | match | 7,805,311 | 7,805,306 | −5 | `vcs.revision`, `vcs.time`, `vcs.modified` (local true, live false) |
| websdk.wasm | match | 7,772,452 | 7,772,444 | −8 | `vcs.revision`, `vcs.time`, `vcs.modified` (local true, live false) |

This is reported, not fixed; dropping the stamp, with `-buildvcs=false` or otherwise, is
final-review's.

### Desktop timings

Each cell is the median / max of 5 readings, in ms; Run bytes in bytes. Cold is a fresh browser
profile, its HTTP cache empty; cached is then a fresh page and worker in that browser within the
max-age; in place is a further Run on the cold page's worker. Readable is the page's
first-contentful-paint; .wasm before Run is whether any `.wasm` was requested before Run's click,
and on every page none was; First result is Run's click to the console's first output; the phases
are the demo's timings, and Total is their sum. Run bytes are what the page and its workers
transferred from Run's click to the run's end, 0 when the HTTP cache answered all; a building
page's cached runs and main.go rebuilds transfer some 100 to 200 B, as its worker revalidates
the toolchain manifest on every build (`cache: "no-cache"`, `web/runtime/worker.ts`), while every
module and archive comes from the HTTP cache. A program switch whose closure adds archives also
fetches those. The building
pages' tables leave out Instantiate, at most 1.5 ms in median, though their Total counts it; "—"
marks a cell the state has no reading for.

#### Components page, components.html

| State | Readable | .wasm before Run | First result | Fetch | Wasm compile | Instantiate | Start | Call | Run | Total | Run bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| cold | 364 / 388 | no | 151 / 299 | 95 / 249 | 4.2 / 4.9 | 0.7 / 1.1 | 8.6 / 9.0 | 3.8 / 4.0 | — | 112 / 266 | 1,307,583 / 1,307,591 |
| cached | 232 / 232 | no | 52 / 66 | 15 / 19 | 4.2 / 4.6 | 0.7 / 1.0 | 8.6 / 9.6 | 4.1 / 4.4 | — | 33 / 37 | 0 / 0 |
| in place: scenario switch, probe to hello | — | — | 68 / 84 | 46 / 62 | 3.1 / 3.3 | 0.6 / 0.7 | — | — | 7.9 / 8.4 | 58 / 73 | 738,541 / 738,555 |

#### sqlate compile (Markdown), sqlate-compile.html

| State | Readable | .wasm before Run | First result | Fetch | Wasm compile | Instantiate | Start | Call | Total | Run bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| cold | 192 / 228 | no | 199 / 217 | 123 / 149 | 6.1 / 6.4 | 1.1 / 1.2 | 28 / 30 | 7.6 / 10 | 169 / 189 | 2,237,969 / 2,238,009 |
| cached | 44 / 44 | no | 84 / 85 | 23 / 24 | 5.7 / 6.2 | 1.1 / 1.3 | 28 / 37 | 7.5 / 8.4 | 65 / 74 | 0 / 0 |
| in place: rerun | — | — | 15 / 17 | — | — | — | — | 0.5 / 0.8 | 0.5 / 0.8 | 0 / 0 |

#### go-web-sdk handlers (Markdown), go-web-sdk-handlers.html

| State | Readable | .wasm before Run | First result | Fetch | Wasm compile | Instantiate | Start | Call | Total | Run bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| cold | 200 / 276 | no | 197 / 396 | 124 / 333 | 5.6 / 6.2 | 1.1 / 1.2 | 17 / 17 | 8.1 / 8.6 | 156 / 365 | 2,218,188 / 2,297,378 |
| cached | 44 / 48 | no | 67 / 67 | 23 / 25 | 6.1 / 6.4 | 1.1 / 1.2 | 17 / 19 | 8.2 / 8.3 | 56 / 57 | 0 / 0 |
| in place: rerun | — | — | 17 / 17 | — | — | — | — | 0.6 / 0.9 | 0.6 / 0.9 | 0 / 0 |

#### go-core graph (Markdown), go-core-graph.html

| State | Readable | .wasm before Run | First result | Fetch | Wasm compile | Go compile | Link | Run | Total | Run bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| cold | 208 / 280 | no | 2,137 / 2,217 | 666 / 735 | 35 / 36 | 1,047 / 1,064 | 328 / 336 | 17 / 18 | 2,094 / 2,171 | 21,122,491 / 21,122,755 |
| cached | 64 / 68 | no | 1,688 / 1,769 | 194 / 199 | 35 / 38 | 1,068 / 1,127 | 331 / 364 | 20 / 20 | 1,646 / 1,740 | 114 / 157 |
| in place: rerun | — | — | 17 / 18 | — | — | — | — | 2.0 / 2.5 | 2.6 / 3.5 | 0 / 0 |
| in place: main.go edited, rebuilt | — | — | 573 / 577 | 21 / 32 | 4.1 / 5.0 | 311 / 328 | 193 / 209 | 1.7 / 1.7 | 545 / 548 | 143 / 153 |

#### sqlate page, sqlate.html

| State | Readable | .wasm before Run | First result | Fetch | Wasm compile | Go compile | Link | Run | Total | Run bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| cold | 204 / 300 | no | 3,338 / 3,683 | 1,097 / 1,333 | 37 / 37 | 1,518 / 1,549 | 584 / 653 | 48 / 53 | 3,284 / 3,623 | 34,551,098 / 34,551,523 |
| cached | 52 / 56 | no | 2,592 / 2,689 | 342 / 349 | 38 / 40 | 1,549 / 1,601 | 579 / 601 | 46 / 50 | 2,553 / 2,636 | 105 / 115 |
| in place: rerun | — | — | 17 / 19 | — | — | — | — | 6.6 / 7.3 | 8.1 / 9.1 | 0 / 0 |
| in place: main.go edited, rebuilt | — | — | 1,158 / 1,174 | 22 / 34 | 8.1 / 9.2 | 629 / 656 | 421 / 462 | 4.7 / 8.1 | 1,112 / 1,127 | 144 / 204 |

#### Playground, calc, playground.html#calc

| State | Readable | .wasm before Run | First result | Fetch | Wasm compile | Go compile | Link | Run | Total | Run bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| cold | 200 / 200 | no | 1,893 / 1,932 | 616 / 621 | 33 / 33 | 854 / 872 | 331 / 335 | 15 / 17 | 1,848 / 1,868 | 19,272,122 / 19,272,276 |
| cached | 48 / 52 | no | 1,461 / 1,475 | 166 / 177 | 33 / 34 | 875 / 894 | 334 / 350 | 13 / 14 | 1,426 / 1,437 | 101 / 166 |
| in place: main.go edited, rebuilt | — | — | 433 / 447 | 21 / 27 | 3.7 / 4.6 | 198 / 202 | 185 / 191 | 1.9 / 2.1 | 412 / 419 | 143 / 151 |
| in place: program switch to basics | — | — | 329 / 362 | 21 / 29 | 3.6 / 4.2 | 123 / 144 | 156 / 161 | 11 / 12 | 317 / 348 | 90 / 143 |

#### Playground, basics, playground.html#basics

| State | Readable | .wasm before Run | First result | Fetch | Wasm compile | Go compile | Link | Run | Total | Run bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| cold | 208 / 224 | no | 1,758 / 1,791 | 608 / 621 | 33 / 35 | 711 / 765 | 330 / 352 | 14 / 19 | 1,704 / 1,745 | 19,154,814 / 19,154,854 |
| cached | 52 / 56 | no | 1,325 / 1,334 | 167 / 170 | 33 / 35 | 744 / 767 | 335 / 352 | 13 / 14 | 1,300 / 1,304 | 106 / 117 |
| in place: main.go edited, rebuilt | — | — | 378 / 393 | 21 / 24 | 3.3 / 3.9 | 158 / 166 | 166 / 181 | 1.7 / 2.4 | 351 / 366 | 143 / 152 |
| in place: program switch to generics | — | — | 623 / 636 | 44 / 46 | 3.0 / 3.6 | 382 / 389 | 153 / 160 | 13 / 16 | 595 / 610 | 117,531 / 117,556 |

#### Playground, generics, playground.html#generics

| State | Readable | .wasm before Run | First result | Fetch | Wasm compile | Go compile | Link | Run | Total | Run bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| cold | 204 / 212 | no | 2,094 / 2,131 | 624 / 650 | 33 / 34 | 1,073 / 1,088 | 305 / 334 | 15 / 19 | 2,048 / 2,078 | 19,272,120 / 19,272,352 |
| cached | 56 / 60 | no | 1,633 / 1,673 | 171 / 176 | 32 / 35 | 1,085 / 1,112 | 295 / 316 | 14 / 18 | 1,603 / 1,627 | 103 / 106 |
| in place: main.go edited, rebuilt | — | — | 534 / 579 | 21 / 22 | 3.2 / 3.5 | 318 / 345 | 166 / 173 | 2.0 / 3.4 | 512 / 547 | 151 / 203 |
| in place: program switch to concurrency | — | — | 402 / 412 | 21 / 33 | 3.9 / 4.8 | 179 / 191 | 157 / 165 | 23 / 24 | 391 / 398 | 104 / 166 |

#### Playground, concurrency, playground.html#concurrency

| State | Readable | .wasm before Run | First result | Fetch | Wasm compile | Go compile | Link | Run | Total | Run bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| cold | 204 / 208 | no | 1,937 / 2,131 | 620 / 827 | 33 / 33 | 878 / 914 | 330 / 346 | 25 / 28 | 1,901 / 2,097 | 19,154,936 / 19,154,993 |
| cached | 56 / 56 | no | 1,506 / 1,520 | 169 / 174 | 33 / 34 | 910 / 930 | 334 / 347 | 27 / 31 | 1,480 / 1,492 | 143 / 163 |
| in place: main.go edited, rebuilt | — | — | 421 / 470 | 20 / 22 | 3.8 / 4.5 | 198 / 234 | 177 / 185 | 13 / 13 | 408 / 458 | 143 / 151 |
| in place: program switch to stdlib | — | — | 930 / 945 | 138 / 154 | 6.4 / 7.2 | 439 / 444 | 290 / 313 | 31 / 32 | 911 / 920 | 3,240,890 / 3,241,467 |

#### Playground, stdlib, playground.html#stdlib

| State | Readable | .wasm before Run | First result | Fetch | Wasm compile | Go compile | Link | Run | Total | Run bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| cold | 204 / 220 | no | 2,565 / 2,776 | 739 / 978 | 36 / 38 | 1,212 / 1,230 | 474 / 497 | 36 / 41 | 2,520 / 2,735 | 22,396,436 / 22,396,555 |
| cached | 60 / 128 | no | 2,029 / 2,170 | 198 / 262 | 38 / 41 | 1,261 / 1,352 | 465 / 472 | 36 / 40 | 2,000 / 2,141 | 115 / 166 |
| in place: main.go edited, rebuilt | — | — | 733 / 894 | 22 / 23 | 7.7 / 13 | 372 / 412 | 293 / 377 | 7.1 / 15 | 702 / 838 | 143 / 195 |
| in place: program switch to calc | — | — | 388 / 721 | 21 / 27 | 3.3 / 6.2 | 168 / 342 | 163 / 298 | 12 / 25 | 361 / 699 | 114 / 158 |

### iPhone readings

On 2026-11-13, one reading each, read by hand from each demo's timings table, on the subset the
architect chose: the sqlate page, the go-core graph page, the components page, and the
playground's calc. Cached reloads were not taken, and whether any `.wasm` was requested before
Run was not recorded on the phone (on the desktop, none was on any page). "—" marks a phase not
captured or not in the run.

| Page and state | Fetch | Wasm compile | Go compile | Link | Instantiate | Start | Call | Run | Total |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| sqlate.html, cold in an Incognito tab | — | — | — | 479 | 7.0 | — | — | 28 | 3,301 |
| sqlate.html, first run in a regular tab | — | — | — | 480 | 6.0 | — | — | 21 | 3,329 |
| sqlate.html, in place: rerun | — | — | — | — | 9.0 | — | — | 12 | 21 |
| go-core-graph.html, first run | 265 | 111 | 672 | 370 | 2.0 | — | — | 9.0 | 1,429 |
| go-core-graph.html, in place: rerun | — | — | — | — | 2.0 | — | — | 5.0 | 7.0 |
| components.html, probe's format, first run | 155 | 16 | — | — | 2.0 | 8.0 | 2.0 | — | 183 |
| components.html, in place: rerun | — | — | — | — | — | — | 5.0 | — | 5.0 |
| playground.html#calc, first run | — | — | — | 344 | 1.0 | — | — | 9.0 | 1,357 |
| playground.html#calc, in place: rerun | — | — | — | — | 4.0 | — | — | 4.0 | 8.0 |

The sqlate page's Fetch, Wasm compile, and Go compile, and the calc program's phases before Link,
were not captured. The go-core graph's first run was in a regular tab with its cache state
unconfirmed; its Fetch suggests the HTTP cache answered. An earlier phone reading, taken during
the sqlate task, gave 36 s for the sqlate page's cold Run; it did not reproduce, today's cold run
in an Incognito tab taking 3.3 s, on par with the desktop. Its cause is unknown; final-review may
look.

## Runtime

The runtime, `web/runtime/`, runs Go in one dedicated worker per page. A page creates one
`Runner` (`runner.ts`) and passes it to every Go demo; its events and the messages to its worker
are `protocol.ts`'s.

- `load(scenario)`: fetch and compile `go/<scenario>.wasm`, a prebuilt entrypoint, and hold it.
- `build(files)`: build a program from its files, each `{ name, text }`, and hold it as the
  scenario `main`, so the next `run()` runs its main to its exit. In the worker, the build reads
  `go/toolchain/manifest.json`, revalidated on every build; resolves the imports of the `.go`
  files to their closure through it; fetches the compiler, the linker, and each archive of the
  closure the worker doesn't hold yet, under their content-hashed names; compiles every `.go` file
  as package main with Go's own compiler and links it with Go's own linker, each step its own
  phase, `go-compile` and `link`; and compiles the linked module. `.go` files identical to the
  last successful build's, the same names and texts in the same order, hold that program again,
  fetching, compiling, and linking nothing, whatever the non-Go files are: the runs that follow
  read this build's non-Go files, so editing `input.txt` alone builds nothing.
  - A failed step's output, the compiler's diagnostics (to stdout) or the linker's (to stderr),
    reaches the runner's listeners as written, positions relative to the file's name
    (`main.go:5:27: undefined: x`), then an exit event naming the step (`compile exited with code
    2`), and the build rejects naming it; an import the manifest doesn't hold rejects before the
    compiler runs (`package example.com/x is not in the manifest`). A failed build holds nothing.
  - The program's limits: one package main from every `.go` file, importing the standard library
    and the site's pinned modules, the packages the manifest holds, as `GOOS=js GOARCH=wasm` builds
    it; no `go.mod`, local subpackages, cgo, assembly, or `go:embed`; no argv and no stdin. Its
    files are one flat directory.
  - The working directory: each run of a built program gets a fresh in-memory fs whose working
    directory, `/work`, holds every file of the build that isn't Go, so `os.ReadFile("input.txt")`
    reads that file's text. Nothing a run writes outlives the run.
- `run(handler?, input?)`: run the held program's main, or call one of its handlers.
- `stop()`: terminate the worker and start a fresh one that adopts the held program and the
  compiled compiler and linker, so the next run needs no load or build and the next build
  compiles no toolchain module. The archives aren't kept across a Stop, being large (`fmt`'s
  closure is 22 MB): the next build fetches them again, over the HTTP cache.
- `listen(listener)`: every output, exit, and timing event. The runner runs one load, build, or
  run at a time; one started while another is pending stops it first, which rejects with
  `"stopped"`, so every event between a request's start and its settling is that request's.

The worker clears an instance's scheduled timeouts when it exits, in the `exit` hook
`wasm_exec.js`'s `wasmExit` calls. `wasm_exec.js`, held to the pinned Go's copy, leaves them
scheduled, and a program can exit with one pending, as when a goroutine's sleep outlasts main:
its callback would then resume the exited program, which throws "Go program has already exited"
from the worker's timer task, an uncaught error that fails whatever request is pending. The guard
catches no error, so any other one still surfaces, and the run answers the program's own exit
code.

## Pages

Each hand page, and the Markdown shell, `markdown-shell.html`, links the foundation's
`page-full.css`, the components' `glyph-button.css`, the SDK's `site.css`, and the pages' shared
sheet, `web/pages/page.css`, in that order; the build bundles the four into the one stylesheet every
page links. The cascade layers are the foundation's (`foundation.tokens.*` through
`foundation.theme-menu`), then `site`, then `page`, and the browser tier reads that order on each
page. Every rule a page adds is in `web/pages/page.css`, inside `@layer page`, so it wins over the
shell's by layer order, at any specificity: the header-actions group at the header's inline end,
shrinking and wrapping its buttons where the row can't hold them on one line, as the playground's
three at a phone's width and twice the text size; the space between `main > section`s on every page;
the space around a rendered Markdown page's Go demo, as around a fence; the components page's
specimens; and the app page, the playground's one screen, which only a body of class `app` takes.
Its spaces are the foundation's `--space-*` steps.

A page holds no inline `<style>`. The build writes a page's inline sheet into its head
before the bundled linked stylesheet, so an `@layer` there declares its layer ahead of the
foundation's and reorders every layer on the page, and an unlayered rule there sits above every
layer. A page rule goes in `web/pages/page.css`.

## Playground

`playground.html` holds one `sl-go-demo` in the source mode, with `editable-files` and `fixed`,
and a Program select beside its heading that picks the program the demo shows: the starter, a
calculator, or one of four programs (see "The programs"). Its script, `web/pages/playground.ts`,
gives the demo the page's one `Runner`, the reader's arrangement, and the chosen program's files.
Nothing loads Go until a Run: the first fetches the manifest, the compiler, the linker, and the
archives of the program's import closure, and a later Run fetches the manifest again and only the
archives a new import adds (see "Runtime", `build(files)`). A Run after an edit to non-Go files
alone, such as `input.txt`, builds nothing: it reruns the last program built over the edited
files. The program's limits and its working directory are the build's. New file adds a file, so
the program can read a non-Go file through `os.ReadFile`. Stop keeps the compiled toolchain. The
reader's files live only in the page: each program keeps its edits while the tab lives, a reload
opens every program as shipped, and no file is shared or stored.

The starter is a calculator language. `main.go`, the active file, reads `input.txt` from the
working directory and runs it line by line; `lexer.go`, `parser.go`, and `eval.go` turn each line
into tokens, a syntax tree, and a value. A script line is an expression or a `let` binding, over
decimal numbers, `+ - * /`, unary minus, and parentheses; `#` starts a comment. Each result prints
on stdout, a binding as `name = value`. A failing line prints `input.txt:<line>: <reason>` on
stderr, the run goes on, and the program exits 1. The shipped `input.txt` works out a shopping
total, and its top comment suggests a line to try that fails.

The starter isn't a scenario and no page loads it prebuilt, so it lives outside `cmd/` and the
build never writes it to `dist/`. The check vets it and runs its Go tests under `GOOS=js`, on
node's fs and on the in-memory fs.

### The programs

Four more programs sit beside the starter, each a package main in `playground/<program>/`, sized
by its topic, and, like the starter, vetted and tested under `GOOS=js` on both filesystems and
never built into the site:

- Basics (`playground/basics`): structs, methods, function values, and interfaces, over a few
  shapes, in `main.go` and `shapes.go`.
- Generics (`playground/generics`): a type-parameter constraint, a generic `Stack`, and
  range-over-func iterators, in `main.go` and `stack.go`.
- Concurrency (`playground/concurrency`): goroutines, channels, `select`, a `WaitGroup`, and a
  pipeline, in `main.go` and `pipeline.go`, its output in a fixed order whatever the scheduling;
  `GOMAXPROCS` is 1 under `GOOS=js`, so its goroutines take turns on one thread.
- Standard library (`playground/stdlib`): prints release notes from a commit log. It reads
  `input.json` from its working directory, decodes it with `encoding/json`, takes each commit
  message apart with `regexp`, sorts and groups with `slices`, and prints a `text/template`
  report, all in `main.go`. A malformed `input.json` prints one stderr line naming the JSON error,
  found through `errors.As`, at its `input.json:<line>:<column>`, and a missing one prints one
  line found through `errors.Is`; either exits 1.

The Program select, a native `<select id="program">` labelled Program, offers Calculator, Basics,
Generics, Concurrency, and Standard library, their values `calc`, `basics`, `generics`,
`concurrency`, and `stdlib`. The calculator's files are the demo's own fences; each other
program's are the fences of a `<template data-program="<program>">` in the page, which renders
nothing, each fence equal byte for byte to its file in `playground/<program>/` (the unit tier
holds it). On load the script builds one `FileSet` per program from those fences, by the demo's
own rules (`readFences` in `web/components/fences.ts`), editable, the first file active, and keeps
each for the tab's life. Choosing a program gives the demo that set as its `files` property, in
place, with no reload and no request: the program's edits, added files, and active file are as
the reader left them, Reset restores the program on screen alone, and the switch stops a pending
run, recorded as stopped, and clears the console and the timings. Switching back to a program
built earlier compiles and links it again, as the runner holds only the last build, but fetches
no archive the worker already holds.

The fragment names the program shown: `#calc`, `#basics`, `#generics`, `#concurrency`, or
`#stdlib`. The page opens on the program the fragment names, and on the calculator with no
fragment or one that names no program. A choice in the select writes its fragment as a new
history entry, so Back and Forward step through the reader's choices; those steps, and a fragment
the reader edits, show the program it then names, with its edits, and the select follows. Each
template carries its program's fragment as its `id`, so the index's links to the programs, from
evidence 12, each name an element on the page, as the SDK's crawl requires; a template renders
nothing, so following one scrolls nothing. The select's `autocomplete` is off, so a reload
restores no choice over the fragment.

### The one-screen page

The playground is an app page, a workspace rather than an article, laid out in CSS alone by the
shared sheet's rules for its body, of class `app` (see "Pages"). It keeps the SDK's shell, the
header and the body's inline gutter, and changes three things about it. The body is one column
at every width, the header over main, where `site.css` gives it three from 70rem, with main a
reading column in the middle. The body is at least the viewport's height (`100dvh`), and main
takes every row the header leaves, where `site.css` packs the rows at the top. And one gutter,
`--page-gutter`, the `--space-m` the shell already holds the body off the viewport's sides with,
spaces the inline sides and the block end alike.

Main spans the body's content width, a grid of named lines: `content`, the prose's 80ch, centered
between two equal side tracks, and `full`, the content and both sides. Its rows are two, by name,
whatever the prose holds: `prose`, its own height, and `demo`, `1fr`, every row the prose leaves.
The prose, one block (`.prose`) of the heading and the lede alone, "Edit the Go below and press
Run (Ctrl+Enter). Go's own compiler and linker build it right here in your browser.", sits on
`content`; the fixed demo sits on `full`, in `demo`, so it ends a gutter above the viewport's
bottom, every part's bottom border in view. The demo's own width sets its bands. Where the
viewport leaves the demo less than its floor (`sl-go-demo`, "Fixed layout"), as on a short screen
or at a larger type or text zoom, the page grows and scrolls down, never sideways. The SDK's shell
checks all run on the page but main's reading width, and the spike's own check holds the prose to
80ch, centered. The browser tier proves the one screen in the machine's fonts and in the pinned
DejaVu set, and reports how far above its floor the demo stands at each capture size.

The playground's detail is in its About dialog, `dialog#about`, out of the screen's flow, so no
font costs the demo a line of it. About, the header's first glyph button, before the shell's Help
and Settings, shows the icons layer's `info-16` and its key, A, which nothing else on the page or
in the shell binds; it opens the dialog as Help opens its own, a shortcut dialog headed "About the
playground", its title focused, closed by its Close or by Escape. The dialog says, in the reader's
terms, what a program can be, where its other files go, how Run and Stop behave, that edits last
only as long as the tab, and what a Run downloads, and links to the spike's question and evidence,
the index. Its width is the prose's 80ch where the viewport has it (`web/pages/page.css`).

### The Layout menu and the stored arrangement

From 64rem the demo's toolbar shows Layout, a menu of Editor left, Editor top, and Editor right,
which places the editor left of the output, above it, or right of it (`sl-go-demo`, "Fixed
layout"). The arrangement is the reader's preference, so the page owns it, not the demo.
`keep()` in `web/pages/arrangement.ts` builds one `Arrangement` from the placement stored in
localStorage under `spike-html-go-wasm.arrangement` as a JSON string (`"left"`, `"top"`, or
`"right"`), gives it to every fixed demo on the page, and applies each demo's `arrange` request
to it, storing the choice. The page's script blocks render, so the stored arrangement applies
before first paint, on a reload and on every playground on the origin. Each storage access runs
in a try/catch, as the foundation's `preferences.js` reads the theme: blocked storage, an empty
store, text that isn't JSON, and a value the model refuses each open with the editor left. The
choice is the only write: nothing is stored until the reader chooses, and choosing the
placement already held stores nothing. Another tab's choice moves this page's demo too, and a
cleared store moves it back to left.

## sqlate

The spike's first workspace module: go.mod requires `github.com/standards-lab/sqlate` and
`github.com/standards-lab/sqlate/postgres` at v0.7.0, by tag, with no replace directive. Two
pages use it: the sqlate page builds a whole program in the page, and the Markdown compile page,
`sqlate-compile.html`, calls a prebuilt handler.

### The program

`playground/sqlate` is a package main beside the playground's programs, vetted and tested under
`GOOS=js` on both filesystems and never built into the site, nor offered in the playground's
Program select. `main.go` reads the `.sql` files in its working directory, whose names say what
each one is:

- `<ns>.<name>.sql` is a pattern, published in namespace `ns`: `app.identity.sql` is the pattern
  a statement includes as `{{> app.identity}}`. A file such as `audit.stamp.sql` adds the
  namespace `audit`.
- Any other `.sql` file is a statement, named by its file: `create.sql` is the statement
  `create`.

It compiles the statements against PostgreSQL's patterns, the library's `sql` namespace with
`{{> sql.guard_set}}` and `{{> sql.guard_where}}` among them, plus one namespace for each `ns` the
pattern files name, for PostgreSQL's dialect, and prints each statement in name order: its name,
its tier, its parameters in the order they bind, and its SQL with `$n` placeholders. The sample
files are in go-web-service's style: `app.identity.sql`, a native `RETURNING` with its port note,
and the statements `create.sql`, which includes it, `edit.sql`, a guarded edit over the `sql`
guard patterns, and `version.sql`, the guard's check. A catalog or compile error, a missing tier,
an include nothing publishes, a native pattern in a standard statement, or a pattern in the
library's own `sql` namespace, prints sqlate's own message on one stderr line and exits 1.

`guard.go` then runs `edit`, guarded by `version`, over sqlate's `sqltest` driver, which answers
each call from a script and records it, with no socket and no database. `input.json` sets the
script: `id`, `code`, and `name` are the edit's arguments, `version` the version the caller read,
and `stored` the version the row holds, or `null` for no row. Equal to `version`, the edit
affects one row and the run prints the new version; another number, it prints the version
mismatch; `null`, `sql.ErrNoRows`' message. The run prints each driver call, its op, its bound
values, and its `$n` SQL, then the result. A missing `edit.sql` or `version.sql`, or an
`input.json` that is missing or isn't the JSON the run reads, prints why on stderr and exits 1.
`sqltest.Open` takes a `testing.TB`, which a program has none of, so the run passes it a
commented stand-in that does what `Open` asks of one, `Helper` and `Cleanup`.

### The sqlate page

`sqlate.html` is an app page, one screen as the playground is, holding one `sl-go-demo` in the
source mode, with `editable-files` and `fixed`, on `playground/sqlate`'s files: `main.go`, active,
`guard.go`, the `.sql` files, and `input.json`, each fence equal byte for byte to its file (the
unit tier holds it). Its script, `web/pages/sqlate.ts`, gives the demo the page's one runner and
the reader's arrangement. Run builds the program in the page against the standard library and
the site's pinned modules, whose archives the playground's manifest names under `mod/`; the
first Run fetches sqlate's, `sqltest`'s, and PostgreSQL's driver's archives among the
standard library's. An edit to a `.sql` file or to `input.json` alone builds nothing, rerunning
the program held over the new files. The reader adds a namespace by adding a pattern file with
New file. Each `.sql` file shows in SQL's grammar.

### The scenario

The sqlate scenario, `internal/sqlate` with its entrypoint `cmd/sqlate`, is prebuilt into
`dist/go/sqlate.wasm` and served through the bridge's `Serve` on one long-lived instance, as the
probe is. It imports only the standard library, the bridge, and sqlate, and serves one handler,
`compile`: it takes one statement's text, compiles it as `statement.sql` against PostgreSQL's
patterns plus the program's sample app patterns, for PostgreSQL's dialect, and answers its `$n`
SQL, printing one line naming its tier and its parameters (`compile: native, parameters $1 code,
$2 name`), or rejects with sqlate's message (`query: statement.sql: no tier declaration`). The
patterns are embedded under `internal/sqlate/patterns/<ns>/<name>.sql`, the layout
`query.Publish` reads, each byte for byte the program's `playground/sqlate/<ns>.<name>.sql`,
which the unit tier holds. The check tests the handler under `GOOS=js` on both filesystems.

### The Markdown compile page

`markdown/sqlate-compile.md` is the spike's own writing, in its own directory, never copied into
`content/` at a commit. The SDK's `markdownPages` renders it as the spike's own tree
(`vite.config.ts`): the plugin takes one tree's source, `dir: "markdown"`, a repository URL, and a
ref, which it reads only to write a blob URL for a link to a file listed external; the tree lists
none, and the build fails on any relative link that leaves it, so neither is read, and the ref
names the branch the site publishes from. The page builds to `sqlate-compile.html`, filled into
the Markdown shell, `markdown-shell.html`, which no build input names: the index's head and
header, with the Pages and Contents buttons and their drawers, which the plugin writes into each
page, and no site nav. The shell's script, `web/pages/markdown.ts`, defines `sl-go-demo`, gives
every demo on the page the page's one runner, and wires each drawer to its opener. Go loads only
on a Run.

The page writes its demo as raw HTML around an ordinary `sql` fence, which the plugin highlights
at build into Shiki's markup:

````md
<sl-go-demo scenario="sqlate" handler="compile" file="statement.sql" label="compile demo">

```sql
--| tier: native
…
```

</sl-go-demo>
````

The blank lines end the HTML block, so the fence between them renders as Markdown. Shiki's markup
carries no name, so the demo's `file` attribute names the fence. The page passes the SDK's shell
checks, the palette check, and the crawl. The bridge and the runtime serve it, as they serve the
sqlate page, with no code of sqlate's.

Every Markdown page is crawled as a copied page. `content.json` records no tree, since the site
copies none, so the crawl would count the rendered pages hand pages, which have no pager; but
`markdownPages` gives them a site index and pagers, as it gives a copied tree's. The site test
(`test/browser/site.test.ts`) crawls from a scratch root under TMPDIR whose `content.json` records
`markdown/` as one copied tree, a record the SDK's content check accepts, so each rendered page
gets every check the crawl makes of a copied page. The palette check runs on each rendered page;
a demo's fence isn't shown once the demo upgrades, so each page also holds highlighted fences in
its prose.

## go-core graph

go.mod requires `github.com/standards-lab/go-core` at v0.12.0, by tag, with no replace directive.
The graph page builds a program on its `graph` and `lifecycle` packages in the page.

### The program

`playground/graph` is a package main beside the playground's programs, one `main.go`, vetted and
tested under `GOOS=js` on both filesystems and never built into the site, nor offered in the
playground's Program select. `wire` describes a small service on a new `graph.Graph`: the
settings, a `Value`; the router, a `Fresh`, new and empty in each Build; the store, which uses the
settings; two routes, `health` and `projects`, in the `routes` `Group`, each using the store and
the router; and the server, which uses the settings and the router and is ordered `After` the
routes. Each constructor reaches its dependencies through its `Scope`'s `Use`. `run` builds the
System from its roots, the routes group and the server, prints its layer table, and runs it under
lifecycle's `Coordinator` with a finalized `Config`: the store and the server, each with `Start`
and `Shutdown`, print their start in layer order and their stop in reverse, and the program exits
0:

```text
0: settings, router
1: store
2: health, projects
3: server

start store: postgres://db/app
start server: :8080 GET /healthz, GET /projects
ready
stop server
stop store
```

A constructor that returns an error fails the Build before anything starts: the program prints
graph's message, which names the node (`store: connection refused`), on one stderr line and exits
with code 1. A wiring mistake, such as a route that uses the server, which is ordered after every
route, makes Build panic: Go prints the panic, graph's message naming the cycle's path
(`graph: dependency cycle: server -> routes -> status -> server`), and the program exits 2.

### The graph page

`markdown/go-core-graph.md` renders to `go-core-graph.html`, a Markdown page as
`sqlate-compile.html` is (see "The Markdown compile page"). It holds one `sl-go-demo` in the
source mode, naming no scenario or handler and its file `main.go`, around one ordinary `go` fence,
byte for byte the program's `main.go` (the unit tier holds it). Its prose explains what graph's
`Define`, `Value`, `Fresh`, `Use`, `After`, `In`, and `Group` describe, the layer table, and how
lifecycle runs it, and shows the failing constructor's and the cycle's edits as fences to paste
in. A Run builds the program in the page as the playground does: the first fetches the manifest,
the compiler, the linker, and only the program's closure of archives, go-core's among them, and
an edit rebuilds and runs the edit.

## go-web-sdk

go.mod requires `github.com/standards-lab/go-web-sdk` at v0.17.0, by tag, with no replace
directive. Its page calls a prebuilt scenario's handler, which serves HTTP requests through
go-web-sdk's Router in-process, with no socket.

### The scenario

The go-web-sdk scenario, `internal/websdk` with its entrypoint `cmd/websdk`, is prebuilt into
`dist/go/websdk.wasm` and served through the bridge's `Serve` on one long-lived instance, as the
sqlate scenario is. It imports only the standard library, the bridge, and go-web-sdk's and
go-core's packages, which the unit tier holds by its import listing, and serves one handler,
`request`.

`request` takes one HTTP/1.1 request's text: a request line, headers, a blank line, and a body,
with LF or CRLF line endings. The body is every byte after the first blank line, and the scenario
sets `Content-Length` from it, replacing any the text gives and dropping `Transfer-Encoding`, so
the reader counts no bytes; with no blank line there is no body. The head goes to net/http's own
`ReadRequest`, and the request to the Router's `ServeHTTP` with an `httptest` recorder. The
answer is the response as HTTP/1.1 text, LF-ended: the status line, each header the handler set,
one line a value, in name order, a blank line, and the body. No `Content-Length` or `Date` is
added. Text that isn't an HTTP/1.1 request is rejected as `request: <why>`: `no request line`,
`net/http`'s own message for a malformed request line or header, or `HTTP/2.0 isn't HTTP/1.x`.
The instance serves the next call.

The Router mounts a `/projects` `Group` compiled into a `Module`, under `RequestID` and
`Recoverer` on the Router itself, so every response, a miss included, carries `X-Request-Id`, and
every problem is RFC 9457's `application/problem+json` with `request_id`. A project is an `id`, a
UUID, a `code`, a `name`, and a `version`:

- `GET /projects` pages the projects by `ParseQuery`'s `page` and `size`, 10 a page by default and
  at most 50, answered as `NewPage`'s envelope, `{"items":[…],"page":1,"size":10,"total":3,
  "more":false}`. A size it refuses is 400.
- `GET /projects/{id}` answers one project, its version as its `ETag`. An id that isn't a UUID is
  400, and an unknown id 404.
- `POST /projects` decodes `{code, name}` with `DecodeJSON` and answers 201 with the new project,
  under a new UUIDv7, at version 1, with its `ETag` and its `Location`. An unknown field, an empty
  body, or a second JSON value is 400.
- `PUT /projects/{id}` with `If-Match: "<version>"` replaces the code and the name and answers the
  project at the next version. A stale version is 412, a missing `If-Match` 428, and a malformed
  one, unquoted, 400.
- An unknown path is 404, and a known path with another method 405 with `Allow`.

Three projects are seeded at startup, ATLAS, BOREAL, and CINDER, at
`01933b5e-8a00-7000-8000-00000000000{1,2,3}`, version 1, and kept in memory for the instance's
life: a create is listed and readable by later calls, and an update raises the version a later
stale update is refused against. A Stop or a reload starts a new instance from the seed. The check
tests the handler under `GOOS=js` on both filesystems.

### The go-web-sdk page

`markdown/go-web-sdk-handlers.md` renders to `go-web-sdk-handlers.html`, a Markdown page as
`sqlate-compile.html` is (see "The Markdown compile page"). It holds one `sl-go-demo` naming the
scenario, `websdk`, its handler, `request`, and its file, `request.http`, around one ordinary
fence naming no language, a `GET /projects` request. The build highlights only a fence that names
a language, so the demo's fence renders as marked's plain `<pre><code>`, and the editor has no
grammar for `.http`, so the request shows as plain text before the demo upgrades and after. Its
prose explains what runs: the Router, the Group and the Module, the middleware, the problems, the
seeded instance, and the in-process call. It shows the other requests to try as `http` fences, a
create, a read by id, an update with `If-Match`, and an id that isn't a UUID, and the stale
update's problem as a `json` fence; Shiki highlights these at build, and the palette check reads
them. The first Run fetches the worker and `go/websdk.wasm` alone; each Run after it calls the
instance already held, fetching nothing.

## Components

The components are Lit elements with shadow roots, prefixed `sl-`, in `web/components/`. Each
module defines its element when it is imported and exports its tag name as `tagName`; the
element's shadow root adopts the foundation's reset and elements sheets, then its own, a CSS
module script beside it. A page imports a component's module, and the build bundles it.
`components.html` shows each component's states once, labelled, its layout following the
viewport, and focused by the keyboard. The directory's other modules are the components'
internals, each documented in its own comments: `aria.ts`, `file-names.ts`, `highlights.ts`,
`reasons.ts`, `subscription.ts`, `syntax-themes.ts`, and `tokenizer.ts`, and one shared sheet,
`tabs.css`, the tablist's look, which the file tabs and a fixed demo's output tabs adopt.

- `./arrangement.js`: `Arrangement`, where a fixed Go demo places its editor from 64rem, the
  reader's preference. It is a model with no document, element, or storage, an `EventTarget` its
  owner, the page, writes. `placement` holds `"left"` (the default, `DEFAULT_PLACEMENT`),
  `"top"`, or `"right"`; `PLACEMENTS` lists them, frozen, in the Layout menu's order.
  `new Arrangement(placement?)` starts from the placement given, validated. A value it can't hold
  is refused, naming the reason, and changes nothing: a `TypeError` for a value that isn't a
  string, a `RangeError` for a string that isn't a placement. `placementProblem(value)` gives that
  reason, or `null`, without setting anything, so an owner reading storage tests a value before
  taking it. Each set that changes the placement sends one `change` `Event`; a set to the
  placement held sends none. The unit tier tests it under node.

- `./code-editor.js`: `sl-code-editor`, a plain-text source editor: a `contenteditable` element
  in plaintext-only mode, exposed as a multiline textbox, beside a gutter of line numbers. Its Go,
  JSON, and SQL are highlighted by Shiki 4.6.0, through CSS Custom Highlight ranges, so no element
  ever enters the text and highlighting never moves the caret or the selection. The colors are
  each palette's syntax theme, the SDK's built-in ones, merged per palette at build into
  `light-dark()` colors, so each token takes the color the SDK's own fence of the same code gives
  it in every palette and scheme; a palette with no syntax theme shows the text plain. The
  `::highlight()` rules paint color only, so the italics of Catppuccin's and Everforest's comments
  don't show. The tokenizer, Shiki's core, its JavaScript regex engine, and the Go, JSON, and SQL
  grammars, loads lazily as the first editor upgrades; until then, and for any other language,
  the text is plain. After an edit it re-highlights once typing pauses. Every editor on a page
  paints into the document's one set of highlights, and one removed leaves the others painted.
  Long lines scroll sideways inside the frame by default, one row a line, the gutter held in place
  beside them, and wrap when its settings say so; either way each number stays beside its line's
  first row at every width and profile. The gutter is hidden from assistive technology and holds
  no text: its numbers are generated content, outside the editable element. The editor grows
  with its text; a page that holds it to a block size gets a frame that scrolls inside. Its
  editing keys make each edit through `document.execCommand`, a line break as `insertLineBreak`
  and the rest as `insertText`, so each is one step of the browser's own undo history. A paste
  takes the clipboard's plain text through the same path, and a drop is refused.
  - Attributes: `language` (`go`, `json`, or `sql`; any other shows plain; reflected), `label` (the
    textbox's accessible name, "Code" by default), `readonly` (reflected), and `aria-labelledby`
    (ids in the host's tree whose elements name the textbox, taking precedence over `label`).
  - Properties: `value`, the whole text, which reading gives as edited and setting replaces,
    sending no event, and which, set while the editor has focus, is the value `change` is then
    measured from; `settings`, an `EditorSettings` (below) that its owner, the page or the
    element composing the editor, creates and writes, and the editor renders from, follows as it
    changes, and never writes; `null`, the default, shows the defaults, long lines scrolling and a
    tab four columns wide; and `language`, `label`, and `readonly`, as their attributes. The editor
    has no attribute for wrapping or tab size.
  - Events: `input`, the browser's own, composed out of the shadow root, on every edit, typing,
    each editing key, undo, and redo included; an editing key's edit sends one. `change`, an
    `Event` that bubbles, once focus leaves the text with the value changed since focus came in;
    a value undone back to where it was sends none. Setting `value` sends neither.
  - Slots: none.
  - Keyboard: it takes focus in the page's tab order and types as a plain-text field does.
    - Enter breaks the line, the new line carrying the spaces and tabs before the caret on the
      current one; Shift+Enter breaks it with no indent.
    - Tab inserts a tab at the caret, or, with a selection, indents every line the selection
      touches; Shift+Tab outdents the caret's line or the selected lines, a tab or up to the tab
      size's count of spaces from each. Indenting always inserts a tab character, as gofmt writes
      Go; the tab size sets only how wide it shows. The selection keeps the text it held.
    - The browser's own undo, Ctrl or Cmd+Z or its Edit menu, reverts each editing key's edit in
      one step, and its redo restores it.
    - Escape releases Tab: the next Tab or Shift+Tab moves focus out of the editor, as anywhere
      else. Typing, a click in the editor, or focus coming back arms Tab again. A second Escape is
      the page's: under the foundation's keys it releases the field, blurring it, or it closes a
      dialog holding the editor.
    - While an input method composes, no key is the editor's, so a composition commits as typed.
    - While the editor has focus, a hint below it, hidden from assistive technology, shows the
      model, "Tab indents · Esc then Tab moves focus", or, released, "Tab moves focus"; the
      textbox's description says the same to assistive technology.
    - Paste, Ctrl or Cmd+V or the browser's menu, inserts the clipboard's plain text in place of
      the selection, its line breaks as "\n", as one undo step and one `input`.
    - In scroll mode, an editable editor keeps its caret in view as it moves or types, and a
      read-only one scrolls with the arrow keys.
    - While `readonly` it takes no edit, Enter, Tab, and paste included, and is exposed as
      read-only, and keeps focus, selection, copy, and highlighting; Tab moves focus, no hint
      shows, and Ctrl or Cmd+A selects its text alone. A character key fires none of the page's
      single-key shortcuts, as in a field, and Escape is the page's.
- `./console.js`: `sl-console`, a run's output, exits, and answers as a quiet log. It renders the
  `ConsoleLog` (below) it is given, follows each change it sends, listening only to the log it
  holds while it is in the document, and never writes it. Output shows as written, in arrival
  order, keeping Go's line breaks and blank lines and wrapping long lines, anywhere if it must, so
  nothing scrolls sideways; a control character shows as its Unicode control picture, so an ANSI
  escape reads "␛[31m". stdout is plain. stderr's line is the palette's red mixed into the
  surface, with a red rule at its start and a cue in its gutter, "err", which assistive
  technology reads as "stderr: "; its text keeps the page's text color, which holds 4.5:1 on the
  tint in every palette and scheme where the red itself doesn't. An exit is a status line,
  "hello exited with code 0", led by a tick for 0 and a cross for any other; a result is a block
  of its own headed "Result" or "Error", with the same glyphs, an error's tinted as stderr is. With
  entries dropped, the bar above the log says how many ("500 earlier lines dropped"), and describes
  the log; with none, the log says "No output yet." The log follows its tail, showing each new
  entry, unless the reader has scrolled up, and follows again once they return to the end; the
  jump is instant, so nothing moves. It renders once an animation frame, whatever changed since
  the last, appending the new rows and dropping those the limit dropped, never re-rendering the
  whole log: 10,000 writes, each its own task, render in a few frames. The log grows with its
  lines up to 24rem, or the length the page sets as `--sl-console-max-block-size` on the host,
  and scrolls inside; it is no flex item, which would lay out every row again on each append.
  With `fill`, the console takes the block size its container gives it, whatever the log holds:
  the bar sits on top and the log takes the rest, scrolling inside. The log's frame has
  `contain: size`, so no row is measured to size it, and is at least as many of its own lines tall
  as the host's `--sl-console-min-lines` gives, none by default; a fixed Go demo sets its floor's
  there.
  - Attributes: `label` (the log's accessible name, "Output" by default) and `fill` (a boolean:
    fill the given block size rather than grow with the log).
  - Properties: `log`, the `ConsoleLog` its owner creates and writes; `null`, the default, shows
    the empty state; and `label` and `fill`, as their attributes.
  - Events: `clear`, an `Event` that bubbles and is not composed, when Clear is pressed with
    entries shown: a request, which changes nothing until the owner applies it with
    `log.clear()`. Copy sends none: it puts the log's `text()` on the clipboard itself, changing
    nothing, and confirms "Copied" (or "Couldn't copy") in a polite status for two seconds.
  - Slots: none.
  - Accessibility: the log is `role="log"` named by `label`, with `aria-live="off"`, so no write
    is announced; Copy's status is the console's only live region. Copy and Clear are glyph
    buttons, Octicons' copy and trash, named "Copy" and "Clear", each showing its name in a hint
    on hover and keyboard focus, and `aria-disabled`, still focusable, while the log is empty.
  - Keyboard: Tab reaches Copy and Clear, each pressed by Enter or Space, then the log, which
    shows the focus outline inside its frame and scrolls by the arrow keys, Page Up and Down, Home,
    and End.
- `./console-log.js`: `ConsoleLog`, a console's log, a model with no document or element, an
  `EventTarget` its owner, the page or the element composing the console over a runner, is the
  only writer of. It takes the runtime's events as they are, their shapes re-declared, since the
  components tier imports nothing from the runtime.
  - Writing: `output({ stream, text })`, `stream` `"stdout"` or `"stderr"`, splits the text into
    lines at `"\n"`, keeping every other character as written, `"\r"` and ANSI escapes included,
    the last line left open unless the text ends one; `exit({ scenario, code })`, a whole-number
    code; `result({ ok, text })`, a handler's answer (`ok` true) or error; and `clear()`, which
    empties the log and its dropped count.
  - Interleaving: a write continues the line before it only when that line is the same stream's,
    still open, and the last entry; a write to the other stream, an exit, a result, or a clear in
    between ends the open line where it stands, and the continuation starts a line of its own. So
    the entries are in arrival order, no line holds both streams' text, and only the last entry
    ever changes.
  - Reading: `entries`, the kept entries in order as frozen snapshots, `{ kind: "output", seq,
    stream, text, open }`, `{ kind: "exit", seq, scenario, code }`, or `{ kind: "result", seq, ok,
    text }`, the same array until the log changes; `size`; `dropped`; `limit`; `first` and
    `next`, the sequence numbers of the first entry kept and of the next to be added, every kept
    entry's number between them, unbroken and never reused, clear included; `at(seq)` and
    `since(seq)`, in constant time and in the entries returned; and `text()`, each entry on a line
    of its own, output as written, an exit as "<scenario> exited with code <code>", an error's
    text after "error: ", as `entryText(entry)` gives each.
  - Limit: it keeps the latest 10,000 entries (`LIMIT`; `new ConsoleLog({ limit })` sets
    another), an output line, an exit, and a result each counting as one, and counts those dropped
    from the front. A write costs the lines it adds.
  - Refusals: an operation the log can't apply throws, naming the reason, and changes nothing: a
    `TypeError` for a value of the wrong type, a `RangeError` for another stream or a code that
    isn't a whole number.
  - Events: one `change` `Event` for each operation that changes the log, however many lines it
    adds; an empty write, or a clear of an empty log, sends none. The unit tier tests it under
    node.
- `./controls.js`: `sl-controls`, a demo's controls as one ARIA toolbar: a Run group (Run, Stop, and
  Reset), under `editable-files` a vertical separator and a Files group (New file, Rename, and
  Delete), and, given an `Arrangement`, a separator and a Layout group (Layout). Each control is a
  glyph button named by its name, which shows beside its glyph while the toolbar is 26rem wide or
  wider, where the widest group fits with its names in any font; narrower, the glyph shows alone and
  the name as a hint on hover and keyboard focus, as the console's Copy and Clear show theirs. It
  renders the `FileSet` and the `RunState` it is given, follows each change they send, listening
  only to the models it holds while it is in the document, and never writes either: every control
  sends a request its owner applies. Run is always available, as a new run stops the pending one;
  Stop only while a run is pending; Reset only while a file differs from its text as given; New file
  and Rename always; Delete unless the set refuses to remove the active file, the last one. An
  unavailable control is `aria-disabled`, focusable, and sends nothing. New file and Rename each
  open a form in a popover, a non-modal dialog anchored below its button: a labelled input and a
  submit, Create or Rename. Rename's input holds the active file's name, its stem, the name before
  its extension, selected. On submit the name is checked by the set's `nameProblem`; a refused name
  leaves the form open, the input `aria-invalid` and described by the set's reason in a polite live
  region, and from then on the reason follows the name as it is typed. A taken name closes the form,
  returns focus to its button, and sends the request; a rename to the file's own name sends nothing.
  Escape closes the form, sends nothing, and returns focus to its button. Delete asks for no
  confirmation. Layout is an APG menu button, with `aria-haspopup="menu"` and `aria-expanded`. It
  opens a menu in a popover anchored below it, holding three radio items, Editor left, Editor top,
  and Editor right; the arrangement's placement is checked and ticked. Choosing an item closes the
  menu, returns focus to Layout, and sends the request, unless the placement is the one held. The
  menu is as wide as its items and each form as its content, up to 22rem; each popover is bounded
  by its containing block, the anchored area between its button and the viewport's side, never by
  a viewport unit, and opens toward the side with more room, so none reaches past the viewport. The
  status, a polite live region beside the toolbar, says each run's start, "Running hello…", and
  its end, "Finished format", "Finished hello, exit code 0", "Stopped spin", or "Failed format:
  <message>", from the run state's transitions alone: the state the toolbar is given is never
  said, nor a change of the files. The toolbar wraps between its groups, each group's controls
  together. With `steady`, the status keeps to one line whatever it says, so the toolbar's height
  depends on its width alone: the status asks the row for its reserved width, which decides
  whether it shares the controls' line or takes its own, and text longer than its line ends in an
  ellipsis, still whole to assistive technology. Nothing moves.
  - Attributes: `editable-files` (a boolean: show the Files group), `steady` (a boolean: the
    status keeps one line), and `label` (the toolbar's accessible name, "Controls" by default).
  - Custom properties: `--sl-controls-status-inline-size`, the steady status's reserved width, a
    length, `24ch` by default, in the ch of the status's own text; a page may set it on the
    element.
  - Properties: `files`, the `FileSet` its owner creates and writes, `null` by default, leaving
    Reset unavailable and the Files group out; `runState`, the `RunState` its owner creates and
    writes, `null` by default, leaving Stop unavailable; `arrangement`, the `Arrangement` its owner
    writes, `null` by default, leaving the Layout group out; and `editableFiles` and `label`, as
    their attributes.
  - Events, each bubbling and not composed, a request that changes nothing until the owner applies
    it: `run`, `stop`, and `reset` (`Event`s); `new` (a `CustomEvent`, `detail.name`, the new
    file's name), `rename` (`detail.from` and `detail.to`), `delete` (`detail.name`, the active
    file's), and `arrange` (`detail.placement`, the placement chosen). The owner applies them as
    `runState.start(what)` with its runner's run, `runState.finish(run, { kind: "stopped" })` with
    its runner's stop, `files.resetAll()`, `files.add(name)`, `files.rename(from, to)`,
    `files.remove(name)`, and `arrangement.placement = placement`.
  - Slots: none.
  - Keyboard: Tab reaches the toolbar's one tab stop, the control last focused, Run at first, a
    roving tabindex. Left and Right move to the previous and next control, wrapping, and Home and
    End to the first and the last, unavailable controls included. Enter and Space press the
    focused control. Run declares `aria-keyshortcuts="Control+Enter Meta+Enter"`, the shortcut
    the demo composing it handles from inside itself. In a form, Enter submits and Escape closes
    it, each returning focus to the control that opened it; the form closes on Escape's keydown,
    so focus is back on the control before the page's keys see it. On Layout, Enter, Space, and
    Down open its menu, focus on the checked item. In the menu, Down and Up move focus to the next
    and the previous item, wrapping, and Home and End to the first and the last; Enter or Space
    chooses the focused item and closes the menu; Escape closes it; each returns focus to Layout,
    and each is marked handled, so no page shortcut fires. Tab closes the menu and moves on from
    Layout. Layout keeps its place in the toolbar's roving tabindex; the items rove by the menu's
    keys alone.
- `./editor-settings.js`: `EditorSettings`, the code editor's settings, a model with no document
  or element, an `EventTarget` its owner writes: `wrap` (a boolean, `false` by default: long lines
  scroll sideways) and `tabSize` (a whole number from 1 to 8, 4 by default, how many columns a tab
  shows). `new EditorSettings({ wrap, tabSize })` starts from the defaults. A value it can't hold
  is refused, a `TypeError` or `RangeError` naming the reason, and changes nothing;
  `tabSizeProblem(value)` and `wrapProblem(value)` give that reason, or `null`, without setting
  anything, and `defaults` holds the defaults, frozen. Each set that changes a value sends one
  `change` `Event`; a set to the value held sends none. The unit tier tests it under node.
- `./fences.js`: `readFences(parent, program, file?)`, a Go demo's fences read as files,
  `{ name, text }` each, in order: the rules `sl-go-demo` builds its files by (its "Fences",
  below), stated once so that a page building a `FileSet` for a demo, from a template's content,
  reads them alike. `parent` is the demo's host or a template's content; `program` picks the
  default name of a fence that names no language, `main.go` when true, else `input.json`; `file`,
  the demo's `file` attribute, names every fence that names none. It reads the markup and changes
  nothing. The naming rules themselves, and a file's grammar by its name (`languageOf`), are
  `file-names.ts`'s, which holds no DOM, so the unit tier tests them under node.
- `./file-set.js`: `FileSet`, a set of source files, a model with no document or element, an
  `EventTarget` its owner, the page or the element composing the tabs and the editor, is the only
  writer of. It holds at least one file, in the order given or added, and one active file.
  `new FileSet(files, active?)` takes `{ name, text, readonly? }` for each, the first active
  unless `active` names another.
  - Reading: `files`, the files in order as frozen snapshots, `{ name, text, original, modified,
    readonly }`, `original` the text as given and `modified` whether `text` differs from it, the
    same array until the set changes; `active`, the active file's name; `activeFile`; `file(name)`;
    and `modified`, whether any file is.
  - Operations: `select(name)`; `edit(name, text)`; `reset(name)`, restoring the file's text as
    given; `resetAll()`, restoring every file's text as given, leaving the files added, renamed, or
    removed as they are; `add(name, text = "")`, appending an editable file and leaving the active
    file as it was; `rename(from, to)`, in the file's place, active if it was; and `remove(name)`,
    which, removing the active file, activates the next file, else the previous.
  - Refusals: an operation the set can't apply throws, naming the reason, and changes nothing: a
    `TypeError` for a name or text that isn't a string, a `RangeError` for a name that is empty or
    white space alone, holds a path separator, `/` or `\`, or another file holds; a file it
    doesn't hold; an edit to a read-only file; or removing the last file. Read-only holds a file's
    text alone: it can be renamed and removed. `nameProblem(value)`, the module's, gives a name's
    own reason; the set's `nameProblem(value, renaming?)` adds a duplicate, and
    `removeProblem(name)` the last file's; each gives the reason or `null` and changes nothing.
  - Events: one `change` `Event` for each operation that changes the set; one that changes
    nothing, such as selecting the active file or editing a file to its own text, sends none. The
    unit tier tests it under node.
- `./file-tabs.js`: `sl-file-tabs`, tabs for a `FileSet`, as the ARIA tabs pattern: a tablist
  with one tab per file, in order, the active file's selected. It renders the set it is given,
  follows each change the set sends, listening only to the set it holds while it is in the
  document, and never writes it: choosing a tab sends a request, and the selection changes only
  when the set's owner applies it. A modified file's tab shows a dot after its name and is named
  "name, modified"; a read-only file's is described as read-only. The tabs stay inside their row,
  so it never scrolls up or down; when they overflow it, it scrolls sideways inside itself, never
  the page, bringing the tab focus reaches, and the active tab as it changes, into view. It
  scrolls smoothly only when the reader allows motion.
  - Attributes: `label` (the tablist's accessible name, "Files" by default) and `panel` (the id,
    in the host's tree, of the panel each tab controls, set on each tab across the shadow root as
    an element reference, `ariaControlsElements`).
  - Properties: `files`, the `FileSet` its owner creates and writes; `null`, the default, shows
    no tablist; and `label` and `panel`, as their attributes. `focus()` focuses the selected tab,
    so an owner moving focus to the tabs, as `sl-go-demo` does after a delete, lands on it.
  - Events: `select`, a `CustomEvent` whose `detail.name` names the file, bubbling and not
    composed, when a tab other than the selected one is clicked or reached by the keyboard. The
    owner applies it with `files.select(detail.name)`.
  - Slots: none.
  - Keyboard: Tab reaches the selected tab alone, a roving tabindex. Left and Right move focus to
    the previous and the next tab, wrapping at either end, and Home and End to the first and the
    last, each requesting that tab's selection: activation follows focus. Enter, Space, and a
    click request the focused tab's selection.
- `./glyphs.js`: the glyphs the components draw in their shadow roots, Octicons' copy, trash,
  check-circle, x-circle, play, square-fill, undo, file-added, pencil, split-view, and check from
  the icons layer, written out as Lit templates with the same paths: the build fills the icons
  layer into a page's own markup, and no tier imports it.
- `./go-demo.js`: `sl-go-demo`, live Go: the element composing `sl-controls`, `sl-file-tabs`,
  `sl-code-editor`, `sl-console`, and `sl-timings` over the page's runner, and the one owner of
  their models. It builds a `FileSet` from its fences, unless the page gives it one as its `files`
  property, an `EditorSettings` from its attributes, and a `ConsoleLog`, a `RunTimings`, and a
  `RunState` of its own; it is the only writer of each, and applies every request its parts send.
  It imports nothing from the runtime and fetches nothing: it reads `DemoRunner`, the runtime's
  `Runner`'s structural subset, `load`, `build`, `run`, `stop`, and `listen`, with the output,
  exit, and timing events re-declared (`DemoEvent`), and the page that passes it the runtime's
  `Runner` has TypeScript check the one against the other there
  (`new Runner() satisfies DemoRunner`). Go loads only on a Run.
  - Modes: with `handler` named, Run loads the scenario and calls that handler with the one file's
    text, editable; its answer, a string as it is or anything else as indented JSON, or its error,
    shows as the console's result block. With none, Run runs the prebuilt program's main: the
    fences are read-only, the file tabs show over the editor, a tabpanel they control, and the
    exit shows as the console's status line. With `source`, Run builds the files through the
    runner's `build`, every `.go` file as package main and every other file in the program's
    working directory (see "Runtime" for the program's limits), then runs its main as the program
    mode does, the status naming it `main`; the fences are editable.
    A failed build shows the compiler's or linker's output, its exit, and the error as the result
    block, and runs nothing. Each Run clears the console and begins the timings afresh; the
    toolbar's status says how it ended.
  - Runs on one runner: the runner runs one request at a time, a new one stopping the pending
    one. A demo takes the runner's events only while a request of its own is pending, from its
    load to its run's settling, so each console holds only its own demo's output, and a demo
    whose run another demo's Run stops records it as stopped. Stop stops the runner only while
    the demo's own run is pending.
  - Attributes: `scenario` (the Go scenario Run loads, required except on a source demo),
    `handler` (the handler Run calls; absent, Run runs the program's main), `source` (a boolean:
    Run builds the files and runs the built program's main; a source demo names no scenario and
    no handler), `editable-files` (a boolean: New file, Rename, and Delete on a program or source
    demo; a handler demo, holding its one input, ignores it), `wrap` (a boolean: long lines
    wrap), `tab-size` (a tab's width, 1 to 8 columns, 4 by default), `fixed` (a boolean: the
    fixed layout, below), `file` (the name of every fence that names none, as the SDK's
    highlighted Markdown fences can't; absent or empty, the defaults below), and `label` (the
    demo's accessible name, "<scenario> <handler> demo" by default, "Go source demo" on a source
    demo).
    A change to `handler`, `source`, or `file` rebuilds the files from the fences; `wrap` and
    `tab-size` change the settings in place; while an authoring error shows, a change to
    `scenario`, `wrap`, or `tab-size` builds the demo again, so a mended attribute mends it.
  - Properties: `runner`, a `DemoRunner`, the page's one runner, `null` by default, which runs
    nothing; `files`, a `FileSet` the page owns, `null` by default: given one, a program or source
    demo reads no fence and holds no set of its own, and editing, the file actions, Reset, and Run
    work on the set given; a handler demo refuses one as an authoring error. Giving another set,
    or taking it away, which builds the files from the fences again, is a switch: it stops the
    demo's pending run, recorded as stopped, and gives the demo a new console and timings, both
    empty; the editor settings and the run state stay, so the status still says how the last run
    ended, or "Stopped main" after a switch stopped it. `arrangement`, an `Arrangement`, the
    page's, which a fixed demo renders from and never writes, `null` by default, placing the
    editor left with no Layout menu; `problem`, read-only, the authoring error's reason, or
    `null`; and the attributes'.
  - Fences (its light DOM, no slot): each `pre` child of the host is one file, in order, its text
    the pre's text content, so marked's plain `<pre><code class="language-go">` and the SDK's
    Shiki-rendered `<pre class="shiki">` read alike. A file's name is the pre's or its code's
    `data-file`, else the pre's `title`, else the demo's `file`, unless empty, else a default
    from the fence's language, a `data-language` or a `language-<name>` class on either: `main.go`
    for go, `input.json` for json, `query.sql` for sql, `input.txt` for any other; with no
    language, as Shiki's markup carries none, `main.go` on a program or source demo and
    `input.json` on a handler demo. Each file's grammar follows its name's extension: `.go`,
    `.json`, or `.sql`, any other plain. The fences are read once the document has parsed them,
    and stay in the light DOM unchanged: before the element upgrades, and without script, they
    render as the page's code; once upgraded they are no part of the flat tree, neither rendered
    nor in the accessibility tree, and the editor alone shows their text.
  - Authoring errors: no scenario, a source demo naming a scenario or a handler, no fence, more
    than one fence on a handler demo, a name the file set refuses (two fences both defaulting to
    `main.go` among them), or a tab size the settings refuse. The demo shows "Authoring error:"
    and the reason, on the page's red mixed into its surface, describes its region with it,
    slots the fences back as written, and doesn't run.
  - Files: New file adds the file, selects it, and focuses the editor; Rename renames the active
    file, focus staying on Rename; Delete removes the active file, unless the last, and focuses
    the tab now active; Reset restores every file's text as given.
  - Events: `arrange`, a bubbling `CustomEvent` whose `detail.placement` is the placement the
    Layout menu chose. The page, which owns the arrangement, applies it; until then nothing
    changes. Its parts' other requests stop at it. Slots: none, but the fences above.
  - Accessibility: a region named by `label`, holding the toolbar, the tabs and their tabpanel on
    a program demo, the editor, named by the active file's name, the log, and the timings. A fixed
    demo below 44rem also holds the output tablist, "Output panel", its tabs "Output" and
    "Timings", each controlling its part, a tabpanel named by its tab while the tablist shows.
  - Keyboard: each part's own, in order: the toolbar, its Layout menu's included, the tabs on a
    program demo, the editor, a fixed demo's output tablist below 44rem, and the console. The output
    tablist's are the file tabs': Tab reaches the selected tab alone, Left and Right select the
    previous and the next, wrapping, and Home and End the first and the last. Ctrl or Cmd+Enter,
    from anywhere inside the demo, the editor included, runs it, as Run's `aria-keyshortcuts`
    declares; with Alt or Shift also held, Enter runs nothing. From outside every demo the shortcut
    runs none, and the foundation's shortcut registry holds no entry for it.
  - Layout: one column: the toolbar, the files, then the console and the timings. Once the demo
    is 44rem wide, the console and the timings share a row, the timings in a column of their
    table's least width, `sl-timings`'s `--sl-timings-min-inline-size`, read on the element, and
    the console taking the rest. Every part stays inside the demo at every width, and the demo fits
    a phone's width. Nothing moves.
  - Fixed layout: with `fixed`, the demo is as tall as the box its parent's layout gives it
    (`block-size: 100%`, as a grid row's stretch gives it), never below its floor; it reads no
    viewport or container block unit, runs no script to size itself, and needs no size
    container. The floor is the demo's own, stated once, in lines of the parts' own text: six of
    the editor's, enough to read and edit a few statements, and two of the console's log, enough
    to read a line of output and the exit line under it (`--sl-go-demo-editor-lines` and
    `--sl-go-demo-console-lines`, in `lh`), so it follows the type profile and zoom. The editor,
    the log, and the timings contain their size, so the floor, the demo's `min-content` height,
    is the toolbar, the tabs, and the gaps as each band lays them out, plus those lines, at the
    parts' shares: the least height at which both show their lines. The parts divide the
    demo's height in fractions, never in lengths, and each scrolls inside its own frame, so typing
    or pasting any number of lines, any output, and a full timings table change no part's box:
    the editor fills its frame, the console fills its own (`fill`), the timings scroll in theirs,
    and the toolbar's status is `steady`. Container queries on the demo's own width choose one
    of three bands:
    - Below 44rem: the toolbar, then the tabs over the editor, 3fr of what the toolbar leaves
      (about 60%), then, 2fr, one output panel whose tablist, "Output" and "Timings", shows the
      console or the timings, the console first.
    - From 44rem to 64rem: the editor, 3fr, over a row of the console and the timings' track,
      their least width, 2fr.
    - From 64rem: the placement the page's `Arrangement` holds, editor left without one. Editor
      left puts the editor, under the toolbar, in 3fr of the width, beside a 2fr column of the
      console, 3fr of the height, over the timings, 2fr; editor right mirrors it, the column
      first; editor top is the layout from 44rem. In this band alone, and only given an
      arrangement, the toolbar shows Layout, and the demo sends its choice on as `arrange`.

    Every band and arrangement places the same parts, so a run, a Stop, a failed build, a band
    change, or an arrangement change keeps each part's content and scroll position and the chosen
    output tab. Below 44rem the part not shown is hidden by `visibility`, so it keeps its own
    scroll position. A demo without `fixed` lays out as "Layout" describes.

    The bands are CSS's: each container query places the parts and names its band in `--band`,
    and the demo's script reads that name, through a `ResizeObserver` on a fixed demo alone, for
    two things only. Below 44rem the console and the timings are tabpanels of the output tablist,
    and from 44rem they aren't: a change to the accessibility tree, and CSS can't set a role. From
    64rem the toolbar shows its Layout group, which `sl-controls` renders only given an
    arrangement. The read exists because no shipped API reports a container query's state to
    script; every placement and size stays in the stylesheet.
- `./run-state.js`: `RunState`, a demo's run state, a model with no document or element, an
  `EventTarget` its owner, the page or the element composing the controls over a runner, is the
  only writer of. The owner starts a run as it asks its runner for one and finishes it as the
  runner's promise settles.
  - Reading: `pending`, whether a run is pending; `running`, what it runs, a scenario's or
    handler's name, or `null` when idle; `run`, the number of the pending run, or of the last, 0
    before the first; and `last`, how the last finished run ended, a frozen `{ what, outcome }`,
    or `null` before one has. An `Outcome` is `{ kind: "ok" }`, a handler's answer;
    `{ kind: "exit", code }`, a program's exit; `{ kind: "stopped" }`; or
    `{ kind: "failed", message }`, a handler's error or a failed load.
  - Operations: `start(what)` starts a run and returns its number; a run pending then is
    superseded, recorded as stopped, as the runner stops it. `finish(run, outcome)` finishes the
    run of the number and returns `true`; for any run but the pending one, as a superseded run
    whose promise settles after the next has begun, it changes nothing and returns `false`.
  - Refusals: an operation it can't apply throws, naming the reason, and changes nothing: a
    `TypeError` for a value of the wrong type, a `RangeError` for an empty what, an unknown kind,
    or an exit code that isn't whole. `whatProblem(value)` and `outcomeProblem(value)` give that
    reason, or `null`; `KINDS` lists the outcomes' kinds.
  - Events: one `change` `Event` for each start and each finish of the pending run; a finish that
    changes nothing sends none. The unit tier tests it under node.
- `./run-timings.js`: `RunTimings`, a run's timings, a model with no document or element, an
  `EventTarget` its owner, the page or the element composing the timings over a runner, is the
  only writer of. It takes the runtime's timing events as they are, their shapes re-declared
  (`Phase`, `TimingLike`), since the components tier imports nothing from the runtime.
  - Operations: `begin()` begins a new run, clearing the last's phases; `record({ phase, ms })`
    adds the phase's time to the current run, or replaces the time it has.
  - Reading: `phases`, the current run's phases as frozen snapshots, `{ phase, ms }`, only those
    recorded, in the runtime's phase order (`PHASES`: fetch, compile, go-compile, link,
    instantiate, start, call, run) whatever order they arrived in, the same array until the
    timings change; `total`, their sum in ms; `ms(phase)`; and `runs`, how many runs have
    begun, 0 before the first.
  - Refusals: a record it can't apply throws, naming the reason, and changes nothing: a
    `TypeError` for a phase that isn't a string or a time that isn't a number, a `RangeError` for
    a phase the runtime doesn't name or a time that is negative, NaN, or infinite.
    `phaseProblem(value)` and `msProblem(value)` give that reason, or `null`.
  - Events: one `change` `Event` for each operation that changes the timings: every `begin()`,
    and a record that adds a phase or changes its time; a record of the time a phase has sends
    none. The unit tier tests it under node.
- `./timings.js`: `sl-timings`, the last run's phases as a table: a row for each phase the run
  had, in phase order, its name and its time, and a total row. It labels WebAssembly's compile
  phase "Wasm compile", to tell it from a build's "Go compile" and "Link". It renders the
  `RunTimings` it is given, follows each change it sends, listening only to the timings it holds
  while it is in the document, and never writes them; a new run replaces the last as the timings
  do. Times are formatted by `Intl.NumberFormat` as ms, to a tenth while they round under 10 ms
  ("4.2 ms") and whole from there, grouped ("1,535 ms"), as `formatMs(ms)` gives them,
  right-aligned in tabular numerals; the total row is set apart by a heavier rule and weight.
  With no run yet the table says "No run yet.", and with a run begun and no phase timed, "No
  phase timed yet.", with no total. The table is as wide as its content, at least its least width
  or its container's width, and never wider than its container. Nothing moves.
  - Attributes: `label` (the table's caption and accessible name, "Timings" by default).
  - Custom properties: `--sl-timings-min-inline-size`, the table's least width, a length, `28ch`
    by default, in the ch of the table's text: room for a build's full table, "Wasm compile"
    beside "12,345 ms". It is stated once, on the element, where an owner laying the timings beside
    something else reads it for their track, as `sl-go-demo` does; a page may set it there.
  - Properties: `timings`, the `RunTimings` its owner creates and writes; `null`, the default,
    shows no run yet; and `label`, as its attribute.
  - Events: none. Slots: none.
  - Accessibility: a table named by its caption, "Phase" and "Time" its column headers, each
    phase's name and "Total" a row header.
  - Keyboard: none; the table holds nothing to operate.

## Keeping pace with the SDK

The SDK is pinned by its release tag, in `package.json` and in both workflows' `uses:` lines.
To move to a newer release, bump the tag in all three, run `pnpm install`, and run
`mise run check`.
