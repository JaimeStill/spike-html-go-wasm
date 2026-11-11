// The lint the check runs: the SDK's configuration, the recommended rules over the site's code,
// and the leftover check over its build, dist/, which fails on any CSS module script the build
// left in it. The check lints after the build (mise.toml), so the leftover check reads it.
// Adapted from spike-html-hosting-architecture (27d70e1): eslint.config.js, its configuration the
// SDK's.
// Adapted from spike-html-hosting-sdk (v0.6.1): template/eslint.config.js, ignoring the copied
// wasm_exec.js, the pinned Go's own file, which mise run lint:go checks byte for byte.

import { config } from "@jaimestill/spike-html-hosting-sdk/eslint.js";

export default [{ ignores: ["web/runtime/wasm_exec.js"] }, ...config];
