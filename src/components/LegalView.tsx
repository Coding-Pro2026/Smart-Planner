import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { LEGAL } from '../lib/legalConfig';
import { Backdrop } from './design/Backdrop';

type Doc = 'privacy' | 'terms';

const H2 = ({ id, children }: { id: string; children: React.ReactNode }) => (
  <h2 id={id} className="text-lg font-bold text-stone-900 mt-9 mb-2 scroll-mt-24">
    {children}
  </h2>
);
const P = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-stone-600 leading-relaxed mb-3">{children}</p>;
const UL = ({ children }: { children: React.ReactNode }) => (
  <ul className="list-disc pl-5 space-y-1.5 text-sm text-stone-600 leading-relaxed mb-3">{children}</ul>
);
const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target={href.startsWith('/') ? undefined : '_blank'} rel="noopener noreferrer" className="text-[#4A6B53] underline hover:no-underline">
    {children}
  </a>
);

function Contact() {
  return LEGAL.email ? (
    <>
      <A href={`mailto:${LEGAL.email}`}>{LEGAL.email}</A>
      {LEGAL.address ? ` · ${LEGAL.address}` : ''}
    </>
  ) : (
    <>the contact address published on the website where you found PlanGenie</>
  );
}

function Privacy() {
  return (
    <>
      <P>
        This policy explains what happens to information when you use PlanGenie, an event-planning tool, published by{' '}
        <strong>{LEGAL.operator}</strong> (“we”, “us”). The short version: <strong>your plans stay in your own browser</strong>; we do not
        run user accounts, we do not keep a database of your events, and we do not sell personal data.
      </P>

      <H2 id="data">1. What information is involved</H2>
      <UL>
        <li>
          <strong>Plan data you type in</strong> — event names, dates, locations, budgets, tasks, vendor quotes, notes, and guest lists
          (guest names, email addresses, party sizes, dietary requirements, seating). This is saved <strong>only in your browser</strong> (localStorage) so it
          survives a refresh. We do not receive a copy unless you use a feature that sends part of it to a service (section 3).
        </li>
        <li>
          <strong>AI settings</strong> — if you bring your own AI key, the provider, model, optional custom URL and key are kept in your browser
          (<em>sessionStorage</em> by default; <em>localStorage</em> only if you tick “Remember on this device”).
        </li>
        <li>
          <strong>Optional Google settings</strong> — a Google OAuth Client ID and/or Google Maps key you choose to paste are kept in your browser.
          Google access tokens are held in memory only.
        </li>
        <li>
          <strong>Technical data</strong> — your IP address and request details reach our server (and our hosting provider) whenever you load the site or
          use a feature. We use the IP address in memory for rate limiting and abuse prevention and do not write it to a database. Our hosting provider
          may keep standard access logs under its own policy.
        </li>
      </UL>
      <P>We do not use advertising or analytics trackers, and we do not set cookies. Browser storage is used only to make the app work as you asked.</P>

      <H2 id="use">2. How we use it</H2>
      <UL>
        <li>To run the features you use (budgeting, timelines, checklists, exports, the AI assistant, maps and hotel search).</li>
        <li>To keep the service secure and available (rate limiting, abuse and error handling).</li>
      </UL>
      <P>
        Legal bases (where GDPR/UK GDPR applies): performing the service you request, and our legitimate interest in security and reliable operation.
      </P>

      <H2 id="sharing">3. Who receives data when you use a feature</H2>
      <P>Data leaves your browser only in these cases:</P>
      <UL>
        <li>
          <strong>AI features (bring your own key).</strong> When you use the assistant, intake chat, Idea Studio, vendor-quote analyzer or moodboard
          generator <em>with your own key</em>, your request goes to our server, which forwards it to <strong>the AI provider you selected</strong> — Google
          (Gemini), Anthropic (Claude), OpenAI, OpenRouter, or a custom endpoint you entered — using your key. The request can include your event details,
          budget, task and vendor summaries, pasted quote text, an uploaded moodboard image and your prompt. Our server uses your key for that request
          only and <strong>does not store or log it or your content</strong>. The provider processes the data under <em>your</em> agreement with it
          (including its retention and training policies) — please review them, and avoid entering information you would not want that provider to process.
          Without a key, these features run entirely on a built-in engine and nothing is sent to an AI provider (unless the operator has configured a
          server-side default key, in which case it is stated in the app or by the operator).
        </li>
        <li>
          <strong>Maps and hotels.</strong> The venue/city text you enter is sent from our server to <A href="https://nominatim.org/release-docs/latest/api/Search/">OpenStreetMap Nominatim</A>{' '}
          and Overpass to find coordinates and nearby hotels. The map you see is an <A href="https://www.openstreetmap.org/copyright">OpenStreetMap</A> embed, so your
          browser contacts openstreetmap.org (your IP address and the map area are visible to them). If you add your own Google Maps key, your browser contacts Google Maps
          instead. “Open in Google Maps” and booking links take you to those sites under their own policies.
        </li>
        <li>
          <strong>Google Calendar.</strong> “Add to Google Calendar”, <code>.ics</code> and email invites use Google’s own pages or your own mail/calendar app; guest emails appear
          in that link or message. If you enable optional two-way sync with <em>your own</em> OAuth Client ID, your browser talks directly to Google to read/write your calendar events;
          we do not receive your Google credentials or tokens.
        </li>
        <li>
          <strong>Fonts and media.</strong> The site loads fonts from Google Fonts and some landing-page videos from Mixkit; those providers can see your IP address and browser details
          when you load the page.
        </li>
        <li>
          <strong>Hosting.</strong> Our hosting/infrastructure provider processes traffic on our behalf.
        </li>
      </UL>
      <P>We do not sell your personal data or share it for advertising.</P>

      <H2 id="guests">4. Information about other people (your guests)</H2>
      <P>
        If you enter other people’s details (names, emails, dietary needs — which can reveal health or religious information), <strong>you</strong> decide why and how
        that data is used and are responsible for having a lawful basis, informing those people, and honouring their requests. Only enter what you need, don’t send
        sensitive details to an AI provider unnecessarily, and delete guest records you no longer need.
      </P>

      <H2 id="retention">5. Retention and your controls</H2>
      <UL>
        <li>Plan data lives in your browser until you delete it: use <em>Delete event</em>, <em>Reset sample data</em> in the footer, or clear site data in your browser.</li>
        <li>Remove AI keys with <em>Remove key</em> in AI Settings; Google/Maps settings can be removed in their panels. Closing the tab clears session-only keys.</li>
        <li>Use <em>Export</em> to back up or move your data — files are created on your device.</li>
        <li>Because we do not hold your plans, we generally cannot retrieve or recover them; clearing your browser data deletes them permanently.</li>
      </UL>

      <H2 id="rights">6. Your rights</H2>
      <P>
        Depending on where you live (for example under GDPR/UK GDPR or CCPA/CPRA) you may have rights to access, correct, delete, restrict or object to processing of personal data, to
        portability, and to complain to a data-protection authority. For the little data we process (technical data in transit), contact us at <Contact />. For data held by
        your AI provider, Google, OpenStreetMap or your hosting provider, contact them directly.
      </P>

      <H2 id="transfers">7. International transfers</H2>
      <P>
        The providers above may process data in countries other than yours (including the United States). Where required, transfers rely on safeguards such as standard contractual
        clauses or the provider’s certifications. By choosing a provider for your key you direct that transfer.
      </P>

      <H2 id="security">8. Security</H2>
      <P>
        We use HTTPS, strict browser security headers, input validation, rate limiting and server-side request protections. No system is perfectly secure; keep your API keys private,
        use session-only storage on shared computers, and rotate keys you suspect are exposed.
      </P>

      <H2 id="children">9. Children</H2>
      <P>PlanGenie is not directed to children under 16 and we do not knowingly collect their personal data.</P>

      <H2 id="changes">10. Changes and contact</H2>
      <P>
        We may update this policy and will change the date above when we do. Questions or requests: <Contact />.
      </P>
    </>
  );
}

function Terms() {
  return (
    <>
      <P>
        These Terms govern your use of PlanGenie (“the Service”), provided by <strong>{LEGAL.operator}</strong>. By using the Service you agree to them. If you do not agree,
        do not use it.
      </P>

      <H2 id="service">1. The Service</H2>
      <P>
        PlanGenie helps you organise events: budgets, timelines, checklists, guest lists, vendor-quote analysis, idea generation and exports. It works offline with a built-in engine and
        can optionally use an AI model through <strong>your own API key</strong>. Plans are stored in your browser; there are no accounts.
      </P>

      <H2 id="use">2. Who may use it, and acceptable use</H2>
      <UL>
        <li>You must be at least 16 (or the age of digital consent where you live) and able to form a binding agreement.</li>
        <li>Do not misuse the Service: no unlawful content, no attempts to break, overload, scrape or probe it, no bypassing rate limits, and no using it to attack others.</li>
        <li>Do not use the custom-endpoint feature to target systems you do not own or have permission to access.</li>
        <li>Do not enter personal data about others unless you have the right to do so (see the <A href="/privacy">Privacy Policy</A>, section 4).</li>
      </UL>

      <H2 id="byok">3. Bring-your-own-key (BYOK) and third-party services</H2>
      <UL>
        <li>AI, map, calendar and hotel features connect to third parties (AI providers, OpenStreetMap, Google). Their services are governed by <strong>their</strong> terms and policies, which you must follow.</li>
        <li>An API key you provide is your credential: <strong>you</strong> are responsible for its security, for all usage and charges on it, and for rotating it if exposed. We never charge you for provider usage and are not liable for it.</li>
        <li>Provider availability, accuracy, rate limits and pricing are outside our control. If a provider fails, the Service may fall back to its built-in engine.</li>
        <li>
          Map and hotel data come from OpenStreetMap contributors and are available under the <A href="https://opendatacommons.org/licenses/odbl/">Open Database Licence</A>. Hotel
          listings do not include prices; always confirm availability and rates with the hotel or booking site.
        </li>
      </UL>

      <H2 id="ai">4. AI output and planning content — not professional advice</H2>
      <UL>
        <li>AI and rule-based suggestions can be wrong, incomplete or out of date. <strong>Verify</strong> everything that matters (dates, costs, permits, insurance, dietary and safety needs) before acting.</li>
        <li>The vendor-quote analyzer highlights fees and clauses it recognises; it is <strong>not legal, financial or tax advice</strong> and may miss terms. Have contracts reviewed by a qualified professional.</li>
        <li>Budget forecasts are illustrative estimates based on generic trends, not predictions or quotes.</li>
        <li>You are responsible for decisions you make and commitments you enter into with vendors, venues and guests.</li>
      </UL>

      <H2 id="content">5. Your content and our rights</H2>
      <P>
        You keep ownership of the content you enter and generate. You grant us only the limited permission needed to process it transiently to provide the features you invoke (for example forwarding a
        request to the provider you chose). The software, design and branding of the Service belong to the operator and its licensors; you receive a personal, non-exclusive, non-transferable
        right to use the Service. Exports you create are yours to use.
      </P>

      <H2 id="avail">6. Availability and changes</H2>
      <P>
        The Service is provided on an ongoing but “as available” basis and may change, be interrupted or be discontinued. Because plans live in your browser, <strong>back up important plans with
        Export</strong>; clearing browser data deletes them and we cannot restore them.
      </P>

      <H2 id="warranty">7. Disclaimer of warranties</H2>
      <P>
        To the fullest extent permitted by law, the Service is provided “as is” and “as available” without warranties of any kind, express or implied, including merchantability, fitness for a
        particular purpose, accuracy and non-infringement. Nothing here excludes warranties or rights that cannot be excluded under applicable consumer law.
      </P>

      <H2 id="liability">8. Limitation of liability</H2>
      <P>
        To the fullest extent permitted by law, we are not liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, lost data, lost bookings, event cancellations,
        vendor disputes, or charges incurred on third-party accounts (including AI provider usage), arising from your use of the Service. Our total liability for any claim relating to the Service is limited to the
        greater of the amount you paid us for it in the previous 12 months (if any) and USD 50. Nothing limits liability that cannot be limited by law (for example for fraud or death/personal injury caused by negligence).
      </P>

      <H2 id="indemnity">9. Your responsibility</H2>
      <P>
        You agree to indemnify us against third-party claims arising from content you submit, your breach of these Terms or applicable law, or your misuse of third-party credentials or services, to the extent permitted by law.
      </P>

      <H2 id="termination">10. Suspension and ending</H2>
      <P>
        You may stop using the Service at any time (and delete your data from your browser). We may suspend or restrict access, including by rate limiting or blocking abusive traffic, if needed to protect the Service or others.
      </P>

      <H2 id="law">11. Governing law and changes</H2>
      <P>
        {LEGAL.governingLaw
          ? `These Terms are governed by the laws of ${LEGAL.governingLaw}, without regard to conflict-of-law rules, and courts there have jurisdiction, except where mandatory consumer law gives you the right to use your local courts.`
          : 'These Terms are governed by the laws applicable to the operator’s place of business, except where mandatory consumer law gives you the right to rely on the law and courts of your country of residence.'}{' '}
        We may update these Terms; continued use after the date above means you accept the update. If any part is unenforceable, the rest remains in effect.
      </P>

      <H2 id="contact">12. Contact</H2>
      <P>
        Questions about these Terms: <Contact />. See also our <A href="/privacy">Privacy Policy</A>.
      </P>
    </>
  );
}

export function LegalView({ doc }: { doc: Doc }) {
  const isPrivacy = doc === 'privacy';
  const title = isPrivacy ? 'Privacy Policy' : 'Terms of Service';
  React.useEffect(() => {
    const prev = document.title;
    document.title = `${title} — PlanGenie`;
    return () => {
      document.title = prev;
    };
  }, [title]);

  return (
    <div className="min-h-screen pg-grain relative text-stone-900">
      <Backdrop variant="workspace" />
      <header className="px-4 sm:px-6 lg:px-10 py-4 flex flex-wrap items-center justify-between gap-3 border-b border-stone-200/80 bg-white/90 backdrop-blur-md">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-700 hover:text-stone-900">
          <ArrowLeft className="w-4 h-4" /> Back to PlanGenie
        </a>
        <nav className="flex gap-4 text-xs font-semibold text-stone-600" aria-label="Legal">
          <a href="/privacy" aria-current={isPrivacy ? 'page' : undefined} className={isPrivacy ? 'text-stone-900 underline' : 'hover:text-stone-900'}>
            Privacy
          </a>
          <a href="/terms" aria-current={!isPrivacy ? 'page' : undefined} className={!isPrivacy ? 'text-stone-900 underline' : 'hover:text-stone-900'}>
            Terms
          </a>
        </nav>
      </header>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <article className="bg-white border border-stone-200/80 rounded-3xl p-7 sm:p-10 shadow-sm">
          <h1 className="text-2xl sm:text-3xl font-bold text-stone-900">{title}</h1>
          <p className="text-xs text-stone-400 mt-1 mb-6">Last updated: {LEGAL.lastUpdated}</p>
          {!LEGAL.isConfigured && (
            <p role="note" className="mb-6 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              Operator details are not configured for this deployment (set VITE_LEGAL_OPERATOR and VITE_LEGAL_EMAIL at build time).
            </p>
          )}
          {isPrivacy ? <Privacy /> : <Terms />}
        </article>
        <p className="text-[11px] text-stone-400 text-center mt-6">
          This document describes how PlanGenie works; it is a general template and not legal advice.
        </p>
      </main>
    </div>
  );
}
