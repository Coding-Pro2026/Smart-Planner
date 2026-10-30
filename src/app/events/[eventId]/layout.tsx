"use client";
import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { BarChart3, CalendarRange, FileText, Home, MessageSquareText, Settings, Sparkles, Users, UserCog } from "lucide-react";
import { useEvent, useEvents, useMe } from "@/lib/client/hooks";
import { ErrorNote, Spinner, cn } from "@/components/ui";
import { ApiError } from "@/lib/client/api";
import { useEventStream } from "@/lib/client/use-event-stream";

const TABS = [
  { href: "", label: "Dashboard", icon: Home, need: "tasks" },
  { href: "/budget", label: "Budget", icon: BarChart3, need: "all" },
  { href: "/timeline", label: "Timeline", icon: CalendarRange, need: "tasks" },
  { href: "/vendors", label: "Vendors", icon: FileText, need: "all" },
  { href: "/guests", label: "Guests", icon: Users, need: "all" },
  { href: "/assistant", label: "Assistant", icon: MessageSquareText, need: "write" },
  { href: "/team", label: "Team", icon: UserCog, need: "all" },
] as const;

export default function EventLayout({ children }: { children: ReactNode }) {
  const { eventId } = useParams<{ eventId: string }>();
  const path = usePathname();
  const router = useRouter();
  useMe();
  useEventStream(eventId);
  const ev = useEvent(eventId);
  const all = useEvents();
  const role = ev.data?.event.role;
  const tabs = TABS.filter((t) => (role === "vendor" ? t.need === "tasks" : role === "viewer" ? t.need !== "write" : true));

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <header className="mb-5 flex flex-wrap items-center gap-3">
        <Link href="/" className="flex items-center gap-1 font-bold text-brand"><Sparkles className="h-5 w-5" /> PlanGenie</Link>
        <select aria-label="Switch event" className="max-w-xs" value={eventId} onChange={(e) => router.push(`/events/${e.target.value}`)}>
          {all.data?.events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
        </select>
        <Link href="/settings" className="ml-auto text-muted hover:text-fg" aria-label="AI settings"><Settings className="h-5 w-5" /></Link>
      </header>
      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-line" aria-label="Event sections">
        {tabs.map((t) => {
          const href = `/events/${eventId}${t.href}`;
          const active = t.href === "" ? path === href : path.startsWith(href);
          return (
            <Link key={t.href} href={href} className={cn("flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm", active ? "border-brand font-medium text-brand" : "border-transparent text-muted hover:text-fg")}>
              <t.icon className="h-4 w-4" />{t.label}
            </Link>
          );
        })}
      </nav>
      {ev.isLoading ? <Spinner /> : ev.error ? <ErrorNote error={ev.error instanceof ApiError && ev.error.status === 404 ? new Error("Event not found") : ev.error} /> : children}
    </div>
  );
}
