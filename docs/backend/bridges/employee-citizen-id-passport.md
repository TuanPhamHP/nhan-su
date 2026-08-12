# Bridge Docs — CCCD & Hộ chiếu nhân viên (`/v1/employees/:employeeId/citizen-id` & `/passport`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong `{ success, data }`.

Feature này gồm 2 sub-resource độc lập cùng gắn với 1 nhân viên:

- **CCCD** — bắt buộc cho mọi nhân viên (nhưng có thể tạo sau khi tạo nhân viên).
- **Hộ chiếu** — tuỳ chọn, có thể có hoặc không.

Cả 2 resource đều tách thành controller riêng, không nằm trong endpoint `/v1/employees` gốc.

---

## Endpoints

### CCCD

| Method | Path | Permission | Ghi chú |
|--------|------|-----------|---------|
| GET | `/v1/employees/:employeeId/citizen-id` | Chính chủ **hoặc** `employee:citizen-id:read` | Trả `null` nếu chưa có |
| POST | `/v1/employees/:employeeId/citizen-id` | `employee:citizen-id:create` | 409 nếu đã có |
| PATCH | `/v1/employees/:employeeId/citizen-id` | `employee:citizen-id:update` | Cho update số CCCD |
| DELETE | `/v1/employees/:employeeId/citizen-id` | `employee:citizen-id:delete` | Xoá bản ghi + ảnh |
| POST | `/v1/employees/:employeeId/citizen-id/photos` | `employee:citizen-id:update` | `multipart` — cả 2 ảnh bắt buộc |
| GET | `/v1/employees/:employeeId/citizen-id/history` | Chính chủ **hoặc** `employee:citizen-id:read` | Lịch sử thay đổi |

### Hộ chiếu

| Method | Path | Permission | Ghi chú |
|--------|------|-----------|---------|
| GET | `/v1/employees/:employeeId/passport` | Chính chủ **hoặc** `employee:passport:read` | Trả `null` nếu chưa có |
| POST | `/v1/employees/:employeeId/passport` | `employee:passport:create` | 409 nếu đã có |
| PATCH | `/v1/employees/:employeeId/passport` | `employee:passport:update` | |
| DELETE | `/v1/employees/:employeeId/passport` | `employee:passport:delete` | |
| POST | `/v1/employees/:employeeId/passport/photos/:side` | `employee:passport:update` | `side = front \| back`, upload từng ảnh |
| DELETE | `/v1/employees/:employeeId/passport/photos/:side` | `employee:passport:update` | Xoá 1 ảnh |

### Meta-data

| Method | Path | Ai được gọi | Ghi chú |
|--------|------|-------------|---------|
| GET | `/v1/meta-data/passport-types` | Mọi user đã đăng nhập | Danh sách loại hộ chiếu để đổ dropdown |

---

## Rule "chính chủ" vs Permission

- **GET** (read): nếu `user.id === :employeeId` → luôn được xem của mình. Người khác phải có permission `employee:citizen-id:read` hoặc `employee:passport:read`.
- **POST / PATCH / DELETE**: **luôn** cần permission tương ứng, kể cả chính chủ. Điều này giúp HR kiểm soát dữ liệu định danh, tránh nhân viên tự sửa số CCCD sai lệch với giấy tờ thật.
- Role `ADMIN` bypass mọi permission (theo mô hình auth hiện có). `HR` được seed sẵn cả 8 permission `employee:citizen-id:*` + `employee:passport:*`.

---

## TypeScript Types

```typescript
// types/employee-citizen-id.types.ts

export interface CitizenIdResponse {
  id: number;
  employeeId: number;
  citizenIdNumber: string;              // đúng 12 chữ số
  fullNameOnCard: string | null;
  issuedDate: string;                    // 'YYYY-MM-DD' (date-only, không có time)
  issuedPlace: string | null;
  hometown: string | null;
  permanentAddress: string | null;
  temporaryAddress: string | null;
  currentAddress: string | null;
  frontPhotoUrl: string | null;          // presigned URL, TTL 1h — render trực tiếp
  backPhotoUrl: string | null;           // presigned URL, TTL 1h
  createdAt: string;                     // ISO 8601 full datetime
  updatedAt: string;
}

export interface CreateCitizenIdPayload {
  citizenIdNumber: string;              // BẮT BUỘC — đúng 12 chữ số, chỉ 0-9
  fullNameOnCard?: string;              // ≤ 100 ký tự
  issuedDate: string;                    // BẮT BUỘC — 'YYYY-MM-DD'
  issuedPlace?: string;                  // nếu có → 10–255 ký tự
  hometown?: string;                     // ≤ 255
  permanentAddress?: string;
  temporaryAddress?: string;
  currentAddress?: string;
}

export type UpdateCitizenIdPayload = Partial<CreateCitizenIdPayload>;
```

```typescript
// types/employee-passport.types.ts

export type PassportType = 'ORDINARY' | 'DIPLOMATIC' | 'OFFICIAL';

export interface PassportResponse {
  id: number;
  employeeId: number;
  passportNumber: string;                // A-Z + 0-9, ≤ 20 ký tự
  fullNameOnPassport: string;
  passportType: PassportType;
  issuedDate: string;                    // 'YYYY-MM-DD'
  expiryDate: string;                    // 'YYYY-MM-DD'
  photoFrontUrl: string | null;          // presigned URL, TTL 1h
  photoBackUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePassportPayload {
  passportNumber: string;                // /^[A-Z0-9]{1,20}$/
  fullNameOnPassport: string;            // 2–100 ký tự
  passportType: PassportType;
  issuedDate: string;                    // 'YYYY-MM-DD'
  expiryDate: string;                    // 'YYYY-MM-DD' — phải > issuedDate
}

export type UpdatePassportPayload = Partial<CreatePassportPayload>;

export interface PassportTypeMetaItem {
  value: PassportType;                   // 'ORDINARY' | 'DIPLOMATIC' | 'OFFICIAL'
  label: string;                          // 'Phổ thông' | 'Ngoại giao' | 'Công vụ'
}
```

---

## Validation rules (client-side nên implement match server)

### CCCD

| Field | Rule |
|-------|------|
| `citizenIdNumber` | Regex `/^\d{12}$/`. Server unique toàn hệ thống |
| `fullNameOnCard` | ≤ 100 ký tự |
| `issuedDate` | `YYYY-MM-DD` hợp lệ |
| `issuedPlace` | Nếu nhập → 10–255 ký tự |
| Các address | ≤ 255 (hometown), text (còn lại) |

### Hộ chiếu

| Field | Rule |
|-------|------|
| `passportNumber` | Regex `/^[A-Z0-9]{1,20}$/` — chỉ chữ HOA A–Z và số 0–9, tối đa 20 ký tự, không khoảng trắng. **Client nên auto-uppercase khi user nhập.** Server unique toàn hệ thống |
| `fullNameOnPassport` | 2–100 ký tự |
| `passportType` | 1 trong 3 enum |
| `issuedDate`, `expiryDate` | `YYYY-MM-DD`. `expiryDate` phải > `issuedDate` (server kiểm tra) |

### Ảnh CCCD & Hộ chiếu

| Rule | CCCD | Hộ chiếu |
|------|------|----------|
| Mime | JPG, PNG, WebP | JPG, PNG, WebP |
| Size max | 5MB/ảnh | 5MB/ảnh |
| Số ảnh | **Bắt buộc cả 2 (front + back)** trong 1 request | Upload từng ảnh, 0-1-2 tuỳ ý |
| URL trả về | Presigned S3, TTL 1h | Presigned S3, TTL 1h |

---

## GET `/v1/employees/:employeeId/citizen-id`

**Response:** `ApiSuccess<CitizenIdResponse | null>`

Nếu nhân viên chưa có CCCD → `data: null` (KHÔNG phải 404):

```json
{ "success": true, "data": null }
```

Nếu có:

```json
{
  "success": true,
  "data": {
    "id": 12,
    "employeeId": 5,
    "citizenIdNumber": "012345678901",
    "fullNameOnCard": "NGUYỄN VĂN A",
    "issuedDate": "2021-05-20",
    "issuedPlace": "Cục Cảnh sát QLHC về TTXH",
    "hometown": "Xã X, Huyện Y, Tỉnh Z",
    "permanentAddress": "Số 1 đường A, Q1, TP.HCM",
    "temporaryAddress": null,
    "currentAddress": null,
    "frontPhotoUrl": "https://bucket.s3.amazonaws.com/employees/5/citizen-id/front-uuid.jpg?X-Amz-...",
    "backPhotoUrl": "https://bucket.s3.amazonaws.com/employees/5/citizen-id/back-uuid.jpg?X-Amz-...",
    "createdAt": "2026-08-12T02:58:47.000Z",
    "updatedAt": "2026-08-12T02:58:47.000Z"
  }
}
```

**403** nếu không phải chính chủ và không có `employee:citizen-id:read`:
```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Không đủ quyền xem CCCD của nhân viên khác" } }
```

**404** nếu `employeeId` không tồn tại.

---

## POST `/v1/employees/:employeeId/citizen-id`

**Body:** `CreateCitizenIdPayload`

```json
{
  "citizenIdNumber": "012345678901",
  "fullNameOnCard": "NGUYỄN VĂN A",
  "issuedDate": "2021-05-20",
  "issuedPlace": "Cục Cảnh sát QLHC về TTXH",
  "hometown": "Xã X, Huyện Y",
  "permanentAddress": "Số 1 đường A, Q1, TP.HCM"
}
```

**Response 201:** `ApiSuccess<CitizenIdResponse>` (photo fields = null).

**Errors:**

| HTTP | Message | Khi nào |
|------|---------|---------|
| 400 | `"Số CCCD phải đúng 12 chữ số"` | Regex fail |
| 400 | `"Nơi cấp CCCD phải có tối thiểu 10 ký tự"` | Nhập `issuedPlace` < 10 ký tự |
| 400 | `"Ngày cấp CCCD không hợp lệ"` | Sai format ISO |
| 409 | `"Nhân viên đã có thông tin CCCD, hãy dùng cập nhật"` | Đã có bản ghi |
| 409 | `"Số CCCD đã tồn tại trong hệ thống"` | Trùng với nhân viên khác |
| 404 | `"Nhân viên không tồn tại"` | Sai `employeeId` |

---

## PATCH `/v1/employees/:employeeId/citizen-id`

Cho phép update **tất cả field**, bao gồm `citizenIdNumber`. Mỗi lần update sẽ tự động ghi vào lịch sử (xem endpoint `/history`).

**Body:** `UpdateCitizenIdPayload` — chỉ gửi field cần đổi.

```json
{ "currentAddress": "Địa chỉ mới" }
```

**Response 200:** `ApiSuccess<CitizenIdResponse>`.

**404** nếu chưa có CCCD → `"Nhân viên chưa có thông tin CCCD"`.
**409** nếu đổi `citizenIdNumber` trùng nhân viên khác.

---

## DELETE `/v1/employees/:employeeId/citizen-id`

**Response: 204 No Content**.

Xoá bản ghi. File ảnh trên S3 hiện tại KHÔNG được xoá (S3 provider chưa expose `delete()`) — đây là limitation đã biết, sẽ xử lý khi migrate sang private local storage.

---

## POST `/v1/employees/:employeeId/citizen-id/photos`

**Content-Type:** `multipart/form-data`

**Form fields — BẮT BUỘC cả 2:**

| Field | Type | Ghi chú |
|-------|------|---------|
| `front` | `File` | Ảnh mặt trước — JPG/PNG/WebP, ≤ 5MB |
| `back` | `File` | Ảnh mặt sau — JPG/PNG/WebP, ≤ 5MB |

Nếu thiếu 1 trong 2 → **400** `"Phải upload đủ cả ảnh mặt trước và mặt sau CCCD"`.

**Ví dụ (browser FormData):**

```typescript
const formData = new FormData();
formData.append('front', frontFile);
formData.append('back', backFile);

await $fetch(`/v1/employees/${employeeId}/citizen-id/photos`, {
  method: 'POST',
  body: formData,
});
```

**Response 201:** `ApiSuccess<CitizenIdResponse>` với `frontPhotoUrl` + `backPhotoUrl` đã sign.

**Errors:**

| HTTP | Message |
|------|---------|
| 400 | `"Phải upload đủ cả ảnh mặt trước và mặt sau CCCD"` |
| 400 | `"Chỉ chấp nhận ảnh JPG, PNG hoặc WebP"` |
| 400 | `"Ảnh không được vượt quá 5MB"` |
| 404 | `"Nhân viên chưa có thông tin CCCD"` — phải tạo bản ghi text trước, sau đó mới upload ảnh |

> **Photo re-upload:** Gọi endpoint này lần nữa → thay thế cả 2 ảnh. Không có endpoint xoá riêng 1 ảnh CCCD.

---

## GET `/v1/employees/:employeeId/citizen-id/history`

Trả về danh sách log các thay đổi CCCD của nhân viên: `create`, `update`, `upload_photos`, `delete`.

**Query params:**

| Param | Default | Range |
|-------|---------|-------|
| `page` | 1 | ≥ 1 |
| `limit` | 20 | 1–100 |

**Response:** `ApiSuccess<SystemLogDto[]>` + `meta` phân trang.

```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "createdAt": "2026-08-12T09:15:22.000Z",
      "actor": {
        "type": "USER",
        "id": 2,
        "name": "Trần Thị HR",
        "email": "hr@company.com",
        "role": "HR"
      },
      "action": "employee.citizen_id.update",
      "targetType": "employee_citizen_id",
      "targetId": 12,
      "payload": {
        "employeeId": 5,
        "before": { "currentAddress": "Địa chỉ cũ" },
        "after": { "currentAddress": "Địa chỉ mới" }
      },
      "status": "SUCCESS",
      "errorMessage": null
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 }
}
```

**Ghi chú:**
- `payload.before/after` chỉ chứa **các field bị đổi** trong lần update đó (diff), không phải snapshot full.
- Với action `create`: `before = null`, `after = full record`.
- Với action `delete`: `before = full record`, `after = null`.
- Với action `upload_photos`: `before/after` chỉ chứa `frontPhotoUrl` + `backPhotoUrl` (URL S3 gốc, không sign — chỉ để trace).
- Nếu nhân viên chưa có CCCD → trả `data: []` với `total: 0`, không 404.

---

## GET `/v1/employees/:employeeId/passport`

Shape giống CCCD — `null` nếu chưa có, `PassportResponse` nếu có.

```json
{
  "success": true,
  "data": {
    "id": 7,
    "employeeId": 5,
    "passportNumber": "B1234567",
    "fullNameOnPassport": "NGUYEN VAN A",
    "passportType": "ORDINARY",
    "issuedDate": "2022-06-15",
    "expiryDate": "2032-06-15",
    "photoFrontUrl": "https://bucket.s3.amazonaws.com/employees/5/passport/front-uuid.jpg?X-Amz-...",
    "photoBackUrl": null,
    "createdAt": "2026-08-12T02:58:47.000Z",
    "updatedAt": "2026-08-12T02:58:47.000Z"
  }
}
```

---

## POST `/v1/employees/:employeeId/passport`

**Body:** `CreatePassportPayload` — cả 5 field đều bắt buộc.

```json
{
  "passportNumber": "B1234567",
  "fullNameOnPassport": "NGUYEN VAN A",
  "passportType": "ORDINARY",
  "issuedDate": "2022-06-15",
  "expiryDate": "2032-06-15"
}
```

**Errors:**

| HTTP | Message |
|------|---------|
| 400 | `"Số hộ chiếu chỉ chứa chữ cái A-Z và số 0-9, tối đa 20 ký tự, không khoảng trắng"` |
| 400 | `"Ngày hết hạn hộ chiếu phải sau ngày cấp"` |
| 400 | `"Loại hộ chiếu không hợp lệ"` |
| 409 | `"Nhân viên đã có thông tin hộ chiếu, hãy dùng cập nhật"` |
| 409 | `"Số hộ chiếu đã tồn tại trong hệ thống"` |

---

## PATCH `/v1/employees/:employeeId/passport`

`UpdatePassportPayload` — partial.

Nếu đổi `issuedDate` hoặc `expiryDate`, server sẽ recompute rule `expiry > issued` từ giá trị cuối cùng (gộp giá trị mới với giá trị cũ nếu chỉ đổi 1 trong 2).

---

## POST `/v1/employees/:employeeId/passport/photos/:side`

Upload 1 ảnh hộ chiếu. Khác CCCD ở chỗ: từng ảnh upload riêng, không bắt buộc đủ cả 2 mặt.

**Path param:**
- `:side` = `"front"` hoặc `"back"` — bất cứ giá trị khác → 400 `"side phải là 'front' hoặc 'back'"`.

**Content-Type:** `multipart/form-data`

**Form field:**

| Field | Type | Ghi chú |
|-------|------|---------|
| `file` | `File` | JPG/PNG/WebP, ≤ 5MB |

**Response 201:** `ApiSuccess<PassportResponse>` với `photoFrontUrl` hoặc `photoBackUrl` đã cập nhật.

Upload lần 2 vào cùng `side` → thay thế ảnh cũ.

---

## DELETE `/v1/employees/:employeeId/passport/photos/:side`

Xoá 1 ảnh (set field về `null` trong DB).

**Response 200:** `ApiSuccess<PassportResponse>`.

---

## GET `/v1/meta-data/passport-types`

Dùng để đổ dropdown "Loại hộ chiếu".

**Response:** `ApiSuccess<PassportTypeMetaItem[]>`

```json
{
  "success": true,
  "data": [
    { "value": "ORDINARY", "label": "Phổ thông" },
    { "value": "DIPLOMATIC", "label": "Ngoại giao" },
    { "value": "OFFICIAL", "label": "Công vụ" }
  ]
}
```

---

## Composable — useEmployeeIdentity

```typescript
// composables/useEmployeeIdentity.ts
import type {
  CitizenIdResponse,
  CreateCitizenIdPayload,
  UpdateCitizenIdPayload,
} from '~/types/employee-citizen-id.types';
import type {
  PassportResponse,
  CreatePassportPayload,
  UpdatePassportPayload,
  PassportTypeMetaItem,
} from '~/types/employee-passport.types';

export function useEmployeeIdentity() {
  const { get, post, patch, del } = useFetch();

  // ── CCCD ────────────────────────────────────────────────
  const fetchCitizenId = (employeeId: number) =>
    get<CitizenIdResponse | null>(`/v1/employees/${employeeId}/citizen-id`);

  const createCitizenId = (employeeId: number, payload: CreateCitizenIdPayload) =>
    post<CitizenIdResponse>(`/v1/employees/${employeeId}/citizen-id`, payload);

  const updateCitizenId = (employeeId: number, payload: UpdateCitizenIdPayload) =>
    patch<CitizenIdResponse>(`/v1/employees/${employeeId}/citizen-id`, payload);

  const deleteCitizenId = (employeeId: number) =>
    del(`/v1/employees/${employeeId}/citizen-id`);

  const uploadCitizenIdPhotos = (employeeId: number, front: File, back: File) => {
    const fd = new FormData();
    fd.append('front', front);
    fd.append('back', back);
    return post<CitizenIdResponse>(
      `/v1/employees/${employeeId}/citizen-id/photos`,
      fd,
    );
  };

  const fetchCitizenIdHistory = (
    employeeId: number,
    params: { page?: number; limit?: number } = {},
  ) =>
    get(`/v1/employees/${employeeId}/citizen-id/history`, { query: params });

  // ── Passport ─────────────────────────────────────────────
  const fetchPassport = (employeeId: number) =>
    get<PassportResponse | null>(`/v1/employees/${employeeId}/passport`);

  const createPassport = (employeeId: number, payload: CreatePassportPayload) =>
    post<PassportResponse>(`/v1/employees/${employeeId}/passport`, payload);

  const updatePassport = (employeeId: number, payload: UpdatePassportPayload) =>
    patch<PassportResponse>(`/v1/employees/${employeeId}/passport`, payload);

  const deletePassport = (employeeId: number) =>
    del(`/v1/employees/${employeeId}/passport`);

  const uploadPassportPhoto = (
    employeeId: number,
    side: 'front' | 'back',
    file: File,
  ) => {
    const fd = new FormData();
    fd.append('file', file);
    return post<PassportResponse>(
      `/v1/employees/${employeeId}/passport/photos/${side}`,
      fd,
    );
  };

  const deletePassportPhoto = (employeeId: number, side: 'front' | 'back') =>
    del<PassportResponse>(`/v1/employees/${employeeId}/passport/photos/${side}`);

  // ── Meta-data ────────────────────────────────────────────
  const fetchPassportTypes = () =>
    get<PassportTypeMetaItem[]>('/v1/meta-data/passport-types');

  return {
    // CCCD
    fetchCitizenId,
    createCitizenId,
    updateCitizenId,
    deleteCitizenId,
    uploadCitizenIdPhotos,
    fetchCitizenIdHistory,
    // Passport
    fetchPassport,
    createPassport,
    updatePassport,
    deletePassport,
    uploadPassportPhoto,
    deletePassportPhoto,
    // Meta
    fetchPassportTypes,
  };
}
```

---

## UX Recommendations (client-side)

### CCCD

- **Input số CCCD:** dùng `inputmode="numeric"`, filter chỉ chữ số khi paste, hiển thị counter `x/12`. Cảnh báo real-time khi < 12 hoặc chứa non-digit.
- **Upload ảnh:** show 2 slot cố định (mặt trước + mặt sau). Disable nút Submit đến khi cả 2 slot có file. Trước khi submit, preview 2 ảnh cạnh nhau để user check.
- **Update:** khi user đổi `citizenIdNumber`, hiện confirm dialog cảnh báo *"Đổi số CCCD sẽ ghi vào lịch sử. Chắc chắn?"*. Sau khi update thành công, gợi ý user upload lại ảnh mới.
- **History:** render as timeline, mỗi entry hiện actor + timestamp + list các field đã đổi (before → after). Với action `upload_photos` chỉ hiển thị "Đã cập nhật ảnh CCCD" (không hiển thị URL S3 trong log — user không xem được URL vì URL gốc chưa sign).

### Hộ chiếu

- **Input số hộ chiếu:** auto-uppercase khi user gõ (`.toUpperCase()` trong `onInput`). Regex validate live.
- **Date range:** dùng 2 date picker liền nhau (Ngày cấp | Ngày hết hạn). Ngày hết hạn `min = issuedDate + 1 day`.
- **Warning gần hết hạn:** khi hiển thị hộ chiếu trong profile, nếu `expiryDate` cách ngày hiện tại < 6 tháng → hiện badge màu cam "Sắp hết hạn".
- **Upload ảnh:** không bắt buộc đủ 2 ảnh. Cho phép upload/xoá từng ảnh độc lập. UI 2 slot có nút "Thêm ảnh" / "Xoá ảnh" riêng.

### Photo TTL 1h — cần refresh

`frontPhotoUrl` / `backPhotoUrl` / `photoFrontUrl` / `photoBackUrl` là **presigned S3 URL với TTL 1 giờ**. Nếu user mở form và giữ tab > 1h, ảnh sẽ bị 403.

**Cách xử lý:**
- Cách 1 (đơn giản): re-fetch endpoint GET mỗi khi user vào lại tab/route → luôn có URL mới.
- Cách 2 (tối ưu): cache metadata + timestamp fetch, auto re-fetch nếu `Date.now() - fetchedAt > 55 * 60 * 1000`.

---

## Edge cases

| Tình huống | HTTP | Ghi chú |
|-----------|------|---------|
| Xem CCCD chính mình khi chưa có | 200 | `data: null` — KHÔNG phải 404 |
| Xem CCCD người khác mà không có permission | 403 | `"Không đủ quyền xem CCCD của nhân viên khác"` |
| Số CCCD nhập chỉ 11 chữ số | 400 | `"Số CCCD phải đúng 12 chữ số"` |
| Số CCCD nhập có ký tự chữ | 400 | Cùng message trên (regex 1 lần fail cho cả 2 case) |
| Nơi cấp CCCD nhập chỉ 5 ký tự | 400 | `"Nơi cấp CCCD phải có tối thiểu 10 ký tự"` |
| Số CCCD trùng với nhân viên khác | 409 | `"Số CCCD đã tồn tại trong hệ thống"` |
| Tạo CCCD khi đã có | 409 | `"Nhân viên đã có thông tin CCCD, hãy dùng cập nhật"` |
| Upload chỉ 1 ảnh CCCD (thiếu `back`) | 400 | `"Phải upload đủ cả ảnh mặt trước và mặt sau CCCD"` |
| Ảnh > 5MB | 400 | `"Ảnh không được vượt quá 5MB"` |
| Ảnh format `.gif` | 400 | `"Chỉ chấp nhận ảnh JPG, PNG hoặc WebP"` |
| Upload ảnh CCCD khi chưa có bản ghi CCCD | 404 | `"Nhân viên chưa có thông tin CCCD"` |
| Số hộ chiếu có khoảng trắng "B 12345" | 400 | `"Số hộ chiếu chỉ chứa chữ cái A-Z và số 0-9..."` |
| Số hộ chiếu chữ thường "b1234567" | 400 | Cùng message trên — client nên auto-uppercase |
| Ngày hết hạn hộ chiếu = ngày cấp | 400 | `"Ngày hết hạn hộ chiếu phải sau ngày cấp"` |
| Ngày hết hạn < ngày cấp | 400 | Cùng message |
| `side` param không phải `front`/`back` | 400 | `"side phải là 'front' hoặc 'back'"` |
| Ảnh presigned URL sau 1h | 403 từ S3 | Gọi lại endpoint GET để lấy URL mới |
| Xoá CCCD/Passport | 204 | Ảnh trên S3 KHÔNG bị xoá (orphan, chưa có storage.delete) |

---

## Ghi chú vận hành

- **Permissions seed:** sau khi deploy, chạy `npm run db:seed:permissions` để đảm bảo 8 permission mới (`employee:citizen-id:*` + `employee:passport:*`) được tạo và gán vào role `HR`.
- **Migration:** `20260812025847_add_employee_citizen_id_and_passport` — tạo 2 bảng `employee_citizen_ids` + `employee_passports` với unique index trên `citizenIdNumber` / `passportNumber` (case-sensitive).
- **Log actions:** `employee.citizen_id.{create,update,upload_photos,delete}` và `employee.passport.{create,update,upload_photo,delete_photo,delete}` — có thể grep trong `SystemLog` để audit.
- **Số CCCD/Passport trong logs:** lưu full, KHÔNG mask (theo yêu cầu HR để audit).
