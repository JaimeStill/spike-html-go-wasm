// A component's subscription to a model it renders from, shared: every component that reads a
// model its owner writes listens to that model's change event, and only while it holds the model
// and is in the document, so a model it no longer holds, or one outliving a removed component,
// never calls it. A Lit reactive controller, it checks the model the host holds as the host
// connects, disconnects, and updates, so a property set to another model moves the listener
// with it before the host renders.

import type { ReactiveController, ReactiveControllerHost } from "lit";

/**
 * Listens to the change event of the model `held` reads from the host, calling `changed` on each,
 * while the host is in the document; to no other model, and to none while the host is out of it.
 * `taken`, when given, is called as the model listened to is replaced, with the new one or null.
 */
export class Subscription<T extends EventTarget> implements ReactiveController {
  readonly #host: ReactiveControllerHost & Element;
  readonly #held: () => T | null;
  readonly #changed: () => void;
  readonly #taken: ((model: T | null) => void) | undefined;
  /** The model listened to: the one held, while the host is in the document. */
  #heard: T | null = null;

  constructor(
    host: ReactiveControllerHost & Element,
    held: () => T | null,
    changed: () => void,
    taken?: (model: T | null) => void,
  ) {
    this.#host = host;
    this.#held = held;
    this.#changed = changed;
    this.#taken = taken;
    host.addController(this);
  }

  hostConnected(): void {
    this.#listen();
  }

  hostDisconnected(): void {
    this.#listen();
  }

  hostUpdate(): void {
    this.#listen();
  }

  /** Listens to the model the host holds while it is in the document, and to no other. */
  #listen(): void {
    const next = this.#host.isConnected ? this.#held() : null;
    if (next === this.#heard) return;
    this.#heard?.removeEventListener("change", this.#changed);
    next?.addEventListener("change", this.#changed);
    this.#heard = next;
    this.#taken?.(next);
  }
}
