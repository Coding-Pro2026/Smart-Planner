"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { api, ApiError } from "./api";

export interface EventDto { id: string; title: string; eventType: "wedding" | "birthday" | "community"; date: string; location: string | null; guestCount: number; targetBudget: number; actualSpend: number; currency: string; theme: Palette | null; role?: string }
export interface Palette { colors: { hex: string; name: string }[]; styleKeywords: string[]; decorElements: string[]; dietarySuggestions: string[]; summary: string }

export function useMe() {
  const router = useRouter();
  const q = useQuery({ queryKey: ["me"], queryFn: () => api<{ user: { id: string; email: string }; vaultEnabled: boolean }>("/auth/me") });
  useEffect(() => {
    if (q.error instanceof ApiError && q.error.status === 401) router.replace("/login");
  }, [q.error, router]);
  return q;
}

export const useEvents = () => useQuery({ queryKey: ["events"], queryFn: () => api<{ events: EventDto[] }>("/events") });
export const useEvent = (id: string) => useQuery({ queryKey: ["event", id], queryFn: () => api<{ event: EventDto }>(`/events/${id}`) });
