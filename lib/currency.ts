// Currency definitions and formatters

export type CurrencyCode = 'VND' | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'KRW' | 'SGD' | 'THB';

export type CurrencyMeta = {
  code: CurrencyCode;
  symbol: string;
  name: string;
  decimals: number;
  symbolBefore: boolean;
};

export const CURRENCIES: Record<CurrencyCode, CurrencyMeta> = {
  VND: { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', decimals: 0, symbolBefore: false },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', decimals: 2, symbolBefore: true },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', decimals: 2, symbolBefore: true },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', decimals: 2, symbolBefore: true },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', decimals: 0, symbolBefore: true },
  KRW: { code: 'KRW', symbol: '₩', name: 'South Korean Won', decimals: 0, symbolBefore: true },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', decimals: 2, symbolBefore: true },
  THB: { code: 'THB', symbol: '฿', name: 'Thai Baht', decimals: 2, symbolBefore: true },
};

export const CURRENCY_LIST: CurrencyMeta[] = Object.values(CURRENCIES);

export function formatCurrency(amount: number, code: CurrencyCode): string {
  const meta = CURRENCIES[code];
  const fixed = amount.toFixed(meta.decimals);
  const [intPart, decPart] = fixed.split('.');
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const numStr = decPart ? `${withSep}.${decPart}` : withSep;
  return meta.symbolBefore ? `${meta.symbol}${numStr}` : `${numStr} ${meta.symbol}`;
}

// Compact form for bubble labels: 1.2M, 24k, 380
export function formatCompact(amount: number, code: CurrencyCode): string | null {
  if (!amount) return null;
  const meta = CURRENCIES[code];
  if (amount >= 1_000_000) {
    const v = (amount / 1_000_000).toFixed(1).replace('.0', '');
    return meta.symbolBefore ? `${meta.symbol}${v}M` : `${v}M`;
  }
  if (amount >= 1_000) {
    const v = Math.round(amount / 1_000).toString();
    return meta.symbolBefore ? `${meta.symbol}${v}k` : `${v}k`;
  }
  return meta.symbolBefore ? `${meta.symbol}${Math.round(amount)}` : `${Math.round(amount)}`;
}
