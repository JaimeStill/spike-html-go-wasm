// mise run currency's go.mod part, scripts/go-currency.ts, over recorded `go list -m -u -json`
// output, so it reads no network: a direct requirement behind its latest release draws exactly
// its line, and a current one, an indirect one, and a module go.mod doesn't require draw none.

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { trailing, type Requirement } from "../../scripts/go-currency.ts";

/** go.mod's requirements, as `go mod edit -json` reads them. */
const requires: Requirement[] = [
  { Path: "example.com/m", Version: "v1.0.0" },
  { Path: "example.com/current", Version: "v2.3.0" },
  { Path: "example.com/indirect", Version: "v0.1.0", Indirect: true },
];

/** `go list -m -u -json` over them, as Go prints it: a stream of objects, an Update only on a
 * module with a newer release; and one go.mod doesn't require, which Go would list under all. */
const listing = `{
	"Path": "example.com/m",
	"Version": "v1.0.0",
	"Time": "2025-01-01T00:00:00Z",
	"Update": {
		"Path": "example.com/m",
		"Version": "v1.2.0",
		"Time": "2026-01-01T00:00:00Z"
	},
	"GoMod": "/cache/example.com/m/@v/v1.0.0.mod"
}
{
	"Path": "example.com/current",
	"Version": "v2.3.0",
	"Time": "2026-01-01T00:00:00Z",
	"GoMod": "/cache/example.com/current/@v/v2.3.0.mod"
}
{
	"Path": "example.com/indirect",
	"Version": "v0.1.0",
	"Update": {
		"Path": "example.com/indirect",
		"Version": "v0.9.0"
	},
	"Indirect": true
}
{
	"Path": "example.com/unrequired",
	"Version": "v1.0.0",
	"Update": {
		"Path": "example.com/unrequired",
		"Version": "v1.1.0"
	}
}
`;

describe("go.mod currency", () => {
  test("a stale direct requirement draws its line, and nothing else does", () => {
    assert.deepEqual(trailing(requires, listing), ["go.mod: example.com/m v1.0.0 -> v1.2.0"]);
  });

  test("a current requirement draws nothing", () => {
    assert.deepEqual(trailing([requires[1]], listing), []);
  });

  test("an indirect requirement draws nothing", () => {
    assert.deepEqual(trailing([requires[2]], listing), []);
  });

  test("no requirement and no listing draw nothing", () => {
    assert.deepEqual(trailing([], ""), []);
  });
});
