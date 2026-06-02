# Bridge Docs — BHXH & Thuế TNCN (`/v1/social-insurance`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/social-insurance` | `ADMIN`, `HR` | Danh sách toàn công ty (có phân trang) |
| GET | `/v1/social-insurance/:employeeId` | Bản thân hoặc `ADMIN`/`HR`/`MANAGER`/`CHIEF` | Thông tin BHXH & thuế của một nhân viên |
| PUT | `/v1/social-insurance/:employeeId` | `ADMIN`, `HR` | Upsert — tạo mới hoặc cập nhật (multipart/form-data) |

---

## TypeScript Types

```typescript
// types/social-insurance.types.ts

export interface SIEmployeeSummary {
  id: number;
  employeeCode: string;
  fullName: string;
}

export interface InsuranceRates {
  socialInsurance: number;    // % khấu trừ BHXH (mặc định 8.0)
  healthInsurance: number;    // % khấu trừ BHYT (mặc định 1.5)
  unemployment: number;       // % khấu trừ BHTN (mặc định 1.0)
}

export interface DependentDetail {
  name?: string;
  relationship?: string;      // VD: "CON", "VỢ", "CHỒNG", "BỐ", "MẸ"
  idNumber?: string;
  effectiveDate?: string;     // "YYYY-MM-DD"
}

export interface TaxInfo {
  taxCode: string | null;
  dependents: number;                    // số người phụ thuộc
  dependentDetails: DependentDetail[];   // chi tiết từng người phụ thuộc
  taxExemptionDocUrl: string | null;     // presigned URL chứng từ miễn giảm
}

export interface SocialInsuranceResponse {
  id: number;
  employee: SIEmployeeSummary;
  socialInsuranceNumber: string | null;  // số sổ BHXH (10 số)
  healthInsuranceNumber: string | null;  // số thẻ BHYT (dạng "AB1234567890")
  healthInsuranceExpiry: string | null;  // "YYYY-MM-DD"
  registeredHospital: string | null;     // cơ sở KCB ban đầu
  effectiveDate: string | null;          // ngày tham gia BHXH, "YYYY-MM-DD"
  siDocUrl: string | null;               // presigned URL — scan thẻ BHYT hoặc sổ BHXH
  rates: InsuranceRates;
  taxInfo: TaxInfo;
  totalDeductionRate: number;            // = rates.socialInsurance + rates.healthInsurance + rates.unemployment
  note: string | null;
  updatedAt: string;                     // ISO 8601 full datetime
}

// Dùng cho PUT /social-insurance/:employeeId
// Tất cả fields optional — chỉ truyền field cần thay đổi
export interface UpsertSocialInsuranceDto {
  socialInsuranceNumber?: string;
  healthInsuranceNumber?: string;
  healthInsuranceExpiry?: string;        // "YYYY-MM-DD"
  socialInsuranceRate?: number;          // min 0, max 100
  healthInsuranceRate?: number;          // min 0, max 100
  unemploymentInsuranceRate?: number;    // min 0, max 100
  registeredHospital?: string;
  effectiveDate?: string;                // "YYYY-MM-DD"
  taxCode?: string;
  dependents?: number;                   // min 0
  dependentDetails?: DependentDetail[];  // gửi dưới dạng JSON string khi multipart
  note?: string;
}

// Query params cho GET /social-insurance
export interface QuerySocialInsuranceParams {
  page?: number;        // default 1
  limit?: number;       // default 20, max 100
  departmentId?: number;
}
```

---

## PUT là Upsert

`PUT /v1/social-insurance/:employeeId` luôn là **upsert**:

- Nếu nhân viên **chưa có** bản ghi BHXH → tạo mới
- Nếu nhân viên **đã có** bản ghi BHXH → update (merge các field được gửi)

Mỗi nhân viên chỉ có **1 bản ghi duy nhất**. Frontend không cần phân biệt create vs update — luôn gọi `PUT`.

**Request là `multipart/form-data` khi có đính kèm file:**

| Field | Type | Ghi chú |
|-------|------|---------|
| Tất cả fields DTO | string / number | Truyền bình thường qua form fields |
| `dependentDetails` | string (JSON) | Serialize mảng thành JSON string: `JSON.stringify([...])` |
| `siDoc` | binary | PDF / JPG / PNG, tối đa 10 MB — scan thẻ BHYT hoặc sổ BHXH |

```typescript
// Ví dụ gửi multipart với file
const formData = new FormData();
formData.append('socialInsuranceNumber', '1234567890');
formData.append('healthInsuranceNumber', 'AB1234567890');
formData.append('socialInsuranceRate', '8');
formData.append('dependentDetails', JSON.stringify([
  { name: 'Nguyễn Văn Con', relationship: 'CON', idNumber: '123456789', effectiveDate: '2023-01-01' }
]));
if (file) formData.append('siDoc', file);

await $fetch(`/v1/social-insurance/${employeeId}`, { method: 'PUT', body: formData });
```

> `siDocUrl` và `taxExemptionDocUrl` trong response là **presigned URL** — hợp lệ ~1 giờ.

---

## Payroll Integration

Module Payroll đọc rates từ đây để tính khấu trừ tự động:

```
totalDeductionRate = rates.socialInsurance + rates.healthInsurance + rates.unemployment
```

**Mặc định (nếu chưa cấu hình):**

| Loại | Rate mặc định |
|------|--------------|
| BHXH | 8.0% |
| BHYT | 1.5% |
| BHTN | 1.0% |
| **Tổng** | **10.5%** |

```
Khấu trừ BHXH = lương cơ sở × 10.5%
```

> `totalDeductionRate` được backend tính sẵn và trả về trong response — frontend hiển thị trực tiếp, không tự tính lại.

---

## Composable — useSocialInsurance

```typescript
// composables/useSocialInsurance.ts
import type {
  SocialInsuranceResponse,
  UpsertSocialInsuranceDto,
  QuerySocialInsuranceParams,
} from '~/types/social-insurance.types';

export function useSocialInsurance() {
  const { get, list, put } = useFetch();

  const fetchByEmployee = (employeeId: number) =>
    get<SocialInsuranceResponse | null>(`/v1/social-insurance/${employeeId}`);

  const upsert = (employeeId: number, dto: UpsertSocialInsuranceDto, file?: File) => {
    const formData = new FormData();
    Object.entries(dto).forEach(([k, v]) => {
      if (v == null) return;
      formData.append(k, k === 'dependentDetails' ? JSON.stringify(v) : String(v));
    });
    if (file) formData.append('siDoc', file);
    return put<SocialInsuranceResponse>(`/v1/social-insurance/${employeeId}`, formData);
  };

  // HR / Admin only
  const fetchAll = (params?: QuerySocialInsuranceParams) =>
    list<SocialInsuranceResponse>('/v1/social-insurance', { params });

  return {
    fetchByEmployee,
    upsert,
    fetchAll,
  };
}
```

---

## Edge Cases

| Tình huống | Kết quả |
|-----------|---------|
| `GET /:employeeId` khi nhân viên chưa có bản ghi | Response `data: null` (không phải 404) |
| `PUT` lần đầu (chưa có bản ghi) | Tạo mới — 200 OK |
| `PUT` lần tiếp theo | Update bản ghi hiện tại — 200 OK |
| `dependentDetails` gửi dạng JSON string (multipart) | Backend tự parse — frontend serialize bằng `JSON.stringify` |
| `EMPLOYEE` gọi `GET /social-insurance` (list) | 403 Forbidden |
| `EMPLOYEE` gọi `GET /social-insurance/:id` với id của mình | 200 OK |
| `EMPLOYEE` gọi `GET /social-insurance/:id` với id người khác | 403 Forbidden |
| `MANAGER` / `CHIEF` gọi `GET /social-insurance/:employeeId` | 200 OK |
| Rates mặc định khi chưa nhập | `socialInsurance: 8.0`, `healthInsurance: 1.5`, `unemployment: 1.0`, `total: 10.5` |
