# Bridge Docs — Chấm công (`/v1/attendance`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.  
> Xem [attendance-overview.md](./attendance-overview.md) để hiểu big picture.

---

## Endpoints

| Method | Path                       | Ai được gọi   | Ghi chú                                   |
| ------ | -------------------------- | ------------- | ----------------------------------------- |
| POST   | `/v1/attendance/check-in`  | `EMPLOYEE`    | Chấm công vào — gửi kèm GPS               |
| POST   | `/v1/attendance/check-out` | `EMPLOYEE`    | Chấm công ra — không cần GPS              |
| GET    | `/v1/attendance/me`        | `EMPLOYEE`    | Lịch sử chấm công cá nhân (có phân trang) |
| GET    | `/v1/attendance`           | `ADMIN`, `HR` | Toàn bộ chấm công công ty (có phân trang) |
| PATCH  | `/v1/attendance/:id`       | `ADMIN`, `HR` | Chỉnh sửa thủ công bản ghi                |

> **Lưu ý thứ tự route:** `/attendance/me` được khai báo **trước** `/attendance/:id` trong controller.

---

## TypeScript Types

```typescript
// types/attendance.types.ts
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE';

export interface AttendanceLocationDto {
	id: number;
	name: string;
}

export interface AttendanceShiftDto {
	id: number;
	name: string;
	checkInTime: string; // "HH:mm" — giờ bắt đầu ca gốc (UTC)
	checkOutTime: string; // "HH:mm" — giờ kết thúc ca gốc (UTC)
}

export interface AttendanceEmployeeDto {
	id: number;
	fullName: string;
	employeeCode: string;
}

export interface AttendanceRecordDetail {
	id: number;
	date: string; // "YYYY-MM-DD"
	checkInAt: string | null; // ISO 8601 full datetime, null nếu chưa check-in
	checkOutAt: string | null; // ISO 8601 full datetime, null nếu chưa check-out
	lateMinutes: number; // số phút đến muộn (0 nếu đúng giờ hoặc sớm)
	earlyMinutes: number; // số phút về sớm (0 nếu đúng giờ hoặc muộn)
	status: AttendanceStatus;
	isManual: boolean; // true nếu HR chỉnh sửa thủ công
	distance: number | null; // khoảng cách GPS khi check-in (mét, đã làm tròn), null nếu isManual
	effectiveStart: string | null; // ISO 8601 epoch-based — xem ghi chú bên dưới ⚠️
	effectiveEnd: string | null; // ISO 8601 epoch-based — xem ghi chú bên dưới ⚠️
	isHalfDay: boolean; // true nếu ngày này có EffectiveShiftOverride (nghỉ nửa ngày)
	location: AttendanceLocationDto | null;
	shift: AttendanceShiftDto | null;
	employee: AttendanceEmployeeDto | null;
}

// POST /check-in request body
export interface CheckInDto {
	latitude: number;
	longitude: number;
}

// PATCH /:id request body
export interface ManualEditAttendanceDto {
	checkInAt?: string; // ISO 8601
	checkOutAt?: string; // ISO 8601
	note?: string;
}

// Query params cho GET /me và GET /
export interface QueryAttendanceParams {
	page?: number; // default 1
	limit?: number; // default 20, max 100
	date?: string; // "YYYY-MM-DD" — lọc đúng ngày
	startDate?: string; // "YYYY-MM-DD"
	endDate?: string; // "YYYY-MM-DD"
	employeeId?: number;
	departmentId?: number;
	status?: AttendanceStatus;
}
```

### ⚠️ Quan trọng: `effectiveStart` và `effectiveEnd`

`effectiveStart`/`effectiveEnd` là giờ **thực tế** khi nhân viên có nửa ngày phép. Chúng được lưu dạng `TIME WITHOUT TIME ZONE` trong PostgreSQL (`@db.Time`) và trả về dưới dạng **ISO 8601 epoch-based** — tức là phần date luôn là `1970-01-01`, chỉ phần giờ là có nghĩa.

```typescript
// ✅ Đúng — dùng getUTCHours() / getUTCMinutes()
const start = new Date(record.effectiveStart!);
const hour = start.getUTCHours(); // ví dụ: 12 (12:00 trưa UTC)
const min = start.getUTCMinutes(); // ví dụ: 0
const display = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`; // "12:00"

// ❌ Sai — getHours() phụ thuộc timezone của browser
const hour = new Date(record.effectiveStart!).getHours(); // kết quả sai nếu browser không ở UTC
```

| Field               | Ví dụ giá trị                | Ý nghĩa                                             |
| ------------------- | ---------------------------- | --------------------------------------------------- |
| `effectiveStart`    | `"1970-01-01T12:00:00.000Z"` | Bắt đầu làm lúc 12:00 UTC (nghỉ sáng → làm từ trưa) |
| `effectiveEnd`      | `"1970-01-01T17:00:00.000Z"` | Kết thúc lúc 17:00 UTC                              |
| `shift.checkInTime` | `"08:00"`                    | Giờ vào ca gốc — không thay đổi dù có nửa ngày phép |

Khi `isHalfDay: true`, dùng `effectiveStart`/`effectiveEnd` để hiển thị "Ca rút gọn" thay vì `shift.checkInTime`/`shift.checkOutTime`.

---

## Flow check-in từ góc nhìn frontend

```
Mobile lấy GPS
    │
    ├─ Khuyến nghị: kiểm tra accuracy < 100m trước khi gửi
    │   (server không validate accuracy — chỉ validate vị trí và bán kính)
    │
    ▼
POST /v1/attendance/check-in  { latitude, longitude }
    │
    ├─ 400 Bad Request
    │     ├─ message: "Vị trí hiện tại không nằm trong bán kính địa điểm chấm công được phép"
    │     │   → Hiển thị: "Vị trí không hợp lệ. Hãy đến gần văn phòng hơn."
    │     │
    │     ├─ message: "Không có ca làm việc hôm nay"
    │     │   → Hiển thị: "Bạn không có ca làm việc hôm nay."
    │     │
    │     └─ message: "Ngoài khung giờ cho phép của ca làm việc"
    │         → Hiển thị: "Ngoài khung giờ chấm công. Vui lòng thử lại đúng giờ."
    │         (server cho phép ±30 phút xung quanh giờ bắt đầu ca thực tế)
    │
    ├─ 409 Conflict
    │     → "Bạn đã check-in hôm nay rồi."
    │
    └─ 201 Created → AttendanceRecordDetail
           │
           ├─ isHalfDay: false
           │     Hiển thị ca bình thường: shift.checkInTime – shift.checkOutTime
           │
           └─ isHalfDay: true
                 Hiển thị "Ca rút gọn"
                 Dùng effectiveStart/effectiveEnd (phải parse bằng getUTCHours())
```

---

## POST /v1/attendance/check-in — Check-in

**Request body:**

```json
{
	"latitude": 21.0285,
	"longitude": 105.8542
}
```

**Response 201 — check-in thành công (ca bình thường):**

```json
{
	"success": true,
	"data": {
		"id": 101,
		"date": "2026-05-18",
		"checkInAt": "2026-05-18T08:05:00.000Z",
		"checkOutAt": null,
		"lateMinutes": 5,
		"earlyMinutes": 0,
		"status": "LATE",
		"isManual": false,
		"distance": 42,
		"effectiveStart": null,
		"effectiveEnd": null,
		"isHalfDay": false,
		"location": { "id": 1, "name": "Văn phòng Hà Nội" },
		"shift": {
			"id": 1,
			"name": "Ca sáng",
			"checkInTime": "08:00",
			"checkOutTime": "17:00"
		},
		"employee": {
			"id": 4,
			"fullName": "Nguyễn Văn An",
			"employeeCode": "EMP004"
		}
	}
}
```

**Response 201 — check-in ngày có nửa ngày phép buổi sáng (`isHalfDay: true`):**

```json
{
	"success": true,
	"data": {
		"id": 102,
		"date": "2026-05-19",
		"checkInAt": "2026-05-19T13:05:00.000Z",
		"checkOutAt": null,
		"lateMinutes": 0,
		"earlyMinutes": 0,
		"status": "PRESENT",
		"isManual": false,
		"distance": 38,
		"effectiveStart": "1970-01-01T12:00:00.000Z",
		"effectiveEnd": "1970-01-01T17:00:00.000Z",
		"isHalfDay": true,
		"location": { "id": 1, "name": "Văn phòng Hà Nội" },
		"shift": {
			"id": 1,
			"name": "Ca sáng",
			"checkInTime": "08:00",
			"checkOutTime": "17:00"
		},
		"employee": {
			"id": 4,
			"fullName": "Nguyễn Văn An",
			"employeeCode": "EMP004"
		}
	}
}
```

> `effectiveStart: "1970-01-01T12:00:00.000Z"` — nghỉ sáng nên bắt đầu làm từ 12:00 UTC.  
> `shift.checkInTime` vẫn là `"08:00"` — giờ ca gốc, không đổi.

**Response 400 — vị trí không hợp lệ:**

```json
{
	"success": false,
	"error": { "code": "BAD_REQUEST", "message": "Vị trí hiện tại không nằm trong bán kính địa điểm chấm công được phép" }
}
```

**Response 400 — không có ca hôm nay:**

```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Không có ca làm việc hôm nay" } }
```

**Response 400 — ngoài khung giờ:**

```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Ngoài khung giờ cho phép của ca làm việc" } }
```

**Response 409 — đã check-in rồi:**

```json
{ "success": false, "error": { "code": "CONFLICT", "message": "ATTENDANCE_ALREADY_CHECKED_IN" } }
```

---

## POST /v1/attendance/check-out — Check-out

Không cần request body. Server lấy thời điểm check-out = thời điểm nhận request.

**Response 200:** `ApiSuccess<AttendanceRecordDetail>`

```json
{
	"success": true,
	"data": {
		"id": 101,
		"date": "2026-05-18",
		"checkInAt": "2026-05-18T08:05:00.000Z",
		"checkOutAt": "2026-05-18T17:30:00.000Z",
		"lateMinutes": 5,
		"earlyMinutes": 0,
		"status": "LATE",
		"isManual": false,
		"distance": 42,
		"effectiveStart": null,
		"effectiveEnd": null,
		"isHalfDay": false,
		"location": { "id": 1, "name": "Văn phòng Hà Nội" },
		"shift": {
			"id": 1,
			"name": "Ca sáng",
			"checkInTime": "08:00",
			"checkOutTime": "17:00"
		},
		"employee": {
			"id": 4,
			"fullName": "Nguyễn Văn An",
			"employeeCode": "EMP004"
		}
	}
}
```

**400** nếu chưa check-in hoặc đã check-out rồi:

```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Chưa check-in hoặc đã check-out rồi" } }
```

---

## GET /v1/attendance/me — Lịch sử cá nhân

**Query params:** `?page=1&limit=20&startDate=2026-05-01&endDate=2026-05-31&status=LATE`

**Response:** `ApiPaginated<AttendanceRecordDetail>`

```json
{
	"success": true,
	"data": [
		{
			"id": 101,
			"date": "2026-05-18",
			"checkInAt": "2026-05-18T08:05:00.000Z",
			"checkOutAt": "2026-05-18T17:30:00.000Z",
			"lateMinutes": 5,
			"earlyMinutes": 0,
			"status": "LATE",
			"isManual": false,
			"distance": 42,
			"effectiveStart": null,
			"effectiveEnd": null,
			"isHalfDay": false,
			"location": { "id": 1, "name": "Văn phòng Hà Nội" },
			"shift": {
				"id": 1,
				"name": "Ca sáng",
				"checkInTime": "08:00",
				"checkOutTime": "17:00"
			},
			"employee": {
				"id": 4,
				"fullName": "Nguyễn Văn An",
				"employeeCode": "EMP004"
			}
		}
	],
	"meta": {
		"page": 1,
		"limit": 20,
		"total": 15,
		"totalPages": 1
	}
}
```

---

## GET /v1/attendance — Toàn bộ (HR/Admin)

Chỉ `ADMIN` và `HR` được gọi.

**Query params:** `?page=1&limit=20&employeeId=4&departmentId=1&startDate=2026-05-01&endDate=2026-05-31&status=LATE`

**Response:** `ApiPaginated<AttendanceRecordDetail>` — shape giống `/me`

---

## PATCH /v1/attendance/:id — Chỉnh sửa thủ công

Dành cho HR/Admin điều chỉnh khi nhân viên quên check-in/check-out. Bản ghi sau khi sửa sẽ có `isManual: true`, `distance: null`.

**Request body:**

```json
{
	"checkInAt": "2026-05-18T08:05:00.000Z",
	"checkOutAt": "2026-05-18T17:30:00.000Z",
	"note": "Nhân viên quên check-in, đã xác nhận qua email"
}
```

Tất cả fields đều optional — có thể chỉ cập nhật `checkOutAt` nếu muốn.

**Response 200:** `ApiSuccess<AttendanceRecordDetail>`

**404** nếu bản ghi không tồn tại:

```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Bản ghi chấm công không tồn tại" } }
```

---

## Composable — useAttendance

```typescript
// composables/useAttendance.ts
import type {
	AttendanceRecordDetail,
	CheckInDto,
	ManualEditAttendanceDto,
	QueryAttendanceParams,
} from '~/types/attendance.types';
import type { ApiPaginated } from '~/types/api.types';

export function useAttendance() {
	const { get, post, patch } = useFetch();

	const checkIn = (dto: CheckInDto) => post<AttendanceRecordDetail>('/v1/attendance/check-in', dto);

	const checkOut = () => post<AttendanceRecordDetail>('/v1/attendance/check-out');

	const fetchMyHistory = (params?: QueryAttendanceParams) =>
		get<ApiPaginated<AttendanceRecordDetail>>('/v1/attendance/me', { params });

	const fetchAll = (params?: QueryAttendanceParams) =>
		get<ApiPaginated<AttendanceRecordDetail>>('/v1/attendance', { params });

	const manualEdit = (id: number, dto: ManualEditAttendanceDto) =>
		patch<AttendanceRecordDetail>(`/v1/attendance/${id}`, dto);

	return {
		checkIn,
		checkOut,
		fetchMyHistory,
		fetchAll,
		manualEdit,
	};
}
```

---

## Bản ghi bị lock (`isLocked: true`)

Khi `isLocked: true`, nhân viên **không thể** tự check-in hoặc check-out vào bản ghi đó:

- **Check-in khi bản ghi bị lock:** → 400 `"Bản ghi chấm công đã bị khóa. Vui lòng tạo đơn bù công."`
- **Check-out khi bản ghi bị lock:** → 400 `"Bản ghi chấm công đã bị khóa. Vui lòng tạo đơn bù công."`

**Nguồn gốc lock:**

| `lockReason`    | Nguyên nhân                                          |
| --------------- | ---------------------------------------------------- |
| `AUTO_MIDNIGHT` | Cron 00:05 HCM — record ngày hôm qua chưa hoàn chỉnh |
| `HR_LOCKED`     | HR/Admin lock thủ công (dự kiến tương lai)           |

**`missingType`:**

| Giá trị            | Ý nghĩa                          |
| ------------------ | -------------------------------- |
| `MISSING_CHECKOUT` | Đã check-in nhưng quên check-out |
| `null`             | Không check-in cả ngày (vắng)    |

**Hiển thị trên UI:** Khi `isLocked: true`, thay thế nút check-in/check-out bằng nút "Tạo đơn bù công" → điều hướng sang flow `/v1/makeup-attendance`.

Xem chi tiết tại [makeup-attendance.md](./makeup-attendance.md).

---

## Edge cases

| Tình huống | Kết quả |
| --- | --- |
| Check-in lần 2 trong ngày | 409 `ATTENDANCE_ALREADY_CHECKED_IN` |
| Check-in khi bản ghi đã lock | 400 `"Bản ghi chấm công đã bị khóa. Vui lòng tạo đơn bù công."` |
| Check-out khi chưa check-in | 400 Bad Request |
| Check-out khi bản ghi đã lock | 400 `"Bản ghi chấm công đã bị khóa. Vui lòng tạo đơn bù công."` |
| Check-out lần 2 trong ngày | 400 Bad Request |
| GPS accuracy > 100m | Server không validate — frontend nên tự kiểm tra `coords.accuracy < 100` trước khi gọi |
| `isHalfDay: true` | `effectiveStart`/`effectiveEnd` khác giờ ca gốc — hiển thị "Ca rút gọn", không dùng `shift.checkInTime/checkOutTime` |
| Parse `effectiveStart`/`effectiveEnd` | Dùng `new Date(val).getUTCHours()` — **không** dùng `getHours()` |
| `distance: null` | Bản ghi được edit thủ công (`isManual: true`) — không có khoảng cách GPS |
| `EMPLOYEE` gọi `GET /attendance` | 403 Forbidden |
| `EMPLOYEE` gọi `PATCH /attendance/:id` | 403 Forbidden |
| Lọc `?date=X` kết hợp `startDate`/`endDate` | Nên dùng một trong hai, không nên kết hợp |
| Không truyền `page`/`limit` | Mặc định `page=1`, `limit=20` |
| `status: "ABSENT"` | Bản ghi vắng — `checkInAt` và `checkOutAt` đều `null` |
