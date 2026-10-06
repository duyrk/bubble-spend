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
import { autoBackupFileName, selectBackupsToPrune } from '@/lib/autoBackup';

export type ExportResult = { status: 'shared' | 'empty' };

const SAF = FileSystem.StorageAccessFramework;

// Full snapshot of local data as backup JSON, or null when there's nothing to
// save. ownAccounts lives in the persisted settings store, so the caller passes it.
function buildBackupJson(ownAccounts: string[]): string | null {
  const categories = db.getAllCategories();
  const transactions = db.getAllTransactions();
  if (categories.length === 0 && transactions.length === 0) return null;
  return serializeBackup(categories, transactions, Date.now(), {
    recurringTemplates: db.getAllRecurringTemplates(),
    merchantRules: db.getMerchantRules(),
    ownAccounts,
  });
}

// Two-character zero-padded date stamp for the filename, local time.
function backupDateStamp(d = new Date()): string {
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export async function exportData(ownAccounts: string[]): Promise<ExportResult> {
  const json = buildBackupJson(ownAccounts);
  if (json == null) return { status: 'empty' };

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
// The caller restores payload.ownAccounts into the settings store when present.
export function applyBackup(payload: BackupPayload): { categories: number; transactions: number } {
  db.replaceAllData(payload.categories, payload.transactions, {
    recurringTemplates: payload.recurringTemplates,
    merchantRules: payload.merchantRules,
  });
  return { categories: payload.categories.length, transactions: payload.transactions.length };
}

// --- Auto backup (Android, Storage Access Framework) ---

// Ask the user for a folder once; Android persists the grant across restarts.
// Resolves the tree URI, or null if they backed out.
export async function pickAutoBackupFolder(): Promise<string | null> {
  const res = await SAF.requestDirectoryPermissionsAsync();
  return res.granted ? res.directoryUri : null;
}

export type AutoBackupResult = { status: 'written' | 'empty' };

// Write today's backup into the picked folder, then drop auto-backups beyond
// the retention window. Throws if the folder is gone or the grant was revoked —
// the caller records the error so Settings can ask for a new folder.
export async function writeAutoBackup(dirUri: string, ownAccounts: string[]): Promise<AutoBackupResult> {
  const json = buildBackupJson(ownAccounts);
  if (json == null) return { status: 'empty' };

  const existing = await SAF.readDirectoryAsync(dirUri);
  const name = autoBackupFileName(new Date());
  // Same-day re-run ("Back up now") overwrites today's file instead of piling
  // up "name (1).json" copies.
  const today = existing.find((uri) => decodeURIComponent(uri).endsWith(`/${name}.json`));
  const fileUri = today ?? (await SAF.createFileAsync(dirUri, name, 'application/json'));
  await SAF.writeAsStringAsync(fileUri, json);

  for (const uri of selectBackupsToPrune(today ? existing : [...existing, fileUri])) {
    await SAF.deleteAsync(uri, { idempotent: true });
  }
  return { status: 'written' };
}
