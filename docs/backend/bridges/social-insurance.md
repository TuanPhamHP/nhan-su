# Bridge Docs — BHXH & Thuế TNCN (`/v1/social-insurance`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| **POST** | **`/v1/social-insurance/me`** | **Mọi user đã đăng nhập** | **Nhân viên tự xem của mình — BẮT BUỘC gửi lại mật khẩu.** Xem mục "Tự xem" |
| GET | `/v1/social-insurance` | `ADMIN`, `HR` | Danh sách toàn công ty (có phân trang) |
| GET | `/v1/social-insurance/:employeeId` | **CHỈ** `ADMIN`/`HR`/`DIRECTOR`/`MANAGER`/`CHIEF` | Dành cho quản lý. **Nhân viên gọi id của chính mình cũng bị `403`** — phải dùng `POST /me` |
| PUT | `/v1/social-insurance/:employeeId` | `ADMIN`, `HR` | Upsert — tạo mới hoặc cập nhật (multipart/form-data) |

> ⚠️ **Thay đổi breaking:** `GET /:employeeId` trước đây cho chính chủ đọc, **nay không còn**.
> Nếu còn cho, nhân viên chỉ cần gọi thẳng id của mình là lấy được dữ liệu mà không cần mật
> khẩu — cửa mật khẩu ở `/me` sẽ thành vô nghĩa. FE phải chuyển mọi chỗ "nhân viên tự xem"
> sang `POST /me`.

---

## Tự xem — `POST /v1/social-insurance/me`

Dữ liệu BHXH & thuế là **nhạy cảm**, nên nhân viên phải **xác thực lại mật khẩu** mỗi lần
xem. Không truyền `employeeId` — server lấy từ JWT, nên không thể xem của người khác.

**Request:**

```typescript
POST /v1/social-insurance/me
Content-Type: application/json

{ "password": "mật khẩu của chính người đang đăng nhập" }
```

**Response thành công — HTTP `201`** (POST trong NestJS mặc định 201, **không phải 200** —
FE đừng hardcode `status === 200`). Body là `SocialInsuranceResponse` y như `GET`, hoặc
`data: null` nếu nhân viên chưa có bản ghi BHXH.

**Các mã lỗi:**

| HTTP | Code | Message | Khi nào | FE nên làm gì |
|---|---|---|---|---|
| `400` | `BAD_REQUEST` | `Vui lòng nhập mật khẩu` | Không gửi `password`, hoặc gửi chuỗi rỗng | Báo lỗi tại ô mật khẩu |
| `400` | `AUTH_INVALID_CREDENTIALS` | `Mật khẩu không đúng. Còn N lần thử` | Sai mật khẩu | Hiện **nguyên message của API** (có số lần thử còn lại), giữ modal mở |
| `403` | `AUTH_ACCOUNT_LOCKED` | `Tài khoản bị khóa. Thử lại sau N phút` | Sai 5 lần → **khoá tài khoản 30 phút** | Đóng modal, hiện message khoá. Không cho thử tiếp |
| `401` | `AUTH_SESSION_INVALID` | `Phiên đăng nhập không còn hợp lệ` | JWT còn hạn nhưng tài khoản đã bị vô hiệu hoá giữa phiên | Đăng xuất — đây là ca 401 **duy nhất** của endpoint này |
| `429` | — | — | Quá 30 request / 5 phút từ cùng một IP | Yêu cầu chờ |

### ⛔ Sai mật khẩu trả `400`, KHÔNG phải `401` — đừng "sửa lại cho đúng chuẩn"

Nhìn thì `401 Unauthorized` có vẻ hợp lý hơn cho "sai mật khẩu". Nhưng ở endpoint này
người gọi **đã xác thực** (JWT hợp lệ); thứ sai là mật khẩu trong body. Và quan trọng hơn:

Mọi client có interceptor **"refresh-on-401"** — repo FE này có sẵn, app mobile gần như
chắc chắn cũng vậy — sẽ tự refresh token rồi **gửi lại chính request đó** khi gặp 401.
Gửi lại thì vẫn sai mật khẩu, lần hai cũng thất bại, và interceptor **đăng xuất người
dùng**. Hậu quả đo được khi endpoint còn trả 401:

- Gõ nhầm mật khẩu **một lần** → bị đá về trang login, thay vì modal báo lỗi cho nhập lại.
- BE nhận **hai** request sai cho **một** lần gõ → bộ đếm tụt 2 bậc, nên bị khoá sau **3**
  lần nhầm thay vì 5 — mà không có đường mở khoá.

Đây là lý do dùng `400`, và cũng là **quy ước đã có sẵn** trong repo: `changePassword` khi
sai mật khẩu hiện tại cũng trả `BadRequestException`. Ca `401` duy nhất còn lại là
`AUTH_SESSION_INVALID`, và ca đó thì đăng xuất mới đúng.

> FE `nhan-su` còn thêm một lớp phòng vệ ở `app/services/http/auth.fetch.ts`: bỏ qua nhánh
> refresh-và-gửi-lại khi `code === 'AUTH_INVALID_CREDENTIALS'`. Giữ lớp đó — nó bảo vệ cả
> những endpoint sau này nếu ai đó lại trả 401 cho ca sai mật khẩu.

### Gọi đúng mật khẩu sẽ RESET bộ đếm

Bộ đếm sai được **xoá về 0 mỗi lần xác thực thành công** (cả qua `POST /me` lẫn qua đăng
nhập). Nên "sai 2 lần → đúng 1 lần → sai lần nữa" sẽ lại báo *còn 4 lần thử*, không phải
còn 2. FE có thể cho người dùng thử lại thoải mái sau một lần thành công.

### Chống dò mật khẩu — hai lớp

1. **Lớp chính — khoá theo TÀI KHOẢN.** Dùng **chung bộ đếm với đăng nhập**: sai 5 lần là
   khoá 30 phút. Cố ý dùng chung, vì đây là cùng một mật khẩu — tách riêng sẽ tạo một kênh
   dò mật khẩu không bị khoá cho kẻ có token bị đánh cắp.
2. **Lớp phụ — throttle theo IP**, 30 request / 5 phút, chỉ để chặn flood. Đặt rộng là có
   chủ ý: cả công ty thường ra internet qua một IP NAT, siết chặt sẽ khiến một người gõ
   nhầm làm cả phòng không xem được.

> ⚠️ **Hệ quả cần biết:** gõ sai mật khẩu 5 lần ở modal BHXH sẽ **khoá luôn việc đăng nhập**
> 30 phút, và hệ thống **chưa có đường mở khoá** cho HR/ADMIN — phải chờ hết giờ. FE nên
> hiện rõ số lần thử còn lại (API trả trong message) để người dùng không vô tình tự khoá.

### Luồng FE

```
Nút "Xem thông tin BHXH & Thuế"
      ↓
Modal nhập mật khẩu
      ↓  POST /v1/social-insurance/me  { password }
  ├─ 201 → hiện dữ liệu
  ├─ 400 → lỗi tại ô mật khẩu, giữ modal (thiếu HOẶC sai mật khẩu)
  ├─ 403 → đóng modal, báo tài khoản bị khoá 30 phút
  └─ 429 → báo thử lại sau
```

Không cache kết quả vào `localStorage`/cookie: cache lại thì lần sau xem không cần mật
khẩu nữa, đúng cái mà cửa mật khẩu sinh ra để chặn. Giữ trong state của component, mất khi
rời trang là đúng.

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
  note: string | null;                   // ⚠️ ghi chú NỘI BỘ của HR — xem mục dưới
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

## `note` — ghi chú nội bộ, nhân viên tự đọc thì nhận `null`

`note` là ghi chú **HR viết về nhân viên**, không dành cho chính nhân viên đọc. BE chặn ở
tầng API, không để FE tự ẩn:

| Ai gọi | `note` nhận được |
|---|---|
| `HR`, `ADMIN`, `DIRECTOR`, `MANAGER`, `CHIEF` (qua `GET /:employeeId` hoặc `POST /me`) | giá trị thật |
| Nhân viên tự xem qua `POST /me` | **luôn `null`** |

Các field còn lại **không** bị chặn — nhân viên vẫn đọc đủ mã số BHXH, mức lương tham gia,
cờ có sổ, BHYT, toàn bộ `taxInfo` và presigned URL của file (đều là dữ liệu của chính họ).

> Vì sao chặn ở BE: ẩn ở FE chỉ là ẩn về hình ảnh — giá trị vẫn nằm trong HTTP response,
> nhân viên mở tab Network của trình duyệt là đọc được.
>
> Response của `PUT` không bị ảnh hưởng: chỉ `HR`/`ADMIN` gọi được nên luôn thấy `note` thật.

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
| `EMPLOYEE` gọi `GET /social-insurance/:id` với **id của mình** | **403 Forbidden** — phải dùng `POST /me` kèm mật khẩu |
| `EMPLOYEE` gọi `GET /social-insurance/:id` với id người khác | 403 Forbidden |
| `MANAGER` / `CHIEF` gọi `GET /social-insurance/:employeeId` | 200 OK |
| `POST /me` đúng mật khẩu, nhân viên **chưa có** bản ghi | 201 + `data: null` |
| `POST /me` đúng mật khẩu khi tài khoản **đang bị khoá** | 403 — khoá thắng cả mật khẩu đúng |
| `POST /me` bởi `HR`/`ADMIN` cho chính mình | 201, và `note` trả **giá trị thật** (họ thuộc nhóm được đọc) |

Toàn bộ các dòng trên đã được chạy bằng request HTTP thật — xem
`scripts/smoke-social-insurance.ts` (35 scenario).

> **Màn hình cho nhân viên tự xem:** API cho `EMPLOYEE` đọc BHXH của chính mình (200), nhưng
> web FE hiện **chưa có màn hình nào** dùng quyền đó — module chỉ nằm trong
> `/management/employees/[id]`, mà `role-layout.global.ts` chặn `EMPLOYEE` khỏi toàn bộ
> `/management/**`. Mobile dùng được endpoint này bình thường. Muốn web có thì cần một trang
> mới ngoài `/management` (vd `/profile/social-insurance`) — chưa làm.
