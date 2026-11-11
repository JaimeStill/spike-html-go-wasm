// mise run live, scripts/live.ts, against local servers on 127.0.0.1, so it reads no network: a
// site served as Pages serves it holds every assertion, and a site that serves the module with the
// wrong type, without gzip, or not at all, or that doesn't answer, fails exactly the assertions
// over what it got wrong, each named.

import assert from "node:assert/strict";
import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import { gzipSync } from "node:zlib";

import { held, lines, type Outcome } from "../../scripts/live.ts";

/** The wasm magic number and version, a module's first bytes. */
const wasm = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

/** How a fake site serves the hello module. */
interface Serving {
  status?: number;
  type?: string;
  gzip?: boolean;
}

/** A listener for a site under /site/: the index as HTML, and go/hello.wasm as `serving` says,
 * gzipped only when the request accepts gzip and `serving` allows it; anything else a 404. */
function site({ status = 200, type = "application/wasm", gzip = true }: Serving): RequestListener {
  return (request, response) => {
    if (request.url === "/site/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end("<!doctype html><title>site</title>");
    } else if (request.url === "/site/go/hello.wasm") {
      const accepts = /\bgzip\b/.test(String(request.headers["accept-encoding"] ?? ""));
      const encoded = gzip && accepts;
      response.writeHead(status, {
        "Content-Type": type,
        ...(encoded ? { "Content-Encoding": "gzip" } : {}),
      });
      response.end(encoded ? gzipSync(wasm) : wasm);
    } else {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("not found");
    }
  };
}

/** The outcomes of held() against `listener`, served on 127.0.0.1 for the run alone. */
async function against(listener: RequestListener): Promise<Outcome[]> {
  const server: Server = createServer(listener);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address() as AddressInfo;
    // No trailing slash: held() adds it, as it does for a base given on the command line.
    return await held(`http://127.0.0.1:${port}/site`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

/** The names of the outcomes that failed. */
const failed = (outcomes: Outcome[]) =>
  outcomes.filter(({ failure }) => failure).map(({ name }) => name);

describe("mise run live", () => {
  test("a site served as Pages serves it holds every assertion", async () => {
    const outcomes = await against(site({}));
    assert.deepEqual(lines(outcomes), [
      "✓ index 200 text/html",
      "✓ go/hello.wasm 200 application/wasm",
      "✓ go/hello.wasm gzip",
    ]);
  });

  test("the module served with the wrong type fails its type assertion alone", async () => {
    const outcomes = await against(site({ type: "application/octet-stream" }));
    assert.deepEqual(failed(outcomes), ["go/hello.wasm 200 application/wasm"]);
    assert.deepEqual(lines(outcomes)[1], "✗ go/hello.wasm 200 application/wasm");
    assert.equal(outcomes[1].failure, "got 200 application/octet-stream");
  });

  test("the module served without gzip fails its gzip assertion alone", async () => {
    const outcomes = await against(site({ gzip: false }));
    assert.deepEqual(failed(outcomes), ["go/hello.wasm gzip"]);
    assert.deepEqual(lines(outcomes)[2], "✗ go/hello.wasm gzip");
    assert.equal(outcomes[2].failure, "got 200 no encoding");
  });

  test("a missing module fails both of its assertions, and the index holds", async () => {
    const outcomes = await against(site({ status: 404 }));
    assert.deepEqual(failed(outcomes), [
      "go/hello.wasm 200 application/wasm",
      "go/hello.wasm gzip",
    ]);
  });

  test("a site that doesn't answer fails every assertion, naming why", async () => {
    // A port held and then released, so nothing listens on it.
    const server = createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const { port } = server.address() as AddressInfo;
    await new Promise((resolve) => server.close(resolve));

    const outcomes = await held(`http://127.0.0.1:${port}/site/`);
    assert.deepEqual(failed(outcomes), [
      "index 200 text/html",
      "go/hello.wasm 200 application/wasm",
      "go/hello.wasm gzip",
    ]);
    for (const { failure } of outcomes) assert.match(failure ?? "", /ECONNREFUSED/);
  });
});
