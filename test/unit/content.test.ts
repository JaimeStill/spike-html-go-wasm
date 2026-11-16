// The copied trees' provenance, with the SDK's content check: content.json records each tree the
// site copies, and each file in content/ must match its record. The site copies none, so it has no
// content.json, which the check reads as a record of no tree, and any file under content/ fails
// here as one no record names.
// Adapted from spike-html-hosting-architecture (27d70e1): test/unit/content.test.ts, its check the
// SDK's.
// Adapted from spike-html-hosting-sdk (v0.6.4): template/test/unit/content.test.ts, its site one
// with no content.json.

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { checkContent } from "@jaimestill/spike-html-hosting-sdk/content.js";

test("content/ holds nothing, as the site has no content.json", () => {
  assert.deepEqual(checkContent(join(import.meta.dirname, "../..")), []);
});
