import { useEffect, useRef, useState } from 'react';
import { CalendarPlus, Download, FileJson, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import {
  buildBudgetCsv,
  buildGuestCsv,
  buildIcs,
  buildPlanMarkdown,
  downloadTextFile,
  safeFilename,
  type ExportBundle,
} from '../lib/exporters';

export function ExportMenu({
  bundle,
  onToast,
}: {
  bundle: ExportBundle;
  onToast: (kind: 'success' | 'error', text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (label: string, ext: string, mime: string, build: () => string) => {
    try {
      const ok = downloadTextFile(safeFilename(`${bundle.event.title}-${label}`, ext), build(), mime);
      onToast(ok ? 'success' : 'error', ok ? `${label} downloaded` : 'Download is not supported in this browser');
    } catch (err) {
      onToast('error', `Could not create ${label}: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
    setOpen(false);
  };

  const items = [
    { icon: CalendarPlus, label: 'Calendar (.ics)', hint: 'Add every milestone to Google/Apple/Outlook', fn: () => run('calendar', 'ics', 'text/calendar', () => buildIcs(bundle)) },
    { icon: FileText, label: 'Plan summary (.md)', hint: 'Budget, timeline, vendors & guests', fn: () => run('plan', 'md', 'text/markdown', () => buildPlanMarkdown(bundle)) },
    { icon: FileSpreadsheet, label: 'Budget (.csv)', hint: 'Open in Excel or Sheets', fn: () => run('budget', 'csv', 'text/csv', () => buildBudgetCsv(bundle)) },
    { icon: FileSpreadsheet, label: 'Guest list (.csv)', hint: 'RSVPs, diets and tables', fn: () => run('guests', 'csv', 'text/csv', () => buildGuestCsv(bundle)) },
    { icon: FileJson, label: 'Full backup (.json)', hint: 'Everything for this event', fn: () => run('backup', 'json', 'application/json', () => JSON.stringify(bundle, null, 2)) },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors whitespace-nowrap"
      >
        <Download className="w-3.5 h-3.5" />
        Export
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 bg-white border border-stone-200 rounded-2xl shadow-xl p-1.5 z-40"
        >
          {items.map(({ icon: Icon, label, hint, fn }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={fn}
              className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 text-left"
            >
              <Icon className="w-4 h-4 mt-0.5 text-[#4A6B53] shrink-0" />
              <span>
                <span className="block text-xs font-semibold text-stone-900">{label}</span>
                <span className="block text-[11px] text-stone-500">{hint}</span>
              </span>
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              setTimeout(() => window.print(), 50);
            }}
            className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-stone-50 text-left"
          >
            <Printer className="w-4 h-4 mt-0.5 text-[#4A6B53] shrink-0" />
            <span>
              <span className="block text-xs font-semibold text-stone-900">Print / save as PDF</span>
              <span className="block text-[11px] text-stone-500">Prints the current view</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
