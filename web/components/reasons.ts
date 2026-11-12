// The models' refusals, shared: how a reason names the value it refuses. A model with no document
// and no element imports it, so it holds nothing of either.

/** The value as a reason names it: a string as JSON, so its spaces show; anything else as it
 * prints. */
export const shown = (value: unknown): string =>
  typeof value === "string" ? JSON.stringify(value) : String(value);
