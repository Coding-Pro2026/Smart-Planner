import React, { useEffect, useRef, useState } from 'react';
import { useDialogFocus } from './ui/kit';
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

  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(isOpen, dialogRef, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="security-audit-title" className="outline-none bg-white border border-stone-200 rounded-xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-stone-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
            <div>
              <h2 id="security-audit-title" className="text-base font-semibold text-stone-900">
                Post-Production Security Audit, Unit Verification & Model Routing Vault
              </h2>
              <p className="text-xs text-stone-600">
                Live execution of deterministic math assertions, DAG cycle protection, AES-256-GCM envelope vault, and RLS checks
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close security audit"
            onClick={onClose}
            className="p-1.5 text-stone-600 hover:text-stone-700 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Part 1: Bring-your-own-key AI status + envelope vault info */}
          <div className="p-5 bg-stone-50 border border-stone-200 rounded-lg space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-stone-900 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#3B5943] dark:text-emerald-300" />
                  AI Provider (Bring Your Own Key)
                </h3>
                <p className="text-xs text-stone-600">
                  Currently using: <strong className="text-stone-800">{aiStatusLabel}</strong>. Keys stay in your browser and are never stored or logged by the server.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenAiSettings();
                }}
                className="h-9 px-4 text-sm font-medium inline-flex items-center justify-center text-white bg-[#3B5943] hover:bg-[#314a38] rounded-md"
              >
                Configure AI
              </button>
            </div>
            {vaultStatus && (
              <div className="text-xs font-mono text-stone-600 flex flex-wrap items-center gap-2 pt-2 border-t border-stone-200">
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
                <h3 className="text-sm font-semibold text-stone-900">
                  Automated Unit, Integration & Security Verification Suite
                </h3>
                <p className="text-xs text-stone-600">
                  Verifies budget edge cases, OLS linear regression, CPM cycle detection, AES-256-GCM roundtrips, SSRF/Prompt Injection guards, and Tenant RLS
                </p>
              </div>
              <button
                onClick={fetchAuditAndVault}
                disabled={isRunningAudit}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-md transition-colors whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRunningAudit ? 'animate-spin' : ''}`} />
                Re-Run All 9 Assertions
              </button>
            </div>

            {report && (
              <div className="border border-stone-200 rounded-lg divide-y divide-stone-200">
                {report.checks.map((chk) => (
                  <div
                    key={chk.id}
                    className="p-3.5 flex items-start justify-between gap-4 hover:bg-stone-50 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span className="text-xs font-semibold text-stone-900">{chk.title}</span>
                      </div>
                      <p className="text-xs text-stone-600 pl-6">{chk.assertionDetails}</p>
                    </div>
                    <div className="text-right font-mono text-xs text-stone-600 shrink-0">
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
        <div className="px-6 py-3.5 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-xs text-stone-600">
          <span>
            Status:{' '}
            <strong className="text-emerald-700 font-mono">
              {report ? `${report.passedChecks}/${report.totalChecks} ASSERTIONS VERIFIED` : 'RUNNING...'}
            </strong>
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-white bg-[#3B5943] hover:bg-[#314a38] rounded-md"
          >
            Close Verification Report
          </button>
        </div>
      </div>
    </div>
  );
};
