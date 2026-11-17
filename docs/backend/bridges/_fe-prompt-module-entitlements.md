# FE prompt — Quyền dùng module và tài khoản bị vô hiệu

> Handoff từ hr-system-be, ngày 05/11/2026. BE đã xong và đã smoke trên sandbox. Phần FE dưới đây là
> phần còn lại.

## 1. Repo và nhánh

- Repo: `/home/tuanpham/work/hr-system/nhan-su`
- Nhánh: `feat/module-entitlements`, đã tạo từ `develop`. Ba bridge doc `entitlements.md`, `auth.md`,
  `approval.md` đã được sync sẵn, chưa commit. Không commit, không push; báo lại để chủ dự án quyết định.

## 2. Đọc trước khi sửa

1. `nhan-su/CLAUDE.md`, nhất là mục cách gõ lệnh
2. File này
3. `docs/backend/bridges/entitlements.md`: đọc hết
4. `docs/backend/bridges/auth.md`: các dòng `AUTH_ACCOUNT_DISABLED`

## 3. Thay đổi API

| Endpoint | Thay đổi |
|---|---|
| `GET /v1/me/entitlements` | **Mới**, cần JWT. `{ modules: { code, label, state, reason, expiresAt }[] }` |
| Mọi route của 7 module | Có thể trả 403 `MODULE_NOT_SUBSCRIBED`, `MODULE_SUSPENDED`, `MODULE_READ_ONLY`, `MODULE_EXPIRED`. ADMIN cũng bị chặn |
| `GET /v1/approval/counts` | Trả 0 cho `overtimeRequests`, `onlineWorkRequests`, `businessTrips` khi module không `ENABLED` |
| `GET /v1/dashboard` | Dashboard quản lý: `pendingOT`, `pendingOnlineWork` về 0 khi module không `ENABLED`. Dashboard nhân viên: `pendingOT` chỉ về 0 khi `DISABLED`. Module `DISABLED` thì `recentActivity` bỏ mục của module đó, `hrAnalytics` bỏ số liệu hợp đồng. FE không cần tự lọc các số này |
| `POST /v1/social-insurance/me`, `PATCH /v1/company-announcements/:id/read`, `POST /v1/overtime-requests/preview` | Vẫn gọi được khi chỉ xem hoặc hết hạn, chỉ bị chặn khi `DISABLED` |
| `POST /v1/auth/login` | Thêm 403 `AUTH_ACCOUNT_DISABLED` khi đúng mật khẩu nhưng tài khoản bị vô hiệu |
| `POST /v1/auth/select-company` | Thêm 403 `AUTH_ACCOUNT_DISABLED` |
| `POST /v1/auth/switch` | Thêm 403 `AUTH_ACCOUNT_DISABLED` |
| `POST /v1/auth/refresh` | Không đổi shape. Tài khoản bị vô hiệu thì 401 `AUTH_TOKEN_EXPIRED` như phiên hết hạn |

Bản đồ module sang màn hình FE, đặt trong một hằng `MODULE_ROUTES` để thêm module sau này chỉ sửa một chỗ:

| Module | Prefix route |
|---|---|
| `AI_AGENT` | `/assistant`, `/agent-usage` |
| `REPORTS` | `/management/reports` |
| `OVERTIME` | `/management/overtime`, `/overtime`, `/overtime-requests` |
| `ONLINE_WORK` | `/management/online-work`, `/online-work`, `/online-work-requests` |
| `BUSINESS_TRIP` | `/management/business-trips`, `/business-trips` |
| `CONTRACT_INSURANCE` | `/management/contracts` |
| `ANNOUNCEMENT` | `/management/announcements`, `/announcements` |

## 4. File FE phải sửa

| File | Việc |
|---|---|
| `app/services/auth.service.ts` | Thêm `getEntitlements()` gọi `GET /v1/me/entitlements` qua auth fetch |
| `app/stores/auth.ts` | Lưu `modules`. Nạp sau `fetchMe`, sau login, select-company, switch. Xoá khi logout. Lỗi hay 404 thì để rỗng, không ném lỗi: rỗng nghĩa là coi mọi module dùng được |
| `app/composables/useModuleAccess.ts` | **Mới.** `MODULE_ROUTES`, `moduleState(code)`, `canUse(code)` (khác `DISABLED`), `canWrite(code)` (`ENABLED`), `moduleOfPath(path)`. Module không có trong danh sách hoặc danh sách rỗng thì trả về dùng được |
| `app/components/layout/AppSidebar.vue` | Ẩn mục menu thuộc module `DISABLED`: thêm trường `module` vào `NavItem` rồi lọc trong `visibleSections` |
| `app/components/layout/AppSidebarEmployee.vue` | Như trên, lọc ở chỗ `section.items.filter` |
| `app/middleware/module-guard.global.ts` | **Mới.** Đang vào route thuộc module `DISABLED` thì toast "{label} chưa được mở cho công ty này" rồi về `/management` với vai trò quản lý, `/` với nhân viên. Không chặn khi chưa nạp được danh sách |
| `app/services/http/auth.fetch.ts` | Gặp mã `MODULE_*`: **không** đăng xuất, tải lại entitlements ở nền, ném lỗi như thường cho trang xử lý |
| `app/pages/login.vue` | Thêm `AUTH_ACCOUNT_DISABLED` vào nhánh `errorMessage` ở dòng 93, và xử lý tương tự trong `chooseCompany` |
| `app/pages/management/approval/**` | Ẩn tab của `OVERTIME`, `ONLINE_WORK`, `BUSINESS_TRIP` khi module không `ENABLED` và không gọi API của tab đó |
| Trang danh sách của từng module | Khi `READ_ONLY`: ẩn nút tạo, sửa, duyệt và hiện một dòng báo, ghi rõ đã hết hạn nếu `reason` là `EXPIRED` |
| `app/pages/general-requests/**`, dashboard, widget chat nếu có | Tìm bằng `grep` các chỗ gọi API hay link tới module bị tắt: ẩn đi, không được hiện toast đỏ khi mở trang |
| Hồ sơ nhân viên, phần BHXH và hợp đồng | Khi `CONTRACT_INSURANCE` `DISABLED` thì ẩn phần đó, không để cả trang lỗi |

Không cần sửa màn hình phân quyền. Không cần đọc lại entitlements theo chu kỳ.

## 5. Scenario FE phải smoke

Chạy với BE sandbox do BE cung cấp, đăng nhập thật và bấm thật. Đặt quyền bằng control plane sandbox.

| # | Role | Thao tác | Mong đợi |
|---|---|---|---|
| 1 | ADMIN | Mọi module bật | Menu đủ như trước, không có lỗi console mới |
| 2 | ADMIN | Tắt `OVERTIME`, tải lại | Mất menu Làm thêm giờ |
| 3 | ADMIN | Tắt `OVERTIME`, gõ thẳng `/management/overtime` | Toast, về `/management`, không trắng trang |
| 4 | EMPLOYEE | Tắt `OVERTIME`, xem sidebar nhân viên và gõ `/overtime/my` | Mất menu, bị đưa về `/` |
| 5 | ADMIN | `READ_ONLY` `OVERTIME` | Vào được, không có nút tạo, có dòng báo |
| 6 | ADMIN | Hạn dùng đã qua | Như 5, dòng báo ghi đã hết hạn |
| 7 | ADMIN | Đang mở trang, người vận hành tắt module, đợi 30 giây, bấm tạo | Hiện `message` của BE, không đăng xuất, menu cập nhật |
| 8 | ADMIN | Tắt `OVERTIME`, mở Duyệt đơn và Dashboard | Không có tab Làm thêm giờ, không có toast đỏ, số đếm khớp |
| 9 | ADMIN | Tắt `AI_AGENT` | Mất Trợ lý AI, widget chat nếu có cũng ẩn |
| 10 | ADMIN | Tắt `CONTRACT_INSURANCE`, mở hồ sơ nhân viên | Trang vẫn dùng được |
| 11 | Tài khoản hai công ty | Module tắt ở A, bật ở B, chuyển công ty | Menu đổi theo công ty |
| 12 | Bất kỳ | Vô hiệu tài khoản, đăng nhập đúng mật khẩu | Hiện lý do ngay trên form, không chỉ toast |
| 13 | Bất kỳ | Vô hiệu tài khoản lúc đang dùng app, thao tác tiếp | Về trang đăng nhập, không kẹt vòng lặp refresh |
| 14 | ADMIN | BE bản cũ chưa có endpoint, hoặc endpoint lỗi | App chạy như trước, không khoá gì |
| 15 | Điện thoại 390 px | Sidebar và dòng báo | Không tràn ngang |

## 6. Báo lại

Danh sách file đã sửa, bảng smoke `# | Role | Thao tác | Mong đợi | Thực tế | ✓/✗`, kết quả
`npm run build` và `npx vitest run` kèm exit code, những chỗ lệch với bridge doc.

## 7. Giới hạn

- Không sửa repo BE. Không chạy lệnh nào ghi vào database thật.
- Không tự workaround ở FE một contract sai: sai contract thì báo lại để sửa ở BE.
- Không thêm package mới. Không commit, không push.
- Dừng server nào mình bật. Không tắt server dev ở cổng 3000, 3110, 4000, 4100, 4110.
