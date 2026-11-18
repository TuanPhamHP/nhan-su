# FE prompt — Quyền địa điểm chấm công có tác dụng với mọi vai trò (hotfix 18/11/2026, lần 3)

## Vì sao

Trên .118, Trưởng bộ phận (SystemRole `CHIEF`) được gán vai trò tự tạo "Test" có tick "Xem địa điểm
chấm công" mà vẫn không thấy màn địa điểm, cũng không thấy module "Quản trị hệ thống". Có hai chỗ chặn:

- BE: mười route quản trị địa điểm còn `@Roles(HR, ADMIN)`, AND với quyền, nên CHIEF có quyền vẫn 403.
  **BE đã sửa**: bỏ `@Roles`, giờ chỉ mã `check-in-location:*` quyết định (smoke 22/22).
- FE: mục "Cài đặt", nơi chứa thẻ Địa điểm chấm công, gác cứng `roles: ['ADMIN', 'HR']`. Module "Quản trị
  hệ thống" chỉ hiện khi còn ít nhất một mục xem được, nên với CHIEF không có `role:read` thì cả module biến mất.

Không được giải quyết bằng cách đổi người đó sang HR: các luồng duyệt làm online cấp 3, vi phạm cấp 2 và bù
công của Trưởng phòng tìm người duyệt theo `CHIEF`.

## ① Repo và nhánh

Worktree `/home/tuanpham/work/hr-system/.worktrees/fe-role-view`, nhánh **mới**
`hotfix/location-permission-any-role` (đã tạo từ `origin/main` = `602b0ce`). Nhánh cũ `hotfix/role-view-for-hr`
đã merge, đừng làm trên đó.

## ② Đọc trước

`nhan-su/CLAUDE.md`, file này, bridge `docs/backend/bridges/attendance-locations.md` (bảng Endpoints: cột
"Ai được gọi" giờ là "mọi vai trò có quyền").

## ③ Thay đổi API

Endpoint, DTO, response không đổi. Chỉ đổi điều kiện:

| Route | Trước | Nay |
|---|---|---|
| 10 route quản trị `/v1/check-in-locations/*` | SystemRole `ADMIN`/`HR` **và** mã quyền | chỉ mã quyền (`ADMIN` luôn qua) |
| `GET /v1/check-in-locations/me` | `EMPLOYEE` | không đổi |
| Route loại phiếu (`request-type:manage`) | chỉ mã quyền | không đổi (vốn đã đúng, chỉ là FE chưa mở lối vào) |
| Ca làm việc, ngày lễ, loại giấy tờ | chỉ SystemRole `ADMIN`/`HR` | không đổi |

## ④ File phải sửa

1. `app/types/navigation.types.ts`: `alsoFor.permission` đổi từ `string` sang `string | string[]`
   (`hasPermission` đã nhận mảng, nghĩa là "có ít nhất một").
2. `app/config/app-modules.ts`, mục "Cài đặt": giữ `roles: ['ADMIN', 'HR']`, thêm
   `alsoFor: { roles: ['DIRECTOR', 'MANAGER', 'CHIEF'], permission: ['check-in-location:read', 'request-type:manage'] }`
   (dùng hằng `REQUEST_PERMISSIONS.typeManage` nếu import được trong file cấu hình). Nghĩa là: vai trò quản lý
   khác thấy "Cài đặt" khi xem được ít nhất một thẻ trong đó. Không thêm `EMPLOYEE`, vì role-layout đã chặn họ
   khỏi `/management`.
3. `app/pages/management/settings/index.vue`: thêm trường `roles?: UserRole[]` cho `SettingItem` và lọc theo vai
   trò hệ thống trong `visibleItems`. Ba thẻ Ca làm việc, Loại giấy tờ, Ngày lễ gắn `roles: ['ADMIN', 'HR']`, vì
   BE của chúng chỉ cho hai vai trò này; không gắn thì CHIEF vào Cài đặt sẽ thấy thẻ bấm vào là 403. Thẻ Địa điểm
   và Loại phiếu giữ nguyên `permission`.

Không đổi gì ở `locations.vue`, `employees/new.vue`, `permission-guard.global.ts` (đã gác theo quyền từ hotfix
trước).

## ⑤ Scenario phải smoke (bấm thật)

Sandbox: `/tmp/claude-1000/-home-tuanpham-work-hr-system-hr-system-be/e8eae37c-82c1-4953-8da6-8aae8a60f42a/scratchpad/sandbox-anyrole.json`
(API `http://127.0.0.1:3163/v1`, CORS mở cho `http://localhost:4041`, vì 4040 bị ngrok chiếm). Chạy web dev ở
**4041** trỏ `NUXT_PUBLIC_BASE_API_URL=http://localhost:3163`. Không cần cờ tắt kiểm tra cùng nguồn của Chrome.

| # | Ai | Làm gì | Kỳ vọng |
|---|---|---|---|
| H1 | tb01 (CHIEF, chỉ Xem địa điểm — ca .118) | lưới phân hệ, sidebar | có module "Quản trị hệ thống", trong đó chỉ có "Cài đặt" (không Phân quyền, Tools, Logs, Test Notification) |
| H2 | tb01 | vào Cài đặt | chỉ thấy thẻ "Địa điểm chấm công"; vào thẻ thì thấy hai địa điểm và người được gán, không nút ghi nào |
| H3 | tb02 (CHIEF, Xem + Gán) | màn địa điểm | có nút gán và gỡ người, không nút thêm, sửa, vô hiệu hóa; gán rồi gỡ một người thành công |
| H4 | tp01 (MANAGER, đủ 5 quyền) | màn địa điểm | đủ bốn loại nút; tạo, sửa bán kính, vô hiệu hóa đều thành công (trả lại như cũ) |
| H5 | tb05 (CHIEF, chỉ quản lý loại phiếu) | Cài đặt | chỉ thấy thẻ "Loại phiếu đề xuất", vào được và tải danh sách không lỗi |
| H6 | tb03 (CHIEF, không quyền) | lưới phân hệ; gõ `/management/settings/locations` | không có module Quản trị hệ thống; gõ URL thì về `/management` kèm toast |
| H7 | hr01 (HR, "Nhân sự") | Cài đặt | đủ thẻ như trước: Địa điểm, Ca làm việc, Loại giấy tờ, Ngày lễ, Loại phiếu |
| H8 | hr02 (HR, không quyền địa điểm) | Cài đặt | thấy Ca làm việc, Loại giấy tờ, Ngày lễ; không thấy Địa điểm, không thấy Loại phiếu |
| H9 | admin | Cài đặt | đủ thẻ như trước |
| H10 | nv01 (EMPLOYEE) | trang chủ | không đổi, không vào được `/management` |

Chạy thêm `npm run build` và `npx vitest run` (2 bài đỏ sẵn trong `tests/leave.test.ts` có từ `main`, không tính).

## ⑥ Báo lại

File đã sửa, bảng smoke H1–H10 `# | Ai | Làm gì | Kỳ vọng | Thực tế | ✓/✗`, exit code build + vitest, chỗ doc lệch
code. **Không commit, không push**: session BE gom, qua cổng bảo mật rồi commit. Script smoke bấm thật (nếu viết) để
trong `tests/e2e/location-any-role/`, đọc mật khẩu từ file sandbox lúc chạy.

## ⑦ Giới hạn

Không sửa repo BE. BE trả sai so với bảng ③ thì dừng và báo, không workaround ở FE. Không mở thẻ Ca làm việc, Ngày
lễ, Loại giấy tờ cho vai trò ngoài ADMIN/HR. Không dừng sandbox `hr-rv2-*`.
