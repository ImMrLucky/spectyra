import type { SpectyraEvent } from "./types.js";

export type Unsubscribe = () => void;

/**
 * In-memory pub/sub for normalized events (SDK, companion, desktop bridge).
 */
export function createLocalEventBus(): {
  publish: (event: SpectyraEvent) => void;
  subscribe: (handler: (event: SpectyraEvent) => void) => Unsubscribe;
  snapshot: () => SpectyraEvent[];
} {
  const handlers = new Set<(event: SpectyraEvent) => void>();
  const buffer: SpectyraEvent[] = [];
  const maxBuffer = 2000;

  return {
    publish(event: SpectyraEvent) {
      handlers.forEach((h) => {
        try {
          h(event);
        } catch {
          /* host must not crash bus */
        }
      });
      buffer.push(event);
      if (buffer.length > maxBuffer) buffer.splice(0, buffer.length - maxBuffer);
    },
    subscribe(handler: (event: SpectyraEvent) => void): Unsubscribe {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    snapshot: () => [...buffer],
  };
}
