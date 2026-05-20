# Bridge Docs — Báo cáo (`/v1/reports`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/reports/attendance` | `ADMIN`, `HR`, `MANAGER` | Báo cáo chấm công theo tháng |
| GET | `/v1/reports/attendance/export` | `ADMIN`, `HR`, `MANAGER` | Tải file `.xlsx` bảng công |
| GET | `/v1/reports/leave` | `ADMIN`, `HR`, `MANAGER` | Báo cáo nghỉ phép theo năm / tháng |
| GET | `/v1/reports/leave/export` | `ADMIN`, `HR`, `MANAGER` | Tải file `.xlsx` thống kê nghỉ phép |
| GET | `/v1/reports/summary` | `ADMIN`, `HR` | Thống kê tổng quan toàn công ty |

> `EMPLOYEE` và `MANAGER` gọi `/summary` → **403**. Chỉ HR và Admin xem được số liệu toàn công ty.

---

## TypeScript Types

```typescript
// types/reports.types.ts

export interface AttendanceReportResponse {
  employeeId: number;
  employeeCode: string;        // "EMP001"
  fullName: string;
  departmentName: string | null;
  positionName: string | null;
  totalWorkDays: number;       // tổng ngày làm việc trong tháng (trừ Thứ 7, Chủ nhật)
  presentDays: number;         // số ngày có mặt đúng giờ
  lateDays: number;            // số ngày đi muộn
  absentDays: number;          // số ngày vắng
  onLeaveDays: number;         // số ngày nghỉ phép được duyệt
  totalLateMinutes: number;    // tổng phút đi muộn cộng dồn
  totalEarlyMinutes: number;   // tổng phút về sớm cộng dồn
  attendanceRate: number;      // % = (presentDays + lateDays) / totalWorkDays * 100
}

export interface LeaveReportResponse {
  employeeId: number;
  employeeCode: string;
  fullName: string;
  departmentName: string | null;
  leaveTypeName: string;       // "Nghỉ phép năm"
  leaveTypeCode: string;       // "ANNUAL"
  totalRequests: number;       // tổng đơn (mọi trạng thái)
  approvedRequests: number;    // đơn đã duyệt
  totalDaysApproved: number;   // tổng ngày được duyệt (tính từ các đơn APPROVED)
  pendingRequests: number;     // đơn đang chờ duyệt
  remainingBalance: number | null; // null nếu loại phép không có hạn mức (daysPerYear = null)
}

export interface SummaryStatsResponse {
  totalEmployees: number;              // tổng nhân viên đang ACTIVE
  presentToday: number;                // chấm công PRESENT hôm nay
  lateToday: number;                   // chấm công LATE hôm nay
  absentToday: number;                 // chấm công ABSENT hôm nay
  pendingLeaveRequests: number;        // đơn nghỉ phép đang chờ duyệt (toàn công ty)
  avgAttendanceRateThisMonth: number;  // % chuyên cần trung bình trong tháng
  topAbsentDepartment: string | null;  // phòng ban vắng nhiều nhất; null nếu chưa có dữ liệu
}

// Query params

export interface QueryAttendanceReportParams {
  year: number;           // bắt buộc, >= 2020
  month: number;          // bắt buộc, 1-12
  departmentId?: number;  // lọc theo phòng ban
  employeeId?: number;    // lọc theo 1 nhân viên cụ thể
}

export interface QueryLeaveReportParams {
  year: number;            // bắt buộc, >= 2020
  month?: number;          // tuỳ chọn, 1-12; bỏ qua → tổng hợp cả năm
  departmentId?: number;
  leaveTypeId?: number;
}

export interface QuerySummaryStatsParams {
  year: number;   // bắt buộc
  month: number;  // bắt buộc, 1-12
}
```

---

## GET /v1/reports/attendance — Báo cáo chấm công

**Query params:** `?year=2025&month=5&departmentId=1`

Trả về mảng — mỗi phần tử là thống kê chấm công của một nhân viên trong tháng.  
Kết quả đã sort: phòng ban A-Z → họ tên A-Z.

**Response:** `ApiSuccess<AttendanceReportResponse[]>`

```json
{
  "success": true,
  "data": [
    {
      "employeeId": 4,
      "employeeCode": "EMP004",
      "fullName": "Nguyễn Văn An",
      "departmentName": "Kỹ thuật",
      "positionName": "Software Engineer",
      "totalWorkDays": 22,
      "presentDays": 18,
      "lateDays": 2,
      "absentDays": 1,
      "onLeaveDays": 1,
      "totalLateMinutes": 35,
      "totalEarlyMinutes": 0,
      "attendanceRate": 90.9
    }
  ]
}
```

> `attendanceRate` được tính theo công thức: `(presentDays + lateDays) / totalWorkDays * 100`.  
> Nhân viên đi muộn vẫn được tính là đã đi làm — không bị trừ vào tỷ lệ chuyên cần.

---

## GET /v1/reports/leave — Báo cáo nghỉ phép

**Query params:** `?year=2025` hoặc `?year=2025&month=5&departmentId=1&leaveTypeId=2`

Trả về mảng — mỗi phần tử là thống kê nghỉ phép của một nhân viên theo từng **loại phép**.  
Một nhân viên có thể xuất hiện nhiều lần nếu có nhiều loại phép.

**Response:** `ApiSuccess<LeaveReportResponse[]>`

```json
{
  "success": true,
  "data": [
    {
      "employeeId": 4,
      "employeeCode": "EMP004",
      "fullName": "Nguyễn Văn An",
      "departmentName": "Kỹ thuật",
      "leaveTypeName": "Nghỉ phép năm",
      "leaveTypeCode": "ANNUAL",
      "totalRequests": 2,
      "approvedRequests": 1,
      "totalDaysApproved": 3,
      "pendingRequests": 1,
      "remainingBalance": 9
    },
    {
      "employeeId": 4,
      "employeeCode": "EMP004",
      "fullName": "Nguyễn Văn An",
      "departmentName": "Kỹ thuật",
      "leaveTypeName": "Nghỉ ốm",
      "leaveTypeCode": "SICK",
      "totalRequests": 1,
      "approvedRequests": 1,
      "totalDaysApproved": 1,
      "pendingRequests": 0,
      "remainingBalance": null
    }
  ]
}
```

> `remainingBalance = null` khi loại phép không có hạn mức (`daysPerYear = null`), ví dụ nghỉ ốm không giới hạn.  
> Lọc theo `month` dựa trên `startDate` của đơn nghỉ — đơn bắt đầu trong tháng mới được tính.

---

## GET /v1/reports/summary — Thống kê tổng quan

**Query params:** `?year=2025&month=5`

**Chỉ `ADMIN` và `HR`.** `MANAGER` gọi endpoint này nhận **403**.

**Response:** `ApiSuccess<SummaryStatsResponse>`

```json
{
  "success": true,
  "data": {
    "totalEmployees": 50,
    "presentToday": 45,
    "lateToday": 3,
    "absentToday": 2,
    "pendingLeaveRequests": 5,
    "avgAttendanceRateThisMonth": 92.5,
    "topAbsentDepartment": "Kinh doanh"
  }
}
```

> `presentToday` / `lateToday` / `absentToday` dựa trên ngày **hiện tại** khi gọi API, không phụ thuộc vào `year`/`month`.  
> `avgAttendanceRateThisMonth` và `topAbsentDepartment` tính theo `year`+`month` truyền vào.

---

## Export Endpoints — File nhị phân `.xlsx`

> **Hai endpoint `/attendance/export` và `/leave/export` không trả JSON.**  
> Response là file binary `.xlsx`. **Không** bọc trong `{ success, data }`.

### Headers response từ server

```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="bang-cong-5-2025.xlsx"
Content-Length: <bytes>
```

### Cách trigger download từ frontend (Nuxt / Vue)

```typescript
// Bảng công
const downloadAttendanceExcel = async (params: QueryAttendanceReportParams) => {
  const blob = await $fetch('/v1/reports/attendance/export', {
    params,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bang-cong-${params.month}-${params.year}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};

// Thống kê nghỉ phép
const downloadLeaveExcel = async (params: QueryLeaveReportParams) => {
  const blob = await $fetch('/v1/reports/leave/export', {
    params,
    responseType: 'blob',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `thong-ke-nghi-phep-${params.year}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};
```

### Cấu trúc file Excel bảng công

| Cột | Key | Ghi chú |
|-----|-----|---------|
| Mã NV | `employeeCode` | |
| Họ tên | `fullName` | |
| Phòng ban | `departmentName` | |
| Chức vụ | `positionName` | |
| Đi làm | `presentDays` | |
| Đi muộn | `lateDays` | |
| Vắng | `absentDays` | |
| Nghỉ phép | `onLeaveDays` | |
| Phút muộn | `totalLateMinutes` | |
| Phút sớm | `totalEarlyMinutes` | |
| Tỷ lệ (%) | `attendanceRate` | Đỏ đậm nếu < 80%, cam nếu < 90% |

Dòng cuối là hàng **TỔNG CỘNG** (nền xanh nhạt).

### Cấu trúc file Excel nghỉ phép

| Cột | Key |
|-----|-----|
| Mã NV | `employeeCode` |
| Họ tên | `fullName` |
| Phòng ban | `departmentName` |
| Loại phép | `leaveTypeName` |
| Tổng đơn | `totalRequests` |
| Đã duyệt | `approvedRequests` |
| Tổng ngày | `totalDaysApproved` |
| Còn lại | `remainingBalance` |

---

## Composable — useReports

```typescript
// composables/useReports.ts
import type {
  AttendanceReportResponse,
  LeaveReportResponse,
  SummaryStatsResponse,
  QueryAttendanceReportParams,
  QueryLeaveReportParams,
  QuerySummaryStatsParams,
} from '~/types/reports.types';

export function useReports() {
  const fetchAttendanceReport = (params: QueryAttendanceReportParams) =>
    $fetch<{ success: true; data: AttendanceReportResponse[] }>('/v1/reports/attendance', {
      params,
    }).then((r) => r.data);

  const fetchLeaveReport = (params: QueryLeaveReportParams) =>
    $fetch<{ success: true; data: LeaveReportResponse[] }>('/v1/reports/leave', {
      params,
    }).then((r) => r.data);

  const fetchSummaryStats = (params: QuerySummaryStatsParams) =>
    $fetch<{ success: true; data: SummaryStatsResponse }>('/v1/reports/summary', {
      params,
    }).then((r) => r.data);

  const exportAttendanceExcel = async (params: QueryAttendanceReportParams) => {
    const blob = await $fetch<Blob>('/v1/reports/attendance/export', {
      params,
      responseType: 'blob',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bang-cong-${params.month}-${params.year}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportLeaveExcel = async (params: QueryLeaveReportParams) => {
    const blob = await $fetch<Blob>('/v1/reports/leave/export', {
      params,
      responseType: 'blob',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `thong-ke-nghi-phep-${params.year}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return {
    fetchAttendanceReport,
    fetchLeaveReport,
    fetchSummaryStats,
    exportAttendanceExcel,
    exportLeaveExcel,
  };
}
```

---

## Edge Cases

| Tình huống | Kết quả |
|-----------|---------|
| `month=0` hoặc `month=13` | **400** — validation reject |
| `year=2019` | **400** — `year` phải >= 2020 |
| `employeeId` không tồn tại | **200** — trả mảng rỗng `[]` |
| `departmentId` không có nhân viên nào ACTIVE | **200** — trả mảng rỗng `[]` |
| Nhân viên không có record chấm công nào trong tháng | Vẫn xuất hiện trong báo cáo, tất cả counter = 0, `attendanceRate = 0` |
| `remainingBalance` trong leave report | `null` nếu loại phép không có `daysPerYear` (nghỉ ốm không giới hạn v.v.) |
| `MANAGER` gọi `/summary` | **403** |
| Export file với công ty > 500 nhân viên | File được tạo server-side — có thể mất 5–10 giây; nên thêm loading state và đặt timeout phía client >= 30s |
| Gọi export không có `Authorization` header | **401** — response vẫn là JSON `{ success: false, error: {...} }`, không phải blob; cần handle lỗi trước khi `createObjectURL` |
