// mise run screenshots' capture file, which the tooling's spike-html-apps-screenshots bin runs: the
// SDK's description of every page the site builds, the hand pages, --page index and --page runtime,
// captured whole at 390px, 1120px, and 1376px, and also with Help open and with Settings open at
// each. The site is served as the browser tier serves it, by the SDK's served(), under the base.
// Adapted from spike-html-hosting-architecture (27d70e1): scripts/screenshots.config.ts, its
// description the SDK's.
// Adapted from spike-html-hosting-sdk (v0.6.1): template/scripts/screenshots.config.ts, its pages
// the hand pages, as the site copies no tree for contentPages to list.

import { join } from "node:path";

import { description } from "@jaimestill/spike-html-hosting-sdk/screenshots.js";

const root = join(import.meta.dirname, "..");

export default description({ root, pages: ["index.html", "runtime.html"] });
