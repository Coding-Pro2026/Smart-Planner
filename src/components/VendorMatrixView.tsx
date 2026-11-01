import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSearch,
  Loader2,
  Plus,
  Scale,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { EventRecord, ParsedVendorTerms, VendorRecord, VendorStatus } from '../types/domain';
import { postJson } from '../lib/api';
import { Button, Card, EmptyState, Field, PageHeader, cx, inputCls } from './ui/kit';

interface VendorMatrixViewProps {
  event: EventRecord;
  vendors: VendorRecord[];
  onAddParsedVendor: (vendor: Omit<VendorRecord, 'id' | 'event_id'>) => void;
  onUpdateVendorStatus: (vendorId: string, status: VendorStatus) => void;
}

const SAMPLE_RAW_QUOTE = `PROPOSAL: Lumiere Botanicals & Architectural Floral Design
Service Type: Floral & Tablescape Scenography
1. Base Floral & Hanging Olive Canopy Package: $8,400.00
2. Tableware & Borosilicate Candle Hurricane Rental: $1,200.00 (Included in Base: $9,600.00)
TERMS & SURCHARGES:
- Mandatory 21% Studio Production & Rigging Service Charge applies to all items.
- 4% Lead Florist Gratuity + 8.5% California Sales Tax.
- Hidden/Additional Surcharges: $550 Post-Midnight Strike Crew Fee; $350 Green Waste Disposal Fee.
- Payment Schedule: 50% non-refundable retainer upon signature; 50% balance due 30 days prior to event.
- Cancellation Clause: 100% of contract balance remains payable if cancelled within 60 days of event date.
- Risk Clause: Studio reserves unilateral right to substitute up to 40% of floral varieties at market discretion without credit.`;

export const VendorMatrixView: React.FC<VendorMatrixViewProps> = ({
  event,
  vendors,
  onAddParsedVendor,
  onUpdateVendorStatus,
}) => {
  const [showAnalyzerDrawer, setShowAnalyzerDrawer] = useState(false);
  const [vendorName, setVendorName] = useState('');
  const [serviceType, setServiceType] = useState('Floral & Tablescape');
  const [rawQuoteText, setRawQuoteText] = useState('');
  const [filename, setFilename] = useState('Vendor_Proposal_2027.pdf');
  const [isParsing, setIsParsing] = useState(false);
  const [parseFeedback, setParseFeedback] = useState<string | null>(null);
  const [parseFailed, setParseFailed] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFilename(file.name);
    if (!vendorName) {
      setVendorName(file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' '));
    }
    const isTextLike =
      file.type.startsWith('text/') || /\.(txt|md|csv|json|eml|rtf)$/i.test(file.name);
    if (!isTextLike || file.size > 2_000_000) {
      setParseFailed(true);
      setParseFeedback(
        'PDF and image quotes can’t be read in the browser — please open the document, copy the text and paste it into the box.'
      );
      return;
    }
    try {
      const text = await file.text();
      setRawQuoteText(text.slice(0, 20000));
      setParseFeedback(null);
    } catch {
      setParseFailed(true);
      setParseFeedback('That file could not be read. Try pasting the quote text instead.');
    }
  };

  const handleLoadSampleQuote = () => {
    setVendorName('Lumiere Botanicals & Scenography');
    setServiceType('Floral & Tablescape');
    setFilename('Lumiere_Botanicals_Napa_Quote.pdf');
    setRawQuoteText(SAMPLE_RAW_QUOTE);
  };

  const handleRunQuoteParser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawQuoteText.trim()) return;

    setIsParsing(true);
    setParseFeedback(null);
    setParseFailed(false);

    const res = await postJson<{
      vendorName: string;
      serviceType: string;
      filename: string;
      parsed_terms: ParsedVendorTerms;
    }>('/api/agents/parse-quote', {
      vendorName: vendorName.trim() || 'Prospective Vendor',
      serviceType: serviceType.trim() || 'Event Services',
      rawQuoteText,
      filename,
    });
    setIsParsing(false);

    if (!res.ok || !res.data?.parsed_terms) {
      setParseFailed(true);
      setParseFeedback(res.ok ? 'The analyzer returned no result. Please try again.' : res.error);
      return;
    }
    const data = res.data;
    const total = Number(data.parsed_terms.total_true_cost) || 0;
    const name = String(data.vendorName || 'Prospective Vendor');
    onAddParsedVendor({
      name,
      service_type: data.serviceType,
      quote_amount: data.parsed_terms.base_fee,
      status: 'quoted',
      contact_email: `contracts@${name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) || 'vendor'}.com`,
      contract_filename: data.filename,
      parsed_terms: data.parsed_terms,
    });
    setParseFeedback(
      `Analyzed ${name}: found ${
        data.parsed_terms.hidden_fees_detected?.length ?? 0
      } hidden fee(s) and ${data.parsed_terms.risk_clauses?.length ?? 0} clause(s) to review. True total cost is $${total.toLocaleString('en-US')}.`
    );
    setRawQuoteText('');
    setVendorName('');
    setShowAnalyzerDrawer(false);
  };

  const money = (n: number) => `$${(Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  const booked = vendors.filter((v) => v.status === 'booked').length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Scale className="h-4 w-4" />}
        eyebrow="Vendors"
        title="Vendors & quote comparison"
        description="Compare advertised prices against true all-in costs, including hidden fees, service charges and taxes."
        stat={vendors.length ? { value: `${booked}/${vendors.length}`, label: 'vendors booked' } : undefined}
        actions={
          <Button variant="primary" aria-expanded={showAnalyzerDrawer} aria-controls="quote-analyzer" onClick={() => setShowAnalyzerDrawer((prev) => !prev)}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            {showAnalyzerDrawer ? 'Close analyzer' : 'Analyze a quote'}
          </Button>
        }
      />

      {parseFeedback && (
        <div
          role={parseFailed ? 'alert' : 'status'}
          className={cx(
            'flex items-center justify-between gap-4 rounded-xl border p-4 text-sm',
            parseFailed
              ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-200'
              : 'border-[#C9DDCF] bg-[#EEF4EF] text-[#2F4A38] dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
          )}
        >
          <span className="flex items-start gap-3">
            {parseFailed ? <AlertTriangle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" /> : <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" />}
            {parseFeedback}
          </span>
          <Button variant="ghost" className="!h-8 shrink-0" onClick={() => setParseFeedback(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {showAnalyzerDrawer && (
        <Card as="div" className="p-6" id="quote-analyzer">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-xl">
              <h3 className="flex items-center gap-2 text-base font-semibold leading-6 text-stone-900">
                <FileSearch aria-hidden="true" className="h-4 w-4 text-[#3B5943] dark:text-emerald-300" />
                Contract & quote analyzer
              </h3>
              <p className="mt-1 text-sm leading-5 text-stone-600">
                Paste a vendor quote or upload a text file to spot hidden fees and calculate the true price for {event.title}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleLoadSampleQuote}>Try a sample</Button>
              <label
                className={cx(
                  'inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-medium text-stone-900 transition-colors hover:border-stone-400 hover:bg-stone-50 focus-within:ring-2 focus-within:ring-[#4A6B53] focus-within:ring-offset-2'
                )}
              >
                <Upload aria-hidden="true" className="h-4 w-4" />
                Upload file
                <input type="file" accept=".txt,.md,.json,.csv,.eml,.rtf,.pdf" onChange={handleFileUpload} className="sr-only" />
              </label>
            </div>
          </div>

          <form onSubmit={handleRunQuoteParser} className="mt-5 space-y-4" aria-busy={isParsing}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Vendor name">
                <input type="text" maxLength={120} placeholder="e.g. Lumiere Botanicals" value={vendorName} onChange={(e) => setVendorName(e.target.value)} className={inputCls} />
              </Field>
              <Field label="Category">
                <input type="text" maxLength={80} placeholder="e.g. Catering, Floral, Photography" value={serviceType} onChange={(e) => setServiceType(e.target.value)} className={inputCls} />
              </Field>
            </div>
            <Field label="Quote or contract text" hint="PDFs can't be read in the browser. Copy the text from the document and paste it here.">
              <textarea
                rows={5}
                maxLength={20000}
                placeholder="Paste the vendor's email, pricing breakdown or contract terms…"
                value={rawQuoteText}
                onChange={(e) => setRawQuoteText(e.target.value)}
                className={cx(inputCls, 'h-auto py-2.5 font-mono text-xs leading-5')}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setShowAnalyzerDrawer(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={isParsing || !rawQuoteText.trim()}>
                {isParsing ? (
                  <>
                    <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> Scanning for hidden fees…
                  </>
                ) : (
                  <>
                    <Scale aria-hidden="true" className="h-4 w-4" /> Extract price & compare
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {vendors.length === 0 ? (
        <EmptyState
          icon={<Scale className="h-5 w-5" />}
          title="No vendor quotes yet"
          body="Paste a quote and we'll show the true all-in price, hidden fees and risky clauses."
          action={<Button variant="primary" onClick={() => setShowAnalyzerDrawer(true)}>Analyze a quote</Button>}
        />
      ) : (
        <ul className="grid grid-cols-1 items-stretch gap-6 md:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
          {vendors.map((vendor) => {
            const terms = vendor.parsed_terms;
            const delta = Math.round((terms.total_true_cost - terms.base_fee) * 100) / 100;
            const pct = terms.service_charge_pct + terms.gratuity_pct + terms.tax_pct;
            return (
              <li key={vendor.id} className="flex">
                <Card as="article" interactive className="flex w-full flex-col justify-between gap-6 p-6">
                  <div className="space-y-5">
                    <div className="space-y-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium uppercase tracking-[0.08em] text-stone-600">{vendor.service_type}</p>
                        <h3 className="mt-0.5 text-base font-semibold leading-6 tracking-[-0.01em] text-stone-900">{vendor.name}</h3>
                      </div>
                      <select
                        aria-label={`Booking status for ${vendor.name}`}
                        value={vendor.status}
                        onChange={(e) => onUpdateVendorStatus(vendor.id, e.target.value as VendorStatus)}
                        className={cx(inputCls, '!h-9 !w-full capitalize')}
                      >
                        <option value="shortlisted">Shortlisted</option>
                        <option value="quoted">Quoted</option>
                        <option value="negotiating">Negotiating</option>
                        <option value="booked">Booked</option>
                        <option value="declined">Declined</option>
                      </select>
                    </div>

                    <dl className="space-y-2.5 rounded-xl border border-stone-200 bg-stone-50 p-4">
                      <div className="flex items-baseline justify-between text-sm text-stone-600">
                        <dt>Advertised base price</dt>
                        <dd className="font-mono tabular-nums">{money(terms.base_fee)}</dd>
                      </div>
                      <div className="flex items-baseline justify-between text-sm text-amber-800 dark:text-amber-300">
                        <dt>Service fee, gratuity & tax</dt>
                        <dd className="font-mono font-medium tabular-nums">
                          +{money(delta)} ({pct}%)
                        </dd>
                      </div>
                      <div className="flex items-baseline justify-between border-t border-stone-200 pt-2.5">
                        <dt className="text-sm font-semibold text-stone-900">True all-in price</dt>
                        <dd className="font-mono text-xl font-semibold tabular-nums text-stone-900">{money(terms.total_true_cost)}</dd>
                      </div>
                    </dl>

                    {terms.hidden_fees_detected.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-300">
                          <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0" />
                          Extra fees in the fine print
                        </p>
                        <ul className="list-disc space-y-1 pl-5 text-sm leading-5 text-stone-600">
                          {terms.hidden_fees_detected.map((fee, idx) => (
                            <li key={idx}>{fee}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {terms.risk_clauses.length > 0 && (
                      <div className="space-y-2">
                        <p className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                          <ShieldAlert aria-hidden="true" className="h-4 w-4 shrink-0 text-rose-700 dark:text-rose-300" />
                          Contract watch-outs
                        </p>
                        <ul className="space-y-2">
                          {terms.risk_clauses.map((rc, idx) => (
                            <li key={idx} className="space-y-1 rounded-xl border border-stone-200 bg-stone-50 p-3 text-sm leading-5">
                              <p className="font-medium text-stone-900">{rc.clause}</p>
                              <p className="text-stone-600">Tip: {rc.recommendation}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <dl className="space-y-1.5 border-t border-stone-100 pt-4 text-sm leading-5 text-stone-600">
                    <div>
                      <dt className="inline font-medium text-stone-800">Payments: </dt>
                      <dd className="inline">{terms.payment_schedule.join(' · ')}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium text-stone-800">Cancellation: </dt>
                      <dd className="inline">{terms.cancellation_policy}</dd>
                    </div>
                  </dl>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
