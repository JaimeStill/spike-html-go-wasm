// The worker's first import: the in-memory fs on the worker's globalThis before wasm_exec.js
// evaluates, which installs its own stub fs, ENOSYS to every file call and stdout to the console,
// only when it finds none. worker.ts imports this, then wasm_exec.js, and ES modules evaluate in
// import order, bundled or not.
//
// No test holds the order, because none can fail on it: each instance the worker starts installs a
// fresh fs over this one before Go's syscall package reads globalThis.fs, and wasm_exec.js looks
// fs up on globalThis at each write, so with the imports swapped the stub would install and every
// instance would still run on the in-memory fs. The order keeps the stub from ever installing, and
// review holds it.

import { install } from "./fs.ts";

install();
