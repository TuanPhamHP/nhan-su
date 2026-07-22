# Bridge Docs — Quản lý nhân viên (`/v1/employees`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/employees/directory` | Mọi user đã đăng nhập | Danh bạ công ty, nhóm theo phòng ban |
| GET | `/v1/employees` | Mọi user đã đăng nhập | `MANAGER`/`CHIEF` tự lọc theo phòng ban, trừ khi `pagination=false` |
| POST | `/v1/employees` | `ADMIN`, `HR` | Tạo nhân viên mới |
| GET | `/v1/employees/me` | Mọi user đã đăng nhập | Thông tin bản thân |
| GET | `/v1/employees/me/documents` | Mọi user đã đăng nhập | Tài liệu của bản thân |
| GET | `/v1/employees/:id` | Bản thân, hoặc `ADMIN`/`HR`/`MANAGER`/`CHIEF` | Chi tiết một nhân viên |
| PATCH | `/v1/employees/:id` | `ADMIN`, `HR` | Cập nhật thông tin |
| DELETE | `/v1/employees/:id` | `ADMIN` | Vô hiệu hóa (soft delete) |
| POST | `/v1/employees/:id/reset-password` | `ADMIN`, `HR` | Reset mật khẩu → gửi email thông báo |
| GET | `/v1/employees/:id/documents` | `ADMIN`, `HR`, `MANAGER`, `CHIEF` | Tài liệu của nhân viên |
| POST | `/v1/employees/:id/documents` | `ADMIN`, `HR` | Upload tài liệu |
| DELETE | `/v1/employees/:employeeId/documents/:documentId` | `ADMIN`, `HR` | Xóa tài liệu |
| GET | `/v1/employees/:employeeId/documents/:documentId/url` | Mọi user đã đăng nhập | Presigned URL xem/download (hiệu lực 1 giờ) |

> **Lưu ý thứ tự route:** `/employees/me` được khai báo **trước** `/employees/:id` trong controller.  
> Nếu gọi `/employees/me` mà server trả 404 "employee not found", kiểm tra lại thứ tự route của router phía client.

---

## TypeScript Types

```typescript
// types/employee.types.ts
import type { SystemRole } from './auth.types';

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
export type Gender = 'Nam' | 'Nữ' | 'Khác';

export interface DepartmentSummaryDto {
  id: number;
  name: string;
}

export interface PositionSummaryDto {
  id: number;
  name: string;
}

export interface ManagerSummaryDto {
  id: number;
  employeeCode: string;
  fullName: string;
}

export interface WorkShiftSummaryDto {
  id: number;
  name: string;
}

// Dùng trong GET /employees/:id, GET /employees/me, POST /, PATCH /:id
export interface EmployeeDetail {
  id: number;
  employeeCode: string;           // "EMP001"
  fullName: string;
  email: string;
  phone: string | null;
  role: SystemRole;
  status: EmployeeStatus;
  joinDate: string;               // "YYYY-MM-DD"
  dateOfBirth: string | null;     // "YYYY-MM-DD"
  gender: Gender | null;
  address: string | null;
  avatarUrl: string | null;       // presigned URL
  department: DepartmentSummaryDto | null;
  position: PositionSummaryDto | null;
  manager: ManagerSummaryDto | null;
  defaultShift: WorkShiftSummaryDto | null;
  createdAt: string;              // ISO 8601 full datetime
}

// Dùng trong GET /employees (list)
export interface EmployeeSummary {
  id: number;
  employeeCode: string;
  fullName: string;
  email: string;
  department: DepartmentSummaryDto | null;
  position: PositionSummaryDto | null;
  status: EmployeeStatus;
  role: SystemRole;
}

// Dùng trong GET /employees/directory
export interface DirectoryMember {
  id: number;
  employeeCode: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;       // raw S3 URL (chưa presign)
  role: SystemRole;
  position: string | null;        // tên chức vụ (chuỗi, không phải object)
  isManager: boolean;             // true nếu là trưởng phòng
}

export interface DirectoryGroup {
  departmentId: number;
  departmentName: string;
  members: DirectoryMember[];
}

// Request DTOs
export interface CreateEmployeeDto {
  fullName: string;           // min 2, max 100 ký tự
  email: string;              // tự động lowercase + trim
  password: string;           // min 6 ký tự, hash server-side — KHÔNG trả ra response
  joinDate: string;           // "YYYY-MM-DD"
  role: SystemRole;
  departmentId?: number;
  positionId?: number;
  managerId?: number;
  defaultShiftId?: number;    // ca làm việc mặc định
  phone?: string;             // định dạng số điện thoại Việt Nam
  dateOfBirth?: string;       // "YYYY-MM-DD"
  gender?: Gender;
  address?: string;
}

// UpdateEmployeeDto — tất cả optional, trừ email và password (không thể đổi qua endpoint này)
export type UpdateEmployeeDto = Partial<Omit<CreateEmployeeDto, 'email' | 'password'>>;

export interface QueryEmployeeParams {
  departmentId?: number;
  status?: EmployeeStatus;
  role?: SystemRole;
  search?: string;        // tìm theo fullName, email, hoặc employeeCode
  page?: number;          // default 1
  limit?: number;         // default 20, max 100
  pagination?: boolean;   // default true — false = trả toàn bộ, bỏ `meta`
}
```

---

## GET /v1/employees/directory — Danh bạ công ty

Trả danh sách nhân viên ACTIVE nhóm theo phòng ban, sắp xếp theo tên phòng ban.

**Query params:**

| Param | Type | Mô tả |
|-------|------|-------|
| `search` | string | Tìm theo tên, mã NV, số điện thoại |
| `departmentId` | number | Lọc chỉ hiển thị một phòng ban |
| `positionId` | number | Lọc theo chức danh |

**Response:** `ApiSuccess<DirectoryGroup[]>`

```json
{
  "success": true,
  "data": [
    {
      "departmentId": 0,
      "departmentName": "Chưa phân phòng ban",
      "members": []
    },
    {
      "departmentId": 1,
      "departmentName": "Phòng Kỹ thuật",
      "members": [
        {
          "id": 4,
          "employeeCode": "EMP004",
          "fullName": "Nguyễn Văn An",
          "phone": "0901234567",
          "avatarUrl": null,
          "role": "EMPLOYEE",
          "position": "Software Engineer",
          "isManager": false
        },
        {
          "id": 2,
          "employeeCode": "EMP002",
          "fullName": "Trần Thị Bình",
          "phone": "0909111222",
          "avatarUrl": "https://bucket.s3.../avatar.jpg",
          "role": "MANAGER",
          "position": "Engineering Manager",
          "isManager": true
        }
      ]
    }
  ]
}
```

> **Lưu ý:** `position` trong directory là **chuỗi tên** (không phải object `{ id, name }`).  
> Nhân viên chưa thuộc phòng ban nào được nhóm vào `departmentId: 0, departmentName: "Chưa phân phòng ban"`.

---

## GET /v1/employees — Danh sách nhân viên

> **Phân quyền tự động (chỉ khi `pagination` không phải `false`):** `MANAGER` và `CHIEF` đã được gán phòng ban → tự động filter theo phòng ban đó. Nếu chưa gán phòng ban, trả toàn bộ.  
> `EMPLOYEE`, `HR`, `ADMIN` → không bị giới hạn phòng ban.

> **`pagination=false` — chế độ full list:** Bỏ qua mọi filter phòng ban, buộc `status=ACTIVE`, trả **toàn bộ nhân viên đang active** không phân trang. Dùng cho dropdown/select chọn nhân viên.

**Query params:** `?departmentId=1&status=ACTIVE&role=EMPLOYEE&search=nguyen&page=1&limit=20`

**Response:** `ApiPaginated<EmployeeSummary>`

```json
{
  "success": true,
  "data": [
    {
      "id": 4,
      "employeeCode": "EMP004",
      "fullName": "Nguyễn Văn An",
      "email": "nguyen.a@company.com",
      "department": { "id": 1, "name": "Kỹ thuật" },
      "position": { "id": 2, "name": "Software Engineer" },
      "status": "ACTIVE",
      "role": "EMPLOYEE"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

## GET /v1/employees/me — Thông tin bản thân

Không cần truyền id — lấy từ JWT. Mọi user đã đăng nhập đều gọi được.

**Response:** `ApiSuccess<EmployeeDetail>`

```json
{
  "success": true,
  "data": {
    "id": 4,
    "employeeCode": "EMP004",
    "fullName": "Nguyễn Văn An",
    "email": "nguyen.a@company.com",
    "phone": "0901234567",
    "role": "EMPLOYEE",
    "status": "ACTIVE",
    "joinDate": "2022-01-10",
    "dateOfBirth": "1990-05-20",
    "gender": "Nam",
    "address": "123 Lê Lợi, Q1",
    "avatarUrl": "https://bucket.s3.../presigned...",
    "department": { "id": 1, "name": "Kỹ thuật" },
    "position": { "id": 2, "name": "Software Engineer" },
    "manager": { "id": 2, "employeeCode": "EMP002", "fullName": "Trần Thị Bình" },
    "defaultShift": { "id": 1, "name": "Ca sáng" },
    "createdAt": "2026-05-18T02:24:40.459Z"
  }
}
```

---

## GET /v1/employees/:id — Chi tiết một nhân viên

- Bản thân (`id == user.id`) → luôn được phép
- `ADMIN`, `HR`, `MANAGER`, `CHIEF` → được phép xem bất kỳ nhân viên nào
- `EMPLOYEE` xem người khác → **403**

**Response:** `ApiSuccess<EmployeeDetail>` — shape giống `/me`

**403:**
```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Không có quyền xem thông tin nhân viên này" } }
```

**404:**
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Nhân viên không tồn tại" } }
```

---

## POST /v1/employees — Tạo nhân viên mới

**Request body:**
```json
{
  "fullName": "Phạm Thị Cẩm",
  "email": "pham.c@company.com",
  "password": "Hr@123456",
  "joinDate": "2026-06-01",
  "role": "EMPLOYEE",
  "departmentId": 1,
  "positionId": 2,
  "managerId": 3,
  "defaultShiftId": 1,
  "phone": "0933123456",
  "dateOfBirth": "1995-04-20",
  "gender": "Nữ",
  "address": "TP. Hồ Chí Minh"
}
```

**Các trường quan trọng:**
- `employeeCode` — **không truyền** — server tự generate theo format `EMP001`, `EMP002`, ...
- `password` — plain text, server hash bcrypt 10 rounds — **không bao giờ trả ra response**
- `email` — tự động lowercase + trim trước khi lưu
- `joinDate` — format `"YYYY-MM-DD"` (không phải datetime)
- `defaultShiftId`, `positionId`, `departmentId`, `managerId` — tất cả **optional**

**Response 201:** `ApiSuccess<EmployeeDetail>`

```json
{
  "success": true,
  "data": {
    "id": 6,
    "employeeCode": "EMP006",
    "fullName": "Phạm Thị Cẩm",
    "email": "pham.c@company.com",
    "phone": "0933123456",
    "role": "EMPLOYEE",
    "status": "ACTIVE",
    "joinDate": "2026-06-01",
    "dateOfBirth": "1995-04-20",
    "gender": "Nữ",
    "address": "TP. Hồ Chí Minh",
    "avatarUrl": null,
    "department": { "id": 1, "name": "Kỹ thuật" },
    "position": { "id": 2, "name": "Software Engineer" },
    "manager": { "id": 3, "employeeCode": "EMP003", "fullName": "Nguyễn Văn Manager" },
    "defaultShift": { "id": 1, "name": "Ca sáng" },
    "createdAt": "2026-06-01T10:00:00.000Z"
  }
}
```

**409** nếu email đã tồn tại:
```json
{ "success": false, "error": { "code": "CONFLICT", "message": "Email đã tồn tại" } }
```

---

## PATCH /v1/employees/:id — Cập nhật nhân viên

Tất cả fields optional. **Không thể đổi `email` hay `password`** qua endpoint này.

- Đổi password → `PATCH /v1/auth/change-password`
- Để xóa liên kết (ví dụ bỏ ca làm việc): truyền `"defaultShiftId": null`

**Request body mẫu:**
```json
{
  "fullName": "Phạm Thị Cẩm Tú",
  "phone": "0933999888",
  "departmentId": 2,
  "positionId": 3,
  "managerId": 2,
  "defaultShiftId": 2
}
```

**Response 200:** `ApiSuccess<EmployeeDetail>` (shape đầy đủ)

---

## DELETE /v1/employees/:id — Vô hiệu hóa nhân viên

Soft delete — set `status = 'INACTIVE'`, không xóa dữ liệu.

**Response: 204 No Content**

**400** nếu đã inactive:
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Nhân viên đã bị vô hiệu hóa" } }
```

---

## POST /v1/employees/:id/reset-password — Reset mật khẩu

Server tạo mật khẩu mới theo format `ho_ten@ma_nhanvien` (bỏ dấu, viết thường), hash lại và gửi email thông báo cho nhân viên.

Ví dụ: `Nguyễn Văn An` + `EMP004` → `nguyenvanan@emp004`

**Response 200:**
```json
{ "success": true, "data": { "message": "Mật khẩu đã được đặt lại và gửi qua email của nhân viên" } }
```

---

## Composable — useEmployees

```typescript
// composables/useEmployees.ts
import type {
  EmployeeDetail,
  EmployeeSummary,
  DirectoryGroup,
  CreateEmployeeDto,
  UpdateEmployeeDto,
  QueryEmployeeParams,
} from '~/types/employee.types';

export function useEmployees() {
  const { get, list, post, patch, del } = useFetch();

  const fetchDirectory = (params?: { search?: string; departmentId?: number; positionId?: number }) =>
    get<DirectoryGroup[]>('/v1/employees/directory', { params });

  const fetchEmployees = (params?: QueryEmployeeParams) =>
    list<EmployeeSummary>('/v1/employees', { params });

  const fetchMe = () =>
    get<EmployeeDetail>('/v1/employees/me');

  const fetchEmployee = (id: number) =>
    get<EmployeeDetail>(`/v1/employees/${id}`);

  const createEmployee = (dto: CreateEmployeeDto) =>
    post<EmployeeDetail>('/v1/employees', dto);

  const updateEmployee = (id: number, dto: UpdateEmployeeDto) =>
    patch<EmployeeDetail>(`/v1/employees/${id}`, dto);

  const deactivateEmployee = (id: number) =>
    del(`/v1/employees/${id}`);

  const resetPassword = (id: number) =>
    post<{ message: string }>(`/v1/employees/${id}/reset-password`);

  return {
    fetchDirectory,
    fetchEmployees,
    fetchMe,
    fetchEmployee,
    createEmployee,
    updateEmployee,
    deactivateEmployee,
    resetPassword,
  };
}
```

---

## Sự khác biệt giữa List, Detail, và Directory

| Field | `EmployeeSummary` (list) | `EmployeeDetail` (detail/me) | `DirectoryMember` (directory) |
|-------|--------------------------|------------------------------|-------------------------------|
| `department` | `{ id, name } \| null` | `{ id, name } \| null` | ❌ (nhóm ở cấp group) |
| `position` | `{ id, name } \| null` | `{ id, name } \| null` | `string \| null` (tên) |
| `manager` | ❌ | `{ id, employeeCode, fullName } \| null` | ❌ |
| `defaultShift` | ❌ | `{ id, name } \| null` | ❌ |
| `role` | ✓ | ✓ | ✓ |
| `phone` | ❌ | `string \| null` | `string \| null` |
| `gender` | ❌ | `'Nam' \| 'Nữ' \| 'Khác' \| null` | ❌ |
| `address` | ❌ | `string \| null` | ❌ |
| `dateOfBirth` | ❌ | `string \| null` | ❌ |
| `joinDate` | ❌ | `string` | ❌ |
| `avatarUrl` | ❌ | `string \| null` (presigned) | `string \| null` (raw URL) |
| `createdAt` | ❌ | `string` | ❌ |
| `isManager` | ❌ | ❌ | `boolean` |

---

## Date format

| Field | Format | Ví dụ |
|-------|--------|-------|
| `joinDate` | `YYYY-MM-DD` | `"2022-01-10"` |
| `dateOfBirth` | `YYYY-MM-DD` | `"1995-04-20"` |
| `createdAt` | ISO 8601 full | `"2026-05-18T02:24:40.459Z"` |

Khi gửi lên (`POST`/`PATCH`), `joinDate` và `dateOfBirth` phải dùng `"YYYY-MM-DD"`.

---

## Edge cases

| Tình huống | Kết quả |
|-----------|---------|
| `MANAGER`/`CHIEF` đã có phòng ban gọi `GET /employees` | 200 — tự động filter theo phòng ban |
| `MANAGER`/`CHIEF` chưa gán phòng ban gọi `GET /employees` | 200 — trả toàn bộ danh sách |
| Bất kỳ role nào gọi `GET /employees?pagination=false` | 200 — bỏ filter phòng ban, buộc `status=ACTIVE`, không có `meta` |
| `GET /employees?pagination=false&status=INACTIVE` | 200 — `status` bị override, vẫn chỉ trả ACTIVE |
| `EMPLOYEE` gọi `GET /employees/:id` với id của chính mình | 200 OK |
| `EMPLOYEE` gọi `GET /employees/:id` với id người khác | 403 Forbidden |
| `MANAGER`/`CHIEF` gọi `GET /employees/:id` | 200 OK (xem được mọi nhân viên) |
| Tạo employee với email đã tồn tại | 409 Conflict |
| Deactivate employee đã INACTIVE | 400 Bad Request |
| `search=nguyen` | Tìm trong `fullName`, `email`, `employeeCode` |
| `status` không truyền | Trả cả ACTIVE lẫn INACTIVE |
| `PATCH` với `defaultShiftId: null` | Xóa liên kết ca làm việc |
| `PATCH` với `managerId: null` | Xóa liên kết quản lý |
