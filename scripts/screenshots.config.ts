// mise run screenshots' capture file, which the tooling's spike-html-apps-screenshots bin runs: the
// SDK's description of the index and the runtime page, --page index and --page runtime, captured
// whole at 390px, 1120px, and 1376px, and the index also with Help open and with Settings open at
// each; and the components page as one capture name per component, --page components/<component>,
// each the page whole at 1280×800 with every other component's section hidden, and the controls'
// with New file's form open on its refusal. The SDK's three widths over the whole components page
// grew with every component, 68 images for the editor alone, so each component is captured alone,
// at one width. The description's facets, --all's profiles, the registry's profiles, and its
// server, which serves the site as the browser tier serves it, by the SDK's served(), under the
// base, are the SDK's.
// Adapted from spike-html-hosting-architecture (27d70e1): scripts/screenshots.config.ts, its
// description the SDK's.
// Adapted from spike-html-hosting-sdk (v0.6.2): template/scripts/screenshots.config.ts, its pages
// the hand pages, as the site copies no tree for contentPages to list; the components page split
// into a page per component, each one state.

import { join } from "node:path";

import type { Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { DescribedPage, Step } from "@jaimestill/spike-html-apps-tooling/screenshots.js";
import { description } from "@jaimestill/spike-html-hosting-sdk/screenshots.js";

const root = join(import.meta.dirname, "..");

/** The components page's sections, by id, each a component's, in the page's order. */
export const COMPONENTS = ["code-editor", "file-tabs", "console", "timings", "controls"] as const;

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

const described = description({ root, pages: ["index.html", "runtime.html", "components.html"] });

/** The components page as a page per component: its path, one state whole at 1280×800 with the
 * component's section alone, the state's name its files', with no slash. */
const perComponent = ({ path }: DescribedPage): DescribedPage[] =>
  COMPONENTS.map((component) => ({
    name: `components/${component}`,
    caption: `${path}, ${component}`,
    path,
    states: [
      {
        name: `components-${component}`,
        viewport: { width: 1280, height: 800 },
        full: true,
        open: opened(component),
      },
    ],
  }));

export default {
  ...described,
  pages: described.pages.flatMap((page) =>
    page.name === "components" ? perComponent(page) : [page],
  ),
};
