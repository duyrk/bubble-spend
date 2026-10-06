# Auto-capture từ thông báo (MoMo + ACB, Android)

Quyết định: khoản chưa biết bubble → **chưa phân loại** (hỏi 1 lần rồi học); tiền vào không phải nội bộ → **tự ghi thu nhập**; chuyển nội bộ → **bỏ qua**.

Scope đã chốt: **Android only**, nguồn **MoMo** (`com.mservice.momotransfer`) và **ACB ONE** (`mobile.acb.com.vn`, cần xác nhận lại bằng debug mode). App dùng cá nhân (APK/EAS internal), nên không cần làm phần disclosure theo Play policy.

## Pipeline

```
MoMo / ACB notification
  → CaptureListenerService (Kotlin, chạy cả khi app bị kill, lọc theo allowlist)
  → CaptureStore (SharedPreferences ring buffer, 300 item)
  → JS drainCaptures() khi cold start + AppState 'active'  (cạnh fireDueRecurringTemplates)
  → parseNotification() (pure)  → suggestCategory() (pure)  → dedup
  → pending_captures (inbox)  → user duyệt / auto-log  → transactions + sync_queue
```

## Phases

| # | Việc | Trạng thái |
|---|---|---|
| 1 | Native module `modules/notification-capture` (listener service, inbox, API JS, rebind khi mở app) | ✅ Xong |
| 1.5 | Settings → Tự động ghi chi tiêu: trạng thái quyền + màn "Thông báo đã bắt" (xem/chia sẻ JSON/xoá, chế độ debug bắt mọi app) | ✅ Xong, **đang chờ gom mẫu thật** |
| 2 | `lib/notificationParser.ts` (ACB theo mẫu thật, MoMo/generic theo heuristic) + `lib/captureClassify.ts` (nội bộ: từ khoá / ghép cặp / TK của tôi; trùng: cùng nguồn / khác nguồn / nhập tay) + test | ✅ Xong — **MoMo cần mẫu thật để chốt** |
| 3 | `lib/autoCategorize.ts` (rule học được + từ điển) + test. Bảng `captures` (nhật ký + chống trùng), `merchant_rules`. `lib/captureIO.ts` (pipeline, assign/dismiss/undo/learnFromEdit), `useCaptureStore`, chạy ở `_layout` (mở app / foreground / live) | ✅ Xong |
| 4 | UX: pill "N chưa phân loại" → `CaptureInboxSheet`; toast "Đã tự ghi N · Hoàn tác"; sửa bubble trong History → học rule; Settings → Tài khoản của tôi; màn debug hiện kết quả từng thông báo | ✅ Xong (chưa có: icon nguồn trong History, quản lý rule) |

## Lưu ý parser (VN)
- Dấu phân cách hàng nghìn có thể là `,` hoặc `.`. Text có thể có dấu hoặc không dấu.
- Phải bỏ qua số dư ("SD", "Số dư").
- Hướng tiền: `-`/"trừ"/"thanh toán" là debit, `+`/"nhận"/"cộng" là credit (credit đi vào thu nhập).
- Giờ giao dịch lấy trong text nếu có, không thì dùng `postedAt`.
- Notification ACB khi chuyển tiền qua MoMo có thể trùng với notification MoMo. Dedup theo số tiền ±2 phút giữa 2 nguồn.

## Chuyển tiền nội bộ (MoMo ↔ ACB) — không tính là chi tiêu
Phát hiện theo thứ tự, trong `lib/captureClassify.ts` (pure + test):
1. **Ghép cặp:** ACB debit X và MoMo credit X (hoặc ngược lại) trong ±5 phút → đánh dấu cả 2 là `internal`, không ghi.
2. **Từ khoá:** nội dung chứa "MOMO", "nạp ví", "rút về ACB", … (chốt theo mẫu thật).
3. **Tài khoản của tôi:** Settings cho nhập số TK/tên chủ TK; người nhận trùng → `internal`.
4. Không chắc → vào inbox, có nút "Chuyển nội bộ", và lần sau học theo người nhận.
Chuyển cho người khác (bạn bè, trả nợ) → inbox hỏi: chi tiêu hay bỏ qua.

## Phân loại bubble — 3 lớp
1. **Rule đã học** (`merchant_rules`): user gán merchant/người nhận → bubble; ưu tiên cao nhất, auto-log khi hit ≥2 lần.
2. **Từ điển mặc định:** Grab/Be/Xanh SM → di chuyển; Highlands/Phúc Long/Katinat/Starbucks → cafe; GrabFood/ShopeeFood/Baemin → ăn uống; Shopee/Lazada/Tiki → mua sắm; EVN/nước/internet → nhà ở. Map theo tên + emoji của bubble.
3. **Không biết** (thường là QR trả cho tài khoản cá nhân, tên kiểu "NGUYEN VAN A") → inbox, user chạm bubble → học rule.

## Test thủ công không cần giao dịch thật
Dev build + bật "Bắt mọi ứng dụng (debug)". Thông báo từ `com.android.shell` được coi là MoMo (hoặc ACB nếu tiêu đề bắt đầu bằng "ACB") — chỉ trong `__DEV__`:
```
adb shell "cmd notification post -S bigtext -t 'ACB' t1 'ACB: TK 12345678(VND) - 50,000 luc 12:30 06/10/2026. So du 1,000,000. GD: GRAB'"
adb shell "cmd notification post -S bigtext -t 'Thanh toán thành công' t2 'Bạn đã thanh toán thành công 35.000đ cho Highlands Coffee'"
```

## Giới hạn đã biết
- ACB chỉ đẩy thông báo hệ thống cho tiền vào và tiền ra **trên ngưỡng** — khoản chi ACB nhỏ không bắt được.
- MoMo: mới có mẫu thật cho "Nhận chuyển khoản"; mẫu thanh toán vẫn theo heuristic.
