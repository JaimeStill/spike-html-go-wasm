// mise run screenshots' capture file, which the tooling's spike-html-apps-screenshots bin runs,
// through scripts/screenshots.ts, which takes the task's --width: the SDK's description of the
// index, --page index, captured whole at the SDK's widths, 390px, 1120px, and 1376px, and also with
// Help open and with Settings open at each; and the components page as one capture name per
// component, --page components/<component>, each the page whole at each of the same widths, one
// state per width, with every other component's section hidden, and the controls' with New file's
// form open on its refusal; the Go demo's presses nothing, so every demo shows as before a Run, and
// no Go loads; and the playground, --page playground, its demo as before a Run, on hello's source:
// the viewport alone, the page's one screen, not the page whole, since the page fits its viewport
// by its demo's container, and a viewport grown to the page would grow the demo with it. It is
// captured in each of the fixed demo's bands: at 390px, the phone's, with its output panel's Output
// tab and again with its Timings tab; at 900px, the demo between 44rem and 64rem; and at 1120px and
// 1376px, the wide band in each arrangement, editor left, top, and right, and with the Layout menu
// open, each chosen by the menu as a reader chooses, so no state depends on what an earlier one
// stored; and at 1376px with the disclosure open, the demo at its floor, the page scrolled to its
// top. The components page shows each state once and its layout follows the viewport, so the narrow
// layout is the 390px capture's. With SCREENSHOTS_WIDTH set, by --width, every page, the index's,
// each component's, and the playground's, takes only that width's states, so the 900px capture, at
// no SDK width, is taken only when every width is. The SDK's widths over the whole components page
// grew with every component, so each component is captured alone. The description's facets, --all's
// profiles, the registry's profiles, and its server, which serves the site as the browser tier
// serves it, by the SDK's served(), under the base, are the SDK's.
// Adapted from spike-html-hosting-architecture (27d70e1): scripts/screenshots.config.ts, its
// description the SDK's.
// Adapted from spike-html-hosting-sdk (v0.6.2): template/scripts/screenshots.config.ts, its pages
// the hand pages, as the site copies no tree for contentPages to list; the components page split
// into a page per component, a state per width.

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

/** The width that puts the playground's fixed demo between its 44rem and 64rem bands, at the 1120px
 * capture's height. */
export const MIDDLE = { width: 900, height: 700 };

/** Opens the playground's disclosure by a click on its summary, resolving once it is open. */
const disclosed: Step = async (page: Page) => {
  await page.evaluate(`document.querySelector("main > details > summary").click()`);
  await until(page, `document.querySelector("main > details").open`, 5000);
};

/** Selects the playground demo's Timings tab, its phone band's output panel. */
const timingsTab: Step = async (page: Page) => {
  await page.evaluate(
    `document.querySelector("sl-go-demo").shadowRoot.querySelector('.output-tabs [data-part="timings"]').click()`,
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

/** The playground's states: the viewport alone, the page's one screen, in each band of its fixed
 * demo, the phone's with its Timings tab, and the wide band's in each arrangement and with the
 * Layout menu open; and the widest with the disclosure open, each named as the SDK names a page's,
 * the width last. */
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
    state(wide.at(-1) ?? phone, disclosed, "disclosure-", "disclosure open, "),
  ];
};

const described = description({
  root,
  pages: ["index.html", "components.html", "playground.html"],
});

/** The components page as a page per component: its path, and a state whole at each of the SDK's
 * widths with the component's section alone, the state's name its files', with no slash, the
 * width last, as the index's are. */
const perComponent = ({ path }: DescribedPage): DescribedPage[] =>
  COMPONENTS.map((component) => ({
    name: `components/${component}`,
    caption: `${path}, ${component}`,
    path,
    states: WIDTHS.map((viewport) => ({
      name: `components-${component}-${viewport.width}`,
      caption: `${path}, ${component}, ${viewport.width}px`,
      viewport,
      full: true,
      open: opened(component),
    })),
  }));

export default {
  ...described,
  pages: described.pages
    .flatMap((page) => (page.name === "components" ? perComponent(page) : [page]))
    .map((page) =>
      page.name === "playground" ? { ...page, states: playgroundStates(page) } : page,
    )
    .map((page) => ({ ...page, states: page.states?.filter(kept) })),
};
