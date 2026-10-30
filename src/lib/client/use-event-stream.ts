"use client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

const KEYS: Record<string, string[]> = {
  event: ["event", "events"], tasks: ["tasks"], budget: ["budget", "event"], vendors: ["vendors", "budget"],
  rsvps: ["rsvps"], team: ["collabs", "audit"], proposals: ["tasks", "budget", "event"],
};

/** Subscribes to server-sent change signals and refetches the affected queries (collaborators see edits live). */
export function useEventStream(eventId: string) {
  const qc = useQueryClient();
  useEffect(() => {
    const es = new EventSource(`/api/events/${eventId}/stream`);
    es.onmessage = (m) => {
      for (const k of KEYS[m.data] ?? []) qc.invalidateQueries({ queryKey: [k] });
    };
    return () => es.close();
  }, [eventId, qc]);
}
