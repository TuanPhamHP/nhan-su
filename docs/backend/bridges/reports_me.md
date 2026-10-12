# Bridge Docs — Báo cáo công tháng cá nhân (`/v1/reports/my`, `/v1/reports/employees/:id`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.
> Xem [reports.md](./reports.md) cho các báo cáo tổng hợp toàn công ty (ADMIN/HR).

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/reports/my/monthly` | Tất cả authenticated | Nhân viên tự xem báo cáo tháng của chính mình |
| GET | `/v1/reports/employees/:employeeId/monthly` | `ADMIN`, `HR`, `DIRECTOR`, `MANAGER`, `CHIEF` | Xem báo cáo tháng của 1 nhân viên; `MANAGER` bị giới hạn theo phòng ban đang manage |

Cả 2 endpoint trả về **cùng schema** `EmployeeMonthlyReportResponse` — khác nhau chỉ ở scope truy vấn và kiểm soát quyền.

---

## TypeScript Types

```typescript
// types/reports-me.types.ts

export interface EmployeeMonthlyReportResponse {
  employee: {
    id: number;
    fullName: string;
    employeeCode: string;
    joinDate: string;              // ISO date, e.g. "2023-01-15"
    // ⚠ Endpoint NÀY trả ISO datetime đầy đủ ("2026-09-18T00:00:00.000Z"), giống `joinDate`
    // ngay trên. Khác với `GET /v1/employees/:id` và `/v1/reports/attendance` — hai chỗ đó
    // trả "YYYY-MM-DD". FE phải parse được cả hai dạng.
    terminationDate: string | null; // ngày nghỉ việc, null nếu đang làm
    status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
    position: string | null;
    department: string | null;
    contractType: 'PROBATION' | 'FIXED_TERM' | 'INDEFINITE' | 'SEASONAL' | null;
  };
  period: { month: number; year: number };
  attendance: {
    workingDays: number;       // công định mức = tổng ngày có ca làm việc trong tháng
    actualWorkDays: number;    // công thực tế (PRESENT + LATE, KHÔNG gồm công tác)
    businessTripDays: number;  // ngày công tác (workType=BUSINESS_TRIP)
    annualLeaveDays: number;   // phép năm hưởng lương (P) — ĐÃ GỒM cả nghỉ nửa ngày
    unpaidLeaveDays: number;   // nghỉ không lương (KL) — gồm cả phép năm vượt số dư
    welfareLeaveDays: number;  // nghỉ chế độ (R)
    halfDayLeaveDays: number;  // TẬP CON của annualLeaveDays — trong đó bao nhiêu là nửa ngày
    publicHolidayDays: number; // nghỉ lễ rơi vào workDay
    totalPayrollDays: number;  // tổng công tính lương
    totalActualDays: number;   // tổng công ăn ca (= actualWorkDays + số ngày online T7)
  };
  overtime: {
    normalHours: number;         // OT ngày thường (rate 150)
    sundayHours: number;         // OT chủ nhật (rate 200)
    holidayOnlineHours: number;  // OT ngày lễ online (rate 300)
    holidayOfflineHours: number; // OT ngày lễ offline (rate 300)
    totalHours: number;
  };
  violations: {
    lateCount: number;         // số ngày công còn đi muộn
    earlyCount: number;        // số ngày công còn về sớm
    forgotCheckCount: number;  // số ngày công thiếu lần chấm chưa được xử lý
    totalCount: number;
  };
}

export interface QueryMonthlyReportParams {
  month: number; // bắt buộc, 1-12
  year: number;  // bắt buộc, >= 2020
}
```

---

## GET /v1/reports/my/monthly — Báo cáo công tháng cá nhân

**Query params:** `?month=7&year=2026`

Nhân viên tự xem báo cáo công + OT + vi phạm của mình trong 1 tháng. **Không giới hạn role** — mọi user đã đăng nhập đều gọi được (chỉ trả dữ liệu của bản thân từ `user.id` trong JWT).

**Response:** `ApiSuccess<EmployeeMonthlyReportResponse>`

```json
{
  "success": true,
  "data": {
    "employee": {
      "id": 4,
      "fullName": "Nguyễn Văn An",
      "employeeCode": "EMP004",
      "joinDate": "2023-01-15",
      "terminationDate": null,   // khi đã nghỉ: "2026-09-18T00:00:00.000Z"
      "status": "ACTIVE",
      "position": "Software Engineer",
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
      "halfDayLeaveDays": 0.5,
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

## GET /v1/reports/employees/:employeeId/monthly — HR/Admin/Director/Manager/Chief xem 1 nhân viên

**Query params:** `?month=7&year=2026`

**Roles:** `ADMIN`, `HR`, `DIRECTOR`, `MANAGER`, `CHIEF`.
- `ADMIN` / `HR` / `DIRECTOR` / `CHIEF`: xem mọi nhân viên.
- `MANAGER`: chỉ xem được nhân viên thuộc phòng ban mà mình đang là `Department.managerId`. Nếu không phải quản lý phòng ban nào hoặc target không thuộc phòng ban đó → **403**.

Response schema **giống hệt** `/my/monthly` (`EmployeeMonthlyReportResponse`).

---

## Công thức tính

### Attendance

| Field | Nguồn |
|-------|-------|
| `workingDays` | Đếm số ngày có `EmployeeShiftSchedule` trong `[startDate, endDate]`, loại trừ `PublicHoliday`. **Bỏ qua `defaultShift`** — nhân viên không có schedule nào trong tháng → `workingDays = 0`. Không cắt theo `today`. |
| `actualWorkDays` | Đếm `AttendanceRecord` có `status IN (PRESENT, LATE)` **loại trừ** `workType = 'BUSINESS_TRIP'` |
| `businessTripDays` | Đếm `AttendanceRecord` có `status IN (PRESENT, LATE)` và `workType = 'BUSINESS_TRIP'` (tách riêng, không chồng lấn với `actualWorkDays`) |
| `annualLeaveDays` | Sum **`paidDays`** (KHÔNG phải `totalDays`) của đơn `ANNUAL` **và** `HALF_DAY` `APPROVED` — nghỉ nửa ngày trừ vào chính quỹ phép năm. Đơn vượt số dư bị `LeaveSplitService` cắt thành KL nên `paidDays = 0` → không tính công lương |
| `halfDayLeaveDays` | Sum `paidDays` của riêng đơn `HALF_DAY` — **tập con** của `annualLeaveDays`. Nửa ngày hết quỹ có `paidDays = 0` nên không vào đây, mà rơi sang `unpaidLeaveDays` với ký hiệu `KL/X` |
| `welfareLeaveDays` | Sum `paidDays` của đơn `WELFARE` `APPROVED` |
| `unpaidLeaveDays` | Sum **`unpaidDays` của TẤT CẢ đơn** `APPROVED` — gồm đơn loại `UNPAID` lẫn phần vượt số dư của đơn phép năm |
| `publicHolidayDays` | Đếm `PublicHoliday` trong tháng rơi vào ngày nhân viên có `EmployeeShiftSchedule` |
| `totalPayrollDays` | `actualWorkDays + annualLeaveDays + welfareLeaveDays + publicHolidayDays + businessTripDays + onlineDays` — `halfDayLeaveDays` đã nằm trong `annualLeaveDays` nên không cộng lại |
| `totalActualDays` | `= actualWorkDays` + số ngày online T7 (công ăn ca) |

> `unpaidLeaveDays` **không** cộng vào `totalPayrollDays` — nghỉ KL không được tính công lương.
> Công thức tính công tập trung trong `AttendanceCalculationService` (module `reports`), có thể dùng lại cho payroll/module khác.

### Overtime (từ `OvertimeSegment`)

Chỉ tính segment thuộc `OvertimeRequest` có `status=APPROVED`, `segmentDate` trong tháng:

| Điều kiện | Field |
|-----------|-------|
| `otRate = 150` | `normalHours` (ngày thường) |
| `otRate = 200` | `sundayHours` (chủ nhật) |
| `otRate = 300` + `mode = 'ONLINE'` | `holidayOnlineHours` (ngày lễ, online) |
| `otRate = 300` + `mode = 'OFFLINE'` | `holidayOfflineHours` (ngày lễ, offline) |

`mode` = `finalWorkMode ?? workMode` (finalWorkMode được set sau khi cron resolve GPS validation cho đơn OFFLINE). Số giờ làm tròn 2 chữ số thập phân.

### Vi phạm chấm công

- `lateCount` — số **ngày công** còn `lateMinutes > 0` trên `AttendanceRecord`.
- `earlyCount` — số **ngày công** còn `earlyMinutes > 0`.
- `forgotCheckCount` — số **ngày công** còn thiếu lần chấm mà chưa được xử lý (symbol `X/2 (Q)`, hoặc ngày không chấm lần nào và không có đơn bù).
- `totalCount` = tổng 3 bucket (1 ngày vừa muộn vừa về sớm được tính vào cả 2).

Vì sao lấy `AttendanceRecord` chứ không phải `ViolationRequest`: mọi cơ chế "tha lỗi" đều đã ghi ngược vào record trước đó —
`ViolationRequest` APPROVED reset `lateMinutes`/`earlyMinutes` về 0 và điền `checkInAt`/`checkOutAt` theo ca;
`MakeupAttendanceRequest` APPROVED được tính vào `approvedMakeupCount`; đơn xin đi muộn/về sớm APPROVED đã được trừ ngay lúc check-in.
Phần còn sót lại trên record chính là vi phạm thật, **kể cả khi nhân viên không nộp đơn giải trình nào**.

Phạm vi đếm: chỉ ngày có `EmployeeShiftSchedule`, không phải ngày lễ, và có phát sinh công offline.
Ngày công tác (`CT`), online (`OL` / `OL/2`), nghỉ phép cả ngày (`P`) không nằm trong 3 bucket này.

⚠️ KHÔNG dùng `missingType` để nhận diện quên chấm — field này không bao giờ được clear khi duyệt giải trình/bù chấm.

---

## Edge Cases

| Tình huống | Kết quả |
|-----------|---------|
| `month=0` hoặc `month=13` | **400** — `Tháng không hợp lệ (1-12)` |
| `year < 2020` hoặc `> currentYear + 1` | **400** — `Năm không hợp lệ` |
| Query param không phải số (`month=abc`) | **400** — `ParseIntPipe` reject |
| `/my/monthly` không kèm `Authorization` | **401** |
| `/employees/:id/monthly` khi user là `EMPLOYEE` | **403** — RolesGuard chặn |
| `MANAGER` gọi `/employees/:id/monthly` cho nhân viên ngoài phòng ban đang manage | **403** — `Không có quyền xem báo cáo nhân viên này` |
| `MANAGER` không phải `Department.managerId` của phòng nào | **403** — kể cả khi target ở cùng `departmentId` với manager |
| `employeeId` không tồn tại | **404** — `Nhân viên không tồn tại` |
| Nhân viên không có `EmployeeShiftSchedule` nào trong tháng | `workingDays = 0` (không dùng `defaultShift` fallback) |
| Nhân viên không có `Contract` ACTIVE | `contractType = null` |
| Nhân viên không có OT/leave/violation trong tháng | Tất cả counter = 0, response vẫn 200 |
| Tháng chưa kết thúc | `workingDays` vẫn tính hết tháng (công định mức của tháng, không cắt theo hôm nay); các counter thực tế đếm theo record hiện có |

---

## Composable — useMyReport

```typescript
// composables/useMyReport.ts
import type {
  EmployeeMonthlyReportResponse,
  QueryMonthlyReportParams,
} from '~/types/reports-me.types';

export function useMyReport() {
  const fetchMyMonthlyReport = (params: QueryMonthlyReportParams) =>
    $fetch<{ success: true; data: EmployeeMonthlyReportResponse }>(
      '/v1/reports/my/monthly',
      { params },
    ).then((r) => r.data);

  const fetchEmployeeMonthlyReport = (
    employeeId: number,
    params: QueryMonthlyReportParams,
  ) =>
    $fetch<{ success: true; data: EmployeeMonthlyReportResponse }>(
      `/v1/reports/employees/${employeeId}/monthly`,
      { params },
    ).then((r) => r.data);

  return { fetchMyMonthlyReport, fetchEmployeeMonthlyReport };
}
```

**Ví dụ dùng trong component:**

```vue
<script setup lang="ts">
import type { EmployeeMonthlyReportResponse } from '~/types/reports-me.types'

const { fetchMyMonthlyReport } = useMyReport()

const now = new Date()
const report = ref<EmployeeMonthlyReportResponse | null>(null)

async function load() {
  report.value = await fetchMyMonthlyReport({
    month: now.getMonth() + 1,
    year:  now.getFullYear(),
  })
}

onMounted(load)
</script>

<template>
  <div v-if="report">
    <h2>{{ report.employee.fullName }} — {{ report.period.month }}/{{ report.period.year }}</h2>
    <p>Công thực tế: {{ report.attendance.actualWorkDays }} / {{ report.attendance.workingDays }}</p>
    <p>Tổng công tính lương: {{ report.attendance.totalPayrollDays }}</p>
    <p>OT tổng: {{ report.overtime.totalHours }}h</p>
    <p>Vi phạm bị từ chối: {{ report.violations.totalCount }}</p>
  </div>
</template>
```
