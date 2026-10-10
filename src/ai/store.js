// The top-up store. Players who bring their own AI provider spend that
// provider's credits; this store sells convenience top-ups and adds a 5%
// service fee on top, shown clearly. Real checkout happens on the website
// (Stripe + your backend); the game only presents the packs and opens the
// checkout link you configure in Settings.
import { settings } from '../settings.js';
import { estTokens } from './prompt.js';

export const SERVICE_FEE = 0.05; // 5% on top, our cut
const TOKENS_PER_CALL = 11000; // a ~6-turn call, measured

// base prices are what the tokens cost at the provider; we add the fee.
export const PACKS = [
  { id: 'small', tokens: 1_000_000, base: 1.0 },
  { id: 'medium', tokens: 4_000_000, base: 3.6, best: true },
  { id: 'large', tokens: 12_000_000, base: 9.9 },
];

export function priceOf(pack) {
  const total = pack.base * (1 + SERVICE_FEE);
  return { base: pack.base, fee: pack.base * SERVICE_FEE, total, calls: Math.round(pack.tokens / TOKENS_PER_CALL) };
}

export const fmtUSD = (n) => '$' + n.toFixed(2);

// opens the configured checkout (your site handles payment + crediting).
// Returns false if no store URL is set yet.
export function checkout(pack) {
  const url = (settings.get('store.url') || '').trim();
  if (!url) return false;
  const p = priceOf(pack);
  const sep = url.includes('?') ? '&' : '?';
  const full = `${url}${sep}pack=${encodeURIComponent(pack.id)}&tokens=${pack.tokens}&usd=${p.total.toFixed(2)}`;
  try { window.open(full, '_blank', 'noopener'); return true; } catch { return false; }
}

export { estTokens };
