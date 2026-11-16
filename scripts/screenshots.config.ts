// mise run screenshots' capture file, which the tooling's spike-html-apps-screenshots bin runs,
// through scripts/screenshots.ts, which takes the task's --width: the SDK's description of the
// index, --page index, captured whole at the SDK's widths, 390px, 1120px, and 1376px, and also with
// Help open and with Settings open at each; and the components page as one capture name per
// component, --page components/<component>, each the page whole at each of the same widths, one
// state per width, with every other component's section hidden, and the controls' with New file's
// form open on its refusal; the Go demo's, as before a Run, no Go loaded, and again at each width
// after the prebuilt runs a reader starts by Run: the format demo's result, hello's output and its
// exit 0, and the crash demo's stderr and its exit 2; and the playground, --page playground, its
// demo as before a Run, on the starter: the viewport alone, the page's one screen, not the page
// whole, since the page fits its viewport by its demo's row, and a viewport grown to the page
// would grow the demo with it. It is captured in each of the fixed demo's bands: at 390px, the
// phone's, with its output panel's Output tab and again with its Timings tab; at 900px, the demo
// between 44rem and 64rem; and at 1120px and 1376px, the wide band in each arrangement, editor
// left, top, and right, and with the Layout menu open, each chosen by the menu as a reader
// chooses, so no state depends on what an earlier one stored; and at 1376px with the About dialog
// open, opened by its button in the header; and at each of the SDK's widths with each of Basics,
// Generics, Concurrency, and Standard library chosen in the Program select, as a reader chooses
// it; and at each of the SDK's widths after a Run of the starter, the calculator, built in the
// page, its compiler and linker in the worker, against the served build's archives, and at 390px
// after that Run with its Timings tab. Each state after a Run waits on the run's own completion,
// as the browser tier's tests and mise run measure do: the timings' runs counted past the last,
// the status's end, the one the run should end with, and the console's row or block it shows, and
// a Timings tab also waits on its table's phases; no state waits on a timer. And the sqlate page,
// --page sqlate, an app page as the playground is, its demo as before a Run, the viewport alone at
// each of the SDK's widths; and the rendered Markdown pages, --page sqlate-compile, --page
// go-core-graph, and --page go-web-sdk-handlers, each its demo as before a Run, whole at each of
// the SDK's widths, the SDK's own states for a page. Every page the site nav writes into is also
// captured once with its Site drawer open, at 390px alone, where its opener shows (the nav's
// switch, 58rem, is page.css's), the viewport alone, as the SDK's Help and Settings states are,
// named <page>-site-390: the index, the playground before its Run states, the sqlate page, each
// rendered Markdown page, and the components page once, on its first component, code-editor,
// with that section alone. Its open step clicks the opener, as a reader does, and waits on the
// drawer's own open state, its open property and its dialog a modal, then on its slide in's end,
// no timer. The components page shows each state once and its layout follows the viewport, so
// the narrow layout is the 390px capture's. With
// SCREENSHOTS_WIDTH set, by --width, every page, the index's, each component's, the playground's,
// and the sqlate and rendered pages', takes only that width's states, so the 900px capture, at no
// SDK width, is taken only when every width is. The SDK's widths over the whole components page
// grew with every component, so each component is captured alone. The description's facets,
// --all's profiles, the registry's profiles, and its server, which serves the site as the browser
// tier serves it, by the SDK's served(), under the base, are the SDK's: dist/, which the task's
// build dependency writes, its go/ modules and toolchain the runs fetch included.
// Adapted from spike-html-hosting-architecture (27d70e1): scripts/screenshots.config.ts, its
// description the SDK's. Adapted from spike-html-hosting-sdk (v0.6.3):
// template/scripts/screenshots.config.ts, its pages the hand pages, as the site copies no tree for
// contentPages to list; the components page split into a page per component, a state per width.

import { join } from "node:path";

import { until } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type {
  DescribedPage,
  DescribedState,
  Step,
} from "@jaimestill/spike-html-apps-tooling/screenshots.js";
import { description, WIDTHS } from "@jaimestill/spike-html-hosting-sdk/screenshots.js";

const root = join(import.meta.dirname, "..");

/** The width to capture alone, from SCREENSHOTS_WIDTH, which scripts/screenshots.ts sets from
 * --width once it has checked it; or undefined, every width. Any other value is refused. */
function onlyWidth(): number | undefined {
  const given = process.env.SCREENSHOTS_WIDTH;
  if (given === undefined || given === "") return undefined;
  const width = WIDTHS.find((viewport) => String(viewport.width) === given)?.width;
  if (width === undefined) {
    const widths = WIDTHS.map((viewport) => viewport.width).join(", ");
    throw new Error(`SCREENSHOTS_WIDTH ${given} isn't a capture width: ${widths}`);
  }
  return width;
}

const only = onlyWidth();

/** Whether a state is captured: every state, or with a width given, those at it. */
const kept = (state: DescribedState) => only === undefined || state.viewport?.width === only;

/** The components page's sections, by id, each a component's, in the page's order. */
export const COMPONENTS = [
  "code-editor",
  "file-tabs",
  "console",
  "timings",
  "controls",
  "go-demo",
] as const;

/** Shows the component's section alone: every other section of the page's main is hidden, and its
 * focus-start mark dropped, so the mark the bin focuses, the page's first, is the component's.
 * The page is the capture's own, so no reader sees the change. */
const alone =
  (component: string): Step =>
  async (page: Page) => {
    await page.evaluate(`(() => {
      for (const section of document.querySelectorAll("main > section")) {
        if (section.id === ${JSON.stringify(component)}) continue;
        section.hidden = true;
        for (const mark of section.querySelectorAll("[data-focus-start]")) {
          mark.removeAttribute("data-focus-start");
        }
      }
    })()`);
  };

/** The steps a component's capture takes after showing its section alone, so a state that opens
 * only on a press shows open: the controls' refusing state's specimen aid opens New file's form
 * with its refusal said. */
const OPENS: Partial<Record<(typeof COMPONENTS)[number], string>> = {
  controls: `document.querySelector('#controls figure[data-state="refused"] .readout button').click()`,
};

/** The component's open step: its section alone, then its OPENS step, if any. */
const opened =
  (component: (typeof COMPONENTS)[number]): Step =>
  async (page: Page) => {
    await alone(component)(page);
    const step = OPENS[component];
    if (step) await page.evaluate(step);
  };

/** How long a prebuilt run may take to settle, a cold fetch and compile of its module included,
 * as the browser tier bounds it (test/browser/go-demos.ts's RUN). */
const RUN = 20_000;

/** How long a build in the page and its run may take to settle, a cold fetch and compile of the
 * compiler and linker included, as the browser tier bounds it (test/browser/go-builds.ts's BUILD). */
const BUILD = 120_000;

/** A Run's ending in the demo, what it should show once it has: its status's text, and a selector
 * for the console's row or block the run writes, matched in the console's shadow root. */
interface Ending {
  status: string;
  shows: string;
}

/** Presses Run on the demo, an expression for its sl-go-demo, as a reader does, resolving once the
 * run has ended as it should: its timings count a run past the last, its status says an end, the
 * ending's, and its console shows the ending's row or block. A run that ends any other way, or
 * not within the bound, rejects naming it, so the capture fails rather than show it. */
async function ran(page: Page, demo: string, ending: Ending, bound: number): Promise<void> {
  const part = (selector: string) =>
    `${demo}.shadowRoot.querySelector(${JSON.stringify(selector)})`;
  const status = `${part("sl-controls")}.shadowRoot.querySelector('[role="status"]').textContent`;
  const runs = `(${part("sl-timings")}.timings?.runs ?? 0)`;
  const before: number = await page.evaluate(runs);
  await page.evaluate(
    `${part("sl-controls")}.shadowRoot.querySelector('[data-control="run"]').click()`,
  );
  await until(page, `${runs} > ${before} && /^(Finished|Stopped|Failed) /.test(${status})`, bound);
  const said: string = await page.evaluate(status);
  if (said !== ending.status) {
    throw new Error(`${demo}'s Run ended "${said}", not "${ending.status}"`);
  }
  await until(
    page,
    `${part("sl-console")}.shadowRoot.querySelector(${JSON.stringify(ending.shows)}) !== null`,
    5000,
  );
}

/** The components page's Go demos the run state runs, each by its figure's state and how its
 * prebuilt run ends: probe's format answering with its result, hello's main printing its line and
 * exiting 0, and probe's crash panicking, its stderr and its exit 2. They share the page's one
 * runner, so they run one after another, in the page's order. */
const RUNS = [
  ["handler", { status: "Finished format", shows: '.result[data-ok="true"]' }],
  ["program", { status: "Finished hello, exit code 0", shows: '.exit[data-ok="true"]' }],
  ["crash", { status: "Failed crash: probe exited with code 2", shows: '.exit[data-ok="false"]' }],
] as const;

/** The Go demo's section alone, then each of RUNS' demos run to its ending. */
const goDemoRan: Step = async (page: Page) => {
  await alone("go-demo")(page);
  for (const [state, ending] of RUNS) {
    const demo = `document.querySelector('#go-demo .states figure[data-state="${state}"] sl-go-demo')`;
    await ran(page, demo, ending, RUN);
  }
};

/** The width that puts the playground's fixed demo between its 44rem and 64rem bands, at the 1120px
 * capture's height. */
export const MIDDLE = { width: 900, height: 700 };

/** Opens the playground's About dialog by a click on About, resolving once it is open. */
const aboutOpen: Step = async (page: Page) => {
  await page.evaluate(`document.querySelector("body > header button[commandfor=about]").click()`);
  await until(page, `document.getElementById("about").matches(":modal")`, 5000);
};

/** The Site drawer, sl-drawer#site, and its opener, the header's button that names it, as the
 * site nav writes them (scripts/site-nav.ts). */
export const SITE_DRAWER = `document.querySelector("sl-drawer#site")`;
const SITE_OPENER = `document.querySelector('body > header button[aria-controls="site"]')`;

/** Opens the Site drawer by a click on its opener, as a reader does, resolving once the drawer is
 * open, its open property and its dialog a modal, and its slide in has ended, a transition in the
 * drawer's shadow root, which the document's own animations leave out. The opener shows only below
 * the nav's switch, 58rem (page.css), so the state is the phone's alone. */
export const siteOpen: Step = async (page: Page) => {
  await page.evaluate(`${SITE_OPENER}.click()`);
  await until(
    page,
    `${SITE_DRAWER}.open && !!${SITE_DRAWER}.shadowRoot?.querySelector("dialog")?.matches(":modal")`,
    5000,
  );
  await page.evaluate(`Promise.all(${SITE_DRAWER}.shadowRoot.querySelector("dialog")
    .getAnimations({ subtree: true }).map((animation) => animation.finished))`);
};

/** The phone's width, the one the Site drawer's opener shows at. */
const [PHONE] = WIDTHS;

/** A page's Site drawer state: the viewport alone at the phone's width, as the SDK's Help and
 * Settings states are, the drawer opened by its opener first, after any step the page's capture
 * takes; named as the SDK names its open states, the width last. */
const siteState = (file: string, caption: string, before?: Step): DescribedState => ({
  name: `${file}-site-${PHONE.width}`,
  caption: `${caption}, Site open, ${PHONE.width}px`,
  viewport: PHONE,
  full: false,
  open: before
    ? async (page: Page) => {
        await before(page);
        await siteOpen(page);
      }
    : siteOpen,
});

/** The programs captured chosen in the playground's Program select, each its option's value, its
 * label, and a file of its own, which no other program has, whose tab says the demo shows it. */
const CHOSEN = [
  ["basics", "Basics", "shapes.go"],
  ["generics", "Generics", "stack.go"],
  ["concurrency", "Concurrency", "pipeline.go"],
  ["stdlib", "Standard library", "input.json"],
] as const;

/** Chooses the program in the playground's Program select, as a reader's choice changes it,
 * resolving once the demo shows its file of its own. */
const chosen =
  (program: string, file: string): Step =>
  async (page: Page) => {
    await page.evaluate(`(() => {
      const picker = document.querySelector("select#program");
      picker.value = ${JSON.stringify(program)};
      picker.dispatchEvent(new Event("change", { bubbles: true }));
    })()`);
    await until(
      page,
      `document.querySelector("sl-go-demo").shadowRoot.querySelector("sl-file-tabs").shadowRoot
        .querySelector('[role="tab"][data-name=${JSON.stringify(file)}]') !== null`,
      5000,
    );
  };

/** Selects the playground demo's Timings tab, its phone band's output panel. */
const timingsTab: Step = async (page: Page) => {
  await page.evaluate(
    `document.querySelector("sl-go-demo").shadowRoot.querySelector('.output-tabs [data-part="timings"]').click()`,
  );
};

/** The playground's one demo, as an expression. */
const PLAYGROUND = `document.querySelector("sl-go-demo")`;

/** The starter's Run, built in the page and run: main exits 0. */
const STARTER_RUN: Ending = {
  status: "Finished main, exit code 0",
  shows: '.exit[data-ok="true"]',
};

/** Runs the playground's starter, the calculator, to its exit 0. */
const starterRan: Step = (page: Page) => ran(page, PLAYGROUND, STARTER_RUN, BUILD);

/** Runs the starter, then selects the Timings tab, resolving once its table shows the run's
 * phases. */
const starterRanTimings: Step = async (page: Page) => {
  await starterRan(page);
  await timingsTab(page);
  await until(
    page,
    `${PLAYGROUND}.shadowRoot.querySelector("sl-timings").shadowRoot
      .querySelectorAll("tbody th").length > 0`,
    5000,
  );
};

/** The playground demo's toolbar's shadow root, as an expression. */
const CONTROLS = `document.querySelector("sl-go-demo").shadowRoot.querySelector("sl-controls").shadowRoot`;

/** Whether the Layout menu is open, as an expression. */
const MENU_OPEN = `${CONTROLS}.querySelector("#layout-menu").matches(":popover-open")`;

/** Opens the playground demo's Layout menu by a click on Layout, resolving once it is open. */
const openMenu = async (page: Page) => {
  await page.evaluate(`${CONTROLS}.querySelector('[data-control="layout"]').click()`);
  await until(page, MENU_OPEN, 5000);
};

/** The wide band's arrangements the playground is captured in, by the placement's name. */
const PLACEMENTS = ["left", "top", "right"] as const;

/** Chooses the placement by the playground demo's Layout menu, resolving once the menu closes. */
const arranged =
  (placement: (typeof PLACEMENTS)[number]): Step =>
  async (page: Page) => {
    await openMenu(page);
    await page.evaluate(
      `${CONTROLS}.querySelector('#layout-menu [data-placement="${placement}"]').click()`,
    );
    await until(page, `!${MENU_OPEN}`, 5000);
  };

/** The Layout menu open on editor left. */
const menuOpen: Step = async (page: Page) => {
  await arranged("left")(page);
  await openMenu(page);
};

/** Editor left, chosen by the menu, then the starter run. */
const leftRan: Step = async (page: Page) => {
  await arranged("left")(page);
  await starterRan(page);
};

/** The playground's states: the viewport alone, the page's one screen, in each band of its fixed
 * demo, the phone's with its Timings tab, and the wide band's in each arrangement and with the
 * Layout menu open; the widest with the About dialog open; the phone's with the Site drawer open;
 * each of the SDK's widths with each
 * program but the calculator chosen in the Program select, Basics, Generics, Concurrency, and
 * Standard library; and each of the SDK's widths after a Run of the starter, the wide band's in
 * editor left, and the phone's again with its Timings tab; each named as the SDK names a page's,
 * the width last. The Run states come last, after every state that runs nothing. */
const playgroundStates = ({ path }: DescribedPage): DescribedState[] => {
  const [phone, ...wide] = WIDTHS;
  const state = (
    viewport: { width: number; height: number },
    open?: Step,
    variant = "",
    said = "",
  ) => ({
    name: `playground-${variant}${viewport.width}`,
    caption: `${path}, ${said}${viewport.width}px`,
    viewport,
    full: false,
    open,
  });
  return [
    state(phone),
    state(phone, timingsTab, "timings-", "Timings tab, "),
    state(MIDDLE),
    ...wide.flatMap((viewport) => [
      state(viewport, arranged("left")),
      ...PLACEMENTS.slice(1).map((placement) =>
        state(viewport, arranged(placement), `${placement}-`, `editor ${placement}, `),
      ),
      state(viewport, menuOpen, "menu-", "Layout menu, "),
    ]),
    state(wide.at(-1) ?? phone, aboutOpen, "about-", "About open, "),
    siteState("playground", path),
    ...CHOSEN.flatMap(([program, label, file]) =>
      WIDTHS.map((viewport) =>
        state(viewport, chosen(program, file), `${program}-`, `${label} chosen, `),
      ),
    ),
    state(phone, starterRan, "run-", "after a Run, "),
    ...wide.map((viewport) => state(viewport, leftRan, "run-", "after a Run, ")),
    state(phone, starterRanTimings, "run-timings-", "after a Run, Timings tab, "),
  ];
};

/** The sqlate page's states: the viewport alone, its one screen, as the playground's are, at each
 * of the SDK's widths; withSite adds its Site drawer state. */
const sqlateStates = ({ path }: DescribedPage): DescribedState[] =>
  WIDTHS.map((viewport) => ({
    name: `sqlate-${viewport.width}`,
    caption: `${path}, ${viewport.width}px`,
    viewport,
    full: false,
  }));

/** The page's states with its Site drawer state after them: every page the site nav writes into
 * but the playground, whose states hold it before their Run states, and the components page, whose
 * first component's states hold it, its open step that component's first. */
const withSite = (page: DescribedPage): DescribedPage => ({
  ...page,
  states: [...(page.states ?? []), siteState(page.name.replaceAll("/", "-"), page.caption)],
});

const described = description({
  root,
  pages: [
    "index.html",
    "components.html",
    "playground.html",
    "sqlate.html",
    "sqlate-compile.html",
    "go-core-graph.html",
    "go-web-sdk-handlers.html",
  ],
});

/** The components page as a page per component: its path, and a state whole at each of the SDK's
 * widths with the component's section alone, the state's name its files', with no slash, the
 * width last, as the index's are; the first component's also with the Site drawer open at the
 * phone's width; the Go demo's also whole at each width after its runs. */
const perComponent = ({ path }: DescribedPage): DescribedPage[] =>
  COMPONENTS.map((component) => ({
    name: `components/${component}`,
    caption: `${path}, ${component}`,
    path,
    states: [
      ...WIDTHS.map((viewport) => ({
        name: `components-${component}-${viewport.width}`,
        caption: `${path}, ${component}, ${viewport.width}px`,
        viewport,
        full: true,
        open: opened(component),
      })),
      // The page's one Site drawer state, on its first component's section.
      ...(component === COMPONENTS[0]
        ? [siteState(`components-${component}`, `${path}, ${component}`, opened(component))]
        : []),
      ...(component === "go-demo"
        ? WIDTHS.map((viewport) => ({
            name: `components-go-demo-run-${viewport.width}`,
            caption: `${path}, go-demo, after its runs, ${viewport.width}px`,
            viewport,
            full: true,
            open: goDemoRan,
          }))
        : []),
    ],
  }));

export default {
  ...described,
  pages: described.pages
    .flatMap((page) => (page.name === "components" ? perComponent(page) : [page]))
    .map((page) =>
      page.name === "playground" ? { ...page, states: playgroundStates(page) } : page,
    )
    .map((page) => (page.name === "sqlate" ? { ...page, states: sqlateStates(page) } : page))
    .map((page) =>
      page.name === "playground" || page.name.startsWith("components/") ? page : withSite(page),
    )
    .map((page) => ({ ...page, states: page.states?.filter(kept) })),
};
