// The rendered Markdown page, sqlate-compile.html, which the SDK's markdownPages renders from the
// spike's own markdown/sqlate-compile.md into markdown-shell.html: the build as Pages serves it,
// dist/ under the base by the SDK's served(), Vite's preview, in the pinned chrome-headless-shell,
// the worker's fetches read through CDP (go-demos.ts). The SDK's shell checks and crawl run on it
// beside the hand pages' (site.test.ts); this file proves its demo.
//
// The page holds one handler demo, written in the Markdown as raw HTML around an ordinary sql
// fence, which markdownPages highlights at build: sl-go-demo naming the sqlate scenario, its
// compile handler, and its file, statement.sql, which names the fence, as the rendered markup
// carries no name; the editor opens on the fence's text in SQL's grammar. The page requests no Go
// and starts no worker on load. The first Run fetches the worker and go/sqlate.wasm alone, and
// answers the statement's $n SQL with the line naming its tier and parameters, through every phase
// of a cold load. An edit recompiling calls the instance already held, fetching nothing, and
// answers the edited statement; a statement sqlate refuses answers sqlate's own message as the
// console's error block, and the instance outlives it.
//
// Then the report, never a gate, as the test's diagnostics: go/sqlate.wasm's bytes as built and
// gzipped here, by node's zlib at its default level, as Vite's preview serves them raw, and the
// cold Run's phase timings as the demo's timings show them. Every wait is bounded. Nothing here
// names the site: its base is package.json's name.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { gzipSync } from "node:zlib";

import { launch } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

import { goRequests, open, pressControl, run, says, shown, type Watched } from "./go-demos.ts";

const root = join(import.meta.dirname, "../..");

/** The page's one demo, as an expression. */
const DEMO = `document.querySelector("sl-go-demo")`;

/** The statement the page's fence holds, as markdown/sqlate-compile.md writes it, with no final
 * line break, as the SDK's Shiki markup renders none. */
const STATEMENT = readFileSync(join(root, "markdown/sqlate-compile.md"), "utf8").match(
  /<sl-go-demo [^>]*>\n\n```sql\n([\s\S]*?)\n```\n\n<\/sl-go-demo>/,
)?.[1];

/** The fence's statement compiled: its SQL and the line naming its tier and parameters. */
const COMPILED = "INSERT INTO project (code, name)\nVALUES ($1, $2)\nRETURNING id, version";
const LINE = "compile: native, parameters $1 code, $2 name";

/** The phases of a handler's first call, a cold load of its scenario. */
const COLD = ["Fetch", "Wasm compile", "Instantiate", "Start", "Call"];

let server: Server;
let browser: Browser;
let watched: Watched;
let page: Page;

before(async () => {
  server = await served(root);
  browser = await launch();
  watched = await open(browser, server.origin, "sqlate-compile.html");
  page = watched.page;
});
after(async () => {
  await page?.close();
  await browser?.close();
  await server?.stop();
});

/** Pastes text over the editor's whole text, as a reader selects all and pastes: the editor's
 * own paste, which keeps line breaks as text, where typing a line break splits the text. */
const pasteOver = (text: string) =>
  page.evaluate(`(() => {
    const text = window.demos.editor(${DEMO}).shadowRoot.querySelector(".text");
    text.focus();
    getSelection().selectAllChildren(text);
    const data = new DataTransfer();
    data.setData("text/plain", ${JSON.stringify(text)});
    text.dispatchEvent(new ClipboardEvent("paste", {
      clipboardData: data, bubbles: true, cancelable: true, composed: true,
    }));
  })()`);

describe("the Markdown page's compile demo", () => {
  test("is the fence's statement, named statement.sql by the file attribute, in SQL's grammar", async () => {
    assert.ok(STATEMENT, "markdown/sqlate-compile.md holds the demo's sql fence");
    assert.deepEqual(
      await page.evaluate(`(() => {
        const demo = ${DEMO};
        const editor = window.demos.editor(demo);
        return [
          document.querySelectorAll("sl-go-demo").length,
          demo.scenario, demo.handler, demo.getAttribute("file"),
          editor.value, editor.label, editor.language,
        ];
      })()`),
      [1, "sqlate", "compile", "statement.sql", STATEMENT, "statement.sql", "sql"],
    );
  });

  test("requests no Go and starts no worker on load", () => {
    assert.deepEqual(goRequests(watched), []);
    assert.deepEqual(watched.workers, []);
  });

  // Reported once the first Run has measured it.
  let cold: Awaited<ReturnType<typeof shown>> | undefined;

  test("the first Run fetches go/sqlate.wasm and answers the statement's SQL, printing its tier and parameters", async () => {
    cold = await run(page, DEMO, "Finished compile");
    assert.deepEqual(goRequests(watched), ["assets/worker.js", "go/sqlate.wasm"]);
    assert.deepEqual(cold.lines, [{ stream: "stdout", text: LINE }]);
    assert.deepEqual(cold.result, { ok: true, text: COMPILED });
    assert.deepEqual(cold.phases, COLD);
  });

  test("an edit recompiles on the instance held, fetching nothing", async () => {
    const requested = watched.requests.length;
    await pasteOver(
      "--| tier: standard\nUPDATE project\nSET name = {{name}}, {{> sql.guard_set}}\n" +
        "WHERE {{> sql.guard_where}}",
    );
    const edited = await run(page, DEMO, "Finished compile");
    assert.deepEqual(watched.requests.slice(requested), []);
    assert.deepEqual(edited.lines, [
      { stream: "stdout", text: "compile: standard, parameters $1 name, $2 id, $3 version" },
    ]);
    assert.deepEqual(edited.result, {
      ok: true,
      text:
        "UPDATE project\nSET name = $1, updated_at = CURRENT_TIMESTAMP, version = version + 1\n" +
        "WHERE id = $2 AND version = $3",
    });
    assert.deepEqual(edited.phases, ["Call"]);
  });

  test("a statement sqlate refuses answers sqlate's message, and the instance outlives it", async () => {
    // The fence's create, its header a standard tier's: a native pattern included in a standard
    // statement.
    await pasteOver(
      STATEMENT!.replace(/^--\| tier: native\n--\| native: .*\n/, "--| tier: standard\n"),
    );
    const message =
      'query: statement.sql: include of native pattern "app.identity" in a standard-tier statement';
    await pressControl(page, DEMO, "run");
    await says(page, DEMO, `Failed compile: ${message}`);
    const refused = await shown(page, DEMO);
    assert.deepEqual(refused.rows, [{ kind: "result", text: `Error ${message}` }]);

    // Reset restores the fence, which the same instance compiles again.
    await pressControl(page, DEMO, "reset");
    const again = await run(page, DEMO, "Finished compile");
    assert.deepEqual(again.result, { ok: true, text: COMPILED });
    assert.deepEqual(again.phases, ["Call"]);
    assert.deepEqual(goRequests(watched), ["assets/worker.js", "go/sqlate.wasm"]);
  });

  test("reports the scenario's bytes, raw and gzip, and the cold Run's phase timings", (t) => {
    const wasm = readFileSync(join(root, "dist/go/sqlate.wasm"));
    const bytes = (count: number) => count.toLocaleString("en-US");
    t.diagnostic(
      `go/sqlate.wasm: ${bytes(wasm.length)} bytes, ${bytes(gzipSync(wasm).length)} gzip bytes by node's zlib`,
    );
    if (cold) {
      t.diagnostic(
        `cold Run, ms: ${cold.phases.map((phase, i) => `${phase} ${cold!.times[i]}`).join(", ")}`,
      );
    }
  });
});
