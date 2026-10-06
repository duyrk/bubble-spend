import { fold, parseAmount, parseNotification } from './notificationParser';
import type { RawCapture } from '@/types';

const ACB = 'mobile.acb.com.vn';
const MOMO = 'com.mservice.momotransfer';

// Fixed post time: 2026-10-06 19:00:30 local.
const POSTED = new Date(2026, 9, 6, 19, 0, 30).getTime();

function raw(packageName: string, title: string, text: string, postedAt = POSTED): RawCapture {
  return { id: `${packageName}|${text.length}`, packageName, title, text, bigText: text, postedAt };
}

describe('fold', () => {
  it('strips Vietnamese diacritics and uppercases', () => {
    expect(fold('Số dư ví: 500.000đ')).toBe('SO DU VI: 500.000D');
  });

  it('preserves length so indices map back to the original', () => {
    const s = 'Thanh toán thành công cho Phúc Long 🍵';
    expect(fold(s)).toHaveLength(s.length);
  });
});

describe('parseAmount', () => {
  it.each([
    ['10,000', 10000],
    ['10.000', 10000],
    ['1.234.567', 1234567],
    ['1,000,000.00', 1000000],
    ['35000', 35000],
  ])('%s → %d', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });

  it('rejects zero and garbage', () => {
    expect(parseAmount('0')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
});

describe('parseNotification — ACB', () => {
  // Real format captured on device (account / phone numbers replaced).
  const CASHOUT =
    'ACB: TK 12345678(VND) + 10,000 luc 19:00 06/10/2026. So du 852,941. GD: CONG TY CO PHAN DICH VU DI DONG TRUC TUYEN CK, RUT TIEN TU VI MOMO 0900000000 CASHOUT';

  it('parses a credit with balance, time and GD description', () => {
    const p = parseNotification(raw(ACB, 'Thong bao thay doi so du tai khoan', CASHOUT));
    expect(p).toMatchObject({
      source: 'acb',
      amount: 10000,
      direction: 'credit',
      balance: 852941,
      confidence: 'high',
      occurredAt: new Date(2026, 9, 6, 19, 0).getTime(),
    });
    expect(p?.description).toMatch(/^CONG TY CO PHAN .* CASHOUT$/);
  });

  it('parses a debit', () => {
    const p = parseNotification(
      raw(
        ACB,
        'Thong bao thay doi so du tai khoan',
        'ACB: TK 12345678(VND) - 1,250,000 luc 18:45 06/10/2026. So du 200,000. GD: NGUYEN VAN A chuyen tien an trua',
      ),
    );
    expect(p).toMatchObject({ amount: 1250000, direction: 'debit', balance: 200000 });
    expect(p?.description).toBe('NGUYEN VAN A chuyen tien an trua');
  });

  it('ignores non-VND accounts', () => {
    const p = parseNotification(
      raw(ACB, 'Thong bao', 'ACB: TK 12345678(USD) - 10.00 luc 18:45 06/10/2026. So du 200.00. GD: FEE'),
    );
    expect(p).toBeNull();
  });

  it('falls back to the post time when the stated time is implausible', () => {
    const p = parseNotification(
      raw(ACB, 'Thong bao', 'ACB: TK 12345678(VND) - 50,000 luc 10:00 01/01/2020. So du 1,000. GD: X'),
    );
    expect(p?.occurredAt).toBe(POSTED);
  });
});

describe('parseNotification — generic / MoMo', () => {
  // Real formats captured on device (names / numbers replaced).
  it('parses a real MoMo incoming transfer (NBSP before ₫, sender in title)', () => {
    const p = parseNotification(
      raw(
        MOMO,
        'Nhận chuyển khoản từ NGUYEN VAN A',
        'Số tiền 10.000\u00a0₫ về Túi Thần Tài. Lời nhắn: "NGUYEN VAN A CHUYEN KHOAN-061026-19:34:44 0100000000".',
      ),
    );
    expect(p).toMatchObject({ amount: 10000, direction: 'credit', description: 'NGUYEN VAN A' });
  });

  it('ignores the real MoMo lì xì promo', () => {
    const p = parseNotification(
      raw(
        MOMO,
        '🧧 Bạn có lì xì từ MoMo',
        'Khi nạp 10K vào Túi Thần Tài. 555Đ trao tay, giữ chuỗi may mắn 5 ngày mỗi tuần!',
      ),
    );
    expect(p).toBeNull();
  });

  it('parses a payment with merchant after "cho"', () => {
    const p = parseNotification(
      raw(MOMO, 'Thanh toán thành công', 'Bạn đã thanh toán thành công 35.000đ cho Highlands Coffee. Số dư ví: 120.000đ'),
    );
    expect(p).toMatchObject({
      source: 'momo',
      amount: 35000,
      direction: 'debit',
      description: 'Highlands Coffee',
      confidence: 'low',
      occurredAt: POSTED,
    });
  });

  it('parses money received with sender after "từ"', () => {
    const p = parseNotification(
      raw(MOMO, 'Nhận tiền thành công', 'Bạn vừa nhận được 200.000đ từ NGUYEN VAN B'),
    );
    expect(p).toMatchObject({ amount: 200000, direction: 'credit', description: 'NGUYEN VAN B' });
  });

  it('skips the balance and takes the transaction amount', () => {
    const p = parseNotification(
      raw(MOMO, 'MoMo', 'Số dư ví: 500.000đ. Bạn đã chuyển tiền 50.000đ đến TRAN C'),
    );
    expect(p).toMatchObject({ amount: 50000, direction: 'debit', description: 'TRAN C' });
  });

  it('treats a wallet top-up as credit but a phone top-up as debit', () => {
    expect(
      parseNotification(raw(MOMO, 'MoMo', 'Nạp tiền vào ví thành công 500.000đ từ ACB'))?.direction,
    ).toBe('credit');
    expect(
      parseNotification(raw(MOMO, 'MoMo', 'Nạp tiền điện thoại 100.000đ thành công'))?.direction,
    ).toBe('debit');
  });

  it('honours an explicit sign over keywords', () => {
    const p = parseNotification(raw(MOMO, 'Biến động số dư', 'Ví MoMo +75.000đ lúc 18:30 06/10/2026'));
    expect(p).toMatchObject({
      amount: 75000,
      direction: 'credit',
      occurredAt: new Date(2026, 9, 6, 18, 30).getTime(),
    });
  });

  it.each([
    ['OTP', 'Mã OTP của bạn là 123456, giao dịch 50.000đ'],
    ['promo', 'Ưu đãi giảm 50.000đ cho đơn thanh toán từ 100.000đ'],
    ['no transaction hint', 'Chào buổi sáng! Hôm nay trời đẹp 25.000đ'],
    ['unknown direction', 'Giao dịch 50.000đ'],
    ['no currency or sign', 'Thanh toán thành công đơn hàng 123456'],
  ])('returns null for %s', (_label, text) => {
    expect(parseNotification(raw(MOMO, 'MoMo', text))).toBeNull();
  });
});
