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
4. Each module's raw, gzip-as-Pages-serves, and brotli-11 bytes, with a TinyGo comparison build.
5. Cold-load cost on the live site: the page readable before the module, time to first result
   after the click, and cold, cached, and in-place-switch timings.
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

## Capabilities

One repository, one Go module, one Pages site, in Elemental layers; dependencies flow downward.

- **Go bridge** (`bridge/`, infrastructure): the Go-to-JS bridge every scenario composes on.
- **Scenarios** (`internal/<scenario>`, composition roots; `cmd/<scenario>`, entrypoints, one
  wasm each): sqlate, go-core graph, and go-web-sdk handlers in-process.
- **Runtime** (`web/runtime`, the SDK tier): the on-demand loader, one worker per page over the
  HTTP cache, the in-memory filesystem, Stop by terminating the worker, and `wasm_exec.js`.
- **Playground**: `cmd/compile` and `cmd/link` built to wasm and run in the worker, with
  per-package standard-library and workspace archives fetched per import through a manifest.
- **Components** (`web/components`, the component tier, Lit, `sl-` prefix): sl-code-editor,
  sl-file-tabs, sl-console, sl-run-controls, sl-timings, and sl-go-demo composing them over a
  runner the page passes in.
- **Pages** (the apps tier): hand pages and rendered Markdown, embedding `<sl-go-demo>` around
  a go fence.

## Path

The tasks, in the order they run; each cites the evidence it proves.

1. `site`: the repository scaffolded from spike-html-hosting-sdk, the layout and both direction
   checks, Go built for `GOOS=js`, deployed by Pages (evidence 1, 6).
2. `runtime`: the Go bridge, the loader, the worker, the in-memory filesystem, and Stop
   (evidence 6, 11).
3. `components`: the six elements and a specimen page (evidence 11).
4. `playground`: the toolchain, the archives and manifest, and the playground page (evidence 9).
5. `programs`: the four programs, run from source in the playground (evidence 12).
6. `sqlate`: the compile demo and the in-process sqltest run, on a hand page and a Markdown page
   (evidence 2, 3, 11).
7. `scenarios`: the go-core graph and go-web-sdk demos (evidence 10).
8. `measure`: sizes, the TinyGo comparison, and timings on the live site (evidence 4, 5).
9. `review`: the screenshot review (evidence 7).
10. `answer`: the verdict (evidence 8).

## References

The spike reads these repositories and never writes to them. Each is a key in the coordinator's
`references.toml`, with its local checkout in `references.local.toml`:

- `sqlate`, `go-core`, and `go-web-sdk`: the demos' Go, each at its latest release when a task
  plans; graph-ergonomics is updating the Go stack.
- `spike-html-hosting-sdk` at v0.6.1, `spike-html-hosting-components` at v0.5.0, and
  `spike-html-hosting-icons` at v0.1.0: the site scaffold, shell, and Shiki 4.6.0 themes.
- `spike-html-apps-foundation` at v0.3.0, through the SDK: the visual baseline.
- `spike-html-apps-tooling` at v0.3.0: the screenshot review.
- `spike-html-hosting` at 421254d: the cost command.
- `spike-html-apps` at dae9a77: the ESLint boundaries table.

## The answer

Pending: the `answer` task writes it.
