# FE prompt — Màn Phân quyền: người có `role:read` được xem, chỉ ADMIN được sửa (hotfix 18/11/2026)

## Vì sao

HR ở công ty Sơn Thành báo không thấy màn Phân quyền dù ADMIN đã tick "Xem vai trò", "Tạo vai trò"
và "Gán người dùng vào vai trò" cho vai trò "Nhân sự". Nguyên nhân nằm ở FE: mục menu "Phân quyền"
trong `app/config/app-modules.ts` gác bằng `roles: ['ADMIN']`, không hỏi tới `role:read`.

User đã chốt phạm vi là **chỉ xem**. Có `role:read` thì thấy menu và xem được vai trò, quyền, người
trong vai trò. Mọi thao tác ghi vẫn chỉ ADMIN làm được, vì BE cố ý giữ `@Roles(ADMIN)` cho các route
ghi để chống leo thang quyền (người có `role:create` và `role:assign` tự tạo được vai trò đủ mọi
quyền rồi gán cho chính mình).

## ① Repo và nhánh

- Repo: `/home/tuanpham/work/hr-system/nhan-su`, remote GitHub `TuanPhamHP/nhan-su`.
- Nhánh: `hotfix/role-view-for-hr` tạo từ `origin/main`. Hiện `origin/main` và `origin/develop` trùng nhau.
- Làm trong worktree riêng `/home/tuanpham/work/hr-system/.worktrees/fe-role-view` (không đặt trong
  `/tmp`), `node_modules` là symlink tới `/home/tuanpham/work/hr-system/nhan-su/node_modules`, giống
  `.worktrees/fe-hotfix-shift-range`.

## ② Đọc trước

- `nhan-su/CLAUDE.md`
- File này, và bridge `docs/backend/bridges/user-roles.md` (mục "Roles" và "Ai thấy màn Phân quyền").

## ③ Thay đổi API

**Không có.** Endpoint, DTO, response, mã lỗi giữ nguyên. Chỉ ghi lại luật gác đang có:

| Route | Điều kiện |
|---|---|
| `GET /v1/roles`, `GET /v1/roles/:id`, `GET /v1/roles/:id/employees` | `role:read` (ADMIN bypass) |
| `GET /v1/permissions` | chỉ cần đăng nhập |
| `POST /v1/roles`, `PATCH /v1/roles/:id`, `DELETE /v1/roles/:id`, `PUT /v1/roles/:id/permissions`, `POST /v1/roles/:id/employees`, `DELETE /v1/roles/:id/employees/:employeeId` | `SystemRole` phải là `ADMIN`. Có tick `role:*` mà không phải ADMIN thì 403 |

## ④ File phải sửa

1. `app/config/app-modules.ts`, mục "Phân quyền" (route `/management/roles`): bỏ `roles: ['ADMIN']`,
   thay bằng `management: true` và `permission: 'role:read'`.
2. `app/middleware/permission-guard.global.ts`: thêm `{ prefix: '/management/roles', permission: 'role:read' }`
   vào `ROUTE_PERMISSIONS`, để người thiếu quyền gõ thẳng URL thì bị đưa về `/management` kèm toast.
3. `app/pages/management/roles/index.vue`: chế độ chỉ xem khi `!isAdmin` (lấy `isAdmin` từ
   `usePermissions()`). Điều kiện là `isAdmin`, **không phải** `hasPermission('role:update')`, vì HR có
   tick vẫn bị BE trả 403. Khi chỉ xem thì:
   - ẩn nút "+" tạo vai trò;
   - ô quyền vẫn hiện đúng trạng thái tick nhưng `disabled`, bỏ con trỏ bấm; ẩn "Chọn tất cả";
   - ẩn dải "Bạn có thay đổi chưa được lưu" và hai nút "Cập nhật quyền"/"Cập nhật", ẩn "Xóa vai trò";
   - tab Người dùng ẩn "Thêm người dùng" và nút "Xóa" từng dòng; câu "Thêm người vào vai trò này" ở
     trạng thái rỗng không hiện;
   - một dòng thông báo ngắn cho người xem biết vì sao không sửa được, ví dụ "Bạn đang xem ở chế độ chỉ
     xem. Chỉ quản trị viên được thay đổi phân quyền." Giữ đúng token và component đang dùng trong trang.

Không sửa `RoleCreateModal.vue`, `RoleAddUserModal.vue` ngoài những gì cần để chúng không mở được ở chế độ chỉ xem.

## ⑤ Scenario phải smoke (bấm thật trên UI, đọc kết quả bằng mắt)

Sandbox BE đang chạy sẵn, thông tin trong
`/tmp/claude-1000/-home-tuanpham-work-hr-system-hr-system-be/e8eae37c-82c1-4953-8da6-8aae8a60f42a/scratchpad/sandbox-rv.json`
(API `http://127.0.0.1:3162/v1`, mật khẩu chung, CORS mở cho `http://localhost:4040`). Chạy FE dev ở
cổng **4040** với file env trỏ `NUXT_PUBLIC_BASE_API_URL=http://localhost:3162`, có thể chép
`.worktrees/fe-hotfix-shift-range/.env.stub` rồi đổi URL. Lệnh dev đã dùng thật: `nuxt dev --dotenv <file> --port 4040`.

| # | Ai | Làm gì | Kỳ vọng |
|---|---|---|---|
| F1 | hr01 (HR có `role:read`) | mở lưới phân hệ | thấy "Quản trị hệ thống", trong đó có "Phân quyền" |
| F2 | hr01 | vào Phân quyền, chọn "Nhân sự" | thấy ô quyền đúng trạng thái (có tick Xem/Tạo/Gán vai trò), bấm ô không đổi gì, không có nút Cập nhật, không có "Chọn tất cả", có dòng thông báo chỉ xem |
| F3 | hr01 | tab Người dùng của "Nhân viên" | thấy danh sách, có phân trang 2 trang, không có "Thêm người dùng" và nút "Xóa" |
| F4 | hr01 | danh sách vai trò bên trái | không có nút "+", chọn "Nhân sự phụ" (vai trò tự tạo) không có "Xóa vai trò" |
| F5 | hr02 (HR không `role:read`) | lưới phân hệ, rồi gõ thẳng `/management/roles` | không thấy mục Phân quyền; gõ URL thì về `/management` kèm toast "Bạn không có quyền truy cập trang này" |
| F6 | tp01 (MANAGER) | như F5 | như F5 |
| F7 | nv01 (EMPLOYEE) | gõ `/management/roles` | bị đưa về `/` như trước |
| F8 | admin | vào Phân quyền | đủ mọi nút như cũ; tick thêm một quyền rồi Cập nhật thành công; thêm rồi gỡ một người ở tab Người dùng; tạo rồi xoá một vai trò |
| F9 | hr01 | tải lại trang khi đang ở `/management/roles` | vẫn ở trang, không bị đá ra |
| F10 | mọi vai trò trên | loading và trạng thái rỗng | khung xương khi tải, vai trò không có người thì hiện câu rỗng, không trắng trang |

Chạy thêm `npm run build` và `npx vitest run` trong worktree.

## ⑥ Báo lại

- Danh sách file đã sửa (đường dẫn trong worktree).
- Bảng smoke `# | Ai | Làm gì | Kỳ vọng | Thực tế | ✓/✗`, kèm ảnh chụp F2, F3 và F8 nếu chụp được.
- Kết quả `npm run build` và `npx vitest run` (exit code).
- Chỗ nào bridge doc nói khác với code thật.
- **Không commit, không push.** Session BE sẽ gom và commit sau khi qua cổng bảo mật.

## ⑦ Giới hạn

- Không sửa repo BE (`hr-system-be` và các worktree `be-*`).
- Không tự workaround ở FE nếu thấy contract BE sai, ví dụ HR có `role:read` mà `GET /v1/roles` trả 403.
  Dừng lại và báo, lỗi đó phải sửa ở BE.
- Không mở nút ghi cho người không phải ADMIN dưới bất kỳ điều kiện nào.
- Không dừng sandbox BE (`hr-rv-*`), session BE sẽ dọn.
