# FE prompt — Ngày nghỉ việc & bảng công của nhân sự đã nghỉ

**Ngày chốt:** 12/10/2026 · **BE đã xong, đã smoke 28/28 xanh** · Repo FE: `nhan-su`

---

## 1. Vấn đề nghiệp vụ

Nhân sự nghỉ việc giữa tháng (ví dụ 18/09/2026) thì **không xuất được bảng công tháng 9**
của họ: mọi báo cáo tháng lọc cứng `status = 'ACTIVE'` nên họ biến mất khỏi danh sách,
kéo theo không mở được modal bảng công cá nhân và không có dòng nào trong file Excel.

BE đã sửa: báo cáo tháng liệt kê nhân sự nếu `ACTIVE`, **hoặc** `INACTIVE` và
`terminationDate >= ngày đầu tháng`. Nghỉ 18/09 ⇒ tháng 9 và mọi tháng trước vẫn xuất
được; từ tháng 10 không còn.

Để có mốc đó, `Employee` có thêm cột `terminationDate` và **HR phải nhập được ngày nghỉ
việc khi vô hiệu hóa nhân sự** — đây là phần FE phải làm.

---

## 2. Thay đổi API

### 2.1 `DELETE /v1/employees/:id` — nhận body optional

```ts
interface DeactivateEmployeeDto {
  terminationDate?: string; // "YYYY-MM-DD"; bỏ trống hoặc "" → BE lấy ngày hiện tại (giờ VN)
}
```

| Trường hợp | Kết quả |
|---|---|
| `{ terminationDate: "2026-09-18" }` | 204, nhân sự `INACTIVE` + ngày đã ghi |
| không body / `{ terminationDate: "" }` | 204, ngày = hôm nay |
| ngày < `joinDate` | **400** — `"Ngày nghỉ việc (01/02/2026) không được trước ngày vào làm (01/03/2026)"` |
| sai định dạng (`"18/09/2026"`) | **400** |
| nhân sự đã `INACTIVE` | **400** — `"Nhân viên đã bị vô hiệu hóa"` (ngày cũ KHÔNG bị ghi đè) |
| role `EMPLOYEE` gọi | **403** |

`terminationDate` phải gửi dạng `YYYY-MM-DD`, không gửi ISO datetime.

### 2.2 `EmployeeDetail` có thêm field

```ts
terminationDate: string | null; // "YYYY-MM-DD", chỉ khác null khi status = 'INACTIVE'
```

Áp dụng cho `GET /v1/employees/:id`, `GET /v1/employees/me`, `POST /v1/employees`,
`PATCH /v1/employees/:id`. `EmployeeSummary` (list) **không** có field này.

### 2.3 `AttendanceReportResponse` có thêm 2 field

```ts
employeeStatus: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
terminationDate: string | null;
```

### 2.4 `EmployeeMonthlyReportResponse.employee` có thêm 2 field

```ts
terminationDate: string | null; // ISO date
status: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
```

### 2.5 File Excel bảng công tháng có thêm cột cuối

`GET /v1/reports/employees/monthly/export` → cột **AA "Ngày nghỉ việc"** (sau `Z Tổng VP`).
`GET /v1/reports/attendance/export` → thêm cột `Ngày nghỉ việc` ở cuối.
FE không phải làm gì cho hai file này — BE sinh sẵn.

### 2.6 Không có endpoint nào bị bỏ hoặc đổi path

---

## 3. Việc phải làm ở FE

| # | Màn hình / file | Việc |
|---|---|---|
| 1 | Dialog vô hiệu hóa nhân sự (chỗ gọi `employeeService.deactivate`) | Thêm input ngày **"Ngày nghỉ việc"**, default hôm nay, gửi trong body. Hiển thị message 400 của BE ra toast (đừng tự validate rồi chặn ở FE) |
| 2 | `app/services/employee.service.ts` | `deactivate(id)` → `deactivate(id, terminationDate?)`, truyền `body` |
| 3 | `app/composables/useEmployee.ts` | truyền tham số mới xuống service |
| 4 | Chi tiết / danh sách nhân sự | Nhân sự `INACTIVE` → hiển thị "Đã nghỉ việc dd/mm/yyyy" (lấy `terminationDate`) |
| 5 | `app/pages/management/reports/index.vue` | Dòng có `employeeStatus === 'INACTIVE'` → badge "Đã nghỉ việc dd/mm/yyyy". Vẫn phải mở được modal bảng công cá nhân và bấm export được cho các dòng này |
| 6 | `app/types/report.types.ts`, `app/types/employee.types.ts` | Bổ sung field mới theo `../hr-system-be/docs/openapi.json` (bản sống) |

**Lưu ý số liệu:** định mức công tháng nghỉ việc **không** bị cắt theo ngày nghỉ (quyết
định nghiệp vụ). Nhân sự nghỉ 18/09 vẫn có `totalWorkDays` bằng người làm đủ tháng, phần
ngày sau 18/09 hiện ra là vắng/thiếu công. Vì vậy badge ngày nghỉ việc ở mục 5 là bắt
buộc, không phải trang trí — không có nó người đọc báo cáo sẽ hiểu sai.

---

## 4. Scenario phải smoke ở FE (bấm thật, mọi role)

| # | Việc | Expect |
|---|---|---|
| 1 | HR vô hiệu hóa 1 nhân sự, nhập ngày 18/09/2026 | thành công, danh sách cập nhật, chi tiết hiện "Đã nghỉ việc 18/09/2026" |
| 2 | Vô hiệu hóa, để trống ô ngày | **không** lỗi 400 — BE nhận `""` và lấy ngày hôm nay |
| 3 | Nhập ngày trước ngày vào làm | toast hiện message 400 của BE, dialog không đóng, không trắng trang |
| 4 | Màn hình báo cáo, tháng nghỉ việc | nhân sự đã nghỉ **có** trong danh sách + có badge |
| 5 | Màn hình báo cáo, tháng sau tháng nghỉ | nhân sự đã nghỉ **không** còn trong danh sách |
| 6 | Mở modal bảng công cá nhân của nhân sự đã nghỉ (tháng nghỉ việc) | hiện đủ số liệu, không lỗi |
| 7 | Bấm export bảng công tháng nghỉ việc | file tải về có dòng nhân sự đó, cột cuối "Ngày nghỉ việc" có ngày |
| 8 | MANAGER xem báo cáo phòng mình, tháng nghỉ việc | thấy nhân sự đã nghỉ cùng phòng |
| 9 | EMPLOYEE | không thấy nút vô hiệu hóa (BE trả 403 nếu gọi) |
| 10 | Loading / rỗng / phân trang của màn hình báo cáo | không vỡ |

---

## 5. Giới hạn

- **Không sửa repo BE.** Thấy contract sai thì báo lại, BE sửa.
- **Không tự workaround ở FE.** Ví dụ: đừng tự lọc nhân sự `INACTIVE` ra khỏi danh sách báo
  cáo "cho đẹp" — chính việc họ xuất hiện mới là yêu cầu.
- Type phải khớp `../hr-system-be/docs/openapi.json`, **không** phải
  `nhan-su/docs/api-endpoint.json` (bản chốt 04/08/2026, đã cũ).
- `npm run typecheck` **không tồn tại** trong `package.json` của `nhan-su` — đừng báo
  "typecheck pass". Dùng `npm run build` + `npx vitest run`.

---

## 6. Phải báo lại những gì

1. Danh sách file đã sửa.
2. Bảng kết quả smoke 10 scenario ở mục 4 (`# | Việc | Expect | Actual | ✓/✗`) — đỏ thì nói
   thẳng là đỏ.
3. Chỗ nào thấy doc BE lệch thực tế.

---

## 7. Đọc trước khi làm

- `nhan-su/CLAUDE.md`
- `../hr-system-be/docs/backend/bridges/employees.md` mục `DELETE /v1/employees/:id`
- `../hr-system-be/docs/backend/bridges/reports.md` mục "Nhân sự đã nghỉ việc trong báo cáo"
  (bản sao trong repo FE: `nhan-su/docs/backend/bridges/…`)
- `_fe-prompt-employees-monthly-export.md` — bảng cột file Excel (giờ là 27 cột)
