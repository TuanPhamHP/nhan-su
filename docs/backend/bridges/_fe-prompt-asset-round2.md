# FE prompt — Tài sản đợt 2, lô 2a (web)

> Handoff cho agent FE (RULE #2, pha P3). Backend lô 2a xong và smoke 68/68 trên sandbox ngày 13/11/2026.
> Tự chứa: người nhận không thấy hội thoại bên BE.

Lô 2a gồm: bảo dưỡng định kỳ (F-11), báo hỏng và báo mất (F-12), biên bản bàn giao và thu hồi PDF (F-20),
trang tổng quan (F-22), báo cáo chi phí dịch vụ (RP-02), chi phí sửa chữa và bảo dưỡng (RP-05), Excel cho kế toán
(F-29), và hai trạng thái mới "Mất (chờ xác minh)", "Đang bảo dưỡng". Thanh lý, tem QR, kiểm kê là lô 2b, **chưa
có API, đừng làm**.

## ① Repo và nhánh

- Làm trong worktree **`/home/tuanpham/work/hr-system/.worktrees/fe-asset-round2`**, nhánh `feat/asset-round2` của
  `nhan-su`, đã tách từ `origin/develop` (31914d6). Không làm ở checkout chính `/home/tuanpham/work/hr-system/nhan-su`.
- Worktree chưa có `node_modules`: chạy `npm ci` trong worktree (repo dùng npm, `package-lock.json`).
- Nhánh đã có sẵn một thay đổi chưa commit: `docs/backend/bridges/assets.md` và
  `docs/backend/bridges/fcm-notification-routing.json` đồng bộ từ BE. Giữ nguyên, đừng sửa hai file này.
- BE lô 2a ở worktree `/home/tuanpham/work/hr-system/.worktrees/be-asset-round2` (nhánh `feat/asset-round2`,
  **chưa commit**, chưa có trên môi trường nào). Checkout BE chính `hr-system-be` **không có** lô 2a.

## ② Đọc trước khi viết dòng code đầu tiên

1. `fe-asset-round2/CLAUDE.md`
2. `fe-asset-round2/docs/backend/bridges/assets.md`, mục **"Đợt 2 — lô 2a"** ở cuối file (bảng nút theo trạng
   thái, màn hình, hàm service, chỉ xem, edge cases). Mục "TypeScript Types" phía trên đã cập nhật cho đợt 2, các
   dòng mới có chú thích `// đợt 2`. Thêm mục "Thông báo" và "Mã lỗi" (bảng "Đợt 2 — lô 2a").
3. File này.
4. `/home/tuanpham/work/hr-system/hr-system-be/docs/modules/15-assets.md` mục 16.8 (màn hình) và 16.10 (L9, L10 vì
   sao có hai trạng thái mới).
5. **Type đối chiếu với `/home/tuanpham/work/hr-system/.worktrees/be-asset-round2/docs/openapi.json`** (đã sinh lại
   cho lô 2a). Không dùng `hr-system-be/docs/openapi.json` (chưa có lô 2a) hay `nhan-su/docs/api-endpoint.json`.

## ③ Thay đổi API

Không đổi route cũ nào; thêm route và thêm field. Chi tiết, ví dụ JSON và mã lỗi ở bridge doc mục "Đợt 2 — lô 2a".

| Nhóm | Route | Ghi chú |
|---|---|---|
| Kiểu dữ liệu | `AssetStatus` + `LOSS_REPORTED`, `IN_MAINTENANCE`; `AssetCategory.defaultMaintenanceMonths`; `physical.maintenanceIntervalMonths`, `physical.nextMaintenanceDate`; `Asset.openIncidents[]`; `AssetMaintenance.type` có `MAINTENANCE`, `createdBy` có thể `null`; `AssetDocument.links[].incidentId`; 3 `AssetEventType` mới | Các `Record<AssetStatus, …>` ở `app/utils/asset.utils.ts` sẽ báo lỗi build cho tới khi thêm đủ hai trạng thái, đó là chủ ý |
| Bảo dưỡng | `POST /v1/assets`, `PATCH /v1/assets/:id` khối `physical`; `POST /v1/assets/:id/maintenances` với `type: 'MAINTENANCE'`; `GET /v1/asset-maintenances?type=` | Sửa tài sản gửi `maintenanceIntervalMonths: 0` là bỏ lịch |
| Báo hỏng, báo mất | `POST /v1/me/assets/:assetId/incidents` (multipart), `GET /v1/me/assets/incidents`, `GET /v1/asset-incidents`, `GET /v1/asset-incidents/:id`, `POST /v1/asset-incidents/:id/repair` · `/confirm-loss` · `/close` | Lọc `status`, `type`, `assetId` |
| Biên bản PDF | `GET /v1/asset-assignments/:id/handover-pdf?kind=assign\|return`, `GET /v1/me/assets/assignments/:id/handover-pdf?kind=` | Trả JSON `{ document, url }`, mở `url` ở tab mới |
| Báo cáo | `GET /v1/asset-reports/overview`; `service-costs` (+`/export`); `maintenance-costs` (+`/export`); `accounting-export` | Ba báo cáo tiền cần `asset:value:read` |
| Thông báo | `refType: 'asset_incident'` (N-06) → `/management/assets/incidents?open_id=:refId`; N-08 dùng `asset` sẵn có | |

Mã lỗi mới cần hiện toast tiếng Việt (dùng `error.message` của BE): `ASSET_INCIDENT_OPEN`, `ASSET_INCIDENT_NOT_ALLOWED`,
`ASSET_INCIDENT_HANDLED`, `ASSET_INCIDENT_TYPE_MISMATCH`, `ASSET_INCIDENT_TOO_MANY_PHOTOS`, `ASSET_INCIDENT_PHOTO_TYPE`,
`ASSET_FILE_TOO_LARGE`, `ASSET_INCIDENT_DATE_IN_FUTURE`, `ASSET_NOT_HELD`, `ASSET_LOSS_REPORTED`,
`ASSET_MAINTENANCE_INTERVAL_REQUIRED`, `ASSET_MAINTENANCE_OUTCOME_INVALID`, `ASSET_ASSIGNMENT_NOT_RETURNED`,
`ASSET_REPORT_RANGE_INVALID`, `ASSET_REPORT_RANGE_TOO_LONG`.

## ④ Màn hình và file phải sửa

| Màn | File | Việc |
|---|---|---|
| Kiểu, service | `app/types/asset.types.ts`, `app/services/asset.service.ts` | Kiểu và 15 hàm ở bridge doc, mục "Composable — hàm mới" |
| Nhãn, màu | `app/utils/asset.utils.ts` | Màu và nhãn cho `LOSS_REPORTED`, `IN_MAINTENANCE`, `MAINTENANCE`, nhãn cho 3 loại sự kiện mới và trạng thái báo cáo |
| Tổng quan, danh sách | `app/pages/management/assets/index.vue` | Phần Tổng quan (F-22) ở đầu trang; bộ lọc trạng thái thêm hai giá trị; biểu tượng cảnh báo khi `openIncidents` không rỗng |
| Chi tiết | `app/pages/management/assets/[id].vue`, `components/modules/asset/AssetInfoPanel.vue`, `AssetHoldersPanel.vue`, `AssetMaintenancePanel.vue`, `MaintenanceFormModal.vue`, `MaintenanceCloseModal.vue` | Khối bảo dưỡng định kỳ; tab mới Báo hỏng (component mới, gợi ý `AssetIncidentsPanel.vue`); nút Biên bản ở dòng cấp phát; phiếu Bảo dưỡng (mở tay, đóng chỉ Xong hoặc Huỷ); bật tắt nút theo bảng của bridge doc |
| Form tài sản | `components/modules/asset/AssetFormModal.vue` | Chu kỳ bảo dưỡng (0–120) và hạn kế tiếp cho thiết bị |
| Cài đặt | `app/pages/management/assets/settings.vue` | Chu kỳ bảo dưỡng mặc định của loại thiết bị |
| Sửa chữa | `app/pages/management/assets/maintenances.vue` | Lọc và cột Loại; `createdBy: null` hiện "Hệ thống" |
| Báo hỏng, báo mất | `app/pages/management/assets/incidents.vue` (mới) + hộp xử lý (component mới trong `components/modules/asset/`) | Danh sách mặc định `status=OPEN`, chi tiết có ảnh, bốn nút xử lý, nhận `?open_id=` |
| Báo cáo | `app/pages/management/assets/reports.vue` | Tab Chi phí dịch vụ, Chi phí sửa chữa bảo dưỡng, nút Xuất cho kế toán |
| Tài sản của tôi | `app/pages/assets/my.vue` + hộp báo hỏng (component mới) | Nút Báo hỏng, Báo mất; khu Báo cáo của tôi; nút Biên bản |
| Menu | `app/config/app-modules.ts` | Mục "Báo hỏng, báo mất" → `/management/assets/incidents` (`asset:read`, `module: 'ASSET'`); đổi "Sửa chữa" thành "Sửa chữa, bảo dưỡng" |
| Thông báo | `app/utils/notification-route.ts` | `case 'asset_incident'`, cập nhật bảng chú thích đầu file |

Theo mẫu sẵn có của module: modal theo `AssignModal.vue`, tải file bằng `downloadAssetBlob`, phân trang
`CommonAppPagination`, thông báo module `<CommonAppModuleNotice module="ASSET" />`. Route mới
`/management/assets/incidents` đã nằm dưới prefix `/management/assets` nên guard quyền và module tự áp dụng.

## ⑤ Kịch bản FE phải smoke (bấm thật trên UI)

### Dựng môi trường (không đụng database thật)

1. Chạy nền: `node /home/tuanpham/work/hr-system/.worktrees/_asset-round2-scratch/fe-sandbox.cjs`. Mất khoảng 2
   phút; xong khi in `READY`. Tài khoản, mật khẩu và ID dữ liệu mẫu in ra stdout và ghi ở
   `/home/tuanpham/work/hr-system/.worktrees/_asset-round2-scratch/fe-sandbox.json`. Sandbox dùng container
   Postgres, Redis dùng một lần (cổng 55440, 56440), API ở `http://localhost:3140`, S3 giả ở cổng 56450.
2. Tạo `fe-asset-round2/.env.sandbox` bằng cách chép `/home/tuanpham/work/hr-system/nhan-su/.env.local` rồi đổi
   `NUXT_PUBLIC_BASE_API_URL=http://localhost:3140`. File này đã nằm trong `.gitignore` (`.env.*`).
3. Dev server: `npx nuxt dev --dotenv .env.sandbox --port 4000` trong worktree FE. **Phải là cổng 4000**: API chỉ
   cho CORS `http://localhost:4000` và `http://127.0.0.1:4000`.
4. Bấm bằng Playwright (`@playwright/test` đã có; mẫu ở `tests/e2e/*.mjs`), chụp màn hình các bước chính.
5. Xong thì dừng sandbox bằng `kill -TERM <pid của tiến trình node fe-sandbox.cjs>` để nó tự xoá container. Muốn
   dữ liệu sạch lại thì dừng rồi chạy lại. Không chạy song song với bài diễn tập khác của BE (trùng tên container).

Dữ liệu mẫu, công ty `cta`: Laptop 1 của nhân viên A có một báo hỏng đang chờ (2 ảnh) và một đã đóng; Laptop 2 của
A đang "Mất (chờ xác minh)"; Laptop 3 đã giao rồi thu hồi từ nhân viên B; Laptop 4 trong kho, có phiếu sửa xong
1.200.000; Laptop 5 giao B chưa xác nhận; Laptop 6 của A chưa có báo cáo nào (dùng để thử form báo hỏng, báo
mất); Điều hoà Daikin "Đang bảo dưỡng" với phiếu hệ thống tự mở; Điều hoà
Panasonic (MANAGER giữ) còn 10 ngày tới hạn bảo dưỡng; ChatGPT Team (150 USD/tháng, A phụ trách) và tên miền
(1.200.000/năm). Công ty `ctro` ở chế độ chỉ xem, `ctoff` chưa cấp module.

### Kịch bản

| # | Role | Kịch bản | Kỳ vọng |
|---|---|---|---|
| 1 | HR | Mở `/management/assets` | Tổng quan: tổng 10, có thẻ "Mất (chờ xác minh)" 1 và "Đang bảo dưỡng" 1, chi phí dịch vụ tháng 4.000.000, sắp bảo dưỡng 1, chờ xác nhận 5, báo hỏng đang mở 2; bấm thẻ dẫn tới đúng danh sách. Số lấy từ sandbox mới chạy, chưa bấm gì |
| 2 | MANAGER | Mở `/management/assets` | Chỉ tài sản phòng Kỹ thuật; không có thẻ, cột tiền nào |
| 3 | HR | Lọc trạng thái "Mất (chờ xác minh)", rồi "Đang bảo dưỡng" | Ra Laptop 2, rồi Điều hoà Daikin; Laptop 1, 2 có biểu tượng báo hỏng, báo mất |
| 4 | HR | Trang Báo hỏng, báo mất | Mặc định 2 báo cáo đang chờ; mở chi tiết thấy 2 ảnh (mở được); bỏ lọc thấy cả báo cáo đã đóng |
| 5 | HR | Laptop 1: Tạo phiếu sửa | Báo cáo "Đã tạo phiếu sửa", tài sản "Đang sửa", phiếu sửa mới có mô tả và ảnh; bấm lại ở tab cũ → toast `ASSET_INCIDENT_HANDLED` |
| 6 | HR | Laptop 2: Đã tìm thấy; rồi nhân viên A báo mất lại; HR Xác nhận mất với ngày mất hôm qua | Lần một tài sản về "Đang sử dụng"; lần hai tài sản "Mất", không còn người giữ, tab Khấu hao dừng từ hôm qua |
| 7 | MANAGER | Trang Báo hỏng, báo mất | Thấy báo cáo của phòng mình, không có nút xử lý |
| 8 | EMPLOYEE A | `/assets/my`, Laptop 6: thử form báo hỏng với 11 ảnh, ảnh 6 MB, file PDF, ngày mai; rồi gửi thật với 2 ảnh | Bốn trường hợp đầu bị chặn ngay ở form (nếu lọt thì toast đúng mã); lần gửi thật thành công |
| 9 | EMPLOYEE A | Laptop 6 sau kịch bản 8: báo hỏng lần nữa; Laptop 1 (đã có báo hỏng mở); Laptop 2 (đang chờ xác minh) | Nút Báo hỏng của Laptop 6 và Laptop 1 đã ẩn (hoặc toast `ASSET_INCIDENT_OPEN`), Báo mất vẫn còn; Laptop 2 không có nút báo, hiện nhãn trạng thái |
| 10 | EMPLOYEE A | Khu Báo cáo của tôi | Có báo cáo vừa gửi, đúng trạng thái xử lý, mở được ảnh của mình |
| 11 | EMPLOYEE A, B | Nút Biên bản: A trên Laptop 6; B trên Laptop 3 (lịch sử) bản bàn giao và bản thu hồi | PDF mở ở tab mới, số `BBG-…`, `BBTH-…`; bấm lại ra cùng tài liệu |
| 12 | HR | Chi tiết Laptop 3 và Laptop 5, tab Người dùng | Laptop 3 có cả hai biên bản; Laptop 5 (chưa thu) chỉ có biên bản bàn giao |
| 13 | HR | Chi tiết Điều hoà Daikin: tab Sửa chữa, đóng phiếu bảo dưỡng Xong | Phiếu loại "Bảo dưỡng", người tạo "Hệ thống"; không có lựa chọn "Không sửa được"; sau khi đóng tài sản "Sẵn sàng", hạn kế tiếp = hôm nay + 6 tháng |
| 14 | HR | Mở phiếu bảo dưỡng tay cho Laptop 4, rồi Huỷ; thử Cấp phát khi đang bảo dưỡng | Tài sản "Đang bảo dưỡng" rồi về "Sẵn sàng"; nút Cấp phát ẩn khi đang bảo dưỡng |
| 15 | HR | Form sửa tài sản: đặt chu kỳ 3 và hạn; đặt chu kỳ 0; nhập hạn khi chưa có chu kỳ | Lưu được; chu kỳ 0 thì bỏ lịch; trường hợp ba bị chặn ở form hoặc toast `ASSET_MAINTENANCE_INTERVAL_REQUIRED` |
| 16 | HR | Cài đặt: chu kỳ bảo dưỡng mặc định của loại Ghế là 3, rồi tạo một ghế | Ghế mới có chu kỳ 3, hạn = hôm nay + 3 tháng |
| 17 | HR | Trang Sửa chữa, bảo dưỡng: lọc theo loại | Cột Loại đúng; phiếu hệ thống hiện "Hệ thống" |
| 18 | DIRECTOR | Báo cáo: Chi phí dịch vụ tháng này, xuất Excel; Chi phí sửa chữa 30 ngày qua, xuất Excel; Xuất cho kế toán 12 tháng; thử 13 tháng | Tổng 4.000.000 (3.900.000 + 100.000); có dòng Laptop 4 1.200.000; ba file tải được; 13 tháng bị chặn ở form hoặc toast `ASSET_REPORT_RANGE_TOO_LONG` |
| 19 | MANAGER | Mở trang Báo cáo; gõ thẳng URL tab chi phí nếu có | Không thấy ba phần tiền; không trắng trang |
| 20 | HR | Chuông thông báo: bấm thông báo báo hỏng (N-06) và thông báo đến hạn bảo dưỡng (N-08) | N-06 mở trang Báo hỏng với hộp chi tiết đúng báo cáo; N-08 mở chi tiết Điều hoà Daikin |
| 21 | ADMIN `ctro` | Công ty chỉ xem | Trang, báo cáo, Excel, biên bản PDF vẫn dùng; nút báo hỏng, xử lý báo cáo, mở phiếu bảo dưỡng ẩn |
| 22 | ADMIN `ctoff` | Công ty chưa cấp module | Không có menu Tài sản; gõ `/management/assets/incidents` bị chặn |
| 23 | EMPLOYEE A | Gõ `/management/assets/incidents` | Bị chặn như các trang quản lý khác |
| 24 | – | Rỗng, loading, phân trang, màn 390 px ở `/assets/my` và trang Báo hỏng | Có trạng thái rỗng, skeleton; hộp báo hỏng dùng được trên màn hẹp |

## ⑥ Báo lại cho BE

1. Danh sách file đã sửa hoặc tạo, theo thư mục.
2. Bảng smoke `# | Màn hình | Role | Thao tác | Kỳ vọng | Thực tế | ✓/✗` đủ 24 kịch bản; chưa chạy được dòng nào thì
   ghi lý do. Kèm đường dẫn ảnh chụp.
3. `npm --prefix /home/tuanpham/work/hr-system/.worktrees/fe-asset-round2 run build` và `npx vitest run` (trong
   worktree): lệnh và exit code thật. Repo không có script `typecheck`, đừng báo đã chạy.
4. Chỗ bridge doc lệch với response thật hoặc thiếu thông tin: ghi endpoint, doc nói gì, API trả gì.
5. Xác nhận đã dừng sandbox (`docker ps` không còn `hr-drill-*`).

## ⑦ Giới hạn

- **Không sửa repo BE** (`hr-system-be` và worktree `be-asset-round2`), kể cả docs, và không sửa script trong
  `_asset-round2-scratch/`. Sandbox lỗi thì dừng và báo lại.
- **Không tự workaround ở FE một contract sai.** Response khác bridge doc, thiếu field, sai mã lỗi thì dừng phần
  đó và báo lại; BE sửa.
- Không chạm database thật: không SQL, không chạy migration hay seed, không bật module bằng tay. Chỉ dùng sandbox.
- Không commit, không push trừ khi người dùng bảo.

---

# Bổ sung 13/11: hai thẻ Tổng quan bấm được

User đã duyệt việc làm hai thẻ "Sắp bảo dưỡng 30 ngày" và "Chờ người nhận xác nhận" bấm được. BE đã thêm bộ lọc,
smoke 17/17 trên sandbox, chạy lại smoke cũ 68/68.

**① Repo, nhánh:** như trên, worktree `/home/tuanpham/work/hr-system/.worktrees/fe-asset-round2`, nhánh
`feat/asset-round2`. Giữ nguyên các thay đổi lô 2a chưa commit.

**② Đọc trước:** `docs/backend/bridges/assets.md`, mục `GET /v1/assets — Danh sách` (bảng Query có hai dòng mới),
bảng "Màn hình web lô 2a" dòng `/management/assets`, bốn dòng cuối của "Edge cases lô 2a".

**③ Thay đổi API** (không đổi response, chỉ thêm query):

| Query | Kiểu | Nghĩa |
|---|---|---|
| `maintenanceDueWithinDays` | number 1–365 | Thiết bị Sẵn sàng hoặc Đang sử dụng có hạn bảo dưỡng ≤ hôm nay + N ngày, gồm cả quá hạn |
| `pendingConfirmation` | `true` | Tài sản có cấp phát đang chờ người nhận xác nhận |

- Áp dụng cho `GET /v1/assets` và `GET /v1/assets/export`. Giá trị sai trả 400 `BAD_REQUEST`.
- `overview.maintenanceDueIn30Days` bằng `meta.total` của `?maintenanceDueWithinDays=30`, và
  `overview.pendingConfirmations` bằng `meta.total` của `?pendingConfirmation=true`, trong phạm vi người xem.
- `pendingConfirmations` giờ đếm số tài sản, trước đây đếm số lần cấp phát. Trên dữ liệu thật hai số này bằng nhau.

**④ File phải sửa:**
- `app/types/asset.types.ts`: thêm `maintenanceDueWithinDays?: number` và `pendingConfirmation?: boolean` vào
  `AssetQueryParams`.
- `app/components/modules/asset/AssetOverviewPanel.vue`: hai thẻ thành link tới
  `/management/assets?maintenanceDueWithinDays=30` và `/management/assets?pendingConfirmation=true`, giống hai thẻ đã
  bấm được.
- `app/pages/management/assets/index.vue`:
  - Đọc hai tham số từ URL lúc vào trang và khi URL đổi (bấm thẻ ngay trên chính trang này).
  - Hiện thành nhãn lọc dễ hiểu, ví dụ "Sắp đến hạn bảo dưỡng (30 ngày)" và "Chờ người nhận xác nhận", mỗi nhãn có
    nút bỏ. Bỏ nhãn thì xoá tham số khỏi URL.
  - Giữ hai tham số khi đổi trang, khi lọc thêm bằng các ô có sẵn và khi bấm Xuất Excel.
  - Danh sách rỗng thì câu trạng thái rỗng phải nói rõ đang lọc gì.

**⑤ Smoke trên sandbox** (cùng cách dựng như trên):

| # | Role | Thao tác | Kỳ vọng |
|---|---|---|---|
| F1 | HR | Bấm thẻ "Sắp bảo dưỡng" | URL có `maintenanceDueWithinDays=30`; đúng 1 dòng Điều hoà Panasonic; có nhãn lọc; số dòng bằng số trên thẻ |
| F2 | HR | Bấm thẻ "Chờ xác nhận" | URL có `pendingConfirmation=true`; đúng 5 dòng (Panasonic, Laptop 1, 2, 5, 6) |
| F3 | HR | Đang ở F2: lọc thêm Phòng ban = Kế toán, sang trang khác nếu có, rồi Xuất Excel | Chỉ còn Laptop 5; file Excel cũng chỉ có Laptop 5 |
| F4 | HR | Bấm nút bỏ nhãn | Về đủ 10 tài sản; URL không còn tham số |
| F5 | NV A rồi HR | A bấm "Đã nhận" Laptop 6 ở `/assets/my`; HR tải lại Tổng quan, bấm thẻ chờ xác nhận | Thẻ còn 4, danh sách 4 dòng, không có Laptop 6 |
| F6 | MANAGER | Bấm hai thẻ | Chỉ tài sản phòng Kỹ thuật; số khớp thẻ của chính họ |
| F7 | HR | Gõ tay `?maintenanceDueWithinDays=abc` | Không trắng trang; bỏ qua tham số sai, hoặc toast lỗi lịch sự rồi về danh sách đủ |
| F8 | HR | Màn 390 px | Nhãn lọc không tràn ngang |

**⑥ Báo lại:** file đã sửa, bảng F1–F8 kèm ảnh chụp, exit code thật của build và vitest, chỗ lệch doc, xác nhận đã
dừng sandbox.

**⑦ Giới hạn:** như mục ⑦ ở trên.

---

# Đợt sửa sau bài nhập vai, phần A: lỗi web không cần đổi API (14/11)

Bài nhập vai toàn luồng lô 2a (HR, tổng giám đốc, hai trưởng phòng, nhân viên văn phòng và hiện trường) đã xong.
User duyệt sửa toàn bộ P1 và P2. Phần A dưới đây là các lỗi **chỉ nằm ở web**, không cần contract mới, nên làm
ngay. Phần B (luồng xử lý "báo chưa đúng", trạng thái mất, biên bản điều chuyển, thông báo mới, nhãn mới) BE sẽ
gửi sau khi xong backend và tài liệu; đừng đoán trước contract của phần B.

Nguồn chi tiết, có ảnh và vị trí code: `/home/tuanpham/work/hr-system/.worktrees/_asset-round2-scratch/roleplay/`
gồm `findings.md` (mã phát hiện như H1, F4, M1) và `copy-review.md` (bảng câu chữ, mục 1–81, cùng mục 3 và 4).

**① Repo, nhánh:** như trên, worktree `/home/tuanpham/work/hr-system/.worktrees/fe-asset-round2`, nhánh
`feat/asset-round2`. Giữ nguyên các thay đổi lô 2a chưa commit.

**② Đọc trước:** `nhan-su/CLAUDE.md`; `copy-review.md` đủ bốn mục (bảng thuật ngữ ở mục 4 là chuẩn); trong
`findings.md` các dòng có mã nêu ở ③ và ④; bridge doc `docs/backend/bridges/assets.md` như cũ.

**③ Thay đổi API:** không có. Mọi việc dưới đây dùng response hiện tại. Riêng nhãn trạng thái: BE sẽ đổi một số
nhãn ở phần B (danh sách ở cuối mục ④); phần A cứ thống nhất bộ nhãn web theo danh sách đó.

**④ Việc phải làm, theo thứ tự ưu tiên:**

P1, sửa trước:

| Mã | File | Việc |
|---|---|---|
| H1 | `app/components/ui/SelectInput.vue:14,24,157` | Ô tìm nằm trong trigger có `@keydown.space.prevent="openDropdown()"`, phím cách nổi bọt lên nên bị chặn và `openDropdown()` xoá `searchQuery`. Thêm `@keydown.space.stop` ở ô tìm (hoặc trigger bỏ qua khi đang mở). Bấm ra ngoài không được mất lựa chọn đã chọn. Component dùng chung toàn app: smoke thêm một màn ngoài module tài sản |
| F1, F2 | `components/modules/asset/ReportIncidentModal.vue` | Ảnh JPG, PNG lớn hơn khoảng 2 MB thì nén bằng canvas (cạnh dài tối đa 2048 px, JPEG chất lượng 0,8) trước khi gửi, không thêm package. HEIC trình duyệt không đọc được thì giữ nguyên nếu ≤ 5 MB. Còn ảnh nào không hợp lệ thì **nút Gửi tắt** và có dòng giải thích ngay dưới ô ảnh; không bao giờ gửi đi mà lặng lẽ bỏ ảnh |
| F4 | `app/pages/assets/my.vue:297,350,512` | Nút "Đã nhận" hiện cả khi `confirmation === 'DISPUTED'` (BE đã cho xác nhận từ trạng thái này); thẻ trên điện thoại hiện lại lý do đã gửi; câu trong hộp thoại khớp hành vi |
| M1 | `pages/management/assets/reports.vue:55,75-84`, tab Khấu hao ở `[id].vue` | Người không có `asset:value:read` (trưởng phòng) không thấy các tab tiền, tab mặc định là tab họ xem được; không bao giờ in câu lỗi gốc của request bị từ chối |
| CR-1, CR-2 | `app/services/http/auth.fetch.ts` (`_wrap`, dòng 56) | Không có response: "Chưa gửi được vì mạng bị gián đoạn. Thông tin bạn nhập vẫn còn trên màn hình, bạn bấm gửi lại khi có mạng." Mã 413: câu dung lượng. Mã 5xx không có `error.message`: câu xin lỗi ở copy-review mục 1. Request dạng blob (xuất Excel, file mẫu): đọc lại `err.data.text()` rồi `JSON.parse` để lấy `error.message` của BE. Không bao giờ hiện URL, `[GET]`, `Failed to fetch` |
| Toast | `app/composables/useToast.ts:16` | Toast lỗi ở lại ít nhất 8 giây hoặc tới khi người dùng đóng; toast thành công giữ 3 giây |
| Thuật ngữ | toàn module | Thao tác giao tài sản là **Cấp phát** (nút, tiêu đề hộp, toast, cột "Ngày cấp phát"); "bàn giao" chỉ còn trong tên giấy tờ "Biên bản bàn giao". **Điều chuyển** giữ nguyên (user đã chốt). **Thu hồi** ở mọi chỗ đang ghi "thu", "trả" (riêng "Ngày dự kiến trả" giữ). Nút "Không đúng" thành **Báo chưa đúng**. Bảng đủ ở copy-review mục 4 |
| Câu chữ cao | xem copy-review | Mục 1, 2, 13 phía web: toast thành công có mã, tên, người liên quan (mục 14–29), trạng thái rỗng phân biệt "chưa có" với "lọc không ra" (mục 50, 72, 73) |
| O3 | `app/pages/assets/my.vue` | Bấm "Đã nhận" mở hộp hỏi lại có dòng "Bấm Đã nhận nghĩa là bạn xác nhận đã nhận đủ tài sản đúng như mô tả." |
| M3 | `pages/management/assets/index.vue` | Trưởng phòng: ô lọc phòng ban chỉ có phòng của họ (hoặc ẩn), không để chọn phòng khác rồi ăn toast 403 |
| M4, G7, H14, F6 | danh sách tài sản, `/assets/my`, trang Báo hỏng | Màn ≤ 640 px: danh sách dạng thẻ thay bảng bóp nhỏ; vùng cuối trang chừa đủ chỗ để nút tròn Trợ lý AI không che dòng cuối hay hộp lọc |

P2, làm cùng đợt:

| Mã | Việc |
|---|---|
| G1 | Báo cáo chi phí sửa chữa: có nút chọn nhanh "Tháng này", "Tháng trước", "3 tháng gần nhất", "Năm nay"; mặc định "3 tháng gần nhất"; kỳ trống thì câu rỗng gợi ý đổi kỳ |
| G2 | Danh sách lọc `maintenanceDueWithinDays`: thêm cột "Hạn bảo dưỡng" (`physical.nextMaintenanceDate`), quá hạn tô đỏ kèm chữ "Quá hạn N ngày" |
| G4 | Tab Khấu hao: ô "Khấu hao mỗi tháng"; đánh dấu dòng tháng hiện tại; giải thích ngắn vì sao giá trị cuối tháng khác "Còn lại đến hôm nay" |
| G9 | Mọi ngày hiển thị `dd/mm/yyyy`, tháng `mm/yyyy` (ô kỳ, cột tháng, câu "tháng 2026-11") |
| G10 | Tổng quan: tách số thiết bị và dịch vụ; nhóm trạng thái thiết bị riêng, dịch vụ riêng; dòng "Chưa giao" ghi "Chưa cấp phát" và xếp cuối |
| G12 | Toast sau khi tải Excel; mỗi nút Xuất có một dòng mô tả file gồm gì |
| B3, F10, L9, L10, G18 | Bấm thông báo mở đúng chỗ: thông báo báo hỏng/mất mở hộp chi tiết đúng báo cáo **kể cả khi báo cáo đã xử lý** (trang Báo hỏng nhận `open_id` mà không phụ thuộc bộ lọc mặc định); thông báo phía nhân viên cuộn tới đúng thẻ; bấm dòng ở trang Sửa chữa mở phiếu, không nhảy tab Thông tin |
| M5 | Số đỏ cạnh "Tài sản của tôi" giảm ngay sau khi bấm Đã nhận |
| F5 | Thẻ tài sản đang báo hỏng hay báo mất có huy hiệu đúng (không để xanh "Đã nhận") |
| O4, O8 | Dòng ở "Tài sản của tôi" bấm mở được chi tiết (tình trạng lúc cấp phát, người cấp phát, ngày, ghi chú, biên bản); khi không giữ gì có câu "Bạn hiện không giữ tài sản nào" |
| H13 | Toast tạo tài sản có mã vừa sinh, kèm nút mở tài sản |
| H7, H10, H12 | Câu dưới ô hạn bảo dưỡng khi loại có chu kỳ mặc định; ô nguyên giá có dấu chấm phân cách khi gõ; bỏ chữ "sudo" ở hộp Nhập Excel |
| B11 | Cấp phát cho phòng ban: ô người chịu trách nhiệm ưu tiên người trong phòng đó, gợi ý trưởng phòng |
| F7 | Màn điện thoại: nút cao tối thiểu 44 px, nút đóng hộp có nhãn, chữ xám đủ tương phản |
| G17, G19, D10, L14, O9, F8 | Câu chữ và trợ năng còn lại nêu trong `findings.md` (Esc đóng hộp, `aria-label` cho nút ×, gợi ý dưới ô "Đã làm", bỏ chữ "khấu hao" khỏi hộp báo mất của nhân viên, "Kéo thả file" trên điện thoại) |
| Câu chữ còn lại | Mọi mục phía web trong copy-review từ 47 đến 81 và mục 3 (khung lỗi tại chỗ có nút Thử lại thay vì câu rỗng; hộp xác nhận cho Xoá giấy tờ, Xoá license key, Thu hồi ghế, Thu hồi tất cả trong hộp nghỉ việc; hộp xử lý báo cáo không đóng khi lỗi mạng; nút bị tắt có lý do) |

Bộ nhãn web phải khớp (BE đổi sang đúng bộ này ở phần B; FE lấy `…Label` từ response khi có, bộ nhãn tại chỗ chỉ
dùng cho ô lọc):

| Nhóm | Nhãn |
|---|---|
| Loại hình | `PHYSICAL` Thiết bị · `SERVICE` Dịch vụ thuê bao |
| Trạng thái | Sẵn sàng · Đang sử dụng · Đang sửa · `BROKEN` Hỏng · Mất · `LOSS_REPORTED` Chờ xác minh mất · Đang bảo dưỡng · Đã thanh lý · Đang hoạt động · Hết hạn · Đã huỷ |
| Tình trạng | Mới · Tốt · Trầy xước · Có lỗi nhỏ · Hỏng |
| Chu kỳ | Hằng tháng · Hằng quý · Hằng năm · `ONE_TIME` Mua đứt |
| Xác nhận | `PENDING` Chờ người nhận xác nhận · Đã nhận · `DISPUTED` Người nhận báo chưa đúng · Không cần xác nhận |
| Phiếu | `OPEN` Mới mở · Đang xử lý · Xong · Không sửa được · Đã huỷ |
| Nhà cung cấp | `SUPPLIER` Bán thiết bị · Sửa chữa · `SERVICE` Cung cấp dịch vụ |
| Giấy tờ | `HANDOVER_RECORD` Biên bản bàn giao, thu hồi |

**⑤ Smoke:**

Sandbox là tài nguyên dùng chung với BE (cùng tên container, cùng cổng). **Trước khi dựng, nhắn session
`hr-system-be-f4` và chờ trả lời đồng ý; dừng xong thì nhắn lại.** Trong lúc chờ cứ sửa code. Dữ liệu giàu hơn cho
phần A: `node /home/tuanpham/work/hr-system/.worktrees/_asset-round2-scratch/roleplay-sandbox.cjs` (công ty
logistics `cta`, 18 tài sản, 10 tài khoản; thông tin ghi ở `roleplay-sandbox.json` cùng thư mục) chạy với bản web
production build theo `serve-web.cjs`; hoặc `fe-sandbox.cjs` như phần trên.

| # | Role | Thao tác | Kỳ vọng |
|---|---|---|---|
| A1 | HR | Cấp phát, gõ "Bùi Thị" trong ô người nhận | Chữ giữ nguyên, lọc đúng; chọn xong bấm ra ngoài không mất lựa chọn. Làm lại ở một form ngoài module tài sản |
| A2 | NV hiện trường, 390 px | Báo hỏng với một ảnh JPG 6–8 MB, rồi thêm một file PDF | Ảnh JPG được nén và gửi kèm, báo cáo có 1 ảnh; khi còn file PDF thì nút Gửi tắt, có câu giải thích |
| A3 | NV | Báo chưa đúng một cấp phát, rồi bấm Đã nhận | Nút Đã nhận vẫn còn, có hộp hỏi lại, xác nhận được; thẻ điện thoại hiện lý do đã gửi |
| A4 | Trưởng phòng | Mở Báo cáo, chi tiết một tài sản | Không có tab tiền, không có chữ tiếng Anh |
| A5 | NV | Tắt mạng (`context.setOffline(true)`), gửi báo hỏng | Toast tiếng Việt về mạng, ở lại đủ lâu; form giữ chữ và ảnh |
| A6 | HR | Xuất Excel kế toán với kỳ 13 tháng (gõ URL nếu form chặn) | Toast là câu tiếng Việt của BE, không phải URL |
| A7 | HR | Đi hết cấp phát, điều chuyển, thu hồi, mở và đóng phiếu, tạo tài sản | Mọi nút, tiêu đề, toast dùng đúng thuật ngữ; toast có mã và tên |
| A8 | Trưởng phòng | Ô lọc phòng ban | Chỉ phòng mình hoặc không có ô |
| A9 | Mọi vai, 390 px | Danh sách tài sản, Tài sản của tôi, Báo hỏng | Dạng thẻ, không vuốt ngang, nút Trợ lý AI không che dòng cuối |
| A10 | Tổng giám đốc | Báo cáo chi phí sửa chữa | Mặc định 3 tháng; có nút Tháng trước; ngày dạng dd/mm/yyyy |
| A11 | HR | Thẻ "Sắp bảo dưỡng" | Có cột hạn, dòng quá hạn đỏ |
| A12 | Trưởng phòng, NV | Bấm từng thông báo trong chuông | Mở đúng báo cáo, đúng thẻ, kể cả báo cáo đã xử lý |
| A13 | – | Một panel ở trang chi tiết khi API lỗi (chặn request bằng `page.route`) | Khung lỗi có nút Thử lại, không phải câu "Chưa có …" |

**⑥ Báo lại:** file đã sửa theo thư mục; bảng A1–A13 kèm ảnh; exit code thật của `npm run build` và
`npx vitest run`; mục nào trong copy-review đã sửa, mục nào để lại và vì sao; chỗ cần BE (nếu thấy contract thiếu
thì ghi, đừng tự chế); xác nhận đã dừng sandbox.

**⑦ Giới hạn:** như mục ⑦ ở trên. Thêm: không thêm package mới (nén ảnh bằng canvas); phần B chưa có contract thì
đừng làm trước.

---

# Đợt sửa sau bài nhập vai, phần B: web theo contract mới (14/11)

Backend đã xong và smoke 81/81 trên sandbox nhập vai (smoke lô 2a cũ 67/68, dòng lệch là phạm vi trưởng phòng đổi có
chủ ý). Phần B là chỗ web phải đổi theo contract mới. Làm sau hoặc xen với phần A, tuỳ bạn; phần A vẫn giữ nguyên.

**① Repo, nhánh:** như trên, worktree `/home/tuanpham/work/hr-system/.worktrees/fe-asset-round2`, nhánh
`feat/asset-round2`. Backend ở worktree `be-asset-round2`, cần migration mới
`20261114075502_add_asset_assignment_end_reason_and_dispute_response` (sandbox tự chạy).

**② Đọc trước:**
1. `docs/backend/bridges/assets.md`, mục cuối **"Đợt 2 — sửa sau bài nhập vai (14/11/2026)"**: kiểu dữ liệu, nhãn
   đổi, endpoint mới, bảng hành vi đổi, thông báo, mã lỗi, bảng "Màn hình web cần đổi", edge cases.
2. `docs/backend/bridges/fcm-notification-routing.json`: năm `type` mới, `refType` mới `asset_my_incident`.
3. Nội dung thông báo: `/home/tuanpham/work/hr-system/.worktrees/be-asset-round2/docs/notifications/notification-content-map.md`
   mục Tài sản.
4. Type đối chiếu `/home/tuanpham/work/hr-system/.worktrees/be-asset-round2/docs/openapi.json` (vừa sinh lại).

**③ Thay đổi API** (chi tiết và ví dụ JSON ở bridge doc):

| Nhóm | Thay đổi |
|---|---|
| Endpoint mới | `POST /v1/asset-assignments/:id/dispute-response` `{ response }` → `AssetAssignment`. Lỗi: 400 `ASSET_DISPUTE_RESPONSE_REQUIRED`, 403, 404 `ASSET_ASSIGNMENT_NOT_FOUND`, 409 `ASSET_ASSIGNMENT_CLOSED`, 409 `ASSET_ASSIGNMENT_NOT_DISPUTED` |
| Query mới | `GET /v1/assets?disputed=true` (cả `/assets/export`) |
| `AssetAssignment` | + `endReason`, `endReasonLabel`, `transferredFrom`, `transferredTo`, `disputeResponse`, `disputeRespondedAt`; `asset.serialNumber` |
| `AssetIncident` | + `maintenance { id, status, statusLabel, doneAt, workDone }`; trạng thái mới `RESOLVED` |
| Overview | `total` đổi nghĩa (không gồm Mất, Đã thanh lý, Đã huỷ); + `physicalCount`, `serviceCount`, `disputedConfirmations` |
| Biên bản | Điều chuyển: `kind=assign` của lần mới và `kind=return` của lần cũ trả cùng biên bản `BBDC-…`. Mất: `kind=return` → 409 `ASSET_ASSIGNMENT_LOST` |
| Đóng phiếu | 400 `ASSET_MAINTENANCE_DONE_IN_FUTURE`, `ASSET_MAINTENANCE_DONE_BEFORE_SENT` |
| Sự kiện | + `ASSIGNMENT_DISPUTE_RESOLVED`; trường mới trong payload: `fromName`, `toName`, `note`, `endReason`, `closedAssignmentId`, `holderName`, `maintenanceVendor`, outcome `RESOLVED` |
| Thông báo | + `ASSET_LOST`, `ASSET_INCIDENT_HANDLED` (refType `asset_my_incident`, refId là id báo cáo, mở `/assets/my?incident_id=`), `ASSET_DISPUTE_RESOLVED`, `ASSET_RENEWED`, `ASSET_REPAIR_OPENED` |
| Nhãn | Bảng "Nhãn đổi" ở bridge doc (trùng bảng nhãn của phần A) |
| Câu lỗi | Mọi `error.message` của BE giờ là tiếng Việt, kể cả lỗi kiểm dữ liệu và lỗi của guard. Mã lỗi giữ nguyên |
| Phạm vi MANAGER | Rộng hơn (dịch vụ do người trong phòng phụ trách, tài sản người trong phòng làm mất, báo cáo do người trong phòng gửi). Web không phải đổi gì, chỉ smoke |

**④ File phải sửa:**

| File | Việc |
|---|---|
| `app/types/asset.types.ts`, `app/services/asset.service.ts` | Kiểu mới; hàm `respondToDispute(assignmentId, response)`; `disputed` trong `AssetQueryParams` |
| `app/utils/asset.utils.ts` | Nhãn sự kiện `ASSIGNMENT_DISPUTE_RESOLVED`, nhãn trường `maintenanceVendor` ("Đơn vị sửa chữa của phiếu"), dòng lịch sử dùng `fromName`, `toName`, `note`, `holderName`; nhãn `RESOLVED`, lý do kết thúc |
| `components/modules/asset/AssetHoldersPanel.vue` | Dòng `DISPUTED`: lý do, nút **Trả lời** (hộp nhập, nút "Gửi câu trả lời"), sau khi trả lời hiện câu trả lời và giờ. Dòng đã kết thúc hiện `endReasonLabel`, "Điều chuyển sang …", "Nhận từ …". Ẩn "Biên bản thu hồi" khi `LOST`; khi `TRANSFERRED` đổi tên nút thành "Biên bản điều chuyển" |
| `components/modules/asset/TransferModal.vue` | Ô tình trạng (mặc định tình trạng đang ghi) và ô ghi chú; toast có mã, người cũ, người mới |
| `components/modules/asset/AssetOverviewPanel.vue`, `pages/management/assets/index.vue` | Thẻ "Người nhận báo chưa đúng" → `?disputed=true`, nhãn lọc như hai thẻ cũ; tổng dùng `total` mới, tách thiết bị và dịch vụ |
| `app/pages/assets/my.vue` | `disputeResponse` cạnh nút Đã nhận; nhóm "Đã ghi nhận mất" tách khỏi "Đã thu hồi", không có nút biên bản thu hồi; serial; nhận `?incident_id=` mở đúng báo cáo; báo cáo `RESOLVED` hiện kết quả phiếu |
| `components/modules/asset/AssetIncidentDetailModal.vue`, `AssetIncidentsPanel.vue`, `pages/management/assets/incidents.vue` | Trạng thái `RESOLVED` và kết quả phiếu |
| `components/modules/asset/MaintenanceCloseModal.vue` | Bộ chọn ngày xong chặn ngày sau hôm nay và trước ngày gửi đi; nếu lọt thì toast `message` |
| `app/utils/notification-route.ts` | `asset_my_incident` → `/assets/my?incident_id=:refId`; năm `type` mới; cập nhật bảng chú thích đầu file |

**⑤ Smoke** (cùng luật xin sandbox như phần A; nên dùng `roleplay-sandbox.cjs` vì có trưởng phòng, quan hệ quản lý
trực tiếp và dịch vụ do trưởng phòng phụ trách):

| # | Role | Thao tác | Kỳ vọng |
|---|---|---|---|
| B1 | HR → NV Minh (TX02) | HR cấp phát Laptop Dell 2 cho Minh; Minh bấm Báo chưa đúng "Không có sạc" | Chuông HR có thông báo mới; Tổng quan có thẻ "Người nhận báo chưa đúng" = 1, bấm ra đúng 1 dòng |
| B2 | HR | Tab Người dùng của laptop: bấm Trả lời, gửi câu rỗng rồi câu thật | Câu rỗng bị chặn ở form; câu thật lưu, dòng về "Chờ người nhận xác nhận", hiện câu trả lời; thẻ về 0 |
| B3 | NV Minh, 390 px | Chuông → thông báo trả lời → Tài sản của tôi | Thấy câu trả lời cạnh nút Đã nhận, bấm Đã nhận (có hộp hỏi lại) thành công |
| B4 | HR | Điều chuyển điện thoại của Long (KD01) sang Hương (KD02), để tình trạng mặc định, ghi chú | Toast đúng; tab Người dùng: dòng cũ "Điều chuyển sang Ngô Thị Hương", dòng mới "Nhận từ Trịnh Văn Long"; nút biên bản của cả hai dòng mở cùng biên bản điều chuyển |
| B5 | NV Long | Tài sản của tôi, mục lịch sử | Điện thoại nằm ở "Đã thu hồi" với lý do điều chuyển; biên bản mở được |
| B6 | NV Nam (TX01) → HR | Nam báo mất điện thoại; HR xác nhận mất | Nam: chuông "Báo mất của bạn đã được xác nhận", bấm mở đúng báo cáo; thẻ điện thoại ở nhóm "Đã ghi nhận mất", không có nút biên bản thu hồi |
| B7 | Trưởng phòng Dũng (DP01) | Chuông → thông báo tài sản mất; danh sách tài sản lọc Mất; Dịch vụ thuê bao; thẻ Sắp đến hạn | Mở được tài sản mất (không còn "không có quyền"); thấy TMS, GPS do mình phụ trách; thẻ Sắp đến hạn ≥ 2 |
| B8 | NV Mai (KHO01) → HR | Mai báo hỏng máy quét kèm ảnh; HR tạo phiếu sửa; HR đóng phiếu Xong | Mai nhận "đã được tiếp nhận" rồi "đã sửa xong"; báo cáo của Mai ở "Đã xử lý xong" kèm kết quả; Lan (KV01) nhận bản chỉ đọc |
| B9 | HR | Đóng một phiếu với ngày mai | Bị chặn ở form, nếu lọt thì toast tiếng Việt |
| B10 | Mọi vai | Lướt danh sách, chi tiết, báo cáo, Tài sản của tôi | Không còn nhãn cũ ("Mất (chờ xác minh)", "Tài sản hữu hình", "Bàn giao" ở nút); mọi toast lỗi là tiếng Việt |

**⑥ Báo lại:** như phần A (file đã sửa, bảng B1–B10 kèm ảnh, exit code thật của build và vitest, chỗ lệch doc, đã
dừng sandbox). Có thể gộp chung một báo cáo với phần A.

**⑦ Giới hạn:** như mục ⑦ ở trên. Contract thiếu hay sai thì dừng phần đó và báo, BE sửa.
