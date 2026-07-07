# Bridge Docs — Công tác (`/v1/business-trips`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
| --- | --- | --- | --- |
| GET | `/v1/business-trips/me` | Mọi user đã đăng nhập | Đơn công tác của bản thân (có phân trang) |
| GET | `/v1/business-trips/pending-for-me` | `MANAGER`, `CHIEF`, `HR`, `ADMIN` | Đơn đang chờ mình duyệt |
| GET | `/v1/business-trips` | `MANAGER`, `CHIEF`, `HR`, `ADMIN` | Tất cả đơn (có filter, phân trang) |
| POST | `/v1/business-trips` | Mọi user đã đăng nhập | Tạo đơn mới (trạng thái `DRAFT`) — bắt buộc `routes[]` ≥ 1 |
| GET | `/v1/business-trips/:id` | Chủ nhân, `MANAGER`, `CHIEF`, `HR`, `ADMIN` | Chi tiết một đơn |
| PATCH | `/v1/business-trips/:id` | Chủ nhân (chỉ khi `DRAFT`) | Cập nhật thông tin đơn (không sửa routes qua endpoint này) |
| PATCH | `/v1/business-trips/:id/submit` | Chủ nhân, `HR`, `ADMIN` (chỉ khi `DRAFT`) | Nộp đơn. HR/ADMIN có thể bỏ trống `approverId` → **auto-approve** |
| PATCH | `/v1/business-trips/:id/approve` | `MANAGER`, `CHIEF`, `HR`, `ADMIN` | Duyệt đơn |
| PATCH | `/v1/business-trips/:id/reject` | `MANAGER`, `CHIEF`, `HR`, `ADMIN` | Từ chối đơn |
| PATCH | `/v1/business-trips/:id/cancel` | Chủ nhân, `HR`, `ADMIN` (khi `DRAFT` hoặc `PENDING`) | Huỷ đơn |
| PATCH | `/v1/business-trips/routes/:routeId/transport` | `HR`, `ADMIN` (trip phải `APPROVED`) | HR cập nhật phương tiện cho một lộ trình, hoặc đánh dấu tự túc |
| POST | `/v1/business-trips/routes/:routeId/upload-ticket` | `HR`, `ADMIN` | Upload 1 ảnh vé — trả URL gốc để đặt vào `UpdateRouteTransportDto.transports[].ticketImageUrl` |
| POST | `/v1/business-trips/:id/upload-attachment` | Chủ đơn, `HR`, `ADMIN` | Upload tối đa 10 file đính kèm báo cáo — trả mảng URLs gốc để đặt vào `CreateTripReportDto.attachmentUrls` |
| POST | `/v1/business-trips/:id/report` | Chủ nhân (khi `APPROVED` hoặc `IN_PROGRESS`) | Tạo báo cáo công tác (đính kèm ảnh) |
| PATCH | `/v1/business-trips/:id/report` | Chủ nhân (báo cáo đang `DRAFT`) | Cập nhật báo cáo |
| PATCH | `/v1/business-trips/:id/report/submit` | Chủ nhân | Nộp báo cáo → chuyến công tác thành `COMPLETED` |

> **Lưu ý thứ tự route:** `/business-trips/me`, `/business-trips/pending-for-me`, và `/business-trips/routes/:routeId/transport` được khai báo **trước** hoặc song song với `/:id`. FE không cần lo, chỉ dùng path đúng.

---

## Meta — Danh sách trạng thái (dùng cho filter / badge)

`GET /v1/meta-data/business-trip-statuses` (mọi user đã đăng nhập) trả về đúng thứ tự dùng cho dropdown filter và mapping `status → statusLabel`. FE **nên gọi endpoint này** thay vì hardcode label để giữ đồng bộ với BE.

**Response 200:**

```json
{
	"success": true,
	"data": [
		{ "value": "DRAFT", "label": "Nháp" },
		{ "value": "PENDING", "label": "Chờ duyệt" },
		{ "value": "APPROVED", "label": "Đã duyệt" },
		{ "value": "REJECTED", "label": "Bị từ chối" },
		{ "value": "IN_PROGRESS", "label": "Đang công tác" },
		{ "value": "COMPLETED", "label": "Hoàn thành" },
		{ "value": "CANCELLED", "label": "Đã huỷ" }
	]
}
```

- `value` khớp `BusinessTripStatus` trong response chi tiết đơn (field `status`).
- `label` khớp đúng chuỗi `statusLabel` mà BE trả trong response chi tiết đơn — dùng chung 1 nguồn nên không lệch nhau.
- Kết quả tĩnh, an toàn để cache in-memory ở FE cho toàn phiên đăng nhập.

---

## Presigned URLs — Ảnh/file đã được sign, dùng trực tiếp

Bucket lưu trữ là **private**. Backend đã tự sign toàn bộ URL trước khi trả về, FE **không cần** tự sign lại.

| Field                                  | Kiểu             | Được sign                                               |
| -------------------------------------- | ---------------- | ------------------------------------------------------- |
| `routes[].transports[].ticketImageUrl` | `string \| null` | ✅ presigned, dùng trực tiếp trong `<img>` / `<a href>` |
| `report.attachmentUrls[]`              | `string[]`       | ✅ mỗi phần tử đã presigned, dùng trực tiếp             |

- URL presigned có TTL 3600s (1 giờ). Nếu user mở lại tab sau > 1 giờ, gọi lại API để lấy URL mới.
- Nếu sign lỗi (file bị xoá, key sai), field sẽ về `null` (transport) hoặc bị filter khỏi mảng (report). FE handle như file không tồn tại.
- Khi FE **upload** ảnh vé / file đính kèm, gọi module upload trước để nhận URL gốc, rồi truyền URL đó vào body của `updateRouteTransport` / `createReport`. Không gửi presigned URL ngược lại về BE.

---

## TypeScript Types

```typescript
// types/business-trip.types.ts

export type BusinessTripStatus =
	| 'DRAFT'
	| 'PENDING'
	| 'APPROVED'
	| 'IN_PROGRESS'
	| 'COMPLETED'
	| 'REJECTED'
	| 'CANCELLED';

export type TripReportStatus = 'DRAFT' | 'SUBMITTED';

export type TransportType = 'PLANE' | 'TRAIN' | 'CAR' | 'OTHER';
export type DesiredTimeType = 'ARRIVAL' | 'PICKUP';

export interface TripCompanion {
	employeeId: number;
}

// ── Route + Transport ──

export interface TripTransportResponse {
	id: number;
	order: number; // thứ tự phương tiện trong lộ trình
	transportType: TransportType;
	pickupLocation: string | null;
	dropLocation: string | null;
	pickupTime: string | null; // ISO 8601
	dropTime: string | null; // ISO 8601
	licensePlate: string | null;
	driverPhone: string | null;
	flightNumber: string | null;
	checkInTime: string | null; // ISO 8601 — giờ check-in sân bay/bến
	ticketImageUrl: string | null; // URL ảnh vé — đã presigned, dùng trực tiếp
	note: string | null;
}

export interface TripRouteResponse {
	id: number;
	order: number; // 1..N — thứ tự lộ trình trong chuyến
	pickupPoint: string; // điểm xuất phát mong muốn
	dropPoint: string; // điểm đến mong muốn
	desiredTimeType: DesiredTimeType; // 'ARRIVAL' = giờ phải có mặt tại dropPoint · 'PICKUP' = giờ xe/máy bay đón
	desiredTime: string | null; // ISO 8601 — giờ mong muốn tương ứng desiredTimeType
	isSelfTransport: boolean; // true = nhân viên tự túc di chuyển (transports[] rỗng)
	transports: TripTransportResponse[]; // do HR cập nhật sau khi trip APPROVED
}

// ── Report ──

export interface TripReportResponse {
	id: number;
	summary: string; // min 20 ký tự
	results: string; // min 20 ký tự
	actualCost: number | null;
	issues: string | null;
	attachmentUrls: string[]; // ảnh/tài liệu đính kèm báo cáo — mỗi URL đã presigned
	status: TripReportStatus;
	submittedAt: string | null; // ISO 8601
}

// ── Employee summaries ──

export interface BusinessTripEmployee {
	id: number;
	fullName: string;
	employeeCode: string;
	department: string | null; // tên phòng ban (không phải object)
}

export interface BusinessTripApprover {
	id: number;
	fullName: string;
}

export interface BusinessTripCreatedFor {
	id: number;
	fullName: string;
	employeeCode: string;
}

// ── Response đầy đủ ──

export interface BusinessTripResponse {
	id: number;
	title: string;
	destination: string;
	purpose: string;
	startDate: string; // "YYYY-MM-DD"
	endDate: string; // "YYYY-MM-DD"
	totalDays: number; // số ngày làm việc (trừ T7/CN/lễ)
	estimatedCost: number | null;
	transportType: TransportType | null; // legacy — luôn null cho đơn mới (transport nằm ở TripRoute.transports)
	companions: TripCompanion[] | null;
	routes: TripRouteResponse[]; // luôn ≥ 1
	status: BusinessTripStatus;
	statusLabel: string; // "Nháp" | "Chờ duyệt" | "Đã duyệt" | "Đang công tác" | "Hoàn thành" | "Bị từ chối" | "Đã huỷ"
	approver: BusinessTripApprover | null;
	approvedAt: string | null; // ISO 8601
	autoApproved: boolean; // true nếu HR nộp không chọn approver → auto-approve
	rejectedAt: string | null; // ISO 8601
	rejectNote: string | null;
	report: TripReportResponse | null;
	employee: BusinessTripEmployee; // người đi công tác (chủ đơn)
	createdForEmployee: BusinessTripCreatedFor | null; // != null khi HR tạo đơn hộ người khác
	// Computed flags — dùng để show/hide buttons
	canSubmit: boolean; // true nếu là chủ nhân và status === DRAFT
	canApprove: boolean; // true nếu là người duyệt và status === PENDING
	canAddReport: boolean; // true nếu là chủ nhân và status === APPROVED hoặc IN_PROGRESS
	canCancel: boolean; // true nếu là chủ nhân và status === DRAFT hoặc PENDING
	createdAt: string; // ISO 8601
}

// ── Request DTOs ──

export interface CreateTripRouteDto {
	pickupPoint: string; // min 2 ký tự — điểm xuất phát
	dropPoint: string; // min 2 ký tự — điểm đến
	desiredTimeType: DesiredTimeType;
	desiredTime?: string; // ISO 8601 — có thể null nếu chưa xác định giờ
}

export interface CreateBusinessTripDto {
	title: string; // min 3 ký tự
	destination: string; // min 2 ký tự
	purpose: string; // min 10 ký tự
	startDate: string; // "YYYY-MM-DD"
	endDate: string; // "YYYY-MM-DD" — phải >= startDate
	estimatedCost?: number; // >= 0
	companions?: Array<{ employeeId: number }>;
	routes: CreateTripRouteDto[]; // BẮT BUỘC, tối thiểu 1 lộ trình
	createdForEmployeeId?: number; // HR/ADMIN only: ID nhân viên đi công tác (khi HR tạo hộ)
}

export type UpdateBusinessTripDto = Partial<Omit<CreateBusinessTripDto, 'routes' | 'createdForEmployeeId'>>;

export interface SubmitBusinessTripDto {
	approverId?: number; // Bắt buộc với EMPLOYEE/MANAGER/CHIEF. HR/ADMIN bỏ trống → auto-approve
}

export interface RejectBusinessTripDto {
	note: string; // lý do từ chối
}

// ── HR cập nhật phương tiện ──

export interface CreateTripTransportDto {
	order: number; // 1..N — thứ tự phương tiện
	transportType: TransportType;
	pickupLocation?: string;
	dropLocation?: string;
	pickupTime?: string; // ISO 8601
	dropTime?: string; // ISO 8601
	licensePlate?: string;
	driverPhone?: string;
	flightNumber?: string;
	checkInTime?: string; // ISO 8601
	ticketImageUrl?: string;
	note?: string;
}

// Gửi một trong hai:
//   { isSelfTransport: true }              → đánh dấu tự túc, xoá hết transports
//   { transports: [...] }                  → thay thế toàn bộ transports của route
export interface UpdateRouteTransportDto {
	isSelfTransport?: boolean;
	transports?: CreateTripTransportDto[]; // ≥ 1 phần tử khi không dùng isSelfTransport
}

// ── Report ──

export interface CreateTripReportDto {
	summary: string; // min 20 ký tự
	results: string; // min 20 ký tự
	actualCost?: number;
	issues?: string;
	attachmentUrls?: string[]; // URL ảnh/tài liệu (đã upload trước qua module upload)
}

export type UpdateTripReportDto = Partial<CreateTripReportDto>;

export interface QueryBusinessTripsParams {
	page?: number; // default 1
	limit?: number; // default 20, max 100
	status?: BusinessTripStatus;
	departmentId?: number;
	employeeId?: number;
}
```

---

## Status Flow

```
                       submit(approverId)
     DRAFT ───────────────────────────────────► PENDING
       │                                            │
       │  HR submit không chọn approverId           │
       │  → auto-approve (autoApproved = true)      │
       │                                            │
       │                                approve()    │  reject()
       │                                   ▼         ▼
       └────────────────────────────► APPROVED    REJECTED
                                          │
                                          │ HR có thể PATCH routes/:id/transport
                                          │ (không chuyển trạng thái)
                                          │
                    (cron 00:15 khi startDate đến)
                                          │
                                          ▼
                                     IN_PROGRESS
                                          │
                              submitReport()
                                          │
                                          ▼
                                     COMPLETED

  DRAFT  ─┐
          ├── cancel() ──►  CANCELLED
  PENDING ┘
```

**Quy tắc:**

- `submit` bởi HR/ADMIN mà bỏ trống `approverId` → thẳng lên `APPROVED`, `autoApproved: true`, không notify approver.
- `cancel` chỉ khả dụng khi `status ∈ {DRAFT, PENDING}`. Nếu đang `PENDING`, approver cũ sẽ nhận notification huỷ.
- `updateRouteTransport` chỉ khả dụng khi trip đang `APPROVED`. Payload phải chọn 1 trong 2 nhánh: `isSelfTransport: true` (xoá transports) HOẶC `transports: [...]` (replace toàn bộ).
- Chỉ chủ nhân (`employeeId`) mới được `update`, tạo/cập nhật report.
- Chỉ người được chỉ định (`approverId`) mới được `approve`/`reject` (HR/MANAGER/CHIEF/ADMIN vẫn được nếu là approver được chọn).
- Report bắt buộc trước khi chuyến công tác được ghi nhận hoàn thành.

---

## Route & Transport — Luồng HR cập nhật phương tiện

Nhân viên khi tạo đơn chỉ khai báo **lộ trình mong muốn** (`pickupPoint`, `dropPoint`, `desiredTimeType`, `desiredTime`). Phương tiện cụ thể do **HR** cập nhật sau khi đơn được `APPROVED`.

**Luồng:**

```
1. Employee POST /business-trips
   body: { ..., routes: [{ pickupPoint, dropPoint, desiredTimeType, desiredTime }] }
   → mỗi route được lưu với isSelfTransport = false, transports = []

2. Đơn được submit → approve (hoặc HR auto-approve)
   → status = APPROVED

3. HR mở màn hình quản lý → GET /business-trips/:id
   → đọc trip.routes[] — mỗi route hiện đang trống transports

4. Với TỪNG route, HR quyết định 1 trong 2 nhánh:
   ┌─────────────────────────────────────────────────────────────┐
   │ (a) Nhân viên tự túc di chuyển                              │
   │     PATCH /business-trips/routes/:routeId/transport         │
   │     body: { "isSelfTransport": true }                       │
   │     → BE xoá hết transports, set isSelfTransport = true     │
   ├─────────────────────────────────────────────────────────────┤
   │ (b) Cung cấp phương tiện                                    │
   │     PATCH /business-trips/routes/:routeId/transport         │
   │     body: { "transports": [ { order: 1, ... }, ... ] }      │
   │     → BE REPLACE toàn bộ transports cũ, isSelfTransport=false│
   │     → 1 route có thể có nhiều transports (đổi chặng)        │
   └─────────────────────────────────────────────────────────────┘

5. Sau khi update:
   - Chủ đơn nhận notification tự động (title "🚗 Thông tin phương tiện đã cập nhật")
   - Response trả về TOÀN BỘ trip (routes+transports mới nhất) → FE state cập nhật ngay
```

**Ràng buộc quan trọng:**

- Endpoint yêu cầu `trip.status === APPROVED`. Nếu trip đã `IN_PROGRESS`/`COMPLETED`/`CANCELLED`/`REJECTED` → 400.
- Không có endpoint riêng để "thêm 1 transport" hay "sửa 1 transport" — luôn là **replace toàn bộ danh sách** của route đó.
- Trường hợp muốn quay lại "tự túc" sau khi đã thêm transports → gọi lại với `{ isSelfTransport: true }`, BE tự xoá transports cũ.
- Trường hợp muốn quay lại "có phương tiện" sau khi đã đánh dấu tự túc → gọi lại với `{ transports: [...] }`, BE tự set `isSelfTransport = false`.

---

## desiredTimeType — Rendering guide

Field `route.desiredTimeType` thể hiện ý nghĩa của `desiredTime` mà nhân viên khai:

| Giá trị     | Ý nghĩa                                              | Label FE gợi ý   | Icon gợi ý |
| ----------- | ---------------------------------------------------- | ---------------- | ---------- |
| `'ARRIVAL'` | Cần **có mặt** tại `dropPoint` vào giờ này           | "Cần có mặt lúc" | 🎯 / 📍    |
| `'PICKUP'`  | Cần **xe/máy bay đón** tại `pickupPoint` vào giờ này | "Cần xe đón lúc" | 🚗 / ⏰    |

**Ví dụ hiển thị:**

```
Lộ trình 1: Văn phòng HCM → Sân bay Tân Sơn Nhất
  🎯 Cần có mặt lúc: 06:30 01/07/2026    (desiredTimeType = ARRIVAL)

Lộ trình 2: Sân bay Nội Bài → Khách sạn Hà Nội
  🚗 Cần xe đón lúc: 10:30 01/07/2026    (desiredTimeType = PICKUP)
```

**Khi FE render form tạo đơn:** cho user chọn 1 trong 2 loại qua radio/segmented control, rồi hiện datetime picker với label tương ứng. Payload gửi lên đúng `'ARRIVAL' | 'PICKUP'`.

`desiredTime` có thể `null` nếu nhân viên chưa xác định giờ cụ thể — FE hiển thị "Chưa xác định".

---

## Attendance Note — Cron tự động tạo chấm công

Sau khi đơn được **APPROVED**, hệ thống có cron job chạy lúc `00:15 Asia/Ho_Chi_Minh` mỗi ngày:

- Với mỗi chuyến công tác đang `APPROVED` hoặc `IN_PROGRESS` mà ngày hôm qua nằm trong khoảng `[startDate, endDate]`
- Nếu chưa có AttendanceRecord cho ngày đó → tự động tạo record với `workType = 'BUSINESS_TRIP'`, `status = PRESENT`, `isManual = true`
- Khi ngày kết thúc đã qua → đánh dấu `attendanceRecordsCreated = true` để không tạo lại

**Frontend không cần trigger gì.** Chỉ cần hiển thị trong màn hình chấm công rằng ngày đó nhân viên đi công tác.

---

## totalDays — Số ngày làm việc

`totalDays` được tính **server-side** khi tạo đơn. Không cần tự tính phía client.

Công thức: số ngày từ `startDate` đến `endDate` (bao gồm hai đầu), bỏ thứ 7, chủ nhật và ngày lễ theo lịch hệ thống.

Ví dụ: `startDate = "2026-07-01"` (Thứ 4), `endDate = "2026-07-05"` (Chủ nhật) → `totalDays = 4` (bỏ CN).

---

## GET /v1/business-trips/me

**Query params:** `?status=PENDING&page=1&limit=20`

**Response:** `ApiPaginated<BusinessTripResponse>`

```json
{
	"success": true,
	"data": [
		{
			"id": 1,
			"title": "Khảo sát thị trường Hà Nội",
			"destination": "Hà Nội",
			"purpose": "Gặp gỡ đối tác và ký hợp đồng",
			"startDate": "2026-07-01",
			"endDate": "2026-07-03",
			"totalDays": 3,
			"estimatedCost": 5000000,
			"transportType": null,
			"companions": [{ "employeeId": 5 }],
			"routes": [
				{
					"id": 10,
					"order": 1,
					"pickupPoint": "Văn phòng HCM",
					"dropPoint": "Sân bay Tân Sơn Nhất",
					"desiredTimeType": "ARRIVAL",
					"desiredTime": "2026-07-01T06:30:00.000Z",
					"isSelfTransport": false,
					"transports": [
						{
							"id": 100,
							"order": 1,
							"transportType": "CAR",
							"pickupLocation": "Văn phòng HCM",
							"dropLocation": "Sân bay Tân Sơn Nhất",
							"pickupTime": "2026-07-01T05:30:00.000Z",
							"dropTime": "2026-07-01T06:30:00.000Z",
							"licensePlate": "51G-12345",
							"driverPhone": "0901234567",
							"flightNumber": null,
							"checkInTime": null,
							"ticketImageUrl": null,
							"note": "Xe công ty"
						}
					]
				},
				{
					"id": 11,
					"order": 2,
					"pickupPoint": "Sân bay Tân Sơn Nhất",
					"dropPoint": "Sân bay Nội Bài",
					"desiredTimeType": "PICKUP",
					"desiredTime": "2026-07-01T08:00:00.000Z",
					"isSelfTransport": false,
					"transports": [
						{
							"id": 101,
							"order": 1,
							"transportType": "PLANE",
							"pickupLocation": "Sân bay Tân Sơn Nhất",
							"dropLocation": "Sân bay Nội Bài",
							"pickupTime": "2026-07-01T08:00:00.000Z",
							"dropTime": "2026-07-01T10:15:00.000Z",
							"licensePlate": null,
							"driverPhone": null,
							"flightNumber": "VN123",
							"checkInTime": "2026-07-01T07:00:00.000Z",
							"ticketImageUrl": "https://s3-read.example.com/hr-documents/tickets/vn123.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Expires=3600&X-Amz-Signature=...",
							"note": null
						}
					]
				}
			],
			"status": "APPROVED",
			"statusLabel": "Đã duyệt",
			"approver": { "id": 3, "fullName": "Trần Thị B" },
			"approvedAt": "2026-06-25T08:30:00.000Z",
			"autoApproved": false,
			"rejectedAt": null,
			"rejectNote": null,
			"report": null,
			"employee": {
				"id": 4,
				"fullName": "Nguyễn Văn A",
				"employeeCode": "EMP004",
				"department": "Kỹ thuật"
			},
			"createdForEmployee": null,
			"canSubmit": false,
			"canApprove": false,
			"canAddReport": true,
			"canCancel": false,
			"createdAt": "2026-06-20T10:00:00.000Z"
		}
	],
	"meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
}
```

---

## POST /v1/business-trips — Tạo đơn

`routes` **bắt buộc** tối thiểu 1 lộ trình. `transportType` trên trip đã bị bỏ — phương tiện nằm trong `routes[].transports[]` do HR cập nhật sau khi duyệt.

**Request body (employee tự tạo):**

```json
{
	"title": "Khảo sát thị trường Hà Nội",
	"destination": "Hà Nội",
	"purpose": "Gặp gỡ đối tác và ký hợp đồng để mở rộng thị trường",
	"startDate": "2026-07-01",
	"endDate": "2026-07-03",
	"estimatedCost": 5000000,
	"companions": [{ "employeeId": 5 }],
	"routes": [
		{
			"pickupPoint": "Văn phòng HCM",
			"dropPoint": "Sân bay Tân Sơn Nhất",
			"desiredTimeType": "ARRIVAL",
			"desiredTime": "2026-07-01T06:30:00.000Z"
		},
		{
			"pickupPoint": "Sân bay Nội Bài",
			"dropPoint": "Khách sạn Hà Nội",
			"desiredTimeType": "PICKUP",
			"desiredTime": "2026-07-01T10:30:00.000Z"
		}
	]
}
```

**Request body (HR tạo hộ nhân viên khác):**

```json
{
	"title": "...",
	"destination": "...",
	"purpose": "...",
	"startDate": "2026-07-01",
	"endDate": "2026-07-03",
	"routes": [
		{
			"pickupPoint": "...",
			"dropPoint": "...",
			"desiredTimeType": "ARRIVAL",
			"desiredTime": "2026-07-01T08:00:00.000Z"
		}
	],
	"createdForEmployeeId": 5
}
```

Khi có `createdForEmployeeId` và người gọi là HR/ADMIN, `employeeId` (chủ đơn) sẽ là nhân viên đó và `createdForEmployee` được điền trong response.

**Response 201:** `ApiSuccess<BusinessTripResponse>` với `status = "DRAFT"`, `canSubmit = true`, `canCancel = true`.

**400** nếu `endDate < startDate`, `routes` rỗng, hoặc `desiredTimeType` không thuộc `ARRIVAL|PICKUP`.

---

## PATCH /v1/business-trips/:id — Cập nhật đơn

Chỉ khi `status === DRAFT`. Không cập nhật được `routes` qua endpoint này ở phiên bản hiện tại — nếu cần đổi lộ trình, xoá đơn draft và tạo lại.

---

## PATCH /v1/business-trips/:id/submit — Nộp đơn

**Employee/Manager/Chief:** bắt buộc `approverId`, đơn chuyển `PENDING`.

**HR/ADMIN:**

- Có `approverId` → như flow bình thường (`PENDING`).
- Bỏ trống `approverId` → **auto-approve**: `status = APPROVED`, `autoApproved = true`, `approvedAt = now`, không cần approver, notify chủ đơn.

**Request body:**

```json
{ "approverId": 3 }
```

hoặc HR gửi rỗng:

```json
{}
```

**Response 200:** `BusinessTripResponse` với `status = "PENDING"` (hoặc `APPROVED` nếu HR auto-approve).

**400** nếu đơn không ở `DRAFT`, hoặc user thường bỏ trống `approverId`.

---

## PATCH /v1/business-trips/:id/approve — Duyệt đơn

Không cần request body. Chỉ approver được chỉ định (hoặc HR/ADMIN/MANAGER/CHIEF theo role check) mới gọi được.

**Response 200:** `BusinessTripResponse` với `status = "APPROVED"`.

---

## PATCH /v1/business-trips/:id/reject — Từ chối đơn

**Request body:**

```json
{ "note": "Chưa đủ ngân sách quý này" }
```

**Response 200:** `BusinessTripResponse` với `status = "REJECTED"`.

---

## PATCH /v1/business-trips/:id/cancel — Huỷ đơn

Không cần request body. Chủ nhân hoặc HR/ADMIN.

**Điều kiện:**

- `status ∈ {DRAFT, PENDING}` — không huỷ được sau khi đã duyệt.

**Side effect:**

- Nếu đang `PENDING`, approver cũ nhận notification `businessTripCancelledByOwner`.
- Chủ đơn nhận notification `businessTripCancelledOwner`.

**Response 200:** `BusinessTripResponse` với `status = "CANCELLED"`, `canCancel = false`, `canSubmit = false`.

**400** nếu đơn ở trạng thái khác `DRAFT`/`PENDING`. **403** nếu không phải chủ nhân/HR/ADMIN.

---

## PATCH /v1/business-trips/routes/:routeId/transport — HR cập nhật phương tiện

Chỉ **HR/ADMIN**. Chỉ khi trip cha đang `APPROVED`.

**Route:** `PATCH /v1/business-trips/routes/{routeId}/transport` (chú ý path — `routeId` là ID của `TripRoute`, không phải trip).

**Nhánh 1 — HR đánh dấu nhân viên tự túc:**

```json
{ "isSelfTransport": true }
```

Server sẽ xoá toàn bộ `transports[]` của route và set `isSelfTransport = true`.

**Nhánh 2 — HR cập nhật danh sách phương tiện:**

```json
{
	"transports": [
		{
			"order": 1,
			"transportType": "CAR",
			"pickupLocation": "Văn phòng HCM",
			"dropLocation": "Sân bay Tân Sơn Nhất",
			"pickupTime": "2026-07-01T05:30:00.000Z",
			"dropTime": "2026-07-01T06:30:00.000Z",
			"licensePlate": "51G-12345",
			"driverPhone": "0901234567",
			"note": "Xe công ty"
		},
		{
			"order": 2,
			"transportType": "PLANE",
			"flightNumber": "VN123",
			"pickupTime": "2026-07-01T08:00:00.000Z",
			"dropTime": "2026-07-01T10:15:00.000Z",
			"checkInTime": "2026-07-01T07:00:00.000Z",
			"ticketImageUrl": "https://s3/bucket/tickets/vn123.jpg"
		}
	]
}
```

Server sẽ **replace toàn bộ** transports cũ bằng danh sách mới, `isSelfTransport = false`.

`ticketImageUrl` trong body phải là URL **gốc** nhận từ module upload (chưa sign). BE lưu nguyên và sẽ tự sign khi trả về response.

**Side effect:** Chủ đơn nhận notification `businessTripTransportUpdated` cho `routeOrder` tương ứng.

**Response 200:** `BusinessTripResponse` (toàn bộ trip đã include routes+transports mới).

**400** nếu:

- Trip cha không phải `APPROVED`
- Không truyền `isSelfTransport: true` mà cũng không truyền `transports` (hoặc `transports` rỗng)

**403** nếu user không phải HR/ADMIN. **404** nếu `routeId` không tồn tại.

---

## POST /v1/business-trips/:id/report — Tạo báo cáo

Chỉ tạo được khi `status === APPROVED` hoặc `IN_PROGRESS`. Mỗi chuyến chỉ có 1 báo cáo.

**Request body:**

```json
{
	"summary": "Đã hoàn thành chuyến công tác, gặp gỡ 3 đối tác quan trọng tại Hà Nội",
	"results": "Ký kết thành công hợp đồng hợp tác trị giá 500 triệu đồng với đối tác ABC",
	"actualCost": 4800000,
	"issues": "Thời tiết xấu làm chậm một số lịch họp",
	"attachmentUrls": ["https://s3/bucket/reports/photo1.jpg", "https://s3/bucket/reports/contract-signed.pdf"]
}
```

`attachmentUrls` là mảng string tuỳ chọn — FE upload ảnh/file qua module upload trước, nhận URL gốc (chưa sign), rồi truyền vào đây. BE lưu URL gốc và tự sign lại khi trả về response — xem section [Presigned URLs](#presigned-urls--ảnhfile-đã-được-sign-dùng-trực-tiếp).

**Response 201:** `BusinessTripResponse` với `report` đã được điền, `report.status = "DRAFT"`, `report.attachmentUrls = [...]`.

**400** nếu đơn chưa được duyệt hoặc đã có báo cáo.

---

## PATCH /v1/business-trips/:id/report — Cập nhật báo cáo

Chỉ khi `report.status === DRAFT`. Body dùng `UpdateTripReportDto` (partial). Có thể cập nhật `attachmentUrls` (thay thế toàn bộ mảng).

---

## PATCH /v1/business-trips/:id/report/submit — Nộp báo cáo

Không cần request body. Sau khi nộp:

- `report.status` → `"SUBMITTED"`
- `business_trip.status` → `"COMPLETED"`

**Response 200:** `BusinessTripResponse` với `status = "COMPLETED"`.

**400** nếu báo cáo đã được nộp rồi.

---

## File Upload Endpoints

Trước khi gọi `PATCH /routes/:routeId/transport` (ticket) hoặc `POST /:id/report` (attachments), FE **upload file trước** qua 2 endpoint dưới để nhận URL gốc rồi gán vào body payload tương ứng. BE tự sign URL khi trả về trip detail — xem [Presigned URLs](#presigned-urls--ảnhfile-đã-được-sign-dùng-trực-tiếp).

### POST /v1/business-trips/routes/:routeId/upload-ticket — Upload ảnh vé

- **Roles:** `HR`, `ADMIN`
- **Content-Type:** `multipart/form-data`
- **Field:** `file` (single)
- **Allowed mime:** `image/jpeg`, `image/png`, `application/pdf`
- **Size max:** 10 MB
- **Path R2:** `trip-transport/{tripId}/tickets/{uuid}.{ext}` (tripId lấy từ route)

**Response 201:**

```json
{ "success": true, "data": { "url": "https://hr-documents.s3.example.com/trip-transport/42/tickets/abc.jpg" } }
```

`url` là **URL gốc chưa sign** — FE gán vào field `ticketImageUrl` của một phần tử trong `UpdateRouteTransportDto.transports[]` khi gọi `PATCH /routes/:routeId/transport`.

**Errors:**

- 400: File thiếu hoặc sai mime/size
- 403: Không phải HR/ADMIN
- 404: Lộ trình không tồn tại

---

### POST /v1/business-trips/:id/upload-attachment — Upload file đính kèm báo cáo

- **Roles:** Chủ đơn (bao gồm `createdForEmployeeId`), `HR`, `ADMIN`
- **Content-Type:** `multipart/form-data`
- **Field:** `files` (array, tối đa 10 file)
- **Allowed mime:** `image/jpeg`, `image/png`, `application/pdf`, DOCX (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`)
- **Size max:** 10 MB / file
- **Path R2:** `trip-report/{tripId}/attachments/{uuid}.{ext}`

**Response 201:**

```json
{
	"success": true,
	"data": {
		"urls": [
			"https://hr-documents.s3.example.com/trip-report/42/attachments/photo1.jpg",
			"https://hr-documents.s3.example.com/trip-report/42/attachments/contract.pdf"
		]
	}
}
```

`urls[]` là mảng **URL gốc chưa sign** — FE gán trực tiếp vào `CreateTripReportDto.attachmentUrls` hoặc `UpdateTripReportDto.attachmentUrls`.

**Errors:**

- 400: Không có file, sai mime/size, hoặc > 10 file
- 403: Không phải chủ đơn / HR / ADMIN
- 404: Đơn không tồn tại

---

## Composable — useBusinessTrips

```typescript
// composables/useBusinessTrips.ts
import type {
	BusinessTripResponse,
	CreateBusinessTripDto,
	UpdateBusinessTripDto,
	SubmitBusinessTripDto,
	RejectBusinessTripDto,
	CreateTripReportDto,
	UpdateTripReportDto,
	UpdateRouteTransportDto,
	QueryBusinessTripsParams,
} from '~/types/business-trip.types';

export function useBusinessTrips() {
	const { get, list, post, patch } = useFetch();

	const fetchMyTrips = (params?: QueryBusinessTripsParams) =>
		list<BusinessTripResponse>('/v1/business-trips/me', { params });

	const fetchPendingForMe = () => list<BusinessTripResponse>('/v1/business-trips/pending-for-me');

	const fetchAllTrips = (params?: QueryBusinessTripsParams) =>
		list<BusinessTripResponse>('/v1/business-trips', { params });

	const fetchTrip = (id: number) => get<BusinessTripResponse>(`/v1/business-trips/${id}`);

	const createTrip = (dto: CreateBusinessTripDto) => post<BusinessTripResponse>('/v1/business-trips', dto);

	const updateTrip = (id: number, dto: UpdateBusinessTripDto) =>
		patch<BusinessTripResponse>(`/v1/business-trips/${id}`, dto);

	const submitTrip = (id: number, dto: SubmitBusinessTripDto) =>
		patch<BusinessTripResponse>(`/v1/business-trips/${id}/submit`, dto);

	const approveTrip = (id: number) => patch<BusinessTripResponse>(`/v1/business-trips/${id}/approve`, {});

	const rejectTrip = (id: number, dto: RejectBusinessTripDto) =>
		patch<BusinessTripResponse>(`/v1/business-trips/${id}/reject`, dto);

	const cancelTrip = (id: number) => patch<BusinessTripResponse>(`/v1/business-trips/${id}/cancel`, {});

	const updateRouteTransport = (routeId: number, dto: UpdateRouteTransportDto) =>
		patch<BusinessTripResponse>(`/v1/business-trips/routes/${routeId}/transport`, dto);

	const uploadTripTicket = (routeId: number, file: File) => {
		const form = new FormData();
		form.append('file', file);
		return post<{ url: string }>(`/v1/business-trips/routes/${routeId}/upload-ticket`, form);
	};

	const uploadTripAttachments = (tripId: number, files: File[]) => {
		const form = new FormData();
		files.forEach(f => form.append('files', f));
		return post<{ urls: string[] }>(`/v1/business-trips/${tripId}/upload-attachment`, form);
	};

	const createReport = (id: number, dto: CreateTripReportDto) =>
		post<BusinessTripResponse>(`/v1/business-trips/${id}/report`, dto);

	const updateReport = (id: number, dto: UpdateTripReportDto) =>
		patch<BusinessTripResponse>(`/v1/business-trips/${id}/report`, dto);

	const submitReport = (id: number) => patch<BusinessTripResponse>(`/v1/business-trips/${id}/report/submit`, {});

	return {
		fetchMyTrips,
		fetchPendingForMe,
		fetchAllTrips,
		fetchTrip,
		createTrip,
		updateTrip,
		submitTrip,
		approveTrip,
		rejectTrip,
		cancelTrip,
		updateRouteTransport,
		uploadTripTicket,
		uploadTripAttachments,
		createReport,
		updateReport,
		submitReport,
	};
}
```

---

## Edge Cases

| Tình huống | Kết quả |
| --- | --- |
| `EMPLOYEE` gọi `GET /business-trips` | 403 Forbidden |
| `EMPLOYEE` gọi `GET /business-trips/pending-for-me` | 403 Forbidden |
| Tạo đơn với `routes: []` hoặc thiếu `routes` | 400 Bad Request |
| Tạo đơn với `desiredTimeType` không phải `ARRIVAL`/`PICKUP` | 400 Bad Request |
| Employee thường truyền `createdForEmployeeId` | Field bị bỏ qua, đơn được tạo cho chính user |
| Cập nhật đơn khi `status !== DRAFT` | 400 Bad Request |
| Submit đơn với `approverId` là nhân viên không active | 400 Bad Request |
| HR submit không kèm `approverId` | Auto-approve, `autoApproved = true` |
| User thường submit không kèm `approverId` | 400 Bad Request ("Vui lòng chọn người duyệt") |
| Người không phải `approverId` gọi approve | 403 Forbidden (trừ HR/ADMIN/MANAGER/CHIEF) |
| Cancel khi `status !== DRAFT/PENDING` | 400 Bad Request |
| Non-owner + non-HR gọi cancel | 403 Forbidden |
| `updateRouteTransport` khi trip chưa APPROVED | 400 Bad Request |
| `updateRouteTransport` với payload rỗng (không `isSelfTransport`, không `transports`) | 400 Bad Request |
| Non-HR gọi `updateRouteTransport` | 403 Forbidden |
| Tạo báo cáo khi `status === DRAFT/PENDING/CANCELLED` | 400 Bad Request |
| Tạo báo cáo khi đã có báo cáo rồi | 400 Bad Request |
| Submit báo cáo khi đã SUBMITTED | 400 Bad Request |
| `totalDays` trả về `0` | Xảy ra khi cả khoảng ngày đều rơi vào T7/CN/lễ |
| `companions` là `null` | Đơn đi một mình, không có người đi cùng |
| `routes[].isSelfTransport = true` | Nhân viên tự túc — `transports` rỗng, HR không cập nhật thêm |
| `canApprove = true` | Chỉ khi `user.id === approver.id && status === PENDING` |
| `canCancel = true` | Chỉ khi `user.id === employee.id && status ∈ {DRAFT, PENDING}` |
| `report = null` | Chưa tạo báo cáo |
| `report.attachmentUrls = []` | Báo cáo không đính kèm file |
| `createdForEmployee != null` | HR đã tạo đơn hộ nhân viên này — vẫn dùng `employee` để hiển thị chủ đơn |
| Đơn bị `REJECTED` | `rejectedAt` và `rejectNote` được điền, các trường khác giữ nguyên |
| Đơn bị `CANCELLED` | `canSubmit = canCancel = canApprove = false` |
