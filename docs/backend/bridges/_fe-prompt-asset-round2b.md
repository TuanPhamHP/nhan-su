# FE prompt — Tài sản đợt 2, lô 2b (web)

> Handoff cho agent FE (RULE #2, pha P3). Backend lô 2b xong, smoke 82/82 trên sandbox ngày 14/11/2026.
> Tự chứa: người nhận không thấy hội thoại bên BE.

Lô 2b gồm: **thanh lý có duyệt** (F-15), **in tem QR khổ A6** (F-18), **kiểm kê** (F-17). Quét tem bằng camera chỉ có
trên app mobile; web in tem, kiểm kê bằng tay và bằng ô "Nhập hoặc bắn mã" (máy bắn mã cắm USB gõ chuỗi rồi Enter).
Lô 2a (báo hỏng, bảo dưỡng, biên bản, tổng quan) đã có trên `develop`.

## ① Repo và nhánh

- Làm trong worktree **`/home/tuanpham/work/hr-system/.worktrees/fe-asset-2b`**, nhánh `feat/asset-round2b` của
  `nhan-su`, tách từ `origin/develop` (248b250). Không làm ở checkout chính `/home/tuanpham/work/hr-system/nhan-su`.
- `node_modules` là symlink sang `nhan-su/node_modules`, không cần cài. **Không thêm package mới.**
- Nhánh đã có sẵn thay đổi chưa commit: `docs/backend/bridges/assets.md`, `docs/backend/bridges/fcm-notification-routing.json`,
  `docs/backend/bridges/_fe-prompt-asset-round2b.md` đồng bộ từ BE. Giữ nguyên, đừng sửa.
- `.env.sandbox` (đã tạo, bị git bỏ qua) trỏ API vào sandbox `http://localhost:3140`.
- BE lô 2b ở worktree `/home/tuanpham/work/hr-system/.worktrees/be-asset-2b` (nhánh `feat/asset-round2b`, **chưa
  commit**, chưa có trên môi trường nào).

## ② Đọc trước khi viết dòng code đầu tiên

1. `fe-asset-2b/CLAUDE.md`
2. `fe-asset-2b/docs/backend/bridges/assets.md`, mục **"Đợt 2 — lô 2b"** ở cuối file: quyền, hành vi đổi, TypeScript
   types, bảng endpoint, luồng thanh lý và kiểm kê, thông báo, mã lỗi, **bảng màn hình web**, chỉ xem, edge cases.
3. File này.
4. `/home/tuanpham/work/hr-system/.worktrees/be-asset-2b/docs/modules/15-assets.md` mục 16.8 (màn hình), 16.3 (BR-16,
   BR-17), 16.14 (quyết định D1–D14 khi làm).
5. **Type đối chiếu với `/home/tuanpham/work/hr-system/.worktrees/be-asset-2b/docs/openapi.json`** (đã sinh lại cho
   lô 2b). Không dùng `hr-system-be/docs/openapi.json` hay `nhan-su/docs/api-endpoint.json`.
6. Code lô 2a để theo đúng kiểu đang có: `app/pages/management/assets/incidents.vue` (trang danh sách + hộp chi tiết),
   `app/components/modules/asset/AssetIncidentDetailModal.vue`, `app/services/asset.service.ts`, `app/utils/asset.utils.ts`,
   `app/utils/image-compress.ts` (không cần cho 2b), `app/composables/useEscapeKey.ts`.

## ③ Thay đổi API

Chi tiết, kiểu và mã lỗi ở bridge doc mục "Đợt 2 — lô 2b". Tóm tắt:

| Nhóm | Route | Ghi chú |
|---|---|---|
| Thanh lý | `POST/GET /v1/asset-disposals`, `GET/PATCH /v1/asset-disposals/:id`, `POST …/:id/approve` · `/reject` · `/cancel` | Nút theo `actions` của response, đừng tự tính. Duyệt, từ chối gửi `round` đang hiện |
| Tem | `POST /v1/asset-labels` | Trả **file PDF** (blob), lỗi vẫn là JSON |
| Kiểm kê | `POST/GET /v1/asset-stocktakes`, `GET …/open`, `GET …/:id`, `GET …/:id/lines`, `GET …/:id/export` (xlsx), `POST …/:id/check` · `/close` · `/cancel`, `POST /v1/asset-stocktake-lines/:id/resolve` | MANAGER nhận 403 ở danh sách, chi tiết, dòng, biên bản (riêng `/open` trả 200 cho mọi người có `asset:read`) |
| Đổi | `Asset.pendingDisposalId`; `GET /v1/assets` không chọn `status` thì không có `DISPOSED`; `AssetOverview.pendingDisposals`; `ApprovalCounts.assetDisposals`; `AssetDocument.links[].disposalId`, upload nhận `disposalId`; 6 `AssetEventType` mới | `Record<…>` của nhãn sự kiện sẽ báo lỗi build tới khi thêm đủ, đó là chủ ý |
| Thông báo | `ASSET_DISPOSAL_PENDING`, `ASSET_DISPOSAL_DECIDED`, `refType: 'asset_disposal'` → `/management/assets/disposals/:refId` | `NAVIGATE_ONLY` |
| Quyền | `asset:disposal:approve` (DIRECTOR, CHIEF; ADMIN luôn qua) | Hộp thư duyệt, nút Duyệt/Từ chối |

Lỗi 409 `ASSET_DISPOSAL_NOT_ALLOWED` có `error.errors: [{ assetId, code, reason }]`: hiện `error.message` và đánh dấu
đúng các dòng tài sản trong form. Mọi lỗi khác hiện `error.message` của BE (đã là tiếng Việt), không tự viết câu.

## ④ Màn hình và file phải sửa

| Màn | File | Việc |
|---|---|---|
| Kiểu, service | `app/types/asset.types.ts`, `app/services/asset.service.ts` | Kiểu và hàm cho mọi route ở ③. Tải PDF tem và Excel biên bản theo cách tải Excel đang có |
| Nhãn, màu | `app/utils/asset.utils.ts` | Nhãn, màu trạng thái phiếu, kết quả kiểm kê, cách xử lý; nhãn 6 sự kiện mới |
| Menu | `app/config/app-modules.ts` | Thêm "Thanh lý" (`/management/assets/disposals`: `asset:manage` hoặc `asset:disposal:approve`) và "Kiểm kê" (`/management/assets/stocktakes`: chỉ `asset:manage`) |
| Danh sách tài sản | `app/pages/management/assets/index.vue` | Chọn nhiều dòng; nút **In tem**; nhãn "Chờ duyệt thanh lý" khi `pendingDisposalId`; bộ lọc có "Đã thanh lý"; thẻ Tổng quan "Phiếu thanh lý chờ duyệt" (`AssetOverviewPanel.vue`) |
| Chi tiết tài sản | `app/pages/management/assets/[id].vue`, `AssetInfoPanel.vue`, `AssetEventsPanel.vue` | Nút **In tem**, **Đề nghị thanh lý** (điều kiện ở bảng màn hình của bridge doc); băng "Đang chờ duyệt thanh lý, phiếu số …"; ẩn Cấp phát, Mở phiếu sửa khi có `pendingDisposalId`; lịch sử đọc payload mới |
| Thanh lý | **Mới** `app/pages/management/assets/disposals/index.vue`, `disposals/[id].vue`, component form phiếu (tạo và sửa dùng chung) | Theo bảng màn hình của bridge doc. Ngày không sau hôm nay. Giá thu về định dạng `1.500.000` |
| Kiểm kê | **Mới** `app/pages/management/assets/stocktakes/index.vue`, `stocktakes/[id].vue` | Tooltip L13 nguyên văn ở bridge doc. Ô bắn mã: Enter là gửi, xoá ô, giữ focus. Đóng đợt có hộp xác nhận nêu số "chưa kiểm sẽ thành Không tìm thấy". Hộp xử lý chênh lệch bốn cách; `UPDATED` chọn người giữ bằng ô chọn nhân viên đang có |
| Hộp thư duyệt | `app/pages/management/approval/index.vue`, `app/types/approval.types.ts`, `app/stores/approval.ts` | Tab **Thanh lý tài sản** (`assetDisposals`), module `ASSET`, chỉ người có `asset:disposal:approve`; danh sách phiếu chờ duyệt, bấm mở trang phiếu |
| Thông báo | `app/utils/notification-route.ts`, `app/types/notification.types.ts` | `asset_disposal` → `/management/assets/disposals/:refId`; hai `type` mới |

Thuật ngữ bắt buộc: **Cấp phát, Điều chuyển, Thu hồi, Thanh lý, Kiểm kê, Tem**; "bàn giao" chỉ còn trong tên "Biên
bản bàn giao". Ngày `dd/mm/yyyy`. Câu chữ là câu trọn vẹn, có bước tiếp theo, không dùng mã như "ADMIN", "#id", "BR-16".

## ⑤ Kịch bản FE phải smoke (bấm thật trên UI, cả màn rộng và màn 390 px)

**Môi trường** (chỉ một sandbox chạy một lúc; cổng cố định):

1. Chạy nền `node /home/tuanpham/work/hr-system/.worktrees/_asset-2b-scratch/sandbox-2b.cjs` trong thư mục
   `/home/tuanpham/work/hr-system/.worktrees/_asset-2b-scratch`. Chờ log có dòng `READY` (khoảng 1–2 phút); tài khoản,
   mật khẩu, id tài sản ở `roleplay-sandbox.json` cùng thư mục. Công ty `cta` (logistics), người dùng: `hr` (HR, quản
   lý tài sản), `gd` (DIRECTOR, người duyệt), `ceo` (CHIEF), `dp`, `kv` (MANAGER), `tx1`, `tx2`, `kho`, `kd1`, `kd2`,
   `acc` (EMPLOYEE), `admin@cta.drill` (ADMIN). Có sẵn máy in Hỏng chưa cấp phát (`oldPrinter`), màn hình Mất
   (`oldMonitor`), laptop Sẵn sàng (`lt2`), máy quét cũ (`oldScanner`).
2. Web: `npx nuxt dev --dotenv .env.sandbox --port 4010` trong worktree FE. **Phải là cổng 4010** (API sandbox chỉ cho
   CORS từ 4010; cổng 4000 là của session khác). Hoặc `npm run build` rồi `node …/_asset-2b-scratch/serve-web.cjs`.
3. Đăng nhập bằng email + mật khẩu ở JSON. Chụp ảnh màn hình mỗi kịch bản vào
   `/home/tuanpham/work/hr-system/.worktrees/_asset-2b-scratch/fe-smoke/shots/`.
4. Muốn làm lại từ đầu: dừng sandbox bằng `pkill -TERM -f "^node .*sandbox-2[b].cjs"` (tự xoá container), chạy lại bước 1.

| # | Vai | Thao tác | Mong đợi |
|---|---|---|---|
| F1 | HR | Mở danh sách tài sản, rồi lọc "Đã thanh lý" | Mặc định không có tài sản Đã thanh lý; bộ lọc có giá trị này |
| F2 | HR | Chọn 2 thiết bị, In tem; bỏ chọn, In tem theo bộ lọc; chọn thêm một dịch vụ rồi In tem | Tải PDF 2 trang khổ A6; PDF theo bộ lọc; toast câu lỗi của BE (dịch vụ) |
| F3 | HR | Mở máy in Hỏng `oldPrinter`, Đề nghị thanh lý (Huỷ, hôm nay, lý do) | Tạo phiếu, sang trang phiếu "Chờ duyệt"; quay lại tài sản thấy băng "Đang chờ duyệt thanh lý, phiếu số …", không có nút Cấp phát, Mở phiếu sửa |
| F4 | HR | Trang Thanh lý → Tạo phiếu, chọn `lt2` và một laptop đang cấp phát (`lt1`) | 409: câu lỗi BE và dòng `lt1` bị đánh dấu với lý do "Đang cấp phát…"; bỏ dòng đó thì tạo được |
| F5 | DIRECTOR (`gd`) | Chuông; Hộp thư duyệt | Thông báo 📋 bấm mở đúng phiếu; tab "Thanh lý tài sản" có số; menu tổng duyệt cộng số này |
| F6 | DIRECTOR | Từ chối để trống lý do; rồi ghi lý do | Không gửi được khi trống; sau đó phiếu "Bị từ chối", nút Duyệt/Từ chối biến mất |
| F7 | HR | Chuông ❌; mở phiếu, Sửa và gửi lại (bỏ bớt một tài sản) | Phiếu về "Chờ duyệt", vòng 2; lịch sử các vòng hiện Gửi đề nghị, Từ chối (kèm lý do), Sửa và gửi lại |
| F8 | CHIEF (`ceo`) | Duyệt phiếu vòng 2 | "Đã duyệt"; tài sản sang "Đã thanh lý", khấu hao dừng ngày thanh lý; HR nhận ✅ |
| F9 | HR | Tải biên bản thanh lý (PDF) vào phiếu; DIRECTOR mở biên bản | Có trong mục giấy tờ của phiếu, mở được |
| F10 | HR | Tạo phiếu khác rồi Huỷ phiếu | "Đã huỷ"; tài sản hết băng chờ thanh lý |
| F11 | HR, DIRECTOR | Mở phiếu của chính mình (HR) / phiếu người khác (DIRECTOR) | HR không có nút Duyệt; DIRECTOR không có nút Sửa, Huỷ (theo `actions`) |
| F12 | HR | Kiểm kê → Tạo đợt (phòng Điều phối vận tải) | Đợt mở, số liệu đúng; nút Tạo đợt bị khoá, tooltip có tên đợt |
| F13 | HR | Ô "Nhập hoặc bắn mã": gõ mã xe tải + Enter; dán chuỗi `HRM:ASSET:1:cta:<mã>`; gõ mã công ty khác `HRM:ASSET:1:ctb:<mã>`; gõ mã laptop phòng Kinh doanh | Ghi "Đúng", ô xoá và giữ focus; ghi được; toast lỗi công ty khác; báo "ngoài phạm vi" |
| F14 | HR | Ghi tay: một dòng Sai vị trí (nhập vị trí), một dòng Hỏng (ghi chú) | Dòng cập nhật, số liệu đầu trang đổi |
| F15 | HR | Đóng đợt | Hộp xác nhận nêu số tài sản chưa kiểm; sau đó các dòng chưa kiểm thành "Không tìm thấy" |
| F16 | HR | Xử lý chênh lệch đủ bốn cách: cập nhật vị trí, mở phiếu sửa, chuyển Mất, bỏ qua (không ghi lý do rồi có lý do) | Mỗi dòng có nhãn cách xử lý; tài sản đổi đúng (vị trí, Đang sửa, Mất); dòng ngoài phạm vi không có nút Xử lý; lỗi luồng hiện toast |
| F17 | HR | Xuất biên bản | Tải `.xlsx` |
| F18 | MANAGER (`dp`) | Menu tài sản; gõ URL `/management/assets/stocktakes` | Không có mục Kiểm kê, không có nút In tem, Đề nghị thanh lý; URL kiểm kê hiện câu lỗi tiếng Việt, không trắng trang |
| F19 | HR | Tổng quan; lịch sử của tài sản đã thanh lý, đã kiểm kê | Thẻ "Phiếu thanh lý chờ duyệt" bấm sang danh sách lọc; nhãn sự kiện tiếng Việt |
| F20 | HR | Màn 390 px: trang Thanh lý, chi tiết phiếu, Kiểm kê, chi tiết đợt | Dùng được, không tràn ngang, bảng thành thẻ như các trang tài sản khác |

## ⑥ Báo lại cho BE

1. Danh sách file đã sửa, đã tạo (đường dẫn tương đối trong `nhan-su`).
2. Bảng smoke `# | Vai | Thao tác | Mong đợi | Thực tế | ✓/✗` cho F1–F20, kèm đường dẫn ảnh.
3. Exit code thật của `npm run build` và `node_modules/.bin/vitest run` (ghi số test đạt/tổng; hai test `leave.test.ts`
   TC14, TC45 đã đỏ từ trước trên `develop`, không phải việc của bạn).
4. Chỗ contract lệch với bridge doc hoặc openapi (field thiếu, câu lỗi không hợp lý, hành vi khác mô tả). Ghi rõ
   route, request, response thật.
5. Xác nhận đã dừng sandbox (`docker ps` không còn `hr-drill-*`) và dev server cổng 4010.

## ⑦ Giới hạn

- Không sửa repo BE, kể cả docs. Contract sai thì ghi ở mục ⑥.4; **không tự workaround ở FE** (không tự đổi tên field,
  không tự lọc bỏ dữ liệu BE trả, không tự viết câu lỗi thay câu BE).
- Không chạm database thật: không SQL, không chạy migration hay seed, không sửa dữ liệu ngoài sandbox.
- Không commit, không push. Không thêm package. Không đụng cổng 4000 và tiến trình đang chạy ở `fe-recruitment`,
  `be-recruitment`.
- Không sửa ba file bridge doc đã đồng bộ.
