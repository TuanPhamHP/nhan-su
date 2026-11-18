# FE prompt — Quyền địa điểm chấm công có hiệu lực (hotfix 18/11/2026, phần 2)

## Vì sao

Ở công ty Sơn Thành, vai trò tự tạo "Nhân viên hành chính" đã bỏ tick "Chỉnh sửa địa điểm chấm
công", nhưng người mang SystemRole HR trong vai trò đó vẫn sửa được địa điểm. Nhật ký ghi
`check_in_location.update` trạng thái OK. Nguyên nhân ở BE: `check-in-location.controller.ts` chỉ gác
`@Roles(HR, ADMIN)`, không có `PermissionsGuard`. BE đã sửa, mỗi route quản trị giờ hỏi đúng mã
`check-in-location:*`. Phía FE cần ẩn nút theo đúng mã đó, để người thiếu quyền không bấm vào một nút
chắc chắn nhận 403.

## ① Repo và nhánh

Cùng worktree và nhánh với phần 1: `/home/tuanpham/work/hr-system/.worktrees/fe-role-view`, nhánh
`hotfix/role-view-for-hr`.

## ② Đọc trước

Bridge `docs/backend/bridges/attendance-locations.md`, bảng "Endpoints" có cột "Quyền" mới và đoạn ghi
chú ngay dưới bảng.

## ③ Thay đổi API

Endpoint, DTO, response giữ nguyên. Chỉ thêm điều kiện quyền, thiếu thì 403 (ADMIN bỏ qua):

| Route | Quyền |
|---|---|
| `GET /v1/check-in-locations`, `GET /:id`, `GET /:id/employees` | `check-in-location:read` |
| `POST /v1/check-in-locations` | `check-in-location:create` |
| `PATCH /v1/check-in-locations/:id` | `check-in-location:update` |
| `DELETE /v1/check-in-locations/:id` | `check-in-location:delete` |
| `POST /:id/departments/:departmentId`, `POST /:id/employees/bulk`, `POST /:id/employees/:employeeId`, `DELETE /:id/employees/:employeeId` | `check-in-location:assign` |
| `GET /v1/check-in-locations/me` | không đổi, vẫn chỉ `EMPLOYEE` |

## ④ File phải sửa

Dùng `hasPermission(...)` từ `usePermissions()`, vì ADMIN đã được bypass sẵn trong hàm đó.

1. `app/pages/management/settings/index.vue`: thẻ "Địa điểm chấm công" thêm `permission: 'check-in-location:read'`
   (trường `permission` của `SettingItem` đã có sẵn).
2. `app/middleware/permission-guard.global.ts`: thêm `{ prefix: '/management/settings/locations', permission: 'check-in-location:read' }`.
3. `app/pages/management/settings/locations.vue`:
   - nút thêm địa điểm (`openAddModal`) chỉ hiện khi có `check-in-location:create`;
   - nút sửa (`showEditModal = true`) chỉ hiện khi có `check-in-location:update`;
   - nút vô hiệu hóa (`deactivateTargetId = loc.id`) chỉ hiện khi có `check-in-location:delete`;
   - nút gán nhân viên (`showAssignModal = true`) và nút gỡ từng người (`onRemoveEmployee`) chỉ hiện khi có
     `check-in-location:assign`.
   Giữ các điều kiện `isActive` đang có, chỉ AND thêm điều kiện quyền.
4. `app/pages/management/employees/new.vue`: ô chọn địa điểm chấm công chỉ hiện khi có cả
   `check-in-location:read` và `check-in-location:assign`. Không có thì không gọi
   `checkInLocationService.findAll()`, và lúc lưu không gọi `assignEmployee`.

## ⑤ Scenario phải smoke

Sandbox BE **thứ hai**, chạy code đã vá: thông tin ở
`/tmp/claude-1000/-home-tuanpham-work-hr-system-hr-system-be/e8eae37c-82c1-4953-8da6-8aae8a60f42a/scratchpad/sandbox-loc.json`
(API `http://127.0.0.1:3163/v1`, CORS mở cho `http://localhost:4040`). Muốn thử phần này thì đổi
`NUXT_PUBLIC_BASE_API_URL=http://localhost:3163` rồi khởi động lại dev server. Sandbox phần 1 ở cổng
3162 vẫn chạy cho các scenario F1–F10.

| # | Ai | Làm gì | Kỳ vọng |
|---|---|---|---|
| G1 | hc01 (Xem + Gán, đúng ca production) | Cài đặt → Địa điểm chấm công | thấy hai địa điểm và danh sách người; không có nút thêm, sửa, vô hiệu hóa; có nút gán và gỡ người |
| G2 | hc01 | gán một người vào "Kho Gia Lâm", rồi gỡ ra | thành công, danh sách cập nhật |
| G3 | hc01 | Nhân viên → Thêm mới | có ô chọn địa điểm; tạo người mới có chọn địa điểm thì thành công và người đó nằm trong địa điểm |
| G4 | hc02 (chỉ Xem) | màn địa điểm | thấy danh sách nhưng không có nút nào để ghi |
| G5 | hc02 | Nhân viên → Thêm mới | không có ô chọn địa điểm; tạo người mới thành công, không toast lỗi gán địa điểm |
| G6 | hr02 (không quyền địa điểm) | Cài đặt | không thấy thẻ "Địa điểm chấm công"; gõ thẳng `/management/settings/locations` thì về `/management` kèm toast |
| G7 | hr01 ("Nhân sự") | màn địa điểm | đủ mọi nút như trước; tạo, sửa bán kính, vô hiệu hóa đều thành công |
| G8 | admin | màn địa điểm | đủ mọi nút |
| G9 | nv01 | màn chấm công của nhân viên, hoặc gọi `GET /v1/check-in-locations/me` | vẫn thấy địa điểm của mình như trước |

## ⑥ Báo lại

Gộp chung với báo cáo phần 1: file đã sửa, bảng smoke cho G1–G9, exit code `npm run build` và
`npx vitest run`, chỗ doc lệch code. Không commit, không push.

## ⑦ Giới hạn

Giống phần 1. Không sửa repo BE. Thấy BE trả sai so với bảng ③ thì dừng lại và báo, không
workaround ở FE.
