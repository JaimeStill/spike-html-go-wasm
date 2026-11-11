// The Go build, as Pages serves it: dist/go/ under the base, by the SDK's served(), Vite's preview,
// loaded in the pinned chrome-headless-shell. hello.wasm answers as application/wasm, beside the
// committed wasm_exec.js; the index requests no Go module on load; and on the index, wasm_exec.js
// loaded and hello instantiated by hand, as the runtime's loader will, hello's one line reaches the
// page's console through wasm_exec.js's fs.writeSync. Nothing here names the site: its base is
// package.json's name.

import assert from "node:assert/strict";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";

import { launch } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Server } from "@jaimestill/spike-html-apps-tooling/server.js";
import { served } from "@jaimestill/spike-html-hosting-sdk/served.js";

const root = join(import.meta.dirname, "../..");

let server: Server;
let browser: Browser;

before(async () => {
  server = await served(root);
  browser = await launch();
});
after(async () => {
  await browser?.close();
  await server?.stop();
});

describe("the Go build under the base", () => {
  test("hello.wasm answers 200 as application/wasm", async () => {
    const response = await fetch(new URL("go/hello.wasm", server.origin));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/wasm");
    const bytes = new Uint8Array(await response.arrayBuffer());
    // The wasm magic number, \0asm.
    assert.deepEqual([...bytes.subarray(0, 4)], [0x00, 0x61, 0x73, 0x6d]);
  });

  test("wasm_exec.js answers 200 as JavaScript", async () => {
    const response = await fetch(new URL("go/wasm_exec.js", server.origin));
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^text\/javascript/);
  });

  test("the index requests no Go module on load", async () => {
    const page = await browser.open("about:blank");
    try {
      const requested: string[] = [];
      page.on("Network.requestWillBeSent", (params) => requested.push(params.request.url));
      await page.cdp("Network.enable");
      await page.goto(server.origin);
      assert.ok(requested.length > 0, "the index's own requests were seen");
      assert.deepEqual(
        requested.filter((url) => /\.wasm(\?|$)|\/go\//.test(url)),
        [],
      );
    } finally {
      await page.close();
    }
  });

  test("hello, instantiated through wasm_exec.js, prints its line", async () => {
    const page = await browser.open(server.origin);
    try {
      // Relative to the index, so under the base. wasm_exec.js's fs.writeSync buffers Go's
      // standard output and hands each whole line to console.log, which collects it here.
      const lines: string[] = await page.evaluate(`(async () => {
        const lines = [];
        const log = console.log;
        console.log = (...args) => lines.push(args.join(" "));
        try {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "go/wasm_exec.js";
            script.onload = resolve;
            script.onerror = () => reject(new Error("go/wasm_exec.js didn't load"));
            document.head.append(script);
          });
          const go = new Go();
          const { instance } = await WebAssembly.instantiateStreaming(
            fetch("go/hello.wasm"),
            go.importObject,
          );
          await go.run(instance);
          return lines;
        } finally {
          console.log = log;
        }
      })()`);
      assert.equal(lines.length, 1, `one line, got ${JSON.stringify(lines)}`);
      assert.match(lines[0], /^hello from Go go1\.\d+\.\d+ on js\/wasm$/);
    } finally {
      await page.close();
    }
  });
});
