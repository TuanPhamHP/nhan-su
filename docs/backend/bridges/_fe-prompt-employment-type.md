# FE Agent Prompt — Thêm `EmploymentType` cho Employee + Employment Policy cho Leave

## Context

BE vừa thêm khái niệm **loại hình lao động** (`EmploymentType`) tách khỏi `SystemRole`. Mục đích: phân biệt INTERN / APPRENTICE / CONTRACTOR / PROBATION / PART_TIME / FULL_TIME **về mặt chính sách** (nghỉ phép, BHXH…), KHÔNG về mặt phân quyền.

Rule đầu tiên đã enforce: intern/apprentice/contractor/probation **không được xin `ANNUAL` / `HALF_DAY` / `WELFARE`** → BE trả 403.

Bridge docs đầy đủ:
- [`docs/bridges/employees.md`](./employees.md) — DTO create/update/query + response mới, badge dropdown.
- [`docs/bridges/leave-requests.md`](./leave-requests.md) — mục "Employment Policy — chặn 403 theo loại nhân viên".

---

## Thay đổi API

### 1. Enum mới `EmploymentType`

```typescript
export type EmploymentType =
  | 'FULL_TIME'     // Nhân viên chính thức
  | 'PROBATION'     // Thử việc
  | 'APPRENTICE'    // Học việc
  | 'INTERN'        // Thực tập sinh
  | 'PART_TIME'     // Bán thời gian
  | 'CONTRACTOR';   // Cộng tác viên / khoán việc
```

Label VN (dùng cho badge / dropdown):

| Value | Label |
|---|---|
| `FULL_TIME` | Nhân viên chính thức |
| `PROBATION` | Thử việc |
| `APPRENTICE` | Học việc |
| `INTERN` | Thực tập sinh |
| `PART_TIME` | Bán thời gian |
| `CONTRACTOR` | Cộng tác viên |

### 2. Response DTOs — thêm field `employmentType`

- `EmployeeDetail` (GET `/v1/employees/:id`, GET `/v1/employees/me`, POST/PATCH `/v1/employees`) → thêm `employmentType: EmploymentType`.
- `EmployeeSummary` (GET `/v1/employees`) → thêm `employmentType: EmploymentType`.
- `DirectoryMember` (GET `/v1/employees/directory`) → **KHÔNG có** — directory giữ nguyên.
- `ProfileResponse` (GET `/v1/auth/profile`, `/auth/me`) → **hiện chưa có** — nếu FE cần dùng ở màn login/self-service, đề xuất BE bổ sung.

### 3. Request DTOs — thêm `employmentType` (optional)

**Create nhân viên (`POST /v1/employees`):**
```typescript
export interface CreateEmployeeDto {
  // … các field cũ
  employmentType?: EmploymentType;  // omit = server dùng default FULL_TIME
}
```

**Update nhân viên (`PATCH /v1/employees/:id`):**
- `UpdateEmployeeDto` inherit qua `Partial<Omit<CreateEmployeeDto, 'email' | 'password'>>` → tự động có `employmentType?`.
- Dùng để chuyển đổi loại, ví dụ hết thử việc: `PATCH /v1/employees/12 { "employmentType": "FULL_TIME" }`.

### 4. Query filter — `GET /v1/employees`

```
GET /v1/employees?employmentType=INTERN
GET /v1/employees?departmentId=1&employmentType=FULL_TIME&status=ACTIVE
```

### 5. Business rule — 403 khi loại nhân viên không được xin loại phép

Áp dụng cho:
- `POST /v1/leave-requests`
- `POST /v1/leave-requests/preview` (throw sớm để preview hiển thị lỗi rõ ngay khi user chọn loại phép)

Bảng rule (cứng trong code, đổi phải deploy):

| LeaveType `code` | Employment types được xin |
|---|---|
| `ANNUAL` | `FULL_TIME`, `PART_TIME` |
| `HALF_DAY` | `FULL_TIME`, `PART_TIME` |
| `WELFARE` | `FULL_TIME`, `PART_TIME` |
| `UNPAID`, `LATE`, `EARLY`, loại mới | Tất cả 6 loại |

Error 403:
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Thực tập sinh không được phép xin loại phép \"Phép năm\"."
  }
}
```

---

## Checklist FE

### Form tạo/sửa nhân viên (HR/Admin)
- [ ] Thêm dropdown `employmentType` (6 giá trị + label VN ở bảng trên).
- [ ] Default UI = `FULL_TIME`. Không truyền field nếu user không chọn (BE sẽ dùng default).
- [ ] Trên PATCH: form pre-fill giá trị hiện tại từ `EmployeeDetail.employmentType`; nếu user không đổi thì có thể bỏ qua khi gửi.
- [ ] Không suy ra từ `contract.contractType` — đây là 2 khái niệm độc lập.

### Danh sách nhân viên (GET `/v1/employees`)
- [ ] Hiển thị badge `employmentType` trong row (dùng label VN, không hiện raw enum).
- [ ] Bổ sung filter dropdown `employmentType` (6 giá trị hoặc "Tất cả") → truyền `?employmentType=X`.
- [ ] Nên chọn màu badge khác biệt cho các loại "tạm thời" (INTERN/APPRENTICE/PROBATION) để HR dễ theo dõi.

### Detail nhân viên
- [ ] Hiển thị `employmentType` (label VN) trong section thông tin công việc, gần `role` / `department` / `position`.

### Form tạo đơn nghỉ phép (leave-request)
- [ ] Lấy `employmentType` của user hiện tại (từ `/auth/me` hoặc `/employees/me`).
- [ ] Filter dropdown loại phép client-side theo bảng rule ở trên — hide `ANNUAL`/`HALF_DAY`/`WELFARE` với INTERN/APPRENTICE/CONTRACTOR/PROBATION.
- [ ] BE là hàng rào cuối — vẫn phải handle 403 error message (hiển thị nguyên message BE trả về, đã tiếng Việt sẵn).
- [ ] Preview endpoint cũng throw 403 → surface lỗi lên UI ngay khi user chọn loại phép (không đợi tới submit).

### Không cần làm
- [ ] KHÔNG sửa `SystemRole` (`EMPLOYEE`, `HR`, …) — hoàn toàn tách biệt.
- [ ] KHÔNG bổ sung `employmentType` cho `DirectoryMember` — bị BE loại khỏi shape.
- [ ] KHÔNG dùng bảng `LeaveType.allowedEmploymentTypes` — không tồn tại, rule fix trong code BE.

---

## Câu hỏi cần xác nhận với BE

1. Có nên bổ sung `employmentType` vào `/auth/me` và `/auth/profile` không? — Nếu FE cần đọc ở login flow / self-service page mà không muốn call thêm `/employees/me`, đề xuất BE add.
2. Có badge màu chuẩn cho từng employmentType không, hay FE tự quy ước?
