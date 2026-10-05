# FE Agent Prompt — Cập nhật form BHXH: bỏ tỉ lệ đóng, thêm mức lương tham gia + cờ có sổ

## Context

BE vừa đổi contract module BHXH (`/v1/social-insurance`). Ba việc:

1. **Bỏ hoàn toàn tỉ lệ đóng bảo hiểm** — tỉ lệ áp dụng chung theo luật lao động, không
   khác nhau giữa các nhân viên nên không lưu theo từng người nữa.
2. **Thêm `insuranceSalary`** — mức lương tham gia BHXH, **bắt buộc**. Đây mới là phần
   khác nhau thật sự giữa các nhân viên.
3. **Thêm `hasSocialInsuranceBook`** — người lao động có sổ BHXH hay không, chỉ Có/Không.
   Dùng để chốt sổ BHXH khi nhân viên nghỉ việc; cố ý không quản lý chi tiết sổ.

Đồng thời `socialInsuranceNumber` (Mã số BHXH) trở thành **bắt buộc**.

Bridge doc đầy đủ: [`docs/backend/bridges/social-insurance.md`](./social-insurance.md)
(ở repo này đã có bản sao đồng bộ).

> **Phạm vi đã chốt với người yêu cầu:** CHỈ bỏ tỉ lệ đóng. Số thẻ BHYT, ngày hết hạn
> BHYT, thuế TNCN (MST, người phụ thuộc, chứng từ), file scan, ghi chú **giữ nguyên hết**.
> Đừng xoá thêm gì ngoài section tỉ lệ.

---

## Thay đổi API

### Response — `GET /v1/social-insurance/:employeeId`

```diff
  export interface SocialInsuranceResponse {
    id: number;
    employee: SIEmployeeSummary;
-   socialInsuranceNumber: string | null;
+   socialInsuranceNumber: string;         // LUÔN có giá trị, không bao giờ null
+   insuranceSalary: number;               // mức lương tham gia BHXH (VND), LUÔN có
+   hasSocialInsuranceBook: boolean;       // có sổ BHXH hay không
    healthInsuranceNumber: string | null;
    healthInsuranceExpiry: string | null;
    registeredHospital: string | null;
    effectiveDate: string | null;          // ngày tham gia BHXH
    siDocUrl: string | null;
-   rates: InsuranceRates;                 // ⛔ ĐÃ BỎ
-   totalDeductionRate: number;            // ⛔ ĐÃ BỎ
    taxInfo: TaxInfo;
    note: string | null;
    updatedAt: string;
  }

- export interface InsuranceRates { ... }  // ⛔ XOÁ HẲN interface này
```

### Request — `PUT /v1/social-insurance/:employeeId`

```diff
  export interface UpsertSocialInsuranceDto {
-   socialInsuranceNumber?: string;
+   socialInsuranceNumber: string;         // BẮT BUỘC, không được rỗng
+   insuranceSalary: number;               // BẮT BUỘC, min 0
+   hasSocialInsuranceBook?: boolean;      // bỏ trống → false khi tạo mới
    healthInsuranceNumber?: string;
    healthInsuranceExpiry?: string;
-   socialInsuranceRate?: number;          // ⛔ ĐÃ BỎ
-   healthInsuranceRate?: number;          // ⛔ ĐÃ BỎ
-   unemploymentInsuranceRate?: number;    // ⛔ ĐÃ BỎ
    registeredHospital?: string;
    effectiveDate?: string;
    taxCode?: string;
    dependents?: number;
    dependentDetails?: DependentDetail[];
    note?: string;
  }
```

⚠️ **Upsert KHÔNG phải PATCH từng phần.** `socialInsuranceNumber` và `insuranceSalary`
phải có trong **mọi** request, kể cả khi người dùng chỉ sửa ghi chú. Form hiện tại đã
submit toàn bộ `values` nên không cần đổi cách gửi — chỉ cần hai field đó luôn có giá trị.

### Mã lỗi mới (BE đã chạy smoke thật, 18/18 scenario xanh)

| Tình huống | HTTP | Message |
|---|---|---|
| Thiếu / rỗng `socialInsuranceNumber` | 400 | `Mã số BHXH không được để trống` |
| Thiếu `insuranceSalary` | 400 | — |
| `insuranceSalary` âm | 400 | `Mức lương tham gia BHXH không được âm` |
| `hasSocialInsuranceBook` không phải true/false | 400 | `Có sổ BHXH chỉ được là Có hoặc Không` |
| `EMPLOYEE` gọi `PUT` | 403 | `Không đủ quyền` |
| `employeeId` không tồn tại | 404 | `Nhân viên không tồn tại` |

### 🐛 Bug BE đã sửa — liên quan trực tiếp tới form này

Trước thay đổi này, **mọi lần lưu BHXH từ FE đều trả 400**: service FE luôn append
`dependentDetails = JSON.stringify(array)` (kể cả mảng rỗng `"[]"`), nhưng DTO BE validate
`@IsArray()` nên chuỗi JSON bị loại. BE đã sửa để parse JSON string → **cách gửi hiện tại
của FE giờ đúng, không cần đổi**. Chỉ cần biết để không "sửa lại cho khỏi 400".

Lưu ý còn lại: `dependentDetails` là chuỗi **không phải JSON hợp lệ** → vẫn 400 (cố ý, để
không âm thầm mất dữ liệu người phụ thuộc).

---

## File FE phải sửa

| File | Việc |
|---|---|
| `app/types/social-insurance.types.ts` | Xoá `InsuranceRates`; sửa `SocialInsuranceResponse` + `UpsertSocialInsuranceDto` theo diff trên |
| `app/components/modules/employee/EmployeeSocialInsurance.vue` | Xoá section "Tỷ lệ đóng bảo hiểm (%)"; thêm 2 field mới; siết validate |
| `app/services/social-insurance.service.ts` | Kiểm lại `upsert()` — `String(v)` cho boolean ra `"true"`/`"false"`, đúng thứ BE nhận. Khả năng cao **không cần sửa gì** |
| `app/composables/useSocialInsurance.ts` | Khả năng cao không cần sửa |

Không màn hình nào khác dùng module này — đã grep: chỉ tab `social-insurance` trong
`app/pages/management/employees/[id].vue:637`.

### Chi tiết trong `EmployeeSocialInsurance.vue`

**Xoá:** toàn bộ "Section 2: Rates" (4 input BHXH/BHYT/BHTN/Tổng khấu trừ), biến
`localTotalRate`, 3 `defineField` rate, 3 dòng rate trong `setValues`, 3 dòng rate trong
`onSubmit`, 3 rate trong `initialValues`, 3 rule rate trong zod schema.

**Thêm vào Section 1 "Thông tin bảo hiểm":**

- **Mã số BHXH** — đổi nhãn từ "Số sổ BHXH" → **"Mã số BHXH"** (có dấu `*` bắt buộc).
  zod: `z.string().min(1, 'Mã số BHXH không được để trống')`.
- **Mức lương tham gia BHXH** — input số/tiền, có dấu `*`.
  zod: `z.coerce.number().min(0, 'Không được âm')`, và phải chặn rỗng (bắt buộc).
  Nên format nghìn khi hiển thị cho dễ đọc (12.500.000) nhưng gửi đi số thuần.
- **Có sổ BHXH** — toggle/radio **Có / Không**, mặc định **Không**. Không dùng checkbox
  3 trạng thái, không để null.

**Nhãn tiếng Việt** (BE không trả label cho 2 field này, FE tự đặt):
`hasSocialInsuranceBook: true → "Có"`, `false → "Không"`.

---

## Scenario FE phải smoke (bấm thật trên UI, không chỉ build)

| # | Việc | Kỳ vọng |
|---|---|---|
| 1 | Mở tab BHXH của nhân viên **chưa có** dữ liệu | Form trống, không crash, hiện dòng "Chưa có dữ liệu BHXH" |
| 2 | Submit khi để trống Mã số BHXH | Lỗi inline, **không** gọi API |
| 3 | Submit khi để trống Mức lương tham gia | Lỗi inline, **không** gọi API |
| 4 | Nhập Mức lương âm | Lỗi inline |
| 5 | Điền đủ rồi Lưu | Toast thành công; F5 lại thấy đúng dữ liệu |
| 6 | Bật "Có sổ BHXH" = Có, lưu, F5 | Vẫn hiện Có |
| 7 | Đặt = Không, lưu, F5 | Vẫn hiện Không (không bị nhảy về Có) |
| 8 | Thêm 1 người phụ thuộc rồi lưu | 200, không 400 (hồi quy bug `dependentDetails`) |
| 9 | Lưu khi danh sách người phụ thuộc rỗng | 200, không 400 |
| 10 | Section "Tỷ lệ đóng bảo hiểm (%)" | **Không còn trên UI** |
| 11 | Đăng nhập role `EMPLOYEE`, xem BHXH của mình | Form **disabled**, không có nút Lưu |
| 12 | Upload file scan rồi lưu | Link "Xem scan" mở được (presigned URL) |
| 13 | Ép BE trả 400 (ví dụ sửa tạm payload) | Hiện toast lỗi, **không** trắng trang |

---

## Giới hạn

- **Không sửa file nào trong repo BE** (`../hr-system-be`).
- Type phải khớp `../hr-system-be/docs/openapi.json` (bản sống, BE vừa sinh lại), **không**
  phải `docs/api-endpoint.json` (chốt 04/08/2026, đã cũ).
- Nếu phát hiện contract BE sai/thiếu → **báo lại, đừng workaround ở FE**. Sai contract
  phải sửa ở BE.
- `npm run typecheck` **không tồn tại** trong `package.json` repo này — đừng báo
  "typecheck pass" từ lệnh không có. Dùng `npm run build` và `npx vitest run`.

## Báo lại những gì

1. Danh sách file đã sửa.
2. Bảng kết quả 13 scenario trên (✓/✗ từng dòng, kèm cái gì thấy thật).
3. Chỗ nào lệch so với bridge doc, hoặc chỗ nào doc thiếu.
