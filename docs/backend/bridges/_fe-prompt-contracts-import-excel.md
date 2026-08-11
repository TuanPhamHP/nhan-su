# FE Agent Prompt — Import hợp đồng từ file Excel

## Context

HR cần tạo hàng loạt hợp đồng mà không phải nhập từng cái qua form `POST /v1/contracts`. BE vừa expose 2 endpoint:

1. `GET /v1/contracts/import/template` — tải file Excel template (7 cột theo chuẩn hệ thống, 2 sheet: "Danh sách hợp đồng" + "Hướng dẫn").
2. `POST /v1/contracts/import` — upload file `.xlsx` để tạo hàng loạt hợp đồng. **All-or-nothing:** chỉ tạo khi TẤT CẢ dòng đều valid, nếu có bất kỳ dòng lỗi → không tạo gì, trả về danh sách lỗi chi tiết.

File Excel gốc được lưu lại trên server sau khi import thành công (URL trả về trong response, vĩnh viễn, không TTL).

> Đọc trước [`api-response-envelope.md`](./api-response-envelope.md) và [`contracts.md`](./contracts.md) nếu cần refresher về contract model.

---

## Endpoints

### 1. Tải template

```
GET /v1/contracts/import/template
```

- **Auth:** Bearer token, role `HR` hoặc `ADMIN`.
- **Response:** binary `.xlsx`, không phải JSON envelope.
- Header `Content-Disposition: attachment; filename="contract-import-template.xlsx"`.

### 2. Import

```
POST /v1/contracts/import
Content-Type: multipart/form-data
```

- **Auth:** Bearer token, role `HR` hoặc `ADMIN`.
- **Body:** field `file` = file `.xlsx` (max 10MB).
- **Response OK (201):** JSON envelope với `data: ImportContractsResponse`.
- **Response Error (400):** JSON envelope với `error.code = 'CONTRACT_IMPORT_VALIDATION'` + `error.errors[]`.

---

## Cấu trúc file Excel (input & template)

**Data bắt đầu từ dòng 2** (dòng 1 là header, đã có sẵn trong template).

| Cột | Field           | Bắt buộc | Định dạng             | Rule                                                                                                     |
| --- | --------------- | -------- | --------------------- | -------------------------------------------------------------------------------------------------------- |
| A   | Mã nhân viên     | ✅       | Text                  | Phải tồn tại trong hệ thống. NV `INACTIVE` không import được.                                            |
| B   | Số hợp đồng      | ✅       | Text (≤50 ký tự)      | Unique trong file + unique trong DB.                                                                     |
| C   | Ngày bắt đầu     | ✅       | `yyyy-MM-dd` hoặc Date | Ví dụ `2025-01-01`.                                                                                      |
| D   | Ngày kết thúc    | ❌       | `yyyy-MM-dd` hoặc Date | Bỏ trống → `INDEFINITE`. Có giá trị → `FIXED_TERM`. Nếu điền phải > `Ngày bắt đầu`.                      |
| E   | Lương cơ bản    | ❌       | Number                | Chỉ số, không dấu phân cách. VD `15000000`.                                                              |
| F   | Chức vụ         | ❌       | Text (≤100 ký tự)     | VD `Nhân viên Mobile`.                                                                                    |
| G   | Ghi chú          | ❌       | Text                  | Không giới hạn ký tự.                                                                                     |

### Rule BE auto-suy ra

- `contractType`:
  - `endDate` **trống** → `INDEFINITE`.
  - `endDate` **có giá trị** → `FIXED_TERM`.
  - Không hỗ trợ import `PROBATION` / `SEASONAL` qua Excel (dùng form `POST /contracts` cho 2 loại này).
- `status` (so với hôm nay):
  - `startDate > today` → `DRAFT` (hợp đồng tương lai — HR sẽ activate sau).
  - `endDate < today` (nếu có) → `EXPIRED`.
  - Còn lại → `ACTIVE`.

### Dòng trống

Dòng có **cả 3 cột A/B/C đều trống** sẽ bị bỏ qua. Dòng có bất kỳ cột nào không trống mà thiếu required field → sẽ báo lỗi.

---

## TypeScript Types

```typescript
// types/contract-import.types.ts
import type { ContractResponse } from './contract.types';

export interface ImportContractsResponse {
  importedCount: number;
  fileUrl: string;                    // URL vĩnh viễn (local storage), không cần refresh
  contracts: ContractResponse[];      // list contracts vừa tạo — cùng shape với GET /contracts/:id
}

export interface ImportContractsRowError {
  row: number;                        // số dòng trong file Excel (bắt đầu từ 2)
  field: 'employeeCode' | 'contractNumber' | 'startDate' | 'endDate' | 'baseSalary' | 'position' | null;
  value: string | null;               // giá trị gây lỗi (nếu có)
  message: string;                    // thông điệp tiếng Việt để hiển thị trực tiếp
}

// Error envelope khi validation fail
export interface ImportContractsValidationError {
  success: false;
  error: {
    code: 'CONTRACT_IMPORT_VALIDATION';
    message: string;                  // VD: "Import thất bại: 3 lỗi"
    errors: ImportContractsRowError[];
  };
}
```

---

## Response — Success (201)

```json
{
  "success": true,
  "data": {
    "importedCount": 2,
    "fileUrl": "http://api.example.com/uploads/contracts/imports/2026/08/11/6c9c...3f.xlsx",
    "contracts": [
      {
        "id": 42,
        "contractNumber": "HD-2025-CTV",
        "contractType": "FIXED_TERM",
        "contractTypeLabel": "Xác định thời hạn",
        "startDate": "2024-10-21",
        "endDate": "2025-10-21",
        "baseSalary": 30000000,
        "position": "Nhân viên Mobile",
        "status": "ACTIVE",
        "statusLabel": "Đang hiệu lực",
        "fileUrl": null,
        "note": "Ghi chú hợp đồng nếu có",
        "employee": { "id": 5, "employeeCode": "8H0001", "fullName": "Nguyễn Văn A", "department": "Mobile" },
        "createdBy": { "id": 1, "fullName": "HR Admin" },
        "daysUntilExpiry": 71,
        "isExpiringSoon": false,
        "createdAt": "2026-08-11T09:12:34.567Z"
      }
    ]
  }
}
```

> `contracts[].fileUrl = null` vì import qua Excel không đính kèm PDF hợp đồng. HR có thể attach file sau bằng `PATCH /v1/contracts/:id` (chỉ khi `DRAFT`).

---

## Response — Validation error (400)

```json
{
  "success": false,
  "error": {
    "code": "CONTRACT_IMPORT_VALIDATION",
    "message": "Import thất bại: 3 lỗi",
    "errors": [
      { "row": 3, "field": "employeeCode", "value": "8H9999", "message": "Mã nhân viên không tồn tại" },
      { "row": 4, "field": "contractNumber", "value": "HD-2025-CTV", "message": "Số hợp đồng đã tồn tại trong hệ thống" },
      { "row": 5, "field": "startDate", "value": "20-10-2024", "message": "Ngày sai định dạng (yêu cầu yyyy-MM-dd)" }
    ]
  }
}
```

Errors đã được **sort theo `row` tăng dần** — FE render trực tiếp không cần sort lại.

---

## Errors — Bảng tổng hợp

| HTTP | `error.code`                    | Khi nào                                                                                       |
| ---- | ------------------------------- | --------------------------------------------------------------------------------------------- |
| 400  | `CONTRACT_IMPORT_VALIDATION`    | ≥ 1 dòng có lỗi (chi tiết trong `errors[]`)                                                    |
| 400  | `BAD_REQUEST`                   | File không phải `.xlsx`, file rỗng/không đọc được, thiếu field `file`, file > 10MB            |
| 401  | `UNAUTHORIZED`                  | Thiếu / sai / expired token                                                                    |
| 403  | `FORBIDDEN`                     | Role không phải `HR` hoặc `ADMIN`                                                              |

### Các message lỗi row-level thường gặp

| Message                                                                                                    | Field           | Nguyên nhân                                        |
| ---------------------------------------------------------------------------------------------------------- | --------------- | -------------------------------------------------- |
| `Mã nhân viên bắt buộc`                                                                                     | `employeeCode`  | Cột A trống                                        |
| `Mã nhân viên không tồn tại`                                                                                | `employeeCode`  | Không match Employee.employeeCode                  |
| `Nhân viên {tên} đã nghỉ (INACTIVE), không thể tạo hợp đồng`                                                | `employeeCode`  | NV có status INACTIVE                              |
| `Số hợp đồng bắt buộc`                                                                                       | `contractNumber` | Cột B trống                                        |
| `Số hợp đồng vượt quá 50 ký tự`                                                                              | `contractNumber` | Length > 50                                        |
| `Số hợp đồng bị trùng với dòng {n} trong file`                                                               | `contractNumber` | Duplicate giữa các dòng                            |
| `Số hợp đồng đã tồn tại trong hệ thống`                                                                       | `contractNumber` | Đã có trong DB                                     |
| `Ngày bắt buộc` / `Ngày sai định dạng (yêu cầu yyyy-MM-dd)` / `Ngày không hợp lệ`                            | `startDate` / `endDate` | Trống, sai format, hoặc ngày không tồn tại |
| `Ngày kết thúc phải sau ngày bắt đầu`                                                                        | `endDate`       | `endDate <= startDate`                             |
| `Không phải số hợp lệ` / `Lương cơ bản không được âm`                                                          | `baseSalary`    | Parse fail hoặc âm                                 |
| `Chức vụ vượt quá 100 ký tự`                                                                                 | `position`      | Length > 100                                       |
| `Nhân viên có {n} hợp đồng ACTIVE trong file (dòng x, y) — chỉ được 1`                                       | `employeeCode`  | Cross-row conflict (nhiều dòng cùng NV cùng ACTIVE) |
| `Nhân viên đang có hợp đồng ACTIVE (#{số HĐ cũ}) — chấm dứt trước khi import hợp đồng ACTIVE mới`             | `employeeCode`  | Employee đã có contract ACTIVE trong DB            |

---

## Checklist FE

### Layer service/composable

- [ ] Function `downloadImportTemplate()`:
  - `GET /v1/contracts/import/template` với `responseType: 'blob'`.
  - Trigger download bằng `URL.createObjectURL(blob)` + `<a download>`.
  - Extract filename từ `Content-Disposition` header, fallback `contract-import-template.xlsx`.

- [ ] Function `importContracts(file: File)`:
  ```typescript
  async function importContracts(file: File): Promise<ImportContractsResponse> {
    const formData = new FormData();
    formData.append('file', file);
    return await $fetch<ImportContractsResponse>('/v1/contracts/import', {
      method: 'POST',
      body: formData,
    });
    // Lỗi: interceptor sẽ throw. Ở catch, kiểm tra err.data?.error?.code === 'CONTRACT_IMPORT_VALIDATION'
    // để lấy err.data.error.errors[] hiển thị chi tiết.
  }
  ```

### UI

- [ ] Nút **"Import Excel"** trong màn Danh sách hợp đồng (`/contracts`), chỉ hiện với role `HR`/`ADMIN`.
- [ ] Nhấn nút → mở modal / drawer 2 bước:
  1. Bước 1: **Tải template** — button "Tải file mẫu" gọi `downloadImportTemplate()`. Có thể hiện tooltip nhắc HR về format cột.
  2. Bước 2: **Upload file** — `<input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">`, chỉ nhận 1 file, hiện tên file đã chọn.
- [ ] Validate client-side (không bắt buộc, giảm round-trip):
  - Extension `.xlsx`.
  - Size ≤ 10MB (BE sẽ reject nếu vượt).
- [ ] Button **"Import"** → gọi `importContracts(file)`:
  - Disable button + spinner khi đang gửi (có thể mất **2-5s** với file ~50 dòng do BE validate + `$transaction`).
  - Success → toast "Import thành công X hợp đồng" + đóng modal + refresh list contracts.
  - Success → có thể hiển thị link "Xem file đã import" trỏ tới `data.fileUrl` (mở tab mới) để HR verify.
- [ ] Error 400 `CONTRACT_IMPORT_VALIDATION` → **KHÔNG đóng modal**, hiển thị bảng lỗi:

  ```
  ┌──────┬──────────────────┬──────────────┬──────────────────────────────────────────────────┐
  │ Dòng │ Cột              │ Giá trị      │ Lỗi                                              │
  ├──────┼──────────────────┼──────────────┼──────────────────────────────────────────────────┤
  │ 3    │ Mã nhân viên     │ 8H9999       │ Mã nhân viên không tồn tại                       │
  │ 4    │ Số hợp đồng      │ HD-2025-CTV  │ Số hợp đồng đã tồn tại trong hệ thống            │
  │ 5    │ Ngày bắt đầu     │ 20-10-2024   │ Ngày sai định dạng (yêu cầu yyyy-MM-dd)          │
  └──────┴──────────────────┴──────────────┴──────────────────────────────────────────────────┘
  ```
  - Sticky footer với message tổng `Import thất bại: 3 lỗi. Sửa file rồi upload lại.`
  - Cho phép HR upload lại file mới trong cùng modal (reset file input).
- [ ] Error 400 khác (BAD_REQUEST) → toast `error.message`.
- [ ] Error 403 → toast "Bạn không có quyền import hợp đồng".
- [ ] Error network fail → toast "Không upload được file, thử lại".

### Field label mapping (cho bảng lỗi)

Đối với `field` trong `errors[]`, FE map sang label tiếng Việt:

```typescript
const FIELD_LABEL: Record<string, string> = {
  employeeCode:   'Mã nhân viên',
  contractNumber: 'Số hợp đồng',
  startDate:      'Ngày bắt đầu',
  endDate:        'Ngày kết thúc',
  baseSalary:     'Lương cơ bản',
  position:       'Chức vụ',
};
// field = null → cột "Cột" hiển thị "—"
```

---

## Không cần làm

- [ ] KHÔNG parse Excel client-side để preview trước — validation phải chạy ở BE (đụng DB check duplicate/existing ACTIVE contract).
- [ ] KHÔNG cần endpoint dry-run — BE hiện chưa expose. Nếu HR muốn "thử trước", sửa file rồi import lại.
- [ ] KHÔNG lưu `data.fileUrl` vào state riêng — có thể quên. Nếu HR muốn xem lại file cũ đã import, tìm ở [system-log](./system_logs.md) với action `contract.import`.
- [ ] KHÔNG tự activate contracts sau khi import — BE đã set status đúng theo rule ngày (DRAFT/ACTIVE/EXPIRED).

---

## Ghi chú thêm

- Response `contracts[]` cùng shape với `GET /v1/contracts/:id` — có thể reuse `<ContractCard>` component nếu muốn hiển thị preview sau import.
- `fileUrl` trong response là **URL vĩnh viễn** (local storage), **KHÔNG cần refresh** như presigned S3. Có thể lưu và mở lại bất cứ lúc nào.
- File Excel đã import không có endpoint list — nếu cần lịch sử import, tìm trong `system_logs` (action `contract.import`, payload chứa `contractIds` + `importedCount`).
- Excel Date vs Text: BE chấp nhận **cả 2** — cell dạng Date object (Excel format) hoặc string `yyyy-MM-dd`. HR không cần format lại nếu Excel auto-detect ngày.
- Sau import, cột `fileUrl` của mỗi contract mới = `null`. Muốn attach PDF hợp đồng thật, HR mở từng contract (chỉ khi `DRAFT`) → `PATCH /v1/contracts/:id` với multipart + field `file`.
- Permission: BE đã seed `contract:import` (group "Hợp đồng"). Hiện `HR` + `ADMIN` được gán mặc định. Nếu HR muốn cấp quyền import cho role khác (VD `MANAGER`), làm ở màn Phân quyền — không cần đổi code FE.
