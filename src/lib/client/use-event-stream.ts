"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

// Exactly the queries each topic can affect — nothing broader.
const KEYS: Record<string, string[]> = {
  event: ["event"], tasks: ["tasks"], budget: ["budget"], vendors: ["vendors"],
  rsvps: ["rsvps"], team: ["collabs", "audit"], proposals: ["tasks", "budget", "event", "vendors"],
};

/** Subscribes to server-sent change signals and refetches the affected queries (collaborators see edits live). */
export function useEventStream(eventId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const es = new EventSource(`/api/events/${eventId}/stream`);
    es.onmessage = (m) => {
      for (const k of KEYS[m.data] ?? []) qc.invalidateQueries({ queryKey: [k, eventId] });
      if (m.data === "event") qc.invalidateQueries({ queryKey: ["events"] }); // title/date shown in the switcher
    };
    // The browser auto-reconnects after network drops; a refused connection (removed from event) is final.
    es.onerror = () => { if (es.readyState === EventSource.CLOSED) es.close(); };
    return () => es.close();
  }, [eventId, qc]);
}
