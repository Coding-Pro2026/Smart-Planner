import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Cpu,
  Lock,
  RefreshCw,
  ShieldCheck,
  X,
} from 'lucide-react';
import { FullVerificationReport } from '../tests/runAuditSuite';
import { ModelRoutingConfig } from '../types/domain';

interface SecurityAuditModalProps {
  isOpen: boolean;
  onClose: () => void;
  routingConfig: ModelRoutingConfig;
  onUpdateRoutingConfig: (next: ModelRoutingConfig) => Promise<void>;
}

export const SecurityAuditModal: React.FC<SecurityAuditModalProps> = ({
  isOpen,
  onClose,
  routingConfig,
  onUpdateRoutingConfig,
}) => {
  const [report, setReport] = useState<FullVerificationReport | null>(null);
  const [vaultStatus, setVaultStatus] = useState<{
    tenantId: string;
    cipherSuite: string;
    envelopePreview: string | null;
    serverGeminiConfigured: boolean;
  } | null>(null);
  const [isRunningAudit, setIsRunningAudit] = useState(false);
  const [isSavingRouting, setIsSavingRouting] = useState(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  const fetchAuditAndVault = async () => {
    setIsRunningAudit(true);
    try {
      const [auditRes, vaultRes] = await Promise.all([
        fetch('/api/security/audit'),
        fetch('/api/vault/status'),
      ]);
      const auditData = await auditRes.json();
      const vaultData = await vaultRes.json();
      setReport(auditData);
      setVaultStatus(vaultData);
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

  const handleSaveRouting = async (next: ModelRoutingConfig) => {
    setIsSavingRouting(true);
    setSaveBanner(null);
    try {
      await onUpdateRoutingConfig(next);
      const vaultRes = await fetch('/api/vault/status');
      const vaultData = await vaultRes.json();
      setVaultStatus(vaultData);
      setSaveBanner('Encrypted model routing profile sealed in AES-256-GCM server vault.');
    } finally {
      setIsSavingRouting(false);
    }
  };

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
          {/* Part 1: Model Routing & Server-Side AES-256-GCM Envelope Vault */}
          <div className="p-5 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-600" />
                  Task-Specific Model Routing & AES-256-GCM Envelope Encryption
                </h3>
                <p className="text-xs text-slate-500">
                  Server-side credentials are automatically managed via environment secrets and never exposed to client bundles
                </p>
              </div>
              {vaultStatus && (
                <span className="text-xs font-mono text-emerald-700 font-medium flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" />
                  {vaultStatus.cipherSuite}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Fast Categorization & Checklist Model
                </label>
                <select
                  value={routingConfig.fastTaskProfile}
                  onChange={(e) =>
                    handleSaveRouting({
                      ...routingConfig,
                      fastTaskProfile: e.target.value as ModelRoutingConfig['fastTaskProfile'],
                    })
                  }
                  disabled={isSavingRouting}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono text-xs"
                >
                  <option value="gemini-3.8-flash">gemini-3.8-flash (Balanced Fast)</option>
                  <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Ultra-Low Latency)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Multimodal Vision & Contract OCR Model
                </label>
                <select
                  value={routingConfig.reasoningVisionProfile}
                  onChange={(e) =>
                    handleSaveRouting({
                      ...routingConfig,
                      reasoningVisionProfile: e.target.value as ModelRoutingConfig['reasoningVisionProfile'],
                    })
                  }
                  disabled={isSavingRouting}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md font-mono text-xs"
                >
                  <option value="gemini-3.8-flash">gemini-3.8-flash (Multimodal Structured)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Vault Storage Mode
                </label>
                <select
                  value={routingConfig.encryptionMode}
                  onChange={(e) =>
                    handleSaveRouting({
                      ...routingConfig,
                      encryptionMode: e.target.value as ModelRoutingConfig['encryptionMode'],
                    })
                  }
                  disabled={isSavingRouting}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-xs"
                >
                  <option value="aes_256_gcm_vault">AES-256-GCM Envelope Vault (HKDF)</option>
                  <option value="session_memory">Ephemeral Session Memory</option>
                </select>
              </div>
            </div>

            {vaultStatus?.envelopePreview && (
              <div className="text-[11px] font-mono text-slate-500 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <span>
                  Tenant ID: <strong className="text-slate-800">{vaultStatus.tenantId}</strong> · Sealed Envelope Ciphertext: {vaultStatus.envelopePreview}
                </span>
                {saveBanner && <span className="text-emerald-700">{saveBanner}</span>}
              </div>
            )}
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
