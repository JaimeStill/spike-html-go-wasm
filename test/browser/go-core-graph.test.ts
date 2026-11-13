// The rendered graph page, go-core-graph.html, which the SDK's markdownPages renders from the
// spike's own markdown/go-core-graph.md into markdown-shell.html, building and running
// playground/graph in the page: the build as Pages serves it, dist/ under the base by the SDK's
// served(), Vite's preview, in the pinned chrome-headless-shell, the worker's fetches read through
// CDP (go-demos.ts). The SDK's shell checks, palette check, and crawl run on it beside the other
// pages (site.test.ts); this file proves its demo.
//
// The page holds one source demo, written in the Markdown as raw HTML around an ordinary go fence,
// which markdownPages highlights at build: sl-go-demo marked source, naming its one file main.go,
// as the rendered markup carries no name; the editor opens on the fence's text, playground/graph's
// main.go with no final line break, as the SDK's Shiki markup renders none, in Go's grammar. The
// page requests no Go and starts no worker on load. The first Run fetches the manifest, the
// compiler, the linker, and only the program's closure of archives, go-core's graph and lifecycle
// among them, and prints the program's layer table and its lifecycle trace exactly, as its own go
// test holds them, with exit 0 and every phase of a build. An edit to main.go rebuilds and runs the
// edit, fetching the manifest alone; an edit making the store's constructor fail prints graph's message naming the node on one
// stderr line, with exit 1; and an edit adding a route that uses the server, which is ordered after
// every route, closes a cycle, which Build panics on: Go prints graph's message naming the cycle's
// path as the program's panic, on stderr, with exit 2.
//
// The cases run in order on one page, each pasting its main.go over the last. The program's cost,
// its cold and warm timings and its closure, is reported with the playground's programs'
// (playground-report.test.ts). The helpers are go-builds.ts's, go-demos.ts's, and
// playground-layouts.ts's. Every wait is bounded. Nothing here names the site: its base is
// package.json's name.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test, type TestContext } from "node:test";

import { launch, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import { programImports } from "../../web/runtime/build.ts";
import {
  archivesOf,
  build,
  BUILT_PHASES,
  DONE,
  timed,
  TOOLS,
  toolchainRequests,
} from "./go-builds.ts";
import { goRequests, open, type Shown, type Watched } from "./go-demos.ts";
import { paste, PLAYGROUND as DEMO } from "./playground-layouts.ts";

const root = join(import.meta.dirname, "../..");

/** playground/graph's main.go as the editor opens on it, with no final line break, as the SDK's
 * Shiki markup renders none. */
const MAIN = readFileSync(join(root, "playground/graph/main.go"), "utf8").replace(/\n$/, "");

/** The packages main.go imports, whose closure the first Run fetches. */
const IMPORTS = programImports([{ name: "main.go", text: MAIN }]);

/** What the program prints, every run, as its own go test holds it: the layer table, then each
 * participant's start in layer order and its stop in reverse. */
const OUTPUT = `0: settings, router
1: store
2: health, projects
3: server

start store: postgres://db/app
start server: :8080 GET /healthz, GET /projects
ready
stop server
stop store
`;

/** A Run's stdout, as the console shows it, one entry a line. */
const stdout = (text: string) =>
  text
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => ({ stream: "stdout", text: line }));

/** main.go with one replacement, which must apply. */
function edited(from: string, to: string): string {
  assert.ok(MAIN.includes(from), `main.go holds ${JSON.stringify(from)}`);
  return MAIN.replace(from, to);
}

/** The exit row of a main that exited with the code. */
const exited = (code: number) => ({ kind: "exit", text: `main exited with code ${code}` });

let server: Server;
let browser: Browser;
let watched: Watched;
let page: Page;

before(async () => {
  server = await served(root);
  browser = await launch();
  watched = await open(browser, server.origin, "go-core-graph.html");
  page = watched.page;
});
after(async () => {
  await page?.close();
  await browser?.close();
  await server?.stop();
});

/** Pastes main.go's text over the editor's, resolving once the editor holds it. */
async function pasteOver(text: string) {
  await paste(page, text, true);
  await until(page, `window.demos.editor(${DEMO}).value === ${JSON.stringify(text)}`, 2000);
}

/** Runs the edited main.go, a build within BUILD's bound, until its status says `finished`;
 * answers what it shows, having asserted it compiled and linked the edit, fetching the manifest
 * alone: no toolchain module and no archive the worker holds. */
async function rebuild(text: string, finished: string): Promise<Shown> {
  await pasteOver(text);
  const from = watched.requests.length;
  const shown = await build(page, DEMO, finished);
  assert.deepEqual(shown.phases, BUILT_PHASES, "compiled and linked");
  assert.deepEqual(toolchainRequests(watched, from), ["manifest.json"]);
  return shown;
}

describe("the graph page's source demo", () => {
  test("is the fence's main.go, named by the file attribute, in Go's grammar, and requests no Go on load", async () => {
    assert.deepEqual(
      await page.evaluate(`(() => {
        const demo = ${DEMO};
        const editor = window.demos.editor(demo);
        return [
          document.querySelectorAll("sl-go-demo").length,
          demo.source, demo.scenario, demo.handler,
          window.demos.tab(demo), editor.value, editor.language,
        ];
      })()`),
      [1, true, null, null, "main.go", MAIN, "go"],
    );
    assert.deepEqual(goRequests(watched), []);
    assert.deepEqual(watched.workers, []);
  });

  test("the first Run fetches the toolchain and the program's closure alone, go-core's graph and lifecycle among it, and prints the layer table and the lifecycle trace exactly, with exit 0", async (t: TestContext) => {
    const cold = await build(page, DEMO, DONE);
    t.diagnostic(`cold: ${timed(cold)}`);
    assert.deepEqual(cold.lines, stdout(OUTPUT));
    assert.deepEqual(cold.rows.at(-1), exited(0));
    assert.deepEqual(cold.phases, BUILT_PHASES);
    const fetched = toolchainRequests(watched);
    assert.equal(fetched[0], "manifest.json");
    const closure = archivesOf(IMPORTS);
    for (const pkg of ["graph", "lifecycle"]) {
      assert.ok(
        closure.some((archive) =>
          archive.startsWith(`mod/github.com/standards-lab/go-core/${pkg}.`),
        ),
        `go-core's ${pkg} archive is in the closure`,
      );
    }
    assert.deepEqual(
      fetched.slice(1).sort(),
      [...TOOLS, ...closure].sort(),
      "the toolchain and the program's closure, each once",
    );
    t.diagnostic(`closure: ${closure.length} archives`);
  });

  test("an edit to main.go rebuilds and runs the edit", async () => {
    const shown = await rebuild(edited(`Addr: ":8080"`, `Addr: ":9090"`), DONE);
    assert.deepEqual(
      shown.lines,
      stdout(OUTPUT.replace("start server: :8080", "start server: :9090")),
    );
    assert.deepEqual(shown.rows.at(-1), exited(0));
  });

  test("an edit making the store's constructor fail prints graph's message naming the node on one stderr line, with exit 1", async () => {
    const shown = await rebuild(
      edited(
        "return &Store{dsn: sc.Use(s.Settings).DSN}, nil",
        `return nil, fmt.Errorf("connection refused")`,
      ),
      "Finished main, exit code 1",
    );
    assert.deepEqual(shown.lines, [{ stream: "stderr", text: "store: connection refused" }]);
    assert.deepEqual(shown.rows.at(-1), exited(1));
  });

  test("an edit adding a route that uses the server closes a cycle: Build panics with graph's message naming its path, exit 2", async () => {
    const shown = await rebuild(
      edited(
        "\treturn g, s\n}",
        `\tg.Define("status", func(sc *graph.Scope) (string, error) {
		sc.Use(s.Server)
		return "GET /status", nil
	}, graph.In(s.Routes))
	return g, s
}`,
      ),
      "Finished main, exit code 2",
    );
    assert.ok(
      shown.lines.every(({ stream }) => stream === "stderr"),
      "nothing on stdout: the panic comes before any output",
    );
    const panic = shown.lines.map(({ text }) => text).join("\n");
    assert.ok(
      panic.startsWith("panic: graph: dependency cycle: server -> routes -> status -> server"),
      JSON.stringify(panic.slice(0, 160)),
    );
    assert.deepEqual(shown.rows.at(-1), exited(2));
  });
});
