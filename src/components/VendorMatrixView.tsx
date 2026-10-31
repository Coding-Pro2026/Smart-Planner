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
      } hidden fee(s) and ${data.parsed_terms.risk_clauses?.length ?? 0} clause(s) to review. True total cost is $${total.toLocaleString()}.`
    );
    setRawQuoteText('');
    setVendorName('');
    setShowAnalyzerDrawer(false);
  };

  return (
    <div className="space-y-8">
      {/* Clean Header & "+ Analyze Vendor Quote" Button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Vendors &amp; Quote Comparison</h1>
          <p className="text-sm text-stone-500 mt-0.5">
            Compare advertised base prices against true all-in costs (including hidden fees, service charges, and taxes).
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAnalyzerDrawer((prev) => !prev)}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-2xs whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          {showAnalyzerDrawer ? 'Close Quote Analyzer' : 'Analyze New Vendor Quote'}
        </button>
      </div>

      {parseFeedback && (
        <div
          role={parseFailed ? 'alert' : 'status'}
          className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium ${
            parseFailed
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <span className="inline-flex items-center gap-2">
            {parseFailed ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            {parseFeedback}
          </span>
          <button
            onClick={() => setParseFeedback(null)}
            className="text-emerald-700 hover:underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Collapsible Quote Analyzer Panel */}
      {showAnalyzerDrawer && (
        <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <FileSearch className="w-4 h-4 text-indigo-600" />
                AI Contract &amp; Quote Analyzer
              </h2>
              <p className="text-xs text-stone-500 mt-0.5">
                Paste a vendor quote or upload a contract to automatically spot hidden fees and calculate the true total price for {event.title}.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadSampleQuote}
                className="px-3.5 py-2 text-xs font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 rounded-xl transition-colors whitespace-nowrap"
              >
                Try with Sample Quote
              </button>
              <label className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl cursor-pointer transition-colors whitespace-nowrap">
                <Upload className="w-3.5 h-3.5" />
                Upload File
                <input
                  type="file"
                  accept=".pdf,.txt,.md,.json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <form onSubmit={handleRunQuoteParser} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Vendor Name
                </label>
                <input
                  type="text"
                  placeholder="e.g., Lumiere Botanicals"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1.5">
                  Category
                </label>
                <input
                  type="text"
                  placeholder="e.g., Catering, Floral, Photography"
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1.5">
                Quote or Contract Text
              </label>
              <textarea
                rows={4}
                placeholder="Paste the vendor's email, pricing breakdown, or contract terms here (or click 'Try with Sample Quote' above)..."
                value={rawQuoteText}
                onChange={(e) => setRawQuoteText(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-mono border border-stone-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowAnalyzerDrawer(false)}
                className="px-4 py-2 text-xs font-medium text-stone-600 bg-stone-100 hover:bg-stone-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isParsing || !rawQuoteText.trim()}
                className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-stone-900 hover:bg-stone-800 disabled:opacity-50 rounded-xl transition-colors whitespace-nowrap"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Scanning for Hidden Fees...
                  </>
                ) : (
                  <>
                    <Scale className="w-3.5 h-3.5" />
                    Extract Price &amp; Compare
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Clean Side-by-Side Vendor Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {vendors.map((vendor) => {
          const terms = vendor.parsed_terms;
          const hiddenMarkupDelta =
            Math.round((terms.total_true_cost - terms.base_fee) * 100) / 100;

          return (
            <div
              key={vendor.id}
              className="bg-white border border-stone-200/90 rounded-2xl p-6 flex flex-col justify-between space-y-6 shadow-2xs"
            >
              <div className="space-y-5">
                {/* Vendor Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-stone-500">{vendor.service_type}</div>
                    <h3 className="text-base font-bold text-stone-900 mt-0.5">
                      {vendor.name}
                    </h3>
                  </div>
                  <select
                    value={vendor.status}
                    onChange={(e) =>
                      onUpdateVendorStatus(vendor.id, e.target.value as VendorStatus)
                    }
                    className="px-3 py-1.5 text-xs font-medium border border-stone-200 rounded-xl bg-stone-50 text-stone-800 capitalize shrink-0"
                  >
                    <option value="shortlisted">Shortlisted</option>
                    <option value="quoted">Quoted</option>
                    <option value="negotiating">Negotiating</option>
                    <option value="booked">Booked</option>
                    <option value="declined">Declined</option>
                  </select>
                </div>

                {/* Quoted vs True Price Box */}
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200/80 space-y-2.5">
                  <div className="flex items-baseline justify-between text-xs text-stone-600">
                    <span>Advertised Base Price</span>
                    <span className="font-mono tabular-nums">
                      ${terms.base_fee.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-xs text-amber-800">
                    <span>Service Fee, Gratuity &amp; Tax</span>
                    <span className="font-mono tabular-nums font-medium">
                      +${hiddenMarkupDelta.toLocaleString('en-US', { maximumFractionDigits: 0 })} (
                      {terms.service_charge_pct + terms.gratuity_pct + terms.tax_pct}%)
                    </span>
                  </div>
                  <div className="pt-2.5 border-t border-stone-200 flex items-baseline justify-between">
                    <span className="text-xs font-semibold text-stone-900">
                      True All-In Price
                    </span>
                    <span className="text-xl font-bold font-mono tabular-nums text-stone-900">
                      ${terms.total_true_cost.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                </div>

                {/* Hidden Fees List */}
                {terms.hidden_fees_detected.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      Extra Fees Found in Fine Print
                    </p>
                    <ul className="space-y-1 text-xs text-stone-600">
                      {terms.hidden_fees_detected.map((fee, idx) => (
                        <li key={idx}>· {fee}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Contract Watchouts */}
                {terms.risk_clauses.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-stone-800 flex items-center gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      Contract Watchouts
                    </p>
                    <div className="space-y-2">
                      {terms.risk_clauses.map((rc, idx) => (
                        <div
                          key={idx}
                          className="p-3 rounded-xl bg-stone-50 border border-stone-200/80 text-xs space-y-1"
                        >
                          <div className="font-medium text-stone-900">{rc.clause}</div>
                          <p className="text-stone-500">Tip: {rc.recommendation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment & Cancellation Footer */}
              <div className="pt-4 border-t border-stone-100 space-y-1.5 text-xs text-stone-500">
                <div>
                  <span className="font-medium text-stone-700">Payments: </span>
                  {terms.payment_schedule.join(' · ')}
                </div>
                <div>
                  <span className="font-medium text-stone-700">Cancellation: </span>
                  {terms.cancellation_policy}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
