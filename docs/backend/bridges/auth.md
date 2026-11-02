# Bridge Docs — Xác thực (`/v1/auth`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

> **Từ G1 (11/2026) hệ thống phục vụ nhiều công ty trên một domain.** Một người có **một tài
> khoản** (email + mật khẩu) và có thể thuộc nhiều công ty, mỗi công ty một hồ sơ nhân sự với
> vai trò và quyền riêng. Mỗi phiên đăng nhập gắn với **một công ty**; đổi công ty là gọi
> `/auth/switch`. Thiết kế: `docs/tenancy.md`.

---

## Endpoints

| Method | Path | Auth | Ghi chú |
|--------|------|------|---------|
| POST | `/v1/auth/login` | Không | Đăng nhập bằng **email**. Thuộc nhiều công ty thì trả về danh sách để chọn |
| POST | `/v1/auth/select-company` | Không | Chọn công ty sau khi login trả `requiresCompanySelection: true` |
| POST | `/v1/auth/switch` | JWT | Chuyển sang công ty khác của cùng tài khoản |
| POST | `/v1/auth/accept-invite` | Không | Nhận lời mời vào công ty bằng token trong email |
| POST | `/v1/auth/refresh` | Không | Làm mới access token bằng refresh token |
| POST | `/v1/auth/logout` | JWT | Hủy phiên **của thiết bị này** |
| GET | `/v1/auth/me` | JWT | Thông tin user + permissions + công ty hiện tại + các công ty khác |
| PATCH | `/v1/auth/profile` | JWT | Cập nhật hồ sơ cá nhân ở công ty hiện tại |
| POST | `/v1/auth/avatar` | JWT | Upload ảnh đại diện (multipart/form-data) |
| PATCH | `/v1/auth/change-password` | JWT | Đổi mật khẩu tài khoản (hủy phiên ở **mọi** công ty, mọi thiết bị) |
| POST | `/v1/auth/forgot-password` | Không | Yêu cầu link đặt lại mật khẩu qua email |
| POST | `/v1/auth/reset-password` | Không | Đặt lại mật khẩu (hoặc đặt lần đầu) bằng token từ email |

---

## TypeScript Types

```typescript
// types/auth.types.ts

export type SystemRole = 'EMPLOYEE' | 'MANAGER' | 'CHIEF' | 'DIRECTOR' | 'HR' | 'ADMIN';

export interface CompanyOption {
  code: string;   // mã công ty, ví dụ "cty-a" — dùng cho select-company và switch
  name: string;   // tên hiển thị
}

// Response khi đã vào được một công ty: login (1 công ty), select-company, switch, refresh
export interface AuthResponse {
  requiresCompanySelection: false;
  accessToken: string;   // JWT ngắn hạn (mặc định 15 phút)
  token: string;         // Alias của accessToken — dùng khi client cũ không đọc được accessToken
  refreshToken: string;  // Chuỗi MỜ, lưu nguyên và gửi lại ở /refresh. Không tự phân tích.
  user: AuthUser;        // hồ sơ ở công ty của phiên này
  company: CompanyOption;      // công ty của phiên này
  companies: CompanyOption[];  // mọi công ty tài khoản đang thuộc (để vẽ bộ chọn)
}

// Response khi đúng mật khẩu nhưng tài khoản thuộc NHIỀU công ty: chưa có token
export interface CompanySelectionResponse {
  requiresCompanySelection: true;
  selectionToken: string;      // hạn 5 phút, chỉ dùng cho /select-company
  companies: CompanyOption[];  // sắp theo công ty dùng gần nhất
}

export type LoginResponse = AuthResponse | CompanySelectionResponse;

export interface AuthUser {
  id: number;            // ID nhân viên TRONG công ty hiện tại (trùng số giữa các công ty là bình thường)
  fullName: string;
  email: string;         // email công việc trong hồ sơ — KHÔNG nhất thiết là email đăng nhập
  employeeCode: string;
  role: SystemRole;
  avatarUrl: string | null;
}

// GET /me
export interface MeResponse {
  id: number;
  fullName: string;
  email: string;
  employeeCode: string;
  role: SystemRole;
  avatarUrl: string | null;
  permissions: string[];  // quyền ở công ty hiện tại
  company: CompanyOption;
  companies: CompanyOption[];
}

// PATCH /profile — POST /avatar
export interface ProfileResponse {
  id: number;
  fullName: string;
  email: string;
  employeeCode: string;
  role: SystemRole;
  phone: string | null;
  dateOfBirth: string | null;  // "YYYY-MM-DD"
  gender: 'Nam' | 'Nữ' | 'Khác' | null;
  address: string | null;
  avatarUrl: string | null;
}

// Request DTOs
export interface LoginDto {
  identifier: string;   // EMAIL đăng nhập. Mã nhân viên không còn được nhận (400 AUTH_EMAIL_REQUIRED)
  password: string;
}

export interface SelectCompanyDto {
  selectionToken: string;
  companyCode: string;
}

export interface SwitchCompanyDto {
  companyCode: string;
}

export interface AcceptInviteDto {
  token: string;        // query ?token= của link /accept-invite trong email
  newPassword?: string; // chỉ gửi khi server trả 400 AUTH_INVITE_PASSWORD_REQUIRED (tối thiểu 6 ký tự)
}

export interface UpdateProfileDto {
  fullName?: string;     // 2–100 ký tự
  email?: string;        // email CÔNG VIỆC trong hồ sơ — không đổi email đăng nhập
  phone?: string;
  dateOfBirth?: string;  // "YYYY-MM-DD"
  gender?: 'Nam' | 'Nữ' | 'Khác';
  address?: string;
}

export interface ChangePasswordDto {
  currentPassword: string;
  newPassword: string;   // tối thiểu 6 ký tự
}

export interface ForgotPasswordDto {
  email: string;
}

export interface ResetPasswordDto {
  token: string;       // 64 ký tự hex, nhận từ link email
  newPassword: string; // tối thiểu 6 ký tự
}
```

---

## POST /v1/auth/login — Đăng nhập

Chỉ nhận **email** (giữ tên trường `identifier` để sau này nhận thêm số điện thoại). Trường
`email` cũ vẫn được nhận như alias. Email được trim + chữ thường trước khi tra.

**Request:**
```json
{ "identifier": "nguyen.a@company.com", "password": "Hr@123456" }
```

**Response 200 — tài khoản thuộc MỘT công ty:** vào thẳng.
```json
{
  "success": true,
  "data": {
    "requiresCompanySelection": false,
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "cty-a.0b9f6a3c-2d4e-4f5a-8b6c-7d8e9f0a1b2c.9c1e…(64 hex)",
    "user": {
      "id": 4,
      "fullName": "Nguyễn Văn A",
      "email": "nguyen.a@company.com",
      "employeeCode": "EMP004",
      "role": "EMPLOYEE",
      "avatarUrl": null
    },
    "company": { "code": "cty-a", "name": "Công ty A" },
    "companies": [{ "code": "cty-a", "name": "Công ty A" }]
  }
}
```

**Response 200 — tài khoản thuộc NHIỀU công ty:** chưa có token, FE hiện màn chọn công ty rồi
gọi `/select-company`.
```json
{
  "success": true,
  "data": {
    "requiresCompanySelection": true,
    "selectionToken": "eyJhbGciOiJIUzI1NiJ9...",
    "companies": [
      { "code": "cty-b", "name": "Công ty B" },
      { "code": "cty-a", "name": "Công ty A" }
    ]
  }
}
```

`companies` chỉ gồm công ty mà người đó **vào được ngay**: membership ACTIVE, công ty đang hoạt
động, hồ sơ nhân sự ở đó còn ACTIVE.

**Lỗi có thể gặp:**

| HTTP | Code | Nguyên nhân |
|------|------|------------|
| 400 | `AUTH_EMAIL_REQUIRED` | Gõ mã nhân viên (hoặc chuỗi không phải email) |
| 401 | `AUTH_INVALID_CREDENTIALS` | Sai email hoặc mật khẩu (còn N lần thử), hoặc tài khoản chưa kích hoạt |
| 403 | `AUTH_ACCOUNT_LOCKED` | Sai quá 5 lần — khóa 30 phút (khoá cả tài khoản, mọi công ty) |
| 403 | `AUTH_NO_ACTIVE_COMPANY` | Đúng mật khẩu nhưng không còn công ty nào vào được (nghỉ việc, bị khoá ở mọi nơi) |
| 503 | `PLATFORM_NOT_CONFIGURED` | Server chưa cấu hình database platform (chỉ gặp ở máy dev) |

> **Brute-force protection:** Sau 5 lần sai liên tiếp, tài khoản bị khóa **30 phút**. Bộ đếm
> nằm ở tài khoản, dùng chung với bước xác thực lại mật khẩu khi xem BHXH.

---

## POST /v1/auth/select-company — Chọn công ty

**Request:**
```json
{ "selectionToken": "eyJhbGciOiJIUzI1NiJ9...", "companyCode": "cty-b" }
```

**Response 200:** `AuthResponse` của công ty đã chọn.

| HTTP | Code | Nguyên nhân |
|------|------|------------|
| 401 | `AUTH_SELECTION_EXPIRED` | `selectionToken` sai hoặc quá 5 phút → quay lại màn đăng nhập |
| 403 | `TENANT_ACCESS_DENIED` | `companyCode` không nằm trong danh sách được chọn |

> `selectionToken` **không** phải access token: dùng nó gọi API khác sẽ nhận 401.

---

## POST /v1/auth/switch — Chuyển công ty

Cần `Authorization: Bearer <accessToken>` của công ty hiện tại.

**Request:**
```json
{ "companyCode": "cty-a" }
```

**Response 200:** `AuthResponse` của công ty mới. Lưu **cả** `accessToken` lẫn `refreshToken`
mới. Phiên ở công ty cũ bị hủy ngay (token cũ trả 401).

Sau khi chuyển, mọi dữ liệu đang cache ở FE (danh bạ, phòng ban, metadata, đơn chờ duyệt…)
thuộc công ty cũ — phải xoá hết rồi nạp lại, cách an toàn nhất là reload trang về `/`.

| HTTP | Code | Nguyên nhân |
|------|------|------------|
| 400 | `TENANT_ALREADY_CURRENT` | Đang ở chính công ty đó |
| 401 | — | Chưa xác thực |
| 403 | `TENANT_ACCESS_DENIED` | Không thuộc công ty đó, hoặc hồ sơ ở đó không còn hoạt động |

---

## POST /v1/auth/accept-invite — Nhận lời mời

Khi HR một công ty thêm người **đã có tài khoản** (thường là đang làm ở công ty khác), hệ thống
không tự nối mà gửi email lời mời với link `{FRONTEND_PUBLIC_URL}/accept-invite?token=<64 hex>`,
hạn **7 ngày**. Không cần đăng nhập: link đi tới email của chính tài khoản, bấm là đủ.

**Request:**
```json
{ "token": "a3f8b2c1…(64 hex)" }
```

**Response 200:**
```json
{ "success": true, "data": { "companyName": "Công ty B" } }
```

Sau đó người dùng đăng nhập bằng mật khẩu hiện tại; vì giờ thuộc nhiều công ty nên sẽ gặp màn
chọn công ty.

**Tài khoản chuyển từ dữ liệu cũ phải đặt mật khẩu mới.** Tài khoản tạo lúc chuyển dữ liệu công
ty đầu tiên (trước G1, nhân viên tự đổi được email mà không cần xác minh) chưa có bằng chứng chủ
hộp thư giữ mật khẩu. Lần gọi đầu không có `newPassword` thì server trả 400
`AUTH_INVITE_PASSWORD_REQUIRED` và **chưa** tiêu token. FE hiện form "Mật khẩu mới" + "Xác nhận"
rồi gửi lại:

```json
{ "token": "a3f8b2c1…(64 hex)", "newPassword": "NewPass@789" }
```

Nhận lời mời kiểu này thì mật khẩu đổi sang mật khẩu mới và **mọi phiên ở mọi công ty bị hủy**:
báo người dùng đăng nhập lại bằng mật khẩu mới. Tài khoản đã từng đặt mật khẩu qua link email
(kích hoạt, quên mật khẩu) thì không bị hỏi bước này.

| HTTP | Code | Nguyên nhân |
|------|------|------------|
| 400 | `AUTH_INVITE_PASSWORD_REQUIRED` | Phải gửi kèm `newPassword`. Token vẫn còn dùng được |
| 400 | `AUTH_INVALID_INVITE_TOKEN` | Token sai, đã dùng, hoặc lời mời không còn hiệu lực |
| 400 | `AUTH_INVITE_EXPIRED` | Quá 7 ngày — liên hệ HR công ty mời để gửi lại |
| 400 | — (validation) | `newPassword` ngắn hơn 6 ký tự |

---

## POST /v1/auth/refresh — Làm mới token

Gọi khi `accessToken` hết hạn (nhận 401). Không cần header Authorization.

**Request:**
```json
{ "refreshToken": "cty-a.0b9f6a3c-2d4e-4f5a-8b6c-7d8e9f0a1b2c.9c1e…" }
```

**Response 200:** `AuthResponse` mới, **cùng công ty** với phiên cũ.

> Mỗi lần refresh sẽ **rotate** refreshToken — lưu lại giá trị mới. Dùng lại token cũ → 401.
> Refresh token dạng UUID phát trước G1 vẫn được nhận **một lần** rồi đổi sang dạng mới, nên
> không ai bị đăng xuất khi deploy.

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|------------|
| 401 | `AUTH_TOKEN_EXPIRED` | Token sai, đã dùng, hết hạn (7 ngày), phiên bị hủy, hoặc không còn thuộc công ty đó |
| 403 | `TENANT_SUSPENDED` | Công ty đã ngừng dịch vụ |
| 503 | `TENANT_MAINTENANCE` | Công ty đang bảo trì — thử lại sau, KHÔNG đăng xuất người dùng |

---

## POST /v1/auth/logout — Đăng xuất

Hủy **phiên của thiết bị này**. Thiết bị khác của cùng người vẫn đăng nhập. Access token vẫn
còn hạn đến khi expire tự nhiên nhưng mọi API trả 401 ngay vì phiên đã hủy.

**Request:** Không có body — chỉ cần `Authorization: Bearer <accessToken>`.

**Response: 204 No Content**

---

## GET /v1/auth/me — Thông tin người dùng

Gọi sau login để lấy profile + permissions **ở công ty hiện tại**, cùng danh sách công ty để vẽ
bộ chọn ở header (chỉ hiện khi `companies.length > 1`).

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": 4,
    "fullName": "Nguyễn Văn A",
    "email": "nguyen.a@company.com",
    "employeeCode": "EMP004",
    "role": "EMPLOYEE",
    "avatarUrl": "https://…presigned…",
    "permissions": ["employee:read", "leave:create"],
    "company": { "code": "cty-a", "name": "Công ty A" },
    "companies": [
      { "code": "cty-a", "name": "Công ty A" },
      { "code": "cty-b", "name": "Công ty B" }
    ]
  }
}
```

---

## PATCH /v1/auth/profile — Cập nhật thông tin cá nhân

Tất cả fields đều optional. Sửa hồ sơ ở **công ty hiện tại**; công ty khác giữ hồ sơ riêng.
`email` ở đây là email công việc trong hồ sơ — **không** đổi email đăng nhập.

**Response 200:** `ApiSuccess<ProfileResponse>`

| HTTP | Nguyên nhân |
|------|------------|
| 409 | `email` mới đã được dùng bởi nhân viên khác trong công ty |
| 400 | `gender` không phải `'Nam'`, `'Nữ'`, hoặc `'Khác'` |

---

## POST /v1/auth/avatar — Upload ảnh đại diện

**Content-Type:** `multipart/form-data`, field `file`: JPG hoặc PNG, tối đa 2MB.

**Response 201:** `ApiSuccess<ProfileResponse>` — `avatarUrl` là presigned URL.

---

## PATCH /v1/auth/change-password — Đổi mật khẩu

**Request:**
```json
{ "currentPassword": "Hr@123456", "newPassword": "NewPass@789" }
```

**Response: 204 No Content**

> Một mật khẩu dùng cho mọi công ty, nên server **hủy mọi phiên ở mọi công ty, mọi thiết bị**,
> kể cả phiên đang gọi. FE xoá token và đưa về `/login`.

| HTTP | Nguyên nhân |
|------|------------|
| 400 | `currentPassword` không đúng |
| 401 | Access token hết hạn / không hợp lệ |

---

## POST /v1/auth/forgot-password — Quên mật khẩu

**Request:**
```json
{ "email": "nguyen.a@company.com" }
```

**Response: 204 No Content** — luôn trả về 204 dù email có tài khoản hay không (bảo mật).

Link gửi tới **email đăng nhập của tài khoản**, không bao giờ tới email công việc trong hồ sơ.
Link không mang mã công ty: mật khẩu là của tài khoản, dùng cho mọi công ty.

> Email chỉ được gửi thật khi `NODE_ENV=production`. Ở môi trường khác, job email được ghi
> log rồi bỏ qua.

**Reset link format:** `{FRONTEND_PUBLIC_URL}/reset-password?token=<64-hex-chars>`. Thiếu
`FRONTEND_PUBLIC_URL` thì server lấy origin **đầu tiên** của `FRONTEND_URL`.

Link này hết hạn sau **1 giờ**. Cùng trang `/reset-password` còn nhận link do HR phát (đặt
lại mật khẩu, kích hoạt tài khoản mới), loại đó hạn **3 giờ**. Xem `employees.md`.

---

## POST /v1/auth/reset-password — Đặt lại mật khẩu

Dùng token nhận được từ link email (query param `?token=...`). Cũng dùng cho link **kích hoạt**
tài khoản mới (người dùng tự đặt mật khẩu lần đầu).

**Request:**
```json
{
  "token": "a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
  "newPassword": "NewPass@789"
}
```

**Response: 204 No Content**

> Sau khi đặt thành công: token bị đánh dấu đã dùng, email được tính là đã xác minh, mọi phiên ở
> mọi công ty bị hủy → user đăng nhập lại.

| HTTP | Code | Nguyên nhân |
|------|------|------------|
| 400 | `AUTH_INVALID_RESET_TOKEN` | Token sai, đã dùng, hoặc đã bị thay bằng link mới hơn |
| 400 | `AUTH_RESET_TOKEN_EXPIRED` | Token hết hạn: **1 giờ** với link tự yêu cầu, **3 giờ** với link do HR phát |

> Link đặt lại mật khẩu phát **trước khi deploy G1** không còn dùng được sau deploy; người dùng
> yêu cầu link mới. Mỗi tài khoản chỉ có một link còn hiệu lực cho mỗi mục đích.

---

## Link có mã công ty

Link tới một bản ghi (đơn nghỉ, đơn tăng ca, đơn làm online, đơn vi phạm…) trong email mang thêm
`?t=<mã công ty>`, ví dụ `/leave-requests/123?t=cty-a`, vì đơn số 123 có ở mọi công ty. FCM
data cũng có thêm khoá `tid`. Nếu `t`/`tid` khác công ty đang mở, FE hỏi người dùng có muốn
chuyển sang công ty đó (gọi `/switch`) rồi mới mở bản ghi. Link đặt mật khẩu và lời mời **không**
có `t`.

---

## Token lifecycle

| Token | Lưu ở | TTL | Rotate khi |
|-------|-------|-----|-----------|
| `accessToken` (JWT) | Cookie/memory | 15 phút (env `JWT_EXPIRES_IN`) | Mỗi lần `/refresh`, `/switch` |
| `refreshToken` (chuỗi mờ) | Cookie; server chỉ lưu hash | 7 ngày, tính lại mỗi lần refresh (env `REFRESH_TOKEN_EXPIRES_IN`) | Mỗi lần `/refresh` |
| `selectionToken` (JWT) | Memory | 5 phút | — |
| Token đặt mật khẩu / kích hoạt / lời mời | Server lưu SHA-256, link mang bản gốc | 1 giờ (tự yêu cầu) · 3 giờ (HR phát) · 7 ngày (lời mời) | Dùng một lần; phát link mới thì link cũ hết hiệu lực |

**Mỗi thiết bị một phiên.** Phiên bị hủy khi:
- `POST /logout` → chỉ phiên của thiết bị đó
- `POST /switch` → phiên ở công ty cũ
- `PATCH /change-password`, `POST /reset-password` → mọi phiên, mọi công ty
- HR công ty X đặt lại mật khẩu cho tài khoản **chỉ thuộc công ty X** → mọi phiên ở X
- HR khoá hoặc cho nghỉ việc → mọi phiên ở công ty đó (công ty khác không ảnh hưởng)

---

## Composable — useAuth

```typescript
// composables/useAuth.ts
export function useAuth() {
  const login = (dto: LoginDto) => api.post<LoginResponse>('/v1/auth/login', dto);
  const selectCompany = (dto: SelectCompanyDto) => api.post<AuthResponse>('/v1/auth/select-company', dto);
  const switchCompany = (dto: SwitchCompanyDto) => api.post<AuthResponse>('/v1/auth/switch', dto);
  const acceptInvite = (dto: AcceptInviteDto) =>
    api.post<{ companyName: string }>('/v1/auth/accept-invite', dto);
  const refresh = (refreshToken: string) => api.post<AuthResponse>('/v1/auth/refresh', { refreshToken });
  const logout = () => api.post<void>('/v1/auth/logout');
  const me = () => api.get<MeResponse>('/v1/auth/me');
  const changePassword = (dto: ChangePasswordDto) => api.patch<void>('/v1/auth/change-password', dto);
  const forgotPassword = (dto: ForgotPasswordDto) => api.post<void>('/v1/auth/forgot-password', dto);
  const resetPassword = (dto: ResetPasswordDto) => api.post<void>('/v1/auth/reset-password', dto);
  return { login, selectCompany, switchCompany, acceptInvite, refresh, logout, me, changePassword, forgotPassword, resetPassword };
}
```

---

## Edge Cases

| Tình huống | Kết quả |
|-----------|---------|
| `identifier` là email viết hoa / có khoảng trắng | Server trim + lowercase trước khi tra — không lỗi |
| `identifier` là mã nhân viên (`EMP004`) | 400 `AUTH_EMAIL_REQUIRED` — hiện "Vui lòng đăng nhập bằng email" |
| Email chưa có tài khoản | 401 `AUTH_INVALID_CREDENTIALS` (giống sai mật khẩu, không lộ email) |
| Tài khoản HR vừa tạo, chưa bấm link kích hoạt | 401 `AUTH_INVALID_CREDENTIALS` |
| Nghỉ việc ở mọi công ty | 403 `AUTH_NO_ACTIVE_COMPANY` |
| Nghỉ việc ở A, vẫn làm ở B | Login vào thẳng B |
| Login khi đang bị lock (< 30 phút) | 403 `AUTH_ACCOUNT_LOCKED` |
| `POST /refresh` với token đã dùng (cũ) | 401 — token đã rotate |
| `POST /refresh` sau khi đổi mật khẩu ở thiết bị khác | 401 — mọi phiên đã bị hủy |
| `POST /switch` rồi dùng access token cũ | 401 — phiên cũ đã bị hủy |
| Công ty bị ngắt dịch vụ giữa phiên | Mọi API trả 403 `TENANT_SUSPENDED` |
| Công ty đang bảo trì | Mọi API trả 503 `TENANT_MAINTENANCE` — không đăng xuất, hiện thông báo bảo trì |
| `POST /forgot-password` với email không có tài khoản | 204 — không tiết lộ |
| `POST /reset-password` dùng token lần 2 | 400 `AUTH_INVALID_RESET_TOKEN` |
| `POST /accept-invite` dùng token lần 2 | 400 `AUTH_INVALID_INVITE_TOKEN` |
| `POST /accept-invite` không kèm mật khẩu, tài khoản chuyển từ dữ liệu cũ | 400 `AUTH_INVITE_PASSWORD_REQUIRED`, token vẫn dùng được |
| `PATCH /profile` đổi email thành email của người khác trong công ty | 409 Conflict |
