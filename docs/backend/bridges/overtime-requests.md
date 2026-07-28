# Bridge Docs — Đăng ký làm thêm giờ (`/v1/overtime-requests`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
| --- | --- | --- | --- |
| GET | `/v1/overtime-requests/me` | Mọi user đã đăng nhập | Danh sách đơn OT của bản thân |
| GET | `/v1/overtime-requests/me/stats` | Mọi user đã đăng nhập | Thống kê OT theo tháng của bản thân |
| GET | `/v1/overtime-requests/available-locations` | Mọi user đã đăng nhập | Toàn bộ địa điểm chấm công ACTIVE của hệ thống (để chọn khi tạo OT offline) |
| POST | `/v1/overtime-requests` | Mọi user đã đăng nhập | Tạo đơn OT mới |
| POST | `/v1/overtime-requests/preview` | Mọi user đã đăng nhập | **Kiểm tra nhanh** — trả segments + rate + approver mà không lưu DB (rate-limit 20 req/60s) |
| GET | `/v1/overtime-requests/report` | `ADMIN`, `HR`, `MANAGER`, `CHIEF` | Thống kê OT theo tháng |
| GET | `/v1/overtime-requests/report/export` | `ADMIN`, `HR`, `MANAGER`, `CHIEF` | Xuất báo cáo OT ra Excel |
| GET | `/v1/overtime-requests` | `ADMIN`, `HR`, `MANAGER`, `CHIEF` | Danh sách tất cả đơn OT |
| GET | `/v1/approval/overtime-requests` | Approver được assign | **Inbox** đơn OT chờ tôi duyệt — xem [approval.md](./approval.md) |
| GET | `/v1/approval/overtime-requests/:id` | Approver / HR / ADMIN | Chi tiết (approver view) |
| GET | `/v1/overtime-requests/:id` | Chủ đơn, `ADMIN`, `HR`, hoặc approver được phân công | Chi tiết một đơn OT |
| PATCH | `/v1/overtime-requests/:id/approve` | `ADMIN`, `MANAGER`, `CHIEF` | Duyệt đơn OT |
| PATCH | `/v1/overtime-requests/:id/reject` | `ADMIN`, `MANAGER`, `CHIEF` | Từ chối đơn OT |
| PATCH | `/v1/overtime-requests/:id/cancel` | Chủ đơn | Thu hồi đơn OT |
| POST | `/v1/overtime-requests/:id/check-location` | Chủ đơn | Xác nhận vị trí OT offline (START/END) |

> **Lưu ý thứ tự route:** `/overtime-requests/me` và `/overtime-requests/report` được khai báo **trước** `/:id` trong controller.  
> Gọi `/overtime-requests/me` mà trả 404 → kiểm tra thứ tự route phía client.

---

## TypeScript Types

```typescript
// types/overtime.types.ts

export type OvertimeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'AUTO_CANCELLED';

export type OvertimeWorkMode = 'ONLINE' | 'OFFLINE';

export type OtLocationCheckType = 'START' | 'END';

export interface OvertimeLocationCheck {
	checkedAt: string | null; // ISO 8601 datetime, null khi chưa xác nhận
	isValid: boolean | null; // null = chưa check, true/false = kết quả GPS
	distanceMeters: number | null; // giữ null trong response chuẩn (không expose khoảng cách chi tiết)
}

export interface OvertimeLocationStatus {
	start: OvertimeLocationCheck;
	end: OvertimeLocationCheck;
	isResolved: boolean; // true khi cron đã set finalWorkMode
}

export interface OvertimeApproverDto {
	id: number;
	fullName: string;
}

export interface OvertimeLocationDto {
	id: number;
	name: string;
}

export interface AvailableLocationDto {
	id: number;
	name: string;
}

export interface OvertimeEmployeeDto {
	id: number;
	fullName: string;
	employeeCode: string;
	department: string | null; // tên phòng ban (string), không phải object
}

export interface OvertimeSegment {
	segmentDate: string; // "YYYY-MM-DD" — ngày local VN của segment
	hours: number; // số giờ OT thuộc segment này
	otRate: 150 | 200 | 300; // rate detect theo ngày: lễ (300) > CN (200) > T2–T7 (150)
	otRateLabel: string; // "150%" | "200%" | "300%"
}

// Dùng trong GET /overtime-requests, GET /overtime-requests/:id, POST /overtime-requests
export interface OvertimeRequestResponse {
	id: number;
	startTime: string; // ISO 8601 full datetime
	endTime: string; // ISO 8601 full datetime — có thể sang ngày sau
	totalHours: number; // raw hours (endTime - startTime); tối thiểu 0.5, tối đa 12
	segments: OvertimeSegment[]; // 1–N segments; nếu OT span 2 ngày VN → 2 segments với rate riêng
	totalPaidHours: number; // sum(hours × otRate/100) — tổng "giờ trả lương" đã nhân hệ số
	reason: string;
	status: OvertimeStatus;
	workMode: OvertimeWorkMode; // do user chọn khi tạo đơn
	location: OvertimeLocationDto | null; // chỉ có khi workMode = OFFLINE, null với ONLINE
	finalWorkMode: OvertimeWorkMode | null; // null = chưa resolve; cron set sau khi endTime + 30p
	resolvedAt: string | null; // ISO 8601 datetime khi cron resolve
	locationStatus: OvertimeLocationStatus; // trạng thái xác nhận vị trí
	reviewNote: string | null;
	assignedApprover: OvertimeApproverDto | null;
	reviewedBy: OvertimeApproverDto | null;
	reviewedAt: string | null; // ISO 8601 full datetime
	autoExpireAt: string; // ISO 8601 — deadline để manager duyệt (tạo + 7 ngày)
	deadlineAt: string; // ISO 8601 — deadline tạo đơn (startTime + 30 ngày)
	isExpired: boolean;
	employee: OvertimeEmployeeDto;
	createdAt: string; // ISO 8601 full datetime
	canBeCancelled: boolean; // true khi status === 'PENDING'
	hoursDisplay: string; // VD: "3.0 giờ" — dùng để hiển thị (raw hours)
}

// Dùng trong GET /overtime-requests/report và GET /reports/overtime
export interface OvertimeMonthlyStatsResponse {
	employeeId: number;
	employeeCode: string;
	fullName: string;
	departmentName: string | null;
	totalRequests: number; // số đơn có segment rơi vào tháng này
	approvedRequests: number;
	totalApprovedHours: number; // tổng giờ OT (raw) của các segment ACCEPTED thuộc tháng này
	pendingRequests: number;
	rejectedRequests: number;
}

// Request DTOs
export interface CreateOvertimeRequestDto {
	startTime: string; // ISO 8601 full datetime — giờ bắt đầu OT (BẮT BUỘC gồm ngày)
	endTime: string; // ISO 8601 full datetime — giờ kết thúc OT; có thể sang ngày sau
	workMode: OvertimeWorkMode; // BẮT BUỘC: 'ONLINE' | 'OFFLINE'
	locationId?: number; // BẮT BUỘC khi workMode = OFFLINE; bỏ qua khi ONLINE
	//   → id phải là 1 CheckInLocation ACTIVE bất kỳ (xem /available-locations)
	reason: string; // tối thiểu 10 ký tự
}

export interface PreviewOvertimeRequestDto {
	startTime: string; // ISO 8601 full datetime
	endTime: string; // ISO 8601 full datetime
	workMode: OvertimeWorkMode;
	locationId?: number; // optional khi OFFLINE — nếu thiếu/invalid, response trả location=null + isValid=false
}

export interface OvertimePreviewApprover {
	id: number;
	fullName: string;
}

export interface OvertimePreviewResponse {
	isValid: boolean; // true nếu hợp lệ theo mọi rule; false → xem `reason`
	reason: string | null; // lý do invalid nếu isValid=false
	startTime: string; // echo lại ISO datetime từ request
	endTime: string;
	totalHours: number; // raw hours
	segments: OvertimeSegment[]; // rỗng nếu totalHours ngoài [0.5, 12] hoặc endTime<=startTime
	totalPaidHours: number; // sum(hours × otRate/100)
	workMode: OvertimeWorkMode;
	location: OvertimeLocationDto | null; // null khi ONLINE hoặc lookup fail
	approver: OvertimePreviewApprover | null; // null → fallback HR
	approverFallbackToHR: boolean;
}

export interface RejectOvertimeDto {
	reviewNote: string; // lý do từ chối, bắt buộc
}

export interface CheckOtLocationDto {
	latitude: number; // [-90, 90]
	longitude: number; // [-180, 180]
	checkType: OtLocationCheckType; // 'START' | 'END'
}

export interface CheckOtLocationResponse {
	isValid: boolean; // true khi GPS nằm trong radius của ot.locationId
	locationName: string | null; // tên location đã khai (ot.locationId); null nếu location không tồn tại / đã deactivate
	distanceMeters: number; // khoảng cách GPS tới ot.locationId; -1 khi location không tồn tại / deactivate
	checkType: OtLocationCheckType;
}

export interface QueryOvertimeParams {
	page?: number; // default 1
	limit?: number; // default 20, max 100
	status?: OvertimeStatus;
	startDate?: string; // "YYYY-MM-DD" — filter khoảng ngày OT
	endDate?: string; // "YYYY-MM-DD"
	month?: number; // 1–12
	year?: number;
	departmentId?: number; // chỉ HR/ADMIN dùng; MANAGER/CHIEF bị override sang phòng ban mình
	employeeId?: number;
}

export interface QueryOvertimeReportParams {
	month: number; // 1–12, bắt buộc
	year: number; // >= 2020, bắt buộc
	departmentId?: number;
}
```

---

## Business Rules

### Deadline tạo đơn

- Chỉ được tạo đơn nếu `now <= (startTime local VN date) + 30 ngày`
- Quá 30 ngày → **400** `"Đã quá 30 ngày kể từ ngày OT. Không thể tạo đơn."`

### Auto-cancel sau 7 ngày

- Mỗi đơn có `autoExpireAt = createdAt + 7 ngày`
- Cron chạy lúc **00:05 Asia/Ho_Chi_Minh** mỗi ngày
- Đơn `PENDING` quá `autoExpireAt` → chuyển sang `AUTO_CANCELLED`, `isExpired = true`
- Nhân viên nhận email + push notification

### Multi-day segments — BẮT BUỘC hiểu trước khi tích hợp

Đơn OT được phép span nhiều ngày local VN. BE tự **tách đơn thành 1–N segments** theo boundary `00:00 VN`:

- Mỗi segment có `segmentDate`, `hours`, `otRate` riêng.
- Rate detect **per-segment** theo ngày của segment đó: lễ (300) > CN (200) > T2–T7 (150).
- **Window shift check per-segment**: nếu segment ngày lễ / CN → skip. Ngày T2–T7 → giờ segment phải ngoài giờ ca của ngày đó.
- Tổng `endTime - startTime` phải ≤ 12h (ràng buộc trên tổng, không phải per-segment).

**Ví dụ:** `startTime = 2026-07-26T16:00:00Z` (23:00 26/07 T7), `endTime = 2026-07-27T02:00:00Z` (09:00 27/07 CN) → tổng 10h, split thành:

- Segment 1: `2026-07-26`, 1h × 150% (T7)
- Segment 2: `2026-07-27`, 9h × 200% (CN)

`totalPaidHours = 1 × 1.5 + 9 × 2.0 = 19.5`. Response trả cả `totalHours` (raw 10) và `totalPaidHours` (đã nhân hệ số 19.5).

### OT Window (giờ hợp lệ)

| Ngày segment | Quy tắc |
| --- | --- |
| Ngày lễ | OT cả ngày, không kiểm tra ca. `otRate = 300` |
| Chủ nhật | OT cả ngày, không kiểm tra ca. `otRate = 200` |
| Thứ 2 – Thứ 7 | Giờ segment phải nằm **ngoài** ca của ngày đó (trước `checkInTime` hoặc sau `checkOutTime`). `otRate = 150` |
| Không có ca | Cho phép OT bất kỳ giờ nào |

Ưu tiên rate: **ngày lễ > chủ nhật > ngày thường**. Chủ nhật trùng ngày lễ → 300%.

### Ràng buộc thời gian

- `endTime > startTime` bắt buộc (không còn logic `+24h` — vì đã có full date).
- Tổng `totalHours = (endTime - startTime) / 3600` ∈ `[0.5, 12]`.

**Work Mode:**

- `workMode` do **user chọn khi tạo đơn** (bắt buộc): `ONLINE` (không cần vị trí) hoặc `OFFLINE` (cần xác nhận GPS).
- `finalWorkMode` do **cron resolve** sau khi đơn kết thúc:
  - `null` khi chưa resolve (`workMode = ONLINE` hoặc đơn `OFFLINE` chưa qua `endTime + 30p`).
  - `OFFLINE` khi cả `locStartValid` và `locEndValid` đều `true`.
  - `ONLINE` khi thiếu bất kỳ xác nhận nào (không check, hoặc check ngoài bán kính).
- Cron **`*/10 * * * *`** VN — quét đơn `APPROVED` + `OFFLINE` + `finalWorkMode = null` + `endTime <= now - 30 phút` → set `finalWorkMode` + `resolvedAt`.
- Nếu bị chuyển thành `ONLINE`, user nhận in-app notification `OT_LOCATION_RESOLVED`.

### Location Check Reminders

Cron **`* * * * *`** VN quét mỗi phút, tìm đơn OT `APPROVED` + `OFFLINE` + chưa resolve:

- Có `startTime` trong khoảng `[now + 9p, now + 11p]` AND `locStartAt = null` → gửi `OT_LOCATION_REMIND_START`.
- Có `endTime` trong khoảng `[now + 9p, now + 11p]` AND `locEndAt = null` → gửi `OT_LOCATION_REMIND_END`.

### Approver resolution

1. Nhân viên có `managerId` trực tiếp → giao cho manager đó
2. Không có manager trực tiếp → fallback gửi cho toàn bộ HR

- **HR không được duyệt** đơn OT — chỉ xem báo cáo (`403` nếu HR gọi PATCH approve/reject)
- **ADMIN** luôn có quyền duyệt
- **MANAGER/CHIEF** chỉ duyệt được đơn có `assignedApproverId` trỏ đến mình (hoặc đơn không được giao cho ai cụ thể)

---

## FCM Notifications

### Đăng ký device token

```
PATCH /v1/employees/me/fcm-token
{ "token": "<firebase_device_token>", "platform": "android" | "ios" }
```

Một nhân viên có thể đăng ký nhiều device token (đa thiết bị).

### Các sự kiện push notification

| Sự kiện                                          | Nhận thông báo          | `type`                     |
| ------------------------------------------------ | ----------------------- | -------------------------- |
| Nhân viên tạo đơn OT mới                         | Approver được phân công | `overtime.new_request`     |
| Đơn OT được duyệt                                | Nhân viên tạo đơn       | `overtime.approved`        |
| Đơn OT bị từ chối                                | Nhân viên tạo đơn       | `overtime.rejected`        |
| Đơn OT tự động huỷ (7 ngày)                      | Nhân viên tạo đơn       | `overtime.auto_cancelled`  |
| OT sắp bắt đầu (10p trước) — cần xác nhận START  | Chủ đơn                 | `OT_LOCATION_REMIND_START` |
| OT sắp kết thúc (10p trước) — cần xác nhận END   | Chủ đơn                 | `OT_LOCATION_REMIND_END`   |
| Cron chuyển đơn OFFLINE → ONLINE do thiếu vị trí | Chủ đơn                 | `OT_LOCATION_RESOLVED`     |

**Payload FCM** kèm theo (trong `data` map):

```json
{
	"type": "overtime.approved",
	"notificationId": "42",
	"title": "Đơn OT đã được duyệt",
	"body": "Đơn OT 3.0h ngày 2026-05-20 đã được duyệt",
	"overtimeId": "15"
}
```

Lấy danh sách in-app notifications qua `/v1/notifications` (xem bridge doc riêng).

---

## Role-based Access

| Role       | Xem đơn của mình | Xem đơn người khác | Tạo đơn |     Duyệt/Từ chối     |      Báo cáo      |
| ---------- | :--------------: | :----------------: | :-----: | :-------------------: | :---------------: |
| `EMPLOYEE` |        ✅        |         ❌         |   ✅    |          ❌           |        ❌         |
| `MANAGER`  |        ✅        | ✅ phòng ban mình  |   ✅    | ✅ đơn được phân công | ✅ phòng ban mình |
| `CHIEF`    |        ✅        | ✅ phòng ban mình  |   ✅    | ✅ đơn được phân công | ✅ phòng ban mình |
| `HR`       |        ✅        |     ✅ tất cả      |   ✅    | ❌ **bị chặn (403)**  |     ✅ tất cả     |
| `ADMIN`    |        ✅        |     ✅ tất cả      |   ✅    |       ✅ tất cả       |     ✅ tất cả     |

> `MANAGER`/`CHIEF` khi gọi `GET /overtime-requests` sẽ tự động bị filter về phòng ban của mình — không cần truyền `departmentId`.

---

## GET /v1/overtime-requests/me — Danh sách đơn OT của bản thân

**Query params:** `?status=PENDING&startDate=2026-05-01&endDate=2026-05-31&page=1&limit=20`

**Response:** `ApiPaginated<OvertimeRequestResponse>`

```json
{
	"success": true,
	"data": [
		{
			"id": 15,
			"startTime": "2026-07-26T16:00:00.000Z",
			"endTime": "2026-07-27T02:00:00.000Z",
			"totalHours": 10,
			"segments": [
				{ "segmentDate": "2026-07-26", "hours": 1, "otRate": 150, "otRateLabel": "150%" },
				{ "segmentDate": "2026-07-27", "hours": 9, "otRate": 200, "otRateLabel": "200%" }
			],
			"totalPaidHours": 19.5,
			"reason": "Hoàn thành dự án X trước deadline",
			"status": "PENDING",
			"workMode": "OFFLINE",
			"location": { "id": 1, "name": "Trụ sở Q1" },
			"reviewNote": null,
			"assignedApprover": { "id": 3, "fullName": "Trần Thị B" },
			"reviewedBy": null,
			"reviewedAt": null,
			"autoExpireAt": "2026-08-02T07:30:00.000Z",
			"deadlineAt": "2026-08-25T00:00:00.000Z",
			"isExpired": false,
			"employee": {
				"id": 4,
				"fullName": "Nguyễn Văn A",
				"employeeCode": "EMP004",
				"department": "Kỹ thuật"
			},
			"createdAt": "2026-07-26T07:30:00.000Z",
			"canBeCancelled": true,
			"hoursDisplay": "10.0 giờ"
		}
	],
	"meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

---

## GET /v1/overtime-requests/me/stats — Thống kê OT của bản thân

**Query params:** `?month=5&year=2026` (**bắt buộc**)

**Response:** `ApiSuccess<OvertimeMyStats>`

```json
{
	"success": true,
	"data": {
		"month": 5,
		"year": 2026,
		"totalHours": 9.5,
		"countByStatus": {
			"PENDING": 1,
			"APPROVED": 3,
			"REJECTED": 0
		}
	}
}
```

---

## GET /v1/overtime-requests/available-locations — Địa điểm OT có thể chọn

Trả về **toàn bộ** `CheckInLocation` có `isActive = true` trong hệ thống. FE dùng để populate dropdown khi user chọn `workMode = OFFLINE`. Không lọc theo assignment (`LocationEmployee`) — user tự khai địa điểm mình sẽ OT.

**Response:** `ApiSuccess<AvailableLocationDto[]>`

```json
{
	"success": true,
	"data": [
		{ "id": 1, "name": "Trụ sở Q1" },
		{ "id": 2, "name": "Chi nhánh Q7" }
	]
}
```

- Sort theo `name` ASC.
- Trả `[]` nếu hệ thống chưa có location nào ACTIVE — FE nên hint HR tạo trước, hoặc chặn workMode OFFLINE.
- **GPS check-in sau đó verify strict theo `ot.locationId` đã lưu trong đơn** (không dùng nearest logic). Xem `POST /:id/check-location` bên dưới.

---

## POST /v1/overtime-requests/preview — Kiểm tra nhanh (không lưu DB)

Endpoint lightweight dành cho form OT của FE. Từ payload người dùng đang gõ, BE tính ngay:

- **Segments theo ngày VN local** (rate 150/200/300 per-segment)
- **Tổng `totalPaidHours`** đã nhân hệ số
- **Location** — lookup theo `locationId` (best-effort)
- **Approver** — người sẽ được assign khi submit (theo `managerId` của current user)
- **`isValid` + `reason`** — cờ chung để FE enable/disable nút submit

**Đặc điểm:**

- **KHÔNG lưu DB.** Chỉ chạy 3–5 read query (holiday, shift schedule, location, manager).
- **Rate-limit: 20 req / 60s / user** (vượt → 429). FE nên debounce 300–500ms trước khi gọi.
- Không throw exception khi payload hợp lệ về format nhưng invalid về nghiệp vụ (VD tổng > 12h) — trả `isValid=false, reason: "..."` để FE hiển thị inline.
- Best-effort: nếu `isValid=false` vì window shift, các field khác (`segments`, `approver`, `location`) vẫn được compute và trả về.

**Request body:**

```json
{
	"startTime": "2026-07-26T16:00:00.000Z",
	"endTime": "2026-07-27T02:00:00.000Z",
	"workMode": "OFFLINE",
	"locationId": 1
}
```

**Response 200:** `ApiSuccess<OvertimePreviewResponse>`

```json
{
	"success": true,
	"data": {
		"isValid": true,
		"reason": null,
		"startTime": "2026-07-26T16:00:00.000Z",
		"endTime": "2026-07-27T02:00:00.000Z",
		"totalHours": 10,
		"segments": [
			{ "segmentDate": "2026-07-26", "hours": 1, "otRate": 150, "otRateLabel": "150%" },
			{ "segmentDate": "2026-07-27", "hours": 9, "otRate": 200, "otRateLabel": "200%" }
		],
		"totalPaidHours": 19.5,
		"workMode": "OFFLINE",
		"location": { "id": 1, "name": "Trụ sở Q1" },
		"approver": { "id": 3, "fullName": "Trần Thị B" },
		"approverFallbackToHR": false
	}
}
```

**Response 200 khi invalid (best-effort — vẫn compute được gì thì trả):**

```json
{
	"success": true,
	"data": {
		"isValid": false,
		"reason": "Thời gian OT tối đa 12 giờ/đơn",
		"startTime": "2026-07-26T16:00:00.000Z",
		"endTime": "2026-07-27T10:00:00.000Z",
		"totalHours": 18,
		"segments": [],
		"totalPaidHours": 0,
		"workMode": "OFFLINE",
		"location": { "id": 1, "name": "Trụ sở Q1" },
		"approver": { "id": 3, "fullName": "Trần Thị B" },
		"approverFallbackToHR": false
	}
}
```

**Errors:**

- `400` — DTO validation lỗi (thiếu field bắt buộc, sai ISO 8601 format, workMode không nằm trong enum).
- `401` — chưa auth.
- `429 Too Many Requests` — vượt rate-limit `20 req / 60s / user`. Response body có `Retry-After` header.

**FE UX gợi ý:**

- Debounce 300–500ms trên các input `startTime`, `endTime`, `workMode`, `locationId` rồi gọi preview.
- Hiển thị breakdown segments trong 1 bảng nhỏ dưới form: "Ngày 26/07: 1h × 150% = 1.5h" v.v.
- Hiển thị approver name để user biết "Đơn này sẽ gửi cho ...".
- Nếu 429 → show toast "Bạn thao tác quá nhanh, thử lại sau 60s" và disable auto-preview trong 60s.

---

## POST /v1/overtime-requests — Tạo đơn OT

**Request body (OFFLINE, OT qua đêm):**

```json
{
	"startTime": "2026-07-26T16:00:00.000Z",
	"endTime": "2026-07-27T02:00:00.000Z",
	"workMode": "OFFLINE",
	"locationId": 1,
	"reason": "Hoàn thành dự án X trước deadline"
}
```

**Request body (ONLINE, OT trong 1 ngày):**

```json
{
	"startTime": "2026-07-26T11:00:00.000Z",
	"endTime": "2026-07-26T14:00:00.000Z",
	"workMode": "ONLINE",
	"reason": "Hoàn thành dự án X từ xa"
}
```

**Lưu ý quan trọng:**

- `startTime`/`endTime`: ISO 8601 datetime **đầy đủ ngày + giờ UTC**. `endTime > startTime` bắt buộc.
- Đơn được phép **span nhiều ngày local VN** — BE tự tách segments theo boundary 00:00 VN, mỗi segment có rate riêng.
- `workMode`: bắt buộc, `'ONLINE' | 'OFFLINE'`.
- `locationId`: **bắt buộc** khi `workMode = OFFLINE`, **bỏ qua** khi `ONLINE`. Id phải là 1 `CheckInLocation` ACTIVE bất kỳ trong hệ thống (không cần user được assign trước). BE chỉ verify tồn tại + `isActive`.
- `reason`: tối thiểu 10 ký tự.
- Tổng `totalHours = (endTime - startTime) / 3600` ∈ `[0.5, 12]`.
- `segments[]`, `otRate`, `otRateLabel` được BE tự tính — client không gửi.

**Response 201:** `ApiSuccess<OvertimeRequestResponse>` — kèm `segments[]` chi tiết từng ngày, `totalPaidHours` đã nhân hệ số, `location` (null khi ONLINE), `locationStatus` (chưa check).

---

## PATCH /v1/overtime-requests/:id/approve — Duyệt đơn

Không cần body.

**Response 200:** `ApiSuccess<OvertimeRequestResponse>` với `status: "APPROVED"`

**403** nếu HR gọi:

```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "HR không được phép duyệt đơn OT" } }
```

---

## PATCH /v1/overtime-requests/:id/reject — Từ chối đơn

**Request body:**

```json
{ "reviewNote": "Không có nhu cầu thực tế" }
```

**Response 200:** `ApiSuccess<OvertimeRequestResponse>` với `status: "REJECTED"`

---

## PATCH /v1/overtime-requests/:id/cancel — Thu hồi đơn

Chỉ chủ đơn được thu hồi, chỉ khi `status === 'PENDING'`.

**Response 200:** `ApiSuccess<OvertimeRequestResponse>` với `status: "CANCELLED"`

---

## POST /v1/overtime-requests/:id/check-location — Xác nhận vị trí OT offline

Chỉ **chủ đơn** được gọi. Đơn phải đồng thời thoả:

- `status = APPROVED`
- `workMode = OFFLINE`
- `finalWorkMode = null` (chưa bị resolve)

**Thời gian được xác nhận:**

| checkType | Window cho phép                      |
| --------- | ------------------------------------ |
| `START`   | `[startTime - 30p, startTime + 30p]` |
| `END`     | `[endTime - 30p, endTime + 30p]`     |

Ngoài window → **400** kèm khoảng giờ hợp lệ (HH:mm).

**Request body:**

```json
{ "latitude": 10.762622, "longitude": 106.660172, "checkType": "START" }
```

**Response 200:**

```json
{
	"success": true,
	"data": {
		"isValid": true,
		"locationName": "Trụ sở Q1",
		"distanceMeters": 12,
		"checkType": "START"
	}
}
```

**Lưu ý:**

- GPS được verify **strict theo `ot.locationId`** (địa điểm user khai khi tạo đơn) — không dùng nearest logic. GPS phải nằm trong radius của đúng location đó thì `isValid = true`.
- Kết quả `isValid` được lưu vào `locStartValid` / `locEndValid` — cron `resolveOtWorkMode` dùng để quyết định `finalWorkMode`.
- `locationName = null` và `distanceMeters = -1` khi `ot.locationId` không tồn tại hoặc đã bị deactivate (edge case: HR xoá location sau khi đơn được tạo).
- BE chỉ lưu lat/lng phục vụ kiểm toán — **không expose lat/lng ra response chi tiết đơn**.

**Error codes:**

| Tình huống                                    | Status |
| --------------------------------------------- | -----: |
| Không phải chủ đơn                            |    403 |
| Đơn không tồn tại                             |    404 |
| Đơn chưa `APPROVED`                           |    400 |
| Đơn `workMode = ONLINE`                       |    400 |
| Đơn đã được resolve (`finalWorkMode != null`) |    400 |
| Xác nhận ngoài window ±30p                    |    400 |

---

## GET /v1/overtime-requests/report — Báo cáo tháng

**Query params:** `?month=5&year=2026&departmentId=1` (`month` và `year` **bắt buộc**)

**Response:** `ApiSuccess<OvertimeMonthlyStatsResponse[]>`

```json
{
	"success": true,
	"data": [
		{
			"employeeId": 4,
			"employeeCode": "EMP004",
			"fullName": "Nguyễn Văn A",
			"departmentName": "Kỹ thuật",
			"totalRequests": 5,
			"approvedRequests": 3,
			"totalApprovedHours": 9.5,
			"pendingRequests": 1,
			"rejectedRequests": 1
		}
	]
}
```

Endpoint giống nhau cũng có tại `/v1/reports/overtime` (xem bridge docs reports).

---

## Composable — useOvertimeRequests

```typescript
// composables/useOvertimeRequests.ts
import type {
	OvertimeRequestResponse,
	OvertimeMonthlyStatsResponse,
	AvailableLocationDto,
	CreateOvertimeRequestDto,
	PreviewOvertimeRequestDto,
	OvertimePreviewResponse,
	RejectOvertimeDto,
	QueryOvertimeParams,
	QueryOvertimeReportParams,
} from '~/types/overtime.types';

export function useOvertimeRequests() {
	const { get, list, post, patch } = useFetch();

	const fetchMyRequests = (params?: QueryOvertimeParams) =>
		list<OvertimeRequestResponse>('/v1/overtime-requests/me', { params });

	const fetchAvailableLocations = () => get<AvailableLocationDto[]>('/v1/overtime-requests/available-locations');

	const fetchMyStats = (month: number, year: number) =>
		get<{ month: number; year: number; totalHours: number; countByStatus: Record<string, number> }>(
			'/v1/overtime-requests/me/stats',
			{ params: { month, year } },
		);

	const fetchAll = (params?: QueryOvertimeParams) => list<OvertimeRequestResponse>('/v1/overtime-requests', { params });

	const fetchOne = (id: number) => get<OvertimeRequestResponse>(`/v1/overtime-requests/${id}`);

	const createRequest = (dto: CreateOvertimeRequestDto) => post<OvertimeRequestResponse>('/v1/overtime-requests', dto);

	/** Preview đơn OT (không lưu DB, rate-limit 20 req/60s). FE nên debounce 300–500ms. */
	const previewRequest = (dto: PreviewOvertimeRequestDto) =>
		post<OvertimePreviewResponse>('/v1/overtime-requests/preview', dto);

	const approve = (id: number) => patch<OvertimeRequestResponse>(`/v1/overtime-requests/${id}/approve`);

	const reject = (id: number, dto: RejectOvertimeDto) =>
		patch<OvertimeRequestResponse>(`/v1/overtime-requests/${id}/reject`, dto);

	const cancel = (id: number) => patch<OvertimeRequestResponse>(`/v1/overtime-requests/${id}/cancel`);

	const fetchReport = (params: QueryOvertimeReportParams) =>
		get<OvertimeMonthlyStatsResponse[]>('/v1/overtime-requests/report', { params });

	const exportReport = (params: QueryOvertimeReportParams) => {
		const q = new URLSearchParams(params as Record<string, string>).toString();
		return `/v1/overtime-requests/report/export?${q}`; // dùng trực tiếp làm href tải file
	};

	return {
		fetchMyRequests,
		fetchMyStats,
		fetchAvailableLocations,
		fetchAll,
		fetchOne,
		createRequest,
		previewRequest,
		approve,
		reject,
		cancel,
		fetchReport,
		exportReport,
	};
}
```

---

## Edge Cases

| Tình huống | Kết quả |
| --- | --- |
| Tạo đơn OT > 30 ngày kể từ ngày `startTime` | **400** `"Đã quá 30 ngày kể từ ngày OT"` |
| Tạo đơn OFFLINE mà thiếu `locationId` | **400** `"Bắt buộc chọn địa điểm khi OT offline"` |
| `locationId` không tồn tại hoặc `isActive = false` | **400** `"Địa điểm không hợp lệ hoặc đã ngừng hoạt động"` |
| `totalHours < 0.5` | **400** `"Thời gian OT tối thiểu 30 phút"` |
| `totalHours > 12` | **400** `"Thời gian OT tối đa 12 giờ/đơn"` |
| OT trong giờ ca (T2–T7) | **400** `"OT chỉ được đăng ký ngoài giờ ca..."` kèm tên ca |
| OT ngày Chủ nhật | ✅ Hợp lệ, không kiểm tra ca |
| Nhân viên không có ca làm việc | ✅ Hợp lệ, không kiểm tra giờ |
| `endTime <= startTime` | **400** `"endTime phải sau startTime"` — không còn tự +24h vì DTO yêu cầu full datetime |
| OT span 2 ngày VN, mỗi ngày rate khác nhau | ✅ Tách 2 segments trong `segments[]`; rate detect độc lập per-segment |
| OT span 2 ngày mà 1 ngày có ca T2–T7 | Check window shift chỉ cho segment ngày đó — segment ngày CN/lễ skip |
| Tổng `endTime - startTime` > 12h dù span nhiều ngày | **400** `"Thời gian OT tối đa 12 giờ/đơn"` — ràng buộc trên tổng, không per-segment |
| HR gọi `PATCH /:id/approve` | **403** `"HR không được phép duyệt đơn OT"` |
| MANAGER duyệt đơn không được phân công | **403** `"Chỉ trưởng phòng được phân công mới có thể xử lý đơn này"` |
| `PATCH /:id/reject` không có `reviewNote` | **400** `"Lý do từ chối là bắt buộc"` |
| Thu hồi đơn đã `APPROVED`/`REJECTED` | **400** `"Chỉ được thu hồi đơn đang chờ xử lý"` |
| Thu hồi đơn của người khác | **403** `"Chỉ được thu hồi đơn của chính mình"` |
| Đơn `PENDING` sau 7 ngày | Auto-cancel lúc 00:05 VN → `AUTO_CANCELLED`, email + FCM |
| `canBeCancelled = false` | `status !== 'PENDING'` — ẩn nút thu hồi trên UI |
| OT rơi vào Chủ nhật trùng ngày lễ | `otRate = 300` (ưu tiên ngày lễ) |
| Đơn OFFLINE nhưng user không xác nhận vị trí lần nào | Cron chuyển `finalWorkMode = ONLINE`, notify `OT_LOCATION_RESOLVED` |
| GPS ngoài radius của `ot.locationId` | `check-location` trả `isValid = false` (kèm distance thực) — đơn sẽ bị cron resolve thành `ONLINE` |
| `ot.locationId` bị HR deactivate sau khi tạo đơn | `check-location` trả `isValid = false, locationName = null, distanceMeters = -1` — đơn bị resolve thành `ONLINE` |
| Gọi `check-location` sau khi cron đã resolve | **400** `"Đơn OT đã được kết chốt, không thể xác nhận vị trí"` |
