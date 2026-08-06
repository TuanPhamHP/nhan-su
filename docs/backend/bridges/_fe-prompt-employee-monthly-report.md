# FE Agent Prompt — Tích hợp API báo cáo công tháng của 1 nhân viên

## Context

Backend expose 2 endpoint báo cáo công tháng dùng chung schema `EmployeeMonthlyReportResponse`:

| Endpoint | Ai gọi | Mục đích |
|---|---|---|
| `GET /v1/reports/my/monthly` | Mọi user đã đăng nhập | Nhân viên tự xem báo cáo của bản thân |
| `GET /v1/reports/employees/:employeeId/monthly` | `ADMIN`, `HR`, `DIRECTOR`, `MANAGER`, `CHIEF` | HR/quản lý xem báo cáo của 1 nhân viên cụ thể |

Prompt này chỉ focus vào endpoint thứ 2 (`/employees/:employeeId/monthly`). Endpoint `/my/monthly` xem [reports_me.md](./reports_me.md).

Bridge doc đầy đủ: [`docs/bridges/reports_me.md`](./reports_me.md).

---

## Endpoint

```
GET /v1/reports/employees/:employeeId/monthly?month=<1-12>&year=<>=2020>
```

## Auth

- Header `Authorization: Bearer <accessToken>` bắt buộc.
- Role được phép: `ADMIN`, `HR`, `DIRECTOR`, `MANAGER`, `CHIEF`.
- `EMPLOYEE` → **403** từ RolesGuard.
- `MANAGER` **chỉ xem được nhân viên cùng phòng ban mình đang manage** (`Department.managerId = user.id`). Ngoài phòng ban → **403** `"Không có quyền xem báo cáo nhân viên này"`.
- `ADMIN`, `HR`, `DIRECTOR`, `CHIEF` không bị giới hạn scope — xem được bất kỳ nhân viên nào.

## Params

### Path
| Name | Type | Required | Mô tả |
|---|---|---|---|
| `employeeId` | number (int, ≥1) | ✅ | ID nhân viên cần xem báo cáo |

### Query
| Name | Type | Required | Mô tả |
|---|---|---|---|
| `month` | number (1–12) | ✅ | Tháng |
| `year` | number (≥2020, ≤ currentYear+1) | ✅ | Năm |

---

## TypeScript types

```typescript
export type ContractType = 'PROBATION' | 'FIXED_TERM' | 'INDEFINITE' | 'SEASONAL';

export interface EmployeeMonthlyReportResponse {
  employee: {
    id: number;
    fullName: string;
    employeeCode: string;         // "EMP012"
    joinDate: string;             // "YYYY-MM-DD"
    position: string | null;      // tên chức vụ
    department: string | null;    // tên phòng ban
    contractType: ContractType | null;   // HĐ ACTIVE mới nhất
  };
  period: {
    month: number;                // 1-12
    year: number;
  };
  attendance: {
    workingDays: number;          // công định mức (ngày có schedule, loại lễ)
    actualWorkDays: number;       // công thực tế = PRESENT|LATE, KHÔNG bao gồm công tác
    businessTripDays: number;     // ngày công tác (workType=BUSINESS_TRIP)
    annualLeaveDays: number;      // nghỉ phép năm APPROVED
    unpaidLeaveDays: number;      // nghỉ không lương APPROVED
    welfareLeaveDays: number;     // nghỉ chế độ APPROVED
    publicHolidayDays: number;    // ngày lễ rơi vào schedule → tính công lương
    totalPayrollDays: number;     // actual + annual + welfare + publicHoliday + businessTrip (KHÔNG cộng unpaid)
    totalActualDays: number;      // = actualWorkDays (alias)
  };
  overtime: {
    normalHours: number;          // OT ngày thường (rate 150%)
    sundayHours: number;          // OT chủ nhật (rate 200%)
    holidayOnlineHours: number;   // OT ngày lễ online (rate 300%)
    holidayOfflineHours: number;  // OT ngày lễ tại VP (rate 300%)
    totalHours: number;           // tổng 4 bucket, làm tròn 2 chữ số
  };
  violations: {
    lateCount: number;            // giải trình LATE bị REJECTED
    earlyCount: number;           // giải trình EARLY bị REJECTED
    forgotCheckCount: number;     // FORGOT_CHECKIN + FORGOT_CHECKOUT bị REJECTED
    totalCount: number;
  };
}
```

---

## Response mẫu (200 OK)

Response được bọc envelope `{ success: true, data: ... }`:

```json
{
  "success": true,
  "data": {
    "employee": {
      "id": 12,
      "fullName": "Nguyễn Văn A",
      "employeeCode": "EMP012",
      "joinDate": "2023-01-15",
      "position": "Kỹ sư phần mềm",
      "department": "Kỹ thuật",
      "contractType": "INDEFINITE"
    },
    "period": { "month": 7, "year": 2026 },
    "attendance": {
      "workingDays": 22,
      "actualWorkDays": 18,
      "businessTripDays": 2,
      "annualLeaveDays": 1,
      "unpaidLeaveDays": 0,
      "welfareLeaveDays": 0,
      "publicHolidayDays": 1,
      "totalPayrollDays": 22,
      "totalActualDays": 18
    },
    "overtime": {
      "normalHours": 6,
      "sundayHours": 4,
      "holidayOnlineHours": 2,
      "holidayOfflineHours": 0,
      "totalHours": 12
    },
    "violations": {
      "lateCount": 0,
      "earlyCount": 0,
      "forgotCheckCount": 1,
      "totalCount": 1
    }
  }
}
```

---

## Ý nghĩa các field quan trọng

### `employee`
- `contractType`: loại HĐ ACTIVE mới nhất — `INDEFINITE` | `FIXED_TERM` | `PROBATION` | `SEASONAL` | `null`. Đây là **loại HĐ** (thời hạn), khác với `employmentType` của Employee (loại lao động — FULL_TIME/INTERN/…). Currently response chưa có `employmentType`; nếu FE cần badge intern/probation trong header báo cáo, có thể call `GET /v1/employees/:id` bổ sung, hoặc yêu cầu BE add vào response.
- `position`, `department` có thể là `null` nếu nhân viên chưa gán.

### `attendance` (tất cả là số ngày, có thể có `.5` do half-day leave)
- `workingDays` — Công định mức = số ngày trong tháng có `EmployeeShiftSchedule`, loại trừ ngày lễ. Nhân viên chưa có schedule → 0.
- `actualWorkDays` — Công thực tế = ngày có `AttendanceRecord` status ∈ {PRESENT, LATE} và **KHÔNG** phải công tác.
- `businessTripDays` — Ngày `workType = BUSINESS_TRIP`, tính riêng khỏi actual.
- `annualLeaveDays` / `unpaidLeaveDays` / `welfareLeaveDays` — Sum `totalDays` của `LeaveRequest` status APPROVED theo `leaveType.code`.
- `publicHolidayDays` — Số `PublicHoliday` **rơi vào ngày có schedule** của nhân viên (chỉ tính lễ mà nhân viên phải đi làm theo lịch).
- `totalPayrollDays` = `actualWorkDays + annualLeaveDays + welfareLeaveDays + publicHolidayDays + businessTripDays`. **UNPAID không cộng.**
- `totalActualDays` = `actualWorkDays` (alias, giữ để tương thích UI cũ).

### `overtime` (đơn vị: giờ raw, làm tròn 2 chữ số)
Chỉ tính từ `OvertimeRequest` status = **APPROVED**, split theo `otRate` của từng `OvertimeSegment`:
- `normalHours` — `otRate = 150` (OT ngày thường T2–T7).
- `sundayHours` — `otRate = 200` (OT chủ nhật).
- `holidayOnlineHours` — `otRate = 300` + workMode `ONLINE` (ưu tiên `finalWorkMode` sau khi cron resolve GPS).
- `holidayOfflineHours` — `otRate = 300` + workMode `OFFLINE`.
- `totalHours` = tổng 4 bucket.

⚠️ `totalHours` là **raw hours**, chưa nhân hệ số. "Giờ trả lương" = Σ(hours × otRate/100), cần tự tính ở FE hoặc gọi payroll endpoint riêng.

### `violations`
Chỉ đếm `ViolationRequest` status = **REJECTED** (giải trình vi phạm **bị từ chối** = nhân viên có lỗi thật):
- `lateCount` — type `LATE`.
- `earlyCount` — type `EARLY`.
- `forgotCheckCount` — type ∈ {`FORGOT_CHECKIN`, `FORGOT_CHECKOUT`} (gộp 2 loại).
- `totalCount` = tổng 3 bucket.
- Đơn PENDING/APPROVED **không đếm** (APPROVED = được chấp nhận giải trình → không tính là vi phạm).

---

## Errors

| HTTP | Body message | Khi nào |
|---|---|---|
| 400 | `"Tháng không hợp lệ (1-12)"` | `month` < 1 hoặc > 12 |
| 400 | `"Năm không hợp lệ"` | `year` < 2020 hoặc > currentYear+1 |
| 401 | envelope error | Thiếu / sai / expired token |
| 403 | code `FORBIDDEN` | Role không thuộc {ADMIN, HR, DIRECTOR, MANAGER, CHIEF} |
| 403 | `"Không có quyền xem báo cáo nhân viên này"` | MANAGER cố xem nhân viên ngoài phòng ban đang manage |
| 404 | `"Nhân viên không tồn tại"` | `employeeId` không có trong DB |

---

## Checklist FE

### Layer service/composable
- [ ] Type `EmployeeMonthlyReportResponse` như block TypeScript ở trên — đưa vào `types/report.types.ts` (hoặc file dùng chung).
- [ ] Composable `useEmployeeMonthlyReport(employeeId, month, year)` gọi endpoint, cache theo key `${employeeId}-${year}-${month}`.
- [ ] Xử lý unwrap `.data` từ envelope trước khi bind.

### Màn báo cáo (HR/manager view)
- [ ] Form picker: chọn nhân viên (chỉ hiện nhân viên MANAGER có quyền — call `/v1/employees?departmentId=X` với X = phòng ban đang manage), chọn tháng/năm.
- [ ] Section `employee` — hiển thị info nhân viên + badge `contractType` (nếu có).
- [ ] Section `attendance` — grid 9 chỉ số, mỗi số kèm label tiếng Việt (Công định mức, Công thực tế, …). Số có `.5` → format 1 chữ số thập phân; số nguyên → ẩn `.0`.
- [ ] Section `overtime` — 4 bucket + tổng. Có thể hiển thị dạng bar chart.
- [ ] Section `violations` — 3 bucket + tổng. Nếu `totalCount = 0` hiển thị empty state kiểu "Không có vi phạm".

### Error handling
- [ ] 403 department scope → hiện toast/alert "Bạn không có quyền xem báo cáo nhân viên này" và redirect về danh sách nhân viên mình có quyền.
- [ ] 404 → hiển thị empty state "Nhân viên không tồn tại".
- [ ] 400 → validate month/year ở form trước khi call.

### Không cần làm
- [ ] KHÔNG cần tự tính lại "giờ trả lương" từ segments — BE chưa expose, nếu cần thì làm nhân theo rate ở FE hoặc yêu cầu BE bổ sung field mới.
- [ ] KHÔNG cần call thêm endpoint để lấy `employmentType` trừ khi UI cần badge — báo cáo hiện chỉ có `contractType`.
- [ ] MANAGER dùng chung endpoint với HR/ADMIN — không có endpoint riêng.

---

## Ghi chú thêm

- Nhân viên vừa join (chưa có schedule/attendance/leave) → tất cả số về 0 (không throw error). FE nên có empty state nhẹ.
- Tất cả thời gian bên trong tính theo giờ VN (UTC+7), FE không cần convert TZ.
- Endpoint không có `include=` param — mọi field trong response luôn được trả, không giảm được payload.
