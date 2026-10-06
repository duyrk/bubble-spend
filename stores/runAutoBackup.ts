// Daily auto-backup driver — glues the persisted settings (target folder, last
// run) to the file IO in lib/backupIO.ts. Called from the root layout on app
// open / foreground, and from Settings ("Back up now", first folder pick).

import { Platform } from 'react-native';
import { isAutoBackupDue } from '@/lib/autoBackup';
import { writeAutoBackup } from '@/lib/backupIO';
import { useSettingsStore } from './useSettingsStore';

let inFlight = false;

// Resolves true when a backup was written. Never throws — a failure is
// recorded in the settings store for Settings to surface.
export async function runAutoBackup({ force = false } = {}): Promise<boolean> {
  if (Platform.OS !== 'android' || inFlight) return false;
  const { autoBackupDirUri, lastAutoBackupAt, ownAccounts, recordAutoBackup } = useSettingsStore.getState();
  if (!autoBackupDirUri) return false;
  if (!force && !isAutoBackupDue(lastAutoBackupAt, new Date())) return false;

  inFlight = true;
  try {
    const res = await writeAutoBackup(autoBackupDirUri, ownAccounts);
    // An empty database isn't a failure — just nothing to save yet.
    if (res.status === 'written') recordAutoBackup(true);
    return res.status === 'written';
  } catch {
    recordAutoBackup(false);
    return false;
  } finally {
    inFlight = false;
  }
}
