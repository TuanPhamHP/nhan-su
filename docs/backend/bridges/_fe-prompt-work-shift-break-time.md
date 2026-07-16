# FE Agent Prompt — WorkShift bổ sung `breakStartTime` / `breakEndTime` (nghỉ trưa)

## Context

Trước đây `WorkShift` chỉ có `checkInTime` + `checkOutTime`. Khi user tạo đơn nghỉ nửa ngày (`halfDayPeriod = MORNING | AFTERNOON`), BE dùng **12:00 UTC hardcode** làm ranh giới sáng/chiều để tính cửa sổ check-in/check-out.

**Bug thực tế:** với ca công ty `08:30–12:00 / nghỉ trưa 12:00–13:30 / 13:30–18:00`, khi user nghỉ MORNING và đến làm buổi chiều đúng giờ 13:30 → hệ thống trả `CHECK_IN_WINDOW_CLOSED` vì window được tính từ 12:00 (`[11:00, 13:00]`) chứ không phải từ 13:30 (`[12:30, 14:30]`).

**Đã fix:** thêm 2 field nullable `breakStartTime` + `breakEndTime` vào `WorkShift`. BE dùng 2 field này thay cho hardcode 12:00. Đồng thời BE cũng đã đổi logic overlap của leave request theo slot AM/PM (LATE + EARLY cùng ngày giờ cho phép).

FE cần cập nhật để:
1. Cho HR nhập/sửa giờ nghỉ trưa của ca.
2. Hiển thị giờ nghỉ trưa trên calendar / lịch ca / today-info.
3. Block option "Nghỉ nửa ngày" khi ca không cấu hình giờ nghỉ trưa.
4. Cập nhật message overlap mới cho leave form.

Bridge docs đầy đủ:
- [`docs/bridges/attendance-shifts.md`](./attendance-shifts.md) — mục nghỉ trưa, JSON examples, edge cases mới.
- [`docs/bridges/leave-requests.md`](./leave-requests.md) — mục "Overlap semantics" (bảng ma trận), lỗi 400 mới.
- [`docs/leave-request-rules.md`](../leave-request-rules.md) — spec chi tiết (mental model slot AM/PM, §9 "Attendance window impact").

---

## Thay đổi API

### 1. `WorkShiftResponse` (GET/POST/PATCH `/v1/work-shifts`)

Thêm 2 field mới trong response:

```typescript
export interface WorkShiftResponse {
  // ... các field cũ
  breakStartTime: string | null;  // "HH:mm" — VD "12:00". null nếu ca không hỗ trợ half-day
  breakEndTime: string | null;    // "HH:mm" — VD "13:30". null nếu ca không hỗ trợ half-day
}
```

### 2. `CreateWorkShiftDto` (POST) / `UpdateWorkShiftDto` (PATCH)

```typescript
export interface CreateWorkShiftDto {
  // ... các field cũ
  breakStartTime?: string;  // "HH:mm" — optional. Nếu set thì breakEndTime cũng phải set.
  breakEndTime?: string;    // "HH:mm" — optional. Nếu set thì breakStartTime cũng phải set.
}
```

**Rule validation của BE (400 nếu vi phạm):**

| Case | Message |
|------|---------|
| Chỉ set 1 trong 2 `break*` | `"breakStartTime và breakEndTime phải được set cùng nhau (hoặc cùng null)"` |
| Ca cross-midnight (`checkOut ≤ checkIn`) mà set break | `"Ca cross-midnight (checkOutTime ≤ checkInTime) không hỗ trợ nghỉ trưa"` |
| Thứ tự sai (VD `breakStart > breakEnd`, hoặc break ngoài giờ ca) | `"Thứ tự thời gian không hợp lệ: yêu cầu checkInTime < breakStartTime < breakEndTime < checkOutTime"` |

Trên PATCH, để clear break gửi cả 2 = `null`:
```json
{ "breakStartTime": null, "breakEndTime": null }
```

### 3. `ShiftScheduleResponse.shift` + `CalendarDayResponse.employees[].shift`

Object `shift` lồng bên trong 2 response này cũng có 2 field mới:

```typescript
export interface WorkShiftSummary {
  id: number;
  name: string;
  checkInTime: string;
  checkOutTime: string;
  breakStartTime: string | null;  // MỚI
  breakEndTime: string | null;    // MỚI
  workDays: number[];
}
```

Áp dụng cho:
- `GET /v1/shift-schedules/me`
- `GET /v1/shift-schedules`
- `GET /v1/shift-schedules/calendar`
- `POST /v1/shift-schedules`

### 4. `POST /v1/leave-requests` — 2 lỗi 400 mới

Khi tạo đơn có `halfDayPeriod`, BE resolve ca của employee cho ngày đó và có thể trả:

```json
// Không tìm thấy ca cho ngày đó (employee thiếu defaultShift + không có schedule)
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Không tìm thấy ca làm việc cho ngày này. Vui lòng liên hệ HR." } }

// Ca có nhưng breakStartTime === null
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Ca làm việc của ngày này không hỗ trợ nghỉ nửa ngày vì chưa cấu hình giờ nghỉ trưa. Vui lòng chọn nghỉ cả ngày hoặc liên hệ HR." } }
```

### 5. `POST /v1/leave-requests` — Overlap logic đổi từ "trùng ngày" → "trùng buổi (slot AM/PM)"

Trước đây trùng ngày là 409. Giờ chỉ conflict khi trùng **slot** (buổi) — LATE (sáng) + EARLY (chiều) cùng ngày giờ cho phép. Ma trận đầy đủ và message 409 mới xem bridge doc `leave-requests.md` và `docs/leave-request-rules.md`.

**Ví dụ 409 message mới:**
```
"Bạn đã có đơn \"Phép năm\" đã được duyệt ngày 2026-07-16 (buổi sáng) trùng buổi với đơn này."
```

Không cần đổi code FE nếu chỉ hiển thị `error.message` — message tự đủ thông tin. Chỉ cần đảm bảo FE không hardcode text "trùng ngày" ở đâu đó khi hiển thị lỗi 409.

---

## Việc FE cần làm

### A. Trang quản lý ca (HR) — form Create/Edit WorkShift

**Thêm 2 field input HH:mm:**
- Label: "Bắt đầu nghỉ trưa" / "Kết thúc nghỉ trưa"
- Placeholder: `12:00` / `13:30`
- Cùng row, có thể là 2 TimePicker.

**UX rule:**
- Nếu user điền 1 trong 2, mark cả 2 required (client-side validate).
- Nếu cả 2 rỗng → gửi lên BE **không kèm** 2 field đó (hoặc gửi `null` trong PATCH nếu muốn clear).
- Ẩn/disable 2 field khi ca là cross-midnight (checkOut ≤ checkIn).
- Hiển thị hint: "Để trống nếu ca không có nghỉ trưa (ca liên tục / ca đêm). Khi trống, nhân sự **không** thể tạo đơn nghỉ nửa ngày cho ca này."

**Xử lý lỗi 400 từ BE:** display message trực tiếp từ `error.message` (đã đủ nghĩa).

### B. Calendar view / lịch ca — hiển thị nghỉ trưa

Ở mỗi cell ca (calendar HR, lịch ca cá nhân, today-info): nếu `shift.breakStartTime != null`, hiển thị thêm dòng nhỏ hoặc tooltip:
> Giờ làm: 08:30 – 12:00 · **Nghỉ trưa 12:00 – 13:30** · 13:30 – 18:00

Nếu `breakStartTime === null`, chỉ hiển thị: `08:30 – 18:00` như cũ.

### C. Form tạo đơn Leave — disable option Half-day khi ca không hỗ trợ

**Trước khi hiển thị radio group "Cả ngày / Nửa ngày sáng / Nửa ngày chiều":**
1. Xác định ca của employee cho `startDate` được chọn:
   - Employee tự tạo: dùng lịch ca của chính mình.
   - HR tạo hộ: gọi `GET /v1/shift-schedules?employeeId=X&startDate=Y&endDate=Y` hoặc dùng `defaultShift` từ profile.
2. Nếu `shift.breakStartTime === null` → disable 2 option "Nửa ngày sáng" và "Nửa ngày chiều", tooltip: "Ca của bạn không có nghỉ trưa cấu hình, không thể tạo nghỉ nửa ngày."

**Nếu user vẫn cố submit `halfDayPeriod` (VD race condition):** BE sẽ reject 400 với message rõ nghĩa — display trực tiếp.

### D. Preview khung giờ phải có mặt sau khi chọn Half-day (optional nhưng nên có)

Sau khi user chọn `halfDayPeriod`, có thể hiển thị preview khung giờ mình phải đi làm:

```
Bạn đã chọn: Nghỉ nửa ngày MORNING (sáng)
→ Bạn cần có mặt buổi chiều: 13:30 – 18:00
→ Cửa sổ check-in: 12:30 – 14:30 (± 60 phút quanh 13:30)
```

Công thức (xem bridge doc §"Nghỉ nửa ngày & cửa sổ check-in/check-out"):
- MORNING: có mặt từ `breakEndTime` → `checkOutTime`
- AFTERNOON: có mặt từ `checkInTime` → `breakStartTime`
- Check-in window = `[effectiveStart − 60m, effectiveStart + 60m]`

### E. Xử lý message overlap 409 mới cho leave form

Không cần đổi logic — chỉ đảm bảo:
- Hiển thị `error.message` trực tiếp (không hardcode text override).
- Nếu FE có label riêng cho code `LEAVE_OVERLAP` thì gỡ hoặc chuyển sang generic (BE giờ trả code `CONFLICT`).

---

## Data mẫu để test

### Seed đã update, sau `npm run db:seed` sẽ có:

| ID | Tên | checkIn | checkOut | break | Hỗ trợ half-day? |
|----|-----|---------|----------|-------|:----------------:|
| 1  | Ca hành chính HN | 08:30 | 18:00 | 12:00 – 13:30 | ✅ |
| 2  | Ca hành chính LS | 08:00 | 17:00 | 12:00 – 13:30 | ✅ |
| 3  | Ca hành chính Bắc Ninh | 08:00 | 17:30 | 12:00 – 13:30 | ✅ |
| 4  | Ca linh hoạt | 00:00 | 06:00 | null | ❌ |
| 5  | Ca online T7 | 08:00 | 13:00 | null | ❌ |

### Kịch bản kiểm thử

**Test 1 — Overlap cho phép mới:**
1. Employee X có shift 1 (có break).
2. Tạo đơn `LATE` 30 phút ngày 20/08 → APPROVED.
3. Tạo đơn `EARLY` 45 phút ngày 20/08 → **thành công** (trước đây bị 409, giờ OK).

**Test 2 — Reject half-day khi ca không có break:**
1. Employee Y có shift 4 (ca linh hoạt, không có break).
2. Tạo đơn nghỉ half-day MORNING ngày 20/08 → **400** "Ca làm việc của ngày này không hỗ trợ nghỉ nửa ngày...".

**Test 3 — Window check-in đúng cho half-day:**
1. Employee Z có shift 1 (break 12:00–13:30).
2. Tạo đơn half-day MORNING ngày 20/08, HR approve.
3. Ngày 20/08 lúc 13:30 gọi check-in → thành công (window `[12:30, 14:30]`).
4. Lúc 12:29 hoặc 14:31 → `TOO_EARLY` / `CHECK_IN_WINDOW_CLOSED`.

**Test 4 — Validate BE reject sai config:**
1. HR tạo shift với `breakStartTime: "12:00"` mà không có `breakEndTime` → 400.
2. HR tạo shift với `checkInTime: "22:00", checkOutTime: "06:00", breakStartTime: "23:00", breakEndTime: "00:00"` → 400 (cross-midnight).
3. HR tạo shift với `breakStartTime: "07:00", breakEndTime: "08:00"` (trước `checkInTime: "08:30"`) → 400 (sai thứ tự).

---

## Backward compatibility

- Field `breakStartTime` / `breakEndTime` là **nullable** trên DB — mọi ca cũ trong prod sẽ có 2 field = `null` sau migration.
- Response cũ + code FE cũ (không đọc 2 field mới) vẫn hoạt động — chỉ mất chức năng half-day cho các ca chưa có break.
- HR cần tự vào update ca qua UI (khi FE build xong) để enable half-day cho các ca đó.

Không có breaking change endpoint / DTO shape.

---

## Deliverables

- [ ] Form Create/Edit WorkShift có 2 TimePicker cho break, validate XOR client-side.
- [ ] Calendar / lịch ca / today-info hiển thị thông tin nghỉ trưa khi có.
- [ ] Form Leave disable option Half-day khi ca không hỗ trợ, kèm tooltip giải thích.
- [ ] (Optional) Preview khung giờ có mặt sau khi chọn Half-day.
- [ ] Bỏ mọi hardcode "12:00" / "nửa ngày = 4 tiếng" nếu có ở FE.
- [ ] Bỏ hardcode text overlap cũ ("trùng ngày") — chuyển sang hiển thị `error.message` trực tiếp.
- [ ] Test 4 kịch bản trên với seed data mới.
