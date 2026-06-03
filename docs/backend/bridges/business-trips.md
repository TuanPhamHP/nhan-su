# Bridge Docs — Công tác (`/v1/business-trips`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/business-trips/me` | Mọi user đã đăng nhập | Đơn công tác của bản thân (có phân trang) |
| GET | `/v1/business-trips/pending-for-me` | `MANAGER`, `CHIEF`, `HR`, `ADMIN` | Đơn đang chờ mình duyệt |
| GET | `/v1/business-trips` | `MANAGER`, `CHIEF`, `HR`, `ADMIN` | Tất cả đơn (có filter, phân trang) |
| POST | `/v1/business-trips` | Mọi user đã đăng nhập | Tạo đơn mới (trạng thái DRAFT) |
| GET | `/v1/business-trips/:id` | Chủ nhân, `MANAGER`, `CHIEF`, `HR`, `ADMIN` | Chi tiết một đơn |
| PATCH | `/v1/business-trips/:id` | Chủ nhân (chỉ khi DRAFT) | Cập nhật thông tin đơn |
| PATCH | `/v1/business-trips/:id/submit` | Chủ nhân (chỉ khi DRAFT) | Nộp đơn — chọn 1 người duyệt |
| PATCH | `/v1/business-trips/:id/approve` | `MANAGER`, `CHIEF`, `HR`, `ADMIN` | Duyệt đơn |
| PATCH | `/v1/business-trips/:id/reject` | `MANAGER`, `CHIEF`, `HR`, `ADMIN` | Từ chối đơn |
| POST | `/v1/business-trips/:id/report` | Chủ nhân (khi APPROVED hoặc IN_PROGRESS) | Tạo báo cáo công tác |
| PATCH | `/v1/business-trips/:id/report` | Chủ nhân (báo cáo đang DRAFT) | Cập nhật báo cáo |
| PATCH | `/v1/business-trips/:id/report/submit` | Chủ nhân | Nộp báo cáo → chuyến công tác thành COMPLETED |

> **Lưu ý thứ tự route:** `/business-trips/me` và `/business-trips/pending-for-me` được khai báo **trước** `/:id`.

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
  | 'REJECTED';

export type TripReportStatus = 'DRAFT' | 'SUBMITTED';

export type TransportType = 'PLANE' | 'TRAIN' | 'CAR' | 'OTHER';

export interface TripCompanion {
  employeeId: number;
}

export interface TripReportResponse {
  id: number;
  summary: string;       // min 20 ký tự
  results: string;       // min 20 ký tự
  actualCost: number | null;
  issues: string | null;
  status: TripReportStatus;
  submittedAt: string | null; // ISO 8601
}

export interface BusinessTripEmployee {
  id: number;
  fullName: string;
  employeeCode: string;
  department: string | null; // tên phòng ban, không phải object
}

export interface BusinessTripApprover {
  id: number;
  fullName: string;
}

// Response đầy đủ — dùng cho mọi endpoint
export interface BusinessTripResponse {
  id: number;
  title: string;
  destination: string;
  purpose: string;
  startDate: string;          // "YYYY-MM-DD"
  endDate: string;            // "YYYY-MM-DD"
  totalDays: number;          // số ngày làm việc (trừ T7, CN, lễ)
  estimatedCost: number | null;
  transportType: TransportType | null;
  companions: TripCompanion[] | null;
  status: BusinessTripStatus;
  statusLabel: string;        // "Nháp" | "Chờ duyệt" | "Đã duyệt" | "Đang công tác" | "Hoàn thành" | "Bị từ chối"
  approver: BusinessTripApprover | null;
  approvedAt: string | null;  // ISO 8601
  rejectedAt: string | null;  // ISO 8601
  rejectNote: string | null;
  report: TripReportResponse | null;
  employee: BusinessTripEmployee;
  // Computed flags — dùng để show/hide buttons
  canSubmit: boolean;   // true nếu là chủ nhân và status === DRAFT
  canApprove: boolean;  // true nếu là người duyệt và status === PENDING
  canAddReport: boolean; // true nếu là chủ nhân và status === APPROVED hoặc IN_PROGRESS
  createdAt: string;    // ISO 8601
}

// Request DTOs
export interface CreateBusinessTripDto {
  title: string;           // min 3 ký tự
  destination: string;     // min 2 ký tự
  purpose: string;         // min 10 ký tự
  startDate: string;       // "YYYY-MM-DD"
  endDate: string;         // "YYYY-MM-DD" — phải >= startDate
  estimatedCost?: number;  // >= 0
  transportType?: TransportType;
  companions?: Array<{ employeeId: number }>; // danh sách nhân viên đi cùng
}

export type UpdateBusinessTripDto = Partial<CreateBusinessTripDto>;

export interface SubmitBusinessTripDto {
  approverId: number; // ID người duyệt — phải là nhân viên ACTIVE
}

export interface RejectBusinessTripDto {
  note: string; // lý do từ chối
}

export interface CreateTripReportDto {
  summary: string;       // min 20 ký tự — tóm tắt chuyến đi
  results: string;       // min 20 ký tự — kết quả đạt được
  actualCost?: number;   // chi phí thực tế
  issues?: string;       // vấn đề phát sinh
}

export type UpdateTripReportDto = Partial<CreateTripReportDto>;

export interface QueryBusinessTripsParams {
  page?: number;        // default 1
  limit?: number;       // default 20, max 100
  status?: BusinessTripStatus;
  departmentId?: number;
  employeeId?: number;
}
```

---

## Status Flow

```
                    submit(approverId)
  DRAFT ──────────────────────────────► PENDING
                                           │
                          approve()        │  reject()
                             ▼             ▼
                          APPROVED      REJECTED
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
```

**Quy tắc:**
- Chỉ chủ nhân mới được `submit`, `update`, tạo/cập nhật report
- Chỉ người được chỉ định (`approverId`) mới được `approve`/`reject`
- `canAddReport = true` khi `status === APPROVED || status === IN_PROGRESS`
- Report bắt buộc trước khi chuyến công tác được ghi nhận hoàn thành

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
      "transportType": "PLANE",
      "companions": [{ "employeeId": 5 }],
      "status": "APPROVED",
      "statusLabel": "Đã duyệt",
      "approver": { "id": 3, "fullName": "Trần Thị B" },
      "approvedAt": "2026-06-25T08:30:00.000Z",
      "rejectedAt": null,
      "rejectNote": null,
      "report": null,
      "employee": {
        "id": 4,
        "fullName": "Nguyễn Văn A",
        "employeeCode": "EMP004",
        "department": "Kỹ thuật"
      },
      "canSubmit": false,
      "canApprove": false,
      "canAddReport": true,
      "createdAt": "2026-06-20T10:00:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
}
```

---

## POST /v1/business-trips — Tạo đơn

**Request body:**
```json
{
  "title": "Khảo sát thị trường Hà Nội",
  "destination": "Hà Nội",
  "purpose": "Gặp gỡ đối tác và ký hợp đồng để mở rộng thị trường",
  "startDate": "2026-07-01",
  "endDate": "2026-07-03",
  "estimatedCost": 5000000,
  "transportType": "PLANE",
  "companions": [{ "employeeId": 5 }]
}
```

**Response 201:** `ApiSuccess<BusinessTripResponse>` với `status = "DRAFT"`, `canSubmit = true`

**400** nếu `endDate < startDate`.

---

## PATCH /v1/business-trips/:id/submit — Nộp đơn

Chọn **đúng 1 người duyệt**. Chỉ được nộp khi `status === DRAFT`.

**Request body:**
```json
{ "approverId": 3 }
```

**Response 200:** `BusinessTripResponse` với `status = "PENDING"`

**400** nếu đơn không ở trạng thái DRAFT, hoặc người duyệt không tồn tại / không hoạt động.

---

## PATCH /v1/business-trips/:id/approve — Duyệt đơn

Không cần request body. Chỉ người được chỉ định (`approverId`) mới được gọi endpoint này.

**Response 200:** `BusinessTripResponse` với `status = "APPROVED"`

**403** nếu không phải người duyệt của đơn này.

---

## PATCH /v1/business-trips/:id/reject — Từ chối đơn

**Request body:**
```json
{ "note": "Chưa đủ ngân sách quý này" }
```

**Response 200:** `BusinessTripResponse` với `status = "REJECTED"`

---

## POST /v1/business-trips/:id/report — Tạo báo cáo

Chỉ tạo được khi `status === APPROVED` hoặc `IN_PROGRESS`. Mỗi chuyến chỉ có 1 báo cáo.

**Request body:**
```json
{
  "summary": "Đã hoàn thành chuyến công tác, gặp gỡ 3 đối tác quan trọng tại Hà Nội",
  "results": "Ký kết thành công hợp đồng hợp tác trị giá 500 triệu đồng với đối tác ABC",
  "actualCost": 4800000,
  "issues": "Thời tiết xấu làm chậm một số lịch họp"
}
```

**Response 201:** `BusinessTripResponse` với `report` đã được điền, `report.status = "DRAFT"`

**400** nếu đơn chưa được duyệt hoặc đã có báo cáo.

---

## PATCH /v1/business-trips/:id/report/submit — Nộp báo cáo

Không cần request body. Sau khi nộp:
- `report.status` → `"SUBMITTED"`
- `business_trip.status` → `"COMPLETED"`

**Response 200:** `BusinessTripResponse` với `status = "COMPLETED"`

**400** nếu báo cáo đã được nộp rồi.

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
  QueryBusinessTripsParams,
} from '~/types/business-trip.types';

export function useBusinessTrips() {
  const { get, list, post, patch } = useFetch();

  const fetchMyTrips = (params?: QueryBusinessTripsParams) =>
    list<BusinessTripResponse>('/v1/business-trips/me', { params });

  const fetchPendingForMe = () =>
    list<BusinessTripResponse>('/v1/business-trips/pending-for-me');

  const fetchAllTrips = (params?: QueryBusinessTripsParams) =>
    list<BusinessTripResponse>('/v1/business-trips', { params });

  const fetchTrip = (id: number) =>
    get<BusinessTripResponse>(`/v1/business-trips/${id}`);

  const createTrip = (dto: CreateBusinessTripDto) =>
    post<BusinessTripResponse>('/v1/business-trips', dto);

  const updateTrip = (id: number, dto: UpdateBusinessTripDto) =>
    patch<BusinessTripResponse>(`/v1/business-trips/${id}`, dto);

  const submitTrip = (id: number, dto: SubmitBusinessTripDto) =>
    patch<BusinessTripResponse>(`/v1/business-trips/${id}/submit`, dto);

  const approveTrip = (id: number) =>
    patch<BusinessTripResponse>(`/v1/business-trips/${id}/approve`, {});

  const rejectTrip = (id: number, dto: RejectBusinessTripDto) =>
    patch<BusinessTripResponse>(`/v1/business-trips/${id}/reject`, dto);

  const createReport = (id: number, dto: CreateTripReportDto) =>
    post<BusinessTripResponse>(`/v1/business-trips/${id}/report`, dto);

  const updateReport = (id: number, dto: UpdateTripReportDto) =>
    patch<BusinessTripResponse>(`/v1/business-trips/${id}/report`, dto);

  const submitReport = (id: number) =>
    patch<BusinessTripResponse>(`/v1/business-trips/${id}/report/submit`, {});

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
    createReport,
    updateReport,
    submitReport,
  };
}
```

---

## Edge Cases

| Tình huống | Kết quả |
|-----------|---------|
| `EMPLOYEE` gọi `GET /business-trips` | 403 Forbidden |
| `EMPLOYEE` gọi `GET /business-trips/pending-for-me` | 403 Forbidden |
| Cập nhật đơn khi `status !== DRAFT` | 400 Bad Request |
| Submit đơn với `approverId` là nhân viên không active | 400 Bad Request |
| Người không phải `approverId` gọi approve | 403 Forbidden |
| Tạo báo cáo khi `status === DRAFT` hoặc `PENDING` | 400 Bad Request |
| Tạo báo cáo khi đã có báo cáo rồi | 400 Bad Request |
| Submit báo cáo khi đã SUBMITTED | 400 Bad Request |
| `totalDays` trả về `0` | Xảy ra khi cả khoảng ngày đều rơi vào T7/CN/lễ |
| `companions` là `null` | Đơn đi một mình, không có người đi cùng |
| `canApprove = true` | Chỉ khi `user.id === approver.id && status === PENDING` |
| `report = null` | Chưa tạo báo cáo |
| Đơn bị REJECTED | `rejectedAt` và `rejectNote` được điền, các trường khác giữ nguyên |
