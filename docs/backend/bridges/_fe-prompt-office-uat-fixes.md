# Prompt cho agent FE — Hành chính văn phòng lô 1, phần đổi sau UAT đợt A

> Sau khi web lô 1 xong (FE-01..FE-22 xanh), 5 vai người dùng khó tính đã thử backend qua API (UAT đợt A). Backend đã sửa
> các lỗi họ tìm ra và chủ sản phẩm đã quyết 6 điểm nghiệp vụ (Q1–Q6 dưới đây). Smoke BE sau khi sửa: 137/137. Việc của
> bạn là cập nhật web theo hợp đồng mới, rồi chạy lại smoke. Sau đó UAT đợt B sẽ bấm thật trên web của bạn.

## ① Repo và nhánh

- FE: worktree **`/home/tuanpham/work/hr-system/.worktrees/fe-office-lot1`**, nhánh `feat/office-lot1` (đang có việc của
  bạn, chưa commit). Không sửa checkout `nhan-su` chính, không commit, không push.
- BE: worktree `/home/tuanpham/work/hr-system/.worktrees/be-office-lot1`, chưa merge. Không sửa repo BE.

## ② Đọc trước

1. `docs/backend/bridges/office.md` (đã đồng bộ bản mới): mục 1 (đơn giá), 3 (nhập Excel), 4.1 (luồng, nhãn), 4.2, 4.3,
   5 (phòng họp, viết lại), 6 (mã lỗi mới), 7, 9 (W13–W17).
2. `docs/backend/bridges/fcm-notification-routing.json` bản 1.3.1 (`OFFICE_SUPPLY_PERIOD_CHANGED`).
3. Kiểu dữ liệu: `/home/tuanpham/work/hr-system/.worktrees/be-office-lot1/docs/openapi.json` (đã sửa kiểu phần tử mảng
   bạn báo: `SummaryRequestDto`, `SupplyImportIssueDto`, `departmentIds`, `attendeeIds` là số).

## ③ Thay đổi API

**Quyết định của chủ sản phẩm:**
| Mã | Quyết định | API |
|---|---|---|
| Q1 | HCNS sửa được tới lúc đóng kỳ | `finalize` gọi lại được với phiếu đã chốt, đã cấp, đã nhận (đổi số phải có `finalNote`, không nhỏ hơn số đã nhận); mới `POST /office/supply-requests/:id/correct-received { lines, reason }` cho phiếu đã nhận |
| Q2 | Khoá sớm báo trưởng phòng, đầu mối | `period.lockAt` thành giờ khoá thật sau khi khoá sớm; thông báo `OFFICE_SUPPLY_PERIOD_CHANGED` |
| Q3 | Họp riêng tư: chỉ người tạo, chủ trì, người dự thấy nội dung | HCNS cũng nhận `detailsVisible=false`; HCNS vẫn dời giờ, đổi phòng, huỷ (có lý do) nhưng gửi tiêu đề, ghi chú, `isPrivate`, `organizerId`, `attendeeIds` thì 403 |
| Q4 | Quên phòng, mở nhầm kỳ | Mới `POST /office/supply-periods/:id/departments { departmentIds }`, `POST /office/supply-periods/:id/cancel` (chỉ khi chưa phòng nào có dòng; kỳ bị xoá) |
| Q5 | Ngừng phòng họp còn lượt sắp tới | 409 `OFFICE_ROOM_HAS_BOOKINGS` (câu nêu số lượt) khi PATCH `isActive:false` phòng hoặc văn phòng |
| Q6 | Đổi hạn chót cả hai chiều | PATCH `deadline` nhận cả ngày sớm hơn (từ hôm nay); người đã nhận thông báo mở kỳ được báo hạn mới |

**Văn phòng phẩm:**
- Nhãn từ server: phiếu `OPEN` "Đang đăng ký" (thay "Đang nhập"), kỳ `LOCKED` "Đã khoá", phiếu rỗng sau khi khoá "Không
  đăng ký". Hiện `statusLabel`, đừng tự dịch.
- `unitPrice` là `null` với người không có quyền xem chi phí ở `/office/supply-items`, `/me/office/supply-items`: ẩn cột giá.
- `/me/office/supply-items` có `quota` (định mức tháng của phòng tôi): hiện cạnh ô số khi THÊM dòng, bắt lý do ngay khi gõ
  vượt. Server vẫn có thể trả `OVER_QUOTA_REASON_REQUIRED` khi phòng đã xin mặt hàng đó ở văn phòng khác cùng tháng (câu nêu số).
- Danh sách kỳ có `departmentIds`: bỏ lượt gọi thêm chi tiết kỳ trước khi mở kỳ mới.
- `copy-previous` trả `{ previousTitle, added, skipped, skippedItems: [{ name, reason }], request }`: toast nêu số dòng đã
  thêm, tên kỳ trước, và liệt kê từng dòng bỏ qua kèm lý do. `previousTitle` null thì "Phòng chưa có kỳ trước ở văn phòng này".
- Dòng ngoài danh mục trùng tên mặt hàng có sẵn: 400 `OFFICE_SUPPLY_LINE_IN_CATALOG` (câu nêu tên đúng) → gợi ý chọn trong
  danh sách. Trùng dòng ngoài danh mục khác của phiếu: 409 `LINE_EXISTS`.
- Bảng tổng hợp: `rows[].notes: string[]` (hiện ở cột Ghi chú hoặc tooltip), `unpricedRows` (cảnh báo "N mặt hàng chưa có
  đơn giá, chưa tính vào tổng"), `departments[].requests[].note` (ghi chú phiếu bổ sung). `rows` đã xếp theo thứ tự danh mục.
- Mọi `lineId` gửi một lần trong chốt, nhận, sửa số nhận (`OFFICE_SUPPLY_LINE_DUPLICATE`).
- Số lượng nguyên 1–100.000 (chốt, nhận, dự trù từ 0); đơn giá số nguyên VND, gửi số JSON (chuỗi "320.000" bị từ chối).
- Nhập Excel: `errors` gồm cả cảnh báo (dòng vẫn tạo, ví dụ đơn giá không hiểu được để trống) — hiện nguyên danh sách.
- File xuất có tên mới (`van-phong-pham-12-2026-huu-nghi.xlsx`, `chi-phi-van-phong-pham-10-2026-den-12-2026.xlsx`): lấy tên
  từ `Content-Disposition`, đừng tự đặt.

**Phòng họp:**
- `startAt`, `endAt` phải có múi giờ (`Z` hoặc `+07:00`); server làm tròn xuống phút.
- PATCH nhận `organizerId` (đổi chủ trì). Lượt đang diễn ra: đổi `endAt` được (gia hạn, kết thúc sớm) khi giữ nguyên
  `startAt`. Lượt đã kết thúc: sửa và huỷ đều 409 `OFFICE_ROOM_BOOKING_PAST`, `canEdit=false`.
- Người trong lượt có `isActive` (false = đã nghỉ việc): hiện "(đã nghỉ việc)". Gửi lại danh sách đang có thì server tự bỏ
  người đã nghỉ.
- `cancelledBy: null` = hệ thống tự huỷ (chủ trì nghỉ việc).
- Mã lỗi: phòng không tồn tại 404 `OFFICE_ROOM_NOT_FOUND`; lịch của văn phòng đã ngừng 400 `OFFICE_SITE_INACTIVE`; ngày sai
  định dạng ở query trả mã chung của kiểm dữ liệu kèm câu "Ngày không hợp lệ…".

## ④ Màn hình và file

| Màn | File | Việc |
|---|---|---|
| UI-01 | `app/pages/office/supplies.vue` | Định mức từ `quota` khi thêm dòng; toast "Lấy số tháng trước" mới; bắt lỗi `LINE_IN_CATALOG`; ẩn giá khi null; nhãn từ server. Trên điện thoại: dòng đã nhận đang có một số đứng lẻ không nhãn dưới "Đã nhận 12" (ảnh `fe-21-supplies.png`) — bỏ hoặc gắn nhãn |
| UI-02 | `app/pages/management/office/supply-periods/index.vue`, `[id].vue`, `PeriodCreateModal.vue`, `RequestDetailModal.vue` | Nút "Thêm phòng" (kỳ mở), "Huỷ kỳ" (chưa có dòng; hỏi xác nhận), "Đổi hạn chót" thay "Gia hạn" (cho chọn ngày sớm hơn, từ hôm nay); chốt lại phiếu đã chốt, đã cấp, đã nhận ("Sửa số", bắt lý do); "Sửa số thực nhận" cho phiếu đã nhận (bắt lý do); ẩn mọi nút sửa khi kỳ đã đóng. Cột Ghi chú từ `notes`; cảnh báo `unpricedRows`. **Nút trợ lý AI nổi đang che số "Tổng tiền kỳ"** (ảnh `fe-08-reserve-price.png`): thêm khoảng đệm dưới bảng hoặc đặt tổng tiền ở chỗ không bị che |
| UI-04 | `app/pages/office/rooms.vue`, `BookingFormModal.vue`, `BookingDetailModal.vue` | Lượt `detailsVisible=false` mà người xem `canEdit` (HCNS): form chỉ cho đổi giờ, phòng, huỷ có lý do; không gửi tiêu đề, người dự. Đổi chủ trì trong form sửa. Lượt đang diễn ra: cho sửa giờ kết thúc. Hiện "(đã nghỉ việc)". **Lưới cắt tiêu đề quá ngắn** ("Họp gi…", ảnh `fe-14-booked.png`): hiện đủ tiêu đề khi rê chuột, trên điện thoại khi chạm |
| UI-09 | `app/pages/management/office/settings.vue` | Bắt 409 `OFFICE_ROOM_HAS_BOOKINGS` khi ngừng phòng, văn phòng; hiện cảnh báo nhập Excel |
| Chung | `app/types/office.types.ts`, `app/services/office.service.ts` | Kiểu và hàm gọi theo ③ |

## ⑤ Kịch bản smoke FE (bấm thật, chụp màn hình)

Sandbox BE **đã dựng lại bằng code mới** ở cùng cổng `http://localhost:3190` (dữ liệu cũ mất, schema đổi); tài khoản ở
`/tmp/claude-1000/-home-tuanpham-work-hr-system-hr-system-be/fd7df120-0745-4bd0-817c-06818b898892/scratchpad/sandbox-office-fe.json`
(cùng cấu trúc như trước, mật khẩu cũ). Danh mục trống, bắt đầu bằng FE-02. Ảnh lưu `tests/e2e/__shots__/office-lot1/`,
tên theo mã kịch bản (ảnh mới ghi đè ảnh cũ cùng tên).

1. Chạy lại FE-01..FE-22 (đổi chữ cần so nếu nhãn mới), sửa chỗ đỏ.
2. Thêm:

| # | Vai | Kịch bản | Mong đợi |
|---|---|---|---|
| FE-23 | HR01 | Mở kỳ cho 2 phòng, rồi "Thêm phòng" C; mở kỳ thứ hai rồi "Huỷ kỳ"; mở lại cùng tháng | Phòng C có phiếu, MGRC nhận thông báo; kỳ huỷ biến mất; mở lại được |
| FE-24 | HR01, EMPA1 | Đổi hạn chót sớm hơn | EMPA1 nhận "Đổi hạn…" nêu hạn cũ và mới; đếm ngược đổi theo |
| FE-25 | HR01, MGRA | Khoá sớm | MGRA nhận "HCNS đã khoá sớm…"; phiếu dừng đếm ngược đúng giờ khoá |
| FE-26 | HR01 | Chốt, cấp, rồi "Sửa số" phiếu đã cấp (thiếu lý do, có lý do); phòng nhận; "Sửa số thực nhận"; đóng kỳ | Thiếu lý do bị chặn; số mới hiện ở phiếu và bảng tổng hợp; đóng kỳ rồi mọi nút sửa ẩn |
| FE-27 | EMPA1 | Thêm dòng có định mức: thấy định mức trước khi gõ; ghi ngoài danh mục "BÚT BI (NOTE MÀU XANH)" | Định mức hiện ngay; ngoài danh mục trùng bị từ chối, gợi ý chọn trong danh sách |
| FE-28 | EMPA1 | "Lấy số tháng trước" ở kỳ sau có dòng vượt định mức và dòng ngoài danh mục | Toast nêu số dòng thêm, tên kỳ trước, từng dòng bỏ qua kèm lý do |
| FE-29 | EMPA1 | Mở ô chọn mặt hàng, trang cài đặt (nếu vào được) | Không thấy đơn giá |
| FE-30 | HR01 | Ngừng phòng họp còn lượt sắp tới | Toast "Phòng còn N lượt đặt sắp tới…" |
| FE-31 | HR01 | Mở, dời giờ, thử sửa tiêu đề, huỷ một lượt riêng tư của giám đốc | Không thấy tiêu đề; dời được; không có ô sửa tiêu đề, người dự; huỷ bắt lý do |
| FE-32 | EMPA2, DIR01 | Đặt hộ, đổi chủ trì, bớt một người dự | Người liên quan nhận đúng câu (xem chuông của từng người) |
| FE-33 | EMPA1 | Lượt đang diễn ra: kéo dài 30 phút, kết thúc sớm; lượt đã kết thúc: không có nút sửa, huỷ | Đúng như ③ |
| FE-34 | Mọi màn | Ảnh điện thoại 390×844 các màn đã sửa; bảng tổng hợp không bị nút nổi che tổng tiền | Không tràn, không che |

Kiểm thêm: `npm --prefix /home/tuanpham/work/hr-system/.worktrees/fe-office-lot1 run build` xanh, `npx vitest run
tests/office-lot1.test.ts` xanh (thêm bài cho hàm thuần mới).

## ⑥ Báo lại

SendMessage về session BE (`hr-system-be-a9`): file đã sửa; bảng smoke FE-01..FE-34 kèm đường dẫn ảnh; exit code build,
vitest; chỗ lệch hợp đồng (kèm request/response). Sau khi báo, **để máy chủ web dev ở cổng 4030 chạy tiếp** (UAT đợt B dùng
bản build riêng, không đụng của bạn).

## ⑦ Giới hạn

- Không sửa repo BE, không sửa database (kể cả sandbox) ngoài thao tác qua API; không dừng hay dựng lại sandbox.
- Không tự workaround contract sai ở FE: thấy API sai thì dừng chỗ đó, báo session BE.
- Không commit, không push, không sửa checkout `nhan-su` chính. Không thêm package.
- Giữ component, token màu, toast của `nhan-su`; chữ giao diện tiếng Việt câu trọn vẹn.

## Bổ sung: góp ý trực tiếp của user (18/11/2026 tối) — làm trước UAT đợt B

1. **Chữ máy móc.** "Lưới phòng" bị chê là typo máy móc. Tab đổi thành **"Lịch phòng"**; mọi chữ người dùng đọc thấy có
   "lưới" (thông báo lỗi "Chưa tải được lưới phòng họp", câu ở Cài đặt "mỗi lưới phòng họp"…) đổi sang "lịch phòng họp".
   Soát luôn các chữ kiểu kỹ thuật khác trong năm màn hình (dải giờ, ô, thanh lượt…): người dùng là nhân viên văn phòng.
2. **Mô tả dưới tiêu đề trang đưa vào tooltip.** Đoạn mô tả nhỏ dưới tiêu đề ("Cả phòng cùng nhập…", "Bạn bấm vào một
   khung giờ…") không hiện thẳng nữa: thay bằng một icon ⓘ cạnh tiêu đề, rê chuột (desktop) hoặc chạm (điện thoại) thì hiện
   nội dung. Áp dụng cho **mọi trang** của web, không chỉ module này:
   - Làm một component dùng chung (ví dụ `components/ui/PageHeader.vue`: `title`, `description`, slot nút bên phải), dựa
     trên `components/ui/Tooltip.vue` có sẵn; bấm được trên điện thoại, có `aria-label`, không che nội dung khi mở.
   - Đợt này: năm màn của module Hành chính văn phòng dùng component mới (UAT đợt B sẽ soi).
   - Sau đó thay cho các trang còn lại đang có `<h1>` + `<p>` mô tả (đếm được khoảng 80 trang trong `app/pages`). Giữ
     nguyên chữ mô tả, chỉ đổi cách hiện. Làm chung với phần còn lại (user: không cần tách commit hay PR riêng).
   - Chụp ảnh trước/sau cho 3 trang đại diện ngoài module (ví dụ danh sách nhân viên, phê duyệt, tài sản).
