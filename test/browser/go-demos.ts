// The browser tier's hold on the components page's Go demos, shared by go-demo.test.ts, which
// proves sl-go-demo, and go-runs.test.ts, which proves the runtime through it: a page opened with
// every request it and its workers send watched, every worker it starts counted, live until it
// detaches, and helpers installed on the page that read what a demo shows.
//
// The worker fetches the modules itself, and the page's own Network domain never sees a worker's
// requests, so each page auto-attaches to its workers through the page's session, in the
// protocol's non-flat mode, whose messages travel inside Target events on that session: each
// worker attached is counted, live until it detaches, waits for the debugger until its Network
// domain is on, and reports every request it sends. Every wait is bounded. Nothing here names the
// site: the origin given is the served build's, under its base.

import { SETTLED, until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Browser, Page } from "@jaimestill/spike-html-apps-tooling/browser.js";

/** How long a run of real Go may take to settle, a cold fetch and compile included. */
export const RUN = 20_000;

/** The page's helpers, installed on window.demos once the page has loaded:
 *
 * - at(state, index, list): the index'th sl-go-demo, the first by default, in the figure the
 *   state names in the states list of #go-demo, or in its .focus when list is "focus".
 * - part(demo, selector): the element in the demo's shadow root.
 * - status(demo): the toolbar's status; button(demo, control): the toolbar's button.
 * - rows(demo): the console's rows as shown, each { kind, text }, kind its class, its whitespace
 *   collapsed.
 * - lines(demo): the console's output lines, each { stream, text }, its text as written, without
 *   a stderr line's cue.
 * - result(demo): the console's result block, { ok, text }, its text as written, or null.
 * - phases(demo): the timings' phases as shown, by their row headers; times(demo), each phase's
 *   time, as a number of ms, its unit and grouping dropped, NaN with no digits.
 * - editor(demo): the demo's sl-code-editor; tab(demo): the selected tab's name.
 * - focusPath(): the active element's tags down through every shadow root, as "tag.class" or
 *   "tag[data-…]" where they tell it apart.
 */
const HELPERS = `(() => {
  const scope = (list) =>
    document.querySelector("#go-demo")
      .querySelectorAll(list === "focus" ? ".focus" : ".states")[list === "focus" ? 0 : (list ?? 0)];
  const at = (state, index = 0, list) =>
    scope(list).querySelector(\`figure[data-state="\${state}"]\`)
      .querySelectorAll("sl-go-demo")[index];
  const part = (demo, selector) => demo.shadowRoot.querySelector(selector);
  const controls = (demo) => part(demo, "sl-controls");
  const consoleRows = (demo) =>
    [...part(demo, "sl-console").shadowRoot.querySelector(".lines").children];
  const timingCells = (demo, cell) =>
    [...part(demo, "sl-timings").shadowRoot.querySelectorAll(\`tbody \${cell}\`)];
  window.demos = {
    at,
    part,
    status: (demo) => controls(demo).shadowRoot.querySelector('[role="status"]').textContent,
    button: (demo, control) =>
      controls(demo).shadowRoot.querySelector(\`[data-control="\${control}"]\`),
    rows: (demo) =>
      consoleRows(demo).map((row) => ({
        kind: row.className,
        text: row.textContent.replace(/\\s+/g, " ").trim(),
      })),
    lines: (demo) =>
      consoleRows(demo)
        .filter((row) => row.className === "line")
        .map((row) => ({ stream: row.dataset.stream, text: row.lastChild.textContent })),
    result: (demo) => {
      const block = part(demo, "sl-console").shadowRoot.querySelector(".result");
      return block && { ok: block.dataset.ok === "true", text: block.querySelector(".body").textContent };
    },
    phases: (demo) => timingCells(demo, "th").map((cell) => cell.textContent.trim()),
    times: (demo) => timingCells(demo, "td").map((cell) => {
      const digits = cell.textContent.replace(/[^\\d.]/g, "");
      return digits === "" ? NaN : Number(digits);
    }),
    editor: (demo) => part(demo, "sl-code-editor"),
    tab: (demo) =>
      part(demo, "sl-file-tabs").shadowRoot.querySelector('[aria-selected="true"]')?.dataset.name,
    focusPath() {
      const path = [];
      let at = document.activeElement;
      while (at) {
        path.push(at.dataset?.control ? \`button[\${at.dataset.control}]\`
          : at.dataset?.name ? \`tab[\${at.dataset.name}]\`
          : at.className && typeof at.className === "string" ? \`\${at.localName}.\${at.className}\`
          : at.localName);
        at = at.shadowRoot?.activeElement ?? null;
      }
      return path;
    },
  };
})()`;

/** A page under watch: the origin it was served from, every request it and its workers send, by
 * URL, each worker it started, by its script's URL, and the workers still live, by their
 * sessions. */
export interface Watched {
  page: Page;
  origin: string;
  requests: string[];
  workers: string[];
  live: Set<string>;
}

/** Opens the path under the origin with its and its workers' requests watched from before it
 * loads. The components page, the default, also gets focus emulated, every element rendered, and
 * the helpers installed. */
export async function open(
  browser: Browser,
  origin: string,
  path = "components.html",
): Promise<Watched> {
  const page = await browser.open("about:blank");
  const watched: Watched = { page, origin, requests: [], workers: [], live: new Set() };
  let lastId = 0;
  page.on("Target.attachedToTarget", ({ sessionId, targetInfo }) => {
    watched.workers.push(targetInfo.url);
    watched.live.add(sessionId);
    const send = (method: string) =>
      page.cdp("Target.sendMessageToTarget", {
        sessionId,
        message: JSON.stringify({ id: ++lastId, method, params: {} }),
      });
    // The worker waits until its Network domain is on, so its first fetch is seen. A worker Stop
    // terminates may go before these answer: its requests no longer matter.
    send("Network.enable")
      .then(() => send("Runtime.runIfWaitingForDebugger"))
      .catch(() => {});
  });
  // A terminated worker detaches.
  page.on("Target.detachedFromTarget", ({ sessionId }) => watched.live.delete(sessionId));
  page.on("Target.receivedMessageFromTarget", ({ message }) => {
    const { method, params } = JSON.parse(message);
    if (method === "Network.requestWillBeSent") watched.requests.push(params.request.url);
  });
  page.on("Network.requestWillBeSent", ({ request }) => watched.requests.push(request.url));
  await page.cdp("Network.enable");
  await page.cdp("Target.setAutoAttach", {
    autoAttach: true,
    waitForDebuggerOnStart: true,
    flatten: false,
  });
  await page.goto(`${origin}${path}`);
  if (path === "components.html") {
    await page.cdp("Emulation.setFocusEmulationEnabled", { enabled: true });
    await page.evaluate(SETTLED);
    await page.evaluate(HELPERS);
  }
  return watched;
}

/** The Go the page requested, a worker's script, a .wasm module, or wasm_exec.js, which the
 * worker bundles, by path under the base. */
export const goRequests = ({ origin, requests }: Watched) =>
  requests
    .filter((url) => /\.wasm$|\/worker-[^/]*\.js$|wasm_exec/.test(new URL(url).pathname))
    .map((url) => url.slice(origin.length).replace(/-[\w-]+\.js$/, ".js"));

/** The .wasm modules requested, by path under the base. */
export const wasmRequests = (watched: Watched) =>
  goRequests(watched).filter((path) => path.endsWith(".wasm"));

/** A demo by its state, as the helpers' at() takes it. */
export const demo = (state: string, index = 0, list?: "focus") =>
  `window.demos.at(${JSON.stringify(state)}, ${index}${list === undefined ? "" : `, ${JSON.stringify(list)}`})`;

/** Presses the demo's control by a click, as the toolbar's own click handler takes it. */
export const pressControl = (page: Page, target: string, control: string) =>
  page.evaluate(`window.demos.button(${target}, ${JSON.stringify(control)}).click()`);

/** Resolves once the demo's status says the text, within the bound. */
export const says = (page: Page, target: string, text: string, timeout = RUN) =>
  until(page, `window.demos.status(${target}) === ${JSON.stringify(text)}`, timeout);

/** Resolves once every task the page queued by now, a popover's toggle event among them, has
 * run: two frames and a task after them. */
export const settle = (page: Page) =>
  page.evaluate(`new Promise((resolve) => requestAnimationFrame(() =>
    requestAnimationFrame(() => setTimeout(resolve, 50))))`);

/** What a demo shows. */
export interface Shown {
  status: string;
  rows: { kind: string; text: string }[];
  lines: { stream: string; text: string }[];
  result: { ok: boolean; text: string } | null;
  phases: string[];
  times: number[];
}

/** What the demo shows: its status, its console's rows, output lines, and result, and its timings' phases
 * and times, once the console has rendered its last change, which it does in an animation
 * frame. */
export const shown = async (page: Page, target: string): Promise<Shown> =>
  settle(page).then(() =>
    page.evaluate(`({
    status: window.demos.status(${target}),
    rows: window.demos.rows(${target}),
    lines: window.demos.lines(${target}),
    result: window.demos.result(${target}),
    phases: window.demos.phases(${target}),
    times: window.demos.times(${target}),
  })`),
  );

/** Presses the demo's Run and answers what it shows once its status says the text. */
export async function run(page: Page, target: string, finished: string): Promise<Shown> {
  await pressControl(page, target, "run");
  await says(page, target, finished);
  return shown(page, target);
}

/** Runs the spin demo and waits until its loop holds the worker. */
export async function spin(page: Page, target: string): Promise<void> {
  await pressControl(page, target, "run");
  await until(
    page,
    `window.demos.rows(${target}).some((row) => row.text === "spin: looping until Stop")`,
    RUN,
  );
}

/** Waits, in node, until check holds, failing naming what after timeout ms. */
export async function settles(check: () => boolean, what: string, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (!check()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
