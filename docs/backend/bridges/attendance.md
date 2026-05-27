# Bridge Docs — Chấm công (`/v1/attendance`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.  
> Xem [attendance-overview.md](./attendance-overview.md) để hiểu big picture.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
| --- | --- | --- | --- |
| POST | `/v1/attendance/check-in` | `EMPLOYEE` | Multipart — ảnh selfie + GPS |
| POST | `/v1/attendance/check-out` | `EMPLOYEE` | Multipart — ảnh selfie |
| GET | `/v1/attendance/check-attendance` | `EMPLOYEE` | Kiểm tra GPS + ca trước khi check-in |
| GET | `/v1/attendance/me/stats` | `EMPLOYEE` | Thống kê chấm công theo tháng |
| GET | `/v1/attendance/photo-url` | `EMPLOYEE` | Presigned URL ảnh check-in/check-out từ S3 |
| GET | `/v1/attendance/today-info` | `EMPLOYEE` | Thông tin hôm nay: ca, địa điểm, bản ghi |
| GET | `/v1/attendance/me` | `EMPLOYEE` | Lịch sử chấm công cá nhân (có phân trang) |
| GET | `/v1/attendance` | `ADMIN`, `HR`, `MANAGER`, `CHIEF` | Toàn bộ chấm công (có phân trang + filter) |
| PATCH | `/v1/attendance/:id` | `ADMIN`, `HR` | Chỉnh sửa thủ công bản ghi |

> **Lưu ý thứ tự route:** `/attendance/check-attendance`, `/attendance/me/stats`, `/attendance/photo-url`, `/attendance/today-info`, `/attendance/me` đều được khai báo **trước** `/attendance/:id` trong controller.

---

## TypeScript Types

```typescript
// types/attendance.types.ts
export type AttendanceStatus = 'PRESENT' | 'LATE' | 'ABSENT' | 'HALF_DAY' | 'ON_LEAVE';

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

export type AttendanceWorkType = 'OFFLINE' | 'ONLINE_APPROVED' | 'ONLINE_T7' | null;

export interface AttendanceViolationRef {
	id: number;
	type: 'FORGOT_CHECKIN' | 'LATE' | 'EARLY';
	typeLabel: string; // "Quên chấm công" | "Đi muộn" | "Về sớm"
	status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
	reason: string;
	createdAt: string; // ISO 8601
}

export interface AttendanceRecordDetail {
	id: number;
	date: string; // "YYYY-MM-DD"
	checkInAt: string | null; // ISO 8601 full datetime
	checkOutAt: string | null; // ISO 8601 full datetime
	checkInPhotoUrl: string | null; // S3 URL ảnh selfie check-in (dùng /photo-url để lấy presigned)
	checkOutPhotoUrl: string | null; // S3 URL ảnh selfie check-out
	isLocked: boolean; // true = bị lock, không tự sửa được
	lockReason: string | null; // "AUTO_MIDNIGHT" | "HR_LOCKED"
	missingType: string | null; // "MISSING_CHECKOUT" | "MISSING_CHECKIN"
	lateMinutes: number;
	earlyMinutes: number;
	status: AttendanceStatus;
	isManual: boolean; // true nếu HR chỉnh sửa thủ công
	note: string | null;
	workType: AttendanceWorkType; // null = offline bình thường; 'ONLINE_APPROVED' = WFH được duyệt
	distance: number | null; // khoảng cách GPS khi check-in (mét), null nếu isManual
	effectiveStart: string | null; // ISO 8601 epoch-based — xem ghi chú ⚠️ bên dưới
	effectiveEnd: string | null; // ISO 8601 epoch-based — xem ghi chú ⚠️ bên dưới
	isHalfDay: boolean; // true nếu ngày này có EffectiveShiftOverride
	location: AttendanceLocationDto | null;
	shift: AttendanceShiftDto | null;
	employee: AttendanceEmployeeDto | null;
	violationRequests: AttendanceViolationRef[]; // danh sách đơn vi phạm liên quan bản ghi này
}

// GET /attendance/check-attendance
export interface CheckAttendanceResponseDto {
	id: number; // ID địa điểm
	name: string; // tên địa điểm
	latitude: number;
	longitude: number;
	radiusMeters: number; // bán kính cho phép (mét)
	distance: number; // khoảng cách từ GPS của nhân viên đến địa điểm (mét)
	isInRange: boolean; // true nếu distance <= radiusMeters
	isAvailableShift: boolean; // true nếu hiện đang trong khung giờ của ca
}

// GET /attendance/me/stats
export interface AttendanceStatsResponseDto {
	year: number;
	month: number;
	workedDays: number; // số ngày đã chấm công (PRESENT + LATE)
	totalWorkingDays: number; // tổng số ngày làm việc trong tháng (trừ T7/CN/lễ)
	remainingDays: number; // totalWorkingDays - workedDays
	onTimeDays: number; // số ngày đúng giờ (PRESENT)
	onTimeRate: number; // % đúng giờ = onTimeDays / workedDays * 100
	lateTimes: number; // số lần đi muộn
	annualLeaveBalance: number; // số ngày phép năm còn lại
	annualLeaveUsed: number; // số ngày phép năm đã dùng
}

// GET /attendance/today-info
export interface TodayShiftDto {
	id: number;
	name: string;
	checkInTime: string; // "HH:mm" UTC
	checkOutTime: string; // "HH:mm" UTC
	isOnline: boolean; // true nếu ca online
}

export interface TodayLocationDto {
	id: number;
	name: string;
	latitude: number;
	longitude: number;
	radiusMeters: number;
}

export interface TodayRecordDto {
	id: number;
	checkInAt: string | null; // ISO 8601
	checkOutAt: string | null; // ISO 8601
	status: AttendanceStatus;
	isLocked: boolean;
}

export interface TodayInfoResponseDto {
	date: string; // "YYYY-MM-DD"
	isHoliday: boolean; // true nếu ngày lễ
	hasShift: boolean; // true nếu có ca hôm nay
	shift: TodayShiftDto | null;
	locations: TodayLocationDto[];
	todayRecord: TodayRecordDto | null; // null nếu chưa check-in
}

// Query params
export interface AttendanceStatsQueryParams {
	year: number; // bắt buộc, >= 2020
	month: number; // bắt buộc, 1–12
}

export interface CheckAttendanceQueryParams {
	latitude: number; // bắt buộc
	longitude: number; // bắt buộc
}

// POST /check-in — multipart/form-data (không phải JSON)
// Dùng FormData: append('photo', file), append('latitude', '21.0285'), append('longitude', '105.8542')

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

> **Check-in và check-out đều là `multipart/form-data`.** Không set `Content-Type` khi dùng `FormData` — để browser tự set boundary.

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
Mobile lấy GPS + chụp ảnh selfie
    │
    ├─ Khuyến nghị: kiểm tra accuracy < 100m trước khi gửi
    │   (server không validate accuracy — chỉ validate vị trí và bán kính)
    │
    ▼
POST /v1/attendance/check-in  (multipart/form-data)
  photo     = <File JPG/PNG ≤ 5MB>
  latitude  = 21.0285
  longitude = 105.8542
    │
    ├─ 400 "Ảnh check-in là bắt buộc"
    ├─ 400 "Chỉ chấp nhận ảnh JPG hoặc PNG"
    ├─ 400 "Ảnh không được vượt quá 5MB"
    ├─ 400 "Vị trí hiện tại không nằm trong bán kính địa điểm chấm công được phép"
    ├─ 400 "Không có ca làm việc hôm nay"
    ├─ 400 "Ngoài khung giờ cho phép của ca làm việc"
    ├─ 400 "Bản ghi chấm công đã bị khóa. Vui lòng tạo đơn bù công."
    ├─ 409 "ATTENDANCE_ALREADY_CHECKED_IN"
    │
    └─ 201 Created → AttendanceRecordDetail
           ├─ isHalfDay: false → hiển thị ca bình thường
           └─ isHalfDay: true  → hiển thị "Ca rút gọn" (getUTCHours())
```

---

## POST /v1/attendance/check-in — Check-in

**Content-Type:** `multipart/form-data`

| Field       | Type   | Bắt buộc | Mô tả                                |
| ----------- | ------ | -------- | ------------------------------------ |
| `photo`     | File   | ✓        | Ảnh selfie, JPG hoặc PNG, tối đa 5MB |
| `latitude`  | number | ✓        | Vĩ độ GPS                            |
| `longitude` | number | ✓        | Kinh độ GPS                          |

**Response 201 — check-in thành công:**

```json
{
	"success": true,
	"data": {
		"id": 101,
		"date": "2026-05-18",
		"checkInAt": "2026-05-18T08:05:00.000Z",
		"checkOutAt": null,
		"checkInPhotoUrl": "https://bucket.s3.ap-southeast-1.amazonaws.com/attendance/check-in/2026/05/18/uuid.jpg",
		"checkOutPhotoUrl": null,
		"isLocked": false,
		"lockReason": null,
		"missingType": null,
		"lateMinutes": 5,
		"earlyMinutes": 0,
		"status": "LATE",
		"isManual": false,
		"note": null,
		"distance": 42,
		"effectiveStart": null,
		"effectiveEnd": null,
		"isHalfDay": false,
		"location": { "id": 1, "name": "Văn phòng Hà Nội" },
		"shift": { "id": 1, "name": "Ca sáng", "checkInTime": "08:00", "checkOutTime": "17:00" },
		"employee": { "id": 4, "fullName": "Nguyễn Văn An", "employeeCode": "EMP004" }
	}
}
```

**Response 201 — `isHalfDay: true` (nghỉ sáng):** Giống trên nhưng `effectiveStart: "1970-01-01T12:00:00.000Z"`, `effectiveEnd: "1970-01-01T17:00:00.000Z"`, `isHalfDay: true`.

> `shift.checkInTime` vẫn là `"08:00"` — giờ ca gốc, không đổi dù có nửa ngày phép.

**Response 400 — bản ghi bị lock:**

```json
{
	"success": false,
	"error": { "code": "BAD_REQUEST", "message": "Bản ghi chấm công đã bị khóa. Vui lòng tạo đơn bù công." }
}
```

**Response 409 — đã check-in rồi:**

```json
{ "success": false, "error": { "code": "CONFLICT", "message": "ATTENDANCE_ALREADY_CHECKED_IN" } }
```

---

## POST /v1/attendance/check-out — Check-out

**Content-Type:** `multipart/form-data`

| Field   | Type | Bắt buộc | Mô tả                                |
| ------- | ---- | -------- | ------------------------------------ |
| `photo` | File | ✓        | Ảnh selfie, JPG hoặc PNG, tối đa 5MB |

Server lấy `checkOutAt = thời điểm nhận request`.

**Response 200:** `ApiSuccess<AttendanceRecordDetail>` (shape giống check-in, `checkOutAt` và `checkOutPhotoUrl` được điền)

**400** nếu chưa check-in:

```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Chưa check-in" } }
```

**400** nếu đã check-out rồi:

```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Đã check-out rồi" } }
```

**400** nếu bản ghi bị lock:

```json
{
	"success": false,
	"error": { "code": "BAD_REQUEST", "message": "Bản ghi chấm công đã bị khóa. Vui lòng tạo đơn bù công." }
}
```

---

## GET /v1/attendance/me — Lịch sử cá nhân

**Query params:** `?page=1&limit=20&startDate=2026-05-01&endDate=2026-05-31&status=LATE`

**Response:** `ApiPaginated<AttendanceRecordDetail>`

---

## GET /v1/attendance — Toàn bộ (HR/Admin)

Chỉ `ADMIN` và `HR` được gọi.

**Query params:** `?page=1&limit=20&employeeId=4&departmentId=1&startDate=2026-05-01&endDate=2026-05-31&status=LATE`

**Response:** `ApiPaginated<AttendanceRecordDetail>` — shape giống `/me`

---

## PATCH /v1/attendance/:id — Chỉnh sửa thủ công

Dành cho HR/Admin. Bản ghi sau khi sửa có `isManual: true`, `isLocked: false` (tự động unlock), `distance: null`.

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
import type { AttendanceRecordDetail, ManualEditAttendanceDto, QueryAttendanceParams } from '~/types/attendance.types';
import type { ApiPaginated } from '~/types/api.types';

export function useAttendance() {
	const { get, patch } = useFetch();

	// check-in: multipart/form-data — không set Content-Type thủ công
	const checkIn = (params: { latitude: number; longitude: number }, photo: File) => {
		const form = new FormData();
		form.append('photo', photo);
		form.append('latitude', String(params.latitude));
		form.append('longitude', String(params.longitude));
		return fetch('/v1/attendance/check-in', { method: 'POST', body: form });
	};

	// check-out: multipart/form-data
	const checkOut = (photo: File) => {
		const form = new FormData();
		form.append('photo', photo);
		return fetch('/v1/attendance/check-out', { method: 'POST', body: form });
	};

	const checkAttendance = (params: CheckAttendanceQueryParams) =>
		get<CheckAttendanceResponseDto | null>('/v1/attendance/check-attendance', { params });

	const fetchMyStats = (params: AttendanceStatsQueryParams) =>
		get<AttendanceStatsResponseDto>('/v1/attendance/me/stats', { params });

	const getPhotoUrl = (fileUrl: string) =>
		get<{ presignedUrl: string }>('/v1/attendance/photo-url', { params: { fileUrl } });

	const fetchTodayInfo = () => get<TodayInfoResponseDto>('/v1/attendance/today-info');

	const fetchMyHistory = (params?: QueryAttendanceParams) =>
		get<ApiPaginated<AttendanceRecordDetail>>('/v1/attendance/me', { params });

	const fetchAll = (params?: QueryAttendanceParams) =>
		get<ApiPaginated<AttendanceRecordDetail>>('/v1/attendance', { params });

	const manualEdit = (id: number, dto: ManualEditAttendanceDto) =>
		patch<AttendanceRecordDetail>(`/v1/attendance/${id}`, dto);

	return {
		checkIn,
		checkOut,
		checkAttendance,
		fetchMyStats,
		getPhotoUrl,
		fetchTodayInfo,
		fetchMyHistory,
		fetchAll,
		manualEdit,
	};
}
```

---

## GET /v1/attendance/check-attendance — Kiểm tra GPS trước khi check-in

Dùng để kiểm tra xem nhân viên có đang trong bán kính địa điểm được phép chấm công không, và có ca đang hoạt động không. **Không tạo bản ghi — chỉ đọc.** Gọi trước khi hiện nút "Check-in" để cung cấp feedback tức thì.

**Query params:** `?latitude=21.0285&longitude=105.8542`

**Response 200:** `ApiSuccess<CheckAttendanceResponseDto | null>`

- Trả về `null` nếu không có địa điểm nào được cấu hình.

```json
{
	"success": true,
	"data": {
		"id": 1,
		"name": "Văn phòng Hà Nội",
		"latitude": 21.0285,
		"longitude": 105.8542,
		"radiusMeters": 100,
		"distance": 42,
		"isInRange": true,
		"isAvailableShift": true,
		"canCheckIn": true,
		"canCheckOut": false
	}
}
```

**Pattern dùng trên mobile:**

```typescript
// Kiểm tra trước khi enable nút check-in
const status = await checkAttendance({ latitude, longitude });
if (!status) {
	showError('Chưa cấu hình địa điểm chấm công');
} else if (!status.isInRange) {
	showError(`Bạn đang cách ${status.distance}m — vượt quá ${status.radiusMeters}m cho phép`);
} else if (!status.isAvailableShift) {
	showError('Ngoài khung giờ ca làm việc');
} else {
	enableCheckInButton();
}
```

---

## GET /v1/attendance/me/stats — Thống kê chấm công

**Query params:** `?year=2026&month=5` (cả hai bắt buộc)

**Response 200:** `ApiSuccess<AttendanceStatsResponseDto>`

```json
{
	"success": true,
	"data": {
		"year": 2026,
		"month": 5,
		"workedDays": 18,
		"totalWorkingDays": 22,
		"remainingDays": 4,
		"onTimeDays": 15,
		"onTimeRate": 83.33,
		"lateTimes": 3,
		"annualLeaveBalance": 9,
		"annualLeaveUsed": 3
	}
}
```

| Field                | Ý nghĩa                                                     |
| -------------------- | ----------------------------------------------------------- |
| `workedDays`         | Số ngày PRESENT + LATE trong tháng                          |
| `totalWorkingDays`   | Số ngày làm việc lý thuyết (trừ T7/CN/lễ)                   |
| `remainingDays`      | `totalWorkingDays - workedDays`                             |
| `onTimeRate`         | `onTimeDays / workedDays * 100` — `0` nếu chưa làm ngày nào |
| `annualLeaveBalance` | Số ngày phép năm còn lại (lấy từ leave_balances)            |
| `annualLeaveUsed`    | Số ngày phép năm đã dùng trong năm                          |

---

## GET /v1/attendance/photo-url — Presigned URL ảnh

Ảnh check-in/check-out lưu trên S3 với private ACL. Để hiển thị, cần lấy presigned URL có thời hạn.

**Query params:** `?fileUrl=https://bucket.s3.amazonaws.com/attendance/.../uuid.jpg`

`fileUrl` là giá trị lấy từ `checkInPhotoUrl` hoặc `checkOutPhotoUrl` của `AttendanceRecordDetail`.

**Response 200:** `ApiSuccess<{ presignedUrl: string }>`

```json
{
	"success": true,
	"data": {
		"presignedUrl": "https://bucket.s3.amazonaws.com/attendance/.../uuid.jpg?X-Amz-Algorithm=...&X-Amz-Expires=3600&..."
	}
}
```

**Lưu ý:**

- Presigned URL có thời hạn ~1 giờ. Không cache lâu dài — lấy lại khi cần hiển thị.
- Không gọi S3 URL trực tiếp — sẽ bị `403 Access Denied`.

```typescript
// Dùng trong img src
const { presignedUrl } = await getPhotoUrl(record.checkInPhotoUrl!);
imgSrc.value = presignedUrl;
```

---

## GET /v1/attendance/today-info — Thông tin hôm nay

Lấy toàn bộ thông tin cần thiết cho màn hình chấm công: ca hiện tại, danh sách địa điểm, và bản ghi hôm nay (nếu đã check-in).

**Response 200:** `ApiSuccess<TodayInfoResponseDto>`

```json
{
	"success": true,
	"data": {
		"date": "2026-05-27",
		"isHoliday": false,
		"hasShift": true,
		"shift": {
			"id": 1,
			"name": "Ca sáng",
			"checkInTime": "08:00",
			"checkOutTime": "17:00",
			"isOnline": false
		},
		"locations": [
			{
				"id": 1,
				"name": "Văn phòng Hà Nội",
				"latitude": 21.0285,
				"longitude": 105.8542,
				"radiusMeters": 100
			}
		],
		"todayRecord": {
			"id": 204,
			"checkInAt": "2026-05-27T01:05:00.000Z",
			"checkOutAt": null,
			"status": "PRESENT",
			"isLocked": false
		}
	}
}
```

**Logic hiển thị trên màn hình chấm công:**

```typescript
const info = await fetchTodayInfo();

if (info.isHoliday) {
	// Hiển thị "Hôm nay nghỉ lễ"
} else if (!info.hasShift) {
	// Hiển thị "Không có ca hôm nay"
} else if (!info.todayRecord) {
	// Hiển thị nút "Check-in"
} else if (!info.todayRecord.checkInAt) {
	// Hiển thị nút "Check-in"
} else if (!info.todayRecord.checkOutAt) {
	// Đã check-in → hiển thị nút "Check-out"
} else {
	// Đã check-out → hiển thị trạng thái hoàn thành
}
```

---

## workType — badge trạng thái làm việc

Field `workType` trong `AttendanceRecordDetail` cho biết hình thức làm việc trong ngày đó:

| `workType`          | Badge hiển thị       | Nguồn gốc                                    |
| ------------------- | -------------------- | -------------------------------------------- |
| `null`              | _(không hiển thị)_   | Offline bình thường                          |
| `'ONLINE_APPROVED'` | 🟢 Badge "Online"    | Đơn WFH được duyệt (`/online-work-requests`) |
| `'ONLINE_T7'`       | 🟠 Badge "Online T7" | Làm online ngày thứ 7                        |
| `'OFFLINE'`         | ⚫ Badge "Offline"   | Khai báo offline rõ ràng                     |

---

## violationRequests — đơn vi phạm liên kết

`violationRequests` là mảng các đơn bù công/vi phạm được tạo cho bản ghi chấm công này.

```typescript
// Hiển thị badge trên bản ghi
const hasPendingViolation = record.violationRequests.some(v => v.status === 'PENDING');
const hasApprovedViolation = record.violationRequests.some(v => v.status === 'APPROVED');
```

Mảng rỗng `[]` nếu không có đơn vi phạm nào. Chi tiết về đơn vi phạm xem tại [violation-requests.md](./violation-requests.md).

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
| `workType: 'ONLINE_APPROVED'` | Nhân viên có đơn WFH COMPLETED ngày đó — không cần check-in từ văn phòng |
| `violationRequests: []` | Không có vi phạm — bình thường |
| `GET /check-attendance` trả `null` | Không có địa điểm nào được cấu hình trong hệ thống |
| `GET /check-attendance` trả `isAvailableShift: false` | Đang ngoài khung giờ ca — nhân viên không thể check-in |
| `GET /me/stats` tháng chưa kết thúc | `workedDays` tính đến hôm nay; `totalWorkingDays` vẫn tính cả tháng |
| `GET /photo-url` với URL hết hạn | Lấy presigned URL mới — không cache |
| `GET /today-info` ngày lễ | `isHoliday: true`, `hasShift: false`, `shift: null` |
| `MANAGER`/`CHIEF` gọi `GET /attendance` | 200 OK — xem tất cả (MANAGER scope theo phòng ban) |
