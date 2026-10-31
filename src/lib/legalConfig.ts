/**
 * Who is publishing this instance of PlanGenie. Set these at build time (see .env.example)
 * so the Privacy Policy and Terms name the real operator and a working contact.
 */
const env = import.meta.env;
const clean = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export const LEGAL = {
  operator: clean(env.VITE_LEGAL_OPERATOR) || 'the operator of this PlanGenie website',
  email: clean(env.VITE_LEGAL_EMAIL),
  address: clean(env.VITE_LEGAL_ADDRESS),
  governingLaw: clean(env.VITE_LEGAL_GOVERNING_LAW),
  lastUpdated: '31 October 2026',
  /** True when the operator has filled in real contact details. */
  isConfigured: Boolean(clean(env.VITE_LEGAL_OPERATOR) && clean(env.VITE_LEGAL_EMAIL)),
};
