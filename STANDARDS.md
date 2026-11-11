# Standards

The judgement calls the check can't enforce, one line each, for the standards-reviewer. What
`mise run check` enforces is never restated here. The tasks write the conventions here; they stay
in this spike until experiment.html's intake.

The architecture pages that apply, in the architecture repository:

- `principles/minimal-footprint.md`
- `principles/rolling-currency.md`
- `principles/downward-dependencies.md`
- `principles/composition-root.md`
- `standards/go-elemental/principles/topology-and-naming.md`
- `standards/go-elemental/principles/dependencies.md`

## Layers

- `cmd/<scenario>` holds only the entrypoint; each `internal/<scenario>` is that scenario's
  composition root, composed on the bridge.
- A component takes properties and sends events, holds no service, and fetches nothing; the page
  passes go-demo its runner.
- A piece used by one scenario stays in that scenario; it moves down a layer only once a second
  scenario uses it unchanged.

## Go

- Workspace Go is consumed by published tag at the latest release when a task plans, never by a
  replace directive or a local path.
- No .wasm or stdlib archive is committed; the check and the Pages workflow build them.
- A copied file names its source and commit or tag in a provenance line, which reads
  `From|Adapted from <repo> (<commit>|<tag>): <path>`; `wasm_exec.js` names the pinned Go release.

## Editor

- The editor is `contenteditable="plaintext-only"` with Custom Highlight ranges, never an overlay
  on a textarea; Tab inserts through `execCommand("insertText")`, obsolete in the editing spec but
  the only insertion that keeps the browser's undo history.

## Sites

- A Markdown source stays Markdown; a live demo embeds as `<sl-go-demo>` wrapping an ordinary go
  fence, so the code reads before JavaScript runs.
- Every link and asset resolves under the site's `/<repo>/` base path.
- Go loads only when the reader starts a demo; a page is readable without it.

## Design

- spike-html-apps-foundation v0.3.0, through spike-html-hosting-sdk, is the visual baseline.
- Focus is always visible, motion honours reduced motion, and spacing comes from the
  foundation's tokens, never a literal.
- A UI task's session brief carries its screenshots per profile; the architect's acceptance is
  the design review.
