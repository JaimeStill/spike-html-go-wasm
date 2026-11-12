// The reader's arrangement, kept for a page: the page, never a demo, is the one owner of the
// Arrangement its fixed Go demos render from (web/components/arrangement.ts). It reads the
// placement kept in localStorage under the spike's own key, as the foundation's preferences.js
// keeps the theme, and builds the one model from it; gives that model to every fixed demo; and
// applies each demo's arrange request, the Layout menu's choice, to the model, storing the choice.
// The choice is the only write to storage: reading, and every fallback, writes nothing.
//
// Storage throws when blocked or sandboxed, and holds whatever another page wrote, so each access
// is in a try/catch, and a value that isn't JSON, or that the model refuses, reads as none. With
// none, the demos open with the editor left. Another tab's choice, which fires storage here, never
// in the tab that chose, moves this page's demos too; a cleared store moves them back to left.

import {
  Arrangement,
  DEFAULT_PLACEMENT,
  type Placement,
  placementProblem,
} from "../components/arrangement.ts";
import type { ArrangeDetail } from "../components/controls.ts";
import type { GoDemo } from "../components/go-demo.ts";

/** The localStorage key, so every page on the origin shares one choice. */
export const KEY = "spike-html-go-wasm.arrangement";

/** The stored placement, or null when nothing is stored, it isn't one the model holds, or storage
 * is blocked. */
export function read(): Placement | null {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? "null");
    return placementProblem(stored) === null ? (stored as Placement) : null;
  } catch {
    return null;
  }
}

/** Stores the placement, and returns whether storage took it. */
export function save(placement: Placement): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(placement));
    return true;
  } catch {
    return false;
  }
}

/**
 * The page's arrangement: built from the stored placement, or at the default, and given to every
 * fixed demo in the document. Each arrange request a demo sends sets it and is stored; another
 * tab's choice sets it to what the store then holds.
 */
export function keep(root: Document = document): Arrangement {
  const arrangement = new Arrangement(read() ?? undefined);
  for (const demo of root.querySelectorAll<GoDemo>("sl-go-demo[fixed]")) {
    demo.arrangement = arrangement;
  }
  root.addEventListener("arrange", (event) => {
    const { placement } = (event as CustomEvent<ArrangeDetail>).detail;
    arrangement.placement = placement;
    save(arrangement.placement);
  });
  addEventListener("storage", (event) => {
    if (event.key !== KEY && event.key !== null) return;
    arrangement.placement = read() ?? DEFAULT_PLACEMENT;
  });
  return arrangement;
}
