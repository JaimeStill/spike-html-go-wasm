// A fixed Go demo's arrangement from 64rem, the reader's preference, a model with no document, no
// element, and no storage: where the editor sits, left of the output, above it, or right of it.
// Its owner, the page, writes it, from what it keeps for the reader and from the choices the
// demos' Layout menus request; every fixed demo the page gives it renders from it, re-rendering on
// its change event, and never writes it. It validates its own value, refusing one it can't hold
// with the reason, so an owner reading a value from storage, which holds whatever another page
// wrote, can test it first by `placementProblem` and fall back to the default.

import { shown } from "./reasons.ts";

/** Where the editor sits beside the output: left of it, above it, or right of it. */
export type Placement = "left" | "top" | "right";

/** Every placement, in the Layout menu's order. */
export const PLACEMENTS: readonly Placement[] = Object.freeze(["left", "top", "right"]);

/** The placement with none given, or none that can be held: the editor left. */
export const DEFAULT_PLACEMENT: Placement = "left";

/** Why value can't be a placement, or null when it can: "left", "top", or "right". */
export function placementProblem(value: unknown): string | null {
  return PLACEMENTS.includes(value as Placement)
    ? null
    : `an arrangement must be "left", "top", or "right", not ${shown(value)}`;
}

/**
 * The editor's placement in a fixed demo from 64rem: `placement`, "left" by default, "top", or
 * "right". Setting it to a value it can't hold throws, naming the reason (a TypeError for a value
 * that isn't a string, a RangeError for a string that isn't a placement), and changes nothing.
 * Each set that changes it sends one `change` event; a set to the placement already held sends
 * none.
 */
export class Arrangement extends EventTarget {
  #placement: Placement = DEFAULT_PLACEMENT;

  /** An arrangement at the placement given, validated as a set would be, or at the default. */
  constructor(placement?: Placement) {
    super();
    if (placement !== undefined) this.#placement = checked(placement);
  }

  /** Where the editor sits. */
  get placement(): Placement {
    return this.#placement;
  }

  set placement(value: Placement) {
    const next = checked(value);
    if (next === this.#placement) return;
    this.#placement = next;
    this.dispatchEvent(new Event("change"));
  }
}

/** The value, when it can be a placement; else a RangeError naming why, or a TypeError when it
 * isn't a string. */
function checked(value: unknown): Placement {
  const problem = placementProblem(value);
  if (!problem) return value as Placement;
  throw typeof value === "string" ? new RangeError(problem) : new TypeError(problem);
}
