import { formatCurrency, formatCompact } from './currency';

describe('formatCurrency', () => {
  it('places the symbol after with no decimals for VND', () => {
    expect(formatCurrency(1234567, 'VND')).toBe('1,234,567 ₫');
  });

  it('places the symbol before with two decimals for USD', () => {
    expect(formatCurrency(1234.5, 'USD')).toBe('$1,234.50');
  });

  it('groups thousands and rounds to the currency decimals', () => {
    expect(formatCurrency(1000, 'JPY')).toBe('¥1,000');
    expect(formatCurrency(0, 'USD')).toBe('$0.00');
    expect(formatCurrency(99.999, 'EUR')).toBe('€100.00');
  });
});

describe('formatCompact', () => {
  it('returns null for zero so the bubble shows a hint instead', () => {
    expect(formatCompact(0, 'VND')).toBeNull();
  });

  it('compacts millions and thousands', () => {
    expect(formatCompact(1_200_000, 'VND')).toBe('1.2M');
    expect(formatCompact(1_000_000, 'VND')).toBe('1M');
    expect(formatCompact(24_000, 'VND')).toBe('24k');
  });

  it('keeps small amounts whole and prefixes symbol-before currencies', () => {
    expect(formatCompact(380, 'VND')).toBe('380');
    expect(formatCompact(380, 'USD')).toBe('$380');
    expect(formatCompact(2_400_000, 'USD')).toBe('$2.4M');
  });
});
