# FE Agent Prompt — Import nhân sự từ file Excel

## Context

HR cần tạo hàng loạt nhân viên mà không phải nhập từng người qua form `POST /v1/employees`. BE vừa expose 1 endpoint:

- `POST /v1/employees/import` — upload file `.xlsx` để tạo hàng loạt nhân viên. **All-or-nothing:** chỉ tạo khi TẤT CẢ dòng đều valid, nếu có bất kỳ dòng nào lỗi → không tạo gì (transaction rollback), trả về danh sách lỗi chi tiết.

Đặc điểm quan trọng:

- File Excel gốc được lưu lại trên server sau khi import thành công (URL trả về, vĩnh viễn, không TTL).
- **Chức vụ (Position)** trong file: nếu chưa tồn tại trong phòng ban tương ứng → BE **auto-create** trong cùng transaction (không cần HR tạo trước).
- **Phòng ban (Department)** trong file: **KHÔNG** auto-create — nếu không tồn tại → lỗi và rollback toàn bộ.
- Sau import thành công, BE tự động:
  - Hash password (bcrypt) — file Excel chứa password plaintext.
  - Init số dư phép năm cho mỗi nhân viên mới.
  - Gửi **welcome email** kèm email + password plaintext cho từng nhân viên mới.

> Đọc trước [`api-response-envelope.md`](./api-response-envelope.md) và [`employees.md`](./employees.md) nếu cần refresher về Employee model.
> Bridge doc chị em cùng pattern: [`_fe-prompt-contracts-import-excel.md`](./_fe-prompt-contracts-import-excel.md).

---

## Endpoint

```
POST /v1/employees/import
Content-Type: multipart/form-data
```

- **Auth:** Bearer token, role `HR` hoặc `ADMIN`, permission `employee:import`.
- **Body:** field `file` = file `.xlsx` (max 10MB, chỉ `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`).
- **Response OK (201):** JSON envelope với `data: ImportEmployeesResponse`.
- **Response Error (400):** JSON envelope với `error.code = 'EMPLOYEE_IMPORT_VALIDATION'` + `error.errors[]`.

> Chưa có endpoint tải template mẫu — HR dùng file `import-employees-template.xlsx` do team gửi (24 cột, xem bảng bên dưới). FE có thể serve file này như một asset static hoặc host trên hạ tầng chia sẻ nội bộ.

---

## Cấu trúc file Excel (input)

**Data bắt đầu từ dòng 2** (dòng 1 là header). Tổng cộng **24 cột** theo thứ tự cố định:

| Cột | Field                    | Bắt buộc | Định dạng             | Rule                                                                                                                     |
| --- | ------------------------ | -------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| A   | Mã nhân viên             | ✅        | Text (≤20 ký tự)      | Chỉ chữ/số/`_`/`-`. Unique trong file + unique trong DB.                                                                 |
| B   | Họ và tên                | ✅        | Text (2–100 ký tự)    | —                                                                                                                        |
| C   | Email                    | ✅        | Email                 | Lowercase khi lưu. Unique trong file + unique trong DB.                                                                  |
| D   | Số điện thoại            | ❌        | Text                  | `^0\d{9,10}$` — bắt đầu bằng `0`, 10-11 chữ số.                                                                          |
| E   | Ngày vào làm             | ✅        | `yyyy-MM-dd` hoặc Date | Chấp nhận cả Excel Date object hoặc string `yyyy-MM-dd`.                                                                 |
| F   | Mật khẩu đăng nhập       | ✅        | Text                  | ≥ 8 ký tự, có **chữ hoa + số + ký tự đặc biệt**. BE tự hash bcrypt.                                                      |
| G   | Vai trò hệ thống         | ❌        | Enum (VN)             | `Admin / HR / Giám đốc / Quản lý / Trưởng nhóm / Nhân viên`. Bỏ trống → `Nhân viên`. Chấp nhận có/không dấu.              |
| H   | Loại hợp đồng            | ❌        | Enum (VN)             | `Chính thức / Thử việc / Học việc / Thực tập / Bán thời gian / Cộng tác viên`. Bỏ trống → `Chính thức`. Có/không dấu.    |
| I   | Phòng ban                | ❌        | Text                  | Phải khớp `Department.name` (case-insensitive). Không tồn tại → **lỗi + rollback** (không auto-create).                  |
| J   | Chức vụ                  | ❌        | Text                  | Match theo `(name lowercase, departmentId)`. Không có → **auto-create** trong phòng ban đó. **Điền Chức vụ mà không điền Phòng ban → lỗi.** |
| K   | Mã quản lý trực tiếp     | ❌        | Text                  | Trỏ tới `employeeCode` của người khác. Có thể trỏ tới người trong cùng file hoặc đã có trong DB. Không được trỏ chính mình. |
| L   | Ngày sinh                | ❌        | `yyyy-MM-dd` hoặc Date | —                                                                                                                        |
| M   | Giới tính                | ❌        | Enum (VN)             | `Nam` / `Nữ` (có/không dấu). Bỏ trống → null.                                                                            |
| N   | Số CCCD                  | ⚠️        | 12 chữ số             | Nhóm CCCD (N–S) — điền bất kỳ 1 field trong nhóm → Số CCCD, Ngày cấp, Ngày hết hạn đều required. Unique trong file + DB.  |
| O   | Họ và tên trên CCCD      | ❌        | Text (≤100)           | Chỉ điền khi có nhóm CCCD.                                                                                               |
| P   | Ngày cấp CCCD            | ⚠️        | `yyyy-MM-dd`          | Required khi có nhóm CCCD.                                                                                               |
| Q   | Ngày hết hạn CCCD        | ⚠️        | `yyyy-MM-dd`          | Required khi có nhóm CCCD. Phải > Ngày cấp.                                                                              |
| R   | Nơi cấp CCCD             | ❌        | Text (10–255)         | Nếu điền thì ≥ 10 ký tự.                                                                                                 |
| S   | Quê quán                 | ❌        | Text                  | Chỉ điền khi có nhóm CCCD (nếu không sẽ báo lỗi).                                                                        |
| T   | Số Hộ chiếu              | ⚠️        | `^[A-Z0-9]{1,20}$`    | Nhóm Hộ chiếu (T–X) — điền bất kỳ 1 field trong nhóm → 5 field bên dưới đều required. Unique trong file + DB.            |
| U   | Họ và tên trên Hộ chiếu  | ⚠️        | Text (2–100)          | Required khi có nhóm Hộ chiếu.                                                                                           |
| V   | Loại hộ chiếu            | ⚠️        | Enum (VN)             | `Phổ thông / Ngoại giao / Công vụ`. Có/không dấu. Required khi có nhóm HC.                                               |
| W   | Ngày cấp Hộ chiếu        | ⚠️        | `yyyy-MM-dd`          | Required khi có nhóm HC.                                                                                                 |
| X   | Ngày hết hạn Hộ chiếu    | ⚠️        | `yyyy-MM-dd`          | Required khi có nhóm HC. Phải > Ngày cấp.                                                                                |

**Ghi chú:**

- `⚠️` = **conditional required** (bắt buộc khi có bất kỳ field nào trong cùng nhóm CCCD hoặc Hộ chiếu).
- Enum tiếng Việt chấp nhận cả có dấu, không dấu và chuỗi tiếng Anh tương ứng (VD `Manager` / `Quản lý` / `Quan ly` đều map thành `MANAGER`).

### Dòng trống

Dòng có **tất cả cột `Mã nhân viên / Họ tên / Email / Password / Ngày vào làm` đều trống** → BE bỏ qua. Dòng có bất kỳ core field nào không trống mà thiếu required khác → sẽ báo lỗi.

---

## TypeScript Types

```typescript
// types/employee-import.types.ts
import type { EmployeeDetail } from './employee.types';

export interface ImportAutoCreatedPosition {
  id: number;
  name: string;
  departmentId: number;
  departmentName: string;
}

export interface ImportEmployeesResponse {
  importedCount: number;
  fileUrl: string;                                // URL vĩnh viễn (local storage), không cần refresh
  autoCreatedPositions: ImportAutoCreatedPosition[]; // các chức vụ mới được BE tự tạo
  employees: EmployeeDetail[];                    // list nhân viên vừa tạo, cùng shape với GET /employees/:id
}

export type ImportEmployeesRowField =
  | 'employeeCode' | 'fullName' | 'email' | 'phone'
  | 'joinDate' | 'password' | 'role' | 'employmentType'
  | 'departmentName' | 'positionName' | 'managerCode'
  | 'dateOfBirth' | 'gender' | 'address'
  | 'citizenIdNumber' | 'citizenFullName' | 'citizenIssuedDate'
  | 'citizenExpiryDate' | 'citizenIssuedPlace' | 'hometown'
  | 'passportNumber' | 'passportFullName' | 'passportType'
  | 'passportIssuedDate' | 'passportExpiryDate';

export interface ImportEmployeesRowError {
  row: number;                                    // số dòng trong file Excel (bắt đầu từ 2)
  field: ImportEmployeesRowField | null;
  value: string | null;                           // giá trị gây lỗi (password sẽ ẩn thành "***")
  message: string;                                // thông điệp tiếng Việt để hiển thị trực tiếp
}

export interface ImportEmployeesValidationError {
  success: false;
  error: {
    code: 'EMPLOYEE_IMPORT_VALIDATION';
    message: string;                              // VD: "Import thất bại: 3 lỗi"
    errors: ImportEmployeesRowError[];
  };
}
```

---

## Response — Success (201)

```json
{
  "success": true,
  "data": {
    "importedCount": 3,
    "fileUrl": "http://api.example.com/uploads/employees/imports/2026/08/12/6c9c...3f.xlsx",
    "autoCreatedPositions": [
      { "id": 15, "name": "Nhân viên Mobile", "departmentId": 3, "departmentName": "Kỹ thuật" }
    ],
    "employees": [
      {
        "id": 42,
        "employeeCode": "8H0040",
        "fullName": "Nguyễn Văn A",
        "email": "a.nv@gmail.com",
        "phone": "0984684684",
        "role": "EMPLOYEE",
        "employmentType": "FULL_TIME",
        "status": "ACTIVE",
        "joinDate": "2010-10-10",
        "dateOfBirth": null,
        "gender": null,
        "address": null,
        "avatarUrl": null,
        "department": { "id": 3, "name": "Kỹ thuật" },
        "position": { "id": 15, "name": "Nhân viên Mobile" },
        "manager": { "id": 12, "employeeCode": "8H0042", "fullName": "Trần Văn B" },
        "defaultShift": null,
        "createdAt": "2026-08-12T09:12:34.567Z"
      }
    ]
  }
}
```

> `employees[]` cùng shape với `GET /v1/employees/:id` — reuse `EmployeeDetail` type + card components có sẵn.

---

## Response — Validation error (400)

```json
{
  "success": false,
  "error": {
    "code": "EMPLOYEE_IMPORT_VALIDATION",
    "message": "Import thất bại: 4 lỗi",
    "errors": [
      { "row": 3, "field": "email", "value": "invalid-email", "message": "Email sai định dạng" },
      { "row": 3, "field": "password", "value": "***", "message": "Mật khẩu tối thiểu 8 ký tự, có chữ viết hoa, số và ký tự đặc biệt" },
      { "row": 5, "field": "departmentName", "value": "Phòng ma", "message": "Phòng ban \"Phòng ma\" không tồn tại trong hệ thống" },
      { "row": 6, "field": "managerCode", "value": "8H0040", "message": "Mã quản lý không được trùng với mã nhân viên" }
    ]
  }
}
```

Errors đã được **sort theo `row` tăng dần** — FE render trực tiếp không cần sort lại. Cùng 1 dòng có thể có nhiều lỗi (mỗi lỗi là 1 entry riêng).

---

## Errors — Bảng tổng hợp

| HTTP | `error.code`                    | Khi nào                                                                                                          |
| ---- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 400  | `EMPLOYEE_IMPORT_VALIDATION`    | ≥ 1 dòng có lỗi (chi tiết trong `errors[]`)                                                                       |
| 400  | `BAD_REQUEST`                   | File không phải `.xlsx`, file rỗng/không đọc được, thiếu field `file`, file > 10MB, file không có sheet, sheet 1 không có data |
| 401  | `UNAUTHORIZED`                  | Thiếu / sai / expired token                                                                                       |
| 403  | `FORBIDDEN`                     | Không có role `HR`/`ADMIN` hoặc thiếu permission `employee:import`                                                |

### Các message lỗi row-level thường gặp

| Message                                                                                                     | Field                | Nguyên nhân                                     |
| ----------------------------------------------------------------------------------------------------------- | -------------------- | ----------------------------------------------- |
| `Mã nhân viên bắt buộc` / `Mã nhân viên chỉ chứa chữ, số, gạch nối/gạch dưới; tối đa 20 ký tự`               | `employeeCode`       | Trống hoặc sai format                            |
| `Mã nhân viên bị trùng với dòng {n}` / `Mã nhân viên đã tồn tại trong hệ thống`                              | `employeeCode`       | Duplicate                                        |
| `Họ và tên bắt buộc` / `Họ và tên phải từ 2 đến 100 ký tự`                                                    | `fullName`           | Trống hoặc length sai                            |
| `Email bắt buộc` / `Email sai định dạng` / `Email bị trùng với dòng {n}` / `Email đã tồn tại trong hệ thống` | `email`              | Trống / sai format / trùng                       |
| `Số điện thoại phải bắt đầu bằng 0 và có 10-11 chữ số`                                                        | `phone`              | Regex fail                                       |
| `Ngày bắt buộc` / `Ngày sai định dạng (yêu cầu yyyy-MM-dd)` / `Ngày không hợp lệ`                             | `joinDate` / `dateOfBirth` / các ngày CCCD/HC | Trống / sai format / ngày không tồn tại |
| `Mật khẩu bắt buộc` / `Mật khẩu tối thiểu 8 ký tự, có chữ viết hoa, số và ký tự đặc biệt`                     | `password`           | Trống hoặc yếu (value hiển thị `***`)             |
| `Vai trò không hợp lệ. Dùng: Admin/HR/Giám đốc/Quản lý/Trưởng nhóm/Nhân viên`                                | `role`               | Enum map fail                                    |
| `Loại hợp đồng không hợp lệ. Dùng: Chính thức/Thử việc/Học việc/Thực tập/Bán thời gian/Cộng tác viên`         | `employmentType`     | Enum map fail                                    |
| `Giới tính chỉ nhận: Nam / Nữ (hoặc bỏ trống)`                                                                | `gender`             | Enum map fail                                    |
| `Phòng ban "{tên}" không tồn tại trong hệ thống`                                                              | `departmentName`     | Không match Department.name                      |
| `Chức vụ phải thuộc phòng ban — vui lòng điền cột Phòng ban`                                                  | `positionName`       | Có Chức vụ nhưng không có Phòng ban              |
| `Mã quản lý không được trùng với mã nhân viên`                                                                | `managerCode`        | Cross-column conflict                            |
| `Mã quản lý "{code}" không tồn tại trong file import hoặc trong hệ thống`                                     | `managerCode`        | Không match ai                                   |
| `Đã có thông tin CCCD → Số CCCD bắt buộc (12 chữ số)`                                                         | `citizenIdNumber`    | Nhóm CCCD required                               |
| `Số CCCD phải đúng 12 chữ số`                                                                                 | `citizenIdNumber`    | Regex fail                                       |
| `Số CCCD bị trùng với dòng {n}` / `Số CCCD đã tồn tại trong hệ thống`                                         | `citizenIdNumber`    | Duplicate                                        |
| `Ngày cấp CCCD: ...` / `Ngày hết hạn CCCD: ...`                                                               | `citizenIssuedDate` / `citizenExpiryDate` | Nested error message của parse ngày |
| `Ngày hết hạn CCCD phải sau ngày cấp`                                                                         | `citizenExpiryDate`  | expiry ≤ issued                                  |
| `Nơi cấp CCCD phải có tối thiểu 10 ký tự`                                                                     | `citizenIssuedPlace` | Length < 10                                      |
| `Họ tên trên CCCD tối đa 100 ký tự`                                                                           | `citizenFullName`    | Length > 100                                     |
| `Quê quán chỉ được điền khi có thông tin CCCD (Số CCCD + Ngày cấp/hết hạn)`                                    | `hometown`           | Điền Quê quán mà không điền CCCD                 |
| `Đã có thông tin hộ chiếu → Số hộ chiếu bắt buộc`                                                             | `passportNumber`     | Nhóm HC required                                 |
| `Số hộ chiếu chỉ chứa chữ A-Z và số 0-9, tối đa 20 ký tự (không khoảng trắng)`                                 | `passportNumber`     | Regex fail                                       |
| `Số hộ chiếu bị trùng với dòng {n}` / `Số hộ chiếu đã tồn tại trong hệ thống`                                  | `passportNumber`     | Duplicate                                        |
| `Họ tên trên hộ chiếu bắt buộc khi có Số hộ chiếu` / `... phải từ 2 đến 100 ký tự`                             | `passportFullName`   | Trống / length sai                               |
| `Loại hộ chiếu bắt buộc khi có Số hộ chiếu` / `Loại hộ chiếu không hợp lệ. Dùng: Phổ thông / Ngoại giao / Công vụ` | `passportType`  | Enum map fail                                    |
| `Ngày cấp hộ chiếu: ...` / `Ngày hết hạn hộ chiếu: ...`                                                       | `passportIssuedDate` / `passportExpiryDate` | Nested error message của parse ngày |
| `Ngày hết hạn hộ chiếu phải sau ngày cấp`                                                                     | `passportExpiryDate` | expiry ≤ issued                                  |

---

## Checklist FE

### Layer service/composable

- [ ] Function `importEmployees(file: File)`:

  ```typescript
  async function importEmployees(file: File): Promise<ImportEmployeesResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return await $fetch<ImportEmployeesResponse>('/v1/employees/import', {
      method: 'POST',
      body: formData,
    });
    // Lỗi: interceptor sẽ throw. Ở catch, kiểm tra err.data?.error?.code === 'EMPLOYEE_IMPORT_VALIDATION'
    // để lấy err.data.error.errors[] hiển thị chi tiết.
  }
  ```

- [ ] Không có endpoint `GET /template` — nhúng file mẫu vào bundle FE hoặc host trên CDN nội bộ. Đường dẫn tải xuống trỏ tới file tĩnh, không gọi API.

### UI

- [ ] Nút **"Import Excel"** trong màn Danh sách nhân viên (`/employees`), chỉ hiện với user có permission `employee:import` (role `HR` / `ADMIN`).
- [ ] Nhấn nút → mở modal / drawer 2 bước:
  1. Bước 1: **Tải template** — button "Tải file mẫu" trỏ tới file `.xlsx` tĩnh do FE serve. Có thể hiện tooltip nhắc HR:
      - "File chứa 24 cột; các cột thông tin CCCD (N–S) và Hộ chiếu (T–X) là điều kiện — nếu điền 1 field trong nhóm thì phải điền đủ các field bắt buộc trong nhóm đó."
      - "Chức vụ mới sẽ được tự tạo trong phòng ban tương ứng. Phòng ban phải có sẵn trong hệ thống trước khi import."
      - "Mỗi nhân viên sẽ được gửi welcome email kèm password. Chọn password mạnh (≥8 ký tự, có hoa + số + ký tự đặc biệt)."
  2. Bước 2: **Upload file** — `<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">`, chỉ nhận 1 file, hiện tên file đã chọn.
- [ ] Validate client-side (không bắt buộc, giảm round-trip):
  - Extension `.xlsx`.
  - Size ≤ 10MB (BE sẽ reject nếu vượt).
- [ ] Button **"Import"** → gọi `importEmployees(file)`:
  - Disable button + spinner khi đang gửi. **Cảnh báo:** với file 20–50 dòng có thể mất **5–15 giây** (BE validate + `$transaction` gồm insert nhiều bảng + bcrypt hash password cho từng row).
  - Success → toast `"Import thành công {importedCount} nhân viên"`. Nếu `autoCreatedPositions.length > 0` → toast phụ `"Đã tự tạo {n} chức vụ mới"`.
  - Success → đóng modal + refresh list employees. Có thể hiển thị link "Xem file đã import" trỏ tới `data.fileUrl` (mở tab mới).
  - Success → nếu FE có màn "Chức vụ" cache → invalidate cache để refresh danh sách vì có position mới auto-created.
- [ ] Error 400 `EMPLOYEE_IMPORT_VALIDATION` → **KHÔNG đóng modal**, hiển thị bảng lỗi:

  ```
  ┌──────┬────────────────────┬──────────────┬────────────────────────────────────────────────────────────┐
  │ Dòng │ Cột                │ Giá trị      │ Lỗi                                                        │
  ├──────┼────────────────────┼──────────────┼────────────────────────────────────────────────────────────┤
  │ 3    │ Email              │ nguyen@      │ Email sai định dạng                                        │
  │ 3    │ Mật khẩu           │ ***          │ Mật khẩu tối thiểu 8 ký tự, có chữ viết hoa, số và ký tự…  │
  │ 5    │ Phòng ban          │ Phòng ma     │ Phòng ban "Phòng ma" không tồn tại trong hệ thống          │
  │ 6    │ Mã quản lý         │ 8H0040       │ Mã quản lý không được trùng với mã nhân viên                │
  └──────┴────────────────────┴──────────────┴────────────────────────────────────────────────────────────┘
  ```
  - Sticky footer với tổng lỗi: `Import thất bại: 4 lỗi. Sửa file rồi upload lại.`
  - Cho phép HR upload file mới trong cùng modal (reset file input).
  - Nếu cùng 1 dòng có nhiều lỗi (như `row: 3` ở trên) → hiển thị mỗi lỗi 1 hàng, không cần group.
- [ ] Error 400 khác (BAD_REQUEST) → toast `error.message`.
- [ ] Error 403 → toast "Bạn không có quyền import nhân sự".
- [ ] Error network fail → toast "Không upload được file, thử lại".

### Field label mapping (cho bảng lỗi)

Với `field` trong `errors[]`, FE map sang label tiếng Việt:

```typescript
const FIELD_LABEL: Record<ImportEmployeesRowField, string> = {
  employeeCode:        'Mã nhân viên',
  fullName:            'Họ và tên',
  email:               'Email',
  phone:               'Số điện thoại',
  joinDate:            'Ngày vào làm',
  password:            'Mật khẩu',
  role:                'Vai trò hệ thống',
  employmentType:      'Loại hợp đồng',
  departmentName:      'Phòng ban',
  positionName:        'Chức vụ',
  managerCode:         'Mã quản lý',
  dateOfBirth:         'Ngày sinh',
  gender:              'Giới tính',
  address:             'Địa chỉ',
  citizenIdNumber:     'Số CCCD',
  citizenFullName:     'Họ tên trên CCCD',
  citizenIssuedDate:   'Ngày cấp CCCD',
  citizenExpiryDate:   'Ngày hết hạn CCCD',
  citizenIssuedPlace:  'Nơi cấp CCCD',
  hometown:            'Quê quán',
  passportNumber:      'Số hộ chiếu',
  passportFullName:    'Họ tên trên hộ chiếu',
  passportType:        'Loại hộ chiếu',
  passportIssuedDate:  'Ngày cấp hộ chiếu',
  passportExpiryDate:  'Ngày hết hạn hộ chiếu',
};
// field = null → cột "Cột" hiển thị "—"
```

---

## Không cần làm

- [ ] KHÔNG parse Excel client-side để preview trước — validation phải chạy ở BE (đụng DB check duplicate email/employeeCode/CCCD/passport, resolve department/position, verify manager).
- [ ] KHÔNG cần endpoint dry-run — BE hiện chưa expose. Nếu HR muốn "thử trước", sửa file rồi import lại (all-or-nothing đảm bảo không bị half-commit).
- [ ] KHÔNG tự gửi welcome email từ FE — BE đã enqueue email cho từng nhân viên mới (queue Bull, retry 3 lần).
- [ ] KHÔNG tự init số dư phép năm hay tạo notification setup — BE handle sau khi commit transaction.
- [ ] KHÔNG hash password ở FE — BE tự hash bcrypt. FE gửi password plaintext qua HTTPS.
- [ ] KHÔNG bật màn "Chọn phòng ban / chức vụ" trong wizard — mọi resolution làm ở BE dựa trên tên trong file.

---

## Ghi chú thêm

- Response `employees[]` cùng shape với `GET /v1/employees/:id` — có thể reuse `<EmployeeCard>` component nếu muốn hiển thị preview sau import.
- `fileUrl` trong response là **URL vĩnh viễn** (local storage), **KHÔNG cần refresh** như presigned S3.
- File Excel đã import không có endpoint list — nếu cần lịch sử import, tìm trong [system-log](./system_logs.md) với action `employee.import` (payload chứa `importedCount`, `employeeIds`, `autoCreatedPositionIds`).
- Auto-created positions cũng ghi log riêng, action `position.create`, payload có `source: 'employee-import'` + `description: 'Auto-created by employee import'` — HR có thể trace lại position nào do import tạo ra.
- **Password plaintext** đi qua welcome email — đảm bảo hệ thống email production dùng TLS. HR nên yêu cầu nhân viên đổi mật khẩu sau lần đăng nhập đầu (FE có thể cân nhắc thêm màn "Force change password" nếu cần, hiện BE chưa có flag `mustChangePassword`).
- Excel Date vs Text: BE chấp nhận **cả 2** — cell dạng Date object (Excel format) hoặc string `yyyy-MM-dd`. HR không cần format lại nếu Excel auto-detect ngày.
- Enum text tiếng Việt được BE normalize (lowercase, bỏ dấu). VD `"NGOẠI GIAO"`, `"Ngoại Giao"`, `"ngoai giao"`, `"Diplomatic"` đều map thành `DIPLOMATIC`.
- Permission: BE đã seed `employee:import` (group "Nhân viên"). Hiện `HR` + `ADMIN` được gán mặc định. Nếu HR muốn cấp cho role khác → làm ở màn Phân quyền, không cần đổi code FE.
