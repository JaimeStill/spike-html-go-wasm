// The editor's settings, a model with no document and no element: whether long lines wrap, and how
// wide a tab shows. Its owner, the page or the element composing the editor, writes it; the
// editor reads it, renders from it, and re-renders on its change event, never writing it. It
// validates its own values, refusing one it can't hold with the reason, so an owner building it
// from attributes or a form can show that reason as it is.

/** The settings an editor shows with none given: long lines scroll sideways, and a tab shows four
 * columns wide. */
export const defaults: Readonly<{ wrap: boolean; tabSize: number }> = Object.freeze({
  wrap: false,
  tabSize: 4,
});

/** The tab sizes the settings hold, in columns. */
export const TAB_SIZES = { min: 1, max: 8 } as const;

/** The value as a reason names it: a number as written, anything else as JSON. */
const shown = (value: unknown) =>
  typeof value === "number" ? String(value) : (JSON.stringify(value) ?? String(value));

/** Why value can't be a tab size, or null when it can: an integer from 1 to 8. */
export function tabSizeProblem(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return `a tab size must be a whole number, not ${shown(value)}`;
  }
  if (value < TAB_SIZES.min || value > TAB_SIZES.max) {
    return `a tab size must be from ${TAB_SIZES.min} to ${TAB_SIZES.max} columns, not ${value}`;
  }
  return null;
}

/** Why value can't be a wrap setting, or null when it can: true or false. */
export function wrapProblem(value: unknown): string | null {
  return typeof value === "boolean" ? null : `wrap must be true or false, not ${shown(value)}`;
}

/**
 * An editor's settings: `wrap`, whether long lines wrap (false by default: they scroll sideways),
 * and `tabSize`, how many columns a tab shows (4 by default, a whole number from 1 to 8).
 * Setting either to a value it can't hold throws, naming the reason (a TypeError for a value that
 * isn't a number or a boolean, a RangeError for a number that isn't a tab size), and changes
 * nothing. Each set that changes a value sends one `change` event; a set to the value already held
 * sends none.
 */
export class EditorSettings extends EventTarget {
  #wrap: boolean = defaults.wrap;
  #tabSize: number = defaults.tabSize;

  /** Settings at the defaults, with any of init's values in their place, each validated as a set
   * would be. */
  constructor(init: Partial<{ wrap: boolean; tabSize: number }> = {}) {
    super();
    if (init.wrap !== undefined) this.#wrap = checkedWrap(init.wrap);
    if (init.tabSize !== undefined) this.#tabSize = checkedTabSize(init.tabSize);
  }

  /** Whether long lines wrap; false scrolls them sideways. */
  get wrap(): boolean {
    return this.#wrap;
  }

  set wrap(value: boolean) {
    const next = checkedWrap(value);
    if (next === this.#wrap) return;
    this.#wrap = next;
    this.dispatchEvent(new Event("change"));
  }

  /** How many columns a tab shows, from 1 to 8. */
  get tabSize(): number {
    return this.#tabSize;
  }

  set tabSize(value: number) {
    const next = checkedTabSize(value);
    if (next === this.#tabSize) return;
    this.#tabSize = next;
    this.dispatchEvent(new Event("change"));
  }
}

/** The value, when it can be a wrap setting; else a TypeError naming why. */
function checkedWrap(value: unknown): boolean {
  const problem = wrapProblem(value);
  if (problem) throw new TypeError(problem);
  return value as boolean;
}

/** The value, when it can be a tab size; else a RangeError naming why, or a TypeError when it
 * isn't a number. */
function checkedTabSize(value: unknown): number {
  const problem = tabSizeProblem(value);
  if (!problem) return value as number;
  throw typeof value === "number" ? new RangeError(problem) : new TypeError(problem);
}
