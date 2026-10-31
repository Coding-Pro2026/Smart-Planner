import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Lock,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import type { FullVerificationReport } from '../tests/runAuditSuite';

interface SecurityAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiStatusLabel: string;
  onOpenAiSettings: () => void;
}

export const SecurityAuditModal: React.FC<SecurityAuditModalProps> = ({
  isOpen,
  onClose,
  aiStatusLabel,
  onOpenAiSettings,
}) => {
  const [report, setReport] = useState<FullVerificationReport | null>(null);
  const [vaultStatus, setVaultStatus] = useState<{
    tenantId: string;
    cipherSuite: string;
    envelopePreview: string | null;
    serverGeminiConfigured: boolean;
  } | null>(null);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  const fetchAuditAndVault = async () => {
    setIsRunningAudit(true);
    setSaveBanner(null);
    try {
      const [auditRes, vaultRes] = await Promise.all([
        fetch('/api/security/audit'),
        fetch('/api/vault/status'),
      ]);
      if (!auditRes.ok || !vaultRes.ok) throw new Error('The verification service returned an error.');
      const auditData = await auditRes.json();
      const vaultData = await vaultRes.json();
      setReport(auditData);
      setVaultStatus(vaultData);
    } catch (err) {
      setSaveBanner(
        `Couldn't run the verification suite: ${err instanceof Error ? err.message : 'network error'}. Please try again.`
      );
    } finally {
      setIsRunningAudit(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAuditAndVault();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Post-Production Security Audit, Unit Verification & Model Routing Vault
              </h2>
              <p className="text-xs text-slate-500">
                Live execution of deterministic math assertions, DAG cycle protection, AES-256-GCM envelope vault, and RLS checks
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Part 1: Bring-your-own-key AI status + envelope vault info */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                  AI Provider (Bring Your Own Key)
                </h3>
                <p className="text-xs text-slate-500">
                  Currently using: <strong className="text-slate-800">{aiStatusLabel}</strong>. Keys stay in your browser and are never stored or logged by the server.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAiSettings();
                }}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md"
              >
                Configure AI
              </button>
            </div>
            {vaultStatus && (
              <div className="text-[11px] font-mono text-slate-500 flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                <Lock className="w-3.5 h-3.5 text-emerald-700" />
                <span>{vaultStatus.cipherSuite}</span>
              </div>
            )}
            {saveBanner && <p role="alert" className="text-xs text-rose-700">{saveBanner}</p>}
          </div>

          {/* Part 2: Live 9-Check Unit & Security Verification Suite */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Automated Unit, Integration & Security Verification Suite
                </h3>
                <p className="text-xs text-slate-500">
                  Verifies budget edge cases, OLS linear regression, CPM cycle detection, AES-256-GCM roundtrips, SSRF/Prompt Injection guards, and Tenant RLS
                </p>
              </div>
              <button
                onClick={fetchAuditAndVault}
                disabled={isRunningAudit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRunningAudit ? 'animate-spin' : ''}`} />
                Re-Run All 9 Assertions
              </button>
            </div>

            {report && (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-200">
                {report.checks.map((chk) => (
                  <div
                    key={chk.id}
                    className="p-3.5 flex items-start justify-between gap-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-semibold text-slate-900">{chk.title}</span>
                      </div>
                      <p className="text-xs text-slate-600 pl-6">{chk.assertionDetails}</p>
                    </div>
                    <div className="text-right font-mono text-[11px] text-slate-500 shrink-0">
                      <div className="text-emerald-700 font-semibold">
                        {chk.passed ? 'PASSED' : 'FAILED'}
                      </div>
                      <div>{chk.durationMs}ms</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-600">
          <span>
            Status:{' '}
            <strong className="text-emerald-700 font-mono">
              {report ? `${report.passedChecks}/${report.totalChecks} ASSERTIONS VERIFIED` : 'RUNNING...'}
            </strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-md"
          >
            Close Verification Report
          </button>
        </div>
      </div>
    </div>
  );
};
