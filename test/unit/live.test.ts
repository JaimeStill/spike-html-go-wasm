// mise run live, scripts/live.ts, against local servers on 127.0.0.1, so it reads no network: a
// site served as Pages serves it holds every assertion, and a site that serves the module or the
// playground's compiler with the wrong type, without gzip, or not at all, that serves no manifest
// or one naming no compiler, or that doesn't answer, fails exactly the assertions over what it got
// wrong, each named.

import assert from "node:assert/strict";
import { createServer, type RequestListener, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, test } from "node:test";
import { gzipSync } from "node:zlib";

import { held, lines, type Outcome } from "../../scripts/live.ts";

/** The wasm magic number and version, a module's first bytes. */
const wasm = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);

/** How a fake site serves a module. */
interface Serving {
  status?: number;
  type?: string;
  gzip?: boolean;
}

/** The compiler's hashed name, as the fake site's manifest gives it. */
const COMPILE = "compile.0123456789abcdef.wasm";

/** A listener for a site under /site/: the index as HTML; go/hello.wasm as `hello` says; the
 * playground's manifest, naming the compiler, unless `manifest` gives its text or false, none; and
 * the compiler, under go/toolchain/, as `compiler` says. Each module is gzipped only when the
 * request accepts gzip and its serving allows it; anything else is a 404. */
function site({
  hello = {},
  compiler = {},
  manifest = JSON.stringify({ go: "go1.27.4", compile: COMPILE, link: "link.wasm", packages: {} }),
}: {
  hello?: Serving;
  compiler?: Serving;
  manifest?: string | false;
}): RequestListener {
  const serve = (
    request: Parameters<RequestListener>[0],
    response: Parameters<RequestListener>[1],
    { status = 200, type = "application/wasm", gzip = true }: Serving,
  ) => {
    const accepts = /\bgzip\b/.test(String(request.headers["accept-encoding"] ?? ""));
    const encoded = gzip && accepts;
    response.writeHead(status, {
      "Content-Type": type,
      ...(encoded ? { "Content-Encoding": "gzip" } : {}),
    });
    response.end(encoded ? gzipSync(wasm) : wasm);
  };
  return (request, response) => {
    if (request.url === "/site/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end("<!doctype html><title>site</title>");
    } else if (request.url === "/site/go/hello.wasm") {
      serve(request, response, hello);
    } else if (request.url === "/site/go/toolchain/manifest.json" && manifest !== false) {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(manifest);
    } else if (request.url === `/site/go/toolchain/${COMPILE}`) {
      serve(request, response, compiler);
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
      "✓ go/toolchain/manifest.json 200",
      "✓ compiler 200 application/wasm",
      "✓ compiler gzip",
    ]);
  });

  test("the module served with the wrong type fails its type assertion alone", async () => {
    const outcomes = await against(site({ hello: { type: "application/octet-stream" } }));
    assert.deepEqual(failed(outcomes), ["go/hello.wasm 200 application/wasm"]);
    assert.equal(lines(outcomes)[1], "✗ go/hello.wasm 200 application/wasm");
    assert.equal(outcomes[1].failure, "got 200 application/octet-stream");
  });

  test("the module served without gzip fails its gzip assertion alone", async () => {
    const outcomes = await against(site({ hello: { gzip: false } }));
    assert.deepEqual(failed(outcomes), ["go/hello.wasm gzip"]);
    assert.equal(lines(outcomes)[2], "✗ go/hello.wasm gzip");
    assert.equal(outcomes[2].failure, "got 200 no encoding");
  });

  test("a missing module fails both of its assertions, and the index holds", async () => {
    const outcomes = await against(site({ hello: { status: 404 } }));
    assert.deepEqual(failed(outcomes), [
      "go/hello.wasm 200 application/wasm",
      "go/hello.wasm gzip",
    ]);
  });

  test("the compiler served with the wrong type fails its type assertion alone", async () => {
    const outcomes = await against(site({ compiler: { type: "application/octet-stream" } }));
    assert.deepEqual(failed(outcomes), ["compiler 200 application/wasm"]);
    assert.equal(outcomes[4].failure, "got 200 application/octet-stream");
  });

  test("the compiler served without gzip fails its gzip assertion alone", async () => {
    const outcomes = await against(site({ compiler: { gzip: false } }));
    assert.deepEqual(failed(outcomes), ["compiler gzip"]);
    assert.equal(outcomes[5].failure, "got 200 no encoding");
  });

  test("a missing compiler fails both of its assertions, and the manifest holds", async () => {
    const outcomes = await against(site({ compiler: { status: 404 } }));
    assert.deepEqual(failed(outcomes), ["compiler 200 application/wasm", "compiler gzip"]);
  });

  test("a missing manifest fails its assertion and the compiler's, naming why", async () => {
    const outcomes = await against(site({ manifest: false }));
    assert.deepEqual(failed(outcomes), [
      "go/toolchain/manifest.json 200",
      "compiler 200 application/wasm",
      "compiler gzip",
    ]);
    assert.equal(outcomes[3].failure, "got 404 text/plain");
    assert.equal(outcomes[4].failure, "no manifest: got 404 text/plain");
  });

  test("a manifest naming no compiler, or not JSON, fails the compiler's assertions, naming why", async () => {
    let outcomes = await against(site({ manifest: JSON.stringify({ go: "go1.27.4" }) }));
    assert.deepEqual(failed(outcomes), ["compiler 200 application/wasm", "compiler gzip"]);
    assert.equal(outcomes[4].failure, "the manifest names no compiler");
    outcomes = await against(site({ manifest: "<html>" }));
    assert.deepEqual(failed(outcomes), ["compiler 200 application/wasm", "compiler gzip"]);
    assert.match(outcomes[5].failure ?? "", /^the manifest isn't JSON: /);
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
      "go/toolchain/manifest.json 200",
      "compiler 200 application/wasm",
      "compiler gzip",
    ]);
    for (const { failure } of outcomes) assert.match(failure ?? "", /ECONNREFUSED/);
  });
});
