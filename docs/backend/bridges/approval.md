# Bridge Docs — Endpoints phê duyệt (`/v1/approval/*`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Mục đích

Trước đây, để lấy danh sách đơn cần phê duyệt, FE gọi các endpoint `GET /v1/{module}` chung — trong đó bao gồm cả đơn của bản thân người gọi. Điều đó khiến "hộp thư duyệt" (inbox) bị lẫn các đơn không cần action.

Nhóm endpoint `/v1/approval/*` là **inbox thuần**: chỉ trả các đơn mà người gọi được assign làm approver. Dùng cho các trang/màn "Đơn chờ tôi duyệt".

---

## Endpoints

| Method | Path | Ghi chú |
|--------|------|---------|
| GET | `/v1/approval/leave-requests` | Đơn nghỉ phép chờ tôi duyệt |
| GET | `/v1/approval/leave-requests/:id` | Chi tiết một đơn nghỉ (approver view) |
| GET | `/v1/approval/makeup-attendance` | Đơn bù công chờ tôi duyệt |
| GET | `/v1/approval/makeup-attendance/:id` | Chi tiết một đơn bù công |
| GET | `/v1/approval/violation-requests` | Phiếu giải trình chờ tôi duyệt |
| GET | `/v1/approval/violation-requests/:id` | Chi tiết một phiếu giải trình |
| GET | `/v1/approval/overtime-requests` | Đơn tăng ca chờ tôi duyệt |
| GET | `/v1/approval/overtime-requests/:id` | Chi tiết một đơn OT |
| GET | `/v1/approval/business-trips` | Đơn công tác chờ tôi duyệt |
| GET | `/v1/approval/business-trips/:id` | Chi tiết một đơn công tác |
| GET | `/v1/approval/online-work-requests` | Đơn làm online chờ tôi duyệt (multi-level) |
| GET | `/v1/approval/online-work-requests/:id` | Chi tiết một đơn làm online |
| GET | `/v1/approval/counts` | Đếm số đơn PENDING chờ tôi duyệt theo từng module — dùng cho badge |

**Auth**: tất cả cần `Authorization: Bearer <token>`. Không giới hạn role — user nào không phải approver ở module đó sẽ nhận list rỗng.

---

## Filter "tôi là approver" theo từng module

Ai được coi là "approver" phụ thuộc field trên record:

| Module | Điều kiện |
|--------|-----------|
| `leave-requests` | `assignedApproverId === me` **HOẶC** (`assignedApproverId === null` VÀ role của tôi là `HR`) — HR fallback |
| `makeup-attendance` | `assignedApproverId === me` |
| `violation-requests` | `assignedReviewerId === me` |
| `overtime-requests` | `assignedApproverId === me` |
| `business-trips` | `approverId === me` |
| `online-work-requests` (multi-level) | `approverL1Id === me` HOẶC `approverL2Id === me` HOẶC `approvedL3ById === me` HOẶC `rejectedById === me` HOẶC (`status === PENDING_L3` VÀ role của tôi là `CHIEF`/`DIRECTOR`) |

> `ADMIN` **không** có super-approver override ở nhóm endpoint này — ADMIN cũng chỉ nhìn thấy đơn được assign đích danh cho mình. Nếu cần duyệt hộ, dùng endpoint `/v1/{module}` cũ.

---

## Query params

Tất cả list endpoint đều nhận query params giống hệt endpoint `GET /v1/{module}` chính (page, limit, status, departmentId, startDate, endDate, …). Xem bridge doc từng module.

Ngoại lệ: các filter kiểu `employeeId`, `search` vẫn được server chấp nhận nhưng thường ít có ý nghĩa trong context inbox.

---

## Thứ tự sắp xếp

Cả 6 list endpoint sort thống nhất:

1. **Primary**: status ASC — enum Postgres theo declaration order:
   - `leave/makeup/violation/business-trips/overtime`: `PENDING → APPROVED → REJECTED → CANCELLED` (business-trips có thêm `DRAFT` đầu tiên, `IN_PROGRESS`/`COMPLETED` xen giữa; overtime có thêm `AUTO_CANCELLED` cuối)
   - `online-work-requests`: `PENDING_L1 → PENDING_L2 → PENDING_L3 → COMPLETED → REJECTED → CANCELLED`
2. **Secondary**: `createdAt` DESC — đơn mới tạo lên trước trong cùng nhóm status

Kết quả: PENDING (cần action) luôn ở đầu list. FE có thể an tâm reuse UI list, không cần tab.

---

## Ẩn CANCELLED mặc định

Vì approver ≠ chủ đơn, các đơn đã bị chủ đơn thu hồi (`CANCELLED`) sẽ **không hiển thị mặc định**. Muốn xem, gửi kèm `?status=CANCELLED`.

Với `overtime-requests`, cả `CANCELLED` và `AUTO_CANCELLED` đều bị ẩn mặc định.

---

## Response shape

- List endpoint: `{ success: true, data: [...], meta: { page, limit, total, totalPages } }` — items có shape **giống hệt** endpoint gốc của module (dùng chung transformer).
- Detail endpoint: `{ success: true, data: { ... } }` — shape giống endpoint `GET /v1/{module}/:id`.

Vì reuse transformer, các field ảnh (avatar, evidencePhotoUrl, ticketImageUrl, attachmentUrls…) đã được backend sign presigned URL sẵn — dùng trực tiếp trong `<img src>`.

---

## GET `/v1/approval/counts` — chi tiết

Trả số đơn `PENDING` đang chờ tôi duyệt ở từng module. Dùng cho badge số trên menu.

### Response

```typescript
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

Ví dụ:

```json
{
  "success": true,
  "data": {
    "leaveRequests": 3,
    "makeupAttendance": 1,
    "violationRequests": 0,
    "overtimeRequests": 2,
    "businessTrips": 1,
    "onlineWorkRequests": 4,
    "total": 11
  }
}
```

> `total` do server tính, không cộng lại phía client — nếu tương lai thêm module mới thì `total` tự cập nhật.

### Ghi chú

- Chỉ đếm status `PENDING` (hoặc `PENDING_L1/L2/L3` với online-work).
- Không đếm đơn đã APPROVED/REJECTED/CANCELLED, dù người gọi đã action.
- Endpoint gọi song song 6 count query — chi phí thấp, có thể poll mỗi 30–60s hoặc refresh sau mỗi lần approve/reject.

---

## Khi nào dùng endpoint mới, khi nào giữ endpoint cũ?

| Trường hợp | Endpoint |
|---|---|
| Trang "Hộp thư phê duyệt" của tôi | `/v1/approval/{module}` |
| Trang "Toàn bộ đơn công ty" (HR/Admin/Director xem tổng) | `/v1/{module}` cũ |
| Trang "Đơn của tôi" (đơn tôi tạo) | `/v1/{module}/me` cũ |
| Detail của đơn bất kỳ | `/v1/{module}/:id` cũ **hoặc** `/v1/approval/{module}/:id` đều được — cùng response |
| Approve/Reject/Cancel action | Endpoint `PATCH /v1/{module}/:id/...` cũ (nhóm approval chỉ đọc) |

---

## Xem thêm

- [leave-requests.md](./leave-requests.md), [makeup-attendance.md](./makeup-attendance.md), [violation-requests.md](./violation-requests.md), [overtime-requests.md](./overtime-requests.md), [business-trips.md](./business-trips.md), [online-work-requests.md](./online-work-requests.md) — DTO / response types của từng module.
