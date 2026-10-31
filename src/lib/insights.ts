import {
  EventRecord,
  GuestRsvpRecord,
  TaskRecord,
  VendorRecord,
} from '../types/domain';
import type { BudgetCalculationResult } from './deterministicEngine';
import { buildVendorChecklist } from './vendorChecklist';
import { diffDays } from './dates';

export type InsightSeverity = 'critical' | 'warning' | 'info' | 'success';

export interface Insight {
  id: string;
  severity: InsightSeverity;
  title: string;
  detail: string;
  /** Tab to navigate to when the user clicks the insight. */
  tab?: 'timeline' | 'budget' | 'vendors' | 'theme_rsvps' | 'custom_hotels' | 'checklist';
}

export interface ReadinessReport {
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  pillars: { label: string; score: number; weight: number }[];
  insights: Insight[];
}

const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));

/**
 * Deterministic "event readiness" score. Pure function, no I/O: the same
 * inputs always produce the same score, so it is trivially testable.
 */
export function computeReadiness(input: {
  event: EventRecord;
  tasks: TaskRecord[];
  budget: BudgetCalculationResult | null;
  vendors: VendorRecord[];
  rsvps: GuestRsvpRecord[];
  manualChecklist: Record<string, boolean>;
  today: string;
}): ReadinessReport {
  const { event, tasks, budget, vendors, rsvps, manualChecklist, today } = input;
  const insights: Insight[] = [];
  const daysOut = diffDays(today, event.date);

  // --- Schedule pillar -----------------------------------------------------
  const done = tasks.filter((t) => t.status === 'completed').length;
  const overdue = tasks.filter(
    (t) => t.status !== 'completed' && t.due_date && t.due_date < today
  );
  const delayed = tasks.filter((t) => t.status === 'delayed');
  const scheduleScore =
    tasks.length === 0 ? 40 : clamp((done / tasks.length) * 100 - overdue.length * 8 - delayed.length * 4);
  if (overdue.length > 0) {
    insights.push({
      id: 'overdue',
      severity: overdue.length >= 3 ? 'critical' : 'warning',
      title: `${overdue.length} task${overdue.length > 1 ? 's are' : ' is'} overdue`,
      detail: `Start with "${overdue[0].title}" (due ${overdue[0].due_date}).`,
      tab: 'timeline',
    });
  }
  if (tasks.length === 0) {
    insights.push({
      id: 'no-tasks',
      severity: 'warning',
      title: 'No timeline yet',
      detail: 'Add milestones or ask the AI assistant to draft a countdown timeline.',
      tab: 'timeline',
    });
  }

  // --- Budget pillar -------------------------------------------------------
  let budgetScore = 50;
  if (budget) {
    if (budget.statusLevel === 'CRITICAL_OVER_BUDGET') {
      budgetScore = clamp(60 - (budget.totalProjectedSpend / Math.max(1, budget.targetBudget) - 1) * 200);
      insights.push({
        id: 'over-budget',
        severity: 'critical',
        title: 'Projected spend is over budget',
        detail: `Over by $${Math.round(Math.abs(budget.remainingBudget)).toLocaleString()}. Trim a category or raise the cap.`,
        tab: 'budget',
      });
    } else if (budget.statusLevel === 'WARNING_85') {
      budgetScore = 75;
      insights.push({
        id: 'budget-tight',
        severity: 'warning',
        title: 'Budget is nearly fully allocated',
        detail: `${budget.burnRatePct}% used — only $${Math.round(budget.remainingBudget).toLocaleString()} of room left.`,
        tab: 'budget',
      });
    } else {
      budgetScore = budget.items.length === 0 ? 40 : 95;
      if (budget.items.length === 0) {
        insights.push({
          id: 'no-budget',
          severity: 'warning',
          title: 'No budget lines yet',
          detail: 'Add line items so PlanGenie can track spending against your target.',
          tab: 'budget',
        });
      }
    }
  }

  // --- Vendor pillar -------------------------------------------------------
  const checklist = buildVendorChecklist(event, vendors, manualChecklist, today);
  const essential = checklist.filter((c) => c.essential);
  const essentialBooked = essential.filter((c) => c.state === 'booked').length;
  const vendorScore = essential.length ? (essentialBooked / essential.length) * 100 : 100;
  const overdueVendors = checklist.filter((c) => c.overdue && c.essential);
  if (overdueVendors.length > 0) {
    insights.push({
      id: 'vendors-overdue',
      severity: 'warning',
      title: `${overdueVendors.length} essential vendor${overdueVendors.length > 1 ? 's' : ''} past recommended booking date`,
      detail: `Book ${overdueVendors
        .slice(0, 3)
        .map((v) => v.label.toLowerCase())
        .join(', ')} soon — availability shrinks fast.`,
      tab: 'checklist',
    });
  }
  const highRisk = vendors.filter((v) =>
    v.parsed_terms?.risk_clauses?.some((c) => c.severity === 'high')
  );
  if (highRisk.length > 0) {
    insights.push({
      id: 'vendor-risk',
      severity: 'warning',
      title: `High-risk contract clauses in ${highRisk.length} quote${highRisk.length > 1 ? 's' : ''}`,
      detail: `Review ${highRisk[0].name} before signing.`,
      tab: 'vendors',
    });
  }

  // --- Guest pillar --------------------------------------------------------
  const responded = rsvps.filter((r) => r.status !== 'pending').length;
  const guestScore = rsvps.length === 0 ? 30 : clamp((responded / rsvps.length) * 100);
  const pending = rsvps.filter((r) => r.status === 'pending').length;
  if (rsvps.length === 0) {
    insights.push({
      id: 'no-guests',
      severity: 'info',
      title: 'Guest list is empty',
      detail: 'Add guests to start tracking RSVPs and dietary needs.',
      tab: 'theme_rsvps',
    });
  } else if (pending > 0 && daysOut <= 45 && daysOut >= 0) {
    insights.push({
      id: 'rsvp-chase',
      severity: pending > rsvps.length / 2 ? 'critical' : 'warning',
      title: `${pending} guest${pending > 1 ? 's' : ''} haven't replied`,
      detail: `${daysOut} days to go — send a reminder and confirm headcount with your caterer.`,
      tab: 'theme_rsvps',
    });
  }
  const confirmedHeads = rsvps
    .filter((r) => r.status === 'confirmed')
    .reduce((s, r) => s + r.party_size, 0);
  if (confirmedHeads > event.guest_count) {
    insights.push({
      id: 'headcount',
      severity: 'warning',
      title: 'Confirmed guests exceed planned headcount',
      detail: `${confirmedHeads} confirmed vs ${event.guest_count} planned — update budget and catering.`,
      tab: 'budget',
    });
  }

  if (daysOut < 0) {
    insights.push({
      id: 'past',
      severity: 'info',
      title: 'This event date has passed',
      detail: 'Update the date if you are rescheduling.',
    });
  } else if (daysOut <= 14 && done < tasks.length) {
    insights.push({
      id: 'crunch',
      severity: 'warning',
      title: `${daysOut} days to go with ${tasks.length - done} tasks open`,
      detail: 'Switch to final-week mode: confirm vendors, headcount and day-of run sheet.',
      tab: 'timeline',
    });
  }

  const pillars = [
    { label: 'Schedule', score: Math.round(scheduleScore), weight: 0.3 },
    { label: 'Budget', score: Math.round(budgetScore), weight: 0.25 },
    { label: 'Vendors', score: Math.round(vendorScore), weight: 0.25 },
    { label: 'Guests', score: Math.round(guestScore), weight: 0.2 },
  ];
  const score = Math.round(pillars.reduce((s, p) => s + p.score * p.weight, 0));
  const grade = score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : score >= 40 ? 'D' : 'F';

  if (insights.length === 0) {
    insights.push({
      id: 'all-good',
      severity: 'success',
      title: 'Everything is on track',
      detail: 'No risks detected. Keep ticking off milestones!',
    });
  }
  const order: Record<InsightSeverity, number> = { critical: 0, warning: 1, info: 2, success: 3 };
  insights.sort((a, b) => order[a.severity] - order[b.severity]);
  return { score, grade, pillars, insights };
}
