import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Plus,
  RotateCcw,
  Sliders,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { BudgetCalculationResult } from '../lib/deterministicEngine';
import { BudgetItemRecord, EventRecord } from '../types/domain';
import { BudgetForecastingWidget } from './BudgetForecastingWidget';
import { Badge, Button, Card, EmptyState, Field, PageHeader, ProgressBar, cx, focusRing, inputCls } from './ui/kit';

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
  // Two-step delete: first click arms, second confirms (deleting a line item is not undoable).
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

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
      tax_pct: Math.max(0, Number.isFinite(taxPct) ? taxPct : 0),
      contingency_pct: Math.max(0, Number.isFinite(contingencyPct) ? contingencyPct : 0),
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

  const money = (n: number) => `$${(Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const tone = budgetResult.statusLevel === 'CRITICAL_OVER_BUDGET' ? 'bad' : budgetResult.statusLevel === 'WARNING_85' ? 'warn' : 'good';
  const segBtn = (active: boolean) =>
    cx(
      'inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-[background-color,box-shadow,color] motion-reduce:transition-none',
      active ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-700 hover:text-stone-900',
      focusRing
    );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Wallet className="h-4 w-4" />}
        eyebrow="Budget"
        title="Budget & cost forecasting"
        description="Track expenses, simulate guest counts, or forecast multi-year vendor price increases."
        actions={
          <div role="group" aria-label="Budget view" className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-stone-100 p-1">
            <button type="button" aria-pressed={subView === 'current'} onClick={() => setSubView('current')} className={segBtn(subView === 'current')}>
              <Sliders aria-hidden="true" className="h-4 w-4" /> Budget & simulator
            </button>
            <button type="button" aria-pressed={subView === 'forecast'} onClick={() => setSubView('forecast')} className={segBtn(subView === 'forecast')}>
              <TrendingUp aria-hidden="true" className="h-4 w-4" /> Price forecast
            </button>
          </div>
        }
      />

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

      {subView === 'current' && (
        <div className="space-y-6">
          {budgetResult.breachAlerts.length > 0 && (
            <div
              role="alert"
              className={cx(
                'flex items-start justify-between gap-4 rounded-xl border p-4',
                budgetResult.statusLevel === 'CRITICAL_OVER_BUDGET'
                  ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200'
                  : 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200'
              )}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Budget alert</p>
                  <ul className="list-disc space-y-0.5 pl-4 text-sm">
                    {budgetResult.breachAlerts.map((alert, idx) => (
                      <li key={idx}>{alert}</li>
                    ))}
                  </ul>
                </div>
              </div>
              {isSimulating && (
                <Button className="shrink-0" onClick={onResetSimulation}>
                  Reset guest count
                </Button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12">
            <Card aria-labelledby="bud-total" className="flex flex-col justify-between gap-6 p-6 lg:col-span-5">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id="bud-total" className="text-xs font-medium uppercase tracking-[0.08em] text-stone-600">
                    Estimated total (incl. tax & buffer)
                  </h3>
                  {budgetResult.statusLevel === 'NOMINAL' ? (
                    <Badge tone="good">
                      <CheckCircle2 aria-hidden="true" className="h-3 w-3" /> On track
                    </Badge>
                  ) : (
                    <Badge tone={tone}>
                      <AlertTriangle aria-hidden="true" className="h-3 w-3" /> Near/over limit
                    </Badge>
                  )}
                </div>
                <p className="mt-3 font-mono text-[32px] font-semibold leading-10 tabular-nums text-stone-900">{money(budgetResult.totalProjectedSpend)}</p>
                <p className="mt-1 text-sm text-stone-600">
                  of <span className="font-mono tabular-nums">{money(budgetResult.targetBudget)}</span> budget ({budgetResult.burnRatePct}%)
                </p>
                <ProgressBar className="mt-4" value={budgetResult.burnRatePct} tone={tone} label="Budget used" />
              </div>

              <dl className="space-y-2.5 border-t border-stone-100 pt-4 text-sm">
                <div className="flex justify-between text-stone-600">
                  <dt>Base vendor costs</dt>
                  <dd className="font-mono tabular-nums text-stone-900">{money(budgetResult.baseSubtotalSum)}</dd>
                </div>
                <div className="flex justify-between text-stone-600">
                  <dt>Taxes & contingency</dt>
                  <dd className="font-mono tabular-nums text-stone-900">+{money(budgetResult.taxTotalSum + budgetResult.contingencyTotalSum)}</dd>
                </div>
                <div className="flex justify-between border-t border-stone-100 pt-2.5 font-semibold text-stone-900">
                  <dt>Per guest ({budgetResult.simulatedGuestCount})</dt>
                  <dd className="font-mono tabular-nums">{money(budgetResult.costPerGuest)}</dd>
                </div>
                <div className="flex justify-between text-stone-600">
                  <dt>Paid so far</dt>
                  <dd className="font-mono font-medium tabular-nums text-stone-900">{money(budgetResult.totalActualSpend)}</dd>
                </div>
                <div className="flex justify-between text-stone-600">
                  <dt>Remaining</dt>
                  <dd className={cx('font-mono font-semibold tabular-nums', budgetResult.remainingBudget < 0 ? 'text-rose-700 dark:text-rose-300' : 'text-[#2F4A38] dark:text-emerald-300')}>
                    {budgetResult.remainingBudget < 0 ? '-' : '+'}
                    {money(Math.abs(budgetResult.remainingBudget))}
                  </dd>
                </div>
              </dl>
            </Card>

            <Card aria-labelledby="bud-sim" className="flex flex-col justify-between gap-6 p-6 lg:col-span-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 id="bud-sim" className="text-base font-semibold leading-6 text-stone-900">What-if simulator</h3>
                  <p className="mt-0.5 text-sm leading-5 text-stone-600">Slide the guest count to see catering and hospitality costs adjust.</p>
                </div>
                {isSimulating && (
                  <Button className="shrink-0" onClick={onResetSimulation}>
                    <RotateCcw aria-hidden="true" className="h-4 w-4" /> Reset ({event.guest_count})
                  </Button>
                )}
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="guest-slider" className="text-sm font-medium text-stone-800">Guest count</label>
                    <span className="font-mono text-base font-semibold tabular-nums text-[#3B5943] dark:text-emerald-300" aria-live="polite">{simulatedGuests} guests</span>
                  </div>
                  <input
                    id="guest-slider"
                    type="range"
                    min={Math.max(10, Math.floor(event.guest_count * 0.4))}
                    max={Math.ceil(event.guest_count * 1.8)}
                    value={simulatedGuests}
                    onChange={(e) => onSimulatedGuestsChange(Number(e.target.value))}
                    className="h-6 w-full cursor-pointer accent-[#3B5943]"
                  />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-stone-100 pt-4">
                  <div>
                    <p className="text-sm font-medium text-stone-800">Total target budget</p>
                    <p className="text-sm text-stone-600">Your overall spending goal. Press Enter to save.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span aria-hidden="true" className="font-mono text-sm text-stone-600">$</span>
                    <input
                      type="number"
                      min={500}
                      step={500}
                      aria-label="Total target budget in dollars"
                      value={targetDraft}
                      onChange={(e) => setTargetDraft(e.target.value)}
                      onBlur={commitTarget}
                      onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
                      className={cx(inputCls, '!w-36 font-mono tabular-nums')}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50 p-4">
                <p className="text-sm leading-5 text-stone-700">
                  <span className="font-semibold">Planning ahead?</span> See how catering and venue prices are projected to rise year over year.
                </p>
                <Button className="shrink-0" onClick={() => setSubView('forecast')}>
                  View price forecast <ArrowRight aria-hidden="true" className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          </div>

          <Card aria-labelledby="bud-items" className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 px-6 py-4">
              <div>
                <h3 id="bud-items" className="sr-only">Expense items</h3>
                <div role="group" aria-label="Filter by category" className="flex flex-wrap items-center gap-2">
                  {[{ key: 'ALL', label: `All (${budgetResult.items.length})` }, ...budgetResult.categories.map((c) => ({ key: c.category, label: `${c.category} (${c.share_pct}%)` }))].map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={categoryFilter === f.key}
                      onClick={() => setCategoryFilter(f.key)}
                      className={cx(
                        'h-8 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-colors motion-reduce:transition-none',
                        categoryFilter === f.key ? 'bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900' : 'bg-stone-100 text-stone-700 hover:bg-stone-200',
                        focusRing
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <Button variant="primary" aria-expanded={showAddForm} aria-controls="add-expense-form" onClick={() => setShowAddForm((prev) => !prev)}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                {showAddForm ? 'Cancel' : 'Add expense'}
              </Button>
            </div>

            {showAddForm && (
              <form id="add-expense-form" onSubmit={handleCreateItem} className="space-y-4 border-b border-stone-200 bg-stone-50 p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
                  <Field label="Expense name" className="lg:col-span-2">
                    <input type="text" required maxLength={120} autoFocus placeholder="e.g. String quartet" value={newName} onChange={(e) => setNewName(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Category">
                    <input type="text" maxLength={60} value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className={inputCls} />
                  </Field>
                  <Field label="Cost ($)">
                    <input type="number" min={0} step="0.01" value={newUnitCost} onChange={(e) => setNewUnitCost(e.target.value)} className={cx(inputCls, 'font-mono tabular-nums')} />
                  </Field>
                  <Field label="Quantity">
                    <input
                      type="number"
                      min={1}
                      step="1"
                      value={newIsPerGuest ? event.guest_count : newQuantity}
                      disabled={newIsPerGuest}
                      onChange={(e) => setNewQuantity(e.target.value)}
                      className={cx(inputCls, 'font-mono tabular-nums')}
                    />
                  </Field>
                  <div className="flex flex-col justify-end gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-stone-800">
                      <input type="checkbox" checked={newIsPerGuest} onChange={(e) => setNewIsPerGuest(e.target.checked)} className="h-4 w-4 rounded border-stone-400 accent-[#3B5943]" />
                      Multiply per guest
                    </label>
                    <Button type="submit" variant="primary">Save expense</Button>
                  </div>
                </div>
                {formError && <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">{formError}</p>}
              </form>
            )}

            {filteredItems.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Wallet className="h-5 w-5" />}
                  title={budgetResult.items.length === 0 ? 'No expenses yet' : 'No expenses in this category'}
                  body={budgetResult.items.length === 0 ? 'Add your first cost and we will track spend against your target.' : 'Pick another category to see more.'}
                  action={
                    budgetResult.items.length === 0 ? (
                      <Button variant="primary" onClick={() => setShowAddForm(true)}>Add expense</Button>
                    ) : (
                      <Button onClick={() => setCategoryFilter('ALL')}>Show all</Button>
                    )
                  }
                />
              </div>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <caption className="sr-only">Budget expense items</caption>
                  <thead>
                    <tr className="border-b border-stone-200 bg-stone-50 text-xs font-medium uppercase tracking-[0.06em] text-stone-600">
                      <th scope="col" className="px-6 py-3">Expense</th>
                      <th scope="col" className="px-4 py-3">Type</th>
                      <th scope="col" className="px-4 py-3 text-right">Base</th>
                      <th scope="col" className="px-4 py-3 text-right">Tax & buffer</th>
                      <th scope="col" className="px-4 py-3 text-right">Paid</th>
                      <th scope="col" className="px-6 py-3 text-right">Total</th>
                      <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-sm">
                    {filteredItems.map((item) => (
                      <tr key={item.id} className="transition-colors hover:bg-stone-50 motion-reduce:transition-none">
                        <td className="px-6 py-4">
                          <div className="font-semibold text-stone-900">{item.name}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-600">
                            <span>{item.category}</span>
                            <select
                              aria-label={`Status of ${item.name}`}
                              value={item.status}
                              onChange={(e) => onUpdateBudgetItem(item.id, { status: e.target.value as BudgetItemRecord['status'] })}
                              className={cx('h-7 rounded-md border border-stone-300 bg-white px-1.5 text-xs capitalize text-stone-800', focusRing)}
                            >
                              {(['planned', 'quoted', 'contracted', 'paid'] as const).map((st) => (
                                <option key={st} value={st}>{st}</option>
                              ))}
                            </select>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-4 text-stone-600">
                          {item.is_per_guest ? `$${item.unit_cost} × ${item.effective_quantity} guests` : 'Flat fee'}
                        </td>
                        <td className="px-4 py-4 text-right font-mono tabular-nums text-stone-800">{money(item.base_subtotal)}</td>
                        <td className="px-4 py-4 text-right font-mono tabular-nums text-stone-600">+{money(item.tax_amount + item.contingency_amount)}</td>
                        <td className="px-4 py-4 text-right">
                          <span className="inline-flex items-center gap-1 font-mono text-stone-600">
                            <span aria-hidden="true">$</span>
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
                              className={cx(inputCls, '!h-8 !w-24 text-right font-mono tabular-nums')}
                            />
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-semibold tabular-nums text-stone-900">{money(item.deterministic_total)}</td>
                        <td className="px-4 py-4 text-right">
                          {pendingDelete === item.id ? (
                            <span className="inline-flex items-center gap-1">
                              <Button
                                className="!h-8 !px-3 !border-rose-300 !text-rose-800 dark:!text-rose-200"
                                onClick={() => {
                                  onDeleteBudgetItem(item.id);
                                  setPendingDelete(null);
                                }}
                              >
                                Delete
                              </Button>
                              <Button variant="ghost" className="!h-8 !px-2" onClick={() => setPendingDelete(null)}>
                                Keep
                              </Button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setPendingDelete(item.id)}
                              aria-label={`Delete ${item.name}`}
                              className={cx('inline-flex h-9 w-9 items-center justify-center rounded-lg text-stone-600 transition-colors hover:bg-rose-50 hover:text-rose-700 motion-reduce:transition-none', focusRing)}
                            >
                              <Trash2 aria-hidden="true" className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
};
