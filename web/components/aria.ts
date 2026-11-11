// The ARIA patterns' pieces the components share: the elements an id reference names across the
// shadow boundary, and the roving focus keys of a tablist or a toolbar.

/** The elements the space-separated ids name in the host's tree, the document or the shadow root
 * holding it, in order; an id naming nothing names none. An id can't reach across a shadow
 * boundary, so a component sets what they name as element references, which can. */
export function idrefs(host: Node, ids: string | null): Element[] {
  const root = host.getRootNode() as Document | ShadowRoot;
  return (ids ?? "")
    .split(/\s+/)
    .filter((id) => id !== "")
    .map((id) => root.getElementById(id))
    .filter((element) => element !== null);
}

/**
 * The item a roving focus key moves to from the item the press is on: Left and Right the previous
 * and the next, wrapping, following the host's direction, so in a right-to-left page Right is
 * previous; Home the first, and End the last. Undefined for any other key, a key with a modifier,
 * or a press on none of the items. The caller prevents the key's default and moves focus.
 */
export function roved<T extends HTMLElement>(
  event: KeyboardEvent,
  items: readonly T[],
  host: Element,
): T | undefined {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return undefined;
  const from = items.indexOf(event.target as T);
  if (from === -1) return undefined;
  const step = getComputedStyle(host).direction === "rtl" ? -1 : 1;
  const to = {
    ArrowLeft: from - step,
    ArrowRight: from + step,
    Home: 0,
    End: items.length - 1,
  }[event.key];
  return to === undefined ? undefined : items[(to + items.length) % items.length];
}
