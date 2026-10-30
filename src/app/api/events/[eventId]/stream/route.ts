import { api, requireEvent } from "@/lib/http";
import { bus, type Topic } from "@/lib/realtime";

export const dynamic = "force-dynamic";

/** Server-Sent Events: emits `data: <topic>` whenever something in the event changes. */
export const GET = api({}, async ({ req, user, params }) => {
  const eventId = params.eventId!;
  const role = await requireEvent(user.id, eventId, "read_tasks");
  const enc = new TextEncoder();
  let off = () => {};
  let beat: ReturnType<typeof setInterval>;
  const stream = new ReadableStream({
    start(ctrl) {
      const send = (s: string) => { try { ctrl.enqueue(enc.encode(s)); } catch { /* closed */ } };
      send("retry: 3000\n\n: connected\n\n");
      // Vendors only learn about timeline changes (they can't read the other data anyway).
      off = bus.subscribe(eventId, (t: Topic) => { if (role !== "vendor" || t === "tasks") send(`data: ${t}\n\n`); });
      beat = setInterval(() => send(": ping\n\n"), 25_000);
      req.signal.addEventListener("abort", () => { off(); clearInterval(beat); try { ctrl.close(); } catch { /* already closed */ } });
    },
    cancel() { off(); clearInterval(beat); },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
});
