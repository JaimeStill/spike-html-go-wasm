// The worker's first import: the in-memory fs on the worker's globalThis before wasm_exec.js
// evaluates, which installs its own stub fs, ENOSYS to every file call and stdout to the console,
// only when it finds none. worker.ts imports this, then wasm_exec.js, and ES modules evaluate in
// import order, bundled or not. Each instance the worker starts installs a fresh fs over this one.

import { install } from "./fs.ts";

install();
