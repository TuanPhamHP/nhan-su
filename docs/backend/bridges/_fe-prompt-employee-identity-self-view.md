# FE Agent Prompt — Card "Thông tin định danh" ở Hồ sơ cá nhân, có cửa mật khẩu

## Context

BE vừa thêm `POST /v1/employees/me/identity` để nhân viên **tự xem CCCD + hộ chiếu của
mình**, bắt buộc nhập lại mật khẩu mỗi lần xem. Đây là bản sao đúng mô hình đã làm cho
BHXH (`POST /v1/social-insurance/me`) — nếu bạn đã làm card BHXH ở `/profile` thì việc này
là nhân bản, không có khái niệm mới.

Đồng thời **3 route đọc cũ không còn cho chính chủ xem**: `GET .../citizen-id`,
`GET .../citizen-id/history`, `GET .../passport` — chính chủ gọi id của mình cũng `403`.

Bridge doc đầy đủ: [`employee-citizen-id-passport.md`](./employee-citizen-id-passport.md),
mục **"Tự xem"** và **"Rule chính chủ vs Permission"**.

---

## API

### `POST /v1/employees/me/identity`

Body: `{ "password": "<mật khẩu của chính người đang đăng nhập>" }`
Không truyền `employeeId` — server lấy từ JWT.

Thành công: **HTTP `201`** (POST của NestJS mặc định 201, **đừng** hardcode `=== 200`).

```typescript
export interface MyIdentityResponse {
  citizenId: CitizenIdResponse | null;   // đã có type sẵn ở app/types/employee-citizen-id.types.ts
  passport: PassportResponse | null;     // đã có type sẵn ở app/types/employee-passport.types.ts
}
```

Hai khối **độc lập**, đều nullable: có thể có CCCD mà chưa có hộ chiếu, hoặc chưa có cả
hai. `null` **không phải lỗi** → hiện trạng thái rỗng cho từng khối.

4 URL ảnh (`frontPhotoUrl`, `backPhotoUrl` của CCCD; `photoFrontUrl`, `photoBackUrl` của
hộ chiếu) đều đã được BE presign — dùng trực tiếp, **không** gọi thêm gì để sign.

### Mã lỗi

| HTTP | Code | Xử lý ở FE |
|---|---|---|
| `400` | `BAD_REQUEST` | Thiếu mật khẩu — báo tại ô mật khẩu |
| `400` | `AUTH_INVALID_CREDENTIALS` | Sai mật khẩu. Hiện **nguyên message** của API (có số lần thử còn lại), **giữ modal mở** |
| `403` | `AUTH_ACCOUNT_LOCKED` | Đóng modal, báo tài khoản bị khoá 30 phút, không cho thử tiếp |
| `401` | `AUTH_SESSION_INVALID` | Đăng xuất — ca 401 **duy nhất** của endpoint này |
| `429` | — | Báo thử lại sau |

> **Sai mật khẩu trả `400`, KHÔNG phải `401`** — có chủ ý. Client nào có interceptor
> "refresh-on-401" sẽ tự gửi lại request khi gặp 401, đốt gấp đôi số lần thử rồi đăng xuất
> người dùng chỉ vì gõ nhầm. Repo `nhan-su` đã gặp đúng lỗi này ở đợt BHXH và có lớp phòng
> vệ trong `app/services/http/auth.fetch.ts` — **giữ lớp đó**.
>
> **App mobile (Flutter) đọc kỹ chỗ này:** nếu Dio/http interceptor của bạn có
> refresh-on-401, hãy kiểm tra nó không áp cho `code === 'AUTH_INVALID_CREDENTIALS'`.

---

## Việc cần làm (web `nhan-su`)

| File | Việc |
|---|---|
| `app/types/employee-identity.types.ts` *(mới)* | Khai `MyIdentityResponse` gộp 2 type đã có |
| `app/services/employee-citizen-id.service.ts` *hoặc service mới* | Thêm `viewOwnIdentity(password)` → `POST /v1/employees/me/identity` |
| `app/composables/useEmployeeIdentity.ts` | Thêm state + hàm `viewOwnIdentity`; **giữ nguyên** toàn bộ hàm hiện có (màn hình quản lý vẫn dùng) |
| `app/components/modules/profile/ProfileIdentity.vue` *(mới)* | Card read-only + nút + modal mật khẩu |
| `app/pages/profile/index.vue` | Đặt card mới cạnh card BHXH |

**Luồng UI** — nhân bản `ProfileSocialInsurance.vue`:

```
Nút "Xem thông tin định danh"
      ↓
Modal nhập mật khẩu
      ↓  POST /v1/employees/me/identity  { password }
  ├─ 201 → đóng modal, hiện 2 khối (CCCD · Hộ chiếu), khối nào null thì hiện trạng thái rỗng
  ├─ 400 → giữ modal, hiện message của API
  ├─ 403 → đóng modal, báo khoá 30 phút
  └─ 429 → báo thử lại sau
```

**Trường nên hiện:**
- CCCD: số CCCD · họ tên trên thẻ · ngày cấp · nơi cấp · quê quán · thường trú · tạm trú ·
  nơi ở hiện tại · 2 ảnh (mặt trước / mặt sau)
- Hộ chiếu: số hộ chiếu · họ tên trên hộ chiếu · loại hộ chiếu (lấy nhãn từ
  `GET /v1/meta-data/passport-types`, **đừng** hiện mã `ORDINARY`) · ngày cấp · ngày hết
  hạn · 2 ảnh

### TUYỆT ĐỐI KHÔNG

- **Không cache** kết quả vào `localStorage` / `sessionStorage` / cookie / pinia persist.
  Cache lại thì lần sau xem không cần mật khẩu — đúng cái cửa mật khẩu sinh ra để chặn.
  Giữ trong state component, mất khi rời trang là **đúng**.
- Không giữ mật khẩu trong biến sống lâu hơn request; không `console.log` mật khẩu.
- Không dùng 3 route `GET` cũ cho màn hình của nhân viên — chúng `403` rồi. Màn hình
  `/management/employees/[id]` vẫn dùng chúng bình thường (HR có quyền), **đừng sửa**.

---

## Scenario phải smoke (bấm thật trên UI)

| # | Việc | Kỳ vọng |
|---|---|---|
| 1 | Mở `/profile` | Thấy **nút**, và **0 request** tới `/employees/me/identity` khi load trang |
| 2 | Bấm nút | Modal hiện, ô mật khẩu `type="password"` |
| 3 | Nhập đúng mật khẩu | 201, modal đóng, hiện đủ trường của cả 2 khối |
| 4 | Ảnh CCCD / hộ chiếu | Mở được (URL đã presign trả 200) |
| 5 | Nhập sai mật khẩu | Modal **vẫn mở**, hiện "Mật khẩu không đúng. Còn N lần thử", **đúng 1 request**, **không** bị đá về `/login` |
| 6 | Bỏ trống rồi Xác nhận | Chặn ở client, 0 request |
| 7 | F5 sau khi đã xem | Quay về trạng thái **nút**, không tự hiện dữ liệu (chứng minh không cache) |
| 8 | Nhân viên chưa có CCCD và hộ chiếu | Hiện trạng thái rỗng cho cả 2 khối, không lỗi |
| 9 | Nhân viên có CCCD nhưng chưa có hộ chiếu | Khối CCCD có dữ liệu, khối hộ chiếu rỗng |
| 10 | Loại hộ chiếu | Hiện nhãn tiếng Việt, **không** hiện `ORDINARY` |
| 11 | Màn hình 390px | Modal và card không tràn ngang |
| 12 | `npm run build` + `npx vitest run` | Build pass, vitest giữ nguyên baseline |

**Đừng test ca khoá tài khoản** (sai 5 lần) — BE đã smoke rồi (15/15), và mỗi lần test là
khoá một tài khoản 30 phút mà hệ thống **không có đường mở khoá**.

---

## Giới hạn

- Không sửa file nào trong repo BE. Thấy contract thiếu → báo lại, đừng workaround ở FE.
- Type khớp `../hr-system-be/docs/openapi.json` (đã có `MyIdentityResponseDto`), **không**
  phải `nhan-su/docs/api-endpoint.json` (chốt 04/08/2026, đã cũ).
- `npm run typecheck` **không tồn tại** trong `package.json` repo này — đừng báo "typecheck
  pass" từ lệnh không có.

## Báo lại

① file đã sửa/thêm ② bảng 12 scenario ✓/✗ kèm cái thấy thật ③ chỗ nào lệch doc hoặc doc thiếu.
