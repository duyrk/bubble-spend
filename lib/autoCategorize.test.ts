import { merchantKey, suggestCategory, type MerchantRule } from './autoCategorize';

// The Vietnamese default bubbles.
const VI = [
  { id: 'food', name: 'Ăn uống', emoji: '🍜' },
  { id: 'grab', name: 'Grab', emoji: '🛵' },
  { id: 'cafe', name: 'Cà phê', emoji: '☕' },
  { id: 'shop', name: 'Mua sắm', emoji: '🛍️' },
  { id: 'home', name: 'Nhà ở', emoji: '🏠' },
];

const suggest = (description: string, rules: MerchantRule[] = [], cats = VI, text = '') =>
  suggestCategory({ description, text }, cats, rules);

describe('merchantKey', () => {
  it('folds, drops long digit runs and punctuation, keeps 5 words', () => {
    expect(merchantKey('Highlands Coffee - 123 Lê Lợi')).toBe('HIGHLANDS COFFEE LE LOI');
    expect(merchantKey('"NGUYEN VAN A CHUYEN KHOAN-061026 0100000000"')).toBe('NGUYEN VAN A CHUYEN KHOAN');
    expect(merchantKey('')).toBe('');
  });
});

describe('suggestCategory — learned rules', () => {
  it('uses an exact rule', () => {
    expect(suggest('Quán cô Ba', [{ key: 'QUAN CO BA', categoryId: 'food', hits: 2 }])).toEqual({
      categoryId: 'food',
      via: 'rule',
      ruleKey: 'QUAN CO BA',
    });
  });

  it('matches a rule key contained in a longer description, longest wins', () => {
    const rules = [
      { key: 'NGUYEN VAN', categoryId: 'shop', hits: 1 },
      { key: 'NGUYEN VAN A', categoryId: 'food', hits: 1 },
    ];
    expect(suggest('NGUYEN VAN A chuyen tien', rules)?.categoryId).toBe('food');
  });

  it('beats the dictionary', () => {
    expect(suggest('Highlands Coffee', [{ key: 'HIGHLANDS COFFEE', categoryId: 'shop', hits: 1 }])?.categoryId).toBe(
      'shop',
    );
  });

  it('ignores rules pointing at deleted bubbles', () => {
    expect(suggest('Quán cô Ba', [{ key: 'QUAN CO BA', categoryId: 'gone', hits: 5 }])).toBeNull();
  });
});

describe('suggestCategory — dictionary', () => {
  it.each([
    ['Highlands Coffee', 'cafe'],
    ['PHUC LONG COFFEE & TEA', 'cafe'],
    ['GrabFood', 'food'],
    ['Grab', 'grab'],
    ['Xanh SM', 'grab'],
    ['Shopee', 'shop'],
    ['EVN HCMC tien dien thang 10', 'home'],
  ])('%s → %s', (description, expected) => {
    expect(suggest(description)?.categoryId).toBe(expected);
  });

  it('searches the full text, not only the description', () => {
    expect(suggest('', [], VI, 'Thanh toán thành công cho KATINAT')?.categoryId).toBe('cafe');
  });

  it('resolves English default bubbles by emoji / name', () => {
    const EN = [
      { id: 'food', name: 'Food', emoji: '🍔' },
      { id: 'transport', name: 'Transport', emoji: '🚗' },
      { id: 'coffee', name: 'Coffee', emoji: '☕' },
    ];
    expect(suggest('Grab', [], EN)?.categoryId).toBe('transport');
    expect(suggest('Baemin', [], EN)?.categoryId).toBe('food');
  });

  it('does not file GrabFood under Grab when there is no food bubble', () => {
    const noFood = VI.filter((c) => c.id !== 'food');
    expect(suggest('GrabFood', [], noFood)).toBeNull();
  });

  it('matches whole words only', () => {
    expect(suggest('BEVERAGE WHOLESALE')).toBeNull(); // not "BE"
  });

  it('returns null for an unknown person', () => {
    expect(suggest('NGUYEN VAN A')).toBeNull();
  });
});
