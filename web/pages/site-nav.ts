// The Site drawer's script, which the build writes into every page beside the nav itself
// (scripts/site-nav.ts): it defines sl-drawer, by importing its module, and wires the drawer,
// sl-drawer#site, to its opener, the header's button that names it by aria-controls. The drawer
// is a modal at every width, by a dock no viewport reaches, and its opener shows only below the
// width the nav's row fits at (page.css). The opener opens it, by its click or by N, which the
// foundation's keys module clicks it on, and says through aria-expanded whether it is open. The
// opener takes focus as it opens the drawer, so the drawer, which returns focus to the element that
// held it, returns it to the opener as it closes, by its Close, Escape, or a link: the keys module
// clicks without focusing. Following a link in it closes it, so the link's navigation lands on the
// page the drawer covered; the drawer leaves that to the page.
// Adapted from spike-html-hosting-sdk (v0.6.3): template/index.html, its inline drawer script, for
// the one drawer.

import "@jaimestill/spike-html-hosting-components/drawer.js";
import type { Drawer } from "@jaimestill/spike-html-hosting-components/drawer.js";

const drawer = document.querySelector<Drawer>("sl-drawer#site");
const opener = document.querySelector<HTMLElement>('[aria-controls="site"]');

if (drawer && opener) {
  opener.addEventListener("click", () => {
    opener.focus();
    drawer.show();
  });
  const expanded = () => opener.setAttribute("aria-expanded", String(drawer.open));
  drawer.addEventListener("open", expanded);
  drawer.addEventListener("close", expanded);
  drawer.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a[href]")) drawer.close();
  });
}
