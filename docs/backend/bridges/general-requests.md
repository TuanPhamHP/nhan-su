# Bridge Docs — Phiếu đề xuất (`/v1/general-requests`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.
> Trước lô 4a (11/2026) module này tên "Đơn văn bản / Đơn từ chung". Đường dẫn giữ nguyên, tên hiển thị đổi thành
> **Phiếu đề xuất**. Thiết kế: `docs/modules/16-approval.md` mục "Lô 4a". Kiểu trường biểu mẫu `dataSource`:
> [general-requests-field-datasource.md](./general-requests-field-datasource.md).

---

## 1. Thay đổi so với trước lô 4a (đọc trước)

| Trước | Từ lô 4a |
|---|---|
| Người gửi tự chọn chuỗi người duyệt, kể cả chính mình | Mỗi loại phiếu có **luồng duyệt** do HR cấu hình. Người gửi chỉ chọn ở bước "người gửi chọn", **không chọn được mình** (400) |
| Ai có quyền `general-request:approve` hoặc là ADMIN đều duyệt được | **Chỉ người đang giữ lượt** ở bước hiện tại duyệt được (403 `REQUEST_NOT_ASSIGNEE`). ADMIN duyệt thay qua route riêng, bắt buộc lý do |
| `GET /me`: HR thấy mọi đơn, trưởng phòng thấy đơn liên quan | `GET /me` chỉ là phiếu **của tôi**. Tra cứu toàn bộ dùng `GET /` (theo phạm vi xem) |
| `pending-for-me` chặn EMPLOYEE | Mọi vai trò gọi được |
| Từ chối là hết | Thêm **trả lại để bổ sung** (`RETURNED`), nộp lại duyệt từ bước đầu |
| Không số hiệu, file, bình luận | Số hiệu `TT-0012/2026`, file đính kèm, bình luận, người theo dõi, mời ý kiến |
| Nút trên màn do FE tự tính từ quyền | Dùng cờ `can*` trong response |

`approvers`, `currentApproverIndex`, `currentApprover` vẫn trả (dựng từ `steps`) để màn cũ và app chưa cập nhật không gãy.
Màn mới dùng `steps`, `currentStep`, `timeline`.

---

## 2. Endpoints

Mọi route cần đăng nhập. Không xem được phiếu thì **404** như phiếu không tồn tại.

### 2.1 Loại phiếu (mẫu) và luồng duyệt

| Method | Path | Ai | Ghi chú |
|---|---|---|---|
| GET | `/templates` | Mọi người | `?isActive=true` khi cho người dùng chọn. Có `codePrefix`, `defaultWatcherIds` |
| GET | `/templates/:id` | Mọi người | |
| POST | `/templates` | Quyền `request-type:manage` | Thêm `codePrefix` (A-Z, 0-9, 1–10 ký tự), `defaultWatcherIds`, `isActive`. Tự tạo luồng mặc định "người gửi chọn" |
| PATCH | `/templates/:id` | `request-type:manage` | Như trên; `isActive: false` là tắt mẫu (không tạo phiếu mới được) |
| GET | `/templates/:id/flow` | Mọi người | Luồng hiện tại `{ templateId, version, steps[] }` |
| PUT | `/templates/:id/flow` | `request-type:manage` | Body `{ steps: FlowStep[], expectedVersion? }`, 1–10 bước. Tạo phiên bản mới; phiếu đang chạy giữ chuỗi cũ. `expectedVersion` là `version` lúc mở màn: khác bản hiện tại thì 409 `APPROVAL_FLOW_CHANGED` |
| POST | `/templates/:id/flow/preview` | Mọi người | Body `{ fieldValues?, pickedApprovers? }` → chuỗi người duyệt sẽ tính cho người gọi |

### 2.2 Danh sách

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/me` | Phiếu của tôi, kể cả nháp. Tab "Cần bổ sung" là `?status=RETURNED` |
| GET | `/pending-for-me` | Phiếu đang chờ **tôi** duyệt (mảng, không phân trang), hạn gần nhất trước. Mỗi phần tử thêm `dueAt`, `overdue`, `onBehalfOf` |
| GET | `/watching` | Phiếu tôi theo dõi hoặc được mời cho ý kiến |
| GET | `/` | Tra cứu trong phạm vi xem được (mục 3) |
| GET | `/suggested-approvers` | Giữ cho trang tạo đơn công tác tới lô 4c. Phiếu đề xuất **không** dùng nữa |

Bộ lọc chung (query): `page`, `limit` (≤100), `status`, `templateId`, `employeeId` (người gửi, chỉ `GET /`), `approverId`
(người từng hoặc đang duyệt, chỉ `GET /`), `from`, `to` (ngày gửi `YYYY-MM-DD`, giờ Việt Nam, tính cả hai đầu), `code`
(khớp một phần), `q` (tiêu đề hoặc số hiệu). `status` lạ → 400.

### 2.3 Phiếu

| Method | Path | Ai | Ghi chú |
|---|---|---|---|
| POST | `/` | Mọi người | Tạo nháp `{ templateId, title, fieldValues }`. Kiểm kiểu và key lạ, chưa đòi trường bắt buộc |
| GET | `/:id` | Người xem được | Chi tiết đầy đủ (mục 5) |
| PATCH | `/:id/draft` | Người gửi, khi `DRAFT` hoặc `RETURNED` | `{ fieldValues, title? }` |
| DELETE | `/:id` | Người gửi, chỉ `DRAFT` | Xoá hẳn nháp → 204 |
| PATCH | `/:id/submit` | Người gửi, khi `DRAFT` hoặc `RETURNED` | Gửi lần đầu hoặc **nộp lại**. Body `{ pickedApprovers?, watcherIds? }`. Nộp lại mà không gửi `pickedApprovers` thì giữ người đã chọn ở vòng trước (mục 6) |
| PATCH | `/:id/approve` | Người đang giữ lượt | `{ note?, stepOrder? }` |
| PATCH | `/:id/reject` | Người đang giữ lượt | `{ note, stepOrder? }`, lý do bắt buộc (nhận cả `rejectNote` cho nút từ chối nhanh trong thông báo) |
| PATCH | `/:id/return` | Người đang giữ lượt | `{ note, stepOrder? }` → `RETURNED` |
| PATCH | `/:id/transfer` | Người đang giữ lượt | `{ toEmployeeId, note? }`. Không chuyển cho người gửi, cho mình, người đã nghỉ |
| PATCH | `/:id/override` | Chỉ ADMIN | `{ decision: APPROVE\|REJECT\|RETURN, note (≥5 ký tự), stepOrder? }`. Không với phiếu của mình |
| PATCH | `/:id/reassign` | Quyền `request:reassign` (HR) | `{ fromEmployeeId, toEmployeeId, note }` đổi người duyệt ở mọi bước còn mở |
| PATCH | `/:id/cancel` | Người gửi | Thu hồi: nháp, cần bổ sung, hoặc chờ duyệt **khi chưa ai đồng ý ở vòng này** |
| POST | `/:id/print` | Người xem được, phiếu `APPROVED` | Tăng `printCount`, trả `printTemplate` (mục 7) |
| GET | `/:id/comments` | Người xem được | |
| POST | `/:id/comments` | Người xem được, phiếu đã gửi | `{ body (≤2000), mentionIds? }`. Người được nhắc phải xem được phiếu |
| POST | `/:id/watchers` | Người gửi (theo dõi); người gửi hoặc người đang duyệt (mời ý kiến) | `{ employeeIds, consult? }` |
| POST | `/:id/attachments` | Người gửi, khi `DRAFT` hoặc `RETURNED` | Multipart field `file`. PDF, JPG, PNG, DOCX, XLSX, DOC, XLS; ≤10 MB; ≤10 file |
| DELETE | `/:id/attachments/:attachmentId` | Người gửi, khi `DRAFT` hoặc `RETURNED` | 204 |
| GET | `/:id/attachments/:attachmentId/url` | Người xem được | `{ url, expiresIn: 3600 }`, link ký 1 giờ |

Mọi route thao tác trả **chi tiết phiếu mới nhất** (`GeneralRequestDetail`) để FE thay ngay vào màn.

### 2.4 Uỷ quyền duyệt (`/v1/approval-delegations`)

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/v1/approval-delegations` | Uỷ quyền tôi giao và người khác giao cho tôi, chưa huỷ. `isMine` = tôi là người uỷ quyền |
| POST | `/v1/approval-delegations` | `{ delegateId, startDate, endDate, note? }`, ngày `YYYY-MM-DD`, từ hôm nay, tối đa 90 ngày |
| DELETE | `/v1/approval-delegations/:id` | Chỉ người uỷ quyền huỷ được → 204 |

Uỷ quyền áp khi **bước tới lượt** trong khoảng ngày: lượt của người vắng chuyển sang người được uỷ quyền, hiện
"duyệt thay [tên]" (`onBehalfOf`). Bước đã tới lượt trước khi uỷ quyền thì không đổi; người duyệt tự chuyển nếu cần.

### 2.5 Số đếm

`GET /v1/approval/counts` thêm khoá **`generalRequests`** (số phiếu đang chờ tôi), đã cộng vào `total`. Xem
[approval.md](./approval.md).

---

## 3. Ai xem được phiếu

Người gửi; người từng hoặc đang được giao duyệt ở mọi vòng (kể cả duyệt thay theo uỷ quyền); người theo dõi và người
được mời ý kiến; trưởng phòng (`Department.managerId`, và MANAGER với phòng của mình) với phiếu của nhân viên phòng mình;
người có quyền `request:read:all` (HR mặc định, ADMIN). **Không ai khác**, kể cả CHIEF, DIRECTOR không liên quan. Nháp
chỉ người gửi thấy.

---

## 4. TypeScript types

```typescript
export type GeneralRequestStatus = 'DRAFT' | 'PENDING' | 'RETURNED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ApprovalMode = 'ANY' | 'ALL';
export type ApprovalStepStatus = 'WAITING' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'SKIPPED' | 'CANCELLED';
export type ApprovalAssignmentStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'RETURNED' | 'TRANSFERRED' | 'SUPERSEDED';
export type ApprovalActionType =
  | 'SUBMIT' | 'RESUBMIT' | 'APPROVE' | 'REJECT' | 'RETURN' | 'TRANSFER' | 'REASSIGN'
  | 'DELEGATE' | 'AUTO_APPROVE' | 'SKIP' | 'OVERRIDE' | 'CANCEL';
export type WatcherSource = 'DEFAULT' | 'ADDED' | 'CONSULT';

export interface Person { id: number; fullName: string }

export interface StepAssignment {
  id: number;
  employee: Person;
  onBehalfOf: Person | null;     // đang duyệt thay người này theo uỷ quyền
  status: ApprovalAssignmentStatus;
  statusLabel: string;           // nhãn tiếng Việt, hiện thẳng
  decidedBy: Person | null;      // khác employee khi ADMIN duyệt thay
  decidedAt: string | null;
  note: string | null;
}

export interface RequestStep {
  order: number;
  name: string;
  mode: ApprovalMode;
  modeLabel: string;             // "Một người đồng ý là đủ" / "Tất cả phải đồng ý"
  status: ApprovalStepStatus;
  statusLabel: string;
  basis: string | null;          // vì sao bước có những người này / vì sao bị bỏ qua
  slaHours: number | null;
  activatedAt: string | null;
  dueAt: string | null;          // hạn xử lý theo giờ làm việc
  overdue: boolean;              // bước đang chờ và đã quá hạn
  completedAt: string | null;
  assignments: StepAssignment[]; // gồm cả lượt TRANSFERRED, SUPERSEDED để hiện lịch sử
}

export interface GeneralRequest {            // phần tử danh sách
  id: number;
  code: string | null;                       // "TT-0012/2026", null khi chưa gửi
  title: string;
  status: GeneralRequestStatus;
  statusLabel: string;                       // "Cần bổ sung"...
  round: number;                             // tăng khi nộp lại
  template: { id: number; name: string; category: string; codePrefix: string };
  fieldValues: Record<string, unknown>;
  printTemplate: string | null;              // chỉ khi /print
  currentStep: { order: number; name: string; dueAt: string | null; overdue: boolean; approvers: Person[] } | null;
  steps: RequestStep[];                      // các bước của VÒNG HIỆN TẠI
  approvers: LegacyApprover[];               // dạng cũ, deprecated
  currentApproverIndex: number;              // deprecated
  currentApprover: LegacyApprover | null;    // deprecated
  printCount: number; printedAt: string | null;
  submittedAt: string | null; returnedAt: string | null; completedAt: string | null; cancelledAt: string | null;
  employee: { id: number; fullName: string; employeeCode: string };
  canEdit: boolean; canSubmit: boolean; canDelete: boolean; canPrint: boolean; canCancel: boolean;
  canApprove: boolean; canReject: boolean; canReturn: boolean; canTransfer: boolean;
  canOverride: boolean; canReassign: boolean;
  canComment: boolean; canAttach: boolean; canAddWatcher: boolean; canConsult: boolean;
  createdAt: string; updatedAt: string;
}

export interface GeneralRequestDetail extends GeneralRequest {
  timeline: TimelineEntry[];                 // mọi vòng, chỉ thêm
  watchers: { employeeId: number; fullName: string; source: WatcherSource; sourceLabel: string }[];
  attachments: { id: number; fileName: string; mimeType: string; size: number; uploadedBy: Person; createdAt: string }[];
  commentCount: number;
}

export interface PendingRequest extends GeneralRequest {
  dueAt: string | null; overdue: boolean; onBehalfOf: Person | null;
}

export interface TimelineEntry {
  id: number;
  round: number;
  action: ApprovalActionType;
  actionLabel: string;                       // "Đồng ý", "Trả lại để bổ sung"...
  actor: Person | null;                      // null = hệ thống (tự duyệt, bỏ bước, chuyển khi người duyệt nghỉ)
  onBehalfOf: Person | null;
  stepOrder: number | null;
  note: string | null;
  detail: string | null;                     // "Lê Văn Dũng → Lý Quốc Khánh" khi chuyển
  createdAt: string;
}

// Luồng duyệt (GET/PUT /templates/:id/flow)
export type ApproverKind = 'DIRECT_MANAGER' | 'MANAGER_LEVEL' | 'DEPARTMENT_HEAD' | 'EMPLOYEES' | 'ROLE' | 'SUBMITTER_PICK';
export interface FlowStep {
  order?: number;                            // server đánh lại từ 1 theo thứ tự mảng
  name: string;                              // ≤100 ký tự
  approver: {
    kind: ApproverKind;
    level?: number;                          // MANAGER_LEVEL, 1–5
    employeeIds?: number[];                  // EMPLOYEES, người đang làm việc
    role?: 'ADMIN' | 'HR' | 'DIRECTOR' | 'MANAGER' | 'CHIEF' | 'EMPLOYEE';  // ROLE
    pick?: { roles: string[]; min: number; max: number; sequential?: boolean }; // SUBMITTER_PICK; roles rỗng = mọi người
  };
  mode: ApprovalMode;
  slaHours?: number;                         // giờ làm việc, 1–400; vắng = không có hạn
  condition?: {
    all?: { field: string; op: '=' | '!=' | '>' | '>=' | '<' | '<=' | 'in'; value: string | number | boolean | (string | number)[] }[];
    any?: { field: string; op: string; value: unknown }[];
  };
}
```

Người duyệt theo từng kiểu: `DIRECT_MANAGER` quản lý trực tiếp; `MANAGER_LEVEL` đi ngược chuỗi quản lý n bậc;
`DEPARTMENT_HEAD` trưởng phòng của người gửi; `EMPLOYEES` người cố định; `ROLE` mọi người đang làm có vai trò đó;
`SUBMITTER_PICK` người gửi chọn trong danh sách giới hạn, `sequential: true` thì mỗi người được chọn là một bước, duyệt
lần lượt. Điều kiện dùng key trường kiểu `number`, `select`, `date`, `checkbox`, `text` của mẫu, hoặc
`submitter.departmentId`, `submitter.role`; trường trống thì điều kiện không khớp.

---

## 5. Luồng chính phía client

```
Gửi phiếu
 1. GET /templates?isActive=true                → chọn loại phiếu
 2. POST /                                      → tạo nháp
 3. PATCH /:id/draft { fieldValues }            → lưu nháp (debounce)
 4. POST /:id/attachments (multipart)           → đính kèm (tuỳ chọn)
 5. POST /templates/:id/flow/preview { fieldValues, pickedApprovers }
      → hiện chuỗi: bước bị bỏ qua (skipped + basis), bước "người gửi chọn" (needsPick + candidates)
      → gọi lại mỗi khi người dùng đổi giá trị có trong điều kiện hoặc chọn người
 6. PATCH /:id/submit { pickedApprovers: [{ stepOrder: flowStepOrder, employeeIds }], watcherIds }

Duyệt
 - Hộp chờ: GET /pending-for-me; badge: GET /v1/approval/counts → generalRequests
 - Chi tiết: GET /:id → hiện nút theo canApprove / canReject / canReturn / canTransfer / canOverride / canReassign
 - Gửi kèm stepOrder = currentStep.order khi approve/reject/return/override
```

Xem trước (`FlowPreviewStep`): `order`, `flowStepOrder`, `name`, `mode`, `modeLabel`, `slaHours`, `skipped`, `basis`,
`approvers[{id, fullName, role, roleLabel}]`, `needsPick`, `pick`, `candidates[{id, fullName, role, roleLabel,
departmentName}]`. `candidates` không có chính người gọi. Chọn chính mình → 400 `REQUEST_SELF_APPROVER`.

**Cách gửi cũ** `PATCH /:id/submit { approvers: [{ employeeId }] }` vẫn nhận: gán vào bước "người gửi chọn" đầu tiên
của luồng. Màn mới dùng `pickedApprovers`.

---

## 6. Quy tắc nghiệp vụ FE cần biết

- **Bước "tất cả" (`ALL`)**: đủ mọi người đồng ý mới qua bước; một người từ chối là phiếu bị từ chối.
- **Tự duyệt bước kế (BR-08)**: mọi người của bước kế đều vừa đồng ý ở bước trước thì bước kế `SKIPPED` với
  `AUTO_APPROVE` trên dòng thời gian.
- **Người gửi trùng người duyệt** ở bước theo luồng: lên quản lý trực tiếp của người gửi, không có thì HR (`basis` ghi lý
  do). Không bước nào áp dụng: thêm bước "Người duyệt dự phòng".
- **Trả lại, nộp lại**: phiếu `RETURNED` sửa được (`canEdit`), nộp lại thì `round + 1`, tính lại chuỗi theo dữ liệu mới
  và luồng hiện tại, duyệt lại từ bước đầu, **số hiệu giữ nguyên**. `steps` chỉ là vòng hiện tại; vòng cũ xem ở
  `timeline` (lọc theo `round`).
- **Người đã chọn khi nộp lại**: không gửi `pickedApprovers` thì máy chủ dùng lại lựa chọn của vòng ngay trước. Nếu HR
  đã lưu luồng phiên bản mới giữa hai vòng thì lựa chọn cũ bị bỏ (thứ tự bước có thể đã khác), máy chủ trả 400
  `REQUEST_NO_APPROVER` và người gửi phải chọn lại. Gửi `pickedApprovers` thì luôn dùng lựa chọn mới.
- **Câu lý do bỏ bước** (`basis` của bước `SKIPPED`) là câu tiếng Việt, số có dấu nhóm nghìn, ví dụ "Bỏ qua vì phiếu
  không thoả điều kiện: Số tiền từ 100.000.000 trở lên". FE hiện nguyên văn.
- **Ô số**: `fieldValues` của trường `number` gửi là số JSON (`80000000`, `1234.59`), không gửi chuỗi đã định dạng
  `"80.000.000"`; máy chủ đọc chuỗi bằng `Number()` nên `"80.000"` sẽ thành 80.
- **Thu hồi**: được khi chưa ai đồng ý ở vòng hiện tại; sau đó 409 `REQUEST_ALREADY_IN_PROGRESS`, gợi ý người dùng nhờ
  người duyệt trả lại.
- **Hai người bấm cùng lúc**: người sau nhận 409 `REQUEST_NOT_PENDING`. Gửi `stepOrder` để cú bấm trên màn cũ không rơi
  sang bước mới. Gặp 409 thì tải lại phiếu.
- **Phiếu đã kết thúc** không sửa, thu hồi, xoá, gửi lại được (409 `REQUEST_IMMUTABLE`).
- **Hạn xử lý** tính theo giờ làm việc thứ Hai–thứ Sáu 08:00–12:00, 13:00–17:00 giờ Việt Nam, trừ ngày lễ. Mặc định
  16 giờ (2 ngày) mỗi bước. Quá hạn chỉ nhắc, không tự chuyển. Đơn cũ chuyển sang không có hạn.
- **Người duyệt nghỉ việc hoặc bị khoá** khi đang giữ bước: hệ thống chuyển cho mọi HR đang làm (bước `ALL`: một HR),
  dòng thời gian có `REASSIGN` không có người làm.
- **Người được mời ý kiến** xem và bình luận được, không có nút duyệt.

---

## 7. In phiếu

`POST /:id/print` chỉ với phiếu `APPROVED` (409 `REQUEST_NOT_APPROVED` nếu chưa), người xem được phiếu đều in được.
Response là chi tiết phiếu, có `printTemplate` (HTML với `{{key}}`). Ghép giá trị phải **escape HTML** từng giá trị
trước khi thay (giá trị do người dùng nhập):

```typescript
let html = printTemplate;
for (const [key, value] of Object.entries(fieldValues)) {
  html = html.replaceAll(`{{${key}}}`, escapeHtml(String(value ?? '')));
}
```

Có thể chèn số hiệu `code` vào đầu bản in. `printTemplate` null ở mọi route khác.

---

## 8. Mã lỗi

| Mã | HTTP | Khi nào |
|---|---|---|
| `GENERAL_REQUEST_NOT_FOUND` | 404 | Không có, hoặc không xem được |
| `REQUEST_NOT_OWNER` | 403 | Không phải người gửi |
| `REQUEST_NOT_ASSIGNEE` | 403 | Không giữ lượt ở bước hiện tại |
| `REQUEST_OVERRIDE_FORBIDDEN` | 403 | Không phải ADMIN mà gọi `/override` |
| `REQUEST_SELF_OVERRIDE` | 403 | ADMIN duyệt thay phiếu của mình |
| `REQUEST_CONSULT_FORBIDDEN` | 403 | Mời ý kiến khi không phải người gửi hoặc người đang duyệt, hoặc phiếu không chờ duyệt |
| `REQUEST_FIELDS_INVALID` | 400 | Giá trị sai kiểu, thiếu trường bắt buộc, key lạ. `message` nối các câu, `error.errors[]` từng câu |
| `REQUEST_SELF_APPROVER` | 400 | Chọn chính mình, hoặc chuyển cho người gửi |
| `REQUEST_NO_APPROVER` | 400 | Bước "người gửi chọn" chưa chọn hoặc sai số người, người chọn đã nghỉ hoặc ngoài nhóm cho phép |
| `REQUEST_NOTE_REQUIRED` | 400 | Từ chối không có lý do |
| `REQUEST_TRANSFER_SAME`, `REQUEST_TRANSFER_INVALID` | 400 | Chuyển cho chính mình, cho người đã nghỉ |
| `REQUEST_REASSIGN_NOT_HOLDER` | 400 | Người cũ không giữ bước nào đang mở |
| `REQUEST_MENTION_NOT_VIEWER` | 400 | Nhắc tên người chưa xem được phiếu |
| `REQUEST_FILE_TYPE`, `REQUEST_FILE_TOO_LARGE`, `REQUEST_FILE_LIMIT`, `REQUEST_FILE_REQUIRED` | 400 | File |
| `REQUEST_FILE_NOT_FOUND` | 404 | File không có hoặc đã gỡ |
| `REQUEST_EMPLOYEE_INVALID` | 400 | Người theo dõi, người được mời không tồn tại hoặc đã nghỉ |
| `APPROVAL_FLOW_INVALID` | 400 | Luồng sai nghĩa (thiếu vai trò, trường điều kiện lạ...) |
| `REQUEST_NOT_PENDING` | 409 | Bước đã có người xử lý, phiếu đổi bước, hoặc đã kết thúc |
| `REQUEST_IMMUTABLE` | 409 | Sửa, gửi, thu hồi phiếu đã kết thúc hoặc đang chờ |
| `REQUEST_ALREADY_IN_PROGRESS` | 409 | Thu hồi khi đã có người đồng ý |
| `REQUEST_NOT_DRAFT` | 409 | Xoá phiếu đã gửi |
| `REQUEST_NOT_SUBMITTED` | 409 | Bình luận phiếu nháp |
| `REQUEST_NOT_APPROVED` | 409 | In phiếu chưa duyệt |
| `APPROVAL_FLOW_CHANGED` | 409 | Lưu luồng với `expectedVersion` cũ, hoặc người khác lưu cùng lúc. Tải lại luồng rồi sửa tiếp |
| `APPROVAL_DELEGATION_SELF`, `APPROVAL_DELEGATION_RANGE`, `APPROVAL_DELEGATION_INVALID` | 400 | Uỷ quyền cho mình, khoảng ngày sai, người nhận đã nghỉ |
| `APPROVAL_DELEGATION_OVERLAP` | 409 | Chồng khoảng ngày với uỷ quyền đang có |
| `APPROVAL_DELEGATION_NOT_OWNER` | 403 | Huỷ uỷ quyền của người khác |

---

## 9. Thông báo

Nội dung chính xác ở `docs/notifications/notification-content-map.md`. `refType = general_request`, `refId` = id phiếu,
`targetUrl = /general-requests?id=<id>` (riêng uỷ quyền: `/general-requests?tab=pending`).

| `type` | Ai nhận | `actionType` | Email |
|---|---|---|---|
| `GENERAL_REQUEST_PENDING` | Người tới lượt duyệt (gửi, qua bước, được chuyển, duyệt thay, được đổi người) | `APPROVE_REJECT` | Có |
| `GENERAL_REQUEST_PENDING` (ThÃ´ng tin:) | Người theo dõi khi phiếu được gửi lần đầu | `NAVIGATE_ONLY` | Không |
| `GENERAL_REQUEST_APPROVED` / `_REJECTED` | Người gửi (có email); người theo dõi | `NAVIGATE_ONLY` | Người gửi |
| `GENERAL_REQUEST_RETURNED` | Người gửi | `NAVIGATE_ONLY` | Có |
| `GENERAL_REQUEST_CANCELLED` | Người đang giữ lượt khi phiếu bị thu hồi | `NAVIGATE_ONLY` | Không |
| `GENERAL_REQUEST_COMMENTED` | Người được nhắc trong bình luận | `NAVIGATE_ONLY` | Không |
| `GENERAL_REQUEST_CONSULT` | Người được mời cho ý kiến | `NAVIGATE_ONLY` | Không |
| `GENERAL_REQUEST_DUE_SOON` / `_OVERDUE` | Người đang giữ lượt, khi tới 75% hạn và khi quá hạn | `NAVIGATE_ONLY` | Quá hạn |
| `APPROVER_REASSIGNED` | Người được uỷ quyền duyệt | `NAVIGATE_ONLY` | Không |

Nút duyệt nhanh (`APPROVE_REJECT`) gọi `PATCH /v1/general-requests/:id/approve` và `.../reject` với `{ rejectNote }`.
HR **không** còn nhận thông báo ở mỗi bước như trước.
