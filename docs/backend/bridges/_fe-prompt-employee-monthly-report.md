# FE Agent Prompt — Tích hợp API báo cáo công tháng của 1 nhân viên

## Context

Backend expose 2 endpoint báo cáo công tháng dùng chung schema `EmployeeMonthlyReportResponse`:

| Endpoint | Ai gọi | Mục đích |
| --- | --- | --- |
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

| Name         | Type             | Required | Mô tả                        |
| ------------ | ---------------- | -------- | ---------------------------- |
| `employeeId` | number (int, ≥1) | ✅       | ID nhân viên cần xem báo cáo |

### Query

| Name    | Type                            | Required | Mô tả |
| ------- | ------------------------------- | -------- | ----- |
| `month` | number (1–12)                   | ✅       | Tháng |
| `year`  | number (≥2020, ≤ currentYear+1) | ✅       | Năm   |

---

## TypeScript types

```typescript
export type ContractType = 'PROBATION' | 'FIXED_TERM' | 'INDEFINITE' | 'SEASONAL';

/**
 * Ký hiệu ngày công — đồng bộ với bảng Detail export.
 *   X       = 1 công (đủ giờ)
 *   X/2     = 0.5 công (thiếu giờ hoặc 1 lần chấm nhờ đơn bù)
 *   X/2 (Q) = 0.5 công vì QUÊN chấm (chỉ 1 lần chấm, không có đơn bù APPROVED)
 *   CT      = 1 công tác cả ngày
 *   CT/X    = 0.5 công tác + 0.5 làm việc tại chỗ
 *   OL      = 1 ngày làm online (KHÔNG tính công ăn ca)
 *   P       = nghỉ phép năm cả ngày (paid)
 *   P/X     = nửa ngày nghỉ phép + nửa ngày làm
 *   P/2     = nửa ngày nghỉ không lương
 *   R       = nghỉ chế độ (WELFARE)
 *   L       = ngày lễ chính thức (rơi vào lịch làm)
 *   K       = vắng mặt (không phép)
 *   '0'     = có bản ghi nhưng không tính công (ví dụ đủ 2 lần chấm nhưng < 3h)
 */
export type MonthlyReportSymbol =
	| 'X'
	| 'X/2'
	| 'X/2 (Q)'
	| 'CT'
	| 'CT/X'
	| 'OL'
	| 'P'
	| 'P/X'
	| 'P/2'
	| 'R'
	| 'L'
	| 'K'
	| '0';

export interface MonthlyReportDayDetail {
	date: string; // "YYYY-MM-DD" (giờ VN)
	value: number; // 0 | 0.5 | 1 — số công đóng góp vào metric của mảng chứa nó
	symbol: MonthlyReportSymbol;
	reason: string; // Diễn giải tiếng Việt sẵn cho FE — hiển thị trực tiếp
}

export interface EmployeeMonthlyReportBreakdown {
	workingDays: MonthlyReportDayDetail[]; // tất cả ngày có lịch làm
	actualWorkDays: MonthlyReportDayDetail[]; // tất cả ngày có lịch + kết quả chấm (bao gồm cả value=0)
	onlineDays: MonthlyReportDayDetail[]; // chỉ ngày OL
	businessTripDays: MonthlyReportDayDetail[]; // chỉ ngày CT / CT/X
	annualLeaveDays: MonthlyReportDayDetail[]; // từng ngày trong đơn nghỉ phép năm APPROVED
	welfareLeaveDays: MonthlyReportDayDetail[]; // từng ngày nghỉ chế độ APPROVED
	unpaidLeaveDays: MonthlyReportDayDetail[]; // từng ngày nghỉ không lương APPROVED
	publicHolidayDays: MonthlyReportDayDetail[]; // ngày lễ rơi vào lịch làm
}

export interface EmployeeMonthlyReportResponse {
	employee: {
		id: number;
		fullName: string;
		employeeCode: string; // "EMP012"
		joinDate: string; // "YYYY-MM-DD"
		position: string | null; // tên chức vụ
		department: string | null; // tên phòng ban
		contractType: ContractType | null; // HĐ ACTIVE mới nhất
	};
	period: {
		month: number; // 1-12
		year: number;
	};
	attendance: {
		workingDays: number; // công định mức (ngày có schedule, loại lễ)
		actualWorkDays: number; // công thực tế (X=1, X/2=0.5, P/X=0.5, CT/X=0.5; KHÔNG gồm CT, OL, nghỉ)
		businessTripDays: number; // ngày công tác (CT=1, CT/X=0.5)
		onlineDays: number; // ngày OL (ONLINE_APPROVED / ONLINE_T7 / ca isOnline=true không clock)
		annualLeaveDays: number; // nghỉ phép năm APPROVED
		unpaidLeaveDays: number; // nghỉ không lương APPROVED
		welfareLeaveDays: number; // nghỉ chế độ APPROVED
		publicHolidayDays: number; // ngày lễ rơi vào schedule → tính công lương
		totalPayrollDays: number; // actual + annual + welfare + publicHoliday + businessTrip + online (KHÔNG cộng unpaid)
		totalActualDays: number; // = actualWorkDays (alias cũ, giữ backward-compat)
		mealAllowanceDays: number; // = actualWorkDays (alias rõ nghĩa "tổng công tính ăn ca")
		breakdown: EmployeeMonthlyReportBreakdown;
	};
	overtime: {
		normalHours: number; // OT ngày thường (rate 150%)
		sundayHours: number; // OT chủ nhật (rate 200%)
		holidayOnlineHours: number; // OT ngày lễ online (rate 300%)
		holidayOfflineHours: number; // OT ngày lễ tại VP (rate 300%)
		totalHours: number; // tổng 4 bucket, làm tròn 2 chữ số
	};
	violations: {
		lateCount: number; // giải trình LATE bị REJECTED
		earlyCount: number; // giải trình EARLY bị REJECTED
		forgotCheckCount: number; // FORGOT_CHECKIN + FORGOT_CHECKOUT bị REJECTED
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
			"workingDays": 27,
			"actualWorkDays": 18.5,
			"businessTripDays": 1,
			"onlineDays": 4,
			"annualLeaveDays": 0,
			"unpaidLeaveDays": 0,
			"welfareLeaveDays": 0,
			"publicHolidayDays": 0,
			"totalPayrollDays": 23.5,
			"totalActualDays": 18.5,
			"mealAllowanceDays": 18.5,
			"breakdown": {
				"workingDays": [
					{
						"date": "2026-07-01",
						"value": 1,
						"symbol": "X",
						"reason": "Có lịch làm việc trong tháng (EmployeeShiftSchedule)"
					},
					{
						"date": "2026-07-02",
						"value": 1,
						"symbol": "X",
						"reason": "Có lịch làm việc trong tháng (EmployeeShiftSchedule)"
					}
				],
				"actualWorkDays": [
					{
						"date": "2026-07-01",
						"value": 1,
						"symbol": "X",
						"reason": "Đủ 2 lần chấm, tổng giờ làm 8h ≥ 6h → đủ công"
					},
					{
						"date": "2026-07-07",
						"value": 0.5,
						"symbol": "X/2 (Q)",
						"reason": "Chỉ có 1 lần chấm (quên chấm in/out) — chưa có đơn bù chấm APPROVED, tính nửa công"
					},
					{ "date": "2026-07-10", "value": 0, "symbol": "K", "reason": "Vắng mặt không phép" }
				],
				"onlineDays": [
					{
						"date": "2026-07-04",
						"value": 1,
						"symbol": "OL",
						"reason": "Ca online — làm việc từ xa, không cần chấm công (không tính công ăn ca)"
					}
				],
				"businessTripDays": [
					{ "date": "2026-07-10", "value": 1, "symbol": "CT", "reason": "Đi công tác cả ngày (không cần chấm công)" }
				],
				"annualLeaveDays": [],
				"welfareLeaveDays": [],
				"unpaidLeaveDays": [],
				"publicHolidayDays": []
			}
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

### `attendance` (tất cả là số ngày, có thể có `.5` do half-day leave hoặc quên chấm 1 lần)

- `workingDays` — Công định mức = số ngày trong tháng có `EmployeeShiftSchedule`, loại trừ ngày lễ. Nhân viên chưa có schedule → 0.
- `actualWorkDays` — **Công thực tế / công ăn ca**. Tính per-day theo bảng ký hiệu (X=1, X/2=0.5, X/2 (Q)=0.5, P/X=0.5, CT/X=0.5). **KHÔNG** gồm CT nguyên ngày, OL, và các loại nghỉ.
- `businessTripDays` — Ngày công tác (CT=1 nguyên ngày, CT/X=0.5 nửa ngày).
- `onlineDays` — Ngày làm online (OL=1). Áp dụng cho: `workType ∈ {ONLINE_APPROVED, ONLINE_T7}` không clock, hoặc `shift.isOnline=true` PRESENT không clock. **Được cộng vào `totalPayrollDays` nhưng KHÔNG cộng vào `actualWorkDays`** — online không tính công ăn ca.
- `annualLeaveDays` / `unpaidLeaveDays` / `welfareLeaveDays` — Sum `totalDays` của `LeaveRequest` status APPROVED theo `leaveType.code`.
- `publicHolidayDays` — Số `PublicHoliday` **rơi vào ngày có schedule** của nhân viên (chỉ tính lễ mà nhân viên phải đi làm theo lịch).
- `totalPayrollDays` = `actualWorkDays + annualLeaveDays + welfareLeaveDays + publicHolidayDays + businessTripDays + onlineDays`. **UNPAID không cộng.**
- `totalActualDays` = `actualWorkDays` (alias cũ, giữ backward-compat).
- `mealAllowanceDays` = `actualWorkDays` — **Tổng công tính ăn ca**. Alias rõ nghĩa cho FE hiển thị dòng "Tổng công tính ăn ca". Chỉ số công ngày offline có mặt (không gồm CT, OL, phép, lễ).

### `attendance.breakdown` (chi tiết per-day cho click-to-drill-down)

Mỗi metric ở trên có 1 mảng breakdown tương ứng để user click vào dòng → xem chi tiết từng ngày đóng góp bao nhiêu và vì sao.

**Cấu trúc entry:**

- `date` — VN date key `YYYY-MM-DD`.
- `value` — số công đóng góp vào metric chứa mảng này (0, 0.5, hoặc 1). Sum `value` của tất cả entry trong mảng = metric tổng tương ứng.
- `symbol` — ký hiệu ngày công theo bảng Detail export (xem `MonthlyReportSymbol` ở TypeScript types).
- `reason` — diễn giải tiếng Việt sẵn, hiển thị trực tiếp không cần dịch/format.

**Quy ước từng mảng:**

- `breakdown.workingDays` — mọi ngày có `EmployeeShiftSchedule` (không tính ngày lễ). Tất cả `value=1`, `symbol='X'`.
- `breakdown.actualWorkDays` — **tất cả** ngày có schedule, bao gồm cả `value=0` (OL, CT, K, không có record). Mảng này giúp user hiểu "vì sao tổng thấp hơn workingDays" — thấy rõ ngày nào quên chấm, ngày nào online, ngày nào vắng.
- `breakdown.onlineDays` / `breakdown.businessTripDays` — chỉ liệt kê ngày thực sự đóng góp (`value > 0`).
- `breakdown.annualLeaveDays` / `welfareLeaveDays` / `unpaidLeaveDays` — expand từng ngày trong đơn nghỉ APPROVED tương ứng. Half-day → `value=0.5`.
- `breakdown.publicHolidayDays` — mỗi ngày lễ rơi vào lịch làm, `reason` chứa tên ngày lễ (ví dụ "Ngày lễ: Quốc khánh 2/9").

⚠️ **Invariant**: sum `entry.value` trong mỗi mảng luôn khớp với metric tổng tương ứng. FE có thể assert hoặc dùng để verify UI.

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

| HTTP | Body message                                 | Khi nào                                                |
| ---- | -------------------------------------------- | ------------------------------------------------------ |
| 400  | `"Tháng không hợp lệ (1-12)"`                | `month` < 1 hoặc > 12                                  |
| 400  | `"Năm không hợp lệ"`                         | `year` < 2020 hoặc > currentYear+1                     |
| 401  | envelope error                               | Thiếu / sai / expired token                            |
| 403  | code `FORBIDDEN`                             | Role không thuộc {ADMIN, HR, DIRECTOR, MANAGER, CHIEF} |
| 403  | `"Không có quyền xem báo cáo nhân viên này"` | MANAGER cố xem nhân viên ngoài phòng ban đang manage   |
| 404  | `"Nhân viên không tồn tại"`                  | `employeeId` không có trong DB                         |

---

## Checklist FE

### Layer service/composable

- [ ] Type `EmployeeMonthlyReportResponse` như block TypeScript ở trên — đưa vào `types/report.types.ts` (hoặc file dùng chung).
- [ ] Composable `useEmployeeMonthlyReport(employeeId, month, year)` gọi endpoint, cache theo key `${employeeId}-${year}-${month}`.
- [ ] Xử lý unwrap `.data` từ envelope trước khi bind.

### Màn báo cáo (HR/manager view)

- [ ] Form picker: chọn nhân viên (chỉ hiện nhân viên MANAGER có quyền — call `/v1/employees?departmentId=X` với X = phòng ban đang manage), chọn tháng/năm.
- [ ] Section `employee` — hiển thị info nhân viên + badge `contractType` (nếu có).
- [ ] Section `attendance` — bảng dạng "Loại công / Số ngày" với các dòng:
  1. Công định mức (`workingDays`)
  2. Ngày đi làm thực tế (`actualWorkDays`) — có `.5` → format 1 chữ số thập phân
  3. Ngày đi làm Online (`onlineDays`)
  4. Công tác (`businessTripDays`)
  5. Nghỉ phép năm (`annualLeaveDays`)
  6. Nghỉ chế độ (`welfareLeaveDays`)
  7. Nghỉ không lương (`unpaidLeaveDays`)
  8. Ngày lễ (`publicHolidayDays`)
  9. **Tổng công tính ăn ca** (`mealAllowanceDays`) — dòng mới, styled tương tự "Tổng công tính lương"
  10. **Σ Tổng công tính lương** (`totalPayrollDays`) — có formula hint bên dưới: `= (2) + (3) + (4) + (5) + (6) + (8)` (actual + online + trip + annual + welfare + holiday, **KHÔNG** cộng unpaid)
- [ ] **Click-to-drill-down**: mỗi dòng metric bấm được → mở modal/drawer show `breakdown.<field>` (mảng entries). Layout modal đề xuất:
  - Header: tên metric + tổng số + công thức (nếu có).
  - Table: cột `Ngày` (định dạng `dd/MM/yyyy` + thứ trong tuần), `Ký hiệu` (badge màu theo symbol), `Công` (`value`), `Diễn giải` (`reason` — hiển thị nguyên văn).
  - Empty state khi mảng rỗng: "Không có ngày nào đóng góp vào chỉ số này".
- [ ] Symbol badge — dùng màu để phân biệt nhanh:
  - `X` xanh lá (đủ công), `X/2` vàng nhạt, `X/2 (Q)` cam (cảnh báo quên chấm), `K` đỏ, `CT`/`CT/X` xanh dương, `OL` tím, `P`/`P/X`/`P/2`/`R` xám xanh, `L` gold, `'0'` xám nhạt.
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
- [ ] KHÔNG cần tự dịch/format `reason` — BE trả sẵn tiếng Việt, hiển thị nguyên văn.
- [ ] KHÔNG cần call endpoint riêng để lấy detail per-day — `breakdown` nằm trong cùng response, không thêm request.

---

## Ghi chú thêm

- Nhân viên vừa join (chưa có schedule/attendance/leave) → tất cả số về 0, `breakdown.*` là mảng rỗng (không throw error). FE nên có empty state nhẹ.
- Tất cả thời gian bên trong tính theo giờ VN (UTC+7), FE không cần convert TZ.
- Endpoint không có `include=` param — mọi field trong response (kể cả `breakdown`) luôn được trả, không giảm được payload.
- `breakdown` có thể khá lớn với nhân viên có 27–31 ngày lịch làm (~27 entry trong `actualWorkDays`) — vẫn nằm trong <10KB, không cần lo hiệu năng.
- Reason string do BE format sẵn có thể chứa số giờ, ví dụ `"Đủ 2 lần chấm, tổng giờ làm 7.5h ≥ 6h → đủ công"` — FE hiển thị nguyên văn, không cần parse.
