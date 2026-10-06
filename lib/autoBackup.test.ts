import {
  autoBackupFileName,
  fileNameFromSafUri,
  folderLabelFromSafUri,
  isAutoBackupDue,
  selectBackupsToPrune,
} from './autoBackup';

const DIR = 'content://com.android.externalstorage.documents/tree/primary%3ADownload%2FBubbleSpend';
const file = (name: string) => `${DIR}/document/primary%3ADownload%2FBubbleSpend%2F${encodeURIComponent(name)}`;

describe('autoBackupFileName', () => {
  it('stamps the local day', () => {
    expect(autoBackupFileName(new Date(2026, 0, 5, 23, 59))).toBe('bubble-spend-auto-2026-01-05');
  });
});

describe('isAutoBackupDue', () => {
  const now = new Date(2026, 9, 6, 9, 0);
  it('is due when never run', () => {
    expect(isAutoBackupDue(null, now)).toBe(true);
  });
  it('is not due again the same local day', () => {
    expect(isAutoBackupDue(new Date(2026, 9, 6, 0, 1).getTime(), now)).toBe(false);
  });
  it('is due on a new day', () => {
    expect(isAutoBackupDue(new Date(2026, 9, 5, 23, 59).getTime(), now)).toBe(true);
  });
});

describe('SAF uri helpers', () => {
  it('extracts the file name', () => {
    expect(fileNameFromSafUri(file('bubble-spend-auto-2026-10-06.json'))).toBe('bubble-spend-auto-2026-10-06.json');
  });
  it('labels the picked folder', () => {
    expect(folderLabelFromSafUri(DIR)).toBe('Download/BubbleSpend');
  });
});

describe('selectBackupsToPrune', () => {
  it('keeps the newest N auto-backups and ignores other files', () => {
    const uris = [
      file('bubble-spend-auto-2026-10-01.json'),
      file('bubble-spend-auto-2026-10-04.json'),
      file('notes.txt'),
      file('bubble-spend-backup-2026-09-01-1200.json'), // manual export
      file('bubble-spend-auto-2026-10-03.json'),
      file('bubble-spend-auto-2026-10-02.json'),
    ];
    expect(selectBackupsToPrune(uris, 2)).toEqual([
      file('bubble-spend-auto-2026-10-02.json'),
      file('bubble-spend-auto-2026-10-01.json'),
    ]);
  });

  it('prunes nothing when under the limit', () => {
    expect(selectBackupsToPrune([file('bubble-spend-auto-2026-10-01.json')], 14)).toEqual([]);
  });
});
