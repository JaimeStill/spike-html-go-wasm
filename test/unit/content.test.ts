// The copied trees' provenance, with the SDK's content check: content.json records each tree the
// site copies, and each file in content/ must match its record. The site copies none, so its
// record lists no tree, and any file under content/ fails here as one no record names, as does a
// tree recorded without its copy.
// Adapted from spike-html-hosting-architecture (27d70e1): test/unit/content.test.ts, its check the
// SDK's.
// Adapted from spike-html-hosting-sdk (v0.6.1): template/test/unit/content.test.ts, its record
// one with no tree.

import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";

import { checkContent } from "@jaimestill/spike-html-hosting-sdk/content.js";

test("content/ is what content.json records", () => {
  assert.deepEqual(checkContent(join(import.meta.dirname, "../..")), []);
});
