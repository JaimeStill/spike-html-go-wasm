// The browser tier's viewport widths, shared by the component tests: the components page shows
// each state once and its layout follows the viewport, so a test proves the narrow layout at a
// phone's width, the SDK's narrowest capture width, where the content column is narrow. A page's
// width holds until the page closes, or until the next width is set.

import { SETTLED } from "@jaimestill/spike-html-apps-tooling/browser.js";
import type { Page } from "@jaimestill/spike-html-apps-tooling/browser.js";
import { WIDTHS } from "@jaimestill/spike-html-hosting-sdk/screenshots.js";

/** A phone's width, in CSS px: the SDK's narrowest capture width, 390. */
export const PHONE = Math.min(...WIDTHS.map(({ width }) => width));

/** The browser's own page width, in CSS px, which a page opens at. */
export const WIDE = 1280;

/** Lays the page out at the width, 900px tall, resolving once its fonts are ready and two frames
 * have painted. */
export async function viewport(page: Page, width: number): Promise<void> {
  await page.cdp("Emulation.setDeviceMetricsOverride", {
    width,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await page.evaluate(SETTLED);
}
