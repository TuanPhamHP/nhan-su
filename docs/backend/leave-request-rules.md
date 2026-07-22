# Leave Request — Overlap Rules

Tài liệu chuẩn về logic phát hiện trùng lịch (overlap) khi tạo/sửa đơn nghỉ phép.

Code liên quan:
- `src/modules/leave/utils/leave-slot.utils.ts` — mental model + hàm thuần
- `src/modules/leave/leave.repository.ts` — `findOverlappingCandidates`
- `src/modules/leave/leave.service.ts` — quyết định conflict dựa trên slot

---

## 1. Danh mục loại phép (seed)

| Code       | Tên              | Kiểu          | Ghi chú                                                                 |
|------------|------------------|---------------|-------------------------------------------------------------------------|
| `ANNUAL`   | Phép năm         | Ngày          | Có `halfDayPeriod` → nửa ngày. Trừ balance.                             |
| `UNPAID`   | Nghỉ không lương | Ngày          | Có `halfDayPeriod` → nửa ngày. Không trừ balance.                       |
| `HALF_DAY` | Nghỉ nửa ngày    | Ngày          | Có `halfDayPeriod` → nửa ngày.                                          |
| `WELFARE`  | Chế độ           | Ngày          | Có `halfDayPeriod` → nửa ngày.                                          |
| `LATE`     | Đi muộn          | Time-only     | Bắt buộc `lateMinutes` (≤ 120). Bắt buộc `startDate === endDate`.       |
| `EARLY`    | Về sớm           | Time-only     | Bắt buộc `earlyMinutes` (≤ 120). Bắt buộc `startDate === endDate`.      |

---

## 2. Mental model — Slot

Mỗi đơn nghỉ chiếm một tập slot trong ngày. Chỉ có **2 slot**:

- `AM` — buổi sáng
- `PM` — buổi chiều

Cách suy ra slot của một đơn (`computeLeaveSlots`):

| Trạng thái đơn                                          | Slot chiếm mỗi ngày |
|---------------------------------------------------------|---------------------|
| `code = LATE`                                           | `{AM}`              |
| `code = EARLY`                                          | `{PM}`              |
| `halfDayPeriod = MORNING` (mọi code khác LATE/EARLY)    | `{AM}`              |
| `halfDayPeriod = AFTERNOON` (mọi code khác LATE/EARLY)  | `{PM}`              |
| `halfDayPeriod = null`, code khác LATE/EARLY (full-day) | `{AM, PM}`          |

Ưu tiên: `code` (LATE/EARLY) > `halfDayPeriod`. Trong thực tế DTO validate `LATE`/`EARLY` không đi kèm `halfDayPeriod`, nhưng util vẫn xử lý defensive.

---

## 3. Quy tắc conflict

Hai đơn **A** và **B** của cùng employee conflict khi và chỉ khi cả 2 điều kiện đồng thời đúng:

1. **Khoảng ngày giao nhau:** `A.startDate ≤ B.endDate` VÀ `A.endDate ≥ B.startDate`.
2. **Tập slot giao nhau:** `slots(A) ∩ slots(B) ≠ ∅`.

Vì mỗi đơn có tập slot cố định (không thay đổi theo ngày trong khoảng của nó), thuật toán rút gọn thành: `date_range_overlap && slot_sets_intersect`.

Chỉ so với đơn có `status ∈ {PENDING, APPROVED}`. `REJECTED` và `CANCELLED` bỏ qua.

---

## 4. Ma trận conflict (cùng ngày, cùng employee)

Ký hiệu:
- `FULL` = full-day (bất kỳ code ngày, `halfDayPeriod = null`)
- `H-AM` = half-day MORNING (bất kỳ code ngày)
- `H-PM` = half-day AFTERNOON (bất kỳ code ngày)
- `LATE` = code `LATE`
- `EARLY` = code `EARLY`

| Existing \ New | FULL | H-AM | H-PM | LATE | EARLY |
|----------------|:----:|:----:|:----:|:----:|:-----:|
| **FULL**       | ❌   | ❌   | ❌   | ❌   | ❌    |
| **H-AM**       | ❌   | ❌   | ✅   | ❌   | ✅    |
| **H-PM**       | ❌   | ✅   | ❌   | ✅   | ❌    |
| **LATE**       | ❌   | ❌   | ✅   | ❌   | ✅    |
| **EARLY**      | ❌   | ✅   | ❌   | ✅   | ❌    |

❌ = block (409 Conflict) · ✅ = cho phép

Ma trận đối xứng — kết quả không phụ thuộc thứ tự tạo đơn.

---

## 5. Case cụ thể theo tình huống

### 5.1 Case cho phép (✅)

| # | Đơn cũ                            | Đơn mới                    | Lý do                                                     |
|---|-----------------------------------|----------------------------|-----------------------------------------------------------|
| 1 | `LATE` 16/07                      | `EARLY` 16/07              | `{AM} ∩ {PM} = ∅`                                         |
| 2 | `EARLY` 16/07                     | `LATE` 16/07               | Đối xứng của #1                                            |
| 3 | `ANNUAL` half-MORNING 16/07       | `EARLY` 16/07              | `{AM} ∩ {PM} = ∅`                                         |
| 4 | `ANNUAL` half-MORNING 16/07       | `ANNUAL` half-AFTERNOON 16/07 | `{AM} ∩ {PM} = ∅`                                       |
| 5 | `ANNUAL` half-AFTERNOON 16/07     | `LATE` 16/07               | `{PM} ∩ {AM} = ∅`                                         |
| 6 | `ANNUAL` full 10-12/07            | bất kỳ đơn 15/07           | Khoảng ngày không giao                                    |
| 7 | `UNPAID` half-AFTERNOON 16/07     | `ANNUAL` half-MORNING 16/07| Khác buổi (hết balance sáng → chiều nghỉ không lương)     |

### 5.2 Case chặn (❌)

| # | Đơn cũ                        | Đơn mới                        | Lý do                                              |
|---|-------------------------------|--------------------------------|----------------------------------------------------|
| 8 | `LATE` 16/07                  | `LATE` 16/07                   | Không thể đi muộn 2 lần cùng ngày (`{AM} ∩ {AM}`)  |
| 9 | `EARLY` 16/07                 | `EARLY` 16/07                  | Không thể về sớm 2 lần cùng ngày                   |
| 10| `ANNUAL` full 16/07           | `LATE` 16/07                   | Đã nghỉ nguyên ngày, không cần đi muộn             |
| 11| `ANNUAL` full 16/07           | `EARLY` 16/07                  | Tương tự #10                                       |
| 12| `ANNUAL` full 16/07           | `ANNUAL` half-MORNING 16/07    | `{AM,PM} ∩ {AM} ≠ ∅`                               |
| 13| `ANNUAL` half-MORNING 16/07   | `LATE` 16/07                   | LATE nằm trong buổi sáng đã nghỉ                   |
| 14| `ANNUAL` half-AFTERNOON 16/07 | `EARLY` 16/07                  | EARLY nằm trong buổi chiều đã nghỉ                 |
| 15| `ANNUAL` half-MORNING 16/07   | `UNPAID` half-MORNING 16/07    | Trùng buổi (dù khác code)                          |
| 16| `ANNUAL` full 15-17/07        | `LATE` 16/07                   | Multi-day full-day đè lên time-only trong khoảng   |
| 17| `LATE` 16/07                  | `ANNUAL` full 15-17/07         | Buộc user hủy `LATE` cũ trước khi tạo full-day     |
| 18| `ANNUAL` full 15-17/07        | `ANNUAL` full 17-19/07         | Giao 1 ngày (17/07), cả 2 đều `{AM,PM}` → conflict |

---

## 6. Edge cases

### E1. Đơn multi-day luôn là full-day
DTO đã validate: `halfDayPeriod` chỉ được set khi `startDate === endDate`. `LATE`/`EARLY` cũng bắt buộc single-day. Do đó, mọi đơn multi-day đều có `slots = {AM, PM}` cho toàn bộ khoảng ngày.

### E2. Update đơn (`excludeId`)
`findOverlappingCandidates` nhận tham số optional `excludeId` để loại bỏ chính đơn đang sửa khỏi tập candidate. Bắt buộc truyền khi implement flow update (hiện chưa có endpoint update, nhưng API vẫn giữ để mở rộng).

### E3. Status filter
Chỉ so với `PENDING` và `APPROVED`. Đơn `REJECTED`/`CANCELLED` không tính vào overlap — user có thể tạo lại đơn ngay sau khi đơn cũ bị reject/cancel.

### E4. Timezone
`startDate`/`endDate` lưu Date UTC 00:00 (theo ngày Việt Nam do FE gửi lên dưới dạng `YYYY-MM-DD`). So sánh `lte`/`gte` an toàn về giao ngày.

### E5. `HALF_DAY` code với `halfDayPeriod = null`
Về mặt logic ambiguous (loại phép "nửa ngày" nhưng không chọn buổi). Overlap util **không** xử lý riêng — treat như full-day (`{AM, PM}`). Nếu business muốn semantics khác, sửa `computeLeaveSlots` + cập nhật file này.

### E6. Race condition
Hai request tạo đơn cùng lúc có thể cùng pass check overlap rồi cùng insert. Hiện tại chưa có unique constraint DB để chặn. Đây là **known limitation**, cần task riêng (advisory lock hoặc partial unique index theo employee + date range).

### E7. Message lỗi
Thông báo conflict cho user biết:
- Tên loại phép của đơn cũ
- Trạng thái đơn cũ (đã duyệt / đang chờ duyệt)
- Khoảng ngày đơn cũ
- Buổi bị trùng (sáng / chiều / cả ngày)

Ví dụ: `Bạn đã có đơn "Phép năm" đã được duyệt ngày 2026-07-16 (buổi sáng) trùng buổi với đơn này.`

### E8. Cross-day multi-day + single-day time-only
Đơn full-day multi-day (VD 15–17/07) đè lên `LATE` 16/07: giao ngày 16, slot `{AM,PM} ∩ {AM} = {AM}` → conflict. Xử lý tự nhiên bởi thuật toán chung.

### E9. Đơn cũ multi-day full + đơn mới multi-day full có giao nhau ≥ 1 ngày
Cả 2 đều `{AM,PM}`, chỉ cần giao 1 ngày là conflict.

### E10. Đơn PENDING nhưng chưa được approve, user tạo đơn mới trùng
Vẫn chặn — user phải cancel đơn PENDING cũ trước. Không cho phép ghi đè để tránh race giữa lúc approver duyệt và user tự tạo lại.

---

## 7. Thuật toán tham chiếu (pseudocode)

```ts
const newSlots = computeLeaveSlots({
  leaveTypeCode: leaveType.code,
  halfDayPeriod: dto.halfDayPeriod,
});

const candidates = await repo.findOverlappingCandidates(
  employeeId,
  startDate,
  endDate,
  excludeId,
);

const conflict = candidates.find((c) => {
  const existingSlots = computeLeaveSlots({
    leaveTypeCode: c.leaveType.code,
    halfDayPeriod: c.halfDayPeriod,
  });
  return slotsIntersect(existingSlots, newSlots);
});

if (conflict) throw new ConflictException(...);
```

---

## 8. Khi cần bổ sung loại phép mới

Nếu thêm code mới (VD `COMPENSATORY`, `MATERNITY`…):
1. Xác định loại chiếm slot nào (`AM`, `PM`, hay cả `{AM,PM}`).
2. Nếu là time-only kiểu mới (không phải `LATE`/`EARLY`) → cập nhật `computeLeaveSlots`.
3. Nếu là loại theo ngày → tự khớp cơ chế `halfDayPeriod` hiện có, không cần sửa util.
4. Cập nhật bảng loại phép mục §1 và ma trận §4 trong file này.

---

## 9. Attendance window impact — Half-day leave shift check-in/out window

Khi đơn half-day được **APPROVED**, `LeaveService.approve` gọi `ShiftScheduleService.createEffectiveOverrideFromLeave` để insert 1 bản ghi `effectiveShiftOverride`. Bản ghi này ghi đè `checkInTime`/`checkOutTime` cho ngày đó khi `AttendanceValidationService` validate check-in / check-out.

### 9.1 Boundary — mốc nghỉ trưa của ca

Ranh giới sáng/chiều **KHÔNG** phải hardcode 12:00 mà lấy từ chính cấu hình ca:

| Field trên `WorkShift` | Ý nghĩa |
|------------------------|---------|
| `checkInTime`          | Giờ bắt đầu ca sáng |
| `breakStartTime`       | Giờ kết thúc ca sáng = giờ bắt đầu nghỉ trưa |
| `breakEndTime`         | Giờ kết thúc nghỉ trưa = giờ bắt đầu ca chiều |
| `checkOutTime`         | Giờ kết thúc ca chiều |

Cả 2 field `break*` phải cùng set hoặc cùng null. Nếu null → ca **không hỗ trợ nghỉ nửa ngày** (validate ở [WorkShiftService](../src/modules/work-shift/work-shift.service.ts)).

### 9.2 Half-day override

Áp dụng bởi `calculateHalfDayWindow` ([shift.utils.ts](../src/common/utils/shift.utils.ts)):

| Half-day period | `effectiveStart` | `effectiveEnd` |
|-----------------|------------------|----------------|
| `MORNING` (nghỉ sáng, làm chiều) | `breakEndTime` | `checkOutTime` |
| `AFTERNOON` (làm sáng, nghỉ chiều) | `checkInTime` | `breakStartTime` |

### 9.3 Ví dụ — Ca 08:30–12:00 / nghỉ trưa 12:00–13:30 / 13:30–18:00

Constants TH1 default ([attendance-validation.service.ts](../src/modules/attendance/attendance-validation.service.ts)):
- `CHECK_IN_WINDOW_BEFORE_MIN = 60`, `CHECK_IN_WINDOW_AFTER_MIN = 60`
- `CHECK_OUT_WINDOW_BEFORE_MIN = 60`, `CHECK_OUT_WINDOW_AFTER_MIN = 60`

> HR có thể override 4 field `WorkShift.checkInWindowStart/End`, `checkOutWindowStart/End` (nullable Int 0–240) cho từng ca — khi set, các giá trị đó thay thế constants trên (TH2). Xem [attendance-shifts.md](./bridges/attendance-shifts.md) mục "Cấu hình window check-in/out — TH1 vs TH2".

| Ngày | Check-in window | Check-out window |
|------|-----------------|------------------|
| Full-day (không nghỉ) | `[07:30, 09:30 + approvedLate]` | `[17:00 − approvedEarly, 19:00]` |
| Half-day MORNING (làm chiều) | `[12:30, 14:30 + approvedLate]` | `[17:00 − approvedEarly, 19:00]` |
| Half-day AFTERNOON (làm sáng) | `[07:30, 09:30 + approvedLate]` | `[11:00 − approvedEarly, 13:00]` |

`approvedLate` / `approvedEarly` vẫn được cộng thêm nếu có `LATE`/`EARLY` (leave hoặc violation) approved cho ngày đó.

### 9.4 Validation ở LeaveService

Khi tạo đơn có `halfDayPeriod`, service check ca của employee cho ngày đó:
- Không tìm thấy ca → `400 Không tìm thấy ca làm việc cho ngày này`.
- Ca không có `breakStartTime`/`breakEndTime` → `400 Ca làm việc của ngày này không hỗ trợ nghỉ nửa ngày vì chưa cấu hình giờ nghỉ trưa`.

### 9.5 Ca không hỗ trợ half-day

| Ca | Có hỗ trợ? | Lý do |
|----|:----------:|-------|
| Ca hành chính 08:30–18:00, break 12:00–13:30 | ✅ | Có break* |
| Ca linh hoạt 00:00–06:00 (làm ≥ 6h/ngày) | ❌ | break* = null |
| Ca đêm cross-midnight (VD 22:00–06:00) | ❌ | Cross-midnight → không cho set break |
| Ca online T7 | ❌ (mặc định) | break* = null |

HR có thể update qua UI để bật hỗ trợ nếu công ty muốn.

### 9.6 Edge cases §9

**E9-1. Ca đổi giờ nghỉ trưa sau khi đã có đơn approved**
`effectiveShiftOverride` lưu snapshot `effectiveStart`/`effectiveEnd` tại thời điểm approve. Nếu HR sửa `breakStartTime`/`breakEndTime` của ca sau đó, các đơn cũ **không** tự cập nhật override. Chỉ đơn approve **sau** khi sửa ca mới dùng giờ mới.

**E9-2. Ca cross-midnight**
`WorkShiftService.validateShiftTimes` **reject** khi ca có `checkOutTime ≤ checkInTime` mà cố set break. Nghĩa là ca đêm không thể có half-day. Business decision — nếu cần, phải mở rộng model (VD dùng minute offset thay vì clock time).

**E9-3. Ca online (`isOnline = true`)**
Không check-in được (`ONLINE_SHIFT_NO_CHECKIN`). Half-day + ca online → override vẫn tạo nhưng không ai dùng — vô hại nhưng gây confusion. Không tự động block ở LeaveService để giữ business flexibility (VD ca online T7 có thể chuyển thành onsite ngày cụ thể).

**E9-4. 2 đơn half khớp full-day (MORNING + AFTERNOON cùng ngày)**
Cả 2 approve → `createEffectiveOverrideFromLeave` gọi 2 lần → `upsertEffectiveOverride` đè lên nhau. Đơn approve sau win. Kết quả: window sai. **Known limitation** — cần task riêng để xử lý (gộp 2 half thành full-day off, hoặc set flag "skip check-in").
