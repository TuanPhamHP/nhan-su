# FE prompt — Module Quản lý tài sản (`ASSET`)

> Handoff cho agent FE (RULE #2, pha P3). Backend đã xong, smoke xanh trên sandbox ngày 10/11/2026.
> Tự chứa: người nhận không thấy hội thoại bên BE.

## ① Repo và nhánh

- Repo: `/home/tuanpham/work/hr-system/nhan-su` (FE thật; `hr-system-fe` đã bỏ).
- Tách nhánh mới từ **`develop`** (chỉ `develop` có `MODULE_ROUTES`, entitlements), đặt tên
  `feat/asset-module`.
- BE ở `/home/tuanpham/work/hr-system/hr-system-be`, nhánh `feat/asset-module`, **chưa commit**.

## ② Đọc trước khi viết dòng code đầu tiên

1. `nhan-su/CLAUDE.md`
2. `nhan-su/docs/backend/bridges/assets.md` — contract đầy đủ: quyền, endpoint, type, mã lỗi, thông báo
3. `nhan-su/docs/backend/bridges/entitlements.md` — trạng thái module, mã `MODULE_*`
4. File này
5. `hr-system-be/docs/modules/15-assets.md` mục 11 (màn hình) và mục 13 (bảng gap, kèm số dòng FE đã soi)
6. `hr-system-be/docs/openapi.json` — **bản sống** để đối chiếu type. Không dùng `nhan-su/docs/api-endpoint.json`
   (chốt 04/08/2026, đã cũ)

## ③ Thay đổi API

Module mới, mọi route mới, không đổi route cũ. Tóm tắt (chi tiết ở bridge doc):

| Nhóm | Route | Ghi chú |
|---|---|---|
| Cài đặt | `/v1/asset-categories`, `/v1/asset-vendors` | Nhóm → Loại. Đơn vị sở hữu là chính công ty, không có màn hình (mã tài sản `CTYSTH000001` theo mã công ty) |
| Tài sản | `/v1/assets` (+ `/export`, `/:id/events`, `/:id/assignments`, `/:id/depreciation`, `/:id/status`, `/:id/license-key`) | `kind` = `PHYSICAL` hoặc `SERVICE`, khối `physical`/`service` |
| Cấp phát | `POST /v1/assets/:id/assignments`, `/transfer`, `POST /v1/asset-assignments/:id/return` | 201 có thể kèm `warnings: ['SEATS_EXCEEDED']` |
| Gia hạn, sửa, giấy tờ | `/v1/assets/:id/renewals`, `/v1/asset-maintenances`, `/v1/asset-documents` | URL file lấy khi bấm qua `GET .../documents/:id/url` |
| Báo cáo, nhập | `/v1/asset-reports/depreciation`, `/expiring`, `/v1/asset-imports` (+ `/template`) | |
| Hồ sơ nhân viên | `GET /v1/employees/:id/assets?open=true`, `POST .../return-all` | Tab Tài sản và hộp thoại nghỉ việc |
| Tự phục vụ | `/v1/me/assets`, `/v1/me/asset-services` | Chỉ cần JWT, mọi vai trò |

Điểm dễ sai:

- Vai trò **EMPLOYEE gọi route quản lý luôn 403**, kể cả có `asset:manage` (Q-17). EMPLOYEE chỉ dùng `/v1/me/...`.
- Trường tiền là `null` khi thiếu `asset:value:read`; ẩn cột theo cờ `canViewValue` của response.
- License key chỉ ADMIN và người phụ trách xem được bản đầy đủ; HR đặt được nhưng không xem được.
- Ngày thuần dạng `YYYY-MM-DD`. `PATCH` hiện **không xoá** được trường tuỳ chọn (gửi `null` là giữ nguyên):
  không tự workaround, cứ gửi nguyên form.
- Thông báo dùng bốn `refType` mới: `asset_holding`, `asset_service`, `asset`, `employee_assets` (bridge doc mục 9).

Permission mới: `asset:read`, `asset:value:read`, `asset:manage`. Module code mới: `ASSET`.

## ④ Màn hình phải làm

| Mã | Route | File | Ghi chú |
|---|---|---|---|
| UI-02 | `/management/assets` | `pages/management/assets/index.vue` | Bảng Tailwind + `CommonAppPagination` như trang Hợp đồng. Lọc, tìm, xuất Excel, nút Nhập Excel |
| UI-03, UI-05 | `/management/assets/[id]` | `pages/management/assets/[id].vue` | Tab theo `kind`. Thiết bị: Thông tin · Người dùng · Lịch sử · Sửa chữa · Khấu hao · Giấy tờ. Dịch vụ: Thông tin · Ghế · Gia hạn · Lịch sử · Giấy tờ |
| UI-04 | `/management/assets/services` | `pages/management/assets/services.vue` | Cột "Còn N ngày" tô màu theo `daysUntilRenewal` |
| UI-06 | Modal | `components/modules/asset/{AssignModal,TransferModal,ReturnModal}.vue` | Theo mẫu `RejectTripModal.vue`: Teleport, zod, phát `close` |
| UI-07 | `/management/assets/maintenances` | `pages/management/assets/maintenances.vue` | |
| UI-08 | `/management/assets/vendors` | `pages/management/assets/vendors.vue` | |
| UI-09 | `/management/assets/reports` | `pages/management/assets/reports.vue` | Khấu hao (có `asOf`) và Sắp hết hạn |
| UI-10 | `/management/assets/settings` | `pages/management/assets/settings.vue` | Loại tài sản, hiển thị theo Nhóm → Loại. **Không** có tab Đơn vị sở hữu |
| UI-14 | Modal trên UI-02 | `components/modules/asset/AssetImportModal.vue` | Tải mẫu, tải file lên, bảng lỗi theo sheet và dòng, báo `ignoredColumns`. Theo mẫu nhập hợp đồng |
| UI-11 | `/assets/my` | `pages/assets/my.vue` | Layout `employee`. Thẻ trên mobile, bảng từ `sm` như `overtime/my.vue`. Tab "Dịch vụ tôi phụ trách" khi `/v1/me/asset-services` không rỗng; nhận `?tab=services&open_id=` |
| UI-13 | Tab trong `pages/management/employees/[id].vue` | `components/modules/asset/EmployeeAssets.vue` | Thêm `'assets'` vào `validTabs`, gác bằng `canUse('ASSET') && hasPermission('asset:read')` |
| – | Hộp thoại cho nghỉ việc | tìm ở P0 | Cảnh báo còn giữ tài sản, nút Thu hồi tất cả. Không chặn việc cho nghỉ |

Hạ tầng: `ModuleCode` thêm `'ASSET'` (`types/entitlement.types.ts`); `MODULE_ROUTES.ASSET =
['/management/assets', '/assets']` (`composables/useModuleAccess.ts`); `ROUTE_PERMISSIONS`
(`/management/assets` → `asset:read`, `/management/assets/settings` → `asset:manage`); nhóm "Tài sản" trong
`AppSidebar.vue`, mục "Tài sản của tôi" trong `AppSidebarEmployee.vue` (badge `pendingConfirmationCount`), cả
hai có `module: 'ASSET'`; bốn `case` mới trong `app/utils/notification-route.ts`;
`<CommonAppModuleNotice module="ASSET" />` trên trang quản lý.

## ⑤ Kịch bản FE phải smoke (bấm thật trên UI)

| # | Role | Kịch bản | Kỳ vọng |
|---|---|---|---|
| 1 | HR | Cài đặt: tạo loại Laptop bắt buộc serial; sửa số tháng khấu hao một loại mặc định | Loại nằm dưới đúng nhóm; số tháng lưu được |
| 2 | HR | Tạo laptop bỏ trống serial, rồi nhập serial | Toast lỗi `ASSET_SERIAL_REQUIRED`; lần hai tạo được, mã theo mã công ty (VD `CTYSTH000001`) |
| 3 | HR | Tạo dịch vụ USD thiếu tỷ giá, ghi số thẻ đầy đủ ở ghi chú thanh toán | Toast `ASSET_EXCHANGE_RATE_REQUIRED`, `ASSET_PAYMENT_NOTE_INVALID`; form giữ nguyên dữ liệu |
| 4 | HR | Cấp laptop cho nhân viên A, rồi cấp tiếp cho B | Lần hai toast `ASSET_ALREADY_ASSIGNED`, gợi ý Điều chuyển |
| 5 | EMPLOYEE A | Mở Tài sản của tôi, bấm Không đúng không ghi lý do, rồi có lý do | Badge chờ xác nhận; lỗi lý do; sau đó trạng thái "Báo không đúng" |
| 6 | HR | Điều chuyển, mở và đóng phiếu sửa, thu hồi tình trạng Hỏng | Trạng thái đổi đúng bảng mục 7 của bridge doc; tab Lịch sử có đủ sự kiện |
| 7 | EMPLOYEE (người phụ trách dịch vụ) | Tab Dịch vụ tôi phụ trách: cấp ghế vượt số ghế, gia hạn, xem license key | Cảnh báo vàng `SEATS_EXCEEDED`; kỳ gia hạn mới; key hiện rồi tự che |
| 8 | HR | Bấm xem license key | Toast `ASSET_LICENSE_KEY_FORBIDDEN` |
| 9 | MANAGER | Danh sách tài sản, mở tài sản phòng khác qua URL | Chỉ thấy phòng mình, cột tiền ẩn; URL phòng khác hiện toast 403, không trắng trang |
| 10 | DIRECTOR | Tab Khấu hao, báo cáo khấu hao, xuất Excel | Thấy số tiền; file tải được |
| 11 | EMPLOYEE | Gõ thẳng `/management/assets` | Bị chặn như các trang quản lý khác |
| 12 | HR | Nhập Excel bằng file mẫu có thêm cột Password và một dòng lỗi | Bảng lỗi đúng sheet và dòng; dòng báo cột mật khẩu đã bỏ qua |
| 13 | HR | Upload hoá đơn PDF gắn 2 tài sản, mở file | Mở bằng presigned URL ở tab mới; cả hai tài sản đều thấy giấy tờ |
| 14 | ADMIN | Cho nghỉ việc người còn giữ tài sản | Hộp thoại cảnh báo + Thu hồi tất cả; cho nghỉ vẫn được |
| 15 | Mọi role | Bấm từng loại thông báo tài sản | Mở đúng trang theo `refType` (bridge doc mục 9) |
| 16 | – | Công ty có `ASSET` chỉ xem | Menu còn, nút tạo, sửa ẩn; Thu hồi, Xác nhận, Xem key vẫn bấm được |
| 17 | – | Công ty chưa đăng ký `ASSET` | Menu và tab Tài sản ẩn; gõ URL thì màn hình chặn |
| 18 | – | Rỗng, loading, phân trang, mobile 390 px ở `/assets/my` | Có trạng thái rỗng, skeleton, phân trang server |

Trước khi test được trên máy, **người dùng** phải làm (agent FE không tự làm, chỉ nhắc): apply migration
`20261110104741_create_asset_management_tables` (`npm run tenancy:migrate-all -- --apply`), seed quyền và
loại tài sản cho mọi công ty (`npm run tenancy:seed-all -- --apply`), cấp module `ASSET` cho công ty qua control
plane, thêm `ASSET_SECRETS_KEY` vào `.env` của BE. Thiếu bước cấp module thì mọi route trả 403 `MODULE_NOT_SUBSCRIBED`, đó không phải lỗi FE.

## ⑥ Báo lại cho BE

1. Danh sách file đã sửa hoặc tạo, theo thư mục.
2. Bảng smoke `# | Màn hình | Role | Thao tác | Kỳ vọng | Thực tế | ✓/✗` cho đủ 18 kịch bản trên; chưa chạy được
   dòng nào thì ghi rõ lý do.
3. `npm --prefix /home/tuanpham/work/hr-system/nhan-su run build` và `npx vitest run`: lệnh và exit code thật.
   Repo không có script `typecheck`, đừng báo đã chạy.
4. Chỗ bridge doc lệch với response thật hoặc thiếu thông tin: ghi endpoint, cái doc nói, cái API trả.

## ⑦ Giới hạn

- **Không sửa repo BE** (`hr-system-be`), kể cả docs.
- **Không tự workaround ở FE một contract sai.** Response khác bridge doc, thiếu field, sai mã lỗi thì dừng
  phần đó và báo lại, BE sửa.
- Không chạm database (RULE #0 bên BE): không SQL, không chạy migration hay seed, không bật module bằng tay.
- Không commit trừ khi người dùng bảo.
