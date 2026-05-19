# Bridge Docs — Ca làm việc & Lịch ca (`/v1/work-shifts`, `/v1/shift-schedules`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.  
> Xem [attendance-overview.md](./attendance-overview.md) để hiểu big picture.

---

## Endpoints

### Nhóm 1 — WorkShift (khuôn ca cố định)

| Method | Path                  | Ai được gọi       | Ghi chú                      |
| ------ | --------------------- | ----------------- | ---------------------------- |
| GET    | `/v1/work-shifts`     | Mọi authenticated | Danh sách tất cả ca          |
| POST   | `/v1/work-shifts`     | `ADMIN`, `HR`     | Tạo ca mới                   |
| PATCH  | `/v1/work-shifts/:id` | `ADMIN`, `HR`     | Cập nhật thông tin ca        |
| DELETE | `/v1/work-shifts/:id` | `ADMIN`, `HR`     | Vô hiệu hóa ca (soft delete) |

### Nhóm 2 — ShiftSchedule (gán ca theo ngày)

| Method | Path | Ai được gọi | Ghi chú |
| --- | --- | --- | --- |
| GET | `/v1/shift-schedules/me` | `EMPLOYEE` | Lịch ca của tôi (mặc định: tuần hiện tại) |
| GET | `/v1/shift-schedules/calendar` | `ADMIN`, `HR` | Calendar view theo ngày (tối đa 31 ngày) |
| GET | `/v1/shift-schedules` | `ADMIN`, `HR` | Lịch ca toàn công ty |
| POST | `/v1/shift-schedules` | `ADMIN`, `HR` | Gán ca 1 ngày cho 1 nhân viên |
| POST | `/v1/shift-schedules/bulk` | `ADMIN`, `HR` | Gán ca hàng loạt (tối đa 100 mục) |
| PATCH | `/v1/shift-schedules/employees/:employeeId/default-shift` | `ADMIN`, `HR` | Gán ca mặc định hàng ngày |
| DELETE | `/v1/shift-schedules/:employeeId/:date` | `ADMIN`, `HR` | Xóa lịch ca theo ngày |

> **Lưu ý thứ tự route:** Các segment tĩnh (`me`, `calendar`, `bulk`) được khai báo **trước** các segment có param (`/:id`, `/:employeeId/:date`) trong controller để NestJS không nhầm route.

---

## TypeScript Types

```typescript
// types/shift.types.ts

// ─── WorkShift ─────────────────────────────────────────────────────────────

// Response từ GET /work-shifts, POST /work-shifts, PATCH /work-shifts/:id
export interface WorkShiftResponse {
	id: number;
	name: string;
	checkInTime: string; // "HH:mm" UTC — ví dụ "08:00"
	checkOutTime: string; // "HH:mm" UTC — ví dụ "17:00"
	lateThresholdMin: number; // Số phút trễ được phép, mặc định 15
	earlyThresholdMin: number; // Số phút về sớm được phép, mặc định 15
	workDays: number[]; // 0=CN, 1=T2, 2=T3, 3=T4, 4=T5, 5=T6, 6=T7
	isActive: boolean;
	createdAt: string; // ISO 8601
}

// POST /work-shifts request
export interface CreateWorkShiftDto {
	name: string;
	checkInTime: string; // "HH:mm"
	checkOutTime: string; // "HH:mm"
	lateThresholdMin?: number; // 0–60, mặc định 15
	earlyThresholdMin?: number; // 0–60, mặc định 15
	workDays: number[]; // 0=CN, 1=T2, ..., 6=T7
}

// PATCH /work-shifts/:id — mọi field đều optional
export type UpdateWorkShiftDto = Partial<CreateWorkShiftDto>;

// ─── ShiftSchedule ─────────────────────────────────────────────────────────

// Shape của object "shift" lồng trong ShiftScheduleResponse
export interface WorkShiftSummary {
	id: number;
	name: string;
	checkInTime: string; // "HH:mm"
	checkOutTime: string; // "HH:mm"
	workDays: number[]; // 0=CN, 1=T2, ..., 6=T7
}

// Response từ GET /shift-schedules và GET /shift-schedules/me
export interface ShiftScheduleResponse {
	id: number;
	date: string; // "YYYY-MM-DD"
	employee: {
		id: number;
		fullName: string;
		employeeCode: string;
	};
	shift: WorkShiftSummary;
}

// POST /shift-schedules request
export interface AssignShiftDto {
	employeeId: number;
	shiftId: number;
	date: string; // "YYYY-MM-DD"
}

// POST /shift-schedules/bulk request
export interface BulkAssignShiftDto {
	assignments: AssignShiftDto[]; // tối đa 100 phần tử
}

// PATCH /shift-schedules/employees/:id/default-shift request
export interface SetDefaultShiftDto {
	shiftId: number;
}

// Query params cho GET /shift-schedules và GET /shift-schedules/me
export interface QueryShiftScheduleParams {
	employeeId?: number;
	departmentId?: number;
	startDate?: string; // "YYYY-MM-DD" — mặc định đầu tuần hiện tại
	endDate?: string; // "YYYY-MM-DD" — mặc định cuối tuần hiện tại
}

// ─── Calendar ──────────────────────────────────────────────────────────────

// Query params cho GET /shift-schedules/calendar
export interface QueryCalendarParams {
	startDate: string; // "YYYY-MM-DD" — bắt buộc
	endDate: string; // "YYYY-MM-DD" — bắt buộc, tối đa 31 ngày từ startDate
	departmentId?: number;
	employeeId?: number;
}

export interface CalendarShift {
	id: number;
	name: string;
	checkInTime: string; // "HH:mm"
	checkOutTime: string; // "HH:mm"
}

export interface CalendarDayEmployee {
	employeeId: number;
	employeeCode: string;
	fullName: string;
	department: string | null;
	shift: CalendarShift | null; // null = không có ca nào (không có default, không có override)
	isDefault: boolean; // true = đang dùng defaultShift, false = override theo ngày cụ thể
}

// Response từ GET /shift-schedules/calendar
export interface CalendarDayResponse {
	date: string; // "YYYY-MM-DD"
	employees: CalendarDayEmployee[];
}
```

> **Quan trọng về `checkInTime`/`checkOutTime`:**  
> Server lưu dạng `TIME WITHOUT TIME ZONE` trong PostgreSQL (`@db.Time`), trả về string `"HH:mm"` đã format theo UTC.  
> Dùng trực tiếp để hiển thị — không cần parse thêm.

> **`workDays` convention:** `0 = Chủ nhật`, `1 = Thứ 2`, `2 = Thứ 3`, ..., `6 = Thứ 7`.  
> Ví dụ: `[1, 2, 3, 4, 5]` = Thứ 2 đến Thứ 6. `[0]` = Chủ nhật.

---

## Hiểu về luồng ca làm việc

```
WorkShift (khuôn ca — HR tạo, cố định)
    │
    ├──► Employee.defaultShiftId
    │         Ca áp dụng mọi ngày nếu không có override cụ thể
    │
    └──► EmployeeShiftSchedule (override ca cho 1 ngày cụ thể)
              │
              ▼
         Server resolve khi employee check-in:
         1. Có EmployeeShiftSchedule cho ngày hôm nay? → dùng ca đó
         2. Không có? → dùng Employee.defaultShiftId
         3. Không có cả hai? → NO_SHIFT_TODAY (check-in thất bại)
              │
              ▼ (nếu tìm được ca)
         EffectiveShiftOverride
              Hệ thống tự tạo khi HR duyệt đơn nghỉ nửa ngày
              Thu hẹp cửa sổ giờ làm việc (sáng hoặc chiều)
              Frontend chỉ đọc — không tạo trực tiếp
              │
              ▼
         AttendanceRecord
              isHalfDay: true  → có EffectiveShiftOverride
              isHalfDay: false → ca bình thường
```

**Frontend cần làm:**

- Gọi `GET /work-shifts` để populate dropdown khi tạo/gán ca
- Gọi `GET /shift-schedules/me` để hiển thị lịch ca tuần này (EMPLOYEE)
- Gọi `GET /shift-schedules/calendar` để render calendar view (HR)
- HR gọi `POST /shift-schedules` hoặc `POST /shift-schedules/bulk` để gán ca
- HR gọi `PATCH .../default-shift` để gán ca mặc định cho nhân viên mới
- `EffectiveShiftOverride` — **không thao tác trực tiếp** — đọc qua `isHalfDay`/`effectiveStart`/`effectiveEnd` trong `AttendanceRecord`

---

## GET /v1/work-shifts — Danh sách ca làm việc

Mọi authenticated user được gọi.

**Response:** `ApiSuccess<WorkShiftResponse[]>`

```json
{
	"success": true,
	"data": [
		{
			"id": 1,
			"name": "Ca hành chính",
			"checkInTime": "08:00",
			"checkOutTime": "17:00",
			"lateThresholdMin": 15,
			"earlyThresholdMin": 15,
			"workDays": [1, 2, 3, 4, 5],
			"isActive": true,
			"createdAt": "2026-01-01T00:00:00.000Z"
		},
		{
			"id": 2,
			"name": "Ca chiều",
			"checkInTime": "13:00",
			"checkOutTime": "22:00",
			"lateThresholdMin": 10,
			"earlyThresholdMin": 10,
			"workDays": [1, 2, 3, 4, 5, 6],
			"isActive": true,
			"createdAt": "2026-01-01T00:00:00.000Z"
		}
	]
}
```

---

## POST /v1/work-shifts — Tạo ca mới

Chỉ `ADMIN` và `HR` được gọi.

**Request body:**

```json
{
	"name": "Ca sáng sớm",
	"checkInTime": "06:00",
	"checkOutTime": "14:00",
	"lateThresholdMin": 10,
	"earlyThresholdMin": 10,
	"workDays": [1, 2, 3, 4, 5]
}
```

**Response 201:** `ApiSuccess<WorkShiftResponse>`

**400** nếu `checkInTime`/`checkOutTime` sai format (phải là `HH:mm`):

```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "checkInTime must match /^\\d{2}:\\d{2}$/" } }
```

---

## PATCH /v1/work-shifts/:id — Cập nhật ca

Mọi field đều optional. Chỉ `ADMIN` và `HR` được gọi.

**Ví dụ:** `PATCH /v1/work-shifts/1`

**Request body:**

```json
{ "lateThresholdMin": 5 }
```

**Response 200:** `ApiSuccess<WorkShiftResponse>`

**404** nếu ca không tồn tại.

---

## DELETE /v1/work-shifts/:id — Vô hiệu hóa ca

Soft delete — chỉ set `isActive = false`, không xóa khỏi DB. Chỉ `ADMIN` và `HR` được gọi.

**Ví dụ:** `DELETE /v1/work-shifts/1`

**Response: 204 No Content**

**400** nếu ca đã bị vô hiệu hóa trước đó:

```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Ca làm việc đã bị vô hiệu hóa" } }
```

---

## GET /v1/shift-schedules/me — Lịch ca của tôi

**Query params:** `?startDate=2026-05-12&endDate=2026-05-18`  
Mặc định nếu không truyền: từ đầu đến cuối tuần hiện tại.

**Response:** `ApiSuccess<ShiftScheduleResponse[]>`

```json
{
	"success": true,
	"data": [
		{
			"id": 5,
			"date": "2026-05-12",
			"employee": {
				"id": 4,
				"fullName": "Nguyễn Văn An",
				"employeeCode": "EMP004"
			},
			"shift": {
				"id": 1,
				"name": "Ca sáng",
				"checkInTime": "08:00",
				"checkOutTime": "17:00",
				"workDays": [1, 2, 3, 4, 5]
			}
		}
	]
}
```

> Response không có `meta` phân trang — trả toàn bộ lịch ca trong khoảng ngày.

---

## GET /v1/shift-schedules/calendar — Calendar view

Chỉ `ADMIN` và `HR` được gọi. `startDate` và `endDate` đều **bắt buộc**. Tối đa 31 ngày.

**Query params:** `?startDate=2026-05-12&endDate=2026-05-18&departmentId=1`

**Response:** `ApiSuccess<CalendarDayResponse[]>` — mỗi phần tử là 1 ngày với danh sách nhân viên và ca của họ.

```json
{
  "success": true,
  "data": [
    {
      "date": "2026-05-12",
      "employees": [
        {
          "employeeId": 4,
          "employeeCode": "EMP004",
          "fullName": "Nguyễn Văn An",
          "department": "Kỹ thuật",
          "shift": {
            "id": 1,
            "name": "Ca hành chính",
            "checkInTime": "08:00",
            "checkOutTime": "17:00"
          },
          "isDefault": true
        },
        {
          "employeeId": 5,
          "employeeCode": "EMP005",
          "fullName": "Trần Thị Bình",
          "department": "Kỹ thuật",
          "shift": {
            "id": 2,
            "name": "Ca chiều",
            "checkInTime": "13:00",
            "checkOutTime": "22:00"
          },
          "isDefault": false
        }
      ]
    },
    {
      "date": "2026-05-13",
      "employees": [...]
    }
  ]
}
```

**Hiểu `isDefault`:**

- `isDefault: true` → nhân viên đang dùng `Employee.defaultShiftId` (không có override cho ngày này)
- `isDefault: false` → nhân viên có `EmployeeShiftSchedule` cụ thể cho ngày này (override)
- `shift: null` → nhân viên không có ca mặc định và không có override — sẽ bị `NO_SHIFT_TODAY`

**400** nếu khoảng ngày vượt quá 31 ngày:

```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Khoảng ngày phải từ 0 đến 31 ngày" } }
```

---

## GET /v1/shift-schedules — Lịch ca toàn công ty

Chỉ `ADMIN` và `HR` được gọi.

**Query params:** `?startDate=2026-05-12&endDate=2026-05-18&employeeId=4&departmentId=1`

**Response:** `ApiSuccess<ShiftScheduleResponse[]>` — shape giống `/me`

---

## POST /v1/shift-schedules — Gán ca 1 ngày

Nếu nhân viên đã có lịch ca cho ngày đó → **upsert** (ghi đè, không báo lỗi).

**Request body:**

```json
{
	"employeeId": 4,
	"shiftId": 1,
	"date": "2026-05-20"
}
```

**Response 201:** `ApiSuccess<ShiftScheduleResponse>`

```json
{
	"success": true,
	"data": {
		"id": 10,
		"date": "2026-05-20",
		"employee": {
			"id": 4,
			"fullName": "Nguyễn Văn An",
			"employeeCode": "EMP004"
		},
		"shift": {
			"id": 1,
			"name": "Ca sáng",
			"checkInTime": "08:00",
			"checkOutTime": "17:00",
			"workDays": [1, 2, 3, 4, 5]
		}
	}
}
```

**400** nếu ca đã bị vô hiệu hóa (`isActive: false`):

```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Ca làm việc đã bị vô hiệu hóa" } }
```

**404** nếu nhân viên hoặc ca không tồn tại:

```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Nhân viên hoặc ca làm việc không tồn tại" } }
```

---

## POST /v1/shift-schedules/bulk — Gán ca hàng loạt

Tối đa 100 mục trong một request. Gán cho nhiều nhân viên và/hoặc nhiều ngày.

**Request body:**

```json
{
	"assignments": [
		{ "employeeId": 4, "shiftId": 1, "date": "2026-05-19" },
		{ "employeeId": 4, "shiftId": 1, "date": "2026-05-20" },
		{ "employeeId": 5, "shiftId": 2, "date": "2026-05-19" }
	]
}
```

**Response 201: No Content** (void — không trả data)

**400** nếu vượt quá 100 mục:

```json
{
	"success": false,
	"error": { "code": "BAD_REQUEST", "message": "assignments must contain no more than 100 elements" }
}
```

---

## PATCH /v1/shift-schedules/employees/:employeeId/default-shift — Gán ca mặc định

Gán ca mặc định cho nhân viên. Ca này được áp dụng cho mọi ngày không có lịch ca cụ thể.

**Ví dụ:** `PATCH /v1/shift-schedules/employees/4/default-shift`

**Request body:**

```json
{ "shiftId": 1 }
```

**Response 200: No Content** (void)

**404** nếu nhân viên hoặc ca không tồn tại:

```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Nhân viên không tồn tại" } }
```

---

## DELETE /v1/shift-schedules/:employeeId/:date — Xóa lịch ca theo ngày

Xóa override ca của một ngày cụ thể. Sau khi xóa, hệ thống fallback về `defaultShiftId` của nhân viên.

**Ví dụ:** `DELETE /v1/shift-schedules/4/2026-05-20`

**Response: 204 No Content**

**404** nếu không tìm thấy lịch ca:

```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Lịch ca không tồn tại" } }
```

---

## Composable — useShiftSchedules

```typescript
// composables/useShiftSchedules.ts
import type {
	WorkShiftResponse,
	CreateWorkShiftDto,
	UpdateWorkShiftDto,
	ShiftScheduleResponse,
	AssignShiftDto,
	BulkAssignShiftDto,
	SetDefaultShiftDto,
	QueryShiftScheduleParams,
	QueryCalendarParams,
	CalendarDayResponse,
} from '~/types/shift.types';

export function useShiftSchedules() {
	const { get, post, patch, del } = useFetch();

	// ─── WorkShift ──────────────────────────────────────────────────────────

	const fetchWorkShifts = () => get<WorkShiftResponse[]>('/v1/work-shifts');

	const createWorkShift = (dto: CreateWorkShiftDto) => post<WorkShiftResponse>('/v1/work-shifts', dto);

	const updateWorkShift = (id: number, dto: UpdateWorkShiftDto) =>
		patch<WorkShiftResponse>(`/v1/work-shifts/${id}`, dto);

	const deactivateWorkShift = (id: number) => del(`/v1/work-shifts/${id}`);

	// ─── ShiftSchedule ──────────────────────────────────────────────────────

	const fetchMySchedule = (params?: QueryShiftScheduleParams) =>
		get<ShiftScheduleResponse[]>('/v1/shift-schedules/me', { params });

	const fetchSchedules = (params?: QueryShiftScheduleParams) =>
		get<ShiftScheduleResponse[]>('/v1/shift-schedules', { params });

	const fetchCalendar = (params: QueryCalendarParams) =>
		get<CalendarDayResponse[]>('/v1/shift-schedules/calendar', { params });

	const assignShift = (dto: AssignShiftDto) => post<ShiftScheduleResponse>('/v1/shift-schedules', dto);

	const bulkAssign = (dto: BulkAssignShiftDto) => post<void>('/v1/shift-schedules/bulk', dto);

	const setDefaultShift = (employeeId: number, dto: SetDefaultShiftDto) =>
		patch<void>(`/v1/shift-schedules/employees/${employeeId}/default-shift`, dto);

	const removeShift = (employeeId: number, date: string) => del(`/v1/shift-schedules/${employeeId}/${date}`);

	return {
		fetchWorkShifts,
		createWorkShift,
		updateWorkShift,
		deactivateWorkShift,
		fetchMySchedule,
		fetchSchedules,
		fetchCalendar,
		assignShift,
		bulkAssign,
		setDefaultShift,
		removeShift,
	};
}
```

---

## Edge cases

| Tình huống                                                | Kết quả                                              |
| --------------------------------------------------------- | ---------------------------------------------------- |
| `EMPLOYEE` gọi `GET /shift-schedules`                     | 403 Forbidden                                        |
| Gán ca cho ngày đã có lịch ca                             | Upsert — ghi đè, không báo lỗi                       |
| Gán ca đã bị vô hiệu hóa                                  | 400 Bad Request                                      |
| `bulk` với > 100 mục                                      | 400 Bad Request                                      |
| `date` truyền sai format (không phải `YYYY-MM-DD`)        | 400 Bad Request                                      |
| `GET /calendar` không truyền `startDate`/`endDate`        | 400 Bad Request (2 field bắt buộc)                   |
| `GET /calendar` với khoảng > 31 ngày                      | 400 Bad Request                                      |
| `shift: null` trong calendar response                     | Nhân viên không có defaultShift và không có override |
| `isDefault: true` trong calendar                          | Nhân viên đang dùng `Employee.defaultShiftId`        |
| `isDefault: false` trong calendar                         | Có `EmployeeShiftSchedule` override cho ngày đó      |
| Xóa lịch ca ngày đó → nhân viên còn `defaultShiftId`      | Hệ thống dùng `defaultShift` khi check-in            |
| Xóa lịch ca ngày đó → nhân viên không có `defaultShiftId` | `NO_SHIFT_TODAY` khi check-in                        |
| `DELETE /work-shifts/:id` khi ca đã inactive              | 400 Bad Request                                      |
| `PATCH default-shift` với `shiftId` không tồn tại         | 404 Not Found                                        |
| `workDays: [1,2,3,4,5]`                                   | Thứ 2 đến Thứ 6                                      |
| `workDays: [0]`                                           | Chủ nhật                                             |
| `workDays: [6]`                                           | Thứ 7                                                |
| Không truyền `startDate`/`endDate` cho `/me`              | Server mặc định tuần hiện tại (Thứ 2 → Chủ nhật)     |
