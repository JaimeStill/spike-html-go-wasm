// mise run screenshots' capture file, which the tooling's spike-html-apps-screenshots bin runs,
// through scripts/screenshots.ts, which takes the task's --width: the SDK's description of the
// index, --page index, captured whole at the SDK's widths, 390px, 1120px, and 1376px, and also
// with Help open and with Settings open at each; and the components page as one capture name per
// component, --page components/<component>, each the page whole at each of the same widths, one
// state per width, with every other component's section hidden, and the controls' with New file's
// form open on its refusal; the Go demo's presses nothing, so every demo shows as before a Run,
// and no Go loads; and the playground, --page playground, its demo as before a Run, on hello's
// source: the viewport alone, the demo scrolled to its end, not the page whole, since its fixed
// demo is as tall as the viewport less the header, and a viewport grown to the page would grow the
// demo with it. It is captured in
// each of the fixed demo's bands: at 390px, the phone's, with its output panel's Output tab and
// again with its Timings tab; at 900px, the demo between 44rem and 64rem; and at 1120px and
// 1376px, the wide band's editor left. The components page shows each state once and its layout
// follows the viewport, so the narrow layout is the 390px capture's. With SCREENSHOTS_WIDTH set,
// by --width, every page, the index's, each component's, and the playground's, takes only that
// width's states, so the 900px capture, at no SDK width, is taken only when every width is. The SDK's widths over the whole components page grew with every component,
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

/** The width that puts the playground's fixed demo between its 44rem and 64rem bands, at the 1120px
 * capture's height. */
export const MIDDLE = { width: 900, height: 700 };

/** Scrolls the page until the playground's demo ends at the viewport's end, so the capture holds
 * the demo whole, as tall as the viewport less the header. */
const demoInView: Step = async (page: Page) => {
  await page.evaluate(
    `document.querySelector("sl-go-demo").scrollIntoView({ block: "end", behavior: "instant" })`,
  );
};

/** Selects the playground demo's Timings tab, its phone band's output panel, the demo in view. */
const timingsTab: Step = async (page: Page) => {
  await page.evaluate(
    `document.querySelector("sl-go-demo").shadowRoot.querySelector('.output-tabs [data-part="timings"]').click()`,
  );
  await demoInView(page);
};

/** The playground's states: the viewport alone, the demo scrolled into it, in each band of its
 * fixed demo, and the phone's with its Timings tab, each named as the SDK names a page's, the
 * width last. */
const playgroundStates = ({ path }: DescribedPage): DescribedState[] => {
  const [phone, ...wide] = WIDTHS;
  const state = (viewport: { width: number; height: number }, open = demoInView, tab = "") => ({
    name: `playground-${tab}${viewport.width}`,
    caption: `${path}, ${tab ? "Timings tab, " : ""}${viewport.width}px`,
    viewport,
    full: false,
    open,
  });
  return [
    state(phone),
    state(phone, timingsTab, "timings-"),
    state(MIDDLE),
    ...wide.map((viewport) => state(viewport)),
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
