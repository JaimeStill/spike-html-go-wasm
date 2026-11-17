// The Site drawer's script, which the build writes into every page beside the nav itself
// (scripts/site-nav.ts): it defines sl-drawer, by importing its module, and wires the drawer,
// sl-drawer#site, to its opener, the header's button that names it by aria-controls; and it
// switches the header between the row and the opener by whether the row fits.
//
// The switch: the row shows wherever its links fit on one line sharing the header's line with the
// header's buttons, and the opener shows in its place wherever they don't, at any width, text size,
// or font. The script marks the header data-site-nav="row" or "drawer", and page.css hides the row
// and shows the opener under "drawer". Whether the row fits is measured, never assumed from a
// width: the header is laid out for a moment in a measuring state, data-site-nav="measure", the
// row's links unwrapped at their natural single-line width and the buttons the row state shows,
// the opener hidden, all on one unwrapped line; the row fits when that line's widths, with the
// header's gaps, are within the header's content width. The measuring state is set and the answer
// marked in one task, so no frame paints it. The answer depends on the header's width, the text,
// and the fonts alone, never on which state shows, so showing the opener can't change it, and the
// measure can't loop: it runs again as the header's width changes, by a ResizeObserver on a probe
// the script adds to the header, an absolute box as wide as the header and zero tall, whose size
// the switch never changes (the header's own size does, as the row shows or hides, which would
// trip the observer's loop limit); as fonts load, by document.fonts; and as the reader's Settings
// or the text's size change, by a MutationObserver on the root's attributes, where the
// foundation's preferences write the type and space profiles. With no script the header has no
// data-site-nav: the row shows at every width, wrapping its links, and the opener stays hidden.
//
// The drawer is a modal at every width, by a dock no viewport reaches. The opener opens it, by its
// click or by N, which the foundation's keys module clicks it on while it shows, so N, and Help's
// row for it, exist only in the drawer state; and says through aria-expanded whether it is open.
// The drawer returns focus as it closes, by its Close, Escape, or a link, to the element that held
// it as it opened, as the SDK's Pages and Contents drawers do (markdown.ts): to the opener after
// its click, which focuses it, and after N, which the keys module clicks the opener on without
// focusing it, to wherever focus was before the key. Following a link in it closes it, so the
// link's navigation lands on the page the drawer covered; the drawer leaves that to the page.
// Adapted from spike-html-hosting-sdk (v0.6.4): template/index.html, its inline drawer script, for
// the one drawer.

import "@jaimestill/spike-html-hosting-components/drawer.js";
import type { Drawer } from "@jaimestill/spike-html-hosting-components/drawer.js";

const drawer = document.querySelector<Drawer>("sl-drawer#site");

if (drawer) {
  drawer.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a[href]")) drawer.close();
  });
  const opener = document.querySelector('[aria-controls="site"]');
  if (opener) {
    opener.addEventListener("click", () => drawer.show());
    const expanded = () => opener.setAttribute("aria-expanded", String(drawer.open));
    drawer.addEventListener("open", expanded);
    drawer.addEventListener("close", expanded);
  }
}

const header = document.querySelector<HTMLElement>("body > header");
const row = header?.querySelector<HTMLElement>(":scope > .site-nav");

/** The header's inline edges, its padding and border, which its content width leaves out. */
const EDGES = [
  "paddingInlineStart",
  "paddingInlineEnd",
  "borderInlineStartWidth",
  "borderInlineEndWidth",
] as const;

if (header && row && drawer) {
  /** Whether the row's links fit on one line beside the header's buttons: the header's in-flow
   * children, laid out unwrapped in the measuring state, with the gaps between them, against the
   * header's content width. Leaves the header as it found it. */
  const fits = (): boolean => {
    const state = header.dataset.siteNav;
    header.dataset.siteNav = "measure";
    const style = getComputedStyle(header);
    // The header's own box, unrounded, as the children's are: clientWidth rounds to a whole px,
    // which can call a row that overflows by a fraction a fit.
    const room = EDGES.reduce(
      (width, edge) => width - (parseFloat(style[edge]) || 0),
      header.getBoundingClientRect().width,
    );
    const children = [...header.children].filter(
      (child) => child.checkVisibility() && getComputedStyle(child).position !== "absolute",
    );
    const needed =
      children.reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) +
      Math.max(0, children.length - 1) * (parseFloat(style.columnGap) || 0);
    if (state === undefined) delete header.dataset.siteNav;
    else header.dataset.siteNav = state;
    // A hundredth of a px for the float sum; layout itself is in 64ths.
    return needed <= room + 0.01;
  };

  /** Marks the header with the state the measure answers, writing only on a change. */
  const fit = () => {
    const state = fits() ? "row" : "drawer";
    if (header.dataset.siteNav !== state) header.dataset.siteNav = state;
  };

  const probe = document.createElement("div");
  probe.className = "site-nav-probe";
  probe.setAttribute("aria-hidden", "true");
  header.append(probe);

  fit();
  new ResizeObserver(fit).observe(probe);
  new MutationObserver(fit).observe(document.documentElement, { attributes: true });
  document.fonts.addEventListener("loadingdone", fit);
  void document.fonts.ready.then(fit);
}
