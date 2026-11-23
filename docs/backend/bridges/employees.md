# Bridge Docs — Quản lý nhân viên (`/v1/employees`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

> **Lô 3a (16/11/2026):** `GET /:id` thu hẹp phạm vi trưởng phòng; thêm `genderCode`, `terminationReason`; `PATCH /:id` nhận
> `effectiveDate`, `historyNote` và ghi lịch sử công tác; `terminate` bắt buộc `terminationReason`. Hồ sơ mở rộng, thân nhân, kinh
> nghiệm, lịch sử công tác, yêu cầu thay đổi thông tin ở [hr-profile.md](./hr-profile.md).

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/employees/directory` | Mọi user đã đăng nhập | Danh bạ công ty, nhóm theo phòng ban |
| GET | `/v1/employees` | Mọi user đã đăng nhập | `MANAGER`/`CHIEF` tự lọc theo phòng ban, trừ khi `pagination=false` |
| POST | `/v1/employees` | `ADMIN`, `HR` | Tạo nhân viên mới |
| GET | `/v1/employees/me` | Mọi user đã đăng nhập | Thông tin bản thân |
| GET | `/v1/employees/me/documents` | Mọi user đã đăng nhập | Tài liệu của bản thân |
| GET | `/v1/employees/:id` | Bản thân; `ADMIN`/`HR`/`DIRECTOR`/`CHIEF` mọi người; `MANAGER` chỉ phòng mình (lô 3a) | Chi tiết một nhân viên. Ngoài phạm vi: 403 `EMPLOYEE_SCOPE_FORBIDDEN` |
| PATCH | `/v1/employees/:id` | `ADMIN`, `HR` | Cập nhật thông tin |
| DELETE | `/v1/employees/:id` | `ADMIN`, `HR` | **Khóa tài khoản** (soft delete) + ghi ngày nghỉ việc |
| POST | `/v1/employees/:id/terminate` | quyền `employee:terminate` (không giới hạn role) | **Xác nhận nghỉ việc** — ngày + lý do bắt buộc |
| POST | `/v1/employees/:id/reset-password` | `ADMIN`, `HR` | Gửi link đặt mật khẩu mới (hạn 3 giờ) tới email đăng nhập; vô hiệu mật khẩu cũ nếu tài khoản chỉ thuộc công ty này. Cũng là cách gửi lại link kích hoạt / lời mời |
| GET | `/v1/employees/:id/documents` | `ADMIN`, `HR`, `DIRECTOR`, `MANAGER`, `CHIEF` kèm quyền `employee:read` (ADMIN không cần quyền) | Tài liệu của nhân viên |
| POST | `/v1/employees/:id/documents` | `ADMIN`, `HR` | Upload tài liệu |
| DELETE | `/v1/employees/:employeeId/documents/:documentId` | `ADMIN`, `HR` | Xóa tài liệu |
| GET | `/v1/employees/:employeeId/documents/:documentId/url` | Bản thân, hoặc người được gọi `GET /v1/employees/:id/documents` | Presigned URL xem/download (hiệu lực 1 giờ). Người khác nhận 403; tài liệu không thuộc `employeeId` nhận 404. Chi tiết ở [employee-documents.md](./employee-documents.md) |

> **Lưu ý thứ tự route:** `/employees/me` được khai báo **trước** `/employees/:id` trong controller.  
> Nếu gọi `/employees/me` mà server trả 404 "employee not found", kiểm tra lại thứ tự route của router phía client.

---

## TypeScript Types

```typescript
// types/employee.types.ts
import type { SystemRole } from './auth.types';

export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
export type Gender = 'Nam' | 'Nữ' | 'Khác';
export type GenderCode = 'MALE' | 'FEMALE' | 'OTHER'; // lô 3a
export type TerminationReason =
  | 'RESIGNATION'         // Người lao động xin nghỉ
  | 'CONTRACT_EXPIRED'    // Hết hạn hợp đồng
  | 'MUTUAL_AGREEMENT'    // Hai bên thoả thuận
  | 'PROBATION_FAILED'    // Không đạt thử việc
  | 'DISMISSAL'           // Sa thải
  | 'EMPLOYER_UNILATERAL' // Công ty đơn phương chấm dứt
  | 'RETIREMENT'          // Nghỉ hưu
  | 'DEATH'               // Qua đời
  | 'OTHER';              // Lý do khác
export type EmploymentType =
  | 'FULL_TIME'     // Nhân viên chính thức
  | 'PROBATION'     // Thử việc
  | 'APPRENTICE'    // Học việc
  | 'INTERN'        // Thực tập sinh
  | 'PART_TIME'     // Bán thời gian
  | 'CONTRACTOR';   // Cộng tác viên / khoán việc

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
  employmentType: EmploymentType; // loại hình lao động, default FULL_TIME
  status: EmployeeStatus;
  joinDate: string;               // "YYYY-MM-DD"
  terminationDate: string | null; // "YYYY-MM-DD" — ngày nghỉ việc, chỉ khác null khi status = INACTIVE
  terminationNote: string | null; // lý do nghỉ việc; chỉ có khi nghỉ qua POST /:id/terminate
  terminationReason: TerminationReason | null; // lô 3a; null với người nghỉ trước lô 3a
  terminationReasonLabel: string | null;       // "Người lao động xin nghỉ"
  dateOfBirth: string | null;     // "YYYY-MM-DD"
  gender: Gender | null;          // nhãn như trước lô 3a, để app cũ không vỡ
  genderCode: GenderCode | null;  // lô 3a: mã, dùng cho ô chọn
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
  terminationDate: string | null; // "YYYY-MM-DD" — để list hiện "Đã nghỉ việc dd/mm/yyyy"
  role: SystemRole;
  employmentType: EmploymentType;
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
  fullName: string;               // min 2, max 100 ký tự
  email: string;                  // tự động lowercase + trim
  // KHÔNG có password: nhân viên tự đặt qua link trong email chào mừng (từ 11/2026).
  // FE cũ còn gửi `password` thì server bỏ qua (whitelist), không báo lỗi.
  joinDate: string;               // "YYYY-MM-DD"
  role: SystemRole;
  employmentType?: EmploymentType; // omit = FULL_TIME (default trên DB)
  departmentId?: number;
  positionId?: number;
  managerId?: number;
  defaultShiftId?: number;        // ca làm việc mặc định
  phone?: string;                 // định dạng số điện thoại Việt Nam
  dateOfBirth?: string;           // "YYYY-MM-DD"
  gender?: Gender | GenderCode;   // lô 3a nhận cả nhãn và mã; chữ khác → 400
  address?: string;
}

// UpdateEmployeeDto — tất cả optional, trừ email (không thể đổi qua endpoint này).
// `employmentType` được inherit → gửi để chuyển ví dụ PROBATION → FULL_TIME khi hết thử việc.
export type UpdateEmployeeDto = Partial<Omit<CreateEmployeeDto, 'email'>> & {
  // Lô 3a: ngày hiệu lực khi đổi phòng ban, chức vụ, quản lý, loại lao động. Bỏ trống là hôm nay.
  // Không sau hôm nay, không trước joinDate, không trước ngày bắt đầu giai đoạn công tác đang mở
  // → 400 EMPLOYMENT_EFFECTIVE_DATE_INVALID. Xem hr-profile.md mục 9.
  effectiveDate?: string;
  historyNote?: string;           // ≤ 500, ghi chú cho mốc lịch sử công tác
};

export interface QueryEmployeeParams {
  departmentId?: number;
  status?: EmployeeStatus;
  role?: SystemRole;
  employmentType?: EmploymentType;
  search?: string;        // tìm theo fullName, email, employeeCode, hoặc mã cũ trước lần đánh lại mã
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

**Query params:** `?departmentId=1&status=ACTIVE&role=EMPLOYEE&employmentType=FULL_TIME&search=nguyen&page=1&limit=20`

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
      "role": "EMPLOYEE",
      "employmentType": "FULL_TIME"
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
    "employmentType": "FULL_TIME",
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
- `ADMIN`, `HR`, `DIRECTOR`, `CHIEF` → xem mọi nhân viên
- `MANAGER` → **chỉ nhân viên phòng mình** (lô 3a, Q-04; trước đây xem mọi phòng). Chưa gán phòng ban thì chỉ chính mình
- `EMPLOYEE` xem người khác → **403**

**Response:** `ApiSuccess<EmployeeDetail>` — shape giống `/me`

**403** ngoài phạm vi:
```json
{ "success": false, "error": { "code": "EMPLOYEE_SCOPE_FORBIDDEN", "message": "Bạn chỉ xem được hồ sơ của nhân viên trong phòng mình. Cần xem người khác thì liên hệ phòng nhân sự." } }
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
  "joinDate": "2026-06-01",
  "role": "EMPLOYEE",
  "employmentType": "PROBATION",
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
- `employeeCode` — **không truyền** — server tự cấp. Công ty đã có mã nhân viên của công ty (đặt ở
  control plane, từ 17/11/2026) thì mã là `{mã công ty}-{4 số}`, ví dụ `STH-0001`, `STH-0002`, theo
  bộ đếm riêng của công ty; công ty chưa đặt thì vẫn `EMP001`, `EMP002`… FE không tự đoán mã kế tiếp,
  đọc `employeeCode` trong response. Người làm ở nhiều công ty có mã riêng ở từng công ty.
- **Không có `password`.** HR không bao giờ biết mật khẩu của nhân viên. Từ G1 (11/2026),
  đăng nhập dùng **tài khoản** chung cho mọi công ty, nên server xử lý theo email:
  - Email **chưa có tài khoản**: tạo tài khoản, gửi email chào mừng có link kích hoạt (tự đặt
    mật khẩu), **hạn 3 giờ**.
  - Email **đã có tài khoản** (người này đang làm ở công ty khác): **không tự nối**, gửi email
    lời mời có link `/accept-invite`, **hạn 7 ngày**. Họ đăng nhập bằng mật khẩu đang dùng.
  - Hai ca trả về **giống hệt nhau**, để HR không biết người đó có thuộc công ty khác hay không.
    UI chỉ nên nói "Đã gửi email cho nhân viên".
  - Link hết hạn thì HR gọi `POST /v1/employees/:id/reset-password` để gửi lại.
- `email` — tự động lowercase + trim trước khi lưu
- `joinDate` — format `"YYYY-MM-DD"` (không phải datetime)
- `defaultShiftId`, `positionId`, `departmentId`, `managerId` — tất cả **optional**
- `defaultShiftId` (từ 18/11/2026): ca phải tồn tại và đang dùng (`isActive`). Server lưu ca mặc định
  **và** gán sẵn ca đó vào lịch ca (`employee_shift_schedules`, ô xanh ở màn Phân ca) trên những ngày
  làm việc của ca (`workDays`), từ `joinDate` tới 31/12 cùng năm, ghi cùng transaction với hồ sơ.
  Người vào làm từ năm trước thì gán từ 01/01 năm nay. Lý do: báo cáo công chỉ tính công định mức theo
  lịch ca, không theo ca mặc định, nên trước bản vá nhân viên mới có công định mức 0. Response không đổi,
  FE không phải gọi thêm `bulk-range`. Sang năm sau HR vẫn gán hàng loạt như với mọi nhân viên.

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
    "employmentType": "PROBATION",
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

**409** nếu tài khoản của email này đã gắn với một hồ sơ **khác trong cùng công ty** (HR đã đổi
email của hồ sơ cũ rồi tạo hồ sơ mới cùng người):
```json
{ "success": false, "error": { "code": "EMPLOYEE_ACCOUNT_IN_COMPANY", "message": "Email này đã gắn với một hồ sơ nhân sự khác trong công ty" } }
```

**404** nếu `defaultShiftId` không tồn tại, **400** nếu ca đã bị vô hiệu hóa. Cả hai đều không tạo hồ sơ:
```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Ca làm việc không tồn tại" } }
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Ca làm việc đã bị vô hiệu hóa" } }
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
  "defaultShiftId": 2,
  "employmentType": "FULL_TIME"
}
```

> **Chú ý về `employmentType`:** HR **manual** chuyển nhân viên từ `PROBATION` sang `FULL_TIME` khi hết thử việc — không auto. Field này cũng dùng để chuyển đổi mọi loại khác (ví dụ `INTERN` chuyển sang `FULL_TIME` khi được nhận). Không suy ra `employmentType` từ `contract.contractType` — 2 khái niệm độc lập.

**Lịch sử công tác (lô 3a, BR-02).** Đổi `departmentId`, `positionId`, `managerId` hoặc `employmentType` thì server ghi một
giai đoạn mới bắt đầu từ `effectiveDate` (mặc định hôm nay) và kết thúc giai đoạn đang mở vào ngày trước đó. Chuyển phòng hiệu
lực 01/12/2026 → giai đoạn cũ kết thúc 30/11/2026. `effectiveDate` trùng ngày bắt đầu giai đoạn đang mở thì sửa ngay giai đoạn đó
(đính chính, không thêm dòng). Đổi `joinDate` thì giai đoạn đầu tiên dời theo. Nhân viên đã nghỉ việc không ghi giai đoạn mới.
Form nên hiện ô **Ngày hiệu lực** và **Ghi chú** khi một trong bốn trường trên thay đổi.

**Response 200:** `ApiSuccess<EmployeeDetail>` (shape đầy đủ)

---

## DELETE /v1/employees/:id — Vô hiệu hóa nhân viên

Soft delete — set `status = 'INACTIVE'` + ghi `terminationDate`, không xóa dữ liệu.

**Body (optional):**
```ts
interface DeactivateEmployeeDto {
  terminationDate?: string;  // "YYYY-MM-DD". Bỏ trống / gửi "" → server lấy ngày hiện tại (giờ VN)
}
```

Ngày này quyết định **tháng cuối cùng nhân sự còn xuất được bảng công / báo cáo phép**:
báo cáo tháng vẫn liệt kê nhân sự nếu `terminationDate >= ngày đầu tháng` đó (nghỉ 18/09 →
tháng 9 và mọi tháng trước vẫn có bảng công, từ tháng 10 thì không). Xem
[reports.md](reports.md) mục "Nhân sự đã nghỉ việc trong báo cáo".

Gọi không body vẫn chạy như trước (tương thích ngược) — nhưng UI nên cho HR **nhập ngày
nghỉ thật**, vì ngày HR bấm nút thường muộn hơn ngày nghỉ thật.

**Response: 204 No Content**

**400** nếu đã inactive:
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Nhân viên đã bị vô hiệu hóa" } }
```

**400** nếu ngày nghỉ trước ngày vào làm:
```json
{ "success": false, "error": { "code": "BAD_REQUEST", "message": "Ngày nghỉ việc (01/02/2026) không được trước ngày vào làm (01/03/2026)" } }
```

**400** nếu sai định dạng (ví dụ gửi `"18/09/2026"`) — chuỗi rỗng `""` thì KHÔNG lỗi.

> **Từ G1:** khoá ở công ty này hủy mọi phiên của nhân viên **ở công ty này** và kết thúc
> quyền vào công ty này. Nếu người đó còn làm ở công ty khác thì tài khoản vẫn đăng nhập vào
> công ty kia bình thường. `POST /:id/terminate` cũng vậy.

> Chưa có endpoint kích hoạt lại nhân sự. `PATCH /v1/employees/:id` **không** nhận
> `status`: body có `status` sẽ bị `ValidationPipe({ whitelist: true })` lược bỏ im lặng,
> request trả 200 nhưng nhân sự vẫn INACTIVE. Đừng dựng nút "kích hoạt lại" dựa vào nó.

---

## POST /v1/employees/:id/terminate — Xác nhận nghỉ việc

Thủ tục nghỉ việc thật, **khác** `DELETE /:id` (khóa tài khoản):

| | `DELETE /:id` | `POST /:id/terminate` |
|---|---|---|
| Ý nghĩa | Khóa tài khoản / tạo nhầm | Nhân sự nghỉ việc |
| Quyền | `employee:delete` (HR, ADMIN) | `employee:terminate` (không tick sẵn cho vai trò nào) |
| Ngày nghỉ | optional, bỏ trống → hôm nay | **bắt buộc** |
| Lý do | không có | **bắt buộc** |
| Gọi lại khi đã INACTIVE | **400** | **200** — sửa lại ngày/lý do |

**Body:**
```ts
interface TerminateEmployeeDto {
  terminationDate: string;  // "YYYY-MM-DD", bắt buộc, phải >= joinDate
  terminationNote: string;  // bắt buộc, server tự trim; chuỗi rỗng / toàn dấu cách → 400; tối đa 1000 ký tự
  terminationReason: TerminationReason; // lô 3a, bắt buộc: ô chọn lý do nghỉ việc
}
```

**Response 200:** `ApiSuccess<EmployeeDetail>` — bản ghi sau khi cập nhật (`status = 'INACTIVE'`,
`terminationDate`, `terminationNote`, `terminationReason`). Lô 3a: giai đoạn công tác cuối kết thúc ở `terminationDate`.

| Tình huống | Kết quả |
|---|---|
| Nhân sự đang làm | 200 — chuyển sang `INACTIVE`, lưu ngày + lý do |
| Nhân sự **đã** nghỉ việc | 200 — **cập nhật** ngày + lý do (đường duy nhất để sửa ngày nghỉ sai) |
| Thiếu `terminationNote`, hoặc toàn dấu cách | 400 |
| Thiếu `terminationReason` (lô 3a) | 400 — "Bạn chọn lý do nghỉ việc" |
| Thiếu `terminationDate`, hoặc sai định dạng (`"18/09/2026"`) | 400 |
| `terminationDate` < `joinDate` | 400 — `"Ngày nghỉ việc (01/02/2026) không được trước ngày vào làm (01/03/2026)"` |
| Chưa được tick quyền `employee:terminate` | 403 |
| ID không tồn tại | 404 |

Ghi log `employee.terminate` (lần đầu) hoặc `employee.terminate_update` (sửa lại), payload
có cả trước và sau.

> Quyền `employee:terminate` **không** được seed cho vai trò nào — kể cả Nhân sự (HR). Sau
> khi deploy, admin phải vào màn phân quyền tick cho vai trò cần dùng, nếu không chỉ tài
> khoản ADMIN (bypass) gọi được. UI nên ẩn nút khi `hasPermission('employee:terminate')` sai.

---

## POST /v1/employees/:id/reset-password — Đặt lại mật khẩu

HR không đặt mật khẩu hộ nhân viên. Từ G1 mật khẩu thuộc **tài khoản** (dùng chung mọi công
ty), nên endpoint này hành xử theo tài khoản đó:

| Tài khoản | Mật khẩu cũ | Phiên đăng nhập | Email |
|---|---|---|---|
| Chỉ thuộc công ty này | **Hết hiệu lực ngay** | Bị thu hồi (refresh token cũ trả `401`) | Link đặt mật khẩu mới, hạn 3 giờ |
| Còn thuộc (hoặc đang được mời vào) công ty khác | **Vẫn dùng được** | Giữ nguyên | Link đặt mật khẩu mới, hạn 3 giờ |
| Hồ sơ đang chờ nhận lời mời | — | — | Gửi lại lời mời, hạn 7 ngày |
| Hồ sơ chưa nối tài khoản | — | — | Gửi lại link kích hoạt hoặc lời mời |

**400 `EMPLOYEE_INACTIVE`** khi hồ sơ đã nghỉ việc hoặc bị khoá: tài khoản đó có thể đang chỉ dùng
ở công ty khác, HR công ty này không được động vào mật khẩu của nó. UI nên ẩn nút với nhân viên
đã nghỉ.

- Link **luôn** gửi tới **email đăng nhập của tài khoản**, không bao giờ tới email công việc
  trong hồ sơ. Lý do: HR sửa được email trong hồ sơ; nếu link đi theo email hồ sơ thì HR chỉ cần
  đổi email thành của mình rồi bấm nút này là chiếm được tài khoản.
- HR công ty B không được làm mất quyền vào công ty A của người đó, nên ca "còn thuộc công ty
  khác" không vô hiệu mật khẩu.
- Ba ca trả **cùng một câu**, để HR không biết người đó có thuộc công ty khác hay không.
- Link phát trước đó cho cùng mục đích (nếu còn) hết hiệu lực.

Cũng dùng endpoint này để **gửi lại link kích hoạt** khi nhân viên mới chưa kịp đặt mật khẩu
mà link 3 giờ đã hết hạn, và để **gửi lời mời** cho hồ sơ chưa nối tài khoản.

> Trước 11/2026 endpoint này đặt mật khẩu thành `ho_ten@ma_nhanvien` và gửi nguyên văn qua
> email. Mẫu đó đoán được nên đã bỏ.

**Response 200:**
```json
{ "success": true, "data": { "message": "Đã gửi link đặt mật khẩu mới tới email của nhân viên. Link có hạn 3 giờ." } }
```

FE hiện nguyên `message` trong toast. Hộp xác nhận nói nhân viên sẽ nhận link qua email đăng
nhập; **không** khẳng định mật khẩu cũ chắc chắn bị vô hiệu (ca tài khoản dùng chung thì không).

---

## POST /v1/employees/import — cột mật khẩu không còn dùng

Template Excel vẫn có cột F "Mật khẩu" để file cũ import được, nhưng **server bỏ qua cột này**:
để trống hay điền gì cũng không bị báo lỗi, và không dùng làm mật khẩu. Mỗi nhân viên được
import nhận email kích hoạt (hạn 3 giờ) hoặc lời mời (hạn 7 ngày) như khi tạo từng người. Lỗi
theo dòng sẽ không còn `field: "password"`; có thể có lỗi `field: "email"` với message "Email
này đã gắn với một hồ sơ nhân sự khác trong công ty".

**Lô 3a:**
- Ba cột tuỳ chọn 25 Ngân hàng, 26 Số tài khoản, 27 Chủ tài khoản (xem [hr-profile.md](./hr-profile.md) mục 9).
- **Cột mã quản lý (K) nhận người đã có trong hệ thống**, trước đây chỉ nhận người nằm trong cùng file (lỗi cũ, đã sửa 16/11).
  Quản lý đã nghỉ việc thì lỗi `field: "managerCode"`, message `Quản lý "<mã>" (<tên>) đã nghỉ việc, bạn chọn người quản lý khác`.

**Mã nhân viên theo công ty (17/11/2026):** khi công ty đã có mã nhân viên của công ty, cột A "Mã nhân
viên" thôi là mã thật:
- Được **để trống**. Server cấp mã `{mã công ty}-0001`… cho từng dòng theo thứ tự dòng trong file.
- Có ghi thì giá trị đó chỉ là **khoá trong file**, để dòng khác trỏ tới ở cột K "Mã quản lý"; người
  được nhập vẫn nhận mã do server cấp. Hai dòng ghi cùng khoá thì vẫn lỗi `Mã nhân viên bị trùng với dòng N`.
- Cột K nhận khoá của dòng khác trong file, mã hiện tại của người đã có, hoặc **mã cũ** của họ (trước
  lần đánh lại mã).
- Response trả mã thật đã cấp trong `employeeCode` của từng người.

Công ty chưa đặt mã thì như cũ: cột A bắt buộc, trùng mã đã có là lỗi `Mã nhân viên đã tồn tại trong hệ thống`.
FE nên đổi nhãn cột A trong hướng dẫn nhập thành "Mã nhân viên (để trống: hệ thống tự cấp)" khi công ty
đã có mã. Hiện API chưa trả mã công ty cho FE, nên hướng dẫn ghi chung cho cả hai trường hợp là đủ.

Nhập **hợp đồng** (`/v1/contracts/import`, cột mã nhân viên) và **tài sản** (`/v1/asset-imports`, cột
người sử dụng) cũng nhận mã cũ, nên file HR soạn trước lần đánh lại mã vẫn nhập được.

**Đọc ô dễ tính hơn (23/11/2026).** Người dùng báo điền file mẫu rồi nhập thì lỗi ở số điện thoại, CCCD
và ngày: ô để kiểu General nên Excel tự đổi `0984111222` thành số `984111222`, còn ngày kiểu Việt
`15/01/2024` có máy giữ là chữ. Server giờ nhận như sau, contract (field, mã lỗi) không đổi:

| Cột | Server nhận thêm | Lưu |
|---|---|---|
| D Số điện thoại | Ô kiểu số, dấu cách, chấm, gạch, ngoặc, đầu `+84`/`84` | `0984111222` (thêm lại số 0 Excel đã bỏ) |
| N Số CCCD | Ô kiểu số 11 chữ số, dấu cách, chấm, gạch | `030096001234` (CCCD luôn bắt đầu bằng 0) |
| Mọi cột ngày | `dd/MM/yyyy`, `d/M/yyyy`, gạch hoặc chấm thay gạch chéo, ô Date, số ngày của Excel | Ngày UTC |

Lỗi mới hoặc đổi câu chữ, FE hiện nguyên `message` trong bảng lỗi:

| Trường hợp | `field` | `message` |
|---|---|---|
| Ngày sai kiểu (`15/01/24`, chữ) | cột ngày | `Ngày sai định dạng, ghi kiểu 15/01/2024 hoặc 2024-01-15` |
| Ngày không có thật (`31/02/2024`) | cột ngày | `Ngày không có thật, kiểm tra lại ngày và tháng` |
| Ô số tài khoản kiểu số | `bankAccountNumber` | `Ô số tài khoản đang là kiểu số nên Excel có thể đã bỏ số 0 ở đầu. Bạn đổi ô sang kiểu Text rồi gõ lại số tài khoản.` |
| Còn dòng ví dụ của file mẫu (email `a.nv@gmail.com`, tên `Nguyễn Văn A`) | `null` | `Đây là dòng ví dụ có sẵn trong file mẫu. Bạn xoá dòng này rồi nhập lại.` (chỉ một lỗi cho dòng đó) |
| Phòng ban chưa có | `departmentName` | `Chưa có phòng ban "<tên>". Bạn tạo phòng ban này trước, hoặc sửa tên cho khớp với phòng ban đã có.` |

Số tài khoản không được tự thêm số 0 như SĐT, CCCD vì không biết số 0 đầu có hay không; lưu sai thì
lương chuyển nhầm, nên server báo lỗi. File mẫu (FE `public/import-templates/employees-import-template.xlsx`)
phải để sẵn các cột chữ, số và ngày ở kiểu Text để Excel không đổi gì.

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
| `genderCode` (lô 3a) | ❌ | `'MALE' \| 'FEMALE' \| 'OTHER' \| null` | ❌ |
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
| `CHIEF` gọi `GET /employees/:id` | 200 OK (xem được mọi nhân viên) |
| `MANAGER` gọi `GET /employees/:id` nhân viên phòng khác (lô 3a) | 403 `EMPLOYEE_SCOPE_FORBIDDEN` |
| `PATCH` đổi phòng ban với `effectiveDate` sau hôm nay (lô 3a) | 400 `EMPLOYMENT_EFFECTIVE_DATE_INVALID` |
| `POST`/`PATCH` với `gender: "trai"` (lô 3a) | 400 "Giới tính phải là Nam, Nữ hoặc Khác" |
| Tạo employee với email đã tồn tại | 409 Conflict |
| Tạo employee có `defaultShiftId` | 201, lịch ca có sẵn từ `joinDate` (hoặc 01/01 năm nay) tới 31/12, chỉ ngày làm của ca |
| Tạo employee mà ca không có ngày làm nào trong khoảng đó | 201, không gán ngày nào |
| Tạo employee với `defaultShiftId` không tồn tại / đã vô hiệu hóa | 404 / 400, không tạo hồ sơ |
| `PATCH` đổi `defaultShiftId` | Chỉ đổi ca mặc định, **không** gán lại lịch ca |
| Deactivate employee đã INACTIVE | 400 Bad Request |
| `search=nguyen` | Tìm trong `fullName`, `email`, `employeeCode` |
| `search=EMP003` sau khi công ty đánh lại mã | Ra người từng mang mã `EMP003`, giờ là `ONGO-0001` (mã cũ giữ ở server, không trả trong response) |
| `status` không truyền | Trả cả ACTIVE lẫn INACTIVE |
| `PATCH` với `defaultShiftId: null` | Xóa liên kết ca làm việc |
| `PATCH` với `managerId: null` | Xóa liên kết quản lý |
