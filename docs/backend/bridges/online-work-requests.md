# Bridge Docs — Đăng ký làm việc online (`/v1/online-work-requests`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/online-work-requests/me` | Mọi user đã đăng nhập | Đơn của bản thân (có phân trang) |
| GET | `/v1/online-work-requests/pending-for-me` | `MANAGER`, `CHIEF`, `ADMIN`, `HR` | Đơn đang chờ mình duyệt |
| GET | `/v1/online-work-requests/report` | `MANAGER`, `CHIEF`, `ADMIN`, `HR` | Báo cáo thống kê theo tháng |
| GET | `/v1/online-work-requests/report/export` | `MANAGER`, `CHIEF`, `ADMIN`, `HR` | Xuất Excel báo cáo tháng |
| GET | `/v1/online-work-requests` | `MANAGER`, `CHIEF`, `ADMIN`, `HR` | Danh sách toàn bộ (có phân trang) |
| POST | `/v1/online-work-requests` | Mọi user đã đăng nhập | Tạo đơn mới |
| GET | `/v1/online-work-requests/:id` | Chính chủ, L1/L2 approver, `ADMIN`, `HR`, `CHIEF` | Chi tiết một đơn |
| PATCH | `/v1/online-work-requests/:id/approve` | `MANAGER`, `CHIEF`, `ADMIN` | Duyệt đơn |
| PATCH | `/v1/online-work-requests/:id/reject` | `MANAGER`, `CHIEF`, `ADMIN` | Từ chối đơn |
| PATCH | `/v1/online-work-requests/:id/cancel` | Mọi user đã đăng nhập | Huỷ đơn (chính chủ, chỉ khi PENDING_L1) |

> **Lưu ý thứ tự route:** `/me`, `/pending-for-me`, `/report`, `/report/export` được khai báo **trước** `/:id`.  
> Gọi các route đặc biệt này đúng path — không thêm `/` cuối.

---

## TypeScript Types

```typescript
// types/online-work-request.types.ts

export type OnlineWorkStatus =
  | 'PENDING_L1'    // Chờ duyệt cấp 1 (line manager)
  | 'PENDING_L2'    // Chờ duyệt cấp 2 (dept manager, nếu khác L1)
  | 'PENDING_L3'    // Chờ Giám đốc duyệt
  | 'COMPLETED'     // Hoàn thành — đã tạo AttendanceRecord
  | 'REJECTED'      // Bị từ chối
  | 'CANCELLED';    // Đã huỷ bởi chính chủ

export interface OnlineWorkApprover {
  id: number;
  fullName: string;
}

export interface OnlineWorkEmployee {
  id: number;
  fullName: string;
  employeeCode: string;
  department: string | null;  // tên phòng ban, không phải object
}

export interface OnlineWorkRequestResponse {
  id: number;
  startDate: string;           // "YYYY-MM-DD"
  endDate: string;             // "YYYY-MM-DD"
  totalDays: number;           // số ngày làm việc (trừ T7, CN)
  reason: string;
  status: OnlineWorkStatus;
  requiresMultiLevel: boolean; // true nếu totalDays >= 3

  employee: OnlineWorkEmployee;

  // Người được phân công duyệt (xác định lúc tạo đơn)
  approverL1: OnlineWorkApprover | null;
  approverL2: OnlineWorkApprover | null;  // null nếu L2 bị bỏ qua

  // Người thực tế đã duyệt từng cấp
  approvedL1By: OnlineWorkApprover | null;
  approvedL1At: string | null;  // ISO 8601
  approvedL2By: OnlineWorkApprover | null;
  approvedL2At: string | null;
  approvedL3By: OnlineWorkApprover | null;
  approvedL3At: string | null;

  // Thông tin từ chối
  rejectedBy: OnlineWorkApprover | null;
  rejectedAt: string | null;
  rejectNote: string | null;
  rejectLevel: number | null;  // 1, 2, hoặc 3 — cấp nào từ chối

  // Helpers cho UI
  currentLevel: 1 | 2 | 3 | null;  // null nếu đã xong (COMPLETED/REJECTED/CANCELLED)
  canBeApprovedBy: number[];        // danh sách employee id được phép duyệt hiện tại
  canBeCancelled: boolean;          // true nếu PENDING_L1 và currentUser là chính chủ
  statusLabel: string;              // text hiển thị (xem bảng Status Labels)
  createdAt: string;                // ISO 8601
}

export interface OnlineWorkMonthlyStats {
  employeeCode: string;
  fullName: string;
  departmentName: string;
  totalRequests: number;
  completedRequests: number;
  totalDaysApproved: number;  // tổng số ngày đã được duyệt (COMPLETED)
  pendingRequests: number;
  rejectedRequests: number;
}

// Request DTOs
export interface CreateOnlineWorkRequestDto {
  startDate: string;  // "YYYY-MM-DD", phải là ngày làm việc (không phải T7/CN)
  endDate: string;    // "YYYY-MM-DD", >= startDate
  reason: string;     // tối thiểu 10 ký tự
}

export interface RejectOnlineWorkDto {
  rejectNote: string;  // bắt buộc khi từ chối
}

export interface QueryOnlineWorkParams {
  status?: OnlineWorkStatus;
  departmentId?: number;
  employeeId?: number;
  startDate?: string;   // lọc đơn có startDate >= giá trị này
  endDate?: string;     // lọc đơn có endDate <= giá trị này
  page?: number;        // default 1
  limit?: number;       // default 20, max 100
}

export interface QueryOnlineWorkReportParams {
  month: number;         // 1–12, bắt buộc
  year: number;          // >= 2020, bắt buộc
  departmentId?: number; // MANAGER bị ignore (tự động scope theo phòng ban)
}
```

### Status Labels

| `status` | `statusLabel` |
|----------|---------------|
| `PENDING_L1` | Chờ duyệt cấp 1 |
| `PENDING_L2` | Chờ duyệt cấp 2 |
| `PENDING_L3` | Chờ Giám đốc duyệt |
| `COMPLETED` | Hoàn thành |
| `REJECTED` | Bị từ chối |
| `CANCELLED` | Đã huỷ |

---

## Approval Flow

`totalDays` được tính bằng số ngày làm việc thực tế trong khoảng `[startDate, endDate]`, **không tính thứ 7 và chủ nhật**.

### Kịch bản 1 — Đơn ngắn (`totalDays < 3`, `requiresMultiLevel = false`)

Chỉ cần 1 cấp duyệt. L1 duyệt → hoàn thành ngay, tạo AttendanceRecord.

```
[Nhân viên tạo đơn]
        │
        ▼
  status: PENDING_L1
        │
        ├─ L1 từ chối ──────────────────────▶ status: REJECTED (rejectLevel=1)
        │
        └─ L1 duyệt ────────────────────────▶ status: COMPLETED
                                                   │
                                                   ▼
                                         Tạo AttendanceRecord
                                         workType = 'ONLINE_APPROVED'
                                         (mỗi ngày làm việc 1 bản ghi)
```

### Kịch bản 2 — Đơn dài (`totalDays >= 3`, `requiresMultiLevel = true`)

3 cấp duyệt: L1 (line manager) → L2 (dept manager, nếu khác L1) → L3 (Giám đốc).

```
[Nhân viên tạo đơn]
        │
        ▼
  status: PENDING_L1
        │
        ├─ L1 từ chối ──────────────────────▶ status: REJECTED (rejectLevel=1)
        │
        └─ L1 duyệt
                │
                ▼
          approverL2 có? ──── Không (L2 bị skip) ──┐
                │                                    │
               Có                                    │
                ▼                                    │
        status: PENDING_L2                           │
                │                                    │
                ├─ L2 từ chối ──────────────────▶ REJECTED (rejectLevel=2)
                │                                    │
                └─ L2 duyệt ─────────────────────┘
                                │
                                ▼
                        status: PENDING_L3
                                │
                                ├─ CHIEF từ chối ──▶ REJECTED (rejectLevel=3)
                                │
                                └─ CHIEF duyệt ────▶ status: COMPLETED
                                                           │
                                                           ▼
                                                 Tạo AttendanceRecord
                                                 workType = 'ONLINE_APPROVED'
```

---

## Skip Logic

### Trường hợp L2 bị bỏ qua

Khi `employee.managerId === department.managerId` — tức là line manager và dept manager là cùng một người — level 2 không có ý nghĩa. Server tự động set `approverL2 = null` và luồng duyệt nhảy thẳng từ L1 → PENDING_L3.

```
employee.managerId = 5
department.managerId = 5
→ approverL1 = { id: 5, fullName: "..." }
→ approverL2 = null
→ Luồng: PENDING_L1 → (L1 approve) → PENDING_L3 → (CHIEF approve) → COMPLETED
```

### Trường hợp không có manager

Nếu nhân viên không có `managerId` và phòng ban không có manager, server dùng CHIEF đầu tiên (theo `id` tăng dần) làm L1:

```
employee.managerId = null
department.managerId = null
→ approverL1 = first CHIEF employee (by id)
→ Luồng: PENDING_L1 → (CHIEF approve) → COMPLETED (nếu totalDays < 3)
         PENDING_L1 → PENDING_L3 → COMPLETED (nếu totalDays >= 3)
```

---

## Rejection

- Từ chối có thể xảy ra ở bất kỳ cấp nào (L1, L2, hoặc L3).
- Kết quả luôn là `status = REJECTED`.
- `rejectLevel` lưu lại cấp nào đã từ chối (1, 2, hoặc 3).
- `rejectNote` bắt buộc phải có — truyền qua body `{ "rejectNote": "..." }`.
- **Các cấp đã duyệt trước đó không được hoàn tác** — `approvedL1At`, `approvedL2At` vẫn giữ nguyên giá trị.
- Sau khi REJECTED, đơn không thể chỉnh sửa hay duyệt thêm.

```json
// Response khi bị từ chối ở L2
{
  "status": "REJECTED",
  "rejectLevel": 2,
  "rejectNote": "Không đủ lý do hợp lệ",
  "rejectedBy": { "id": 3, "fullName": "Trần Thị B" },
  "rejectedAt": "2026-05-26T08:30:00.000Z",
  "approvedL1By": { "id": 2, "fullName": "Nguyễn Văn Manager" },
  "approvedL1At": "2026-05-25T14:00:00.000Z",
  "approvedL2By": null,
  "approvedL2At": null
}
```

---

## Attendance Record

Khi đơn chuyển sang `COMPLETED`, server **tự động tạo hoặc cập nhật** `AttendanceRecord` cho từng ngày làm việc trong khoảng `[startDate, endDate]` (bỏ qua T7, CN):

- `workType` được set thành `'ONLINE_APPROVED'`
- Nếu ngày đó đã có `AttendanceRecord` → upsert (cập nhật `workType`)
- Nếu chưa có → tạo mới với `workType = 'ONLINE_APPROVED'`
- `onlineWorkRequestId` trên `AttendanceRecord` trỏ về đơn này

Frontend dùng `workType` để hiển thị badge trong bảng công:

| `workType` | Badge hiển thị |
|------------|----------------|
| `null` | (trống — làm offline bình thường) |
| `'ONLINE_APPROVED'` | Badge "Online" (xanh) |
| `'ONLINE_T7'` | Badge "Online T7" (cam) |
| `'OFFLINE'` | Badge "Offline" (xám) |

---

## POST /v1/online-work-requests — Tạo đơn

**Request body:**
```json
{
  "startDate": "2026-05-26",
  "endDate": "2026-05-30",
  "reason": "Đối tác yêu cầu họp online, cần làm việc từ nhà để kết nối ổn định"
}
```

**Validation:**
- `startDate` và `endDate` phải là `"YYYY-MM-DD"` hợp lệ
- `endDate >= startDate`
- `reason` tối thiểu 10 ký tự
- Khoảng `[startDate, endDate]` phải chứa ít nhất 1 ngày làm việc (không tính T7/CN)

**Response 201:** `ApiSuccess<OnlineWorkRequestResponse>`

```json
{
  "success": true,
  "data": {
    "id": 12,
    "startDate": "2026-05-26",
    "endDate": "2026-05-30",
    "totalDays": 5,
    "reason": "Đối tác yêu cầu họp online, cần làm việc từ nhà để kết nối ổn định",
    "status": "PENDING_L1",
    "requiresMultiLevel": true,
    "employee": {
      "id": 4,
      "fullName": "Nguyễn Văn A",
      "employeeCode": "EMP004",
      "department": "Kỹ thuật"
    },
    "approverL1": { "id": 2, "fullName": "Trần Thị Manager" },
    "approverL2": { "id": 3, "fullName": "Lê Văn Dept" },
    "approvedL1By": null,
    "approvedL1At": null,
    "approvedL2By": null,
    "approvedL2At": null,
    "approvedL3By": null,
    "approvedL3At": null,
    "rejectedBy": null,
    "rejectedAt": null,
    "rejectNote": null,
    "rejectLevel": null,
    "currentLevel": 1,
    "canBeApprovedBy": [2],
    "canBeCancelled": true,
    "statusLabel": "Chờ duyệt cấp 1",
    "createdAt": "2026-05-25T06:00:00.000Z"
  }
}
```

**400** nếu không có ngày làm việc trong khoảng:
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Không có ngày làm việc trong khoảng thời gian đã chọn" } }
```

---

## PATCH /v1/online-work-requests/:id/approve — Duyệt đơn

Không cần body. Server tự xác định người gọi đang ở cấp nào dựa vào `canBeApprovedBy`.

**Response 200:** `ApiSuccess<OnlineWorkRequestResponse>`

**403** nếu không phải người được phân công duyệt ở cấp hiện tại:
```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Bạn không có quyền duyệt đơn này ở cấp hiện tại" } }
```

**400** nếu đơn không còn ở trạng thái chờ duyệt:
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Đơn không ở trạng thái chờ duyệt" } }
```

---

## PATCH /v1/online-work-requests/:id/reject — Từ chối đơn

**Request body:**
```json
{ "rejectNote": "Giai đoạn sprint đòi hỏi có mặt tại văn phòng" }
```

**Response 200:** `ApiSuccess<OnlineWorkRequestResponse>`

---

## PATCH /v1/online-work-requests/:id/cancel — Huỷ đơn

Không cần body. Chỉ chính chủ mới được huỷ, và chỉ khi `status = PENDING_L1`.

**Response 200:** `ApiSuccess<OnlineWorkRequestResponse>`

**400** nếu đơn đã qua L1:
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Chỉ được huỷ đơn đang chờ duyệt cấp 1" } }
```

---

## GET /v1/online-work-requests/report — Thống kê tháng

**Query params:** `?month=5&year=2026&departmentId=1`

- `MANAGER`: `departmentId` bị ignore, tự động scope theo phòng ban của manager
- `HR`, `ADMIN`, `CHIEF`: truyền `departmentId` để lọc, bỏ qua để xem toàn công ty

**Response:** `ApiSuccess<OnlineWorkMonthlyStats[]>`

```json
{
  "success": true,
  "data": [
    {
      "employeeCode": "EMP004",
      "fullName": "Nguyễn Văn A",
      "departmentName": "Kỹ thuật",
      "totalRequests": 2,
      "completedRequests": 1,
      "totalDaysApproved": 5,
      "pendingRequests": 1,
      "rejectedRequests": 0
    }
  ]
}
```

---

## GET /v1/online-work-requests/report/export — Xuất Excel

**Query params:** `?month=5&year=2026&departmentId=1`

Trả về file `.xlsx` với các cột:

| Cột | Key |
|-----|-----|
| Mã NV | `employeeCode` |
| Họ tên | `fullName` |
| Phòng ban | `departmentName` |
| Tổng đơn | `totalRequests` |
| Hoàn thành | `completedRequests` |
| Ngày đã duyệt | `totalDaysApproved` |
| Chờ duyệt | `pendingRequests` |
| Từ chối | `rejectedRequests` |

Header màu `#1E3A5F`, dòng cuối là TỔNG CỘNG màu `#D6E4F0`.

---

## Composable — useOnlineWorkRequests

```typescript
// composables/useOnlineWorkRequests.ts
import type {
  OnlineWorkRequestResponse,
  OnlineWorkMonthlyStats,
  CreateOnlineWorkRequestDto,
  RejectOnlineWorkDto,
  QueryOnlineWorkParams,
  QueryOnlineWorkReportParams,
} from '~/types/online-work-request.types';

export function useOnlineWorkRequests() {
  const { get, list, post, patch } = useFetch();

  // Đơn của bản thân (có phân trang)
  const fetchMyRequests = (params?: QueryOnlineWorkParams) =>
    list<OnlineWorkRequestResponse>('/v1/online-work-requests/me', { params });

  // Đơn đang chờ mình duyệt (MANAGER/CHIEF/ADMIN/HR)
  const fetchPendingForMe = () =>
    get<OnlineWorkRequestResponse[]>('/v1/online-work-requests/pending-for-me');

  // Danh sách toàn bộ (HR/ADMIN/CHIEF/MANAGER)
  const fetchAll = (params?: QueryOnlineWorkParams) =>
    list<OnlineWorkRequestResponse>('/v1/online-work-requests', { params });

  // Chi tiết một đơn
  const fetchOne = (id: number) =>
    get<OnlineWorkRequestResponse>(`/v1/online-work-requests/${id}`);

  // Tạo đơn mới
  const createRequest = (dto: CreateOnlineWorkRequestDto) =>
    post<OnlineWorkRequestResponse>('/v1/online-work-requests', dto);

  // Duyệt đơn (không cần body)
  const approveRequest = (id: number) =>
    patch<OnlineWorkRequestResponse>(`/v1/online-work-requests/${id}/approve`);

  // Từ chối đơn
  const rejectRequest = (id: number, dto: RejectOnlineWorkDto) =>
    patch<OnlineWorkRequestResponse>(`/v1/online-work-requests/${id}/reject`, dto);

  // Huỷ đơn (chính chủ, chỉ khi PENDING_L1)
  const cancelRequest = (id: number) =>
    patch<OnlineWorkRequestResponse>(`/v1/online-work-requests/${id}/cancel`);

  // Báo cáo thống kê tháng
  const fetchReport = (params: QueryOnlineWorkReportParams) =>
    get<OnlineWorkMonthlyStats[]>('/v1/online-work-requests/report', { params });

  // URL xuất Excel — dùng trực tiếp với <a href> hoặc window.open
  const getExportUrl = (params: QueryOnlineWorkReportParams) => {
    const q = new URLSearchParams({
      month: String(params.month),
      year: String(params.year),
      ...(params.departmentId ? { departmentId: String(params.departmentId) } : {}),
    });
    return `/v1/online-work-requests/report/export?${q}`;
  };

  return {
    fetchMyRequests,
    fetchPendingForMe,
    fetchAll,
    fetchOne,
    createRequest,
    approveRequest,
    rejectRequest,
    cancelRequest,
    fetchReport,
    getExportUrl,
  };
}
```

---

## Edge Cases

| Tình huống | Kết quả |
|-----------|---------|
| `startDate` = `endDate` = ngày chủ nhật | 400 — không có ngày làm việc |
| `endDate` < `startDate` | 400 — `endDate phải lớn hơn hoặc bằng startDate` |
| `reason` < 10 ký tự | 400 — validation error |
| `EMPLOYEE` gọi `GET /` (danh sách toàn bộ) | 403 Forbidden |
| `EMPLOYEE` gọi `GET /:id` đơn của người khác | 403 Forbidden |
| `MANAGER` gọi `GET /:id` — đơn trong phòng ban mình | 200 OK |
| `MANAGER` gọi `GET /:id` — đơn ngoài phòng ban | 403 Forbidden |
| `CHIEF` gọi `GET /:id` bất kỳ đơn nào | 200 OK |
| `MANAGER` gọi approve nhưng không phải approverL1/L2 được phân công | 403 Forbidden |
| CHIEF gọi approve khi status = PENDING_L1 hoặc PENDING_L2 | 403 — chỉ được approve ở PENDING_L3 |
| Duyệt đơn đã COMPLETED, REJECTED, hoặc CANCELLED | 400 Bad Request |
| Huỷ đơn khi status = PENDING_L2 | 400 — chỉ được huỷ khi PENDING_L1 |
| Huỷ đơn của người khác | 403 Forbidden |
| `employee.managerId = department.managerId` | L2 bị bỏ qua, `approverL2 = null`, luồng: L1 → PENDING_L3 |
| Nhân viên không có manager, phòng ban không có manager | L1 = first CHIEF (by id); nếu không có CHIEF → 400 |
| `totalDays = 2` | `requiresMultiLevel = false`, chỉ cần L1 duyệt → COMPLETED |
| `totalDays = 3` | `requiresMultiLevel = true`, cần 3 cấp duyệt |
| `MANAGER` gọi `GET /report` với `departmentId` khác | `departmentId` bị ignore, tự scope theo phòng mình |
| Khoảng có ngày nghỉ lễ (public holiday) | Ngày lễ **không** bị loại trừ — chỉ loại T7/CN |
| Đơn COMPLETED — nhân viên check-in cùng ngày | AttendanceRecord được upsert, `workType` được cập nhật |
| Reject ở L2 — L1 đã approve | `approvedL1At` vẫn giữ, chỉ thêm `rejectedAt`, `rejectLevel=2` |
