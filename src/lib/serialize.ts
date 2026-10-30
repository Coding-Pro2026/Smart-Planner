import type { Prisma } from "@prisma/client";
import { isoDate, num } from "./services/common";

type Event = Prisma.EventGetPayload<object>;
type Task = Prisma.TaskGetPayload<object>;
type Budget = Prisma.BudgetItemGetPayload<object>;
type Vendor = Prisma.VendorGetPayload<object>;

export const serializeEvent = (e: Event, role?: string) => ({
  id: e.id, title: e.title, eventType: e.eventType, date: isoDate(e.date), location: e.location, guestCount: e.guestCount,
  targetBudget: num(e.targetBudget), actualSpend: num(e.actualSpend), currency: e.currency, theme: e.theme, role,
});
export const serializeTask = (t: Task) => ({
  id: t.id, title: t.title, category: t.category, startDate: isoDate(t.startDate), dueDate: isoDate(t.dueDate), bufferDays: t.bufferDays,
  status: t.status, assignedTo: t.assignedTo, dependencies: t.dependencies, isCriticalPath: t.isCriticalPath,
});
export const serializeBudgetItem = (b: Budget) => ({
  id: b.id, name: b.name, category: b.category, unitCost: num(b.unitCost), quantity: num(b.quantity), taxPct: num(b.taxPct),
  contingencyPct: num(b.contingencyPct), perGuest: b.perGuest, estimatedCost: num(b.estimatedCost),
  actualCost: b.actualCost == null ? null : num(b.actualCost), status: b.status, vendorId: b.vendorId, notes: b.notes,
});
export const serializeVendor = (v: Vendor) => ({
  id: v.id, name: v.name, serviceType: v.serviceType, quoteAmount: v.quoteAmount == null ? null : num(v.quoteAmount),
  status: v.status, contractUrl: v.contractUrl, parsedTerms: v.parsedTerms,
});
