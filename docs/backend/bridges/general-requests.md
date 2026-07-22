# Bridge Docs — Đơn văn bản (`/v1/general-requests`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

### Templates (mẫu văn bản)

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/general-requests/templates` | Mọi user | Danh sách mẫu (có filter) |
| GET | `/v1/general-requests/templates/:id` | Mọi user | Chi tiết mẫu + fields + printTemplate |
| POST | `/v1/general-requests/templates` | `HR`, `ADMIN` | Tạo mẫu mới |
| PATCH | `/v1/general-requests/templates/:id` | `HR`, `ADMIN` | Cập nhật mẫu |

### Requests (đơn văn bản)

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/general-requests/me` | Mọi user | HR/Admin: toàn bộ đơn công ty; Manager/Chief: đơn mình tạo + đơn mình là approver; Employee: đơn của bản thân |
| GET | `/v1/general-requests/pending-for-me` | `MANAGER`, `CHIEF`, `HR`, `ADMIN` | Đơn đang chờ mình duyệt |
| GET | `/v1/general-requests/suggested-approvers` | Mọi user | Gợi ý người duyệt theo hierarchy |
| GET | `/v1/general-requests` | `MANAGER`, `CHIEF`, `HR`, `ADMIN` | Tất cả đơn (có filter, phân trang) |
| POST | `/v1/general-requests` | Mọi user | Tạo đơn mới (trạng thái DRAFT) |
| GET | `/v1/general-requests/:id` | Chủ nhân, `MANAGER`, `CHIEF`, `HR`, `ADMIN` | Chi tiết đơn |
| PATCH | `/v1/general-requests/:id/draft` | Chủ nhân (chỉ khi DRAFT) | Lưu nháp — cập nhật fieldValues |
| PATCH | `/v1/general-requests/:id/submit` | Chủ nhân (chỉ khi DRAFT) | Nộp đơn — chọn ordered approvers |
| PATCH | `/v1/general-requests/:id/approve` | Người duyệt hiện tại | Duyệt — chuyển sang người duyệt tiếp theo |
| PATCH | `/v1/general-requests/:id/reject` | Người duyệt hiện tại | Từ chối toàn bộ chuỗi |
| PATCH | `/v1/general-requests/:id/cancel` | Chủ nhân (chỉ khi DRAFT hoặc PENDING) | Thu hồi đơn — chuyển sang CANCELLED |
| POST | `/v1/general-requests/:id/print` | Chủ nhân, `HR`, `ADMIN` | Tăng printCount, trả về printTemplate |

> **Lưu ý thứ tự route:** `templates`, `me`, `pending-for-me`, `suggested-approvers` đều khai báo **trước** `/:id`.

---

## TypeScript Types

```typescript
// types/general-request.types.ts

export type GeneralRequestStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type ApproverStepStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'WAITING';

// ── FieldDefinition — cấu trúc một trường trong mẫu văn bản ──

export type FieldType = 'text' | 'textarea' | 'date' | 'number' | 'select' | 'checkbox';

export interface FieldDefinition {
  key: string;           // key dùng trong fieldValues và {{key}} trong printTemplate
  label: string;         // nhãn hiển thị cho người dùng
  type: FieldType;       // loại input để render form động
  required: boolean;     // validate phía server khi submit
  placeholder?: string;  // gợi ý trong input
  defaultValue?: string; // giá trị mặc định
  options?: string[];    // chỉ dùng khi type === 'select'
}

// ── DocumentTemplate ──

export interface DocumentTemplateSummary {
  id: number;
  name: string;
  category: string; // 'PROPOSAL' | 'PURCHASE' | 'REWARD' | 'OTHER'
}

export interface DocumentTemplateDetail {
  id: number;
  name: string;
  description: string | null;
  category: string;
  fields: FieldDefinition[]; // dùng để render form động
  printTemplate: string;     // HTML với {{key}} placeholders
  templateFileUrl: string | null;
  isActive: boolean;
  version: number;
  createdById: number;
  createdAt: string; // ISO 8601
}

// ── ApproverStep — một bước trong chuỗi duyệt ──

export interface ApproverStep {
  order: number;                // 0-indexed, thứ tự trong chuỗi
  employeeId: number;
  fullName: string;
  status: ApproverStepStatus;
  approvedAt: string | null;   // ISO 8601
  note: string | null;         // ghi chú khi duyệt
}

// ── GeneralRequest ──

export interface RequestEmployee {
  id: number;
  fullName: string;
  employeeCode: string;
}

export interface RequestTemplateSummary {
  id: number;
  name: string;
  category: string;
}

export interface GeneralRequestResponse {
  id: number;
  title: string;
  status: GeneralRequestStatus;
  statusLabel: string;       // "Nháp" | "Chờ duyệt" | "Đã duyệt" | "Bị từ chối" | "Đã thu hồi"
  template: RequestTemplateSummary;
  fieldValues: Record<string, unknown>; // giá trị người dùng đã nhập
  printTemplate: string | null; // chỉ có khi gọi POST /:id/print — null trong mọi endpoint khác
  approvers: ApproverStep[];
  currentApproverIndex: number;
  currentApprover: ApproverStep | null;
  printCount: number;
  printedAt: string | null;    // ISO 8601
  submittedAt: string | null;  // ISO 8601
  completedAt: string | null;  // ISO 8601
  employee: RequestEmployee;
  // Computed flags
  canEdit: boolean;    // true nếu chủ nhân và status === DRAFT
  canSubmit: boolean;  // true nếu chủ nhân và status === DRAFT
  canPrint: boolean;   // true nếu status === APPROVED
  canCancel: boolean;  // true nếu chủ nhân và status === DRAFT hoặc PENDING
  createdAt: string;   // ISO 8601
}

// ── Suggested Approver ──

export interface SuggestedApprover {
  employeeId: number;
  fullName: string;
  role: string;
  level: number;      // 1 = trưởng nhóm/quản lý trực tiếp, 2 = trưởng phòng
  isSuggested: true;
}

// ── Request DTOs ──

export interface CreateTemplateDto {
  name: string;          // min 3 ký tự
  category: string;      // 'PROPOSAL' | 'PURCHASE' | 'REWARD' | 'OTHER'
  description?: string;
  fields: FieldDefinition[];
  printTemplate: string; // HTML string với {{key}} placeholders
}

export type UpdateTemplateDto = Partial<CreateTemplateDto>;

export interface CreateRequestDto {
  templateId: number;
  title: string;                         // min 3 ký tự
  fieldValues: Record<string, unknown>;  // phải chứa tất cả required fields của template
}

export interface SaveDraftDto {
  fieldValues: Record<string, unknown>;
}

export interface SubmitRequestDto {
  approvers: Array<{ employeeId: number }>; // thứ tự trong mảng = thứ tự duyệt, tối thiểu 1
}

export interface ApproveRequestDto {
  note?: string;
}

export interface RejectRequestDto {
  note: string; // bắt buộc
}

export interface QueryRequestParams {
  page?: number;       // default 1
  limit?: number;      // default 20, max 100
  status?: GeneralRequestStatus;
  templateId?: number;
  employeeId?: number; // chỉ dùng cho admin/HR/manager
}

export interface QueryTemplateParams {
  category?: string;
  isActive?: boolean;
}
```

---

## Document Builder Flow

### Luồng hoàn chỉnh từ phía client

```
1. GET /templates [?category=PURCHASE&isActive=true]
   → Hiển thị danh sách mẫu để người dùng chọn

2. GET /templates/:id
   → Lấy fields[] để render form động + printTemplate để preview

3. POST /general-requests { templateId, title, fieldValues }
   → Tạo DRAFT, server validate required fields

4. PATCH /:id/draft { fieldValues }
   → Save draft bao nhiêu lần tuỳ thích

5. GET /suggested-approvers [?employeeId=X]
   → Lấy danh sách gợi ý, user có thể reorder / thêm / bớt

6. PATCH /:id/submit { approvers: [{ employeeId: 3 }, { employeeId: 5 }] }
   → Nộp đơn, server set approvers[0].status = PENDING, còn lại WAITING

7. PATCH /:id/approve { note? } hoặc PATCH /:id/reject { note }
   → Người duyệt hiện tại (currentApprover) duyệt / từ chối
   → Nếu duyệt và còn người tiếp theo → người tiếp chuyển sang PENDING
   → Nếu người cuối cùng duyệt → status = APPROVED

8. POST /:id/print
   → Server tăng printCount, trả về response với printTemplate được điền
   → Client dùng printTemplate + fieldValues để merge và in PDF

-- LUỒNG THU HỒI (tại bất kỳ bước nào sau bước 3, trước khi APPROVED) --

PATCH /:id/cancel
   → Chỉ chủ nhân được gọi
   → Chỉ hợp lệ khi status === DRAFT hoặc PENDING
   → status chuyển sang CANCELLED — toàn bộ approvers và HR nhận notification
```

---

## Print Flow — Quan trọng

### Cách hoạt động

```typescript
// Gọi POST /:id/print
const response = await print(requestId);
const { printTemplate, fieldValues } = response.data;

// printTemplate là HTML string với {{key}} placeholders:
// "<div>Người yêu cầu: {{fullName}}</div><div>Lý do: {{reason}}</div>"

// Merge bằng simple replace:
let html = printTemplate;
for (const [key, value] of Object.entries(fieldValues)) {
  html = html.replaceAll(`{{${key}}}`, String(value ?? ''));
}

// Hoặc dùng Handlebars:
// const template = Handlebars.compile(printTemplate);
// const html = template(fieldValues);

// Render + xuất PDF:
// Option 1 — window.print()
const win = window.open('', '_blank');
win.document.write(html);
win.document.close();
win.print();

// Option 2 — html2pdf.js
// html2pdf().from(html).save('document.pdf');
```

### Lưu ý quan trọng

- `printTemplate` chỉ có trong response của `POST /:id/print` — **null trong mọi endpoint khác** (để giảm payload)
- Chỉ chủ nhân, `HR`, `ADMIN` mới gọi được `/print`
- Mỗi lần gọi `/print` → `printCount` tăng 1, `printedAt` cập nhật
- Chỉ đơn có `status === APPROVED` mới in được (`canPrint === true`)

---

## Sequential Approval — Chuỗi duyệt tuần tự

```
approvers = [
  { order: 0, employeeId: 3, fullName: "Trần Thị B", status: "APPROVED", approvedAt: "..." },
  { order: 1, employeeId: 5, fullName: "Lê Văn C",  status: "PENDING",  approvedAt: null  },
  { order: 2, employeeId: 7, fullName: "Phạm Thị D", status: "WAITING",  approvedAt: null  },
]
currentApproverIndex = 1
currentApprover = { order: 1, employeeId: 5, ... }
```

**Quy tắc:**
- `WAITING` = chờ tới lượt (những người sau người hiện tại)
- `PENDING` = đang cần hành động (đúng 1 người tại một thời điểm)
- Khi `PENDING` approve → người tiếp thành `PENDING`, `currentApproverIndex++`
- Khi người cuối approve → `status = APPROVED`, `completedAt` được set
- Khi bất kỳ ai `REJECT` → toàn bộ đơn thành `REJECTED`, chuỗi dừng lại

**UI gợi ý:** hiển thị `approvers` như một stepper / timeline, dùng `currentApproverIndex` để highlight bước hiện tại.

---

## GET /v1/general-requests/suggested-approvers

**Query:** `?employeeId=4` (nếu không truyền → dùng id của user hiện tại)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "employeeId": 3,
      "fullName": "Trần Thị B",
      "role": "MANAGER",
      "level": 1,
      "isSuggested": true
    },
    {
      "employeeId": 2,
      "fullName": "Nguyễn Quốc C",
      "role": "CHIEF",
      "level": 2,
      "isSuggested": true
    }
  ]
}
```

`level 1` = quản lý trực tiếp / trưởng nhóm, `level 2` = trưởng phòng.

Người dùng có thể reorder, thêm bớt trước khi submit. Thứ tự mảng `approvers` gửi lên = thứ tự duyệt thực tế.

---

## POST /v1/general-requests — Tạo đơn

**Request body:**
```json
{
  "templateId": 1,
  "title": "Đề xuất mua sắm thiết bị văn phòng",
  "fieldValues": {
    "fullName": "Nguyễn Văn A",
    "department": "Kỹ thuật",
    "itemName": "Màn hình 27 inch",
    "quantity": "2",
    "reason": "Thay thế màn hình cũ bị hỏng"
  }
}
```

Server validate `required` fields dựa vào `template.fields`. Nếu thiếu → **400**.

**Response 201:** `ApiSuccess<GeneralRequestResponse>` với `status = "DRAFT"`, `canEdit = true`, `canSubmit = true`

---

## PATCH /v1/general-requests/:id/cancel — Thu hồi đơn

**Ai được gọi:** Chủ nhân đơn, chỉ khi `status === "DRAFT"` hoặc `status === "PENDING"`.

**Body:** Không cần body.

**Kết quả:** `status` chuyển sang `"CANCELLED"`, `canCancel = false`, `statusLabel = "Đã thu hồi"`.

**Lỗi có thể xảy ra:**

| HTTP | Trường hợp |
|------|-----------|
| 403 | Không phải chủ nhân đơn |
| 400 | `status === APPROVED` — đơn đã được duyệt hoàn tất |
| 400 | `status === REJECTED` — đơn đã bị từ chối |
| 400 | `status === CANCELLED` — đơn đã thu hồi rồi |
| 404 | Đơn không tồn tại |

**Notifications khi thu hồi:**

| Người nhận | Kênh | Nội dung |
|-----------|------|---------|
| Chủ nhân | In-app | "🔄 Đơn văn bản đã thu hồi" |
| Từng approver trong chuỗi | In-app + Email | "🔄 Đơn văn bản đã được thu hồi — không cần xử lý thêm" |
| Toàn bộ HR/Admin | In-app + Email | "📌 Thông tin: Đơn văn bản bị thu hồi" |

> **Lưu ý:** Notification gửi đến **toàn bộ approvers** trong chuỗi (kể cả người chưa tới lượt duyệt), không chỉ `currentApprover`.

---

## PATCH /v1/general-requests/:id/submit — Nộp đơn

```json
{
  "approvers": [
    { "employeeId": 3 },
    { "employeeId": 5 }
  ]
}
```

Thứ tự trong mảng = thứ tự duyệt. Người đầu tiên nhận notification ngay.

**400** nếu:
- `approvers` rỗng
- Bất kỳ `employeeId` nào không tồn tại hoặc không active

---

## GET /v1/general-requests/:id — Chi tiết đơn

Người duyệt (`MANAGER`, `CHIEF`, `HR`, `ADMIN`) thấy đơn của mọi người. `EMPLOYEE` chỉ xem đơn của mình.

Response có `printTemplate = null`. Phải gọi `POST /:id/print` để lấy `printTemplate`.

---

> **Lưu ý `GET /me` — phân quyền theo role:**
>
> | Role | Dữ liệu trả về |
> |------|----------------|
> | `HR`, `ADMIN` | Toàn bộ đơn của công ty (tương đương `GET /v1/general-requests`) |
> | `MANAGER`, `CHIEF` | Đơn mình tạo **hoặc** mình xuất hiện trong chuỗi approvers |
> | `EMPLOYEE` | Chỉ đơn do mình tạo |
>
> Frontend dùng chung một endpoint `/me` — server tự phân biệt theo role. MANAGER/CHIEF thấy đơn trên tab "Tất cả" kể cả khi họ chưa từng tạo đơn (vì họ vẫn là approver trên các đơn của nhân viên).

---

## Composable — useGeneralRequests + useDocumentTemplates

```typescript
// composables/useDocumentTemplates.ts
import type {
  DocumentTemplateDetail,
  CreateTemplateDto,
  UpdateTemplateDto,
  QueryTemplateParams,
} from '~/types/general-request.types';

export function useDocumentTemplates() {
  const { get, list, post, patch } = useFetch();

  const fetchTemplates = (params?: QueryTemplateParams) =>
    list<DocumentTemplateDetail>('/v1/general-requests/templates', { params });

  const fetchTemplate = (id: number) =>
    get<DocumentTemplateDetail>(`/v1/general-requests/templates/${id}`);

  const createTemplate = (dto: CreateTemplateDto) =>
    post<DocumentTemplateDetail>('/v1/general-requests/templates', dto);

  const updateTemplate = (id: number, dto: UpdateTemplateDto) =>
    patch<DocumentTemplateDetail>(`/v1/general-requests/templates/${id}`, dto);

  return { fetchTemplates, fetchTemplate, createTemplate, updateTemplate };
}
```

```typescript
// composables/useGeneralRequests.ts
import type {
  GeneralRequestResponse,
  SuggestedApprover,
  CreateRequestDto,
  SaveDraftDto,
  SubmitRequestDto,
  ApproveRequestDto,
  RejectRequestDto,
  QueryRequestParams,
} from '~/types/general-request.types';

export function useGeneralRequests() {
  const { get, list, post, patch } = useFetch();

  const fetchMyRequests = (params?: QueryRequestParams) =>
    list<GeneralRequestResponse>('/v1/general-requests/me', { params });

  const fetchPendingForMe = () =>
    list<GeneralRequestResponse>('/v1/general-requests/pending-for-me');

  const fetchSuggestedApprovers = (employeeId?: number) =>
    list<SuggestedApprover>('/v1/general-requests/suggested-approvers', {
      params: employeeId ? { employeeId } : undefined,
    });

  const fetchAllRequests = (params?: QueryRequestParams) =>
    list<GeneralRequestResponse>('/v1/general-requests', { params });

  const fetchRequest = (id: number) =>
    get<GeneralRequestResponse>(`/v1/general-requests/${id}`);

  const createRequest = (dto: CreateRequestDto) =>
    post<GeneralRequestResponse>('/v1/general-requests', dto);

  const saveDraft = (id: number, dto: SaveDraftDto) =>
    patch<GeneralRequestResponse>(`/v1/general-requests/${id}/draft`, dto);

  const submitRequest = (id: number, dto: SubmitRequestDto) =>
    patch<GeneralRequestResponse>(`/v1/general-requests/${id}/submit`, dto);

  const approveRequest = (id: number, dto?: ApproveRequestDto) =>
    patch<GeneralRequestResponse>(`/v1/general-requests/${id}/approve`, dto ?? {});

  const rejectRequest = (id: number, dto: RejectRequestDto) =>
    patch<GeneralRequestResponse>(`/v1/general-requests/${id}/reject`, dto);

  const printRequest = (id: number) =>
    post<GeneralRequestResponse>(`/v1/general-requests/${id}/print`, {});

  const cancelRequest = (id: number) =>
    patch<GeneralRequestResponse>(`/v1/general-requests/${id}/cancel`, {});

  return {
    fetchMyRequests,
    fetchPendingForMe,
    fetchSuggestedApprovers,
    fetchAllRequests,
    fetchRequest,
    createRequest,
    saveDraft,
    submitRequest,
    approveRequest,
    rejectRequest,
    cancelRequest,
    printRequest,
  };
}
```

---

## Edge Cases

| Tình huống | Kết quả |
|-----------|---------|
| `HR`/`ADMIN` gọi `GET /me` | Trả toàn bộ đơn công ty, không chỉ đơn của mình |
| `MANAGER`/`CHIEF` gọi `GET /me` | Trả đơn mình tạo + đơn mình là approver (kể cả đã duyệt xong); tab "Tất cả" không rỗng dù chưa tạo đơn nào |
| `EMPLOYEE` gọi `GET /general-requests` | 403 Forbidden |
| `EMPLOYEE` gọi `GET /general-requests/pending-for-me` | 403 Forbidden |
| `EMPLOYEE` gọi `GET /general-requests/:id` (đơn người khác) | 403 Forbidden |
| Save draft khi `status !== DRAFT` | 400 Bad Request |
| Submit với `approvers = []` | 400 Bad Request |
| Submit với `employeeId` không tồn tại | 404 Not Found |
| Submit với `employeeId` không active | 400 Bad Request |
| Người không phải `currentApprover` gọi approve/reject | 403 Forbidden |
| Approve khi `status !== PENDING` | 400 Bad Request |
| Gọi `POST /:id/print` khi `status !== APPROVED` | `canPrint = false` — client nên disable button; server vẫn cho phép nếu là HR/ADMIN nhưng thực tế chỉ đơn APPROVED mới có ý nghĩa |
| `printTemplate = null` trong GET /:id | Đúng — không phải lỗi. Gọi POST /:id/print để lấy |
| `fieldValues` có key không có trong template.fields | Server không báo lỗi — chỉ validate required fields |
| Tạo template với `fields = []` | Cho phép — đơn không có trường động |
| `suggested-approvers` trả về mảng rỗng | Nhân viên chưa được gán manager — user tự chọn thủ công |
| Từ chối ở bước giữa chuỗi | Toàn bộ đơn REJECTED, các người duyệt còn lại không nhận notification |
| Thu hồi đơn đã APPROVED | 400 Bad Request — đơn đã duyệt hoàn tất, không thể thu hồi |
| Thu hồi đơn đã REJECTED | 400 Bad Request — đơn đã bị từ chối, không thể thu hồi |
| Thu hồi đơn đã CANCELLED | 400 Bad Request — idempotency check, tránh double cancel |
| Người duyệt gọi cancel đơn người khác | 403 Forbidden — chỉ chủ nhân được thu hồi |
| `canCancel = false` khi render UI | Disable nút Thu hồi — không gọi cancel endpoint |
| Cancel khi status PENDING | Hợp lệ — đơn đang chờ duyệt, chủ nhân vẫn có thể đổi ý |

---

## FCM Push Notifications

Khi trạng thái đơn thay đổi, server gửi FCM data-only message đến các đối tượng liên quan. Client nhận payload và tự fetch lại dữ liệu.

### Đối tượng nhận FCM

| Event | Nhận FCM |
|-------|----------|
| Nộp đơn (`submit`) | Người duyệt hiện tại + người tạo đơn + toàn bộ HR |
| Duyệt xong (`approved`) | Người tạo đơn + toàn bộ approvers + toàn bộ HR |
| Từ chối (`rejected`) | Người tạo đơn + toàn bộ approvers + toàn bộ HR |
| Thu hồi (`cancelled`) | Người tạo đơn + toàn bộ approvers + toàn bộ HR |

### FCM Payload

```typescript
// Payload chung cho tất cả sự kiện general_request
interface GeneralRequestFcmPayload {
  type: 'general_request.pending' | 'general_request.approved' | 'general_request.rejected' | 'general_request.cancelled';
  notificationId: string;   // ID của GeneralRequest (dạng string)
  title: string;
  body: string;
  refId: string;            // ID của GeneralRequest (dạng string)
  refType: 'general_request';
}
```

**Ví dụ payload khi submit:**
```json
{
  "type": "general_request.pending",
  "notificationId": "12",
  "title": "📋 Đơn văn bản cần duyệt",
  "body": "Nguyễn Văn A gửi đơn \"Đề xuất mua sắm thiết bị\"",
  "refId": "12",
  "refType": "general_request"
}
```

### Xử lý phía client

```typescript
// Khi nhận FCM type = general_request.*
onMessage(messaging, (payload) => {
  const { type, refId } = payload.data;
  if (type.startsWith('general_request.')) {
    // Refresh danh sách đơn
    generalRequestStore.refresh();
    // Hoặc fetch chi tiết nếu đang ở trang detail
    if (currentRequestId === refId) {
      generalRequestStore.fetchOne(Number(refId));
    }
  }
});
```
