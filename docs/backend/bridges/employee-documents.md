# Bridge Docs — Tài liệu nhân viên (`/v1/employees/:id/documents`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.
>
> **Lô 3a (16/11/2026) đổi contract:** loại giấy tờ thành danh mục cấu hình (`documentTypeId` thay `type`), thêm ngày
> cấp, ngày hết hạn, ghi chú, thân nhân liên quan, người tải. Trưởng phòng chỉ xem nhân viên phòng mình. Loại **nhạy cảm**
> (CCCD, giấy khám sức khoẻ, giấy tờ người phụ thuộc) của người khác cần quyền `employee:private:read`, mỗi lần mở có ghi
> nhật ký. Danh mục loại giấy tờ và phần còn lại của hồ sơ mở rộng: [hr-profile.md](./hr-profile.md).

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/employees/me/documents` | Mọi user đã đăng nhập | Tài liệu của chính mình, chỉ loại có `employeeVisible` |
| GET | `/v1/employees/:id/documents` | `HR`, `ADMIN`, `DIRECTOR`, `MANAGER`, `CHIEF` kèm `employee:read`, trong phạm vi | Loại nhạy cảm chỉ có trong danh sách khi người xem có `employee:private:read` |
| POST | `/v1/employees/:id/documents` | `HR`, `ADMIN` kèm `employee:update` | Upload (`multipart/form-data`) |
| DELETE | `/v1/employees/:employeeId/documents/:documentId` | `HR`, `ADMIN` | Xóa tài liệu |
| GET | `/v1/employees/:employeeId/documents/:documentId/url` | Chính chủ, hoặc người gọi được `GET /:id/documents` | Presigned URL. Loại nhạy cảm của người khác cần `employee:private:read` |
| GET | `/v1/employee-document-types` | Mọi user đã đăng nhập | Danh mục loại giấy tờ, xem [hr-profile.md](./hr-profile.md) mục 8 |

**Phạm vi (Q-04):** `ADMIN`, `HR`, `DIRECTOR`, `CHIEF` xem toàn công ty; `MANAGER` chỉ nhân viên có `departmentId` là phòng mình;
người khác chỉ chính mình. Ngoài phạm vi trả 403 `EMPLOYEE_SCOPE_FORBIDDEN`.

> **Lưu ý thứ tự route:** `/employees/me/documents` được khai báo **trước** `/employees/:id/documents` trong controller.

---

## TypeScript Types

```typescript
// types/employee-document.types.ts

export interface EmployeeDocumentResponse {
  id: number;
  documentTypeId: number;
  type: string;              // mã loại: 'CV' | 'RESUME' | 'HEALTH_CERT' | 'ID_CARD' | 'PORTRAIT' | 'DEGREE' | 'CONTRACT' | 'DEPENDENT_PROOF' | 'OTHER' | mã công ty tự thêm
  typeLabel: string;         // tên loại trong danh mục, ví dụ 'Giấy khám sức khoẻ'
  isSensitive: boolean;      // loại nhạy cảm
  fileName: string;
  fileUrl: string;           // S3 URL gốc — KHÔNG render trực tiếp, dùng endpoint /url
  fileType: string;          // 'pdf' | 'docx' | 'jpg' | 'png'
  issuedDate: string | null; // 'YYYY-MM-DD'
  expiryDate: string | null; // 'YYYY-MM-DD'
  note: string | null;
  relativeId: number | null; // thân nhân liên quan (giấy tờ người phụ thuộc)
  relativeName: string | null;
  uploadedBy: { id: number; name: string } | null; // null với giấy tờ tải trước lô 3a
  uploadedAt: string;        // ISO 8601
}

export interface UploadDocumentPayload {
  file: File;                // PDF, DOCX, JPG, PNG — tối đa 10MB
  documentTypeId: number;
  issuedDate?: string;       // 'YYYY-MM-DD'
  expiryDate?: string;       // bỏ trống thì tính theo thời hạn mặc định của loại
  note?: string;             // tối đa 500 ký tự
  relativeId?: number;
}
```

Ba mã cũ `ID_CARD`, `CONTRACT`, `OTHER` giữ nguyên mã, nhưng tên đổi theo danh mục: `ID_CARD` là "CCCD, hộ chiếu",
`CONTRACT` là "Hợp đồng", `OTHER` là "Khác". FE hiện `typeLabel` từ server, không tự map.

---

## GET /v1/employees/me/documents — Tài liệu của tôi

Không cần truyền id, lấy từ JWT. Chỉ trả loại giấy tờ có `employeeVisible = true` (mặc định mọi loại đều bật) và không trả
giấy tờ đang chờ đi kèm một yêu cầu thay đổi chưa duyệt.

**Response:** `ApiSuccess<EmployeeDocumentResponse[]>`, sắp xếp theo `uploadedAt` giảm dần.

```json
{
  "success": true,
  "data": [
    {
      "id": 7,
      "documentTypeId": 3,
      "type": "HEALTH_CERT",
      "typeLabel": "Giấy khám sức khoẻ",
      "isSensitive": true,
      "fileName": "kham-suc-khoe.pdf",
      "fileUrl": "https://.../tenants/cta/employees/4/documents/uuid.pdf",
      "fileType": "pdf",
      "issuedDate": "2026-03-01",
      "expiryDate": "2027-03-01",
      "note": null,
      "relativeId": null,
      "relativeName": null,
      "uploadedBy": { "id": 2, "name": "Nguyễn Thu Hà" },
      "uploadedAt": "2026-11-16T03:00:00.000Z"
    }
  ]
}
```

---

## GET /v1/employees/:id/documents — Tài liệu của một nhân viên

Shape giống `/me/documents`. Người xem không có `employee:private:read` **không thấy** giấy tờ loại nhạy cảm trong danh sách
(server lọc, không trả 403). Gọi cho chính mình qua đường này thì kết quả như `/me/documents`.

| Lỗi | HTTP | `code` |
|---|---|---|
| Nhân viên ngoài phạm vi (trưởng phòng xem phòng khác) | 403 | `EMPLOYEE_SCOPE_FORBIDDEN` |
| `EMPLOYEE` gọi | 403 | `FORBIDDEN` |
| Nhân viên không tồn tại | 404 | `NOT_FOUND` |

---

## POST /v1/employees/:id/documents — Upload tài liệu

**Content-Type:** `multipart/form-data`

| Field | Type | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| `file` | `File` | ✅ | PDF, DOCX, JPG, PNG — tối đa 10MB |
| `documentTypeId` | number | ✅ | ID từ `GET /v1/employee-document-types`, loại phải đang dùng |
| `issuedDate` | `YYYY-MM-DD` | | Ngày cấp. Ô trống gửi `""` cũng được |
| `expiryDate` | `YYYY-MM-DD` | | Bỏ trống thì server tính = ngày cấp + `validityMonths` của loại (BR-05). Giấy khám sức khoẻ ký 01/03/2026 → hết hạn 01/03/2027 |
| `note` | string | | Tối đa 500 ký tự |
| `relativeId` | number | | Thân nhân của chính nhân viên này |

```typescript
const formData = new FormData();
formData.append('file', selectedFile);
formData.append('documentTypeId', String(typeId));
if (issuedDate) formData.append('issuedDate', issuedDate);
await $fetch(`/v1/employees/${employeeId}/documents`, { method: 'POST', body: formData });
```

**Response 201:** `ApiSuccess<EmployeeDocumentResponse>` (`uploadedBy` là người vừa tải).

| Lỗi | HTTP | `code` |
|---|---|---|
| Loại không có hoặc đã tắt | 400 | `EMPLOYEE_DOCUMENT_TYPE_INVALID` |
| `relativeId` không thuộc nhân viên | 400 | `EMPLOYEE_RELATIVE_NOT_FOUND` |
| Ngày hết hạn trước ngày cấp | 400 | `EMPLOYEE_DOCUMENT_DATES_INVALID` |
| Đã có 50 tài liệu (lô 3a nâng từ 20) | 400 | `BAD_REQUEST` |

---

## DELETE /v1/employees/:employeeId/documents/:documentId — Xóa tài liệu

Không đổi. **Response: 204 No Content.** 404 nếu tài liệu không tồn tại.

---

## GET /v1/employees/:employeeId/documents/:documentId/url — Lấy presigned URL

URL có hiệu lực **1 giờ**. Gọi lại để lấy URL mới.

**Ai được gọi.**
- Chính chủ: mọi loại có `employeeVisible`, không cần quyền.
- Người khác: role `HR`, `ADMIN`, `DIRECTOR`, `MANAGER`, `CHIEF` kèm `employee:read`, trong phạm vi.
- Loại nhạy cảm của người khác: thêm `employee:private:read`. Mỗi lần mở ghi nhật ký `employee.private_view` (F-18).

Server kiểm quyền theo `employeeId` **trước** khi tìm tài liệu, nên người không được xem luôn nhận 403. Tài liệu không thuộc
`employeeId` trên đường dẫn, hoặc đang chờ duyệt kèm yêu cầu thay đổi, trả 404.

**Response:** `ApiSuccess<{ presignedUrl: string }>`

| Lỗi | HTTP | `code` |
|---|---|---|
| Không phải chính chủ, thiếu role hoặc `employee:read` | 403 | `FORBIDDEN` |
| Ngoài phạm vi | 403 | `EMPLOYEE_SCOPE_FORBIDDEN` |
| Loại nhạy cảm, thiếu `employee:private:read` | 403 | `EMPLOYEE_PRIVATE_FORBIDDEN` |
| Không tồn tại, không thuộc `employeeId`, đang chờ duyệt | 404 | `NOT_FOUND` |

> PDF mở inline trong browser; DOCX, JPG, PNG tải về.

---

## Edge cases

| Tình huống | HTTP | Ghi chú |
|-----------|------|---------|
| Trưởng phòng KD mở tài liệu nhân viên phòng Kỹ thuật | 403 | `EMPLOYEE_SCOPE_FORBIDDEN` |
| Trưởng phòng cùng phòng mở giấy khám sức khoẻ | 403 | `EMPLOYEE_PRIVATE_FORBIDDEN`; bằng cấp (không nhạy cảm) mở được |
| Trưởng phòng xem danh sách tài liệu nhân viên phòng mình | 200 | Không có dòng loại nhạy cảm |
| Upload gửi `issuedDate: ""` (ô ngày để trống) | 201 | Coi như không gửi |
| Upload loại có thời hạn, bỏ trống `expiryDate` | 201 | `expiryDate` = ngày cấp + thời hạn |
| Giấy tờ nhân viên tải kèm yêu cầu thay đổi chưa duyệt | | Không hiện trong danh sách nào cho tới khi duyệt; xem [hr-profile.md](./hr-profile.md) mục 6 |
| Gọi presigned URL sau 1 giờ | 403 từ S3 | Gọi lại `/url` |
