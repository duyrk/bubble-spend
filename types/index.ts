// Core data types for Bubble Spend

export type Period = 'today' | 'yesterday' | 'week' | 'month';

export type BubbleColorKey =
  | 'frost'
  | 'mist'
  | 'dusk'
  | 'slate'
  | 'ash'
  | 'haze'
  | 'veil'
  | 'smoke';

export type Category = {
  id: string;
  name: string;
  emoji: string;
  colorKey: BubbleColorKey;
  positionX: number; // percentage 0-100
  positionY: number; // percentage 0-100
  createdAt: number;
};

export type CategoryWithSize = Category & {
  size: number; // computed bubble diameter in px
  total: number; // total spend for current period
};

export type Transaction = {
  id: string;
  categoryId: string;
  amount: number;
  transactedAt: number; // unix ms — auto set at confirm
  note?: string;
  synced: boolean;
};

export type SyncQueueItem = {
  id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'transaction' | 'category';
  payload: string; // JSON
  createdAt: number;
};
