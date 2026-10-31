import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Lock,
  Plus,
  RotateCcw,
  TrendingUp,
} from 'lucide-react';
import {
  BudgetCalculationResult,
  CategoryRegressionForecast,
  DEFAULT_CATEGORY_HISTORICAL_INDICES,
  forecastEventBudgetByLinearRegression,
  HistoricalPricePoint,
} from '../lib/deterministicEngine';
import { BudgetItemRecord, EventRecord } from '../types/domain';

interface BudgetForecastingWidgetProps {
  event: EventRecord;
  budgetResult: BudgetCalculationResult;
  onApplyEscalationReserve?: (
    item: Omit<BudgetItemRecord, 'id' | 'event_id' | 'estimated_cost'>
  ) => void;
}

export const BudgetForecastingWidget: React.FC<BudgetForecastingWidgetProps> = ({
  event,
  budgetResult,
  onApplyEscalationReserve,
}) => {
  const [targetYear, setTargetYear] = useState<number>(2028);
  const [macroShockBps, setMacroShockBps] = useState<number>(0);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('ALL');
  const [showAdvancedMath, setShowAdvancedMath] = useState<boolean>(false);
  const [customIndices, setCustomIndices] = useState<
    Partial<Record<CategoryRegressionForecast['archetypeKey'], HistoricalPricePoint[]>>
  >({});
  const [reserveCommitted, setReserveCommitted] = useState(false);

  const forecastReport = useMemo(
    () =>
      forecastEventBudgetByLinearRegression(
        budgetResult,
        targetYear,
        macroShockBps,
        customIndices
      ),
    [budgetResult, targetYear, macroShockBps, customIndices]
  );

  const activeCategoryForecast = useMemo(() => {
    if (selectedCategoryName === 'ALL') return null;
    return (
      forecastReport.categoryForecasts.find((c) => c.category === selectedCategoryName) ??
      forecastReport.categoryForecasts[0] ??
      null
    );
  }, [forecastReport.categoryForecasts, selectedCategoryName]);

  const cateringForecast = useMemo(
    () =>
      forecastReport.categoryForecasts.find((c) => c.archetypeKey === 'catering') ??
      forecastReport.categoryForecasts[0],
    [forecastReport.categoryForecasts]
  );

  const venueForecast = useMemo(
    () =>
      forecastReport.categoryForecasts.find((c) => c.archetypeKey === 'venue') ??
      forecastReport.categoryForecasts[1] ??
      forecastReport.categoryForecasts[0],
    [forecastReport.categoryForecasts]
  );

  const chartPoints = useMemo(() => {
    if (activeCategoryForecast) {
      return activeCategoryForecast.historicalAndProjectedPoints.map((pt) => ({
        year: pt.year,
        isForecast: pt.isForecast,
        actual: pt.actualDollarEquivalent,
        fitted: pt.regressionFittedDollar,
        lower: pt.lowerBandDollar,
        upper: pt.upperBandDollar,
      }));
    }
    return forecastReport.aggregateTimelineSeries.map((pt) => ({
      year: pt.year,
      isForecast: pt.isForecast,
      actual: pt.actualTotal,
      fitted: pt.fittedTotal,
      lower: pt.lowerBandTotal,
      upper: pt.upperBandTotal,
    }));
  }, [activeCategoryForecast, forecastReport.aggregateTimelineSeries]);

  const handleAdjustHistoricalIndex = (
    archetypeKey: CategoryRegressionForecast['archetypeKey'],
    year: number,
    nextVal: number
  ) => {
    const existing =
      customIndices[archetypeKey] ??
      DEFAULT_CATEGORY_HISTORICAL_INDICES[archetypeKey].points.map((p) => ({ ...p }));
    const updated = existing.map((pt) =>
      pt.year === year ? { ...pt, indexValue: Math.max(50, Math.min(300, nextVal)) } : pt
    );
    setCustomIndices((prev) => ({
      ...prev,
      [archetypeKey]: updated,
    }));
  };

  const handleCommitEscalationBuffer = () => {
    if (!onApplyEscalationReserve || forecastReport.totalCumulativeDelta <= 0) return;
    onApplyEscalationReserve({
      name: `Price Escalation Buffer (2026→${targetYear} Forecast)`,
      category: 'Inflation Reserve',
      unit_cost: Math.round(forecastReport.totalCumulativeDelta),
      quantity: 1,
      tax_pct: 0,
      contingency_pct: 0,
      actual_cost: 0,
      is_per_guest: false,
      status: 'planned',
      notes: `Projected +${forecastReport.weightedYoyGrowthPct}%/yr increase via linear regression.`,
    });
    setReserveCommitted(true);
    setTimeout(() => setReserveCommitted(false), 3500);
  };

  // SVG Chart Geometry
  const svgWidth = 720;
  const svgHeight = 240;
  const padLeft = 64;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 36;
  const plotW = svgWidth - padLeft - padRight;
  const plotH = svgHeight - padTop - padBottom;

  const minVal = useMemo(() => {
    const vals = chartPoints.map((p) => Math.min(p.lower, p.actual ?? p.fitted));
    return Math.max(0, Math.min(...vals) * 0.88);
  }, [chartPoints]);

  const maxVal = useMemo(() => {
    const vals = chartPoints.map((p) => Math.max(p.upper, p.actual ?? p.fitted));
    return Math.max(minVal + 1000, Math.max(...vals) * 1.06);
  }, [chartPoints, minVal]);

  const getX = (idx: number) =>
    padLeft + (idx / Math.max(1, chartPoints.length - 1)) * plotW;
  const getY = (val: number) =>
    padTop + plotH - ((val - minVal) / Math.max(1, maxVal - minVal)) * plotH;

  const regressionLinePath = useMemo(() => {
    return chartPoints
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${getX(i).toFixed(1)} ${getY(pt.fitted).toFixed(1)}`)
      .join(' ');
  }, [chartPoints, minVal, maxVal]);

  const confidenceBandPolygon = useMemo(() => {
    const upperPts = chartPoints.map((pt, i) => `${getX(i).toFixed(1)},${getY(pt.upper).toFixed(1)}`);
    const lowerPts = [...chartPoints]
      .reverse()
      .map((pt, revIdx) => {
        const origIdx = chartPoints.length - 1 - revIdx;
        return `${getX(origIdx).toFixed(1)},${getY(pt.lower).toFixed(1)}`;
      });
    return [...upperPts, ...lowerPts].join(' ');
  }, [chartPoints, minVal, maxVal]);

  const base2026Idx = chartPoints.findIndex((p) => p.year === 2026);
  const targetYearIdx = chartPoints.findIndex((p) => p.year === targetYear);

  return (
    <div className="bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-8 space-y-8 shadow-sm hover:shadow-md transition-shadow duration-200">
      {/* Clean Header & Year Horizon Picker */}
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-medium text-indigo-600">
            <TrendingUp className="w-4 h-4" />
            <span>Year-over-Year Cost Forecast (Linear Regression)</span>
          </div>
          <h2 className="text-xl font-bold text-stone-900">
            How much will Catering &amp; Venue prices rise if you book later?
          </h2>
          <p className="text-sm text-stone-500">
            Based on 5-year historical event pricing trends (2021–2026), here is what your current{' '}
            <span className="font-mono font-semibold text-stone-800">
              ${forecastReport.currentTotalBaseline.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>{' '}
            budget is projected to cost in{' '}
            <span className="font-mono font-semibold text-stone-800">{targetYear}</span>.
          </p>
        </div>

        <div className="flex flex-col items-start sm:items-end gap-2 max-w-full">
          <span className="text-xs font-medium text-stone-500">Select Forecast Year</span>
          <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-100 rounded-2xl max-w-full">
            {[2027, 2028, 2029, 2030].map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setTargetYear(yr)}
                className={`px-3.5 py-1.5 text-xs font-mono font-semibold rounded-xl transition-all whitespace-nowrap ${
                  targetYear === yr
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {yr} (+{yr - 2026} yr)
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3 Clear Highlight Columns (Separated by clean hairlines instead of nested boxes) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-stone-100">
        {/* Catering Column */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span className="font-medium text-stone-700">Catering &amp; Beverage Trend</span>
            <span className="font-mono font-semibold text-amber-700">
              +{cateringForecast?.yoyIncreasePct ?? 0}% / year
            </span>
          </div>
          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-bold text-stone-900">
              ${(cateringForecast?.projectedCost ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs text-stone-400">
              in {targetYear} (vs ${(cateringForecast?.currentBaselineCost ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} today)
            </span>
          </div>
          <p className="text-xs text-stone-500">
            Driven by culinary staffing &amp; specialty ingredient inflation.
          </p>
        </div>

        {/* Venue Column */}
        <div className="space-y-1.5 md:border-l md:border-stone-100 md:pl-6">
          <div className="flex items-center justify-between text-xs text-stone-500">
            <span className="font-medium text-stone-700">Venue &amp; Rentals Trend</span>
            <span className="font-mono font-semibold text-indigo-600">
              +{venueForecast?.yoyIncreasePct ?? 0}% / year
            </span>
          </div>
          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-bold text-stone-900">
              ${(venueForecast?.projectedCost ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
            <span className="text-xs text-stone-400">
              in {targetYear} (vs ${(venueForecast?.currentBaselineCost ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })} today)
            </span>
          </div>
          <p className="text-xs text-stone-500">
            Driven by prime weekend demand &amp; venue insurance rates.
          </p>
        </div>

        {/* Early Lock-in Savings Column */}
        <div className="space-y-1.5 md:border-l md:border-stone-100 md:pl-6">
          <div className="flex items-center justify-between text-xs text-emerald-700">
            <span className="font-semibold inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-emerald-600" /> Early Booking Savings
            </span>
            <span className="font-mono font-semibold">Lock 2026 Rates</span>
          </div>
          <div className="flex items-baseline gap-2 font-mono tabular-nums">
            <span className="text-2xl font-bold text-emerald-700">
              Save ${forecastReport.totalEarlyLockInSavings.toLocaleString('en-US', { maximumFractionDigits: 0 })}
            </span>
          </div>
          <p className="text-xs text-stone-500">
            Estimated savings by signing Venue &amp; Catering contracts at current rates.
          </p>
        </div>
      </div>

      {/* Main Visual Forecast Chart + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 cols: Clean Visual Trajectory Chart */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-stone-900">
                {activeCategoryForecast
                  ? `${activeCategoryForecast.category} Cost Projection (2021–2030)`
                  : 'Total Event Cost Trajectory (2021–2030)'}
              </h3>
              <p className="text-xs text-stone-500">
                Solid dots show historical equivalents · Shaded band shows 95% confidence range
              </p>
            </div>

            <select
              aria-label="Filter forecast category"
              value={selectedCategoryName}
              onChange={(e) => setSelectedCategoryName(e.target.value)}
              className="px-3 py-1.5 text-xs font-medium border border-stone-200 rounded-lg bg-stone-50 text-stone-800"
            >
              <option value="ALL">All Categories Combined</option>
              {forecastReport.categoryForecasts.map((cf) => (
                <option key={cf.category} value={cf.category}>
                  {cf.category} (+{cf.yoyIncreasePct}%/yr)
                </option>
              ))}
            </select>
          </div>

          <div className="border border-stone-200/80 rounded-xl bg-stone-50/40 p-4">
            <svg
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              className="w-full h-auto overflow-visible"
              role="img"
              aria-label="Linear Regression Cost Forecast Chart"
            >
              {[0, 0.25, 0.5, 0.75, 1].map((t, idx) => {
                const val = minVal + t * (maxVal - minVal);
                const y = getY(val);
                return (
                  <g key={idx}>
                    <line
                      x1={padLeft}
                      y1={y}
                      x2={svgWidth - padRight}
                      y2={y}
                      stroke="#e7e5e4"
                      strokeDasharray={idx === 0 ? undefined : '3 3'}
                      strokeWidth="1"
                    />
                    <text
                      x={padLeft - 10}
                      y={y + 4}
                      textAnchor="end"
                      className="text-[11px] fill-stone-400 font-mono"
                    >
                      ${Math.round(val / 1000)}k
                    </text>
                  </g>
                );
              })}

              {base2026Idx >= 0 && (
                <g>
                  <line
                    x1={getX(base2026Idx)}
                    y1={padTop}
                    x2={getX(base2026Idx)}
                    y2={svgHeight - padBottom}
                    stroke="#a8a29e"
                    strokeDasharray="4 4"
                    strokeWidth="1"
                  />
                  <text
                    x={getX(base2026Idx) + 6}
                    y={padTop + 12}
                    className="text-[10px] fill-stone-500 font-medium"
                  >
                    Today (2026) → Projected
                  </text>
                </g>
              )}

              <polygon
                points={confidenceBandPolygon}
                fill="rgba(79, 70, 229, 0.10)"
                stroke="none"
              />

              <path
                d={regressionLinePath}
                fill="none"
                stroke="#4f46e5"
                strokeWidth="2.5"
              />

              {targetYearIdx >= 0 && (
                <g>
                  <line
                    x1={getX(targetYearIdx)}
                    y1={padTop}
                    x2={getX(targetYearIdx)}
                    y2={svgHeight - padBottom}
                    stroke="#e11d48"
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                  />
                  <circle
                    cx={getX(targetYearIdx)}
                    cy={getY(chartPoints[targetYearIdx].fitted)}
                    r="6"
                    fill="none"
                    stroke="#e11d48"
                    strokeWidth="2"
                  />
                </g>
              )}

              {chartPoints.map((pt, i) => {
                const cx = getX(i);
                const cyFitted = getY(pt.fitted);
                const cyActual = pt.actual !== undefined ? getY(pt.actual) : cyFitted;

                return (
                  <g key={pt.year}>
                    <text
                      x={cx}
                      y={svgHeight - 10}
                      textAnchor="middle"
                      className={`text-[11px] font-mono ${
                        pt.year === targetYear
                          ? 'fill-rose-600 font-bold'
                          : pt.isForecast
                          ? 'fill-indigo-600 font-semibold'
                          : 'fill-stone-500'
                      }`}
                    >
                      {pt.year}
                    </text>

                    {pt.isForecast ? (
                      <circle
                        cx={cx}
                        cy={cyFitted}
                        r="4"
                        fill="#ffffff"
                        stroke="#4f46e5"
                        strokeWidth="2"
                      />
                    ) : (
                      <circle cx={cx} cy={cyActual} r="4" fill="#1c1917" />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Market Inflation Adjustment Slider & Action Button */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
            <div className="flex-1 min-w-[220px] space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="inflation-slider" className="font-medium text-stone-700">
                  Market Inflation Scenario Adjustment
                </label>
                <span className="font-mono font-semibold text-stone-900">
                  {macroShockBps === 0
                    ? 'Baseline Trend (0.0%)'
                    : `${macroShockBps > 0 ? '+' : ''}${(macroShockBps / 100).toFixed(1)}% / yr`}
                </span>
              </div>
              <input
                id="inflation-slider"
                type="range"
                min={-200}
                max={400}
                step={25}
                value={macroShockBps}
                onChange={(e) => setMacroShockBps(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer"
              />
            </div>

            {onApplyEscalationReserve && (
              <button
                type="button"
                onClick={handleCommitEscalationBuffer}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                {reserveCommitted ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Added +${Math.round(forecastReport.totalCumulativeDelta).toLocaleString()} Buffer to Budget
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Add +${Math.round(forecastReport.totalCumulativeDelta).toLocaleString()} Price Buffer to Budget
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Right 5 cols: Simple Category Table */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-stone-900">
              Projected Cost by Category ({targetYear})
            </h3>
            <span className="text-xs text-stone-500">Click any row to filter chart</span>
          </div>

          <div className="border border-stone-200/90 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200/80 text-stone-500 font-medium">
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-3 text-right">Today (2026)</th>
                  <th className="py-3 px-3 text-right">Annual Rise</th>
                  <th className="py-3 px-4 text-right">{targetYear} Forecast</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200/70">
                {forecastReport.categoryForecasts.map((cf) => {
                  const isSelected = selectedCategoryName === cf.category;
                  return (
                    <tr
                      key={cf.category}
                      onClick={() =>
                        setSelectedCategoryName(isSelected ? 'ALL' : cf.category)
                      }
                      className={`cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50/70' : 'hover:bg-stone-50'
                      }`}
                    >
                      <td className="py-3 px-4 font-medium text-stone-900">
                        {cf.category}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-stone-600">
                        ${cf.currentBaselineCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-amber-700 font-semibold">
                        +{cf.yoyIncreasePct}%/yr
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <div className="font-bold text-stone-900">
                          ${cf.projectedCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </div>
                        <div className="text-[11px] text-rose-600">
                          +${cf.cumulativeDollarDelta.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Progressive Disclosure for OLS Linear Regression Math & Index Calibration */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvancedMath((prev) => !prev)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-stone-600 bg-stone-50 hover:bg-stone-100 border border-stone-200/80 rounded-xl transition-colors"
            >
              <span>
                {showAdvancedMath
                  ? 'Hide Linear Regression Math & Historical Index Calibration'
                  : 'Show Linear Regression Math (Slope m, R² Fit & Historical Data)'}
              </span>
              {showAdvancedMath ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>

            {showAdvancedMath && (
              <div className="mt-3 p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-stone-800">
                    Ordinary Least Squares (y = m·x + b) Parameters
                  </span>
                  {(macroShockBps !== 0 || Object.keys(customIndices).length > 0) && (
                    <button
                      type="button"
                      onClick={() => {
                        setMacroShockBps(0);
                        setCustomIndices({});
                      }}
                      className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
                    >
                      <RotateCcw className="w-3 h-3" /> Reset Data
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 font-mono text-[11px] text-stone-600">
                  {forecastReport.categoryForecasts.map((cf) => (
                    <div key={cf.category} className="flex items-center justify-between">
                      <span className="truncate max-w-[160px]">{cf.category}</span>
                      <span>
                        m={cf.ols.slope.toFixed(2)} · R²={cf.ols.rSquared.toFixed(4)} · CI: ±$
                        {Math.round((cf.upperBound95 - cf.lowerBound95) / 2).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>

                {activeCategoryForecast && (
                  <div className="pt-2 border-t border-stone-200 space-y-2">
                    <div className="text-[11px] font-medium text-stone-700">
                      Calibrate {activeCategoryForecast.category} Price Index (2021=100):
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {activeCategoryForecast.historicalAndProjectedPoints
                        .filter((pt) => !pt.isForecast)
                        .map((pt) => (
                          <div key={pt.year} className="space-y-0.5">
                            <label className="block text-[10px] font-mono text-stone-500 text-center">
                              {pt.year}
                            </label>
                            <input
                              type="number"
                              step="0.5"
                              value={pt.indexValue}
                              onChange={(e) =>
                                handleAdjustHistoricalIndex(
                                  activeCategoryForecast.archetypeKey,
                                  pt.year,
                                  Number(e.target.value)
                                )
                              }
                              className="w-full px-1 py-1 text-[11px] font-mono text-center bg-white border border-stone-300 rounded"
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
