/**
 * Real-time fan-out. Publishes coarse "topic changed" signals (never data) to SSE subscribers; clients
 * then refetch through the normal authorised API, so the stream cannot leak anything the API wouldn't.
 * In-process by default; swap `bus` for a Redis/Upstash pub-sub implementation to run multiple instances.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export type Topic = "event" | "tasks" | "budget" | "vendors" | "rsvps" | "team" | "proposals";
type Listener = (t: Topic) => void;

export interface Bus {
  publish(eventId: string, topic: Topic): void;
  subscribe(eventId: string, fn: Listener): () => void;
}

class MemoryBus implements Bus {
  private subs = new Map<string, Set<Listener>>();
  publish(eventId: string, topic: Topic) {
    this.subs.get(eventId)?.forEach((fn) => fn(topic));
  }
  subscribe(eventId: string, fn: Listener) {
    const set = this.subs.get(eventId) ?? new Set();
    set.add(fn);
    this.subs.set(eventId, set);
    return () => {
      set.delete(fn);
      if (!set.size) this.subs.delete(eventId);
    };
  }
}

const g = globalThis as unknown as { __pgBus?: Bus };
export const bus: Bus = (g.__pgBus ??= new MemoryBus());

export function topicFor(action: string): Topic {
  const p = action.split(".")[0];
  switch (p) {
    case "task": case "schedule": case "starter_plan": return "tasks";
    case "budget": return "budget";
    case "vendor": return "vendors";
    case "rsvp": return "rsvps";
    case "collaborator": return "team";
    case "proposal": return "proposals";
    default: return "event";
  }
}

/**
 * Signals raised while a request is running (e.g. inside a DB transaction) are queued and only
 * published once the handler has finished successfully — i.e. after every transaction has committed.
 * If the handler throws (rollback), the queue is discarded, so no spurious signals are sent.
 */
const pending = new AsyncLocalStorage<Map<string, Set<Topic>>>();

export function queueSignal(eventId: string, topic: Topic) {
  const q = pending.getStore();
  if (!q) return bus.publish(eventId, topic); // outside a request: nothing to wait for
  q.set(eventId, (q.get(eventId) ?? new Set()).add(topic));
}

export async function withSignals<T>(fn: () => Promise<T>): Promise<T> {
  const q = new Map<string, Set<Topic>>();
  const result = await pending.run(q, fn);
  for (const [eventId, topics] of q) for (const t of topics) bus.publish(eventId, t);
  return result;
}
