# Bridge Docs — Hợp đồng lao động (`/v1/contracts`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Điều kiện gọi | Ghi chú |
| --- | --- | --- | --- |
| GET | `/v1/contracts` | Permission `contract:read` | Danh sách hợp đồng — áp phạm vi, xem mục dưới |
| GET | `/v1/contracts/me` | Mọi user đã đăng nhập | Hợp đồng của bản thân — KHÔNG cần quyền |
| GET | `/v1/contracts/:id` | Bản thân, hoặc `contract:read` **và** nằm trong phạm vi | Chi tiết một hợp đồng |
| POST | `/v1/contracts` | Permission `contract:create` | Tạo hợp đồng mới (multipart/form-data) |
| PATCH | `/v1/contracts/:id` | Permission `contract:update` | Cập nhật hợp đồng (chỉ khi DRAFT, multipart/form-data) |
| PATCH | `/v1/contracts/:id/activate` | Permission `contract:activate` | Kích hoạt DRAFT → ACTIVE |
| PATCH | `/v1/contracts/:id/terminate` | Permission `contract:terminate` | Chấm dứt ACTIVE → TERMINATED |
| GET | `/v1/contracts/import/template` | Permission `contract:import` | Tải file Excel template — xem [`_fe-prompt-contracts-import-excel.md`](./_fe-prompt-contracts-import-excel.md) |
| POST | `/v1/contracts/import` | Permission `contract:import` | Import hàng loạt từ Excel (all-or-nothing) — xem [`_fe-prompt-contracts-import-excel.md`](./_fe-prompt-contracts-import-excel.md) |

> **Lưu ý thứ tự route:** `/contracts/me`, `/contracts/import/template`, `/contracts/import` đều được khai báo **trước** `/contracts/:id`.

---

## Phạm vi xem hợp đồng — áp CHO CẢ danh sách lẫn chi tiết

Hợp đồng chứa lương cơ bản, nên có hai lớp kiểm tách bạch. Phải qua **cả hai**:

1. **Quyền** — `contract:read`. Bỏ tick quyền này trong UI phân quyền là chặn thật.
   (Trước đây module chỉ gác `SystemRole`, bỏ tick không có tác dụng — ai mang
   `SystemRole.MANAGER` vẫn đọc được hợp đồng + lương người khác.)
2. **Phạm vi** — quyết định bởi `resolveContractScope()`:

| Vai trò | Phạm vi |
| --- | --- |
| `ADMIN`, `HR`, `DIRECTOR`, `CHIEF` | Toàn công ty |
| `MANAGER` có phòng ban | Chỉ nhân viên **trong phòng mình** |
| `MANAGER` KHÔNG có phòng ban | Chỉ của chính mình (không mở thành toàn công ty) |
| `EMPLOYEE` | Chỉ của chính mình |

**Hợp đồng của chính mình luôn xem được**, bất kể quyền và phạm vi.

⚠ Hai điều FE cần biết:
- `GET /contracts` và `GET /contracts/:id` dùng **chung một luật**. Trước đây danh sách lọc
  theo phòng ban còn chi tiết thì không — biết `id` là đọc được hợp đồng phòng khác, mà `id`
  là số nguyên tuần tự. Đừng giả định chi tiết lỏng hơn danh sách.
- `MANAGER` gửi `?departmentId=` của phòng khác sẽ bị **bỏ qua**, không phải báo lỗi — server
  ép về phòng của chính họ.

> **Model quyền:** TOÀN BỘ endpoint của module này nay đều **permission-based** (`PermissionsGuard`) — đọc (`contract:read`), tạo (`contract:create`), import (`contract:import`), sửa/kích hoạt/chấm dứt (`contract:update`/`activate`/`terminate`). Cấp hoặc thu quyền ở màn Phân quyền là có hiệu lực thật. `@Roles` chỉ còn là bộ lọc thô chạy trước và phải phủ đủ các role được cấp quyền. `ADMIN` bypass toàn bộ. Ngoại lệ duy nhất: `GET /contracts/me` và ca tự-xem-hợp-đồng-của-mình ở `GET /:id` — self-service, không đòi quyền nào.

---

## TypeScript Types

```typescript
// types/contract.types.ts

export type ContractType = 'PROBATION' | 'FIXED_TERM' | 'INDEFINITE' | 'SEASONAL';
export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';

// Label tiếng Việt (do backend trả về sẵn)
// PROBATION       → 'Thử việc'
// FIXED_TERM      → 'Xác định thời hạn'
// INDEFINITE      → 'Không xác định thời hạn'
// SEASONAL        → 'Thời vụ'
// DRAFT           → 'Nháp'
// ACTIVE          → 'Đang hiệu lực'
// EXPIRED         → 'Đã hết hạn'
// TERMINATED      → 'Đã chấm dứt'

export interface ContractEmployeeSummary {
	id: number;
	employeeCode: string;
	fullName: string;
	department: string | null; // tên phòng ban (đã flatten)
}

export interface ContractCreator {
	id: number;
	fullName: string;
}

export interface ContractResponse {
	id: number;
	contractNumber: string; // VD: "HĐ-2025-001"
	contractType: ContractType;
	contractTypeLabel: string; // nhãn tiếng Việt
	startDate: string; // "YYYY-MM-DD"
	endDate: string | null; // "YYYY-MM-DD" — null nếu INDEFINITE
	baseSalary: number | null;
	position: string | null;
	status: ContractStatus;
	statusLabel: string; // nhãn tiếng Việt
	fileUrl: string | null; // presigned URL, hợp lệ ~1 giờ
	note: string | null;
	employee: ContractEmployeeSummary;
	createdBy: ContractCreator;
	daysUntilExpiry: number | null; // null nếu INDEFINITE hoặc không có endDate
	isExpiringSoon: boolean; // true khi daysUntilExpiry ∈ [0, 30]
	createdAt: string; // ISO 8601 full datetime
}

// Dùng cho POST /contracts (không kèm file — xem mục Upload bên dưới)
export interface CreateContractDto {
	employeeId: number;
	contractNumber: string;
	contractType: ContractType;
	startDate: string; // "YYYY-MM-DD"
	endDate?: string; // bắt buộc với PROBATION, FIXED_TERM, SEASONAL
	baseSalary?: number;
	position?: string;
	note?: string;
}

// Dùng cho PATCH /contracts/:id (chỉ khi DRAFT)
// employeeId không thể thay đổi sau khi tạo
export type UpdateContractDto = Partial<Omit<CreateContractDto, 'employeeId'>>;

// Dùng cho PATCH /contracts/:id/terminate
export interface TerminateContractDto {
	note?: string;
}

// Query params cho GET /contracts và GET /contracts/me
export interface QueryContractParams {
	page?: number; // default 1
	limit?: number; // default 20, max 100
	employeeId?: number;
	status?: ContractStatus;
	contractType?: ContractType;
	departmentId?: number;
}
```

---

## Upload file hợp đồng

`POST /v1/contracts` và `PATCH /v1/contracts/:id` nhận `multipart/form-data`.

| Field | Type | Bắt buộc | Ghi chú |
| --- | --- | --- | --- |
| `employeeId` | integer | ✅ (POST) |  |
| `contractNumber` | string | ✅ | unique toàn hệ thống |
| `contractType` | enum | ✅ | `PROBATION` / `FIXED_TERM` / `INDEFINITE` / `SEASONAL` |
| `startDate` | string (date) | ✅ | `"YYYY-MM-DD"` |
| `endDate` | string (date) | Bắt buộc nếu không phải INDEFINITE | `"YYYY-MM-DD"` |
| `baseSalary` | number | ❌ |  |
| `position` | string | ❌ |  |
| `note` | string | ❌ |  |
| `file` | binary | ❌ | PDF / DOCX / JPG / PNG, tối đa 10 MB |

```typescript
// Ví dụ gửi multipart với file
const formData = new FormData();
formData.append('employeeId', '4');
formData.append('contractNumber', 'HĐ-2025-001');
formData.append('contractType', 'FIXED_TERM');
formData.append('startDate', '2025-01-01');
formData.append('endDate', '2026-01-01');
formData.append('baseSalary', '15000000');
if (file) formData.append('file', file);

await $fetch('/v1/contracts', { method: 'POST', body: formData });
```

> `fileUrl` trong response là **presigned URL** — hợp lệ ~1 giờ. Không lưu URL gốc để dùng lại.

---

## Cron Alert — Cảnh báo hết hạn hợp đồng

- **Lịch chạy:** 08:00 mỗi ngày
- **Ngưỡng alert:** 30 ngày và 7 ngày trước ngày `endDate`
- **Đối tượng nhận:** tất cả HR accounts và manager trực tiếp của nhân viên
- **Kênh:** In-app notification (`CONTRACT_EXPIRY_WARNING`)
- **Tự động expire:** Cron thứ hai chạy lúc 00:05 mỗi ngày — set `status = EXPIRED` cho hợp đồng ACTIVE đã qua `endDate`

**Frontend dùng `isExpiringSoon` để hiển thị badge cảnh báo:**

```typescript
// Ví dụ hiển thị badge trong danh sách hợp đồng
<ContractStatusBadge
  :status="contract.status"
  :is-expiring-soon="contract.isExpiringSoon"
  :days-until-expiry="contract.daysUntilExpiry"
/>
// isExpiringSoon = true  → badge màu cam "Sắp hết hạn (X ngày)"
// daysUntilExpiry = null → hợp đồng INDEFINITE, không hiện badge
```

---

## Composable — useContracts

```typescript
// composables/useContracts.ts
import type {
	ContractResponse,
	CreateContractDto,
	UpdateContractDto,
	TerminateContractDto,
	QueryContractParams,
} from '~/types/contract.types';

export function useContracts() {
	const { get, list, post, patch } = useFetch();

	const fetchAll = (params?: QueryContractParams) => list<ContractResponse>('/v1/contracts', { params });

	const fetchMyContracts = (params?: Pick<QueryContractParams, 'page' | 'limit' | 'status'>) =>
		list<ContractResponse>('/v1/contracts/me', { params });

	const fetchById = (id: number) => get<ContractResponse>(`/v1/contracts/${id}`);

	const createContract = (dto: CreateContractDto, file?: File) => {
		const formData = new FormData();
		Object.entries(dto).forEach(([k, v]) => v != null && formData.append(k, String(v)));
		if (file) formData.append('file', file);
		return post<ContractResponse>('/v1/contracts', formData);
	};

	const updateContract = (id: number, dto: UpdateContractDto, file?: File) => {
		const formData = new FormData();
		Object.entries(dto).forEach(([k, v]) => v != null && formData.append(k, String(v)));
		if (file) formData.append('file', file);
		return patch<ContractResponse>(`/v1/contracts/${id}`, formData);
	};

	const activateContract = (id: number) => patch<ContractResponse>(`/v1/contracts/${id}/activate`);

	const terminateContract = (id: number, note?: string) =>
		patch<ContractResponse>(`/v1/contracts/${id}/terminate`, { note } as TerminateContractDto);

	return {
		fetchAll,
		fetchMyContracts,
		fetchById,
		createContract,
		updateContract,
		activateContract,
		terminateContract,
	};
}
```

---

## Edge Cases

| Tình huống | Kết quả |
| --- | --- |
| `contractType = 'INDEFINITE'` | `endDate` không bắt buộc, `endDate = null`, `daysUntilExpiry = null`, `isExpiringSoon = false` |
| `contractType != 'INDEFINITE'` mà không truyền `endDate` | 400 — `endDate là bắt buộc với hợp đồng có thời hạn` |
| Activate hợp đồng không ở trạng thái `DRAFT` | 400 Bad Request |
| Activate khi nhân viên đã có hợp đồng `ACTIVE` | 409 Conflict |
| Update hợp đồng không ở trạng thái `DRAFT` | 400 Bad Request |
| Terminate hợp đồng không ở trạng thái `ACTIVE` | 400 Bad Request |
| `contractNumber` trùng | 409 Conflict |
| `EMPLOYEE` gọi `GET /contracts` | 403 Forbidden |
| `EMPLOYEE` gọi `GET /contracts/:id` với hợp đồng của mình | 200 OK |
| `EMPLOYEE` gọi `GET /contracts/:id` với hợp đồng người khác | 403 Forbidden |
| `MANAGER` gọi `GET /contracts` | 200 — chỉ trả hợp đồng nhân viên trong phòng mình |
| `MANAGER` gọi `GET /contracts?departmentId=` phòng khác | 200 — param bị bỏ qua, vẫn chỉ phòng mình |
| `MANAGER` gọi `GET /contracts/:id` với hợp đồng phòng khác | 403 Forbidden |
| `MANAGER` không có phòng ban gọi `GET /contracts` | 200 — chỉ hợp đồng của chính họ |
| `CHIEF` gọi `GET /contracts` | 200 — toàn công ty (Tổng giám đốc) |
| Role bị bỏ tick `contract:read` gọi `GET /contracts` | 403 Forbidden |
