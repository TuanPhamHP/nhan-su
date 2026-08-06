# FE Agent Prompt — Xuất bảng công tháng cho toàn nhân sự (Excel)

## Context

Trước đây báo cáo công tháng chỉ có ở dạng JSON per-employee (`GET /v1/reports/employees/:employeeId/monthly`) — HR muốn xem tổng hợp toàn công ty phải mở từng nhân viên. BE vừa expose 1 endpoint export Excel mới trả về **1 file .xlsx** chứa toàn bộ chỉ số công tháng của tất cả nhân viên trong 1 sheet.

Các cột trong file khớp **chính xác** với response của `GET /v1/reports/employees/:employeeId/monthly` — cùng công thức tính, cùng semantics. Xem [`_fe-prompt-employee-monthly-report.md`](./_fe-prompt-employee-monthly-report.md) nếu cần chi tiết ý nghĩa từng field.

**KHÔNG có endpoint JSON list.** Muốn xem trên UI dạng bảng, FE phải parse Excel hoặc call endpoint per-employee. Endpoint này chỉ để download.

---

## Endpoint

```
GET /v1/reports/employees/monthly/export?month=<1-12>&year=<>=2020>[&departmentId=<>][&search=<>]
```

Response type: **binary** (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`), không phải JSON, không có envelope `{ success, data }`.

---

## Auth

- Header `Authorization: Bearer <accessToken>` bắt buộc.
- Role được phép: `ADMIN`, `HR`, `DIRECTOR`, `MANAGER`, `CHIEF`.
- `EMPLOYEE` → **403** từ RolesGuard.
- **`MANAGER` được auto-scope theo phòng ban mình quản lý** (`Department.managerId = user.id`):
  - Nếu không truyền `departmentId` → BE tự set `departmentId = phòng ban đang manage`.
  - MANAGER chưa được gán phòng ban → **403** `"Manager chưa được gán phòng ban để xem báo cáo"`.
  - MANAGER truyền `departmentId` khác phòng của mình → BE hiện tại **không chặn** (dùng đúng giá trị FE gửi). FE nên khoá dropdown chỉ hiện phòng của MANAGER.
- `ADMIN`, `HR`, `DIRECTOR`, `CHIEF` không bị scope — không truyền `departmentId` = xem tất cả phòng.

---

## Query params

| Name | Type | Required | Mô tả |
|---|---|---|---|
| `month` | number (1–12) | ✅ | Tháng |
| `year` | number (≥2020, ≤ currentYear+1) | ✅ | Năm |
| `departmentId` | number (≥1) | ❌ | Lọc theo 1 phòng ban. Nếu bỏ trống + role không phải MANAGER → toàn công ty. |
| `search` | string | ❌ | Tìm theo họ tên (unaccent + ILIKE) hoặc mã NV (ILIKE). Substring, không phân biệt dấu/hoa thường. |

Ví dụ URL:
- `?month=7&year=2026` → toàn công ty
- `?month=7&year=2026&departmentId=3` → 1 phòng
- `?month=7&year=2026&search=nguyen` → tất cả NV có tên/mã match "nguyen"

---

## Response — cấu trúc file Excel

**1 sheet** tên `Bang cong tong hop {month}-{year}`. Nhân viên được **group theo phòng ban**, mỗi phòng có 1 hàng separator (nền xanh nhạt, in đậm tên phòng). Cuối bảng có hàng **TỔNG CỘNG** cộng tất cả cột số.

### Header 3 dòng (freeze rows 1-3, freeze cột A-B)

- **Row 1** — group header (English): `Employee` · `Attendance (days)` · `Overtime (hours)` · `Violations (count)`
- **Row 2** — sub-header English từng cột.
- **Row 3** — nhãn tiếng Việt từng cột.

### 24 cột dữ liệu

| # | Cột (VN) | Kiểu | Nguồn từ `EmployeeMonthlyReportResponse` |
|---|---|---|---|
| A | Mã NV | string | `employee.employeeCode` |
| B | Họ và tên | string | `employee.fullName` |
| C | Phòng ban | string | `employee.department` |
| D | Chức vụ | string | `employee.position` |
| E | Loại HĐ | enum string | `employee.contractType` (`INDEFINITE`/`FIXED_TERM`/`PROBATION`/`SEASONAL` hoặc rỗng) |
| F | Ngày vào | date | `employee.joinDate` — format `dd/mm/yyyy` |
| G | Định mức | number | `attendance.workingDays` |
| H | Thực tế | number (có thể `.5`) | `attendance.actualWorkDays` |
| I | Công tác | number (có thể `.5`) | `attendance.businessTripDays` |
| J | Phép năm | number | `attendance.annualLeaveDays` |
| K | Không lương | number | `attendance.unpaidLeaveDays` |
| L | Chế độ | number | `attendance.welfareLeaveDays` |
| M | Ngày lễ | number | `attendance.publicHolidayDays` |
| N | Tổng tính lương | number | `attendance.totalPayrollDays` |
| O | Tổng ăn ca | number | `attendance.totalActualDays` |
| P | OT ngày thường | number (giờ) | `overtime.normalHours` |
| Q | OT cuối tuần | number (giờ) | `overtime.sundayHours` |
| R | OT lễ Online | number (giờ) | `overtime.holidayOnlineHours` |
| S | OT lễ Offline | number (giờ) | `overtime.holidayOfflineHours` |
| T | Tổng OT | number (giờ) | `overtime.totalHours` |
| U | Đi muộn | number | `violations.lateCount` |
| V | Về sớm | number | `violations.earlyCount` |
| W | Quên CC | number | `violations.forgotCheckCount` |
| X | Tổng VP | number | `violations.totalCount` |

### Tên file gợi ý

BE set `Content-Disposition: attachment; filename="bang-cong-thang-{month}-{year}.xlsx"`. FE nên tôn trọng filename này (dùng `response.headers['content-disposition']`) hoặc override thành `bang-cong-thang-<năm>-<tháng>-<departmentName>.xlsx` nếu user filter theo phòng.

---

## Errors

| HTTP | Body | Khi nào |
|---|---|---|
| 400 | `{ success: false, error: { message: "Tháng không hợp lệ (1-12)" } }` | `month` < 1 hoặc > 12 |
| 400 | `{ success: false, error: { message: "Năm không hợp lệ" } }` | `year` < 2020 hoặc > currentYear+1 |
| 401 | envelope error | Thiếu / sai / expired token |
| 403 | code `FORBIDDEN` | Role không thuộc {ADMIN, HR, DIRECTOR, MANAGER, CHIEF} |
| 403 | `"Manager chưa được gán phòng ban để xem báo cáo"` | MANAGER không có Department.managerId trỏ về mình |

⚠️ Khi trả lỗi, BE **không** trả binary — trả JSON envelope. FE cần detect `Content-Type: application/json` để parse error message thay vì mở file rỗng.

---

## Checklist FE

### Layer service/composable

- [ ] Type `QueryEmployeesMonthlyExportParams`:
  ```typescript
  export interface QueryEmployeesMonthlyExportParams {
    month: number;
    year: number;
    departmentId?: number;
    search?: string;
  }
  ```
- [ ] Function `downloadEmployeesMonthlyExcel(params)`:
  - Call với `responseType: 'blob'` (axios) hoặc equivalent (fetch → `.blob()`).
  - Nếu response `Content-Type` là `application/json` → parse blob về JSON, throw error message cho UI.
  - Nếu `Content-Type` đúng xlsx MIME → trigger download bằng `URL.createObjectURL(blob)` + `<a download>`.
  - Extract filename từ header `Content-Disposition` (regex `filename="([^"]+)"`) hoặc fallback `bang-cong-thang-{month}-{year}.xlsx`.

### UI

- [ ] Thêm nút **"Xuất Excel"** trong màn "Bảng công tháng" hoặc "Báo cáo nhân sự".
- [ ] Form filter: month/year picker (bắt buộc), department dropdown (optional), search input (optional).
  - MANAGER → khoá department dropdown chỉ hiện phòng của mình (call `/v1/employees/me` lấy `departmentId` hoặc BE endpoint tương đương). Có thể ẩn hẳn dropdown, tự truyền `departmentId`.
- [ ] Loading state khi đang download (endpoint có thể mất **1-2s** với ~50 nhân viên).
- [ ] Nếu response lỗi (json) → hiển thị toast với `error.message`.

### Error handling

- [ ] 400 (validation) → hiển thị toast + không close form filter.
- [ ] 403 MANAGER không có phòng → hiện thông báo "Bạn chưa được gán phòng ban, liên hệ HR".
- [ ] Network fail → toast "Không tải được báo cáo, thử lại".

### Không cần làm

- [ ] KHÔNG render bảng preview trên UI — endpoint chỉ trả file. Nếu cần preview, gọi `/v1/reports/employees/:id/monthly` per employee.
- [ ] KHÔNG parse Excel client-side để hiển thị — quá phức tạp, cost không worth so với call JSON.
- [ ] KHÔNG cần cache — export là action on-demand.
- [ ] KHÔNG tự tính lại tổng cột — BE đã write hàng TỔNG CỘNG trong file.

---

## Ghi chú thêm

- Số ngày (`actualWorkDays`, `businessTripDays`) có thể là **số thập phân `.5`** khi có half-day leave hoặc quên chấm công nửa ngày — đây là behavior đúng (đồng bộ với symbol trong Detail export). Không phải bug.
- OT `totalHours` là **raw hours** chưa nhân hệ số (150/200/300%). "Giờ trả lương" cần tính từ 4 bucket riêng biệt × rate ở FE nếu cần.
- `violations` chỉ đếm đơn giải trình **bị từ chối** (nhân viên có lỗi thật). Đơn APPROVED không tính.
- Tất cả tính theo giờ VN (UTC+7), không cần convert TZ.
- Nhân viên vừa join chưa có schedule/attendance → cột số toàn 0 (không skip khỏi bảng).
- BE query trong Excel export không phân trang — nếu công ty lên 500+ NV thì thời gian generate có thể lên 10s+, cần add spinner rõ ràng.
