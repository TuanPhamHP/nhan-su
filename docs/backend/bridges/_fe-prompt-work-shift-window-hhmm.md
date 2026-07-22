# FE Agent Prompt — WorkShift đổi 4 field window sang HH:mm (thay vì phút)

## Context

Trước đây `WorkShift` nhận 4 field cửa sổ check-in/out dưới dạng **số phút offset** so với `checkInTime` / `checkOutTime`:

```json
{ "checkInWindowStart": 30, "checkInWindowEnd": 90 }
// ↔ mở check-in từ (checkInTime − 30p) đến (checkInTime + 90p)
```

Người dùng phải nhẩm "30 phút trước 08:30 là mấy giờ" → dễ sai, khó review.

**Đã fix:** BE đổi 4 field sang **giờ tuyệt đối HH:mm** đối xứng với `checkInTime` / `checkOutTime`. Server tự quy đổi sang offset để lưu và dùng cho check-in validation. Response cũng trả về HH:mm.

Bridge doc đầy đủ: [`docs/bridges/attendance-shifts.md`](./attendance-shifts.md) — section "Cấu hình window check-in/out".

---

## Thay đổi API

### 1. `WorkShiftResponse` (GET/POST/PATCH `/v1/work-shifts`)

4 field đổi type `number | null` → `string | null` (HH:mm):

```typescript
export interface WorkShiftResponse {
  // ...
  checkInWindowStart: string | null;   // "07:30" — null = default 60p trước checkInTime
  checkInWindowEnd:   string | null;   // "09:00" — null = default 60p sau (chưa cộng approvedLate)
  checkOutWindowStart: string | null;  // "16:00" — null = default 60p trước checkOutTime (chưa trừ approvedEarly)
  checkOutWindowEnd:  string | null;   // "18:00" — null = default 60p sau
}
```

### 2. `CreateWorkShiftDto` / `UpdateWorkShiftDto`

```typescript
export interface CreateWorkShiftDto {
  // ...
  checkInWindowStart?: string;   // "HH:mm" — phải ≤ checkInTime, cách ≤ 4 giờ. omit/null = TH1 default 60p
  checkInWindowEnd?:   string;   // "HH:mm" — phải ≥ checkInTime, cách ≤ 4 giờ
  checkOutWindowStart?: string;  // "HH:mm" — phải ≤ checkOutTime, cách ≤ 4 giờ
  checkOutWindowEnd?:  string;   // "HH:mm" — phải ≥ checkOutTime, cách ≤ 4 giờ
}
```

Trên PATCH, gửi `null` để clear (TH2 → TH1) cho từng field.

### 3. Rule validation BE (400 nếu vi phạm)

| Case | Message |
|------|---------|
| Sai format | `"checkInWindowStart phải theo định dạng HH:mm"` |
| `checkInWindowStart > checkInTime` (sai chiều) hoặc cách > 4 giờ | `"checkInWindowStart (12:00) phải nằm trong 4 giờ trước checkInTime (08:00)"` |
| `checkInWindowEnd < checkInTime` hoặc cách > 4 giờ | `"checkInWindowEnd (07:00) phải nằm trong 4 giờ sau checkInTime (08:00)"` |
| Tương tự cho `checkOutWindowStart` / `checkOutWindowEnd` với `checkOutTime` | (analog) |

### 4. Cross-midnight tolerant

Ca sớm (VD `checkInTime=00:30`) có thể set `checkInWindowStart="22:30"` = 120p trước — BE hiểu là hôm trước.

Ngược lại, ca đêm cần `checkInWindowEnd` cross-midnight cũng hỗ trợ tương tự.

Ràng buộc duy nhất là **offset tuyệt đối ≤ 240 phút (4 giờ)**.

---

## Việc FE cần làm

### A. Form Create/Edit WorkShift (`settings/shifts.vue`)

**Thay 4 input số (0–240) bằng 4 TimePicker HH:mm** — đối xứng với TimePicker `checkInTime` / `checkOutTime`.

Layout gợi ý:

```
┌─ Cửa sổ chấm công ────────────────────────────────────────┐
│ ○ Dùng mặc định (±60 phút quanh giờ ca)                   │
│ ● Tùy chỉnh cho ca này                                     │
│                                                             │
│   Check-in :  [ 07:30 ] → [ 09:00 ]                       │
│   Check-out:  [ 16:00 ] → [ 18:00 ]                       │
│                                                             │
│   💡 Preview: Cho phép check-in 07:30 – 09:00             │
│              Cho phép check-out 16:00 – 18:00             │
└─────────────────────────────────────────────────────────────┘
```

Logic:
- Toggle "Dùng mặc định" ON → gửi 4 field = `undefined` (POST) hoặc `null` (PATCH). Ẩn/disable 4 TimePicker.
- Toggle OFF → cho HR chỉnh 4 TimePicker.
- Nếu HR chỉ điền 1 trong 4 → gửi 3 còn lại là `null`/`undefined` (mixed TH1/TH2 hợp lệ).

Validate client-side (giúp UX, BE vẫn là source of truth):
- `checkInWindowStart ≤ checkInTime ≤ checkInWindowEnd`
- `checkOutWindowStart ≤ checkOutTime ≤ checkOutWindowEnd`
- Không hạn chế cross-midnight — cứ để BE kiểm.

Nếu BE reject 400 → hiển thị `error.message` trực tiếp (message tự đủ nghĩa vì có kèm giá trị người dùng nhập + giá trị shift time).

### B. Bảng danh sách ca

Cột "Cửa sổ" (nếu có) hiển thị trực tiếp giờ thay vì tính offset:
- `Mặc định` khi cả 4 field null
- `Check-in 07:30–09:00 · Check-out 16:00–18:00` khi có tùy chỉnh

### C. Composable / type

```typescript
// types/shift.types.ts — đổi 4 field window sang string | null
export interface WorkShiftResponse {
  // ...
  checkInWindowStart: string | null;
  checkInWindowEnd:   string | null;
  checkOutWindowStart: string | null;
  checkOutWindowEnd:  string | null;
}
```

Chạy `pnpm typecheck` — sẽ báo mọi chỗ đang parse `number` từ 4 field này để bạn cập nhật.

---

## Kịch bản test

- [ ] Tạo ca 08:00–17:00 với `checkInWindowStart="07:30", checkInWindowEnd="09:00"` → 201, response chứa đúng 2 giá trị HH:mm.
- [ ] PATCH ca gửi cả 4 = `null` → 200, response 4 field = null (chuyển về TH1).
- [ ] Gửi `checkInWindowStart="09:00"` (sau checkInTime="08:00") → 400 với message rõ nghĩa.
- [ ] Gửi `checkInWindowStart="03:30"` (cách 4h30) khi `checkInTime="08:00"` → 400.
- [ ] Tạo ca `checkInTime="00:30", checkInWindowStart="22:30"` → 201 (cross-midnight hợp lệ).
- [ ] Format sai (VD `"8:00"` thiếu leading zero, `"25:00"` sai giờ) → 400.

---

## Backward compatibility

- Toàn bộ dữ liệu ca hiện tại lưu DB dưới dạng **offset (Int)** — không cần migration DB, không cần đổi seed.
- Response tự chuyển offset → HH:mm, request tự chuyển HH:mm → offset ở tầng service.
- **Breaking change ở API surface:** FE cũ đang gửi số phút sẽ bị 400. Cần deploy FE + BE đồng bộ.
