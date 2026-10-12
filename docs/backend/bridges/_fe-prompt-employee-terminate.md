# FE prompt — Form "Xác nhận nghỉ việc"

**Ngày chốt:** 12/10/2026 · **BE đã xong, smoke 16/16 xanh** · Repo FE: `nhan-su`

Nối tiếp [`_fe-prompt-employee-termination-date.md`](./_fe-prompt-employee-termination-date.md)
(đã làm xong: ô ngày nghỉ việc trong dialog vô hiệu hóa + badge). Lần này tách hẳn **thủ
tục nghỉ việc** ra khỏi **khóa tài khoản**.

---

## 1. Hai hành động, đừng trộn

| | Khóa tài khoản | Xác nhận nghỉ việc |
|---|---|---|
| API | `DELETE /v1/employees/:id` | `POST /v1/employees/:id/terminate` |
| Quyền | `employee:delete` | **`employee:terminate`** (mới) |
| Ngày nghỉ | optional | **bắt buộc** |
| Lý do | không có | **bắt buộc** |
| Gọi lại khi đã INACTIVE | 400 | **200 — sửa lại ngày/lý do** |
| Nút trên UI | đổi tên thành **"Khóa tài khoản"** | nút mới **"Xác nhận nghỉ việc"** |

⚠ Quyền `employee:terminate` **không được cấp sẵn cho vai trò nào** (chỉ ADMIN bypass).
Admin phải tự tick trong màn phân quyền. UI phải ẩn nút khi không có quyền.

---

## 2. API

### `POST /v1/employees/:id/terminate`

```ts
interface TerminateEmployeeDto {
  terminationDate: string; // "YYYY-MM-DD", bắt buộc, >= joinDate
  terminationNote: string; // bắt buộc; server trim, chuỗi rỗng/toàn dấu cách → 400; tối đa 1000 ký tự
}
```

**200** → `ApiSuccess<EmployeeDetail>` (bản ghi sau cập nhật, đã có
`status: 'INACTIVE'`, `terminationDate`, `terminationNote`).

| Lỗi | HTTP | Message mẫu |
|---|---|---|
| Thiếu / rỗng `terminationNote` | 400 | validation của class-validator |
| Thiếu / sai định dạng `terminationDate` | 400 | — |
| Ngày nghỉ < ngày vào làm | 400 | `"Ngày nghỉ việc (01/02/2026) không được trước ngày vào làm (01/03/2026)"` |
| Chưa tick quyền | 403 | — |
| ID không tồn tại | 404 | — |

### `EmployeeDetail` thêm field

```ts
terminationNote: string | null; // lý do nghỉ việc; null nếu chỉ bị khóa tài khoản
```

`EmployeeSummary` (list) **không** có `terminationNote` — chỉ có `terminationDate`.

---

## 3. Việc phải làm ở FE

| # | File | Việc |
|---|---|---|
| 1 | `app/types/employee.types.ts` | `Employee` + `terminationNote: string \| null`; thêm `TerminateEmployeeDto` |
| 2 | `app/services/employee.service.ts` | `terminate(id, { terminationDate, terminationNote })` → `POST /v1/employees/:id/terminate`, trả `EmployeeDetail` |
| 3 | `app/composables/useEmployee.ts` | hàm `terminate(...)`, cập nhật `currentEmployee` từ response (BE trả bản ghi mới, không cần đoán) |
| 4 | `app/pages/management/employees/[id].vue` | Nút **"Xác nhận nghỉ việc"** (gate `hasPermission('employee:terminate')`). Nhân sự đang làm → nhãn "Xác nhận nghỉ việc"; đã INACTIVE → nhãn **"Sửa thông tin nghỉ việc"**, mở cùng form, **điền sẵn** ngày + lý do hiện có |
| 5 | ↑ | Modal form: ô ngày (date, required, default hôm nay) + ô lý do (textarea, required, maxlength 1000, đếm ký tự). Nút submit disable khi thiếu 1 trong 2. Lỗi BE → toast, **không đóng** modal |
| 6 | ↑ | Đổi nhãn nút cũ từ "Vô hiệu hóa" thành **"Khóa tài khoản"** (API và quyền giữ nguyên) |
| 7 | ↑ | Khối thông tin nhân sự đã nghỉ: hiện thêm **"Lý do nghỉ việc"** cạnh "Ngày nghỉ việc" (giữ nguyên phần đã làm) |
| 8 | `app/pages/management/employees/index.vue` | Nếu menu hành động của dòng có mục vô hiệu hóa → đổi nhãn tương ứng; **không** cần thêm form nghỉ việc ở đây (yêu cầu chỉ ở màn chi tiết) |

Màn phân quyền (`Danh sách vai trò`) **không phải sửa** — nó render theo `group` lấy từ API,
quyền mới tự xuất hiện trong nhóm "Nhân viên" sau khi admin chạy seed.

---

## 4. Scenario phải smoke (bấm thật)

| # | Việc | Expect |
|---|---|---|
| 1 | ADMIN mở chi tiết nhân sự đang làm | thấy nút "Xác nhận nghỉ việc" + nút "Khóa tài khoản" |
| 2 | Bấm "Xác nhận nghỉ việc", điền ngày + lý do | 200, badge đổi "Đã nghỉ việc dd/MM/yyyy", hiện lý do |
| 3 | Để trống lý do | nút submit disable (hoặc báo lỗi tại chỗ), không gọi API |
| 4 | Để trống ngày | như trên |
| 5 | Ngày < ngày vào làm | toast hiện message 400 của BE, modal không đóng |
| 6 | Mở lại nhân sự đã nghỉ | nút đổi thành "Sửa thông tin nghỉ việc", form điền sẵn ngày + lý do cũ |
| 7 | Sửa ngày + lý do rồi lưu | 200, chi tiết cập nhật ngay |
| 8 | Tài khoản KHÔNG có quyền (ví dụ HR chưa tick) | **không thấy** nút "Xác nhận nghỉ việc"; nút "Khóa tài khoản" vẫn thấy |
| 9 | Lý do > 1000 ký tự | chặn ở FE (maxlength) |
| 10 | Nhân sự đã nghỉ, xem lại màn Báo cáo tháng nghỉ việc | vẫn có dòng + badge (không hồi quy phần trước) |

### BE để test
Sandbox: **http://localhost:3100** (DB container dùng một lần, đã có migration + quyền mới).
Tài khoản mật khẩu `Hr@123456`: `admin@test.local` (ADMIN — có quyền), `hr@test.local` (HR —
**chưa** tick `employee:terminate`, dùng cho scenario 8), `staff@test.local` (EMPLOYEE).
Trỏ FE vào sandbox bằng `NUXT_PUBLIC_BASE_API_URL=http://localhost:3100` trong `.env.local`,
**khôi phục về `http://localhost:3000` sau khi xong**. Chạy FE: `npm run start:local -- --port 4000`
(phải đúng cổng 4000, BE chỉ cho CORS các origin trong `FRONTEND_URL`).

---

## 5. Giới hạn

- Không sửa repo BE, không commit/push, không đổi branch, không chạm DB.
- Không tự workaround contract sai ở FE — báo lại để BE sửa.
- `npm run typecheck` không tồn tại; dùng `npm run build` + `npx vitest run`.

## 6. Báo lại

File đã sửa · **bảng** smoke 10 scenario (`# | Việc | Expect | Actual | ✓/✗`, chưa chạy được
thì ghi rõ) · kết quả `build` + `vitest` · chỗ doc BE lệch thực tế · xác nhận đã khôi phục
`.env.local`.
