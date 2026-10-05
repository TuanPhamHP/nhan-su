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
  socialInsuranceNumber: string;         // mã số BHXH — LUÔN có giá trị, không bao giờ null
  insuranceSalary: number;               // mức lương tham gia BHXH (VND), LUÔN có giá trị
  hasSocialInsuranceBook: boolean;       // người lao động có sổ BHXH hay không
  healthInsuranceNumber: string | null;  // số thẻ BHYT (dạng "AB1234567890")
  healthInsuranceExpiry: string | null;  // "YYYY-MM-DD"
  registeredHospital: string | null;     // cơ sở KCB ban đầu
  effectiveDate: string | null;          // ngày tham gia BHXH, "YYYY-MM-DD"
  siDocUrl: string | null;               // presigned URL — scan thẻ BHYT hoặc sổ BHXH
  taxInfo: TaxInfo;
  note: string | null;
  updatedAt: string;                     // ISO 8601 full datetime
}

// Dùng cho PUT /social-insurance/:employeeId
// ⚠️ socialInsuranceNumber và insuranceSalary là BẮT BUỘC ở MỌI lần gọi, kể cả khi chỉ
// muốn sửa một field khác — endpoint là upsert, không phải PATCH từng phần.
export interface UpsertSocialInsuranceDto {
  socialInsuranceNumber: string;         // BẮT BUỘC, không được rỗng
  insuranceSalary: number;               // BẮT BUỘC, min 0
  hasSocialInsuranceBook?: boolean;      // chỉ true/false; bỏ trống → false
  healthInsuranceNumber?: string;
  healthInsuranceExpiry?: string;        // "YYYY-MM-DD"
  registeredHospital?: string;
  effectiveDate?: string;                // "YYYY-MM-DD" — ngày tham gia BHXH
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

> ⚠️ **Upsert không phải PATCH từng phần.** `socialInsuranceNumber` và `insuranceSalary`
> phải có trong **mọi** request, kể cả khi người dùng chỉ đổi ghi chú. Thiếu một trong hai
> → `400`. FE nên luôn submit toàn bộ form thay vì chỉ field vừa đổi.

**Request là `multipart/form-data` khi có đính kèm file:**

| Field | Type | Ghi chú |
|-------|------|---------|
| Tất cả fields DTO | string / number | Truyền bình thường qua form fields |
| `hasSocialInsuranceBook` | string `"true"` / `"false"` | Multipart gửi boolean dạng chuỗi — BE tự chuyển. Giá trị khác hai chuỗi này → `400` |
| `dependentDetails` | string (JSON) | Serialize mảng thành JSON string: `JSON.stringify([...])`. Mảng rỗng `"[]"` hợp lệ. Chuỗi không phải JSON → `400` |
| `siDoc` | binary | PDF / JPG / PNG, tối đa 10 MB — scan thẻ BHYT hoặc sổ BHXH |

```typescript
// Ví dụ gửi multipart với file
const formData = new FormData();
formData.append('socialInsuranceNumber', '0123456789');   // BẮT BUỘC
formData.append('insuranceSalary', '12500000');           // BẮT BUỘC
formData.append('hasSocialInsuranceBook', 'true');
formData.append('effectiveDate', '2022-03-01');
formData.append('registeredHospital', 'Bệnh viện Đại học Y Dược');
formData.append('healthInsuranceNumber', 'AB1234567890');
formData.append('dependentDetails', JSON.stringify([
  { name: 'Nguyễn Văn Con', relationship: 'CON', idNumber: '123456789', effectiveDate: '2023-01-01' }
]));
if (file) formData.append('siDoc', file);

await $fetch(`/v1/social-insurance/${employeeId}`, { method: 'PUT', body: formData });
```

> `siDocUrl` và `taxExemptionDocUrl` trong response là **presigned URL** — hợp lệ ~1 giờ.

---

## Tỉ lệ đóng bảo hiểm — ĐÃ BỎ khỏi API (thay đổi breaking)

Trước đây response có `rates: { socialInsurance, healthInsurance, unemployment }` và
`totalDeductionRate`, DTO có 3 field `*Rate`. **Tất cả đã bị bỏ.**

Lý do: tỉ lệ đóng áp dụng **chung theo luật lao động**, không khác nhau giữa các nhân
viên. Lưu riêng từng người chỉ tạo cơ hội lệch dữ liệu. Phần khác nhau thật sự giữa các
nhân viên là **mức lương tham gia BHXH** (`insuranceSalary`) — chính là field mới.

**FE phải làm gì:**

| Trước | Sau |
|---|---|
| Đọc `response.rates.socialInsurance` | Không còn — nếu cần hiển thị % thì hardcode theo luật ở FE hoặc hỏi BE thêm endpoint cấu hình |
| Đọc `response.totalDeductionRate` | Không còn |
| Gửi `socialInsuranceRate` / `healthInsuranceRate` / `unemploymentInsuranceRate` | Không gửi nữa — gửi vẫn không lỗi (bị `whitelist` loại), nhưng vô nghĩa |
| — | Đọc / gửi `insuranceSalary` (bắt buộc) |
| — | Đọc / gửi `hasSocialInsuranceBook` |

> `hasSocialInsuranceBook` chỉ phục vụ việc **chốt sổ BHXH khi nhân viên nghỉ việc**. Hệ
> thống cố ý không quản lý chi tiết sổ (số sổ, nơi cấp…) — chỉ cần biết có hay không.

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
| `dependentDetails` là chuỗi không phải JSON | 400 — cố ý báo lỗi thay vì âm thầm bỏ qua |
| Field ngày optional gửi chuỗi rỗng (`effectiveDate`, `healthInsuranceExpiry`, và `effectiveDate` trong `dependentDetails`) | 200 — rỗng nghĩa là **xoá ngày**, lưu `null`. Form để trống ô không bắt buộc là hợp lệ |
| Field ngày gửi sai định dạng mà **không** rỗng (vd `01/03/2022`) | 400 — chỉ nới cho chuỗi rỗng, không nới cho định dạng sai |
| Thiếu `socialInsuranceNumber` | 400 — `"Mã số BHXH không được để trống"` |
| `socialInsuranceNumber` là chuỗi rỗng | 400 |
| Thiếu `insuranceSalary` | 400 |
| `insuranceSalary` âm | 400 — `"Mức lương tham gia BHXH không được âm"` |
| `hasSocialInsuranceBook` không phải `"true"`/`"false"` | 400 — `"Có sổ BHXH chỉ được là Có hoặc Không"` |
| `hasSocialInsuranceBook` không gửi | Tạo mới → `false`; update → giữ giá trị cũ |
| `EMPLOYEE` gọi `PUT /social-insurance/:id` (kể cả của chính mình) | 403 Forbidden |
| `PUT` với `employeeId` không tồn tại | 404 — `"Nhân viên không tồn tại"` |
| `EMPLOYEE` gọi `GET /social-insurance` (list) | 403 Forbidden |
| `EMPLOYEE` gọi `GET /social-insurance/:id` với id của mình | 200 OK |
| `EMPLOYEE` gọi `GET /social-insurance/:id` với id người khác | 403 Forbidden |
| `MANAGER` / `CHIEF` gọi `GET /social-insurance/:employeeId` | 200 OK |

Toàn bộ các dòng trên đã được chạy bằng request HTTP thật — xem
`scripts/smoke-social-insurance.ts` (22 scenario).

> **Màn hình cho nhân viên tự xem:** API cho `EMPLOYEE` đọc BHXH của chính mình (200), nhưng
> web FE hiện **chưa có màn hình nào** dùng quyền đó — module chỉ nằm trong
> `/management/employees/[id]`, mà `role-layout.global.ts` chặn `EMPLOYEE` khỏi toàn bộ
> `/management/**`. Mobile dùng được endpoint này bình thường. Muốn web có thì cần một trang
> mới ngoài `/management` (vd `/profile/social-insurance`) — chưa làm.
