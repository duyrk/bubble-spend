// Auto-backup scheduling + retention — pure helpers, unit-tested. The app
// writes one backup file per local day into a user-picked folder (Android
// Storage Access Framework), so the data survives an uninstall or a lost
// phone (if that folder is synced). File IO lives in lib/backupIO.ts.

export const AUTO_BACKUP_PREFIX = 'bubble-spend-auto-';
export const AUTO_BACKUP_KEEP = 14;

const pad = (n: number) => n.toString().padStart(2, '0');
const localDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Base name without extension — SAF appends ".json" from the MIME type.
export function autoBackupFileName(now: Date): string {
  return `${AUTO_BACKUP_PREFIX}${localDay(now)}`;
}

// Due once per local calendar day.
export function isAutoBackupDue(lastAt: number | null, now: Date): boolean {
  return lastAt == null || localDay(new Date(lastAt)) !== localDay(now);
}

// SAF document URIs percent-encode the path: ".../document/primary%3ADownload%2Fx.json".
export function fileNameFromSafUri(uri: string): string {
  const decoded = decodeURIComponent(uri);
  return decoded.slice(decoded.lastIndexOf('/') + 1);
}

// Human label for a picked SAF tree URI: "primary:Download/BubbleSpend" → "Download/BubbleSpend".
export function folderLabelFromSafUri(dirUri: string): string {
  const decoded = decodeURIComponent(dirUri);
  const tree = decoded.includes('/tree/') ? decoded.slice(decoded.indexOf('/tree/') + 6) : decoded;
  const path = tree.includes(':') ? tree.slice(tree.indexOf(':') + 1) : tree;
  return path || tree;
}

const AUTO_NAME = new RegExp(`^${AUTO_BACKUP_PREFIX}(\\d{4}-\\d{2}-\\d{2})`);

// Auto-backup files beyond the newest `keep`, oldest last. Anything not named
// like an auto-backup (manual exports, unrelated files) is never touched.
export function selectBackupsToPrune(uris: string[], keep = AUTO_BACKUP_KEEP): string[] {
  const dated = uris
    .map((uri) => ({ uri, m: fileNameFromSafUri(uri).match(AUTO_NAME) }))
    .filter((f): f is { uri: string; m: RegExpMatchArray } => f.m != null)
    .sort((a, b) => (a.m[1] === b.m[1] ? a.uri.localeCompare(b.uri) : b.m[1].localeCompare(a.m[1])));
  return dated.slice(keep).map((f) => f.uri);
}
