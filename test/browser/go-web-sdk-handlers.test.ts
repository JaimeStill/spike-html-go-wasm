// The rendered Markdown page, go-web-sdk-handlers.html, which the SDK's markdownPages renders from
// the spike's own markdown/go-web-sdk-handlers.md into markdown-shell.html: the build as Pages
// serves it, dist/ under the base by the SDK's served(), Vite's preview, in the pinned
// chrome-headless-shell, the worker's fetches read through CDP (go-demos.ts). The SDK's shell
// checks, palette check, and crawl run on it beside the other pages' (site.test.ts); this file
// proves its demo.
//
// The page holds one handler demo, written in the Markdown as raw HTML around an ordinary fence
// naming no language: sl-go-demo naming the websdk scenario, its request handler, and its file,
// request.http, which names the fence, as the rendered markup carries no name. The build leaves
// the fence plain, marked's own <pre><code> with no class and no token span, as Shiki highlights
// only a labelled fence (the page's prose fences are http, highlighted); the editor has no grammar
// for .http, so the request shows plain before the demo upgrades and after. The page requests no Go and starts no worker on load. The
// first Run fetches the worker and go/websdk.wasm alone and answers the seeded list as HTTP/1.1
// text, through every phase of a cold load. A POST then a GET of the new project's id run on the
// instance already held, fetching nothing, each a Call alone, and the GET answers what the POST
// made; an update, then the same update again, stale, answers 412 as a problem; and text that
// isn't an HTTP/1.1 request is rejected naming why, as the console's error block, and the
// instance outlives it, its next Run listing every write the instance kept.
//
// Each response's X-Request-Id, 32 hex digits, is matched by shape and replaced, wherever it
// appears, a problem's request_id among them, and the new project's id, a UUIDv7, likewise; the
// rest of each response is exact. Then the report, never a gate, as the test's diagnostics:
// go/websdk.wasm's bytes as built and gzipped here, by node's zlib at its default level, as Vite's
// preview serves them raw, and the cold Run's phase timings as the demo's timings show them. Every
// wait is bounded. Nothing here names the site: its base is package.json's name.

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

/** The request the page's fence holds, as markdown/go-web-sdk-handlers.md writes it, with its
 * final line break, which marked's plain markup keeps. */
const REQUEST = readFileSync(join(root, "markdown/go-web-sdk-handlers.md"), "utf8").match(
  /<sl-go-demo [^>]*>\n\n```\n([\s\S]*?\n)```\n\n<\/sl-go-demo>/,
)?.[1];

/** The Go a first Run fetches: the worker and the scenario's module, alone. */
const FETCHED = ["assets/worker.js", "go/websdk.wasm"];

/** The phases of a handler's first call, a cold load of its scenario. */
const COLD = ["Fetch", "Wasm compile", "Instantiate", "Start", "Call"];

/** The seeded projects, as the scenario writes each. */
const ATLAS = `{"id":"01933b5e-8a00-7000-8000-000000000001","code":"ATLAS","name":"Atlas","version":1}`;
const BOREAL = `{"id":"01933b5e-8a00-7000-8000-000000000002","code":"BOREAL","name":"Boreal","version":1}`;
const CINDER = `{"id":"01933b5e-8a00-7000-8000-000000000003","code":"CINDER","name":"Cinder","version":1}`;

/** ATLAS's path, the project the updates name. */
const ATLAS_PATH = "/projects/01933b5e-8a00-7000-8000-000000000001";

/** A response's head as the scenario prints it: the status line, the headers given, which sort
 * before X-Request-Id, then the request id, replaced, and the blank line. */
const head = (status: string, ...headers: string[]) =>
  [`HTTP/1.1 ${status}`, ...headers, "X-Request-Id: <request-id>", "", ""].join("\n");

/** The response with its one X-Request-Id, which must have the generated id's shape, replaced
 * wherever it appears by <request-id>. */
function withoutRequestId(text: string): string {
  const ids = [...text.matchAll(/^X-Request-Id: ([0-9a-f]{32})$/gm)];
  assert.equal(ids.length, 1, `one X-Request-Id in:\n${text}`);
  return text.replaceAll(ids[0][1], "<request-id>");
}

/** A new project's id, a UUIDv7, as a create's Location names it. */
const NEW_ID =
  /^Location: \/projects\/([0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/m;

let server: Server;
let browser: Browser;
let watched: Watched;
let page: Page;

before(async () => {
  server = await served(root);
  browser = await launch();
  watched = await open(browser, server.origin, "go-web-sdk-handlers.html");
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

/** Pastes the request and runs it on the instance held: answers its response, its request id
 * replaced, once the Run has called the handler alone, fetching nothing and printing nothing. */
async function send(request: string): Promise<string> {
  const requested = watched.requests.length;
  await pasteOver(request);
  const answered = await run(page, DEMO, "Finished request");
  assert.deepEqual(watched.requests.slice(requested), [], "nothing fetched");
  assert.deepEqual(answered.phases, ["Call"]);
  assert.deepEqual(answered.lines, []);
  assert.equal(answered.result?.ok, true, `answered:\n${answered.result?.text}`);
  return withoutRequestId(answered.result!.text);
}

describe("the Markdown page's request demo", () => {
  test("is the fence's request, named request.http by the file attribute, plain in the markup and the editor", async () => {
    assert.ok(
      REQUEST,
      "markdown/go-web-sdk-handlers.md holds the demo's fence, naming no language",
    );
    assert.deepEqual(
      await page.evaluate(`(() => {
        const demo = ${DEMO};
        const editor = window.demos.editor(demo);
        return [
          document.querySelectorAll("sl-go-demo").length,
          demo.scenario, demo.handler, demo.getAttribute("file"),
          editor.value, editor.label, editor.language,
          [...demo.querySelectorAll(":scope > pre, :scope > pre > code")].map((el) => el.className),
          demo.querySelectorAll(":scope > pre span").length,
          demo.querySelector(":scope > pre").textContent,
        ];
      })()`),
      [1, "websdk", "request", "request.http", REQUEST, "request.http", "", ["", ""], 0, REQUEST],
    );
  });

  test("requests no Go and starts no worker on load", () => {
    assert.deepEqual(goRequests(watched), []);
    assert.deepEqual(watched.workers, []);
  });

  // Reported once the first Run has measured it.
  let cold: Awaited<ReturnType<typeof shown>> | undefined;

  test("the first Run fetches the worker and go/websdk.wasm alone and answers the seeded list", async () => {
    cold = await run(page, DEMO, "Finished request");
    assert.deepEqual(goRequests(watched), FETCHED);
    assert.deepEqual(cold.phases, COLD);
    assert.deepEqual(cold.lines, []);
    assert.equal(cold.result?.ok, true);
    assert.equal(
      withoutRequestId(cold.result!.text),
      head("200 OK", "Content-Type: application/json") +
        `{"items":[${ATLAS},${BOREAL},${CINDER}],"page":1,"size":10,"total":3,"more":false}\n`,
    );
  });

  // The project the POST made, by its id, for the later Runs.
  let made = "";

  test("a POST, then a GET of the new id, run on the instance held, fetching nothing", async () => {
    const createdText = await send(
      'POST /projects HTTP/1.1\nContent-Type: application/json\n\n{"code":"DELTA","name":"Delta"}',
    );
    made = NEW_ID.exec(createdText)?.[1] ?? "";
    assert.ok(made, `a UUIDv7 in Location:\n${createdText}`);
    const delta = `{"id":"${made}","code":"DELTA","name":"Delta","version":1}`;
    assert.equal(
      createdText,
      head(
        "201 Created",
        "Content-Type: application/json",
        'Etag: "1"',
        `Location: /projects/${made}`,
      ) + `${delta}\n`,
    );

    assert.equal(
      await send(`GET /projects/${made} HTTP/1.1`),
      head("200 OK", "Content-Type: application/json", 'Etag: "1"') + `${delta}\n`,
    );
    assert.deepEqual(goRequests(watched), FETCHED);
  });

  test("an update answers the next version, and the same update again, stale, answers 412", async () => {
    const update = `PUT ${ATLAS_PATH} HTTP/1.1\nIf-Match: "1"\nContent-Type: application/json\n\n{"code":"ATLAS","name":"Atlas II"}`;
    assert.equal(
      await send(update),
      head("200 OK", "Content-Type: application/json", 'Etag: "2"') +
        `{"id":"01933b5e-8a00-7000-8000-000000000001","code":"ATLAS","name":"Atlas II","version":2}\n`,
    );
    assert.equal(
      await send(update),
      head("412 Precondition Failed", "Content-Type: application/problem+json") +
        `{"detail":"project 01933b5e-8a00-7000-8000-000000000001 is at version 2, not 1",` +
        `"instance":"${ATLAS_PATH}","request_id":"<request-id>","status":412,` +
        `"title":"Precondition Failed","type":"about:blank"}\n`,
    );
  });

  test("text that isn't an HTTP/1.1 request is rejected naming why, and the instance outlives it", async () => {
    await pasteOver("GET /projects HTTP/2.0");
    const message = "request: HTTP/2.0 isn't HTTP/1.x";
    await pressControl(page, DEMO, "run");
    await says(page, DEMO, `Failed request: ${message}`);
    const refused = await shown(page, DEMO);
    assert.deepEqual(refused.rows, [{ kind: "result", text: `Error ${message}` }]);

    // Reset restores the fence, the list, which the same instance answers with every write it
    // kept: ATLAS updated and the new project.
    await pressControl(page, DEMO, "reset");
    const again = await run(page, DEMO, "Finished request");
    assert.deepEqual(again.phases, ["Call"]);
    assert.equal(
      withoutRequestId(again.result!.text),
      head("200 OK", "Content-Type: application/json") +
        `{"items":[${ATLAS.replace('"Atlas","version":1', '"Atlas II","version":2')},` +
        `${BOREAL},${CINDER},{"id":"${made}","code":"DELTA","name":"Delta","version":1}],` +
        `"page":1,"size":10,"total":4,"more":false}\n`,
    );
    assert.deepEqual(goRequests(watched), FETCHED);
  });

  test("reports the scenario's bytes, raw and gzip, and the cold Run's phase timings", (t) => {
    const wasm = readFileSync(join(root, "dist/go/websdk.wasm"));
    const bytes = (count: number) => count.toLocaleString("en-US");
    t.diagnostic(
      `go/websdk.wasm: ${bytes(wasm.length)} bytes, ${bytes(gzipSync(wasm).length)} gzip bytes by node's zlib`,
    );
    if (cold) {
      t.diagnostic(
        `cold Run, ms: ${cold.phases.map((phase, i) => `${phase} ${cold!.times[i]}`).join(", ")}`,
      );
    }
  });
});
