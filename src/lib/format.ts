/** Currencies offered in the header. Rates are indicative, not live. */
export const CURRENCIES = {
  USD: { symbol: '$', rate: 1, label: 'USD' },
  INR: { symbol: '₹', rate: 88, label: 'INR' },
  EUR: { symbol: '€', rate: 0.92, label: 'EUR' },
  GBP: { symbol: '£', rate: 0.79, label: 'GBP' },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

/** Compact money, e.g. $1.24M, ₹8.4 Cr-ish magnitudes stay readable. */
export function money(usd: number, code: CurrencyCode = 'USD'): string {
  const { symbol, rate } = CURRENCIES[code];
  const v = usd * rate;
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}${symbol}${(abs / 1_000_000_000).toFixed(2)}bn`;
  if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000) return `${sign}${symbol}${Math.round(abs / 1000)}k`;
  if (abs >= 1000) return `${sign}${symbol}${(abs / 1000).toFixed(1)}k`;
  return `${sign}${symbol}${Math.round(abs).toLocaleString('en-GB')}`;
}

/** Signed money for deltas. */
export function moneyDelta(usd: number, code: CurrencyCode = 'USD'): string {
  if (Math.abs(usd * CURRENCIES[code].rate) < 1) return 'no change';
  return `${usd > 0 ? '+' : '−'}${money(Math.abs(usd), code)}`;
}

/** Carbon in the unit that keeps the number readable. */
export function carbon(kg: number): string {
  const abs = Math.abs(kg);
  const sign = kg < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)} kt`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(abs / 1000 >= 100 ? 0 : 1)} t`;
  return `${sign}${Math.round(abs).toLocaleString('en-GB')} kg`;
}

export function carbonDelta(kg: number): string {
  if (Math.abs(kg) < 1) return 'no change';
  return `${kg > 0 ? '+' : '−'}${carbon(Math.abs(kg))}`;
}

export function mass(kg: number): string {
  const abs = Math.abs(kg);
  if (abs >= 1000) return `${(abs / 1000).toFixed(abs / 1000 >= 100 ? 0 : 1)} t`;
  return `${Math.round(abs).toLocaleString('en-GB')} kg`;
}

export function volume(m3: number): string {
  if (m3 >= 1000) return `${Math.round(m3).toLocaleString('en-GB')} m³`;
  if (m3 >= 10) return `${m3.toFixed(1)} m³`;
  if (m3 >= 1) return `${m3.toFixed(2)} m³`;
  return `${m3.toFixed(3)} m³`;
}

export function percent(value: number, digits = 0): string {
  return `${value >= 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}%`;
}

export function share(fraction: number): string {
  const pct = fraction * 100;
  if (pct < 0.1) return '<0.1%';
  return `${pct.toFixed(pct < 10 ? 1 : 0)}%`;
}

/** Tidy up a material name read off a glTF file, which is often machine noise. */
export function cleanVisualName(name: string): string {
  const trimmed = name
    .replace(/^(Original|Material)[\s._-]*/i, '')
    .replace(/[_.]+/g, ' ')
    .trim();
  if (!trimmed) return 'Unnamed material';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}
