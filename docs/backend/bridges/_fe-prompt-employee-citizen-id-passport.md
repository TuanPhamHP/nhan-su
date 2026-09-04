# FE Agent Prompt — Thêm CCCD & Hộ chiếu cho Employee

## Context

BE vừa mở 2 sub-resource mới gắn với nhân viên, tách khỏi form `/v1/employees` gốc:

- **CCCD** (`/v1/employees/:employeeId/citizen-id`) — **bắt buộc** với mọi nhân viên; có thể tạo cùng lúc với hoặc sau khi tạo Employee. Cho phép update sau này, kèm lịch sử thay đổi.
- **Hộ chiếu** (`/v1/employees/:employeeId/passport`) — **tuỳ chọn**; nếu tạo thì bắt buộc đủ 5 field text + `expiryDate > issuedDate`.

Ảnh (front + back cho cả 2 resource) lưu S3 private, trả về client dưới dạng **presigned URL TTL 1h**.

Bridge doc đầy đủ (types, endpoint, validation, edge cases, composable mẫu, UX gợi ý):

- [`docs/bridges/employee-citizen-id-passport.md`](./employee-citizen-id-passport.md)

---

## Việc FE cần làm

### 1. Types & Composable
- Thêm 2 file types: `types/employee-citizen-id.types.ts` + `types/employee-passport.types.ts` (copy nguyên từ bridge doc, section "TypeScript Types").
- Thêm 1 composable `composables/useEmployeeIdentity.ts` (mẫu có sẵn trong bridge doc, section "Composable").

### 2. Meta-data
- Thêm 1 dropdown source mới: `GET /v1/meta-data/passport-types` → `[{ value, label }]` cho 3 loại `ORDINARY / DIPLOMATIC / OFFICIAL`.

### 3. Màn hình

**Trong màn chi tiết nhân viên (`/employees/:id`)** — thêm 2 tab/section mới:

#### Tab "CCCD" (bắt buộc)
- Nếu chưa có → nút "Tạo CCCD" mở form.
- Nếu đã có → hiển thị full thông tin + 2 ảnh (front/back). Nút "Chỉnh sửa" + "Xoá" + "Cập nhật ảnh".
- Nút "Xem lịch sử thay đổi" → mở drawer list các log qua `GET .../citizen-id/history`.

Form field validation (**client-side match server**):

| Field | Bắt buộc | Rule |
|-------|---------|------|
| `citizenIdNumber` | ✅ | Đúng 12 chữ số, `inputmode="numeric"`, filter non-digit khi paste |
| `fullNameOnCard` | ❌ | ≤ 100 |
| `issuedDate` | ✅ | Date picker `YYYY-MM-DD` |
| `issuedPlace` | ❌ | Nếu nhập → 10–255 ký tự |
| `hometown` | ❌ | ≤ 255 |
| `permanentAddress` | ❌ | textarea |
| `temporaryAddress` | ❌ | textarea |
| `currentAddress` | ❌ | textarea |

**Upload ảnh:**
- 2 slot cố định (front + back), **bắt buộc cả 2** trong 1 lần submit.
- Mime: JPG/PNG/WebP, size ≤ 5MB/ảnh.
- Submit qua endpoint riêng: `POST .../citizen-id/photos` (multipart, field `front` + `back`).
- Upload lại lần sau → thay thế cả 2 ảnh.

#### Tab "Hộ chiếu" (tuỳ chọn)
- Nếu chưa có → nút "Thêm hộ chiếu" mở form.
- Nếu đã có → hiển thị info + 2 ảnh (front/back optional).
- Cảnh báo màu cam "Sắp hết hạn" khi `expiryDate` cách hôm nay < 6 tháng.

Form field validation:

| Field | Bắt buộc | Rule |
|-------|---------|------|
| `passportNumber` | ✅ | Regex `/^[A-Z0-9]{1,20}$/` — **auto-uppercase khi user gõ** |
| `fullNameOnPassport` | ✅ | 2–100 ký tự |
| `passportType` | ✅ | Dropdown từ meta-data endpoint |
| `issuedDate` | ✅ | Date picker |
| `expiryDate` | ✅ | Date picker, `min = issuedDate + 1 day` |

**Upload ảnh (khác CCCD):**
- Từng ảnh upload riêng qua `POST .../passport/photos/:side` (side = `front` hoặc `back`).
- Không bắt buộc đủ 2 ảnh, có thể có 0/1/2 ảnh.
- Xoá từng ảnh qua `DELETE .../passport/photos/:side`.

### 4. Permissions
- Xem người khác: cần `employee:citizen-id:read` / `employee:passport:read` — nếu FE có permission-based UI, ẩn/hiện tab tương ứng.
- Chính chủ xem của mình: luôn được, không cần permission.
- Create/update/delete: **luôn cần permission** (kể cả chính chủ tự sửa của mình cũng phải có permission).

### 5. Presigned URL TTL 1h
- Các field `frontPhotoUrl` / `backPhotoUrl` / `photoFrontUrl` / `photoBackUrl` là URL S3 presigned expire sau 1h.
- Nếu user giữ tab lâu → ảnh bị 403. Cách xử lý: re-fetch endpoint GET khi user vào lại route, hoặc refresh URL nếu `Date.now() - fetchedAt > 55 min`.

---

## Reference nhanh — Enum `PassportType`

| Value | Label |
|---|---|
| `ORDINARY` | Phổ thông |
| `DIPLOMATIC` | Ngoại giao |
| `OFFICIAL` | Công vụ |

---

## Error codes hay gặp (dùng để render toast tiếng Việt — server đã trả sẵn message tiếng Việt)

| Trigger | HTTP | Message BE trả |
|---------|------|----------------|
| Số CCCD sai format | 400 | `"Số CCCD phải đúng 12 chữ số"` |
| Nơi cấp < 10 ký tự | 400 | `"Nơi cấp CCCD phải có tối thiểu 10 ký tự"` |
| Số CCCD trùng | 409 | `"Số CCCD đã tồn tại trong hệ thống"` |
| Đã có CCCD, tạo mới | 409 | `"Nhân viên đã có thông tin CCCD, hãy dùng cập nhật"` |
| Upload thiếu 1 ảnh CCCD | 400 | `"Phải upload đủ cả ảnh mặt trước và mặt sau CCCD"` |
| Ảnh > 5MB | 400 | `"Ảnh không được vượt quá 5MB"` |
| Sai format ảnh | 400 | `"Chỉ chấp nhận ảnh JPG, PNG hoặc WebP"` |
| Số hộ chiếu sai format | 400 | `"Số hộ chiếu chỉ chứa chữ cái A-Z và số 0-9, tối đa 20 ký tự, không khoảng trắng"` |
| Ngày hết hạn ≤ ngày cấp | 400 | `"Ngày hết hạn hộ chiếu phải sau ngày cấp"` |
| Không đủ quyền xem | 403 | `"Không đủ quyền xem CCCD/hộ chiếu của nhân viên khác"` |

Xem đầy đủ trong bridge doc, section "Edge cases".
