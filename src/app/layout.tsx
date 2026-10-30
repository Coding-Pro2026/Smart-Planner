import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = { title: "PlanGenie — AI event planning", description: "Plan weddings, birthdays and community events with budgets, timelines, vendor checklists and AI ideas." };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
