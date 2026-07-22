# FE Agent Prompt — WorkShift bổ sung 6 fields (window custom + require flags)

## Context

BE vừa thêm 6 fields mới vào `WorkShift` để hỗ trợ:
1. **Cấu hình cửa sổ check-in/out riêng cho từng ca** (TH2), thay vì luôn dùng default ±60p (TH1).
2. **Ca chỉ check-in / chỉ check-out** thông qua `requireCheckIn` / `requireCheckOut`.

Đồng thời **default check-out window sau đã đổi từ 120p → 60p** để đối xứng với check-in.

Bridge docs đầy đủ:
- [`docs/bridges/attendance-shifts.md`](./attendance-shifts.md) — 6 fields, TH1/TH2, require flags, JSON examples.
- [`docs/bridges/attendance.md`](./attendance.md) — `TodayShiftDto` bổ sung + fail reasons mới.
- [`docs/bridges/attendance-overview.md`](./attendance-overview.md) — bảng fail reason đầy đủ.
- [`docs/bridges/violation-requests.md`](./violation-requests.md) — `slotCost=0` khi `requireCheckOut=false`.

---

## Thay đổi API

### 1. `WorkShiftResponse` (GET/POST/PATCH `/v1/work-shifts`)

Thêm 6 field mới:

```typescript
export interface WorkShiftResponse {
  // ... các field cũ
  checkInWindowStart: number | null;    // phút TRƯỚC giờ vào ca — null = default 60p
  checkInWindowEnd: number | null;      // phút SAU giờ vào ca (chưa cộng approvedLate) — null = default 60p
  checkOutWindowStart: number | null;   // phút TRƯỚC giờ tan ca (chưa trừ approvedEarly) — null = default 60p
  checkOutWindowEnd: number | null;     // phút SAU giờ tan ca — null = default 60p
  requireCheckIn: boolean;              // default true. false = ca chỉ check-out
  requireCheckOut: boolean;             // default true. false = ca chỉ check-in
}
```

### 2. `CreateWorkShiftDto` / `UpdateWorkShiftDto`

```typescript
export interface CreateWorkShiftDto {
  // ... các field cũ
  checkInWindowStart?: number;    // 0–240 phút — omit = TH1 default 60p
  checkInWindowEnd?: number;      // 0–240 phút
  checkOutWindowStart?: number;   // 0–240 phút
  checkOutWindowEnd?: number;     // 0–240 phút
  requireCheckIn?: boolean;       // default true
  requireCheckOut?: boolean;      // default true
}
```

Trên PATCH, gửi `null` để clear (chuyển từ TH2 → TH1) cho từng field window.

### 3. `TodayShiftDto` (GET `/v1/attendance/today-info`)

Object `shift` lồng trong response cũng có thêm 2 field:

```typescript
export interface TodayShiftDto {
  // ... các field cũ (id, name, checkInTime, checkOutTime, isOnline, requiresLocationCheck)
  requireCheckIn: boolean;   // MỚI
  requireCheckOut: boolean;  // MỚI
}
```

FE **bắt buộc** đọc 2 field này trên màn chấm công để ẩn/hiện nút.

### 4. Fail reasons mới

Bổ sung 2 fail reason khi check-in/check-out bị chặn do ca không yêu cầu:

| `failReason` | HTTP | Message |
|--------------|------|---------|
| `CHECK_IN_NOT_REQUIRED` | 400 | `"Ca làm việc hôm nay không yêu cầu check-in"` |
| `CHECK_OUT_NOT_REQUIRED` | 400 | `"Ca làm việc hôm nay không yêu cầu check-out"` |

### 5. `CHECK_OUT_WINDOW_AFTER_MIN`: 120p → **60p**

Default window sau giờ tan ca (khi ca không cài `checkOutWindowEnd`) đã giảm từ 120p xuống 60p cho đối xứng với check-in.

**Impact:** Ca 08:30–18:00 (không cài window) → check-out window `[17:00, 19:00]` thay vì `[17:00, 20:00]` như trước.

---

## FE việc phải làm

### A. Trang cấu hình ca `settings/shifts.vue` (HR/ADMIN)

#### A.1 Section "Cửa sổ chấm công"

Thêm section riêng dưới `lateThresholdMin` / `earlyThresholdMin`:

```
┌─ Cửa sổ chấm công ────────────────────────────────────────┐
│ ○ Dùng mặc định (±60 phút quanh giờ ca)                   │
│ ● Tùy chỉnh cho ca này                                     │
│                                                             │
│   Check-in: từ [30] phút TRƯỚC đến [90] phút SAU giờ vào  │
│   Check-out: từ [60] phút TRƯỚC đến [60] phút SAU giờ ra  │
│                                                             │
│   💡 Preview: Cho phép check-in 08:00–10:00                │
│              Cho phép check-out 17:00–19:00                │
└─────────────────────────────────────────────────────────────┘
```

Logic:
- Toggle "Dùng mặc định" ON → gửi 4 field = `undefined` (POST) hoặc `null` (PATCH). Ẩn 4 input.
- Toggle OFF → hiện 4 input `<input type="number" min="0" max="240" placeholder="60">`.
- Nếu có field nào bị bỏ trống, gửi `null` cho field đó (mixed TH1/TH2 hợp lệ).
- Realtime preview: `windowStart = checkInTime - checkInWindowStart` (dùng `formatHHMM`).

Validation FE:
- 0 ≤ value ≤ 240 (nếu vượt → hiển thị lỗi inline, BE cũng reject 400).
- Chỉ chấp nhận số nguyên.

#### A.2 Section "Yêu cầu chấm công"

```
┌─ Yêu cầu chấm công ───────────────────────────────────────┐
│ ☑ Yêu cầu check-in                                         │
│ ☑ Yêu cầu check-out                                        │
│                                                             │
│ ⚠️ Nếu bỏ chọn cả hai, nhân viên sẽ không thể chấm công    │
│    thủ công. Cân nhắc dùng ca online thay vì cấu hình này. │
└─────────────────────────────────────────────────────────────┘
```

Logic:
- 2 checkbox độc lập, default cả 2 checked.
- Khi cả 2 unchecked → hiện banner warning màu vàng.
- Không block submit khi warning — chỉ nhắc nhở.

#### A.3 Column trong bảng danh sách ca

Thêm cột (tùy chọn — có thể hidden by default, show qua "Tùy chỉnh cột"):
- "Cửa sổ" — hiển thị `Mặc định` hoặc `Tùy chỉnh (CI: -30/+90, CO: mặc định)`
- "Chấm công" — hiển thị icon:
  - `✓ Vào ✓ Ra` (bình thường)
  - `✓ Vào ⊘ Ra` (chỉ check-in)
  - `⊘ Vào ✓ Ra` (chỉ check-out)

### B. Màn chấm công (Web + Mobile)

#### B.1 Đọc `TodayShiftDto.requireCheckIn` / `requireCheckOut`

```typescript
const info = await fetchTodayInfo();
const shift = info.shift;

if (!shift) return;

const canShowCheckInButton  = shift.requireCheckIn && !info.todayRecord?.checkInAt;
const canShowCheckOutButton = shift.requireCheckOut && info.todayRecord?.checkInAt && !info.todayRecord?.checkOutAt;
```

Ẩn nút hoàn toàn (không disable) khi ca không yêu cầu — tránh gây confuse.

Thay thế bằng info banner:
- `requireCheckIn=false` + chưa có record → hiện "Ca hôm nay không yêu cầu chấm công vào"
- `requireCheckOut=false` + đã check-in → hiện "Ca hôm nay không yêu cầu chấm công ra — đã hoàn tất"

#### B.2 Handle fail reasons mới

Nếu user vẫn cố gọi API (VD từ deep link, bookmark cũ), toast lỗi:

```typescript
const failReasonMessages = {
  CHECK_IN_NOT_REQUIRED:  'Ca làm việc hôm nay không yêu cầu check-in',
  CHECK_OUT_NOT_REQUIRED: 'Ca làm việc hôm nay không yêu cầu check-out',
  // ... các fail reason khác giữ nguyên
};
```

### C. Màn lịch sử chấm công / form violation

Không cần đổi gì trong lịch sử. Nhưng khi user tạo phiếu `FORGOT_CHECKIN` cho ngày hôm nay:
- API `POST /v1/violation-requests` có thể trả `slotCost: 0` (khi ca `requireCheckOut=false`).
- FE nên hiển thị `slotCost` trong confirmation trước khi submit: "Phiếu này sẽ dùng X lượt trong quota tháng."
- Nếu `slotCost = 0` → hiện "Phiếu này KHÔNG tính vào quota."

### D. Composable `useShiftSchedules` cập nhật type

```typescript
// types/shift.types.ts — thêm 6 field vào WorkShiftResponse và CreateWorkShiftDto
// Xem docs/bridges/attendance-shifts.md để copy chính xác
```

Chạy `pnpm typecheck` sau khi update.

---

## Test manual sau khi FE làm xong

- [ ] Tạo ca 08:30–18:00 với `checkInWindowStart=30, checkInWindowEnd=90` → xem trên list ca có badge "Tùy chỉnh"
- [ ] PATCH ca → gửi cả 4 window field = `null` → API 200, list ca hiện "Mặc định"
- [ ] Tạo ca với `requireCheckIn=false` → gán cho 1 nhân viên → nhân viên mở app: nút check-in bị ẩn, hiện info banner
- [ ] Tạo ca với `requireCheckOut=false` → nhân viên check-in → nhân viên tạo `FORGOT_CHECKIN` cho hôm nay → `slotCost: 0`, quota tháng không đổi
- [ ] Ca 08:30–18:00 không cài window → check-out sau 19:01 → 400 `"Đã quá giờ check-out..."` (trước đây được đến 20:00)
- [ ] Ca với `checkOutWindowEnd=15` → check-out sau `18:15` → 400 (dùng custom window)

---

## Ghi chú migration behavior

Khi migration chạy trên staging/prod:
- Tất cả ca đang có sẽ có `requireCheckIn=true, requireCheckOut=true` (default), 4 field window = `null`.
- Không cần data migration.
- **Behavior change duy nhất:** nhân viên nào đang check-out muộn hơn 60p sau giờ tan ca (nhưng dưới 120p) sẽ bị chặn từ khi deploy. Nên announce trước.
