import React from 'react';
import {
  ArrowRight,
  Bot,
  Calculator,
  CheckCircle2,
  Cpu,
  FileSearch,
  GitBranch,
  Layers,
  Lock,
  Palette,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { BudgetCalculationResult, CpmScheduleResult } from '../lib/deterministicEngine';
import { EventRecord } from '../types/domain';

interface ArchitectureBlueprintViewProps {
  event: EventRecord;
  budgetResult: BudgetCalculationResult;
  cpmResult: CpmScheduleResult;
  onNavigateTab: (
    tab: 'overview' | 'budget' | 'forecasting' | 'timeline' | 'vendors' | 'theme_rsvps'
  ) => void;
  onOpenSecurityModal: () => void;
}

export const ArchitectureBlueprintView: React.FC<ArchitectureBlueprintViewProps> = ({
  event,
  budgetResult,
  cpmResult,
  onNavigateTab,
  onOpenSecurityModal,
}) => {
  return (
    <div className="space-y-8">
      {/* Executive Explanation Header */}
      <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-4">
        <div className="max-w-3xl space-y-2">
          <div className="text-xs font-mono font-semibold text-[#3B5943] dark:text-emerald-300">
            SYSTEM ARCHITECTURE & INTERACTIVE WORKFLOW GUIDE
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-stone-900">
            How PlanGenie Works: Strict Separation of Generative AI & Deterministic Math
          </h2>
          <p className="text-sm text-stone-600 leading-relaxed">
            PlanGenie eliminates LLM math and scheduling hallucinations by separating{' '}
            <strong className="text-stone-900">Generative AI Ideation & Extraction</strong> from{' '}
            <strong className="text-stone-900">Deterministic Financial, Regression & Graph Engines</strong>.
            Follow the 4-stage pipeline below or click any module to jump directly to its live workspace.
          </p>
        </div>

        {/* 4-Step End-to-End Pipeline Diagram */}
        <div className="pt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-stone-600">
                <span>01. INGESTION & VISION</span>
                <FileSearch className="w-4 h-4 text-[#3B5943] dark:text-emerald-300" />
              </div>
              <h3 className="text-sm font-semibold text-stone-900">
                Unstructured Quotes & Moodboards
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Ingests vendor contract PDFs/proposals and inspiration photos. Sanitizes all inputs against Prompt Injection & SSRF before extraction.
              </p>
            </div>
            <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs">
              <button
                onClick={() => onNavigateTab('vendors')}
                className="font-medium text-[#3B5943] dark:text-emerald-300 hover:text-[#3B5943] dark:text-emerald-300 inline-flex items-center gap-1"
              >
                Test Quote OCR <ArrowRight className="w-3 h-3" />
              </button>
              <button
                onClick={() => onNavigateTab('theme_rsvps')}
                className="font-medium text-stone-600 hover:text-stone-900"
              >
                Vision Studio
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-stone-600">
                <span>02. MULTI-AGENT GRAPH</span>
                <Bot className="w-4 h-4 text-[#3B5943] dark:text-emerald-300" />
              </div>
              <h3 className="text-sm font-semibold text-stone-900">
                Supervisor + 4 Sub-Agents
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Supervisor delegates tasks to Theme, Budget, Logistics, and Vendor agents. Emits typed tool proposals requiring human <span className="font-mono">[Accept / Reject]</span> confirmation.
              </p>
            </div>
            <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs">
              <button
                onClick={() => onNavigateTab('overview')}
                className="font-medium text-[#3B5943] dark:text-emerald-300 hover:text-[#3B5943] dark:text-emerald-300 inline-flex items-center gap-1"
              >
                Open Agent Co-Pilot <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-stone-600">
                <span>03. DETERMINISTIC CORE</span>
                <Calculator className="w-4 h-4 text-[#3B5943] dark:text-emerald-300" />
              </div>
              <h3 className="text-sm font-semibold text-stone-900">
                IEEE-754 Math, OLS & CPM DAG
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Executes exact cent budget rollups, Ordinary Least Squares (<span className="font-mono">y=mx+b</span>) YoY cost forecasting, and Critical Path DAG scheduling with cycle detection.
              </p>
            </div>
            <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs">
              <button
                onClick={() => onNavigateTab('forecasting')}
                className="font-medium text-[#3B5943] dark:text-emerald-300 hover:text-[#3B5943] dark:text-emerald-300 inline-flex items-center gap-1"
              >
                OLS Forecasting <ArrowRight className="w-3 h-3" />
              </button>
              <button
                onClick={() => onNavigateTab('timeline')}
                className="font-medium text-stone-600 hover:text-stone-900"
              >
                CPM Timeline
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 flex flex-col justify-between space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-mono text-stone-600">
                <span>04. SECURITY & RLS VAULT</span>
                <Lock className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="text-sm font-semibold text-stone-900">
                AES-256-GCM & Tenant Isolation
              </h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Protects routing profiles using per-tenant HKDF-SHA256 keys, enforces Row-Level Security (RLS), and runs 9 automated verification tests.
              </p>
            </div>
            <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs">
              <button
                onClick={onOpenSecurityModal}
                className="font-medium text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-1"
              >
                Run 9-Check Audit <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Mathematical & Algorithmic Specifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Spec 1: OLS Linear Regression Forecasting */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-[#3B5943] dark:text-emerald-300">
                ENGINE 01 · LINEAR REGRESSION
              </span>
              <TrendingUp className="w-4 h-4 text-[#3B5943] dark:text-emerald-300" />
            </div>
            <h3 className="text-base font-semibold text-stone-900">
              YoY Category Escalation via Ordinary Least Squares (OLS)
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Calculates potential year-over-year cost increases for major categories like{' '}
              <strong className="text-stone-900">Catering</strong> and{' '}
              <strong className="text-stone-900">Venue</strong> by fitting a linear regression line across 2021–2026 historical price indices:
            </p>
            <div className="p-3 bg-stone-900 text-stone-100 rounded-lg font-mono text-xs space-y-1">
              <div>m = (n·Σxy - Σx·Σy) / (n·Σx² - (Σx)²)</div>
              <div>b = ȳ - m·x̄</div>
              <div>Forecast(yr) = Cost₂₀₂₆ × (m·yr + b) / Index₂₀₂₆</div>
              <div className="text-emerald-300">95% CI = ±1.96 · σ_est · √(1 + Δt)</div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('forecasting')}
            className="w-full py-2 px-4 text-xs font-medium text-white bg-[#3B5943] hover:bg-[#314a38] rounded-lg transition-colors"
          >
            Open OLS Budget Forecasting Widget
          </button>
        </div>

        {/* Spec 2: Deterministic Budget Engine */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-[#3B5943] dark:text-emerald-300">
                ENGINE 02 · IEEE-754 FINANCIAL LEDGER
              </span>
              <Calculator className="w-4 h-4 text-[#3B5943] dark:text-emerald-300" />
            </div>
            <h3 className="text-base font-semibold text-stone-900">
              Deterministic Per-Guest & Contingency Rollup
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              The LLM only proposes structured line-item parameters. All arithmetic is executed by <span className="font-mono">calculateEventBudget()</span> with zero floating-point drift:
            </p>
            <div className="p-3 bg-stone-900 text-stone-100 rounded-lg font-mono text-xs space-y-1">
              <div>Base = round(UnitCost × EffectiveQty × Multiplier)</div>
              <div>Tax = round(Base × TaxPct / 100)</div>
              <div>Buffer = round(Base × ContingencyPct / 100)</div>
              <div className="text-emerald-300">
                Active Spend: ${budgetResult.totalProjectedSpend.toLocaleString()} ({budgetResult.burnRatePct}%)
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('budget')}
            className="w-full py-2 px-4 text-xs font-medium text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
          >
            Open Interactive Budget Simulator
          </button>
        </div>

        {/* Spec 3: DAG & Critical Path Method (CPM) */}
        <div className="bg-white border border-stone-200 rounded-xl p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-[#3B5943] dark:text-emerald-300">
                ENGINE 03 · DAG & CRITICAL PATH (CPM)
              </span>
              <GitBranch className="w-4 h-4 text-[#3B5943] dark:text-emerald-300" />
            </div>
            <h3 className="text-base font-semibold text-stone-900">
              Topological Sort, Cycle Guard & Delay Cascade
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed">
              Tasks are modeled as a Directed Acyclic Graph (DAG). Shifting any upstream milestone automatically cascades downstream dates and recomputes float/slack:
            </p>
            <div className="p-3 bg-stone-900 text-stone-100 rounded-lg font-mono text-xs space-y-1">
              <div>ES(v) = max(ES_offset, max_u∈pred(v) EF(u))</div>
              <div>EF(v) = ES(v) + Duration + Buffer</div>
              <div>Slack(v) = LS(v) - ES(v) [Critical if Slack == 0]</div>
              <div className="text-amber-300">
                Active Span: {cpmResult.totalProjectDurationDays}d ({cpmResult.bottleneckCount} critical nodes)
              </div>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('timeline')}
            className="w-full py-2 px-4 text-xs font-medium text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
          >
            Open CPM DAG Timeline Scheduler
          </button>
        </div>
      </div>
    </div>
  );
};
