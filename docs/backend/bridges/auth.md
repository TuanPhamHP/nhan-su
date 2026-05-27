# Bridge Docs — Xác thực (`/v1/auth`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Auth | Ghi chú |
|--------|------|------|---------|
| POST | `/v1/auth/login` | Không | Đăng nhập bằng email hoặc mã nhân viên |
| POST | `/v1/auth/refresh` | Không | Làm mới access token bằng refresh token |
| POST | `/v1/auth/logout` | JWT | Hủy session hiện tại |
| GET | `/v1/auth/me` | JWT | Thông tin user đang đăng nhập + danh sách permissions |
| PATCH | `/v1/auth/profile` | JWT | Cập nhật thông tin cá nhân |
| POST | `/v1/auth/avatar` | JWT | Upload ảnh đại diện (multipart/form-data) |
| PATCH | `/v1/auth/change-password` | JWT | Đổi mật khẩu (hủy session tất cả thiết bị) |
| POST | `/v1/auth/forgot-password` | Không | Yêu cầu link đặt lại mật khẩu qua email |
| POST | `/v1/auth/reset-password` | Không | Đặt lại mật khẩu bằng token từ email |

---

## TypeScript Types

```typescript
// types/auth.types.ts

export type SystemRole = 'EMPLOYEE' | 'MANAGER' | 'CHIEF' | 'HR' | 'ADMIN';

// Response sau login / refresh
export interface AuthResponse {
  accessToken: string;   // JWT ngắn hạn (mặc định 15 phút)
  token: string;         // Alias của accessToken — dùng khi client cũ không đọc được accessToken
  refreshToken: string;  // UUID dài hạn (mặc định 7 ngày), lưu DB
  user: AuthUser;
}

export interface AuthUser {
  id: number;
  fullName: string;
  email: string;
  employeeCode: string;
  role: SystemRole;
  avatarUrl: string | null;
}

// GET /me — có thêm permissions
export interface MeResponse {
  id: number;
  fullName: string;
  email: string;
  employeeCode: string;
  role: SystemRole;
  avatarUrl: string | null;
  permissions: string[];  // ví dụ: ['employee:read', 'leave:create', 'attendance:manage']
}

// PATCH /profile — PATCH /avatar
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
  identifier: string;   // email hoặc mã nhân viên (ví dụ "EMP001")
  password: string;
}

export interface UpdateProfileDto {
  fullName?: string;     // 2–100 ký tự
  email?: string;        // email hợp lệ
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

`identifier` chấp nhận cả **email** lẫn **mã nhân viên**.

**Request:**
```json
{ "identifier": "nguyen.a@company.com", "password": "Hr@123456" }
```
```json
{ "identifier": "EMP004", "password": "Hr@123456" }
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
    "token": "eyJhbGciOiJIUzI1NiJ9...",
    "refreshToken": "550e8400-e29b-41d4-a716-446655440000",
    "user": {
      "id": 4,
      "fullName": "Nguyễn Văn A",
      "email": "nguyen.a@company.com",
      "employeeCode": "EMP004",
      "role": "EMPLOYEE",
      "avatarUrl": null
    }
  }
}
```

**Lưu trữ sau login:**
```typescript
// Lưu cả hai — access token cho mọi request, refresh token để renew
localStorage.setItem('accessToken', data.accessToken);
localStorage.setItem('refreshToken', data.refreshToken);
```

**Lỗi có thể gặp:**

| HTTP | Code | Nguyên nhân |
|------|------|------------|
| 401 | `AUTH_INVALID_CREDENTIALS` | Sai mật khẩu (còn N lần thử) |
| 403 | `AUTH_ACCOUNT_LOCKED` | Sai quá 5 lần — khóa 30 phút |

> **Brute-force protection:** Sau 5 lần sai liên tiếp, tài khoản bị khóa **30 phút**. Message lỗi cho biết còn bao nhiêu lần thử.

---

## POST /v1/auth/refresh — Làm mới token

Gọi khi `accessToken` hết hạn (nhận 401 `AUTH_TOKEN_EXPIRED`). Không cần header Authorization.

**Request:**
```json
{ "refreshToken": "550e8400-e29b-41d4-a716-446655440000" }
```

**Response 200:** Giống login — `AuthResponse` mới với cặp token mới.

> Mỗi lần refresh sẽ **rotate** cả refreshToken — lưu lại giá trị mới.

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|------------|
| 401 | `AUTH_INVALID_CREDENTIALS` | refreshToken không tìm thấy trong DB |
| 401 | `AUTH_TOKEN_EXPIRED` | refreshToken đã hết hạn (mặc định 7 ngày) |

**Pattern auto-refresh trong HTTP interceptor:**
```typescript
// interceptor.ts
async function onResponseError(error: AxiosError) {
  const originalRequest = error.config!;

  if (error.response?.status === 401 && !originalRequest._retry) {
    originalRequest._retry = true;
    try {
      const { data } = await axios.post('/v1/auth/refresh', {
        refreshToken: localStorage.getItem('refreshToken'),
      });
      localStorage.setItem('accessToken', data.data.accessToken);
      localStorage.setItem('refreshToken', data.data.refreshToken);
      originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
      return axios(originalRequest);
    } catch {
      // refresh thất bại → đẩy user về trang login
      localStorage.clear();
      router.push('/login');
    }
  }
  return Promise.reject(error);
}
```

---

## POST /v1/auth/logout — Đăng xuất

Hủy refreshToken trong DB. Access token vẫn còn hạn đến khi expire tự nhiên (tối đa 15 phút).

**Request:** Không có body — chỉ cần `Authorization: Bearer <accessToken>`.

**Response: 204 No Content**

```typescript
async function logout() {
  await api.post('/v1/auth/logout');
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  router.push('/login');
}
```

---

## GET /v1/auth/me — Thông tin người dùng

Gọi một lần sau login để lấy profile đầy đủ + danh sách permissions. Dùng `permissions[]` để kiểm soát hiển thị UI.

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
    "avatarUrl": "https://bucket.s3.amazonaws.com/avatars/4.jpg",
    "permissions": ["employee:read", "leave:create", "leave:read_own", "attendance:checkin"]
  }
}
```

**Pattern dùng permissions để ẩn/hiện UI:**
```typescript
const me = await api.get('/v1/auth/me');
const can = (perm: string) => me.permissions.includes(perm);

// Trong template
if (can('leave:approve')) showApproveButton();
if (can('employee:manage')) showAdminPanel();
```

---

## PATCH /v1/auth/profile — Cập nhật thông tin cá nhân

Tất cả fields đều optional — chỉ gửi field cần thay đổi.

**Request:**
```json
{
  "fullName": "Nguyễn Văn An",
  "phone": "0901234567",
  "dateOfBirth": "1990-05-20",
  "gender": "Nam",
  "address": "123 Lê Lợi, Quận 1, TP.HCM"
}
```

**Response 200:** `ApiSuccess<ProfileResponse>`

```json
{
  "success": true,
  "data": {
    "id": 4,
    "fullName": "Nguyễn Văn An",
    "email": "nguyen.a@company.com",
    "employeeCode": "EMP004",
    "role": "EMPLOYEE",
    "phone": "0901234567",
    "dateOfBirth": "1990-05-20",
    "gender": "Nam",
    "address": "123 Lê Lợi, Quận 1, TP.HCM",
    "avatarUrl": null
  }
}
```

**Lỗi:**

| HTTP | Nguyên nhân |
|------|------------|
| 409 | `email` mới đã được dùng bởi nhân viên khác |
| 400 | `gender` không phải `'Nam'`, `'Nữ'`, hoặc `'Khác'` |

---

## POST /v1/auth/avatar — Upload ảnh đại diện

**Content-Type:** `multipart/form-data`

| Field | Type | Bắt buộc | Giới hạn |
|-------|------|----------|---------|
| `file` | File | ✓ | JPG hoặc PNG, tối đa 2MB |

**Response 201:** `ApiSuccess<ProfileResponse>` — có `avatarUrl` là S3 URL mới.

```typescript
const uploadAvatar = async (file: File) => {
  const form = new FormData();
  form.append('file', file);
  // Không set Content-Type — để browser tự set boundary
  return api.post('/v1/auth/avatar', form);
};
```

**Lỗi:**

| HTTP | Nguyên nhân |
|------|------------|
| 400 | File không phải JPG/PNG |
| 400 | File vượt quá 2MB |

---

## PATCH /v1/auth/change-password — Đổi mật khẩu

**Request:**
```json
{
  "currentPassword": "Hr@123456",
  "newPassword": "NewPass@789"
}
```

**Response: 204 No Content**

> **Quan trọng:** Sau khi đổi thành công, server **hủy toàn bộ session** (`refreshToken = null`). User phải đăng nhập lại trên tất cả thiết bị.

```typescript
const changePassword = async (dto: ChangePasswordDto) => {
  await api.patch('/v1/auth/change-password', dto);
  // Xóa token local và redirect login
  localStorage.clear();
  router.push('/login');
};
```

**Lỗi:**

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

**Response: 204 No Content** — luôn trả về 204 dù email có tồn tại hay không (bảo mật).

> **Lưu ý hiện tại:** Email reset link đang được log ra console thay vì gửi thực tế. Tính năng gửi email qua Resend sẽ được tích hợp sau. Frontend có thể implement flow này nhưng user sẽ cần liên hệ admin để lấy link.

**Reset link format:** `{FRONTEND_URL}/reset-password?token=<64-hex-chars>`

**Pattern UI:**
```typescript
// Không phân biệt "email tồn tại" hay "không tồn tại" — luôn hiện thông báo trung tính
await api.post('/v1/auth/forgot-password', { email });
showMessage('Nếu email tồn tại trong hệ thống, bạn sẽ nhận được hướng dẫn đặt lại mật khẩu.');
```

---

## POST /v1/auth/reset-password — Đặt lại mật khẩu

Dùng token nhận được từ link email (query param `?token=...`).

**Request:**
```json
{
  "token": "a3f8b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
  "newPassword": "NewPass@789"
}
```

**Response: 204 No Content**

> Sau khi reset thành công: token bị xóa + session bị hủy → user phải login lại.

**Lỗi:**

| HTTP | Code | Nguyên nhân |
|------|------|------------|
| 400 | `AUTH_INVALID_RESET_TOKEN` | Token không tồn tại trong DB |
| 400 | `AUTH_RESET_TOKEN_EXPIRED` | Token hết hạn (TTL: **1 giờ**) |

**Flow hoàn chỉnh reset password:**
```
User nhập email
    │
    ▼
POST /forgot-password → 204
    │
    ▼ (user nhận email với link)
User click link → /reset-password?token=abc123...
    │
    ▼
Frontend đọc token từ URL, hiển thị form mật khẩu mới
    │
    ▼
POST /reset-password { token, newPassword } → 204
    │
    ├─ 400 AUTH_INVALID_RESET_TOKEN → hiển thị "Link không hợp lệ"
    ├─ 400 AUTH_RESET_TOKEN_EXPIRED → hiển thị "Link đã hết hạn (1 giờ), yêu cầu link mới"
    └─ 204 → redirect sang /login với thông báo "Đặt lại thành công"
```

---

## Token lifecycle

| Token | Lưu ở | TTL | Rotate khi |
|-------|-------|-----|-----------|
| `accessToken` (JWT) | Memory / localStorage | 15 phút (env `JWT_EXPIRES_IN`) | Mỗi lần `/refresh` |
| `refreshToken` (UUID) | localStorage + DB | 7 ngày (env `REFRESH_TOKEN_EXPIRES_IN`) | Mỗi lần `/refresh` |
| Reset token (hex) | DB | 1 giờ (cố định) | Dùng một lần rồi xóa |

**Khi nào session bị hủy (refreshToken = null trong DB):**
- `POST /logout`
- `PATCH /change-password` thành công
- `POST /reset-password` thành công

---

## Composable — useAuth

```typescript
// composables/useAuth.ts
import type {
  AuthResponse,
  MeResponse,
  ProfileResponse,
  LoginDto,
  UpdateProfileDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  ResetPasswordDto,
} from '~/types/auth.types';

export function useAuth() {
  const login = (dto: LoginDto) =>
    api.post<AuthResponse>('/v1/auth/login', dto);

  const refresh = (refreshToken: string) =>
    api.post<AuthResponse>('/v1/auth/refresh', { refreshToken });

  const logout = () =>
    api.post<void>('/v1/auth/logout');

  const me = () =>
    api.get<MeResponse>('/v1/auth/me');

  const updateProfile = (dto: UpdateProfileDto) =>
    api.patch<ProfileResponse>('/v1/auth/profile', dto);

  const uploadAvatar = (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<ProfileResponse>('/v1/auth/avatar', form);
  };

  const changePassword = (dto: ChangePasswordDto) =>
    api.patch<void>('/v1/auth/change-password', dto);

  const forgotPassword = (dto: ForgotPasswordDto) =>
    api.post<void>('/v1/auth/forgot-password', dto);

  const resetPassword = (dto: ResetPasswordDto) =>
    api.post<void>('/v1/auth/reset-password', dto);

  return {
    login, refresh, logout, me,
    updateProfile, uploadAvatar,
    changePassword, forgotPassword, resetPassword,
  };
}
```

---

## Edge Cases

| Tình huống | Kết quả |
|-----------|---------|
| `identifier` là email viết hoa | Server trim + lowercase trước khi tìm — không lỗi |
| `identifier` là mã NV không tồn tại | 401 `AUTH_INVALID_CREDENTIALS` |
| Login khi tài khoản INACTIVE | 403 `AUTH_ACCOUNT_LOCKED` |
| Login khi đang bị lock (< 30 phút) | 403 `AUTH_ACCOUNT_LOCKED` |
| Login đúng sau khi bị lock hết thời gian | Cho phép, reset `failedAttempts = 0` |
| `POST /refresh` với token đã dùng (cũ) | 401 — DB không còn token cũ sau khi rotate |
| `PATCH /change-password` đúng → gọi API khác ngay | 401 — session đã bị hủy, cần login lại |
| `POST /forgot-password` với email không tồn tại | 204 — không tiết lộ email có trong DB hay không |
| `POST /forgot-password` với tài khoản INACTIVE | 204 — silent, không gửi email |
| `POST /reset-password` dùng token lần 2 | 400 `AUTH_INVALID_RESET_TOKEN` — đã xóa sau lần dùng đầu |
| `POST /reset-password` sau 1 giờ | 400 `AUTH_RESET_TOKEN_EXPIRED` |
| Upload avatar không phải JPG/PNG | 400 |
| Upload avatar > 2MB | 400 |
| `PATCH /profile` không truyền field nào | 200 — không thay đổi gì, trả về profile hiện tại |
| `PATCH /profile` đổi email thành email của người khác | 409 Conflict |
