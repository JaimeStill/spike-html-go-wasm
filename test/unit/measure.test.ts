// mise run measure's pure parts, scripts/measure-report.ts, on fixtures, so it reads no network:
// the median and max over readings; a body weighed from its wire bytes, raw, as served under its
// encoding, and at brotli 11; a closure's revalidation count, each distinct archive once; two
// builds compared byte for byte, with the build settings Go stamped differently; and the size table
// and the drift report as printed. The live run itself is never a test.

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { brotliCompressSync, constants, deflateSync, gzipSync } from "node:zlib";

import {
  brotli,
  buildSettings,
  closureRow,
  compare,
  decode,
  driftSection,
  max,
  median,
  moduleRow,
  report,
  revalidations,
  sizeSection,
  table,
  weigh,
  type Weight,
} from "../../scripts/measure-report.ts";

/** A body that compresses: a phrase repeated. */
const body = Buffer.from('package main\n\nfunc main() { println("hello") }\n'.repeat(200));

/** The body at brotli 11, as node's zlib gives it with the size hint. */
const brotli11 = brotliCompressSync(body, {
  params: {
    [constants.BROTLI_PARAM_QUALITY]: 11,
    [constants.BROTLI_PARAM_SIZE_HINT]: body.length,
  },
}).length;

/** A module's bytes with Go's build settings in its build info, as -s -w leaves them. */
const stamped = (revision: string, modified: string, filler = "") =>
  Buffer.from(
    `\0asm${filler}\npath\texample.com/cmd/hello\nbuild\t-trimpath=true\nbuild\tGOOS=js\nbuild\tvcs.revision=${revision}\nbuild\tvcs.modified=${modified}\n\0`,
    "latin1",
  );

/** A weight, for the rows' fixtures. */
const weight = (raw: number, served: number, brotli: number, encoding = "gzip"): Weight => ({
  raw,
  served,
  brotli,
  encoding,
});

describe("median and max", () => {
  test("the median is the middle reading, or the mean of the middle two, whatever the order", () => {
    assert.equal(median([30, 10, 20]), 20);
    assert.equal(median([40, 10, 30, 20]), 25);
    assert.equal(median([7]), 7);
  });

  test("the max is the largest reading", () => {
    assert.equal(max([30, 10, 20]), 30);
    assert.equal(max([7]), 7);
  });

  test("no readings give NaN for each", () => {
    assert.ok(Number.isNaN(median([])));
    assert.ok(Number.isNaN(max([])));
  });
});

describe("weighing a body", () => {
  test("a gzip-served body: raw its decoded bytes, served its wire bytes, and brotli 11 of the raw", async () => {
    const wire = gzipSync(body);
    const { weight, body: decoded } = await weigh(wire, "gzip");
    assert.deepEqual(weight, {
      raw: body.length,
      served: wire.length,
      encoding: "gzip",
      brotli: brotli11,
    });
    assert.ok(decoded.equals(body));
    assert.ok(weight.served < weight.raw);
  });

  test("a body served with no encoding is served as its raw bytes, identity", async () => {
    const { weight } = await weigh(body, null);
    assert.equal(weight.raw, body.length);
    assert.equal(weight.served, body.length);
    assert.equal(weight.encoding, "identity");
  });

  test("deflate and br decode as a browser decodes them", () => {
    assert.ok(decode(deflateSync(body), "deflate").equals(body));
    assert.ok(decode(brotliCompressSync(body), "BR").equals(body));
  });

  test("an encoding it can't decode is refused, naming it", () => {
    assert.throws(() => decode(body, "zstd"), /an encoding measure can't decode: zstd/);
  });

  test("brotli is quality 11's size", async () => {
    assert.equal(await brotli(body), brotli11);
  });
});

describe("a closure's revalidation count", () => {
  test("one request per distinct archive", () => {
    assert.equal(revalidations(["std/fmt.1.a", "std/io.2.a", "std/fmt.1.a"]), 2);
    assert.equal(revalidations([]), 0);
  });

  test("a closure's row counts and sums each distinct archive once, its encodings each once", () => {
    const row = closureRow("calc closure", [
      { path: "std/fmt.1.a", weight: weight(100, 40, 30) },
      { path: "std/io.2.a", weight: weight(50, 20, 15) },
      { path: "std/fmt.1.a", weight: weight(100, 40, 30) },
    ]);
    assert.deepEqual(row, {
      name: "calc closure",
      kind: "closure",
      files: 2,
      raw: 150,
      served: 60,
      brotli: 45,
      encodings: ["gzip"],
    });
  });

  test("a module's row is its one file", () => {
    assert.deepEqual(moduleRow("hello.wasm", weight(10, 5, 4)), {
      name: "hello.wasm",
      kind: "module",
      files: 1,
      raw: 10,
      served: 5,
      brotli: 4,
      encodings: ["gzip"],
    });
  });
});

describe("the drift comparison", () => {
  test("two equal builds are the same, their settings all equal", () => {
    const a = stamped("abc", "false");
    assert.deepEqual(compare(a, Buffer.from(a)), {
      same: true,
      a: a.length,
      b: a.length,
      delta: 0,
      differing: 0,
      settings: [],
    });
  });

  test("builds of different lengths give each length, the difference, and the settings that differ", () => {
    const local = stamped("abc", "true");
    const live = stamped("def", "false");
    const compared = compare(local, live);
    assert.equal(compared.same, false);
    assert.equal(compared.delta, 1);
    assert.equal(compared.differing, null);
    assert.deepEqual(compared.settings, ["vcs.revision: abc → def", "vcs.modified: true → false"]);
  });

  test("builds of one length give the count of bytes that differ", () => {
    const compared = compare(stamped("abc", "false", "xx"), stamped("abd", "false", "yy"));
    assert.equal(compared.delta, 0);
    assert.equal(compared.differing, 3);
    assert.deepEqual(compared.settings, ["vcs.revision: abc → abd"]);
  });

  test("a setting one build lacks is none on that side", () => {
    const compared = compare(Buffer.from("\0asm"), stamped("abc", "false"));
    assert.ok(compared.settings.includes("vcs.revision: none → abc"));
  });

  test("the build settings read from a module's build info, and none from a module without", () => {
    assert.deepEqual(
      [...buildSettings(stamped("abc", "false"))],
      [
        ["-trimpath", "true"],
        ["GOOS", "js"],
        ["vcs.revision", "abc"],
        ["vcs.modified", "false"],
      ],
    );
    assert.equal(buildSettings(Buffer.from("\0asm")).size, 0);
  });
});

describe("the report's formatting", () => {
  test("a table pads each column to its widest cell, text left and numbers right, a rule under the header", () => {
    assert.deepEqual(
      table(
        [
          ["Name", "Bytes"],
          ["hello", "5"],
          ["a", "1,000"],
        ],
        1,
      ),
      ["Name   Bytes", "-----  -----", "hello      5", "a      1,000"],
    );
  });

  test("the size table: one row per module and closure, bytes grouped by thousands, the max-age in its caption", () => {
    const lines = sizeSection(
      [
        moduleRow("hello.wasm", weight(2473987, 737953, 546453)),
        closureRow("calc closure", [{ path: "std/fmt.1.a", weight: weight(1000, 400, 300) }]),
      ],
      "600 s",
    );
    assert.match(lines[0], /max-age \(600 s\)/);
    assert.deepEqual(lines.slice(1), [
      "Name          Kind     Files        Raw   Served  Encoding  Brotli 11",
      "------------  -------  -----  ---------  -------  --------  ---------",
      "hello.wasm    module       1  2,473,987  737,953      gzip    546,453",
      "calc closure  closure      1      1,000      400      gzip        300",
    ]);
  });

  test("the drift report: each module's two comparisons, a difference's byte counts and settings beneath it", () => {
    const same = stamped("abc", "true");
    const lines = driftSection([
      { name: "hello", local: compare(same, same), live: compare(same, stamped("def", "false")) },
      { name: "probe", local: compare(same, same), live: "go/probe.wasm: 404" },
    ]);
    assert.deepEqual(lines.slice(1), [
      "hello.wasm",
      `  local vs local: same, ${same.length} B`,
      `  local vs live:  differ: ${same.length} B vs ${same.length + 1} B (+1)`,
      "    vcs.revision: abc → def",
      "    vcs.modified: true → false",
      "probe.wasm",
      `  local vs local: same, ${same.length} B`,
      "  local vs live: not read: go/probe.wasm: 404",
    ]);
  });

  test("the report: the head, then each section, a blank line between", () => {
    assert.equal(
      report({ base: "https://example.com/", commit: "abc", date: "2026-11-13" }, [
        ["one"],
        ["two"],
      ]),
      "measure  https://example.com/\ndeployed commit: abc\ndate: 2026-11-13\n\none\n\ntwo\n",
    );
  });
});
