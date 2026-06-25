// Backup IO — orchestrates the device side of export/import: read the DB,
// write a JSON file, open the share sheet, pick a file back, and atomically
// restore it. Pure (de)serialization + validation lives in lib/backup.ts; this
// module is intentionally the only one that touches the file system so the rest
// of the app (and the unit tests) stay IO-free.

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as db from '@/lib/db';
import { serializeBackup, parseBackup, type BackupPayload } from '@/lib/backup';

export type ExportResult = { status: 'shared' | 'empty' };

// Two-character zero-padded date stamp for the filename, local time.
function backupDateStamp(d = new Date()): string {
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export async function exportData(): Promise<ExportResult> {
  const categories = db.getAllCategories();
  const transactions = db.getAllTransactions();
  if (categories.length === 0 && transactions.length === 0) {
    return { status: 'empty' };
  }

  const json = serializeBackup(categories, transactions);
  const filename = `bubble-spend-backup-${backupDateStamp()}.json`;
  const uri = (FileSystem.cacheDirectory ?? '') + filename;
  await FileSystem.writeAsStringAsync(uri, json);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/json',
      dialogTitle: 'Bubble Spend backup',
      UTI: 'public.json',
    });
  }
  return { status: 'shared' };
}

// Open the document picker and parse the chosen file. Returns null if the user
// cancelled. Throws (with a user-presentable message) if the file isn't a valid
// backup — the caller surfaces it and the database is left untouched.
export async function pickBackup(): Promise<BackupPayload | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets || res.assets.length === 0) return null;

  const content = await FileSystem.readAsStringAsync(res.assets[0].uri);
  return parseBackup(content);
}

// Commit a parsed backup to SQLite, replacing all current data. Kept separate
// from pickBackup so the UI can confirm the destructive replace in between.
export function applyBackup(payload: BackupPayload): { categories: number; transactions: number } {
  db.replaceAllData(payload.categories, payload.transactions);
  return { categories: payload.categories.length, transactions: payload.transactions.length };
}
