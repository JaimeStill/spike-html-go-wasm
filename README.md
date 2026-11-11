<!-- Adapted from spike-html-hosting-sdk (v0.6.2): template/README.md, its site a hand index with
     no copied tree. -->

# spike-html-go-wasm

The GitHub Pages site of spike-html-go-wasm, made from the template of
[spike-html-hosting-sdk](https://github.com/JaimeStill/spike-html-hosting-sdk) v0.6.2. Its index,
`index.html`, is a hand page served under `/spike-html-go-wasm/`, beside two more hand pages:
`runtime.html`, which runs Go through the runtime in `web/runtime/`, and `components.html`, the
components page, which shows the components in `web/components/` in each of their states. The site copies no Markdown
tree: `content.json` records none, and `content/` holds nothing. The spike's question, evidence,
and path are in `context/README.md`.

## Tasks

- `mise run install`: install the pinned tools, node_modules, and go.mod's requirements; reads
  the network.
- `mise run check`: run every check, reading no network. It lints with ESLint (the web tiers'
  import direction, and the check that the build left no CSS module script), Prettier,
  shellcheck, and actionlint. It lints the Go module under `GOOS=js GOARCH=wasm` and fails unless
  `web/runtime/wasm_exec.js` matches the pinned Go's copy and no `.wasm` is tracked. It runs the
  Go tests as wasm under node twice: on node's fs, and on the runtime's in-memory fs, where
  `test/memfs` drives it through package `os`. It type-checks the configs, the web tiers, and the
  suite with tsc and runs `mise run build`. The unit tier checks `content/` against
  `content.json`, both layer directions, go.mod's by-tag rule, the currency and live commands'
  logic, and the in-memory fs's error codes. The browser tier, in the pinned
  chrome-headless-shell, runs the SDK's checks on every hand page and the crawl, runs hello
  and the probe's handlers on the runtime page, and holds the code editor on the components
  page: its colors to the SDK's fences in every palette and scheme, its accessibility tree, its
  gutter, and its loading; and the file tabs there: their accessibility tree, keyboard, control
  by the page's file set, modified marker, overflow, and subscription. The unit tier also holds
  the file set's operations, refusals, and change events. It proves that Stop ends the probe's spin and the
  next call fetches nothing new, and that the probe's crash, a panic outside any handler, prints
  to stderr and exits 2.
- `mise run build`: build the site with Vite into `dist/`, the runtime's worker with
  `web/runtime/wasm_exec.js` bundled in it and the editor's syntax themes merged per palette
  (`scripts/syntax-themes.ts`), then the Go entrypoints into `dist/go/`. A bare `vite build`
  omits the wasm.
- `mise run screenshots`: capture the pages, light and dark: the index and the runtime page at
  390px, 1120px, and 1376px, and each component on the components page alone at 1280px,
  `--page components/<component>`, as `--page components/console`.
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
`components.html` shows each component's states, labelled, again at 20rem, and focused by the
keyboard.

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
  first row at every width and profile. The gutter is hidden from assistive technology and holds no text: its numbers are generated
  content, outside the editable element. The editor grows with its text; a page that holds it to
  a block size gets a frame that scrolls inside. Its editing keys make each edit through
  `document.execCommand`, a line break as `insertLineBreak` and the rest as `insertText`, so each
  is one step of the browser's own undo history. A paste takes the clipboard's plain text through
  the same path, and a drop is refused.
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
  "name, modified"; a read-only file's is described as read-only. When the tabs overflow their
  row, it scrolls sideways inside itself, never the page, bringing the tab focus reaches, and the
  active tab as it changes, into view; it scrolls smoothly only when the reader allows motion.
  - Attributes: `label` (the tablist's accessible name, "Files" by default) and `panel` (the id,
    in the host's tree, of the panel each tab controls, set on each tab across the shadow root as
    an element reference, `ariaControlsElements`).
  - Properties: `files`, the `FileSet` its owner creates and writes; `null`, the default, shows
    no tablist; and `label` and `panel`, as their attributes.
  - Events: `select`, a `CustomEvent` whose `detail.name` names the file, bubbling and not
    composed, when a tab other than the selected one is clicked or reached by the keyboard. The
    owner applies it with `files.select(detail.name)`.
  - Slots: none.
  - Keyboard: Tab reaches the selected tab alone, a roving tabindex. Left and Right move focus to
    the previous and the next tab, wrapping at either end, and Home and End to the first and the
    last, each requesting that tab's selection: activation follows focus. Enter, Space, and a
    click request the focused tab's selection.
- `./glyphs.js`: the glyphs the components draw in their shadow roots, Octicons' copy, trash,
  check-circle, and x-circle from the icons layer, written out as Lit templates with the same
  paths: the build fills the icons layer into a page's own markup, and no tier imports it.

## Keeping pace with the SDK

The SDK is pinned by its release tag, in `package.json` and in both workflows' `uses:` lines.
To move to a newer release, bump the tag in all three, run `pnpm install`, and run
`mise run check`.
