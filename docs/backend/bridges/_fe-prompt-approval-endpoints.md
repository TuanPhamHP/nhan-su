# FE Agent Prompt — Backend đã thêm nhóm endpoint `/v1/approval/*`

## Context

Trước đây trang "hộp thư phê duyệt" trên FE dùng chung endpoint `GET /v1/{module}` với các trang danh sách khác. Endpoint chung trả cả đơn của bản thân người gọi + đơn của phòng ban + đơn công ty, khiến approver phải tự lọc trên client và không có cách đếm chính xác số đơn cần action.

Backend đã tách một nhóm endpoint mới `/v1/approval/*` chỉ trả đơn mà người gọi là approver được assign. Kèm theo là endpoint `/v1/approval/counts` trả số PENDING theo từng module cho badge menu.

Không có endpoint cũ nào bị xoá hay đổi shape. Đây là API **cộng thêm** — FE có thể migrate dần.

## Endpoints mới

### List (7 module × 2 route = 12 endpoint + 1 counts)

- `GET /v1/approval/leave-requests` (+ `:id`)
- `GET /v1/approval/makeup-attendance` (+ `:id`)
- `GET /v1/approval/violation-requests` (+ `:id`)
- `GET /v1/approval/overtime-requests` (+ `:id`)
- `GET /v1/approval/business-trips` (+ `:id`)
- `GET /v1/approval/online-work-requests` (+ `:id`) — multi-level
- `GET /v1/approval/counts` — trả `{ leaveRequests, makeupAttendance, violationRequests, overtimeRequests, businessTrips, onlineWorkRequests, total }`, chỉ đếm PENDING

Tất cả cần `Authorization: Bearer <token>`. Không giới hạn role — user nào không phải approver ở module đó sẽ nhận list rỗng / count = 0.

## Điểm khác biệt so với endpoint cũ

| Điểm | `/v1/{module}` cũ | `/v1/approval/{module}` mới |
|---|---|---|
| Đơn của bản thân người gọi | **có** trả về (nếu match filter) | **không** trả về (trừ khi tôi tự assign duyệt cho mình) |
| Filter theo phòng ban | Phải role HR/Admin để bypass; MANAGER chỉ phòng ban mình | Không cần role — luôn chỉ trả đơn tôi là approver |
| ADMIN super-approver | ADMIN thấy toàn bộ | **Không áp dụng** — ADMIN cũng chỉ thấy đơn được assign đích danh |
| Sort | tuỳ endpoint | `[status ASC, createdAt DESC]` — PENDING lên đầu |
| CANCELLED của người khác | có (theo rule module) | **Ẩn mặc định**, hiện khi `?status=CANCELLED` |
| Response shape | dùng transformer module | **Giống hệt** — reuse cùng transformer, không đổi DTO |

## Query params

Tất cả list endpoint approval nhận query params **giống hệt** endpoint gốc của module đó. Ví dụ:
- `/v1/approval/leave-requests` nhận `page, limit, status, leaveTypeId, startDate, endDate, departmentId` — reuse `QueryLeaveRequestDto`.
- `/v1/approval/online-work-requests` reuse `QueryOnlineWorkDto`.
- ...

Nếu FE có sẵn service call `/v1/{module}`, chỉ cần đổi path prefix, giữ nguyên params và DTO.

## Response shape

- **List**: `{ success: true, data: T[], meta: { page, limit, total, totalPages } }` — `T` là chính response DTO đã có (LeaveRequestResponseDto, MakeupRequestResponseDto…).
- **Detail (`:id`)**: `{ success: true, data: T }`.
- **Counts**:
  ```typescript
  interface ApprovalCountsResponseDto {
    leaveRequests: number;
    makeupAttendance: number;
    violationRequests: number;
    overtimeRequests: number;
    businessTrips: number;
    onlineWorkRequests: number;
    total: number; // do server tính, KHÔNG cộng lại phía client
  }
  ```

Các field ảnh (avatar, evidencePhotoUrl, ticketImageUrl, attachmentUrls…) đã được backend sign presigned URL — dùng trực tiếp trong `<img src>`.

## Filter "tôi là approver" per module — quan trọng để hiểu

| Module | Điều kiện được coi là approver |
|--------|-----|
| `leave-requests` | `assignedApproverId === me` HOẶC (role=HR VÀ `assignedApproverId === null`) — HR fallback |
| `makeup-attendance` | `assignedApproverId === me` |
| `violation-requests` | `assignedReviewerId === me` |
| `overtime-requests` | `assignedApproverId === me` |
| `business-trips` | `approverId === me` |
| `online-work-requests` | `approverL1Id === me` OR `approverL2Id === me` OR `approvedL3ById === me` OR `rejectedById === me` OR (`status=PENDING_L3` VÀ role in `CHIEF`/`DIRECTOR`) |

FE **không** cần implement logic này — server đã filter. Chỉ cần biết là "user không phải approver → nhận list rỗng".

## Việc cần làm trên FE

### 1. Trang "Hộp thư phê duyệt"

Tạo (hoặc refactor) trang inbox dùng `/v1/approval/{module}` thay vì `/v1/{module}`. Có 2 hướng làm UI:

- **Hướng A — 1 trang inbox chung, 6 tab module**: mỗi tab hiển thị list của 1 module. Đơn giản, phù hợp menu "Đơn chờ duyệt" duy nhất.
- **Hướng B — Nhúng vào từng trang module hiện có**: thêm segment/tab "Chờ tôi duyệt" cạnh "Của tôi" và "Toàn bộ". Nhất quán với hierarchy hiện tại.

Chọn hướng tuỳ product decision. BE không yêu cầu.

### 2. Badge menu "Số đơn chờ duyệt"

- Ở component menu/sidebar/header, gọi `GET /v1/approval/counts` khi mount và:
  - Refresh sau mỗi lần user approve/reject/cancel bất kỳ đơn nào (invalidate query).
  - Poll 30–60s hoặc dùng websocket/SSE nếu có sẵn (không bắt buộc).
- Hiển thị `total` bên cạnh icon menu "Duyệt", và số riêng của từng module trong dropdown menu con.

### 3. Type definitions

Reuse các DTO đã có từ module gốc — **không** cần định nghĩa mới. Chỉ cần thêm:

```typescript
// types/approval.types.ts
export interface ApprovalCountsResponseDto {
  leaveRequests: number;
  makeupAttendance: number;
  violationRequests: number;
  overtimeRequests: number;
  businessTrips: number;
  onlineWorkRequests: number;
  total: number;
}
```

### 4. API client / service

Có thể tạo 1 file `approvalService.ts` gom 7 method:

```typescript
export const approvalService = {
  listLeaveRequests: (params) => api.get('/v1/approval/leave-requests', { params }),
  listMakeupAttendance: (params) => api.get('/v1/approval/makeup-attendance', { params }),
  listViolationRequests: (params) => api.get('/v1/approval/violation-requests', { params }),
  listOvertimeRequests: (params) => api.get('/v1/approval/overtime-requests', { params }),
  listBusinessTrips: (params) => api.get('/v1/approval/business-trips', { params }),
  listOnlineWorkRequests: (params) => api.get('/v1/approval/online-work-requests', { params }),
  getCounts: () => api.get<ApprovalCountsResponseDto>('/v1/approval/counts'),
};
```

Hoặc nhét từng method vào service module tương ứng (ví dụ `leaveService.listApproval`). Chọn theo convention project.

### 5. Sort không cần custom phía FE

Server đã sort `PENDING → APPROVED → REJECTED → CANCELLED` (primary) và `createdAt DESC` (secondary). FE **không** cần re-sort trên client — mất công vô ích.

### 6. Filter status trên UI

Vì mặc định server ẩn CANCELLED, nếu FE cho user chọn tab "Đã thu hồi", đảm bảo pass `?status=CANCELLED` để server trả về. Với overtime, cần biết là truyền `CANCELLED` chỉ trả CANCELLED; muốn xem AUTO_CANCELLED thì truyền `AUTO_CANCELLED`.

### 7. Endpoint cũ giữ nguyên

- `/v1/{module}/pending-for-me` (business-trips, online-work-requests) vẫn hoạt động, không phân trang — dùng cho compact list. Có thể giữ nếu đang dùng, hoặc migrate sang `/v1/approval/{module}` để có phân trang + filter đồng bộ.
- `/v1/{module}/me` — endpoint "đơn của tôi" — giữ nguyên, khác context với inbox duyệt.

## Không cần làm

- Không cần thay đổi flow approve/reject/cancel — vẫn dùng `PATCH /v1/{module}/:id/approve|reject|cancel` cũ.
- Không cần đổi DTO / response type.
- Không cần thêm role check phía FE — server đã handle.

## File bridge docs

- **[docs/bridges/approval.md](./approval.md)** — doc trung tâm cho nhóm endpoint mới. Đọc file này trước.
- Từng module docs đã được cập nhật bảng endpoint với dòng `/v1/approval/{module}` và pointer sang `approval.md`:
  - [leave-requests.md](./leave-requests.md)
  - [makeup-attendance.md](./makeup-attendance.md)
  - [violation-requests.md](./violation-requests.md)
  - [overtime-requests.md](./overtime-requests.md)
  - [business-trips.md](./business-trips.md)
  - [online-work-requests.md](./online-work-requests.md)

## Checklist trước khi merge FE PR

- [ ] Có service/composable gọi `GET /v1/approval/{module}` cho 6 module + `GET /v1/approval/counts`.
- [ ] `ApprovalCountsResponseDto` type được định nghĩa và dùng cho endpoint counts.
- [ ] Trang "Hộp thư duyệt" (hoặc tab tương đương) sử dụng đúng endpoint mới, không dùng `/v1/{module}` chung nữa.
- [ ] Badge số đơn chờ duyệt hiển thị `total` từ counts endpoint và tự refresh sau khi approve/reject/cancel.
- [ ] KHÔNG re-sort list phía client — server đã sort.
- [ ] Tab "Đã thu hồi" (nếu có) truyền `?status=CANCELLED` — mặc định server ẩn.
- [ ] Reuse các DTO response cũ, KHÔNG định nghĩa lại type cho items.
- [ ] Test empty state: user không phải approver ở module nào → list rỗng, không lỗi.
