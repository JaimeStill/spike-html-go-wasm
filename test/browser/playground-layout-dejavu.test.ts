// The playground's fixed layout in the pinned DejaVu font set (fonts.ts):
// playground-layout-suite.ts's tests, as that suite says, under the test-only fontconfig that
// fonts.ts's useDejaVu() writes, set up before the suite's browser launches, and removed after it
// closes. playground-layout.test.ts runs the same suite in the machine's fonts.

import { after } from "node:test";

import { useDejaVu } from "./fonts.ts";

// The suite's own after, which closes its browser, is registered first, so it runs first.
const remove = useDejaVu();
await import("./playground-layout-suite.ts");
after(remove);
