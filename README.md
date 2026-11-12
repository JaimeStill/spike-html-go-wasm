<!-- Adapted from spike-html-hosting-sdk (v0.6.2): template/README.md, its site a hand index with
     no copied tree. -->

# spike-html-go-wasm

The GitHub Pages site of spike-html-go-wasm, made from the template of
[spike-html-hosting-sdk](https://github.com/JaimeStill/spike-html-hosting-sdk) v0.6.2. Its index,
`index.html`, is a hand page served under `/spike-html-go-wasm/`, beside one more hand page,
`components.html`, the components page, which shows each component in `web/components/` in each
of its states; its Go demos run Go through the runtime in `web/runtime/`. The site copies no
Markdown tree: `content.json` records none, and `content/` holds nothing. The spike's question,
evidence, and path are in `context/README.md`.

## Tasks

- `mise run install`: install the pinned tools, node_modules, and go.mod's requirements; reads
  the network.
- `mise run check`: run every check, reading no network. It lints with ESLint (the web tiers'
  import direction, and the check that the build left no CSS module script), Prettier,
  shellcheck, and actionlint. It lints the Go module under `GOOS=js GOARCH=wasm` and fails unless
  `web/runtime/wasm_exec.js` matches the pinned Go's copy and no `.wasm` or `.a` archive is
  tracked. It runs the Go tests as wasm under node twice: on node's fs, and on the runtime's
  in-memory fs, where `test/memfs` drives it through package `os`. It type-checks the configs,
  the web tiers, and the suite with tsc and runs `mise run build`.
  - The unit tier checks `content/` against `content.json`, both layer directions, go.mod's
    by-tag rule, the currency and live commands' logic, the in-memory fs's error codes, and the
    playground's toolchain: each file its manifest names under its content's hash, and its import
    closure equal to Go's own `go list -deps`; and the build steps, Go's compiler and linker
    compiling and linking a program over that toolchain on the in-memory fs: hello built and run,
    a compile error and a package clause other than main as the compiler writes them, an import
    the manifest lacks refused before the compiler runs, and a non-Go file read from the run's
    working directory. It tests the components' five models
    (`EditorSettings`, `FileSet`, `ConsoleLog`, `RunTimings`, and `RunState`): their operations,
    refusals, and change events. It holds each program demo's go fence on the components page to
    its scenario's source, byte for byte. It fails if a module under `web/components` or
    `web/pages` registers a page shortcut through the foundation's `keys.js`.
  - The browser tier, in the pinned chrome-headless-shell, runs the SDK's checks on every hand page
    and the crawl, and proves each component on the components page:
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
      return, the status's transitions, target sizes, the glyphs alone and the groups whole at a
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
      printing to stderr and exiting 2.
- `mise run build`: build the site with Vite into `dist/`, the runtime's worker with
  `web/runtime/wasm_exec.js` bundled in it and the editor's syntax themes merged per palette
  (`scripts/syntax-themes.ts`), then the Go entrypoints into `dist/go/`, and the playground's
  toolchain into `dist/go/toolchain/` (`scripts/build-toolchain.ts`): Go's compiler and linker
  built for `GOOS=js`, an archive for each standard-library package, and `manifest.json`, the one
  file that names them, each by its content's hash. A bare `vite build` omits the wasm.
- `mise run screenshots`: capture the pages, light and dark: the index at the SDK's widths,
  390px, 1120px, and 1376px, and each component on the components page alone at each of them,
  `--page components/<component>`, as `--page components/console`. `--width <px>`, one of the
  three, captures that width alone, the index's and each component's, as
  `mise run screenshots --page components/controls --width 390`; any other width is a usage
  error naming them. `scripts/screenshots.ts` takes `--width`, which the capture bin doesn't
  know, and hands it to the capture file.
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
`components.html` shows each component's states once, labelled, its layout following the
viewport, and focused by the keyboard. The directory's other modules are the components' internals, each documented in its own
comments: `aria.ts`, `highlights.ts`, `reasons.ts`, `subscription.ts`, `syntax-themes.ts`, and
`tokenizer.ts`.

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
  Long lines scroll sideways inside the frame by default, one row a line, the gutter held in place
  beside them, and wrap when its settings say so; either way each number stays beside its line's
  first row at every width and profile. The gutter is hidden from assistive technology and holds
  no text: its numbers are generated content, outside the editable element. The editor grows
  with its text; a page that holds it to a block size gets a frame that scrolls inside. Its
  editing keys make each edit through `document.execCommand`, a line break as `insertLineBreak`
  and the rest as `insertText`, so each is one step of the browser's own undo history. A paste
  takes the clipboard's plain text through the same path, and a drop is refused.
  - Attributes: `language` (`go` or `json`; any other shows plain; reflected), `label` (the
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
  - Attributes: `label` (the log's accessible name, "Output" by default).
  - Properties: `log`, the `ConsoleLog` its owner creates and writes; `null`, the default, shows
    the empty state; and `label`, as its attribute.
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
- `./controls.js`: `sl-controls`, a demo's controls as one ARIA toolbar: a Run group (Run, Stop,
  and Reset) and, under `editable-files`, a vertical separator and a Files group (New file,
  Rename, and Delete). Each control is a glyph button named by its name, which shows beside its
  glyph while the toolbar is 26rem wide or wider, where the widest group fits with its names in
  any font; narrower, the glyph shows alone and the name as a hint on hover and keyboard focus,
  as the console's Copy and Clear show theirs. It renders the `FileSet`
  and the `RunState` it is given, follows each change they send, listening only to the models it
  holds while it is in the document, and never writes either: every control sends a request its
  owner applies. Run is always available, as a new run stops the pending one; Stop only while a
  run is pending; Reset only while a file differs from its text as given; New file and Rename
  always; Delete unless the set refuses to remove the active file, the last one. An unavailable
  control is `aria-disabled`, focusable, and sends nothing. New file and Rename each open a form
  in a popover, a non-modal dialog anchored below its button: a labelled input and a submit,
  Create or Rename. Rename's input holds the active file's name, its stem, the name before its
  extension, selected. On submit the name is checked by the set's `nameProblem`; a refused name
  leaves the form open, the input `aria-invalid` and described by the set's reason in a polite
  live region, and from then on the reason follows the name as it is typed. A taken name closes
  the form, returns focus to its button, and sends the request; a rename to the file's own name
  sends nothing. Escape closes the form, sends nothing, and returns focus to its button. Delete
  asks for no confirmation. The status, a polite live region beside the toolbar, says each run's
  start, "Running hello…", and its end, "Finished format", "Finished hello, exit code 0",
  "Stopped spin", or "Failed format: <message>", from the run state's transitions alone: the
  state the toolbar is given is never said, nor a change of the files. The toolbar wraps between
  its groups, each group's controls together. Nothing moves.
  - Attributes: `editable-files` (a boolean: show the Files group) and `label` (the toolbar's
    accessible name, "Controls" by default).
  - Properties: `files`, the `FileSet` its owner creates and writes, `null` by default, leaving
    Reset unavailable and the Files group out; `runState`, the `RunState` its owner creates and
    writes, `null` by default, leaving Stop unavailable; and `editableFiles` and `label`, as their
    attributes.
  - Events, each bubbling and not composed, a request that changes nothing until the owner applies
    it: `run`, `stop`, and `reset` (`Event`s); `new` (a `CustomEvent`, `detail.name`, the new
    file's name), `rename` (`detail.from` and `detail.to`), and `delete` (`detail.name`, the
    active file's). The owner applies them as `runState.start(what)` with its runner's run,
    `runState.finish(run, { kind: "stopped" })` with its runner's stop, `files.resetAll()`,
    `files.add(name)`, `files.rename(from, to)`, and `files.remove(name)`.
  - Slots: none.
  - Keyboard: Tab reaches the toolbar's one tab stop, the control last focused, Run at first, a
    roving tabindex. Left and Right move to the previous and next control, wrapping, and Home and
    End to the first and the last, unavailable controls included. Enter and Space press the
    focused control. Run declares `aria-keyshortcuts="Control+Enter Meta+Enter"`, the shortcut
    the demo composing it handles from inside itself. In a form, Enter submits and Escape closes
    it, each returning focus to the control that opened it; the form closes on Escape's keydown,
    so focus is back on the control before the page's keys see it.
- `./editor-settings.js`: `EditorSettings`, the code editor's settings, a model with no document
  or element, an `EventTarget` its owner writes: `wrap` (a boolean, `false` by default: long lines
  scroll sideways) and `tabSize` (a whole number from 1 to 8, 4 by default, how many columns a tab
  shows). `new EditorSettings({ wrap, tabSize })` starts from the defaults. A value it can't hold
  is refused, a `TypeError` or `RangeError` naming the reason, and changes nothing;
  `tabSizeProblem(value)` and `wrapProblem(value)` give that reason, or `null`, without setting
  anything, and `defaults` holds the defaults, frozen. Each set that changes a value sends one
  `change` `Event`; a set to the value held sends none. The unit tier tests it under node.
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
  check-circle, x-circle, play, square-fill, undo, file-added, and pencil from the icons layer,
  written out as Lit templates with the same paths: the build fills the icons layer into a page's
  own markup, and no tier imports it.
- `./go-demo.js`: `sl-go-demo`, live Go: the element composing `sl-controls`, `sl-file-tabs`,
  `sl-code-editor`, `sl-console`, and `sl-timings` over the page's runner, and the one owner of
  their models. It builds a `FileSet` from its fences, an `EditorSettings` from its attributes,
  and a `ConsoleLog`, a `RunTimings`, and a `RunState` of its own; it is the only writer of each,
  and applies every request its parts send. It imports nothing from the runtime and fetches
  nothing: it reads `DemoRunner`, the runtime's `Runner`'s structural subset, `load`, `run`,
  `stop`, and `listen`, with the output, exit, and timing events re-declared (`DemoEvent`), and
  the page that passes it the runtime's `Runner` has TypeScript check the one against the other
  there (`new Runner() satisfies DemoRunner`). Go loads only on a Run.
  - Modes: with `handler` named, Run loads the scenario and calls that handler with the one file's
    text, editable; its answer, a string as it is or anything else as indented JSON, or its error,
    shows as the console's result block. With none, Run runs the prebuilt program's main: the
    fences are read-only, the file tabs show over the editor, a tabpanel they control, and the
    exit shows as the console's status line. Each Run clears the console and begins the timings
    afresh; the toolbar's status says how it ended.
  - Runs on one runner: the runner runs one request at a time, a new one stopping the pending
    one. A demo takes the runner's events only while a request of its own is pending, from its
    load to its run's settling, so each console holds only its own demo's output, and a demo
    whose run another demo's Run stops records it as stopped. Stop stops the runner only while
    the demo's own run is pending.
  - Attributes: `scenario` (required: the Go scenario Run loads), `handler` (the handler Run
    calls; absent, Run runs the program's main), `editable-files` (a boolean: New file, Rename,
    and Delete on a program demo; a handler demo, holding its one input, ignores it), `wrap` (a
    boolean: long lines wrap), `tab-size` (a tab's width, 1 to 8 columns, 4 by default), and
    `label` (the demo's accessible name, "<scenario> <handler> demo" by default). A change to
    `handler` rebuilds the files from the fences; `wrap` and `tab-size` change the settings in
    place; while an authoring error shows, a change to `scenario`, `wrap`, or `tab-size` builds
    the demo again, so a mended attribute mends it.
  - Properties: `runner`, a `DemoRunner`, the page's one runner, `null` by default, which runs
    nothing; `problem`, read-only, the authoring error's reason, or `null`; and the attributes'.
  - Fences (its light DOM, no slot): each `pre` child of the host is one file, in order, its text
    the pre's text content, so marked's plain `<pre><code class="language-go">` and the SDK's
    Shiki-rendered `<pre class="shiki">` read alike. A file's name is the pre's or its code's
    `data-file`, else the pre's `title`, else a default from the fence's language, a
    `data-language` or a `language-<name>` class on either: `main.go` for go, `input.json` for
    json, `input.txt` for any other; with no language, as Shiki's markup carries none, `main.go`
    on a program demo and `input.json` on a handler demo. Each file's grammar follows its name's
    extension. The fences are read once the document has parsed them, and stay in the light DOM
    unchanged: before the element upgrades, and without script, they render as the page's code;
    once upgraded they are no part of the flat tree, neither rendered nor in the accessibility
    tree, and the editor alone shows their text.
  - Authoring errors: no scenario, no fence, more than one fence on a handler demo, a name the
    file set refuses (two fences both defaulting to `main.go` among them), or a tab size the
    settings refuse. The demo shows "Authoring error:" and the reason, on the page's red mixed
    into its surface, describes its region with it, slots the fences back as written, and
    doesn't run.
  - Files: New file adds the file, selects it, and focuses the editor; Rename renames the active
    file, focus staying on Rename; Delete removes the active file, unless the last, and focuses
    the tab now active; Reset restores every file's text as given.
  - Events: none of its own; its parts' requests stop at it. Slots: none, but the fences above.
  - Accessibility: a region named by `label`, holding the toolbar, the tabs and their tabpanel on
    a program demo, the editor, named by the active file's name, the log, and the timings.
  - Keyboard: each part's own, in order: the toolbar, the tabs on a program demo, the editor, and
    the console. Ctrl or Cmd+Enter, from anywhere inside the demo, the editor included, runs it,
    as Run's `aria-keyshortcuts` declares; with Alt or Shift also held, Enter runs nothing. From
    outside every demo the shortcut runs none, and the foundation's shortcut registry holds no
    entry for it.
  - Layout: one column: the toolbar, the files, then the console and the timings. Once the demo
    is 44rem wide, the console and the timings share a row, the timings in a 16rem column and the
    console taking the rest. Every part stays inside the demo at every width, and the demo fits a
    phone's width. Nothing moves.
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
    recorded, in the runtime's phase order (`PHASES`: fetch, compile, instantiate, start, call,
    run) whatever order they arrived in, the same array until the timings change; `total`, their
    sum in ms; `ms(phase)`; and `runs`, how many runs have begun, 0 before the first.
  - Refusals: a record it can't apply throws, naming the reason, and changes nothing: a
    `TypeError` for a phase that isn't a string or a time that isn't a number, a `RangeError` for
    a phase the runtime doesn't name or a time that is negative, NaN, or infinite.
    `phaseProblem(value)` and `msProblem(value)` give that reason, or `null`.
  - Events: one `change` `Event` for each operation that changes the timings: every `begin()`,
    and a record that adds a phase or changes its time; a record of the time a phase has sends
    none. The unit tier tests it under node.
- `./timings.js`: `sl-timings`, the last run's phases as a table: a row for each phase the run
  had, in phase order, its name and its time, and a total row. It renders the `RunTimings` it is
  given, follows each change it sends, listening only to the timings it holds while it is in the
  document, and never writes them; a new run replaces the last as the timings do. Times are
  formatted by `Intl.NumberFormat` as ms, to a tenth while they round under 10 ms ("4.2 ms") and
  whole from there, grouped ("1,535 ms"), as `formatMs(ms)` gives them, right-aligned in tabular
  numerals; the total row is set apart by a heavier rule and weight. With no run yet the table
  says "No run yet.", and with a run begun and no phase timed, "No phase timed yet.", with no
  total. The table is as wide as its content, at least 16rem or its container's width, and never
  wider than its container. Nothing moves.
  - Attributes: `label` (the table's caption and accessible name, "Timings" by default).
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
