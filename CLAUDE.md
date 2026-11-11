# spike-html-go-wasm

A spike for the Standards Lab reference architecture. It settles whether a page can run workspace
Go live in the browser through `GOOS=js` WebAssembly: library demos, service handlers called
in-process, and a Go playground that compiles arbitrary Go in the page. The repository is managed
with the marathon workflow; start from `context/README.md`.

- **Standards:** `STANDARDS.md`, with pointers into the architecture repository.
- **Check:** `mise run check`: the lints, types, Go and site builds, and unit and browser tiers;
  `README.md`, "Tasks", lists what each covers.
- **Currency:** `mise run currency`: every pin behind its latest, go.mod's requirements included.
- **Layout:** one repository in Elemental layers, Go and web; `context/README.md`, "Capabilities",
  names each layer, and `eslint.config.js` and `test/unit/go-module.ts` hold what each may import.
- **Goals:** this spike's tasks live in the coordinator's roadmap,
  `standards-lab/context/roadmap.toml`, under `experiment.html.spike-html-go-wasm`. Its goal
  record is `context/goals/experiment.html.spike-html-go-wasm.md`.
- **References:** the repositories this spike reads are listed in `context/README.md`. The spike
  reads them and never writes to them.
