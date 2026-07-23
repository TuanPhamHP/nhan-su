# Bridge Docs — Phiếu giải trình vi phạm (`/v1/violation-requests`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
| --- | --- | --- | --- |
| GET | `/v1/violation-requests/me` | Mọi user đã đăng nhập | Phiếu của bản thân (có phân trang) |
| GET | `/v1/violation-requests/me/status` | Mọi user đã đăng nhập | Quota tháng — **bắt buộc `?month=&year=`** |
| POST | `/v1/violation-requests` | Mọi user đã đăng nhập | Tạo phiếu giải trình — `multipart/form-data` |
| GET | `/v1/violation-requests` | `HR`, `ADMIN`, `MANAGER` | HR/Admin: tất cả; Manager: chỉ phòng ban mình |
| GET | `/v1/approval/violation-requests` | Reviewer được assign (L1 hoặc L2) | **Inbox** phiếu chờ tôi duyệt — trả về phiếu mà `assignedReviewerId = actor.id` (L1) HOẶC `approverL2Id = actor.id` (L2). Xem [approval.md](./approval.md) |
| GET | `/v1/approval/violation-requests/:id` | L1 approver / L2 approver / owner / HR / ADMIN | Chi tiết (approver view) — L2 approver được xem detail của phiếu mình đang chờ duyệt |
| GET | `/v1/violation-requests/report` | `HR`, `ADMIN` | Thống kê vi phạm theo tháng — **bắt buộc `?month=&year=`** |
| PATCH | `/v1/violation-requests/:id/approve` | `MANAGER` (được phân công) | Duyệt phiếu — chỉ đúng người được giao |
| PATCH | `/v1/violation-requests/:id/reject` | `MANAGER` (được phân công) | Từ chối phiếu — body: `{ reviewNote }` |
| PATCH | `/v1/violation-requests/:id/cancel` | Employee (chính chủ) | Thu hồi phiếu đang chờ |

> **Lưu ý thứ tự route:** `/me` và `/me/status` được khai báo **trước** `/:id/...` và `/report` trong controller.

---

## Status Flow

```
                         ┌─────────────────────────► APPROVED    (single-level)
PENDING ─── approve L1 ──┤
   │                     └─── PENDING_L2 ─── approve L2 ────────► APPROVED    (multi-level)
   │                              │
   │                              ├─── reject L2 ──────────────► REJECTED
   │                              └─── cancel (owner) ─────────► CANCELLED
   ├─── reject L1 ──────────────────────────────────────────────► REJECTED
   └─── cancel (owner) ────────────────────────────────────────► CANCELLED
```

- `PENDING` → phiếu vừa tạo, đang chờ **L1** (quản lý trực tiếp) xử lý
- `PENDING_L2` → L1 đã duyệt, đang chờ **L2** (trưởng phòng ban / CHIEF) xử lý — chỉ xuất hiện khi phiếu multi-level
- `APPROVED` → đã duyệt xong (single hoặc L2), attendance đã được correct
- `REJECTED` → bị từ chối ở bất kỳ cấp nào; `approvedL1At` **không** rollback (giữ audit trail)
- `CANCELLED` → owner tự thu hồi, được phép ở cả `PENDING` và `PENDING_L2`

Không có state `EXPIRED` — sau deadline `PENDING`/`PENDING_L2` vẫn giữ nguyên (không tự động chuyển).

---

## Approval Flow — single-level vs multi-level

Khi tạo phiếu, server đếm `approvedThisMonth` = SUM(`slotCost`) của các phiếu **APPROVED** + **PENDING_L2** trong tháng vi phạm, rồi quyết định luồng:

| Điều kiện                | Luồng                                                                                    |
| ------------------------ | ---------------------------------------------------------------------------------------- |
| `approvedThisMonth < 5`  | **Single-level** — chỉ cần L1 duyệt là APPROVED                                          |
| `approvedThisMonth >= 5` | **Multi-level** — L1 duyệt xong chuyển sang `PENDING_L2`, cần thêm L2 duyệt mới APPROVED |

Cờ `isMultiLevel` trên response DTO cho FE biết phiếu này đang trong luồng nào.

### Cách resolve L1 và L2

| Cấp | Nguồn | Fallback nếu không có / inactive |
| --- | --- | --- |
| **L1** — Quản lý trực tiếp | `Employee.managerId` (khác owner, status `ACTIVE`) | `assignedReviewerId = null` → HR duyệt được |
| **L2** — Trưởng phòng ban | `Department.managerId` (khác owner, status `ACTIVE`) | Escalate sang **CHIEF** (nhân sự role `CHIEF` bất kỳ, khác owner). Nếu không có CHIEF → `approverL2Id = null` → HR duyệt được |

**Edge cases**:

- L2 trùng L1 (cùng người vừa là quản lý trực tiếp vừa là trưởng phòng) → L2 escalate lên CHIEF
- Không có `Department.managerId` → L2 = CHIEF
- Owner chính là trưởng phòng → L2 = CHIEF (không self-approve)

### Phân quyền approve/reject theo cấp

Mỗi phiếu có 2 field reviewer song song:

- `assignedReviewerId` — người duyệt cấp 1
- `approverL2Id` — người duyệt cấp 2 (null nếu phiếu single-level)

| Cấp hiện tại (`status`) | Ai được approve / reject |
| --- | --- |
| `PENDING` | Đúng `assignedReviewerId` **hoặc** HR (khi `assignedReviewerId = null`) **hoặc** ADMIN (super-override) |
| `PENDING_L2` | Đúng `approverL2Id` **hoặc** HR (khi `approverL2Id = null`) **hoặc** ADMIN |

Sai người → `403`:

- L1: `"Chỉ Quản lý trực tiếp được phân công mới có thể duyệt cấp 1"`
- L2: `"Chỉ Trưởng phòng ban được phân công mới có thể duyệt cấp 2"`

> **ADMIN super-override** hiện là stopgap tạm thời, sẽ được thay bằng feature "Uỷ quyền duyệt" trong tương lai.

---

## Loại vi phạm — 4 loại (phân biệt qua `type`)

| `type` | Tên | Fields bổ sung khi tạo | Side effect khi APPROVE |
| --- | --- | --- | --- |
| `FORGOT_CHECKIN` | Quên chấm công vào | _(không có — xem chi tiết bên dưới)_ | Tự động điền check-in (và check-out nếu thiếu) theo giờ ca |
| `FORGOT_CHECKOUT` | Quên chấm công ra | _(không có — xem chi tiết bên dưới)_ | Điền `checkOutAt` theo giờ ca, `earlyMinutes` → 0, `status` → PRESENT |
| `LATE` | Đi muộn | _(không có)_ | Cập nhật `lateMinutes` → 0, `status` → PRESENT |
| `EARLY` | Về sớm | _(không có)_ | Cập nhật `earlyMinutes` → 0, `status` → PRESENT |

> Với tất cả loại, khi tạo phiếu server tự động tìm và link bản ghi chấm công ngày tương ứng (`attendanceRecordId`). Không cần client gửi gì thêm.

### FORGOT_CHECKIN — 2 trường hợp

Server tự phát hiện trường hợp dựa vào bản ghi chấm công ngày vi phạm. **Không cần bản ghi bị khóa** — nhân viên có thể gửi trong ngày (ví dụ: sáng quên check-in, trưa gửi phiếu).

| Trường hợp | Điều kiện | `slotCost` | Side effect khi APPROVE |
| --- | --- | --- | --- |
| **Thiếu check-in hoặc check-out** | Có bản ghi chấm công (chưa hoặc đã bị khóa) | 1 | Điền check-in/check-out còn thiếu theo giờ ca |
| **Quên cả ngày** — ngày quá khứ | Không có bản ghi chấm công, `violationDate < hôm nay` | **2** | Tạo bản ghi chấm công mới với giờ theo ca |
| **Quên cả ngày** — hôm nay, ca có `requireCheckOut=true`, còn kịp check-out | Không có bản ghi, `violationDate = hôm nay`, cửa sổ check-out **chưa đóng** | 1 | Chỉ điền check-in (nhân viên tự check-out sau) |
| **Quên cả ngày** — hôm nay, ca có `requireCheckOut=true`, hết giờ check-out | Không có bản ghi, `violationDate = hôm nay`, cửa sổ check-out **đã đóng** | **2** | Tạo bản ghi mới với cả check-in + check-out theo giờ ca |
| **Quên cả ngày** — hôm nay, ca có `requireCheckOut=false` | Không có bản ghi, `violationDate = hôm nay`, ca chỉ check-in | **0** | Điền check-in theo giờ ca — không có check-out cần bù |

**Client không cần gửi `requestedCheckIn`/`requestedCheckOut`.** Hệ thống tự tính giờ hợp lệ từ ca làm việc (ưu tiên `EmployeeShiftSchedule` của ngày đó, fallback về `defaultShift` của nhân viên).

### FORGOT_CHECKOUT — điều kiện tạo

- **Bắt buộc phải có bản ghi chấm công** cho ngày đó (đã check-in). Nếu không có → `400`.
- Nếu bản ghi **đã có `checkOutAt`** (đã chấm công ra) → `400`.
- **Không cần bản ghi bị khóa** — có thể gửi trong ngày (ví dụ: chiều quên checkout, gửi phiếu ngay).
- `slotCost = 1`.

Thứ tự ưu tiên giờ ca (áp dụng cho cả FORGOT_CHECKIN và FORGOT_CHECKOUT):

- Check-in: `effectiveShiftOverride.effectiveStart` → `shift.checkInTime`
- Check-out: `effectiveShiftOverride.effectiveEnd` → `shift.checkOutTime`

---

## `slotCost` — trọng số của phiếu

Mỗi phiếu tiêu tốn một số slot (`slotCost`), quyết định lúc **tạo** phiếu và snapshot lên record. `slotCost` chỉ còn 2 mục đích:

1. Ngưỡng chuyển multi-level (`approvedThisMonth >= 5` → phiếu mới cần duyệt 2 cấp).
2. Cột `remainingQuota` trong báo cáo tháng (informational, xem `/report`).

**Không còn giới hạn 5 lần/tháng khi tạo phiếu** — mọi phiếu hợp lệ đều tạo được. Ngưỡng 5 chỉ đổi luồng duyệt (single → multi-level), không chặn.

| Loại phiếu | `slotCost` |
| --- | --- |
| `LATE` | 1 |
| `EARLY` | 1 |
| `FORGOT_CHECKIN` — có bản ghi chấm công (thiếu check-in hoặc check-out) | 1 |
| `FORGOT_CHECKIN` — không có bản ghi, ngày **quá khứ** | **2** |
| `FORGOT_CHECKIN` — không có bản ghi, **hôm nay**, ca có `requireCheckOut=true`, cửa sổ check-out **còn mở** | 1 |
| `FORGOT_CHECKIN` — không có bản ghi, **hôm nay**, ca có `requireCheckOut=true`, cửa sổ check-out **đã đóng** | **2** |
| `FORGOT_CHECKIN` — không có bản ghi, **hôm nay**, ca có `requireCheckOut=false` | **0** |
| `FORGOT_CHECKOUT` | 1 |

### `approvedThisMonth` — dùng cho multi-level threshold

```
approvedThisMonth = SUM(slotCost) của các phiếu status ∈ {APPROVED, PENDING_L2} trong tháng vi phạm
isNextMultiLevel  = approvedThisMonth >= 5
```

- `PENDING` (chưa qua L1) **KHÔNG** cộng vào `approvedThisMonth` — chỉ tính khi đã qua L1 (PENDING_L2) hoặc đã APPROVED xong.
- `REJECTED` và `CANCELLED` không tính.

### `remainingQuota` — chỉ trong báo cáo tháng

`GET /v1/violation-requests/report` vẫn trả về `remainingQuota = max(0, 5 - usedQuota)`, với `usedQuota` = số phiếu `PENDING` / `PENDING_L2` / `APPROVED` trong tháng (count, không phải sum slotCost). Đây là chỉ báo tham khảo cho HR — **không** ảnh hưởng đến khả năng tạo phiếu.

---

## Deadline Rule

Deadline được tính dựa vào **ngày vi phạm** (không phải ngày tạo phiếu):

```
deadline = ngày 05 của tháng kế tiếp lúc 23:59:59
```

| Ngày vi phạm | Deadline            |
| ------------ | ------------------- |
| 2026-05-01   | 2026-06-05T23:59:59 |
| 2026-05-15   | 2026-06-05T23:59:59 |
| 2026-05-31   | 2026-06-05T23:59:59 |
| 2026-12-20   | 2027-01-05T23:59:59 |

Nếu tạo phiếu sau deadline, server trả `400`:

> `"Đã quá hạn tạo phiếu. Thời hạn là ngày 05/06/2026."`

---

## Thông báo (in-app + email)

| Sự kiện | In-app | Email |
| --- | --- | --- |
| Tạo phiếu | L1 approver (nếu có) + tất cả HR + owner | L1 approver (fallback HR nếu không có L1) + tất cả HR (info) |
| L1 approve (multi-level) → chuyển `PENDING_L2` | L2 approver + owner | — (chỉ in-app) |
| Approve cuối cùng (single-level hoặc L2) | Owner + tất cả HR | Owner |
| Reject (bất kỳ cấp nào) | Owner + tất cả HR | Owner |
| Cancel (owner tự thu hồi) | — | — |

> Tất cả noti chạy trong `Promise.allSettled` — không block main flow nếu 1 kênh fail.

---

## TypeScript Types

```typescript
// types/violation.types.ts

export type ViolationRequestType = 'FORGOT_CHECKIN' | 'FORGOT_CHECKOUT' | 'LATE' | 'EARLY';
export type ViolationRequestStatus =
	| 'PENDING' // Chờ L1 (quản lý trực tiếp) duyệt
	| 'PENDING_L2' // L1 đã duyệt, chờ L2 (trưởng phòng ban / CHIEF) duyệt — chỉ xuất hiện khi isMultiLevel
	| 'APPROVED'
	| 'REJECTED'
	| 'CANCELLED';

export interface ViolationEmployeeRef {
	id: number;
	fullName: string;
	employeeCode: string;
	avatarUrl: string | null;
}

export interface ViolationReviewerRef {
	id: number;
	fullName: string;
	avatarUrl: string | null;
}

export interface ViolationRequest {
	id: number;
	type: ViolationRequestType;
	typeLabel: string; // 'Quên chấm công vào' | 'Quên chấm công ra' | 'Đi muộn' | 'Về sớm'
	violationDate: string; // "YYYY-MM-DD"
	violationMonth: number; // 1–12
	violationYear: number;
	deadline: string; // ISO 8601 — ngày 05 tháng sau lúc 23:59:59
	deadlinePassed: boolean; // true nếu đã qua deadline tại thời điểm query
	slotCost: number; // 0 / 1 / 2 — xem bảng slotCost
	reason: string; // tối thiểu 10 ký tự
	evidencePhotoUrl: string | null; // URL ảnh minh chứng
	status: ViolationRequestStatus;
	reviewNote: string | null; // ghi chú khi từ chối
	assignedReviewer: ViolationReviewerRef | null; // L1 — quản lý trực tiếp (Employee.managerId); null nếu HR fallback
	approverL2: ViolationReviewerRef | null; // L2 — trưởng phòng ban / CHIEF; null nếu single-level
	approvedL1At: string | null; // ISO 8601 — thời điểm L1 duyệt (chỉ có khi qua L1); KHÔNG rollback nếu bị reject ở L2
	isMultiLevel: boolean; // true nếu approverL2 !== null (phiếu cần duyệt 2 cấp)
	currentApprovalLevel: 1 | 2; // 1 khi PENDING, 2 khi PENDING_L2; với APPROVED/REJECTED/CANCELLED phản ánh cấp cuối cùng
	reviewedBy: ViolationReviewerRef | null; // người thực hiện action gần nhất (approve L1 / approve L2 / reject / cancel)
	reviewedAt: string | null; // ISO 8601 full datetime
	isViolationFlagged: boolean; // HR mark vi phạm kỷ luật (thủ công)
	employee: ViolationEmployeeRef;
	createdAt: string; // ISO 8601 full datetime
}

// Trạng thái duyệt tháng — cho FE biết phiếu tiếp theo sẽ single hay multi-level
export interface ViolationMonthlyStatus {
	approvedThisMonth: number; // SUM(slotCost) của APPROVED + PENDING_L2 trong tháng
	isNextMultiLevel: boolean; // approvedThisMonth >= 5
}

// Request DTOs
export interface CreateViolationRequestDto {
	type: ViolationRequestType;
	violationDate: string; // "YYYY-MM-DD"
	reason: string; // tối thiểu 10 ký tự
	evidencePhoto?: File; // ảnh minh chứng (multipart), tùy chọn
}

export interface QueryViolationRequestParams {
	page?: number; // default 1
	limit?: number; // default 20, max 100
	month?: number; // 1–12
	year?: number;
	status?: ViolationRequestStatus;
	type?: ViolationRequestType;
	departmentId?: number; // HR/Admin: filter theo phòng ban; Manager: bị ignore (tự động filter phòng mình)
}

export interface QueryViolationReportParams {
	month: number; // bắt buộc, 1–12
	year: number; // bắt buộc
	departmentId?: number; // tùy chọn
}

export interface RejectViolationRequestDto {
	reviewNote: string; // tối thiểu 1 ký tự
}

// Thống kê vi phạm mỗi nhân viên trong tháng
export interface ViolationMonthlyStats {
	employeeId: number;
	employeeCode: string;
	fullName: string;
	departmentName: string | null;
	forgotCount: number; // số phiếu FORGOT_CHECKIN + FORGOT_CHECKOUT đã APPROVED
	lateCount: number; // số phiếu LATE đã APPROVED
	earlyCount: number; // số phiếu EARLY đã APPROVED
	totalCount: number; // forgotCount + lateCount + earlyCount
	flaggedCount: number; // số bản ghi bị đánh dấu vi phạm kỷ luật
	remainingQuota: number; // lượt giải trình còn lại = max(0, 5 - usedQuota)
	// usedQuota = PENDING + APPROVED (khác totalCount)
}
```

---

## GET /v1/violation-requests/me — Phiếu của tôi

**Query params:** `?month=5&year=2026&status=PENDING&type=LATE&page=1&limit=20`

Tất cả params đều optional.

**Response:** `ApiPaginated<ViolationRequest>`

```json
{
	"success": true,
	"data": [
		{
			"id": 1,
			"type": "LATE",
			"typeLabel": "Đi muộn",
			"violationDate": "2026-05-15",
			"violationMonth": 5,
			"violationYear": 2026,
			"deadline": "2026-06-05T23:59:59.999Z",
			"deadlinePassed": false,
			"slotCost": 1,
			"reason": "Tôi bị kẹt xe trên đường đến công ty",
			"evidencePhotoUrl": null,
			"status": "PENDING",
			"reviewNote": null,
			"assignedReviewer": { "id": 12, "fullName": "Trần Văn Bình", "avatarUrl": null },
			"approverL2": null,
			"approvedL1At": null,
			"isMultiLevel": false,
			"currentApprovalLevel": 1,
			"reviewedBy": null,
			"reviewedAt": null,
			"isViolationFlagged": false,
			"employee": { "id": 4, "fullName": "Nguyễn Văn An", "employeeCode": "EMP004", "avatarUrl": null },
			"createdAt": "2026-05-15T04:00:00.000Z"
		}
	],
	"meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

---

## GET /v1/violation-requests/me/status — Trạng thái duyệt tháng

**Query params bắt buộc:** `?month=5&year=2026`

**Response:** `ApiSuccess<ViolationMonthlyStatus>`

```json
{
	"success": true,
	"data": {
		"approvedThisMonth": 3,
		"isNextMultiLevel": false
	}
}
```

Khi tháng này đã có 5+ slotCost qua L1 hoặc APPROVED:

```json
{
	"success": true,
	"data": {
		"approvedThisMonth": 6,
		"isNextMultiLevel": true
	}
}
```

**Pattern gọi trước khi hiển thị form tạo phiếu:**

```typescript
const status = await fetchMyMonthlyStatus(month, year);
if (status.isNextMultiLevel) {
	// Hiện banner: "Tháng này bạn đã có 6 slot vi phạm được duyệt.
	//              Phiếu tiếp theo sẽ cần cả trưởng phòng ban phê duyệt."
}
// KHÔNG disable nút — mọi phiếu hợp lệ đều tạo được
```

> **Không còn block tạo phiếu**. Response cũ (`usedCount`, `remaining`, `isBlocked`, `blockedMessage`) đã bị xóa — nếu FE vẫn đọc, cập nhật ngay để tránh runtime undefined.

---

## POST /v1/violation-requests — Tạo phiếu giải trình

**Content-Type:** `multipart/form-data` (dù không upload ảnh vẫn phải dùng form-data)

### Ví dụ: Đi muộn (LATE)

```json
{
	"type": "LATE",
	"violationDate": "2026-05-15",
	"reason": "Tôi bị kẹt xe trên đường đến công ty"
}
```

### Ví dụ: Về sớm (EARLY)

```json
{
	"type": "EARLY",
	"violationDate": "2026-05-15",
	"reason": "Cần đưa con đi khám bệnh theo lịch hẹn bác sĩ"
}
```

### Ví dụ: Quên chấm công vào (FORGOT_CHECKIN)

```json
{
	"type": "FORGOT_CHECKIN",
	"violationDate": "2026-05-15",
	"reason": "Tôi quên chấm công do có cuộc họp khẩn đầu giờ"
}
```

> Server tự xác định là thiếu check-in/check-out hay quên cả ngày dựa vào bản ghi chấm công ngày đó. Không cần gửi `requestedCheckIn`/`requestedCheckOut`. Có thể gửi ngay trong ngày, không cần đợi bản ghi bị khóa.

### Ví dụ: Quên chấm công ra (FORGOT_CHECKOUT)

```json
{
	"type": "FORGOT_CHECKOUT",
	"violationDate": "2026-05-15",
	"reason": "Tôi ra về vội do có việc gia đình, quên bấm chấm công ra"
}
```

> Bắt buộc phải có bản ghi chấm công ngày đó (đã check-in). Có thể gửi ngay trong ngày.

**Upload ảnh minh chứng (tùy chọn):** Gửi file qua field `evidencePhoto` trong form-data. Chấp nhận JPG/PNG, tối đa 5MB.

**Response 201:** `ApiSuccess<ViolationRequest>`

**Lỗi có thể gặp:**

| HTTP | Mô tả |
| --- | --- |
| 400 | Đã quá hạn tạo phiếu cho ngày vi phạm này |
| 400 | `FORGOT_CHECKOUT`: Không tìm thấy bản ghi chấm công ngày đó (chưa check-in) |
| 400 | `FORGOT_CHECKOUT`: Bản ghi đã có giờ chấm công ra rồi |
| 409 | Đã có phiếu PENDING / PENDING_L2 / APPROVED cho bản ghi này (hoặc cho cùng ngày với FORGOT_CHECKIN quên cả ngày) |

> **Không còn error 400 "hết lượt giải trình"** — quota 5 lần/tháng đã bị bỏ. Ngưỡng 5 chỉ chuyển luồng sang multi-level.

---

## GET /v1/violation-requests — Danh sách phiếu

**Query params:** `?month=5&year=2026&departmentId=1&status=PENDING&type=LATE&page=1&limit=20`

Nếu không truyền `month`/`year`, server mặc định tháng/năm hiện tại.

**Hành vi theo role:**

- **HR/ADMIN:** Xem tất cả. `departmentId` filter tùy chọn.
- **MANAGER:** Tự động chỉ thấy phòng ban của mình. `departmentId` từ query bị **bỏ qua**.

**Response:** `ApiPaginated<ViolationRequest>` — shape giống `/me`.

---

## GET /v1/violation-requests/report — Thống kê tháng (HR/Admin)

**Query params bắt buộc:** `?month=5&year=2026` **Query params tùy chọn:** `?departmentId=1`

**Response:** `ApiSuccess<ViolationMonthlyStats[]>`

```json
{
	"success": true,
	"data": [
		{
			"employeeId": 4,
			"employeeCode": "EMP004",
			"fullName": "Nguyễn Văn An",
			"departmentName": "Kỹ thuật",
			"forgotCount": 0,
			"lateCount": 2,
			"earlyCount": 1,
			"totalCount": 3,
			"flaggedCount": 0,
			"remainingQuota": 2
		}
	]
}
```

> `forgotCount` / `lateCount` / `earlyCount` chỉ đếm phiếu **APPROVED**.  
> `remainingQuota` tính từ cả PENDING + APPROVED, nên có thể nhỏ hơn `5 - totalCount`.

---

## PATCH /v1/violation-requests/:id/approve — Duyệt phiếu

Không cần body. Endpoint xử lý cả L1 và L2 — server tự route theo `status` hiện tại.

**Điều kiện gọi:**

| Status hiện tại | Ai được approve                                                           |
| --------------- | ------------------------------------------------------------------------- |
| `PENDING`       | Đúng `assignedReviewerId` (L1) **hoặc** HR (khi L1 = null) **hoặc** ADMIN |
| `PENDING_L2`    | Đúng `approverL2Id` (L2) **hoặc** HR (khi L2 = null) **hoặc** ADMIN       |

**Kết quả sau khi approve:**

| Trước | Sau (single-level: `isMultiLevel=false`) | Sau (multi-level: `isMultiLevel=true`) |
| --- | --- | --- |
| `PENDING` | `status: APPROVED` + apply attendance correction | `status: PENDING_L2`, set `approvedL1At`, **chưa** apply attendance; notify L2 + owner |
| `PENDING_L2` | (không thể — single-level không có state này) | `status: APPROVED` + apply attendance correction |

**Side effect khi vào state `APPROVED` — cập nhật bản ghi chấm công:**

| Loại | Hành động |
| --- | --- |
| `FORGOT_CHECKIN` (có bản ghi, thiếu check-in/out) | Điền check-in/check-out còn thiếu theo giờ ca, `lateMinutes`/`earlyMinutes` → 0, `status` → `PRESENT` |
| `FORGOT_CHECKIN` (không có bản ghi, `slotCost=2`) | **Tạo mới** bản ghi với cả check-in + check-out theo ca, `status: PRESENT`, `isManual: true` |
| `FORGOT_CHECKIN` (không có bản ghi, `slotCost` = 0 hoặc 1) | **Tạo mới** bản ghi chỉ với check-in theo ca (nhân viên tự check-out sau nếu cần), `isManual: true` |
| `FORGOT_CHECKOUT` | Điền `checkOutAt` theo giờ kết thúc ca, `earlyMinutes` → 0, `status` → `PRESENT` |
| `LATE` | Tính lại `lateMinutes` = `max(0, checkIn - (shiftStart + approvedLate + lateThreshold))`, `status` → `PRESENT` nếu new=0 |
| `EARLY` | Tính lại `earlyMinutes` = `max(0, (shiftEnd - approvedEarly) - checkOut)` |

> Giờ ca ưu tiên `effectiveShiftOverride` (nghỉ nửa ngày) trước, fallback về `shift.checkInTime`/`shift.checkOutTime`.  
> Với FORGOT_CHECKIN (không có bản ghi): ưu tiên `EmployeeShiftSchedule` của ngày đó, fallback về `defaultShift` của nhân viên.

> **Approve L1 multi-level KHÔNG apply attendance ngay** — chỉ apply khi vào `APPROVED` (sau L2). Điều này đảm bảo attendance chỉ được sửa 1 lần duy nhất trong toàn bộ luồng.

**Response 200:** `ApiSuccess<ViolationRequest>` — status `PENDING_L2` (nếu vừa qua L1 multi-level) hoặc `APPROVED` (nếu vừa qua L2 hoặc single-level).

**Lỗi có thể gặp:**

| HTTP | Mô tả                                                                            |
| ---- | -------------------------------------------------------------------------------- |
| 400  | Phiếu không ở trạng thái chờ duyệt (`PENDING` hoặc `PENDING_L2`)                 |
| 403  | `"Chỉ Quản lý trực tiếp được phân công mới có thể duyệt cấp 1"` — sai người ở L1 |
| 403  | `"Chỉ Trưởng phòng ban được phân công mới có thể duyệt cấp 2"` — sai người ở L2  |
| 404  | Phiếu không tồn tại                                                              |

---

## PATCH /v1/violation-requests/:id/reject — Từ chối phiếu

**Request body:**

```json
{ "reviewNote": "Thông tin không khớp với dữ liệu chấm công hệ thống" }
```

`reviewNote` là **bắt buộc** khi từ chối (server trim, không cho phép chuỗi rỗng).

**Điều kiện:** Cho phép reject ở cả `PENDING` và `PENDING_L2`; guard theo cấp hiện tại — L1 approver reject `PENDING`, L2 approver reject `PENDING_L2`. HR + ADMIN vẫn override như approve.

**Response 200:** `ApiSuccess<ViolationRequest>` (status = `REJECTED`).

**Sau khi REJECT:**

- Phiếu không còn cộng vào `approvedThisMonth` → nhân viên được tạo phiếu mới cho cùng tháng, cùng ngày.
- `approvedL1At` **giữ nguyên** nếu L2 reject (đã qua L1 rồi) — audit trail phản ánh chuỗi action thực tế.
- Attendance record **không** bị thay đổi (kể cả khi reject ở L2, tức đã qua L1) — chỉ `finalizeApproval` (state APPROVED) mới apply attendance.

---

## PATCH /v1/violation-requests/:id/cancel — Thu hồi phiếu

Không cần body. Chỉ chính chủ (`employeeId === user.id`) gọi được. Cho phép thu hồi khi `status ∈ {PENDING, PENDING_L2}`.

**Response 200:** `ApiSuccess<ViolationRequest>` (status = `CANCELLED`).

**400** nếu không phải PENDING/PENDING_L2:

```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Chỉ được thu hồi phiếu đang chờ duyệt" } }
```

**403** nếu không phải chính chủ:

```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Chỉ được thu hồi phiếu của chính mình" } }
```

---

## Đính kèm phiếu trong bản ghi chấm công

`GET /v1/attendance/me` trả về field `violationRequests` trong mỗi bản ghi chấm công:

```typescript
// Thêm vào AttendanceRecord
violationRequests: {
	id: number;
	type: ViolationRequestType;
	typeLabel: string;
	status: ViolationRequestStatus;
	reason: string;
	createdAt: string;
}
[];
```

Ví dụ bản ghi đã được duyệt violation LATE:

```json
{
	"id": 78,
	"date": "2026-05-14",
	"checkInAt": "2026-05-14T01:30:00.000Z",
	"lateMinutes": 0,
	"status": "PRESENT",
	"isManual": true,
	"shift": { "id": 4, "name": "Ca hành chính HN", "checkInTime": "08:30", "checkOutTime": "18:00" },
	"violationRequests": [
		{
			"id": 1,
			"type": "LATE",
			"typeLabel": "Đi muộn",
			"status": "APPROVED",
			"reason": "Tôi bị kẹt xe trên đường đến công ty",
			"createdAt": "2026-05-21T09:21:37.060Z"
		}
	]
}
```

Mảng rỗng `[]` với các ngày không có phiếu.

---

## Báo cáo vi phạm — `/v1/reports/violations`

Ngoài endpoint `/v1/violation-requests/report`, HR/Admin có thể dùng endpoints trong `ReportsController`:

| Method | Path                            | Ghi chú                                                     |
| ------ | ------------------------------- | ----------------------------------------------------------- |
| GET    | `/v1/reports/violations`        | JSON thống kê — cùng shape với `/violation-requests/report` |
| GET    | `/v1/reports/violations/export` | Tải file Excel                                              |

**Query params:** `?month=5&year=2026&departmentId=1`

File Excel gồm các cột: Mã NV · Họ tên · Phòng ban · Quên CC · Đi muộn · Về sớm · Tổng · Vi phạm KL · Quota còn lại.

---

## Composable — useViolationRequests

```typescript
// composables/useViolationRequests.ts
import type {
	ViolationRequest,
	ViolationMonthlyStatus,
	ViolationMonthlyStats,
	CreateViolationRequestDto,
	RejectViolationRequestDto,
	QueryViolationRequestParams,
	QueryViolationReportParams,
} from '~/types/violation.types';

export function useViolationRequests() {
	const { get, list, post, patch } = useFetch();

	/** Mọi user: danh sách phiếu của bản thân */
	const fetchMyRequests = (params?: QueryViolationRequestParams) =>
		list<ViolationRequest>('/v1/violation-requests/me', { params });

	/**
	 * Mọi user: trạng thái duyệt tháng.
	 * Dùng để hiển thị banner cho user biết phiếu mới sẽ single-level hay multi-level.
	 * Không còn dùng để block tạo phiếu.
	 */
	const fetchMyMonthlyStatus = (month: number, year: number) =>
		get<ViolationMonthlyStatus>('/v1/violation-requests/me/status', { params: { month, year } });

	/**
	 * Tạo phiếu giải trình — gửi dưới dạng FormData.
	 * Nếu có ảnh minh chứng, append vào field "evidencePhoto".
	 */
	const submitRequest = (dto: CreateViolationRequestDto) => {
		const form = new FormData();
		form.append('type', dto.type);
		form.append('violationDate', dto.violationDate);
		form.append('reason', dto.reason);
		if (dto.evidencePhoto) form.append('evidencePhoto', dto.evidencePhoto);
		return post<ViolationRequest>('/v1/violation-requests', form);
	};

	/** HR/Admin/Manager: danh sách phiếu theo quyền */
	const fetchAllRequests = (params?: QueryViolationRequestParams) =>
		list<ViolationRequest>('/v1/violation-requests', { params });

	/** HR/Admin: thống kê vi phạm tháng */
	const fetchMonthlyReport = (params: QueryViolationReportParams) =>
		get<ViolationMonthlyStats[]>('/v1/violation-requests/report', { params });

	/** Manager (được phân công): duyệt phiếu */
	const approveRequest = (id: number) => patch<ViolationRequest>(`/v1/violation-requests/${id}/approve`);

	/**
	 * Manager (được phân công): từ chối phiếu.
	 * reviewNote bắt buộc.
	 */
	const rejectRequest = (id: number, dto: RejectViolationRequestDto) =>
		patch<ViolationRequest>(`/v1/violation-requests/${id}/reject`, dto);

	/** Chính chủ: thu hồi phiếu đang chờ */
	const cancelRequest = (id: number) => patch<ViolationRequest>(`/v1/violation-requests/${id}/cancel`);

	return {
		fetchMyRequests,
		fetchMyMonthlyStatus,
		submitRequest,
		fetchAllRequests,
		fetchMonthlyReport,
		approveRequest,
		rejectRequest,
		cancelRequest,
	};
}
```

---

## Edge cases

| Tình huống | Kết quả |
| --- | --- |
| Tạo 20+ phiếu trong tháng, tất cả PENDING/APPROVED | 201 — **không còn giới hạn 5 lần/tháng**, chỉ chuyển sang multi-level từ phiếu thứ có `approvedThisMonth >= 5` |
| Tạo phiếu với `violationDate` tháng trước đã qua ngày 05 tháng này | 400 — đã quá hạn |
| `violationDate = 2026-05-31`, tạo vào 2026-06-06 | 400 — đã quá hạn (deadline là 05/06) |
| `violationDate = 2026-05-31`, tạo vào 2026-06-05 23:59 | 201 — còn trong deadline |
| FORGOT_CHECKIN, có bản ghi (chưa hoặc đã bị khóa) — cho phép gửi trong ngày | 201 — hợp lệ |
| FORGOT_CHECKIN, có bản ghi + đã có phiếu PENDING / PENDING_L2 / APPROVED | 409 |
| FORGOT_CHECKIN, không có bản ghi (quên cả ngày) + đã có phiếu PENDING / PENDING_L2 / APPROVED cùng ngày | 409 |
| FORGOT_CHECKIN, không có bản ghi, hôm nay, ca có `requireCheckOut=false` | 201 với `slotCost: 0` |
| FORGOT_CHECKIN, không có bản ghi, hôm nay, check-out window chưa đóng | 201 với `slotCost: 1` |
| FORGOT_CHECKIN, không có bản ghi, hôm nay, check-out window đã đóng | 201 với `slotCost: 2` |
| FORGOT_CHECKIN, phiếu trước REJECTED → tạo lại cho cùng ngày | 201 — hợp lệ |
| FORGOT_CHECKOUT, không có bản ghi chấm công ngày đó | 400 — cần check-in trước |
| FORGOT_CHECKOUT, bản ghi đã có `checkOutAt` | 400 — đã chấm công ra rồi |
| FORGOT_CHECKOUT, có bản ghi + đã có phiếu PENDING / PENDING_L2 / APPROVED | 409 |
| FORGOT_CHECKOUT, phiếu trước REJECTED → tạo lại | 201 — hợp lệ |
| LATE/EARLY — không cần gửi thêm field nào | 201 — chỉ cần type + violationDate + reason |
| EMPLOYEE gọi `GET /violation-requests` | 403 Forbidden |
| MANAGER gọi `GET /violation-requests` | 200 — chỉ thấy phòng ban của mình |
| MANAGER là L1 (`assignedReviewerId`) đúng, approve khi `PENDING` | 200 — chuyển `APPROVED` (single) hoặc `PENDING_L2` (multi) |
| MANAGER không phải `assignedReviewerId` gọi approve `PENDING` | 403 |
| Trưởng phòng (L2) approve khi `PENDING_L2` | 200 — chuyển `APPROVED` |
| Trưởng phòng (L2) gọi approve khi `PENDING` (chưa qua L1) | 403 — sai cấp |
| L1 gọi approve khi `PENDING_L2` (đã qua L1, sai người) | 403 — chỉ L2 mới duyệt được cấp 2 |
| HR gọi approve `PENDING` khi `assignedReviewerId = null` | 200 — HR fallback L1 |
| HR gọi approve `PENDING` khi `assignedReviewerId != null` | 403 — không phải người được phân công |
| HR gọi approve `PENDING_L2` khi `approverL2Id = null` | 200 — HR fallback L2 |
| ADMIN approve/reject ở bất kỳ cấp nào | 200 — super-override (stopgap) |
| Reject `PENDING_L2` (đã qua L1) | 200 — `status: REJECTED`, `approvedL1At` giữ nguyên, attendance KHÔNG thay đổi |
| Cancel `PENDING_L2` (owner) | 200 — `status: CANCELLED` |
| Cancel phiếu đã APPROVED | 400 — chỉ được thu hồi khi đang chờ duyệt |
| Cancel phiếu của người khác | 403 Forbidden |
| Approve L1 multi-level (`PENDING → PENDING_L2`) | Attendance **CHƯA** apply — chỉ notify L2 + owner |
| Approve L2 (`PENDING_L2 → APPROVED`) | Attendance apply, notify owner + tất cả HR |
| Approve LATE cuối cùng → lateMinutes = 0, status = PRESENT | tự động |
| Approve EARLY cuối cùng → earlyMinutes = 0, status = PRESENT | tự động |
| Approve FORGOT_CHECKIN (thiếu check-in/out) → điền từ ca, lateMinutes/earlyMinutes = 0 | tự động |
| Approve FORGOT_CHECKIN (không có bản ghi, `slotCost=2`) → tạo bản ghi mới đủ check-in + check-out theo ca | tự động |
| Approve FORGOT_CHECKIN (không có bản ghi, `slotCost=0` hoặc `1`) → chỉ tạo check-in | tự động |
| Approve FORGOT_CHECKOUT → checkOutAt = giờ kết thúc ca, earlyMinutes = 0, status = PRESENT | tự động |
| FORGOT_CHECKIN không có bản ghi, employee không có shift và không có defaultShift | Approve OK nhưng bản ghi không được tạo (log warning) |
| Employee.managerId = Department.managerId (cùng 1 người) | L1 = người đó, L2 = CHIEF |
| Không có Department.managerId | L1 vẫn từ `Employee.managerId`, L2 = CHIEF |
| Không có Employee.managerId và không có Department.managerId | L1 = null (HR fallback), L2 = CHIEF |
| Không có CHIEF nào ACTIVE (hoặc chỉ có 1 CHIEF là chính owner) | L2 = null (HR fallback) |
| Employee đổi phòng khi phiếu đang `PENDING_L2` | L2 **không auto reassign** — `approverL2Id` giữ người cũ |
| Bản ghi chấm công có `violationRequests[]` rỗng | ngày không có phiếu nào |
| Bản ghi chấm công có `violationRequests[]` không rỗng | hiển thị badge/link xem phiếu |
