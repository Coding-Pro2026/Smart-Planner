import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Plus,
  RotateCcw,
  Sliders,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { BudgetCalculationResult } from '../lib/deterministicEngine';
import { BudgetItemRecord, EventRecord } from '../types/domain';
import { BudgetForecastingWidget } from './BudgetForecastingWidget';

interface BudgetSimulatorViewProps {
  event: EventRecord;
  budgetResult: BudgetCalculationResult;
  simulatedGuests: number;
  onSimulatedGuestsChange: (guests: number) => void;
  categoryMultipliers: Record<string, number>;
  onCategoryMultiplierChange: (category: string, multiplier: number) => void;
  onResetSimulation: () => void;
  onAddBudgetItem: (item: Omit<BudgetItemRecord, 'id' | 'event_id' | 'estimated_cost'>) => void;
  onDeleteBudgetItem: (id: string) => void;
  onUpdateBudgetItem: (id: string, patch: Partial<Pick<BudgetItemRecord, 'status' | 'actual_cost'>>) => void;
  onUpdateTargetBudget: (newBudget: number) => void;
  initialSubView?: 'current' | 'forecast';
}

export const BudgetSimulatorView: React.FC<BudgetSimulatorViewProps> = ({
  event,
  budgetResult,
  simulatedGuests,
  onSimulatedGuestsChange,
  categoryMultipliers,
  onCategoryMultiplierChange,
  onResetSimulation,
  onAddBudgetItem,
  onDeleteBudgetItem,
  onUpdateBudgetItem,
  onUpdateTargetBudget,
  initialSubView = 'current',
}) => {
  const [subView, setSubView] = useState<'current' | 'forecast'>(initialSubView);
  const [showAddForm, setShowAddForm] = useState(false);
  // Edit the target budget as free text and commit on blur/Enter (committing per keystroke made it uneditable).
  const [targetDraft, setTargetDraft] = useState(String(event.target_budget));
  useEffect(() => setTargetDraft(String(event.target_budget)), [event.target_budget, event.id]);
  const commitTarget = () => {
    const v = Number(targetDraft);
    if (targetDraft.trim() !== '' && Number.isFinite(v) && v >= 500 && v <= 1e9) {
      if (Math.round(v) !== Math.round(event.target_budget)) onUpdateTargetBudget(Math.round(v));
    } else {
      setTargetDraft(String(event.target_budget)); // invalid: revert
    }
  };
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('Catering & Sommelier');
  const [newUnitCost, setNewUnitCost] = useState('120');
  const [newQuantity, setNewQuantity] = useState('1');
  const [newTaxPct, setNewTaxPct] = useState('8.5');
  const [newContingencyPct, setNewContingencyPct] = useState('5');
  const [newIsPerGuest, setNewIsPerGuest] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const unitCost = Number(newUnitCost);
    const quantity = Number(newQuantity);
    const taxPct = Number(newTaxPct);
    const contingencyPct = Number(newContingencyPct);

    if (!newName.trim()) {
      setFormError('Item name is required.');
      return;
    }
    if (isNaN(unitCost) || unitCost < 0 || isNaN(quantity) || quantity <= 0) {
      setFormError('Unit cost and quantity must be valid non-negative numbers.');
      return;
    }

    onAddBudgetItem({
      name: newName.trim(),
      category: newCategory.trim() || 'General Production',
      unit_cost: unitCost,
      quantity: newIsPerGuest ? event.guest_count : quantity,
      tax_pct: Math.max(0, taxPct),
      contingency_pct: Math.max(0, contingencyPct),
      actual_cost: 0, // nothing has been paid yet
      is_per_guest: newIsPerGuest,
      status: 'planned',
    });

    setNewName('');
    setShowAddForm(false);
  };

  const filteredItems =
    categoryFilter === 'ALL'
      ? budgetResult.items
      : budgetResult.items.filter((i) => i.category === categoryFilter);

  const isSimulating =
    simulatedGuests !== event.guest_count ||
    Object.values(categoryMultipliers).some((m) => m !== 1);

  return (
    <div className="space-y-8">
      {/* Clean Mode Switcher: Current Budget vs Year-over-Year Price Forecast */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Budget &amp; Cost Forecasting</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Track expenses, simulate guest counts, or forecast multi-year vendor price increases.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-stone-200/70 rounded-xl max-w-full">
          <button
            type="button"
            onClick={() => setSubView('current')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              subView === 'current'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            Current Budget &amp; Simulator
          </button>
          <button
            type="button"
            onClick={() => setSubView('forecast')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all whitespace-nowrap ${
              subView === 'forecast'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
            Year-over-Year Cost Forecast (2026–2030)
          </button>
        </div>
      </div>

      {/* Subview 1: Year-over-Year Linear Regression Forecast */}
      {subView === 'forecast' && (
        <BudgetForecastingWidget
          event={event}
          budgetResult={budgetResult}
          onApplyEscalationReserve={(item) => {
            onAddBudgetItem(item);
            setSubView('current');
          }}
        />
      )}

      {/* Subview 2: Current Budget & Guest Count Simulator */}
      {subView === 'current' && (
        <div className="space-y-8">
          {/* Breach Alert Banner */}
          {budgetResult.breachAlerts.length > 0 && (
            <div
              className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${
                budgetResult.statusLevel === 'CRITICAL_OVER_BUDGET'
                  ? 'bg-rose-50/90 border-rose-200 text-rose-900'
                  : 'bg-amber-50/90 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
                <div className="space-y-1 text-sm">
                  <p className="font-semibold">Budget Alert</p>
                  <ul className="space-y-0.5 text-xs">
                    {budgetResult.breachAlerts.map((alert, idx) => (
                      <li key={idx}>· {alert}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {isSimulating && (
                <button
                  onClick={onResetSimulation}
                  className="px-3 py-1.5 text-xs font-medium bg-white border border-stone-200 text-stone-800 rounded-lg hover:bg-stone-50 transition-colors whitespace-nowrap shrink-0"
                >
                  Reset Guest Count
                </button>
              )}
            </div>
          )}

          {/* Top Summary & Guest Simulator Split */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left 5 cols: Clear Total & Breakdown */}
            <div className="lg:col-span-5 bg-white border border-stone-200/90 rounded-2xl p-6 flex flex-col justify-between space-y-6 shadow-2xs">
              <div>
                <div className="flex items-center justify-between text-xs text-stone-500">
                  <span>Estimated Total Cost (Incl. Tax &amp; Buffer)</span>
                  {budgetResult.statusLevel === 'NOMINAL' ? (
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" /> On Track
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-rose-600 font-medium">
                      <AlertTriangle className="w-3.5 h-3.5" /> Near/Over Limit
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-3xl font-bold font-mono tabular-nums text-stone-900">
                    ${budgetResult.totalProjectedSpend.toLocaleString('en-US', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </div>
                  <div className="text-xs text-stone-500 font-mono tabular-nums">
                    of ${budgetResult.targetBudget.toLocaleString()} budget ({budgetResult.burnRatePct}%)
                  </div>
                </div>

                <div className="mt-3 w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 ${
                      budgetResult.statusLevel === 'CRITICAL_OVER_BUDGET'
                        ? 'bg-rose-600'
                        : budgetResult.statusLevel === 'WARNING_85'
                        ? 'bg-amber-500'
                        : 'bg-indigo-600'
                    }`}
                    style={{ width: `${Math.min(100, budgetResult.burnRatePct)}%` }}
                  />
                </div>
              </div>

              <div className="space-y-2.5 pt-4 border-t border-stone-100 text-xs">
                <div className="flex justify-between text-stone-600">
                  <span>Base Vendor Costs</span>
                  <span className="font-mono tabular-nums text-stone-900">
                    ${budgetResult.baseSubtotalSum.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Estimated Taxes &amp; Contingency</span>
                  <span className="font-mono tabular-nums text-stone-900">
                    +${(budgetResult.taxTotalSum + budgetResult.contingencyTotalSum).toLocaleString(
                      'en-US',
                      { maximumFractionDigits: 0 }
                    )}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-stone-100 font-semibold text-stone-900">
                  <span>Cost per Guest ({budgetResult.simulatedGuestCount} guests)</span>
                  <span className="font-mono tabular-nums">
                    ${budgetResult.costPerGuest.toLocaleString('en-US', { maximumFractionDigits: 0 })} / guest
                  </span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Paid so far</span>
                  <span className="font-mono tabular-nums font-semibold text-stone-800">
                    ${budgetResult.totalActualSpend.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>Remaining Budget</span>
                  <span
                    className={`font-mono tabular-nums font-semibold ${
                      budgetResult.remainingBudget < 0 ? 'text-rose-600' : 'text-emerald-700'
                    }`}
                  >
                    {budgetResult.remainingBudget < 0 ? '-' : '+'}$
                    {Math.abs(budgetResult.remainingBudget).toLocaleString('en-US', {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
              </div>
            </div>

            {/* Right 7 cols: Simple What-If Controls */}
            <div className="lg:col-span-7 bg-white border border-stone-200/90 rounded-2xl p-6 flex flex-col justify-between space-y-6 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-stone-900">
                    What-If Guest &amp; Budget Simulator
                  </h2>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Slide guest count to see how catering &amp; hospitality costs adjust automatically.
                  </p>
                </div>
                {isSimulating && (
                  <button
                    onClick={onResetSimulation}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset ({event.guest_count} Guests)
                  </button>
                )}
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <label htmlFor="guest-slider" className="font-medium text-stone-700">
                      Guest Count
                    </label>
                    <span className="font-mono tabular-nums font-bold text-indigo-600 text-base">
                      {simulatedGuests} guests
                    </span>
                  </div>
                  <input
                    id="guest-slider"
                    type="range"
                    min={Math.max(10, Math.floor(event.guest_count * 0.4))}
                    max={Math.ceil(event.guest_count * 1.8)}
                    value={simulatedGuests}
                    onChange={(e) => onSimulatedGuestsChange(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div className="pt-4 border-t border-stone-100 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-stone-700">Total Target Budget</p>
                    <p className="text-xs text-stone-500">Your overall spending goal for this event</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-stone-500 font-mono">$</span>
                    <input
                      type="number"
                      min={500}
                      step={500}
                      aria-label="Total target budget in dollars"
                      value={targetDraft}
                      onChange={(e) => setTargetDraft(e.target.value)}
                      onBlur={commitTarget}
                      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                      className="w-36 px-3 py-2 text-sm font-mono tabular-nums border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    />
                  </div>
                </div>
              </div>

              {/* Quick Promo Banner to switch to YoY Forecast */}
              <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between gap-4">
                <div className="text-xs text-indigo-950">
                  <span className="font-semibold">Planning ahead for 2027–2030?</span> See how much Catering &amp; Venue prices are projected to increase year-over-year.
                </div>
                <button
                  type="button"
                  onClick={() => setSubView('forecast')}
                  className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap shrink-0"
                >
                  View YoY Forecast →
                </button>
              </div>
            </div>
          </div>

          {/* Expense Items Table */}
          <div className="bg-white border border-stone-200/90 rounded-2xl overflow-hidden shadow-2xs">
            <div className="px-6 py-5 border-b border-stone-200/80 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setCategoryFilter('ALL')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                    categoryFilter === 'ALL'
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-600 hover:text-stone-900'
                  }`}
                >
                  All Expenses ({budgetResult.items.length})
                </button>
                {budgetResult.categories.map((cat) => (
                  <button
                    key={cat.category}
                    onClick={() => setCategoryFilter(cat.category)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                      categoryFilter === cat.category
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {cat.category} ({cat.share_pct}%)
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowAddForm((prev) => !prev)}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                {showAddForm ? 'Cancel' : 'Add Expense'}
              </button>
            </div>

            {showAddForm && (
              <form
                onSubmit={handleCreateItem}
                className="p-6 bg-stone-50 border-b border-stone-200 space-y-4"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Expense Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g., String Quartet or Late-Night Gelato Cart"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Category
                    </label>
                    <input
                      type="text"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Cost ($)
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={newUnitCost}
                      onChange={(e) => setNewUnitCost(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">
                      Quantity
                    </label>
                    <input
                      type="number"
                      min={1}
                      step="1"
                      value={newIsPerGuest ? event.guest_count : newQuantity}
                      disabled={newIsPerGuest}
                      onChange={(e) => setNewQuantity(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-white border border-stone-300 rounded-lg disabled:opacity-60"
                    />
                  </div>
                  <div className="flex flex-col justify-end">
                    <label className="inline-flex items-center gap-2 text-xs text-stone-700 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={newIsPerGuest}
                        onChange={(e) => setNewIsPerGuest(e.target.checked)}
                        className="rounded border-stone-300 text-indigo-600"
                      />
                      Multiply per guest
                    </label>
                    <button
                      type="submit"
                      className="w-full px-4 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 rounded-lg transition-colors"
                    >
                      Save Expense
                    </button>
                  </div>
                </div>
                {formError && <p className="text-xs text-rose-600">{formError}</p>}
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-stone-200/80 bg-stone-50/60 text-xs font-medium text-stone-500">
                    <th className="py-3.5 px-6">Expense Item</th>
                    <th className="py-3.5 px-4">Type</th>
                    <th className="py-3.5 px-4 text-right">Base Cost</th>
                    <th className="py-3.5 px-4 text-right">Tax &amp; Buffer</th>
                    <th className="py-3.5 px-4 text-right">Paid so far</th>
                    <th className="py-3.5 px-6 text-right">Total Cost</th>
                    <th className="py-3.5 px-4 text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200/70 text-xs">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-4 px-6">
                        <div className="font-semibold text-stone-900 text-sm">{item.name}</div>
                        <div className="text-xs text-stone-500 mt-0.5">
                          <span>{item.category}</span>
                          <span aria-hidden="true"> · </span>
                          <select
                            aria-label={`Status of ${item.name}`}
                            value={item.status}
                            onChange={(e) => onUpdateBudgetItem(item.id, { status: e.target.value as BudgetItemRecord['status'] })}
                            className="capitalize bg-transparent border border-stone-200 rounded-md px-1 py-0.5 text-[11px] text-stone-600"
                          >
                            {(['planned', 'quoted', 'contracted', 'paid'] as const).map((st) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-stone-600 whitespace-nowrap">
                        {item.is_per_guest
                          ? `$${item.unit_cost} × ${item.effective_quantity} guests`
                          : 'Flat Fee'}
                      </td>
                      <td className="py-4 px-4 text-right font-mono tabular-nums text-stone-700">
                        ${item.base_subtotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </td>
                      <td className="py-4 px-4 text-right font-mono tabular-nums text-stone-500">
                        +${(item.tax_amount + item.contingency_amount).toLocaleString('en-US', {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="inline-flex items-center gap-1 font-mono text-stone-600">
                          $
                          <input
                            key={`${item.id}-${item.actual_cost}`}
                            type="number"
                            min={0}
                            step="1"
                            aria-label={`Amount paid for ${item.name}`}
                            disabled={isSimulating}
                            title={isSimulating ? 'Reset the simulation to edit payments' : 'Amount paid so far'}
                            defaultValue={Math.round(item.actual_cost)}
                            onBlur={(e) => {
                              const v = Number(e.target.value);
                              if (Number.isFinite(v) && v >= 0 && Math.round(v) !== Math.round(item.actual_cost)) {
                                onUpdateBudgetItem(item.id, { actual_cost: v });
                              } else {
                                e.target.value = String(Math.round(item.actual_cost));
                              }
                            }}
                            className="w-20 px-1.5 py-1 text-right border border-stone-200 rounded-md bg-white disabled:opacity-50"
                          />
                        </div>
                      </td>
                      <td className="py-4 px-6 text-right font-mono tabular-nums font-bold text-stone-900 text-sm">
                        ${item.deterministic_total.toLocaleString('en-US', {
                          maximumFractionDigits: 0,
                        })}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <button
                          onClick={() => onDeleteBudgetItem(item.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 rounded-lg transition-colors"
                          title="Delete item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
