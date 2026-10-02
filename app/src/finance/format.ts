// Number formatting per docs/FINANCE_STYLE_GUIDE.md §4. One formatter per kind, so every scene writes
// `$745K`, `−$500`, `8.0% / yr` the same way. Negative values use the true minus sign U+2212.

const MINUS = '−';
const sep = (n: number) => Math.round(n).toLocaleString('en-US');

export interface UsdOpts {
  /** 3 significant figures + K/M/B/T ("$745K", "$1.23M"); trailing zeros dropped ("$1.2M"). */
  compact?: boolean;
  /** Always show a sign ("+$31,473", "−$500") — for changes. */
  sign?: boolean;
  /** Cents: true, false, or 'auto' (only under $100 and when not whole). Default 'auto'. */
  cents?: boolean | 'auto';
}

/** US dollars. */
export function usd(v: number, o: UsdOpts = {}): string {
  const neg = v < 0;
  const a = Math.abs(v);
  let body: string;
  if (o.compact && a >= 1000) {
    const units: [number, string][] = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];
    let [div, suf] = units.find(([d]) => a >= d)!;
    let x = Number((a / div).toPrecision(3));
    // 999.6K rounds to 1000K: step up a unit
    const up = units[units.findIndex(([d]) => d === div) - 1];
    if (x >= 1000 && up) { [div, suf] = up; x = Number((a / div).toPrecision(3)); }
    body = `${String(x)}${suf}`;
  } else {
    const cents = o.cents === true || ((o.cents ?? 'auto') === 'auto' && a < 100 && Math.round(a * 100) % 100 !== 0);
    body = cents ? a.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : sep(a);
  }
  const isZero = body.replace(/[^1-9]/g, '') === '';
  const s = neg && !isZero ? MINUS : o.sign && !isZero ? '+' : '';
  return `${s}$${body}`;
}

/** A rate or share given as a fraction: pct(0.08) → "8.0%". */
export function pct(fraction: number, o: { decimals?: number; sign?: boolean } = {}): string {
  const x = fraction * 100, d = o.decimals ?? 1;
  const body = Math.abs(x).toFixed(d);
  const isZero = Number(body) === 0;
  const s = x < 0 && !isZero ? MINUS : o.sign && !isZero ? '+' : '';
  return `${s}${body}%`;
}

/** Percentage points between two rates: pts(0.015, {sign:true}) → "+1.5 pts". */
export function pts(fraction: number, o: { decimals?: number; sign?: boolean } = {}): string {
  return `${pct(fraction, o).replace('%', '')} pts`;
}

/** Plain number with thousands separators (true minus): num(-1500) → "−1,500". */
export function num(v: number, decimals = 0): string {
  const body = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${v < 0 && Number(body.replace(/,/g, '')) !== 0 ? MINUS : ''}${body}`;
}

/** Multiplier: mult(2.4) → "2.4×". */
export const mult = (x: number, decimals = 1) => `${x.toFixed(decimals)}×`;

/** Year range with an en dash: years(1990, 2025) → "1990–2025". */
export const years = (a: number, b: number) => `${a}–${b}`;

/**
 * Lay the current count out in the final string's shape: [prefix, dim zeros, live digits + suffix].
 *   padToFinal('$2,823', '$149,036') → ['$', '00', '2,823']
 * Needs tabular figures (equal digit widths). No padding when the shapes can't line up (a compact unit
 * changing, a sign appearing): then it's ['', '', cur].
 */
export function padToFinal(cur: string, final: string): [string, string, string] {
  const split = (x: string) => { const m = /^(\D*?)([\d,.]*)(\D*)$/.exec(x); return m ? [m[1]!, m[2]!, m[3]!] : null; };
  const c = split(cur), f = split(final);
  if (!c || !f || c[0] !== f[0] || c[2] !== f[2] || c[1].length >= f[1].length) return ['', '', cur];
  const pad = f[1].slice(0, f[1].length - c[1].length).replace(/\d/g, '0');
  return [c[0], pad, c[1] + c[2]];
}
