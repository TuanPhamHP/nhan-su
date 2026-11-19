# Prompt cho agent FE — Lô 1 Hành chính văn phòng (`OFFICE`): văn phòng phẩm, phòng họp

> User duyệt thiết kế lô 1 ngày 18/11/2026 ("Duyệt, sang bước B") cùng các chỗ tự chọn L1–L12. Backend đã code xong trên
> nhánh `feat/office-lot1`, smoke 61/61 kịch bản trên sandbox. Việc của bạn là làm giao diện web trên `nhan-su` theo đúng
> contract dưới đây, bấm thật trên trình duyệt trỏ vào sandbox, chụp màn hình. Mobile không thuộc việc này.

## ① Repo và nhánh

- FE: worktree **`/home/tuanpham/work/hr-system/.worktrees/fe-office-lot1`**, nhánh `feat/office-lot1` (tạo từ `develop`
  043c597, `node_modules` là symlink sang `nhan-su`). Chỉ làm trong worktree này, **không sửa checkout `nhan-su` chính**
  (nó đang ở `ui/sidebar-compact` với thay đổi chưa commit của việc khác). Không commit, không push: session BE gom và
  chạy cổng bảo mật trước khi commit.
- BE: worktree `/home/tuanpham/work/hr-system/.worktrees/be-office-lot1`, nhánh `feat/office-lot1`, **chưa merge**. Không
  sửa repo BE.

## ② Đọc trước

1. `nhan-su/CLAUDE.md` (quy ước repo FE: component, token màu, toast, service, store).
2. `docs/backend/bridges/office.md`: contract chính, đọc hết (quyền, endpoint, ví dụ response, cờ `canEdit`,
   `canReceive`, `detailsVisible`, mã lỗi mục 6, deep link mục 7, kịch bản mục 9).
3. `docs/backend/bridges/entitlements.md`: ô mới `adm` trên lịch phân hệ, module `OFFICE`.
4. `docs/backend/bridges/fcm-notification-routing.json` bản 1.3.0: 10 loại `OFFICE_*`.
5. Kiểu dữ liệu: khớp `/home/tuanpham/work/hr-system/.worktrees/be-office-lot1/docs/openapi.json` (bản của nhánh BE, tag
   `office`), không dùng `docs/api-endpoint.json`.
6. Thiết kế nếu cần: `/home/tuanpham/work/hr-system/.worktrees/be-office-lot1/docs/modules/17-office.md` (mục 9 màn hình,
   mục 12 L1–L12). File đăng ký văn phòng phẩm HCNS đang dùng: `/home/tuanpham/Documents/hrm/_1.STH - File đăng ký văn phòng phẩm T08.2026.xlsx`
   (mở để thấy bố cục cột phòng ban mà bảng tổng hợp phải giống).

## ③ Thay đổi API (tóm tắt, chi tiết ở bridge doc)

| Nhóm | Thay đổi |
|---|---|
| Module | Mã mới `OFFICE`, bán riêng. Công ty chưa được cấp: mọi route 403 `MODULE_NOT_SUBSCRIBED`. Chỉ xem (`MODULE_READ_ONLY`, `MODULE_EXPIRED`) vẫn cho bấm Đã nhận và huỷ phòng |
| Lưới phân hệ | `GET /v1/me/entitlements` trả thêm ô `adm` ("Hành chính văn phòng", nhóm `OPERATIONS`, `module: 'OFFICE'`), khoá khi công ty chưa được cấp |
| Quyền mới | `office:manage`, `office:supply:manage`, `office:supply:report`, `office:booking:manage` (HR đủ bốn; DIRECTOR, MANAGER, CHIEF có `office:supply:report`, MANAGER chỉ thấy phòng mình do server lọc) |
| Danh mục (mọi nhân viên) | `GET /v1/office/sites`, `/rooms`, `/supply-groups`, `/supply-items` |
| Cài đặt | `POST/PATCH` văn phòng, nhóm, mặt hàng, phòng họp; `GET/PUT /v1/office/supply-quotas`; tải mẫu và nhập Excel mặt hàng (nhận cả file HCNS hằng tháng) |
| Kỳ đăng ký (quản lý) | `/v1/office/supply-periods` (danh sách, mở, sửa hạn, khoá sớm, đóng, bảng tổng hợp, dự trù và đơn giá, phiếu bổ sung, xuất Excel); `/v1/office/supply-requests/:id` (xem, chốt, cấp, ghi đã giao) |
| Phiếu của phòng tôi | `/v1/me/office/supply-requests` (danh sách, chi tiết, thêm, sửa, xoá dòng, lấy số tháng trước, đã nhận); `GET /v1/me/office/supply-items`; `GET/PUT /v1/me/office/supply-contact` |
| Báo cáo | `GET /v1/office/reports/supply-costs` và `/export` |
| Phòng họp | `GET /v1/office/room-bookings?siteId&date` (lưới một ngày), `GET /:id`, `POST`, `PATCH /:id`, `POST /:id/cancel`; `GET /v1/me/office/room-bookings?from&to` |
| Thông báo | 10 `NotificationType` `OFFICE_*`, ba `refType`: `office_supply_request`, `office_supply_period`, `office_room_booking` (bridge doc mục 7) |
| Nhãn | Mọi `status` có `statusLabel` tiếng Việt: hiện thẳng, không tự dịch |

## ④ Màn hình và file

| Mã | Màn | File | Việc |
|---|---|---|---|
| Chung | Module, lưới, menu | `app/types/entitlement.types.ts`, `app/composables/useModuleAccess.ts`, `app/config/app-modules.ts` | Thêm `'OFFICE'` vào `ModuleCode`; `MODULE_ROUTES.OFFICE = ['/management/office', '/office']`. Thêm app `adm` vào `APP_MODULES` (home, routes, mục menu: "Văn phòng phẩm" `/office/supplies` và "Đặt phòng họp" `/office/rooms` dạng `scope: 'personal'` như "Tài sản của tôi"; "Kỳ đăng ký văn phòng phẩm", "Báo cáo chi phí", "Cài đặt hành chính" dạng `management` theo permission). Bỏ `ADM` khỏi `PLANNED_MODULES` (sửa comment phía trên cho khớp) |
| Chung | Kiểu, service, quyền, thông báo | Mới `app/types/office.types.ts`, `app/services/office.service.ts` (hoặc composable theo quy ước repo); `app/utils/permission.ts`; `app/utils/notification-route.ts`; `app/plugins/fcm.client.ts` nếu nó tự ánh xạ loại | Kiểu theo bridge doc. Ba `refType` mới (không rẽ theo vai trò, như module tài sản): `office_supply_request` → `/office/supplies?request_id=`, `office_supply_period` → `/management/office/supply-periods/:id`, `office_room_booking` → `/office/rooms?booking_id=` |
| UI-01 | Văn phòng phẩm của phòng tôi | Mới `app/pages/office/supplies.vue` | Danh sách phiếu của phòng (phiếu `OPEN` lên đầu), mở phiếu: dòng nhóm theo `groupName`, ô số (`UiNumberInput`), định mức cạnh ô, vượt định mức thì bắt nhập lý do trước khi gửi, "sửa cuối bởi …", gợi ý `previousQty`, nút "Lấy số tháng trước", thêm dòng ngoài danh mục (tên, đơn vị), đếm ngược tới `period.lockAt`. Hết hạn thì khoá theo `canEdit`. Phiếu `ISSUED` có nút Đã nhận theo `canReceive` (sửa số thực nhận, ghi chú thiếu). Trưởng phòng chọn đầu mối (`supply-contact`). Đọc `?request_id=` (link từ thông báo) |
| UI-04 | Đặt phòng họp | Mới `app/pages/office/rooms.vue` | Chọn văn phòng (nhớ lần chọn trước, ví dụ localStorage), chọn ngày (mặc định hôm nay), lịch phòng × giờ tự vẽ như lưới ở `app/pages/management/settings/shifts.vue` (không thêm package lịch). "Trống đến HH:mm" / "Đang họp tới HH:mm" từ `now`. Bấm ô trống mở form đặt nhanh (tiêu đề, giờ kết thúc mặc định +60 phút, ghi chú, riêng tư, chủ trì khác mình, người dự). Lượt riêng tư `detailsVisible=false` hiện "Đã có người đặt" kèm người đặt. Sửa, dời, huỷ theo `canEdit` (huỷ lượt người khác bắt lý do). Tab "Lịch của tôi" (`/me/office/room-bookings`). Đọc `?booking_id=` |
| UI-02 | Kỳ đăng ký | Mới `app/pages/management/office/supply-periods/index.vue`, `[id].vue` | Danh sách kỳ theo văn phòng, trạng thái, `departmentsWithLines/departmentsTotal`. Mở kỳ: văn phòng, tháng, hạn chót, chọn phòng (mặc định như kỳ trước), tiêu đề. Trang kỳ: ma trận mặt hàng × phòng như file HCNS (cột phòng ban, Dự trù, Tổng, Đơn giá, Thành tiền, nhóm La Mã), ô dự trù, ô đơn giá thực (`PUT /items`), gia hạn, khoá sớm, đóng kỳ. Từng phiếu: chốt (sửa số phải ghi lý do, dòng ngoài danh mục nhập `customUnitPrice`), cấp, ghi đã giao (chỉ hiện sau `proxyAllowedAt`, nhập tên người nhận), phiếu bổ sung (chọn phòng, ghi chú bắt buộc, được chọn cả nhóm chỉ HCNS đặt). Xuất Excel. Trưởng phòng mở chỉ thấy cột phòng mình, không có nút ghi |
| UI-10 | Báo cáo chi phí | Mới `app/pages/management/office/reports.vue` | Lọc từ tháng, đến tháng, phòng, nhóm; bảng tháng × phòng × văn phòng, tổng; cảnh báo nhỏ khi `unpricedLines > 0`; xuất Excel |
| UI-09 | Cài đặt hành chính | Mới `app/pages/management/office/settings.vue` | Tab Văn phòng; Văn phòng phẩm (nhóm có cờ "Chỉ HCNS đặt", mặt hàng, tải mẫu, nhập Excel và hiện kết quả `createdGroups`, `createdItems`, `errors[]`); Định mức theo phòng (`PUT` thay toàn bộ); Phòng họp (sức chứa, thiết bị, ngừng dùng) |

Ô chọn dài (mặt hàng, nhân viên, phòng ban) dùng **`UiSelectInput`** (đã có ô tìm trên develop). Đừng dựa vào prop
`searchable` của `UiSelect`: nó đang nằm chưa commit ở checkout `nhan-su` chính, chưa có trên develop.

## ⑤ Kịch bản smoke FE (bấm thật, chụp màn hình)

Sandbox BE **đang chạy**: API `http://localhost:3190` (Postgres, Redis dùng một lần, không phải DB thật). Tài khoản, mật
khẩu, id phòng ban ở `/tmp/claude-1000/-home-tuanpham-work-hr-system-hr-system-be/fd7df120-0745-4bd0-817c-06818b898892/scratchpad/sandbox-office-fe.json`.
Công ty `sth` đã bật OFFICE, danh mục **còn trống** (bạn dựng hết qua giao diện, bắt đầu bằng W1); công ty `ogo` chưa
được cấp. Người dùng `sth`: HR01 (HR), DIR01 (giám đốc), MGRA, MGRB, MGRC (trưởng ba phòng), EMPA1, EMPA2, EMPB1, EMPC1
(nhân viên), ADMIN ở `companies.sth.admin`. Chạy web trỏ vào sandbox, **cổng 4030** (CORS sandbox chỉ mở 4030, 4031):

```bash
cd /home/tuanpham/work/hr-system/.worktrees/fe-office-lot1
sed 's|^NUXT_PUBLIC_BASE_API_URL=.*|NUXT_PUBLIC_BASE_API_URL=http://localhost:3190|' /home/tuanpham/work/hr-system/nhan-su/.env.local > <scratch>/env.office
npx nuxt dev --dotenv <scratch>/env.office --port 4030
```

Chụp bằng `playwright-core` + `/usr/bin/google-chrome` (mẫu `tests/e2e/agent-chart-shots.mjs`), desktop 1440×900 và điện
thoại 390×844. Lưu ảnh vào `tests/e2e/__shots__/office-lot1/` (không commit), tên file theo mã kịch bản.

| # | Vai | Kịch bản | Mong đợi |
|---|---|---|---|
| FE-01 | HR01 | Lưới phân hệ, mở ô Hành chính văn phòng; menu đủ 5 mục | Ô hiện ở nhóm Hành chính & Vận hành, không khoá |
| FE-02 | HR01 | Cài đặt: tạo 2 văn phòng (Hữu Nghị, Lạng Sơn); nhập file HCNS ở ② | Báo 5 nhóm, 59 mặt hàng; nhóm Đồ uống, Khác, Vật dụng sử dụng vệ sinh có nhãn "Chỉ HCNS đặt"; nhập lại cùng file báo 0 mặt hàng mới |
| FE-03 | HR01 | Định mức phòng Tài chính - Kế toán: Giấy in A4 = 5; tạo 2 phòng họp ở Hữu Nghị; trùng tên phòng | Lưu được; trùng tên báo lỗi ở ô tên |
| FE-04 | HR01 | Mở kỳ tháng sau cho 3 phòng, hạn chót vài ngày tới; mở trùng tháng; hạn chót đã qua | Kỳ hiện ở danh sách; trùng báo `OFFICE_SUPPLY_PERIOD_EXISTS`; hạn qua báo lỗi ở ô ngày |
| FE-05 | EMPA1 rồi EMPA2 | Chuông thông báo, bấm "mở kỳ" → đúng phiếu; nhập vài dòng, Giấy A4 = 8 (vượt định mức), dòng ngoài danh mục "Pin 3A"; EMPA2 sửa một dòng | Vượt định mức bắt lý do; ô chọn không có đồ uống, vệ sinh; dòng hiện "sửa cuối bởi Hoàng Thị Bình" |
| FE-06 | EMPB1 | Mở link `/office/supplies?request_id=<phiếu phòng A>` | Báo không phải phiếu phòng mình, không trắng trang |
| FE-07 | HR01 rồi EMPA1 | HR khoá sớm kỳ; EMPA1 thử sửa | Ô nhập khoá, toast "Kỳ đã đóng, bạn liên hệ HCNS…" |
| FE-08 | HR01 | Trang kỳ: ma trận, nhập dự trù A4 = 5 và đơn giá 65.000; chốt phiếu A sửa số không lý do, có lý do; cấp | Số cần mua A4 = 8 + 5; thiếu lý do bị chặn; chốt, cấp được; MGRA nhận thông báo |
| FE-09 | MGRA | Chỉ định EMPA1 làm đầu mối; EMPA1 bấm Đã nhận, sửa một dòng nhận 6/8 | Phiếu "Đã nhận"; báo cáo chi phí tính theo 6 |
| FE-10 | EMPA2 | Phiếu đã cấp | Không có nút Đã nhận |
| FE-11 | HR01 | Phiếu bổ sung cho phòng B có Cafe, ghi chú; thử khi kỳ còn mở (kỳ khác) | Phiếu bổ sung hiện ở trang kỳ, MGRB nhận thông báo; kỳ còn mở báo lỗi |
| FE-12 | HR01 | Ghi đã giao cho phiếu vừa cấp | Nút chưa hiện (chưa đủ 3 ngày làm việc) |
| FE-13 | HR01, MGRA | Xuất Excel bảng tổng hợp và báo cáo; MGRA mở báo cáo và trang kỳ | File mở được, cột phòng như file HCNS; MGRA chỉ thấy phòng mình, không có nút ghi |
| FE-14 | EMPA1 | Đặt phòng hôm nay giờ tới; EMPB1 đặt trùng giờ; đặt liền kề | Trùng báo "Phòng đã có người đặt… (Phạm Văn An)", lưới tải lại; liền kề được |
| FE-15 | EMPA1 | Lượt riêng tư mời EMPB1; EMPC1 xem lưới; HR01 xem | EMPC1 thấy khung bận và người đặt, không thấy tiêu đề; EMPB1, HR01 thấy |
| FE-16 | EMPA2 (thư ký) | Đặt hộ DIR01 làm chủ trì, mời MGRA; DIR01 mở thông báo | DIR01 thấy lượt ở "Lịch của tôi", tự huỷ được không cần lý do |
| FE-17 | EMPB1, HR01 | EMPB1 thử sửa lượt của EMPA1; HR01 huỷ lượt EMPA1 không lý do, có lý do | EMPB1 không có nút sửa; HR thiếu lý do bị chặn, có lý do huỷ được |
| FE-18 | EMPA1 | Đặt giờ đã qua, quá 12 giờ, quá 180 ngày tới | Lỗi ở ô giờ bằng câu của server |
| FE-19 | EMPA1 | Vào `/management/office/*` | Bị chặn như trang quản lý khác |
| FE-20 | HR công ty `ogo` | Lưới phân hệ, bấm ô Hành chính; gõ thẳng `/office/rooms` | Ô khoá, hộp thoại theo `lockReason`; route bị chặn, không trắng trang |
| FE-21 | Mọi màn | Điện thoại 390×844: phiếu, lịch phòng, trang kỳ, cài đặt | Không tràn ngang, ô bấm được; lịch phòng cuộn ngang trong khung của nó |
| FE-22 | Mọi màn | Đang tải, rỗng (chưa có kỳ, chưa có phòng), lỗi mạng (tắt sandbox thì báo user trước, đừng tự tắt) | Có skeleton hoặc chữ rỗng, toast lỗi, không trắng trang |

Kiểm thêm: `npm --prefix /home/tuanpham/work/hr-system/.worktrees/fe-office-lot1 run build` xanh, `npx vitest run` xanh
(thêm test cho hàm thuần mới, ví dụ dựng ma trận tổng hợp, đếm ngược, đặt ô lịch phòng theo giờ Việt Nam).

## ⑥ Báo lại

Gửi về session BE (`hr-system-be-a9`) bằng SendMessage:

1. Danh sách file đã sửa, tạo.
2. Bảng smoke `# | Vai | Kịch bản | Mong đợi | Thực tế | ✓/✗` cho FE-01..FE-22, kèm đường dẫn **từng ảnh chụp**.
3. Kết quả `build`, `vitest` (in exit code).
4. Chỗ lệch giữa bridge doc, openapi và hành vi thật của API (nếu có), kèm request và response.

## ⑦ Giới hạn

- Không sửa repo BE, không sửa database (kể cả sandbox) bằng tay ngoài thao tác qua API. Không dừng hay dựng lại
  sandbox; sandbox chết thì báo session BE.
- **Không tự workaround contract sai ở FE**: thấy API trả sai, thiếu field, thiếu nhãn thì dừng chỗ đó và báo session BE.
- Không commit, không push, không sửa checkout `nhan-su` chính.
- Không thêm package (lịch, bảng): tự vẽ lịch phòng như `settings/shifts.vue`.
- Giữ đúng component, token màu, cách hiện toast của `nhan-su`; văn bản giao diện tiếng Việt câu trọn vẹn.
