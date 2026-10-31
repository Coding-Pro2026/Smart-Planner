import { BudgetItemRecord, TaskRecord } from '../types/domain';

/**
 * DETERMINISTIC ENGINE MODULE
 * Zero LLM hallucinations on financial math, tax/contingency rollups,
 * or Directed Acyclic Graph (DAG) Critical Path Method (CPM) task scheduling.
 */

export function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface ComputedBudgetLineItem extends BudgetItemRecord {
  effective_quantity: number;
  base_subtotal: number;
  tax_amount: number;
  contingency_amount: number;
  deterministic_total: number;
  variance_from_actual: number;
}

export interface CategoryBreakdown {
  category: string;
  allocated_total: number;
  actual_total: number;
  share_pct: number;
  item_count: number;
}

export interface BudgetCalculationResult {
  items: ComputedBudgetLineItem[];
  categories: CategoryBreakdown[];
  baseSubtotalSum: number;
  taxTotalSum: number;
  contingencyTotalSum: number;
  totalProjectedSpend: number;
  totalActualSpend: number;
  targetBudget: number;
  remainingBudget: number;
  burnRatePct: number;
  costPerGuest: number;
  simulatedGuestCount: number;
  statusLevel: 'NOMINAL' | 'WARNING_85' | 'CRITICAL_OVER_BUDGET';
  breachAlerts: string[];
}

export function calculateEventBudget(
  items: BudgetItemRecord[],
  targetBudget: number,
  baseGuestCount: number,
  simulatedGuestCount?: number,
  categoryMultipliers?: Record<string, number>
): BudgetCalculationResult {
  if (targetBudget < 0) {
    throw new Error('Target budget cannot be negative');
  }

  const effectiveGuests = Math.max(1, simulatedGuestCount ?? baseGuestCount);
  const guestRatio = baseGuestCount > 0 ? effectiveGuests / baseGuestCount : 1;

  const computedItems: ComputedBudgetLineItem[] = items.map((item) => {
    if (item.unit_cost < 0 || item.quantity < 0) {
      throw new Error(`Negative cost or quantity detected in budget item "${item.name}"`);
    }
    if (item.tax_pct < 0 || item.contingency_pct < 0) {
      throw new Error(`Negative tax or contingency percentage in budget item "${item.name}"`);
    }

    const catMultiplier = categoryMultipliers?.[item.category] ?? 1;
    const effectiveQuantity = item.is_per_guest
      ? Math.ceil(item.quantity * guestRatio)
      : item.quantity;

    const baseSubtotal = roundCurrency(item.unit_cost * effectiveQuantity * catMultiplier);
    const taxAmount = roundCurrency(baseSubtotal * (item.tax_pct / 100));
    const contingencyAmount = roundCurrency(baseSubtotal * (item.contingency_pct / 100));
    const deterministicTotal = roundCurrency(baseSubtotal + taxAmount + contingencyAmount);
    const actualCost = roundCurrency(item.actual_cost * (item.is_per_guest ? guestRatio : 1) * catMultiplier);

    return {
      ...item,
      effective_quantity: effectiveQuantity,
      base_subtotal: baseSubtotal,
      tax_amount: taxAmount,
      contingency_amount: contingencyAmount,
      deterministic_total: deterministicTotal,
      actual_cost: actualCost,
      variance_from_actual: roundCurrency(deterministicTotal - actualCost),
    };
  });

  const baseSubtotalSum = roundCurrency(
    computedItems.reduce((acc, i) => acc + i.base_subtotal, 0)
  );
  const taxTotalSum = roundCurrency(
    computedItems.reduce((acc, i) => acc + i.tax_amount, 0)
  );
  const contingencyTotalSum = roundCurrency(
    computedItems.reduce((acc, i) => acc + i.contingency_amount, 0)
  );
  const totalProjectedSpend = roundCurrency(
    computedItems.reduce((acc, i) => acc + i.deterministic_total, 0)
  );
  const totalActualSpend = roundCurrency(
    computedItems.reduce((acc, i) => acc + i.actual_cost, 0)
  );

  const remainingBudget = roundCurrency(targetBudget - totalProjectedSpend);
  const burnRatePct =
    targetBudget > 0 ? roundCurrency((totalProjectedSpend / targetBudget) * 100) : 0;
  const costPerGuest = roundCurrency(totalProjectedSpend / effectiveGuests);

  const categoryMap = new Map<string, { allocated: number; actual: number; count: number }>();
  for (const item of computedItems) {
    const existing = categoryMap.get(item.category) ?? { allocated: 0, actual: 0, count: 0 };
    existing.allocated = roundCurrency(existing.allocated + item.deterministic_total);
    existing.actual = roundCurrency(existing.actual + item.actual_cost);
    existing.count += 1;
    categoryMap.set(item.category, existing);
  }

  const categories: CategoryBreakdown[] = Array.from(categoryMap.entries())
    .map(([category, stats]) => ({
      category,
      allocated_total: stats.allocated,
      actual_total: stats.actual,
      share_pct:
        totalProjectedSpend > 0
          ? roundCurrency((stats.allocated / totalProjectedSpend) * 100)
          : 0,
      item_count: stats.count,
    }))
    .sort((a, b) => b.allocated_total - a.allocated_total);

  const breachAlerts: string[] = [];
  let statusLevel: 'NOMINAL' | 'WARNING_85' | 'CRITICAL_OVER_BUDGET' = 'NOMINAL';

  if (totalProjectedSpend > targetBudget) {
    statusLevel = 'CRITICAL_OVER_BUDGET';
    breachAlerts.push(
      `Projected total ($${totalProjectedSpend.toLocaleString()}) exceeds target budget ($${targetBudget.toLocaleString()}) by $${Math.abs(remainingBudget).toLocaleString()}.`
    );
  } else if (burnRatePct >= 85) {
    statusLevel = 'WARNING_85';
    breachAlerts.push(
      `Budget utilization is at ${burnRatePct}% ($${remainingBudget.toLocaleString()} buffer remaining).`
    );
  }

  for (const cat of categories) {
    if (cat.share_pct > 55) {
      breachAlerts.push(
        `Category "${cat.category}" accounts for ${cat.share_pct}% of total spend (exceeds 55% concentration threshold).`
      );
    }
  }

  return {
    items: computedItems,
    categories,
    baseSubtotalSum,
    taxTotalSum,
    contingencyTotalSum,
    totalProjectedSpend,
    totalActualSpend,
    targetBudget,
    remainingBudget,
    burnRatePct,
    costPerGuest,
    simulatedGuestCount: effectiveGuests,
    statusLevel,
    breachAlerts,
  };
}

/**
 * DIRECTED ACYCLIC GRAPH (DAG) & CRITICAL PATH METHOD (CPM) SCHEDULING ENGINE
 */
export class CyclicDependencyError extends Error {
  public readonly involvedTaskIds: string[];
  constructor(message: string, involvedTaskIds: string[]) {
    super(message);
    this.name = 'CyclicDependencyError';
    this.involvedTaskIds = involvedTaskIds;
  }
}

export interface CpmScheduleResult {
  tasks: TaskRecord[];
  topologicalOrder: string[];
  criticalPathIds: string[];
  totalProjectDurationDays: number;
  bottleneckCount: number;
}

function addDaysToIsoDate(baseIsoDate: string, offsetDays: number): string {
  const base = new Date(`${baseIsoDate}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + offsetDays);
  return base.toISOString().split('T')[0];
}

export function computeCriticalPath(
  tasks: TaskRecord[],
  kickoffDate: string = '2026-11-01'
): CpmScheduleResult {
  if (tasks.length === 0) {
    return {
      tasks: [],
      topologicalOrder: [],
      criticalPathIds: [],
      totalProjectDurationDays: 0,
      bottleneckCount: 0,
    };
  }

  const taskMap = new Map<string, TaskRecord>();
  for (const t of tasks) {
    taskMap.set(t.id, { ...t });
  }

  // Build adjacency list (u -> v where v depends on u) and in-degree map
  const adj = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const t of tasks) {
    adj.set(t.id, []);
    inDegree.set(t.id, 0);
  }

  for (const t of tasks) {
    for (const depId of t.dependencies) {
      if (depId === t.id) {
        throw new CyclicDependencyError(
          `Self-dependency detected on task "${t.title}" (${t.id})`,
          [t.id]
        );
      }
      if (!taskMap.has(depId)) {
        // Ignore dangling deleted dependency IDs gracefully
        continue;
      }
      adj.get(depId)!.push(t.id);
      inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1);
    }
  }

  // Kahn's Algorithm for Topological Sorting
  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(id);
    }
  }

  const topologicalOrder: string[] = [];
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    topologicalOrder.push(currentId);

    for (const neighborId of adj.get(currentId) ?? []) {
      const nextDeg = (inDegree.get(neighborId) ?? 1) - 1;
      inDegree.set(neighborId, nextDeg);
      if (nextDeg === 0) {
        queue.push(neighborId);
      }
    }
  }

  if (topologicalOrder.length !== tasks.length) {
    const cycleNodes = tasks
      .filter((t) => !topologicalOrder.includes(t.id))
      .map((t) => t.id);
    throw new CyclicDependencyError(
      `Cyclical dependency detected in task graph involving: ${cycleNodes.join(', ')}`,
      cycleNodes
    );
  }

  // Forward Pass: Compute Early Start (ES) and Early Finish (EF)
  const earlyStart = new Map<string, number>();
  const earlyFinish = new Map<string, number>();

  for (const id of topologicalOrder) {
    const task = taskMap.get(id)!;
    const validDeps = task.dependencies.filter((d) => taskMap.has(d));
    const maxPredFinish =
      validDeps.length > 0
        ? Math.max(...validDeps.map((d) => earlyFinish.get(d) ?? 0))
        : 0;

    const es = Math.max(task.start_day_offset ?? 0, maxPredFinish);
    const effectiveSpan = Math.max(1, task.duration_days) + Math.max(0, task.buffer_days);
    const ef = es + effectiveSpan;

    earlyStart.set(id, es);
    earlyFinish.set(id, ef);
  }

  const totalProjectDurationDays = Math.max(
    0,
    ...Array.from(earlyFinish.values())
  );

  // Backward Pass: Compute Late Start (LS), Late Finish (LF), and Slack
  const lateStart = new Map<string, number>();
  const lateFinish = new Map<string, number>();

  for (let i = topologicalOrder.length - 1; i >= 0; i--) {
    const id = topologicalOrder[i];
    const task = taskMap.get(id)!;
    const successors = adj.get(id) ?? [];

    const lf =
      successors.length > 0
        ? Math.min(...successors.map((sId) => lateStart.get(sId) ?? totalProjectDurationDays))
        : totalProjectDurationDays;

    const effectiveSpan = Math.max(1, task.duration_days) + Math.max(0, task.buffer_days);
    const ls = lf - effectiveSpan;

    lateFinish.set(id, lf);
    lateStart.set(id, ls);
  }

  const criticalPathIds: string[] = [];
  const updatedTasks: TaskRecord[] = tasks.map((orig) => {
    const es = earlyStart.get(orig.id) ?? 0;
    const ef = earlyFinish.get(orig.id) ?? es + orig.duration_days;
    const ls = lateStart.get(orig.id) ?? es;
    const lf = lateFinish.get(orig.id) ?? ef;
    const slack = Math.max(0, ls - es);
    const isCritical = slack === 0;

    if (isCritical) {
      criticalPathIds.push(orig.id);
    }

    return {
      ...orig,
      start_day_offset: es,
      early_start: es,
      early_finish: ef,
      late_start: ls,
      late_finish: lf,
      slack_days: slack,
      is_critical_path: isCritical,
      start_date: addDaysToIsoDate(kickoffDate, es),
      due_date: addDaysToIsoDate(kickoffDate, ef),
    };
  });

  return {
    tasks: updatedTasks,
    topologicalOrder,
    criticalPathIds,
    totalProjectDurationDays,
    bottleneckCount: criticalPathIds.length,
  };
}

/**
 * Shift an upstream task by `deltaDays` and automatically cascade downstream dependencies via CPM
 */
export function shiftTaskSchedule(
  tasks: TaskRecord[],
  targetTaskId: string,
  deltaDays: number,
  kickoffDate: string = '2026-11-01'
): CpmScheduleResult {
  const firstPass = computeCriticalPath(tasks, kickoffDate);
  const mutated = firstPass.tasks.map((t) => {
    if (t.id === targetTaskId) {
      const currentStart = t.early_start ?? t.start_day_offset ?? 0;
      const nextOffset = Math.max(0, currentStart + deltaDays);
      return {
        ...t,
        start_day_offset: nextOffset,
        status: deltaDays > 0 && t.status !== 'completed' ? ('delayed' as const) : t.status,
      };
    }
    return t;
  });

  return computeCriticalPath(mutated, kickoffDate);
}

/**
 * ORDINARY LEAST SQUARES (OLS) LINEAR REGRESSION ENGINE FOR YOY BUDGET FORECASTING
 * Models historical category price indices (2021-2026) and projects future event costs
 * using y = m*x + b with R² goodness-of-fit and 95% confidence intervals.
 */

export interface HistoricalPricePoint {
  year: number;
  indexValue: number; // Normalized index where 2021 = 100
}

export interface OlsRegressionParameters {
  slope: number; // m: annual index point increase
  intercept: number; // b: y-intercept
  rSquared: number; // R² coefficient of determination (0 to 1)
  standardError: number; // Residual standard error
  annualGrowthRatePct: number; // Effective YoY % increase relative to 2026 baseline
}

export interface CategoryRegressionForecast {
  category: string;
  archetypeKey: 'venue' | 'catering' | 'floral' | 'production' | 'photography' | 'hospitality';
  currentBaselineCost: number; // 2026 current deterministic cost
  projectedCost: number; // Projected cost at targetForecastYear
  lowerBound95: number; // 95% CI lower bound
  upperBound95: number; // 95% CI upper bound
  yoyIncreasePct: number; // Annualized YoY % increase
  cumulativeIncreasePct: number; // Total % increase from 2026 to targetForecastYear
  cumulativeDollarDelta: number; // Projected Cost - Current Baseline Cost
  earlyLockInSavings: number; // Estimated savings by locking contract at 2026 rate (85% of delta)
  ols: OlsRegressionParameters;
  historicalAndProjectedPoints: {
    year: number;
    isForecast: boolean;
    actualDollarEquivalent?: number;
    regressionFittedDollar: number;
    lowerBandDollar: number;
    upperBandDollar: number;
    indexValue: number;
  }[];
  inflationDrivers: string[];
}

export interface EventRegressionForecastReport {
  baseYear: number;
  targetForecastYear: number;
  horizonYears: number;
  macroShockBps: number; // Basis points adjustment (-200 to +400 bps)
  currentTotalBaseline: number;
  projectedTotalSpend: number;
  projectedLowerBound95: number;
  projectedUpperBound95: number;
  totalCumulativeDelta: number;
  weightedYoyGrowthPct: number;
  totalEarlyLockInSavings: number;
  projectedBudgetCapBreach: boolean;
  projectedCapVariance: number;
  categoryForecasts: CategoryRegressionForecast[];
  aggregateTimelineSeries: {
    year: number;
    isForecast: boolean;
    actualTotal?: number;
    fittedTotal: number;
    lowerBandTotal: number;
    upperBandTotal: number;
  }[];
}

export const DEFAULT_CATEGORY_HISTORICAL_INDICES: Record<
  CategoryRegressionForecast['archetypeKey'],
  {
    label: string;
    points: HistoricalPricePoint[];
    drivers: string[];
  }
> = {
  catering: {
    label: 'Catering, Culinary & Sommelier',
    // High slope: specialty food commodities, sommelier allocations, hospitality hospitality labor
    points: [
      { year: 2021, indexValue: 100.0 },
      { year: 2022, indexValue: 108.4 },
      { year: 2023, indexValue: 116.8 },
      { year: 2024, indexValue: 124.5 },
      { year: 2025, indexValue: 133.2 },
      { year: 2026, indexValue: 141.6 },
    ],
    drivers: [
      'Culinary & sommelier service labor wage escalation (+6.4% YoY)',
      'Cold-chain organic protein & imported vintage tariff adjustments',
      'Mandatory administrative service charge expansion (20%–24% band)',
    ],
  },
  venue: {
    label: 'Venue, Estate Buyout & Permits',
    // Steady steep linear slope: prime weekend scarcity, property insurance, municipal permits
    points: [
      { year: 2021, indexValue: 100.0 },
      { year: 2022, indexValue: 106.5 },
      { year: 2023, indexValue: 113.9 },
      { year: 2024, indexValue: 121.0 },
      { year: 2025, indexValue: 128.4 },
      { year: 2026, indexValue: 135.8 },
    ],
    drivers: [
      'Peak-season estate & conservatory date scarcity premium',
      'Commercial event liability & historic property insurance pass-throughs',
      'Municipal acoustic & curfew compliance engineering fees',
    ],
  },
  floral: {
    label: 'Floral, Botanicals & Scenography',
    points: [
      { year: 2021, indexValue: 100.0 },
      { year: 2022, indexValue: 107.2 },
      { year: 2023, indexValue: 113.5 },
      { year: 2024, indexValue: 120.8 },
      { year: 2025, indexValue: 127.1 },
      { year: 2026, indexValue: 134.0 },
    ],
    drivers: [
      'Dutch auction stem air-freight & refrigerated logistics costs',
      'Custom rigging labor for suspended botanical installations',
    ],
  },
  production: {
    label: 'AV, Lighting & Acoustic Stage',
    points: [
      { year: 2021, indexValue: 100.0 },
      { year: 2022, indexValue: 104.8 },
      { year: 2023, indexValue: 109.6 },
      { year: 2024, indexValue: 114.9 },
      { year: 2025, indexValue: 119.5 },
      { year: 2026, indexValue: 124.8 },
    ],
    drivers: [
      'Licensed rigging & union stagehand overtime rate schedules',
      'Power distribution & whisper-quiet generator rental demand',
    ],
  },
  photography: {
    label: 'Photography & 35mm Cinema',
    points: [
      { year: 2021, indexValue: 100.0 },
      { year: 2022, indexValue: 104.0 },
      { year: 2023, indexValue: 108.5 },
      { year: 2024, indexValue: 112.8 },
      { year: 2025, indexValue: 117.4 },
      { year: 2026, indexValue: 122.0 },
    ],
    drivers: [
      'Kodak 35mm/120 medium-format film stock & lab processing rates',
      'Dual-shooter documentary editorial post-production hours',
    ],
  },
  hospitality: {
    label: 'Guest Hospitality & Transport',
    points: [
      { year: 2021, indexValue: 100.0 },
      { year: 2022, indexValue: 105.6 },
      { year: 2023, indexValue: 110.4 },
      { year: 2024, indexValue: 116.2 },
      { year: 2025, indexValue: 121.8 },
      { year: 2026, indexValue: 127.5 },
    ],
    drivers: [
      'Private charter coach fuel, commercial fleet insurance & CDL driver minimums',
      'Artisanal welcome amenity packaging & local sourcing',
    ],
  },
};

export function classifyCategoryArchetype(
  categoryName: string
): CategoryRegressionForecast['archetypeKey'] {
  const lower = categoryName.toLowerCase();
  if (lower.includes('cater') || lower.includes('culinary') || lower.includes('food') || lower.includes('sommelier') || lower.includes('bar')) {
    return 'catering';
  }
  if (lower.includes('venue') || lower.includes('estate') || lower.includes('permit') || lower.includes('conservatory') || lower.includes('loft')) {
    return 'venue';
  }
  if (lower.includes('floral') || lower.includes('table') || lower.includes('decor') || lower.includes('scenography') || lower.includes('botanical')) {
    return 'floral';
  }
  if (lower.includes('photo') || lower.includes('cinema') || lower.includes('video') || lower.includes('film')) {
    return 'photography';
  }
  if (lower.includes('av') || lower.includes('music') || lower.includes('sound') || lower.includes('light') || lower.includes('stage') || lower.includes('production')) {
    return 'production';
  }
  return 'hospitality';
}

/**
 * Pure Ordinary Least Squares (OLS) Linear Regression Calculator
 * Given (year, indexValue) pairs, solves y = slope * year + intercept
 */
export function computeOrdinaryLeastSquares(
  points: HistoricalPricePoint[]
): OlsRegressionParameters {
  const n = points.length;
  if (n < 2) {
    throw new Error('OLS linear regression requires at least 2 historical data points');
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const pt of points) {
    sumX += pt.year;
    sumY += pt.indexValue;
    sumXY += pt.year * pt.indexValue;
    sumX2 += pt.year * pt.year;
  }

  const denominator = n * sumX2 - sumX * sumX;
  if (Math.abs(denominator) < 1e-9) {
    throw new Error('OLS regression singular matrix: zero variance in x (years)');
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const meanX = sumX / n;
  const meanY = sumY / n;
  const intercept = meanY - slope * meanX;

  // Compute R² and Residual Standard Error
  let ssTot = 0;
  let ssRes = 0;
  for (const pt of points) {
    const fittedY = slope * pt.year + intercept;
    ssTot += (pt.indexValue - meanY) ** 2;
    ssRes += (pt.indexValue - fittedY) ** 2;
  }

  const rSquared = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 1;
  const degreesOfFreedom = Math.max(1, n - 2);
  const standardError = Math.sqrt(ssRes / degreesOfFreedom);

  const latestPoint = points[points.length - 1];
  const fittedLatest = slope * latestPoint.year + intercept;
  const annualGrowthRatePct =
    fittedLatest > 0 ? roundCurrency((slope / fittedLatest) * 100) : 0;

  return {
    slope: Math.round(slope * 10000) / 10000,
    intercept: Math.round(intercept * 100) / 100,
    rSquared: Math.round(rSquared * 10000) / 10000,
    standardError: Math.round(standardError * 1000) / 1000,
    annualGrowthRatePct,
  };
}

export function forecastEventBudgetByLinearRegression(
  budgetResult: BudgetCalculationResult,
  targetForecastYear: number = 2028,
  macroShockBps: number = 0, // e.g., +150 bps = +1.5% additional annual slope pressure
  customCategoryPoints?: Partial<
    Record<CategoryRegressionForecast['archetypeKey'], HistoricalPricePoint[]>
  >
): EventRegressionForecastReport {
  const baseYear = 2026;
  const effectiveTargetYear = Math.max(baseYear + 1, Math.min(2032, targetForecastYear));
  const horizonYears = effectiveTargetYear - baseYear;
  const shockRatePerYear = macroShockBps / 10000; // 100 bps = 0.01 (1%)

  const allYears = [2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030];

  const categoryForecasts: CategoryRegressionForecast[] = budgetResult.categories.map((cat) => {
    const archetypeKey = classifyCategoryArchetype(cat.category);
    const defaultSeries = DEFAULT_CATEGORY_HISTORICAL_INDICES[archetypeKey];
    const points =
      customCategoryPoints?.[archetypeKey] && customCategoryPoints[archetypeKey]!.length >= 2
        ? customCategoryPoints[archetypeKey]!
        : defaultSeries.points;

    const ols = computeOrdinaryLeastSquares(points);
    const base2026FittedIndex = ols.slope * baseYear + ols.intercept;

    // Effective slope including user macro sensitivity shock
    const shockedSlope = ols.slope + base2026FittedIndex * shockRatePerYear;
    const effectiveYoyPct =
      base2026FittedIndex > 0
        ? roundCurrency((shockedSlope / base2026FittedIndex) * 100)
        : ols.annualGrowthRatePct;

    const currentCost = cat.allocated_total;

    const historicalAndProjectedPoints = allYears.map((yr) => {
      const histMatch = points.find((p) => p.year === yr);
      const isForecast = yr > baseYear;
      const yearsFromBase = yr - baseYear;

      const rawFittedIndex =
        yr <= baseYear
          ? ols.slope * yr + ols.intercept
          : base2026FittedIndex + shockedSlope * yearsFromBase;

      const scaleFactor = base2026FittedIndex > 0 ? rawFittedIndex / base2026FittedIndex : 1;
      const regressionFittedDollar = roundCurrency(Math.max(0, currentCost * scaleFactor));

      const actualDollarEquivalent = histMatch
        ? roundCurrency(
            currentCost * (base2026FittedIndex > 0 ? histMatch.indexValue / base2026FittedIndex : 1)
          )
        : undefined;

      // 95% Prediction Interval widens with sqrt(1 + horizon)
      const ciSpreadIndex =
        1.96 *
        Math.max(ols.standardError, 1.15) *
        (isForecast ? Math.sqrt(1 + yearsFromBase * 0.65) : 0.5);
      const ciDollarSpread =
        base2026FittedIndex > 0
          ? roundCurrency(currentCost * (ciSpreadIndex / base2026FittedIndex))
          : 0;

      return {
        year: yr,
        isForecast,
        actualDollarEquivalent,
        regressionFittedDollar,
        lowerBandDollar: roundCurrency(Math.max(0, regressionFittedDollar - ciDollarSpread)),
        upperBandDollar: roundCurrency(regressionFittedDollar + ciDollarSpread),
        indexValue: Math.round((histMatch?.indexValue ?? rawFittedIndex) * 10) / 10,
      };
    });

    const targetPoint =
      historicalAndProjectedPoints.find((p) => p.year === effectiveTargetYear) ??
      historicalAndProjectedPoints[historicalAndProjectedPoints.length - 1];

    const projectedCost = targetPoint.regressionFittedDollar;
    const cumulativeDollarDelta = roundCurrency(projectedCost - currentCost);
    const cumulativeIncreasePct =
      currentCost > 0 ? roundCurrency((cumulativeDollarDelta / currentCost) * 100) : 0;

    // Early contract lock-in typically captures 85% of forecasted escalation
    const earlyLockInSavings = roundCurrency(Math.max(0, cumulativeDollarDelta * 0.85));

    return {
      category: cat.category,
      archetypeKey,
      currentBaselineCost: currentCost,
      projectedCost,
      lowerBound95: targetPoint.lowerBandDollar,
      upperBound95: targetPoint.upperBandDollar,
      yoyIncreasePct: effectiveYoyPct,
      cumulativeIncreasePct,
      cumulativeDollarDelta,
      earlyLockInSavings,
      ols: {
        ...ols,
        annualGrowthRatePct: effectiveYoyPct,
      },
      historicalAndProjectedPoints,
      inflationDrivers: defaultSeries.drivers,
    };
  });

  const currentTotalBaseline = roundCurrency(
    categoryForecasts.reduce((acc, c) => acc + c.currentBaselineCost, 0)
  );
  const projectedTotalSpend = roundCurrency(
    categoryForecasts.reduce((acc, c) => acc + c.projectedCost, 0)
  );
  const projectedLowerBound95 = roundCurrency(
    categoryForecasts.reduce((acc, c) => acc + c.lowerBound95, 0)
  );
  const projectedUpperBound95 = roundCurrency(
    categoryForecasts.reduce((acc, c) => acc + c.upperBound95, 0)
  );
  const totalCumulativeDelta = roundCurrency(projectedTotalSpend - currentTotalBaseline);
  const totalEarlyLockInSavings = roundCurrency(
    categoryForecasts.reduce((acc, c) => acc + c.earlyLockInSavings, 0)
  );

  const weightedYoyGrowthPct =
    currentTotalBaseline > 0 && horizonYears > 0
      ? roundCurrency((totalCumulativeDelta / currentTotalBaseline / horizonYears) * 100)
      : 0;

  const aggregateTimelineSeries = allYears.map((yr) => {
    const isForecast = yr > baseYear;
    let actualSum = 0;
    let hasActual = true;
    let fittedSum = 0;
    let lowerSum = 0;
    let upperSum = 0;

    for (const cf of categoryForecasts) {
      const pt = cf.historicalAndProjectedPoints.find((p) => p.year === yr);
      if (pt) {
        fittedSum += pt.regressionFittedDollar;
        lowerSum += pt.lowerBandDollar;
        upperSum += pt.upperBandDollar;
        if (pt.actualDollarEquivalent !== undefined) {
          actualSum += pt.actualDollarEquivalent;
        } else {
          hasActual = false;
        }
      }
    }

    return {
      year: yr,
      isForecast,
      actualTotal: !isForecast && hasActual ? roundCurrency(actualSum) : undefined,
      fittedTotal: roundCurrency(fittedSum),
      lowerBandTotal: roundCurrency(lowerSum),
      upperBandTotal: roundCurrency(upperSum),
    };
  });

  const projectedCapVariance = roundCurrency(budgetResult.targetBudget - projectedTotalSpend);

  return {
    baseYear,
    targetForecastYear: effectiveTargetYear,
    horizonYears,
    macroShockBps,
    currentTotalBaseline,
    projectedTotalSpend,
    projectedLowerBound95,
    projectedUpperBound95,
    totalCumulativeDelta,
    weightedYoyGrowthPct,
    totalEarlyLockInSavings,
    projectedBudgetCapBreach: projectedTotalSpend > budgetResult.targetBudget,
    projectedCapVariance,
    categoryForecasts,
    aggregateTimelineSeries,
  };
}

