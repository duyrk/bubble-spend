// Bubble suggestion for captured expenses. Two layers, first hit wins:
//   1. Learned rules — merchant key → category, written whenever the user files
//      a capture by hand (inbox chip, or a category change in History).
//   2. Built-in dictionary — well-known VN merchants/brands mapped to a bubble
//      *kind*, resolved against the user's own bubbles by emoji or name.
// No hit → null, and the capture waits in the "uncategorized" inbox.
// Pure: imports only types (+ the pure fold helper); unit-tested.

import { fold } from './notificationParser';
import type { Category } from '@/types';

export type MerchantRule = {
  key: string; // merchantKey() of a description
  categoryId: string;
  hits: number;
};

export type CategorySuggestion = {
  categoryId: string;
  via: 'rule' | 'dictionary';
  ruleKey?: string; // set when via === 'rule' — so the caller can bump its hits
};

type CategoryLike = Pick<Category, 'id' | 'name' | 'emoji'>;

// Normalizes a description into a stable lookup key: folded, quotes and long
// digit runs (account / phone / reference numbers) dropped, punctuation → space,
// first 5 words. "Highlands Coffee - 123 Lê Lợi" → "HIGHLANDS COFFEE LE LOI".
export function merchantKey(description: string): string {
  return fold(description)
    .replace(/["'“”]/g, ' ')
    .replace(/\d{3,}/g, ' ')
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .join(' ');
}

// Rule lookup: exact key first, else the longest rule key contained in the
// description (so a rule learned from "HIGHLANDS COFFEE" also catches
// "HIGHLANDS COFFEE NGUYEN HUE"). Rules for deleted bubbles are skipped.
function matchRule(key: string, rules: MerchantRule[], validIds: Set<string>): MerchantRule | null {
  if (!key) return null;
  const live = rules.filter((r) => validIds.has(r.categoryId) && r.key.length >= 4);
  const exact = live.find((r) => r.key === key);
  if (exact) return exact;
  let best: MerchantRule | null = null;
  for (const r of live) {
    if (` ${key} `.includes(` ${r.key} `) && (!best || r.key.length > best.key.length)) best = r;
  }
  return best;
}

type DictionaryGroup = {
  // Folded, matched on word boundaries. Order matters across groups: food
  // delivery is listed before ride-hailing so "GRABFOOD" isn't filed as Grab.
  keywords: string[];
  emojis: string[];
  names: string[]; // folded name fragments, matched on word boundaries
};

const DICTIONARY: DictionaryGroup[] = [
  {
    keywords: [
      'GRABFOOD', 'GRAB FOOD', 'SHOPEEFOOD', 'SHOPEE FOOD', 'BAEMIN', 'BEFOOD', 'BE FOOD',
      'KFC', 'LOTTERIA', 'JOLLIBEE', 'MCDONALD', 'MCDONALDS', 'PIZZA', 'NHA HANG', 'QUAN AN',
      'BANH MI', 'COM TAM',
    ],
    emojis: ['🍜', '🍔', '🍕', '🍱', '🍲', '🥢', '🍚', '🍽️'],
    names: ['AN UONG', 'DO AN', 'AN', 'FOOD', 'EAT', 'EATING', 'MEAL'],
  },
  {
    keywords: [
      'HIGHLANDS', 'PHUC LONG', 'KATINAT', 'STARBUCKS', 'TRUNG NGUYEN', 'CONG CAPHE', 'CONG CA PHE',
      'THE COFFEE HOUSE', 'COFFEE', 'CAFE', 'CA PHE', 'CAPHE', 'TRA SUA', 'GONG CHA', 'PHE LA',
      'TOCOTOCO', 'MIXUE',
    ],
    emojis: ['☕', '🧋', '🍵'],
    names: ['CA PHE', 'CAFE', 'COFFEE', 'TRA SUA', 'DRINK'],
  },
  {
    keywords: [
      'GRAB', 'BE GROUP', 'XANH SM', 'GOJEK', 'VIETJET', 'VIETNAM AIRLINES', 'BAMBOO AIRWAYS',
      'PETROLIMEX', 'XANG', 'VETC', 'EPASS', 'GUI XE', 'PARKING', 'VEXERE',
    ],
    emojis: ['🛵', '🚗', '🚕', '✈️', '🚌', '⛽', '🏍️'],
    names: ['GRAB', 'DI CHUYEN', 'DI LAI', 'XANG', 'XE', 'TRANSPORT', 'TAXI'],
  },
  {
    keywords: [
      'SHOPEE', 'LAZADA', 'TIKI', 'TIKTOK SHOP', 'UNIQLO', 'BACH HOA XANH', 'WINMART', 'COOPMART',
      'CO OP', 'CIRCLE K', 'FAMILYMART', 'GS25', 'MINISTOP', 'AEON', 'LOTTE MART', 'GUARDIAN',
      'HASAKI', 'THE GIOI DI DONG', 'DIEN MAY XANH',
    ],
    emojis: ['🛍️', '🛒'],
    names: ['MUA SAM', 'SHOPPING', 'SIEU THI', 'SHOP'],
  },
  {
    keywords: [
      'EVN', 'TIEN DIEN', 'DIEN LUC', 'TIEN NUOC', 'CAP NUOC', 'VNPT', 'FPT TELECOM', 'INTERNET',
      'TIEN NHA', 'CHUNG CU', 'PHI QUAN LY',
    ],
    emojis: ['🏠', '💡'],
    names: ['NHA O', 'NHA', 'HOUSING', 'HOA DON', 'BILLS', 'RENT'],
  },
];

const hasWord = (haystack: string, needle: string) =>
  new RegExp(`(^|[^A-Z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Z0-9])`).test(haystack);

function resolveGroup(group: DictionaryGroup, categories: CategoryLike[]): string | null {
  const byEmoji = categories.find((c) => group.emojis.includes(c.emoji));
  if (byEmoji) return byEmoji.id;
  const byName = categories.find((c) => group.names.some((n) => hasWord(fold(c.name), n)));
  return byName?.id ?? null;
}

export function suggestCategory(
  capture: { description: string; text: string },
  categories: CategoryLike[],
  rules: MerchantRule[],
): CategorySuggestion | null {
  const validIds = new Set(categories.map((c) => c.id));

  const rule = matchRule(merchantKey(capture.description), rules, validIds);
  if (rule) return { categoryId: rule.categoryId, via: 'rule', ruleKey: rule.key };

  const folded = fold(`${capture.description}\n${capture.text}`);
  for (const group of DICTIONARY) {
    if (!group.keywords.some((k) => hasWord(folded, k))) continue;
    const id = resolveGroup(group, categories);
    // A brand matched but the user has no bubble of that kind — don't fall
    // through to a later group (GrabFood must not land in the Grab bubble).
    return id ? { categoryId: id, via: 'dictionary' } : null;
  }
  return null;
}
