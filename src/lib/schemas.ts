import { z } from "zod";

const str = (min: number, max: number) => z.string().trim().min(min).max(max);
export const isoDateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine((s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s), "Invalid date");
const money = z.number().finite().min(0).max(1e9);
const pct = z.number().finite().min(0).max(100);

export const registerSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(10, "Use at least 10 characters").max(200) });
export const loginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(1).max(200) });

export const eventInput = z.object({
  title: str(1, 120),
  eventType: z.enum(["wedding", "birthday", "community"]),
  date: isoDateStr,
  location: str(0, 200).nullish(),
  guestCount: z.number().int().min(0).max(100_000),
  targetBudget: money,
  currency: z.string().trim().toUpperCase().length(3).default("USD"),
  seedStarterPlan: z.boolean().default(false),
});
export const eventPatch = eventInput.omit({ seedStarterPlan: true, eventType: true }).partial();

export const budgetItemInput = z.object({
  name: str(1, 160),
  category: str(1, 60),
  unitCost: money,
  quantity: z.number().finite().min(0).max(1e6).default(1),
  taxPct: pct.default(0),
  contingencyPct: pct.default(0),
  perGuest: z.boolean().default(false),
  actualCost: money.nullish(),
  status: z.enum(["planned", "quoted", "booked", "paid"]).default("planned"),
  vendorId: z.string().max(40).nullish(),
  notes: str(0, 1000).nullish(),
});
export const budgetItemPatch = budgetItemInput.partial();

export const taskInput = z.object({
  title: str(1, 160),
  category: str(1, 60).default("general"),
  startDate: isoDateStr,
  dueDate: isoDateStr,
  bufferDays: z.number().int().min(0).max(365).default(0),
  status: z.enum(["todo", "in_progress", "done", "blocked"]).default("todo"),
  assignedTo: str(0, 80).nullish(),
  dependencies: z.array(z.string().max(40)).max(25).default([]),
});
export const taskPatch = taskInput.partial();
export const shiftInput = z.object({ taskId: z.string().max(40), days: z.number().int().min(-365).max(365), preview: z.boolean().default(false) });

export const vendorInput = z.object({
  name: str(1, 120),
  serviceType: str(1, 60),
  quoteAmount: money.nullish(),
  status: z.enum(["researching", "quoted", "booked", "rejected"]).default("researching"),
});
export const vendorPatch = vendorInput.partial();
export const compareInput = z.object({ vendorIds: z.array(z.string().max(40)).min(2).max(6) });

export const rsvpInput = z.object({
  guestName: str(1, 120),
  contact: str(0, 200).nullish(),
  status: z.enum(["invited", "accepted", "declined", "maybe"]).default("invited"),
  dietaryRequirements: str(0, 300).nullish(),
  seatingTable: str(0, 40).nullish(),
});
export const rsvpPatch = rsvpInput.partial();

export const collaboratorInput = z.object({ email: z.string().trim().toLowerCase().email(), role: z.enum(["editor", "viewer", "vendor"]) });

export const chatInput = z.object({
  message: z.string().trim().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).max(12).default([]),
  image: z.object({ mime: z.enum(["image/png", "image/jpeg", "image/webp"]), base64: z.string().max(7_000_000) }).optional(),
});
export const decisionInput = z.object({ decision: z.enum(["accept", "reject"]) });

export const vaultPutInput = z.object({
  provider: z.enum(["openai", "anthropic", "google", "openrouter", "ollama", "custom"]),
  apiKey: z.string().trim().min(1).max(500).optional(),
  baseUrl: z.string().trim().url().max(300).optional(),
  fastModel: z.string().trim().min(1).max(120),
  reasoningModel: z.string().trim().min(1).max(120),
});
export const validateKeyInput = vaultPutInput;
