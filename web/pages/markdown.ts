// The Markdown shell's script (markdown-shell.html), which every page the SDK's markdownPages
// renders from markdown/ loads: it defines sl-go-demo, by importing its module, and gives every
// demo the page holds the page's one runner, the runtime's Runner, which TypeScript checks
// against the demo's declared subset, DemoRunner, where the page creates it. A Markdown page
// writes a demo as raw HTML around an ordinary fence, which markdownPages highlights at build, so
// the demo reads as the page's code without script and builds its file from that markup when it
// upgrades. The demos share the runner as the components page's do: a Run in one stops another's
// pending run. Nothing here loads Go on load: the runner starts its worker and fetches a
// scenario's module only on a demo's Run.
//
// Then each drawer the page has, Pages, which holds the site index, and Contents, which holds the
// section tree, closes as a link in it is followed, so the link's navigation and its scroll land on
// the page the drawer covered; the drawer leaves that to the page. Each drawer's button in the
// header, which names it by aria-controls, opens it and says through aria-expanded whether it is
// open.
// Adapted from spike-html-hosting-sdk (v0.6.2): template/index.html, its inline drawer script.

import "../components/go-demo.ts";
import type { DemoRunner } from "../components/go-demo.ts";
import { Runner } from "../runtime/runner.ts";

/** The page's one runner, checked here, at compile time, against the subset sl-go-demo declares.
 * It starts no worker and fetches nothing until a demo's Run. */
const runner = new Runner() satisfies DemoRunner;

for (const demo of document.querySelectorAll("sl-go-demo")) demo.runner = runner;

for (const id of ["pages", "contents"]) {
  const drawer = document.getElementById(id) as (HTMLElement & Drawer) | null;
  if (!drawer) continue;
  drawer.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest("a[href]")) drawer.close();
  });
  const opener = document.querySelector(`[aria-controls="${id}"]`);
  if (!opener) continue;
  opener.addEventListener("click", () => drawer.show());
  const expanded = () => opener.setAttribute("aria-expanded", String(drawer.open));
  drawer.addEventListener("open", expanded);
  drawer.addEventListener("close", expanded);
}

/** The members of the components' sl-drawer the wiring uses, which the shell's module defines;
 * this script imports none of the components' types, the drawer loaded by its own script tag. */
interface Drawer {
  open: boolean;
  show(): void;
  close(): void;
}
