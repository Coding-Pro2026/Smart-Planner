import { api, requireEvent } from "@/lib/http";
import { getEventRole } from "@/lib/authz";
import { bus, type Topic } from "@/lib/realtime";

export const dynamic = "force-dynamic";


/**
 * Server-Sent Events: emits `data: <topic>` whenever something in the event changes.
 * Membership is re-verified every 30 s on the open connection: a removed collaborator is disconnected
 * and a downgraded one (e.g. editor -> vendor) immediately starts receiving the filtered feed.
 */
export const GET = api({}, async ({ req, user, params }) => {
  const eventId = params.eventId!;
  const recheckMs = Number(process.env.STREAM_RECHECK_MS) || 30_000;
  let role = await requireEvent(user.id, eventId, "read_tasks");
  const enc = new TextEncoder();
  let closed = false;
  let off = () => {};
  let timer: ReturnType<typeof setInterval> | undefined;
  let ctrl!: ReadableStreamDefaultController<Uint8Array>;

  const close = () => {
    if (closed) return;
    closed = true;
    off();
    if (timer) clearInterval(timer);
    try { ctrl.close(); } catch { /* already closed */ }
  };
  const send = (s: string) => { if (!closed) { try { ctrl.enqueue(enc.encode(s)); } catch { close(); } } };

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c;
      send("retry: 3000\n\n: connected\n\n");
      off = bus.subscribe(eventId, (t: Topic) => { if (role !== "vendor" || t === "tasks") send(`data: ${t}\n\n`); });
      timer = setInterval(async () => {
        try {
          const r = await getEventRole(user.id, eventId);
          if (!r) return close();
          role = r;
          send(": ping\n\n");
        } catch { /* transient DB error: keep the stream, retry next tick */ }
      }, recheckMs);
      timer.unref?.();
    },
    cancel: close,
  });
  if (req.signal.aborted) close();
  else req.signal.addEventListener("abort", close, { once: true });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-store, no-transform", connection: "keep-alive", "x-accel-buffering": "no" } });
});
