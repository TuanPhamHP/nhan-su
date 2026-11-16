# Bridge Docs — Thông tin cá nhân (`/v1/auth/profile`, `/v1/auth/avatar`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

---

## Endpoints

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| PATCH | `/v1/auth/profile` | Mọi user đã đăng nhập | Cập nhật thông tin cá nhân của chính mình |
| POST | `/v1/auth/avatar` | Mọi user đã đăng nhập | Upload ảnh đại diện (`multipart/form-data`) |

> Hai endpoint này chỉ tác động lên **chính người đang đăng nhập** — lấy identity từ JWT, không nhận `id` từ URL.

> **Lô 3a (16/11/2026) đổi hành vi `PATCH /v1/auth/profile`:** chỉ **số điện thoại** và **địa chỉ** còn ghi ngay. **Họ tên,
> email công việc, ngày sinh, giới tính** khác giá trị hiện tại thì server **tạo yêu cầu thay đổi** mục `BASIC` cho HR duyệt; hồ sơ
> trả về vẫn là giá trị cũ và response có `pendingChangeRequestId`. Giá trị giống hiện tại thì bỏ qua, nên app gửi cả form vẫn
> đúng. Endpoint giữ nguyên để app cũ không vỡ; màn hình mới nên dùng `/v1/me/profile/contact` và
> `/v1/me/profile-change-requests` ([hr-profile.md](./hr-profile.md) mục 6, 7).

---

## TypeScript Types

```typescript
// types/auth.types.ts

export type Gender = 'Nam' | 'Nữ' | 'Khác';
export type GenderCode = 'MALE' | 'FEMALE' | 'OTHER';

// Response của cả PATCH /profile và POST /avatar
export interface ProfileResponse {
  id: number;
  fullName: string;
  email: string;
  employeeCode: string;       // read-only, không thể thay đổi qua endpoint này
  role: string;               // read-only, không thể thay đổi qua endpoint này
  phone: string | null;
  dateOfBirth: string | null; // "YYYY-MM-DD" — chỉ ngày, không có giờ
  gender: Gender | null;      // nhãn như trước lô 3a
  genderCode: GenderCode | null; // lô 3a
  address: string | null;
  avatarUrl: string | null;   // Presigned S3 URL, hiệu lực 1 giờ — dùng trực tiếp trong <img>
  pendingChangeRequestId?: number | null; // chỉ ở PATCH /profile: id yêu cầu BASIC vừa tạo, null nếu không tạo
}

// Body của PATCH /profile — tất cả fields đều optional
export interface UpdateProfilePayload {
  fullName?: string;    // min 2, max 100 ký tự → tạo yêu cầu thay đổi
  email?: string;       // email công việc → tạo yêu cầu thay đổi
  phone?: string;       // ghi ngay
  dateOfBirth?: string; // "YYYY-MM-DD" → tạo yêu cầu thay đổi
  gender?: Gender | GenderCode; // nhận cả nhãn và mã → tạo yêu cầu thay đổi
  address?: string;     // ghi ngay
}
```

---

## PATCH /v1/auth/profile — Cập nhật thông tin cá nhân

Tất cả fields đều **optional**. `phone`, `address` ghi ngay. `fullName`, `email`, `dateOfBirth`, `gender` khác giá trị hiện tại
thì gom thành **một** yêu cầu thay đổi mục `BASIC` (yêu cầu BASIC đang chờ trước đó tự huỷ); response vẫn trả giá trị cũ cho các
trường này kèm `pendingChangeRequestId`. FE hiện thông báo "Đã gửi yêu cầu thay đổi, chờ phòng nhân sự duyệt" khi có id này.

**Request body:**

```json
{
  "fullName": "Nguyễn Văn B",
  "email": "nguyen.b@company.com",
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
    "fullName": "Nguyễn Văn A",
    "email": "nguyen.a@company.com",
    "employeeCode": "EMP004",
    "role": "EMPLOYEE",
    "phone": "0901234567",
    "dateOfBirth": "1990-05-20",
    "gender": "Nam",
    "genderCode": "MALE",
    "address": "123 Lê Lợi, Quận 1, TP.HCM",
    "avatarUrl": null,
    "pendingChangeRequestId": 15
  }
}
```

Ví dụ trên: họ tên và email trong response vẫn là giá trị cũ vì đang chờ duyệt (yêu cầu số 15); số điện thoại, địa chỉ đã đổi.

**Ví dụ — chỉ đổi số điện thoại:**

```typescript
await $fetch('/v1/auth/profile', {
  method: 'PATCH',
  body: { phone: '0909999888' },
});
```

**Ví dụ — đổi email:**

```typescript
await $fetch('/v1/auth/profile', {
  method: 'PATCH',
  body: { email: 'new.email@company.com' },
});
// Lô 3a: không lưu ngay, tạo yêu cầu thay đổi (data.pendingChangeRequestId). Email đã dùng cho người khác → 409 ngay lúc gửi.
```

---

## POST /v1/auth/avatar — Upload ảnh đại diện

**Content-Type:** `multipart/form-data`

**Form fields:**

| Field | Type | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| `file` | `File` | ✅ | JPG hoặc PNG — tối đa 2MB |

**Ví dụ (browser FormData):**

```typescript
const formData = new FormData();
formData.append('file', selectedFile);

const { data } = await $fetch('/v1/auth/avatar', {
  method: 'POST',
  body: formData,
  // KHÔNG set Content-Type — để browser tự set boundary
});

console.log(data.avatarUrl); // URL S3 public, dùng trực tiếp để hiển thị
```

**Response 201:** `ApiSuccess<ProfileResponse>`

```json
{
  "success": true,
  "data": {
    "id": 4,
    "fullName": "Nguyễn Văn B",
    "email": "nguyen.b@company.com",
    "employeeCode": "EMP004",
    "role": "EMPLOYEE",
    "phone": "0901234567",
    "dateOfBirth": "1990-05-20",
    "gender": "Nam",
    "address": "123 Lê Lợi, Quận 1, TP.HCM",
    "avatarUrl": "https://hr-documents.s3.ap-southeast-1.amazonaws.com/avatars/4/uuid.jpg"
  }
}
```

> `avatarUrl` trong response là **presigned URL** (hiệu lực 1 giờ) — dùng trực tiếp trong `<img :src="avatarUrl">`.  
> Không cache URL này lâu hơn 1 giờ. Gọi lại `GET /auth/me` hoặc `PATCH /auth/profile` để lấy URL mới.  
> Mỗi lần upload sẽ tạo một file mới trên S3 — file cũ không tự xóa.

---

## Composable — useProfile

```typescript
// composables/useProfile.ts
import type { ProfileResponse, UpdateProfilePayload } from '~/types/auth.types';

export function useProfile() {
  const updateProfile = (payload: UpdateProfilePayload) =>
    $fetch<{ success: boolean; data: ProfileResponse }>('/v1/auth/profile', {
      method: 'PATCH',
      body: payload,
    });

  const uploadAvatar = (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return $fetch<{ success: boolean; data: ProfileResponse }>('/v1/auth/avatar', {
      method: 'POST',
      body: formData,
    });
  };

  return { updateProfile, uploadAvatar };
}
```

---

## Edge cases

| Tình huống | HTTP | `error.code` | Ghi chú |
|-----------|------|-------------|---------|
| `email` đổi sang email đã tồn tại | 409 | `EMPLOYEE_EMAIL_EXISTS` | Kiểm tra lúc tạo yêu cầu, và lại lúc HR duyệt |
| `gender` không phải `Nam`, `Nữ`, `Khác`, `MALE`, `FEMALE`, `OTHER` | 400 | — | "Giới tính phải là Nam, Nữ hoặc Khác" |
| Đổi họ tên (lô 3a) | 200 | — | Họ tên chưa đổi, có `pendingChangeRequestId`; HR duyệt thì người gửi nhận N-02 |
| Gửi cả form với họ tên, ngày sinh, giới tính như cũ | 200 | — | `pendingChangeRequestId: null`, không tạo yêu cầu |
| `dateOfBirth` sai format (không phải ISO 8601) | 400 | — | Phải là `"YYYY-MM-DD"` |
| `fullName` < 2 hoặc > 100 ký tự | 400 | — | Validation ở DTO |
| Upload file không phải JPG/PNG | 400 | — | `"Chỉ chấp nhận ảnh JPG hoặc PNG"` |
| Upload file > 2MB | 400 | — | `"Ảnh không được vượt quá 2MB"` |
| Gọi mà không có trường `file` | 400 | — | Multer không nhận được file |
| Không gửi kèm JWT | 401 | — | Cả hai endpoint đều yêu cầu auth |
| Body rỗng `{}` khi PATCH /profile | 200 | — | Hợp lệ — không có gì thay đổi |
