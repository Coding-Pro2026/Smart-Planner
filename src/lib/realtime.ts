/**
 * Real-time fan-out. Publishes coarse "topic changed" signals (never data) to SSE subscribers; clients
 * then refetch through the normal authorised API, so the stream cannot leak anything the API wouldn't.
 * In-process by default; swap `bus` for a Redis/Upstash pub-sub implementation to run multiple instances.
 */
export type Topic = "event" | "tasks" | "budget" | "vendors" | "rsvps" | "team" | "proposals";
type Listener = (t: Topic) => void;

export interface Bus {
  publish(eventId: string, topic: Topic): void;
  subscribe(eventId: string, fn: Listener): () => void;
}

class MemoryBus implements Bus {
  private subs = new Map<string, Set<Listener>>();
  publish(eventId: string, topic: Topic) {
    // Small delay so listeners refetch AFTER the originating transaction has committed.
    setTimeout(() => this.subs.get(eventId)?.forEach((fn) => fn(topic)), 120).unref?.();
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
