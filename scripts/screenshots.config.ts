// mise run screenshots' capture file, which the tooling's spike-html-apps-screenshots bin runs,
// through scripts/screenshots.ts, which takes the task's --width: the SDK's description of the
// index, --page index, captured whole at the SDK's widths, 390px, 1120px, and 1376px, and also
// with Help open and with Settings open at each; and the components page as one capture name per
// component, --page components/<component>, each the page whole at each of the same widths, one
// state per width, with every other component's section hidden, and the controls' with New file's
// form open on its refusal; the Go demo's presses nothing, so every demo shows as before a Run,
// and no Go loads; and the playground, --page playground, whole at each of the same widths, its
// demo as before a Run, on hello's source. The components page shows each state once and its
// layout follows the viewport, so the narrow layout is the 390px capture's. With SCREENSHOTS_WIDTH
// set, by --width, every page, the index's, each component's, and the playground's, takes only
// that width's states. The SDK's widths over the whole components page grew with every component,
// so each component is captured alone. The description's facets, --all's profiles, the registry's
// profiles, and its server, which serves the site as the browser tier serves it, by the SDK's
// served(), under the base, are the SDK's.
// Adapted from spike-html-hosting-architecture (27d70e1): scripts/screenshots.config.ts, its
// description the SDK's.
// Adapted from spike-html-hosting-sdk (v0.6.2): template/scripts/screenshots.config.ts, its pages
// the hand pages, as the site copies no tree for contentPages to list; the components page split
// into a page per component, a state per width.

import { join } from "node:path";

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
    .map((page) => ({ ...page, states: page.states?.filter(kept) })),
};
