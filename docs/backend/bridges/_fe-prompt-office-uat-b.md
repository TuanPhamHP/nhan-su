# Bàn giao FE: sửa theo UAT đợt B module Hành chính văn phòng (lô 1)

UAT đợt B: năm vai người dùng khó tính bấm thật trên web (bản build của nhánh `feat/office-lot1` lúc 19/11 01:00), desktop
1440×900 và điện thoại 390×844, mỗi lỗi có ảnh. Chưa có lỗi chặn. Một lỗi nặng (F-32: sửa lượt họp dời sang hôm nay).
Đợt 1 này gồm báo cáo của trưởng phòng, thư ký, nhân viên; HCNS và giám đốc gửi tiếp ở đợt 2.

## ① Repo, nhánh

- FE: worktree `/home/tuanpham/work/hr-system/.worktrees/fe-office-lot1`, nhánh `feat/office-lot1` (chưa commit, như cũ).
- BE: worktree `/home/tuanpham/work/hr-system/.worktrees/be-office-lot1`, nhánh `feat/office-lot1`. Không sửa.
- Sandbox của bạn (API 3190, web 4030) sẽ được dựng lại bằng bản BE mới khi bạn nhận tin này; dữ liệu mới, mọi tháng lại
  trống. File tài khoản vẫn ở chỗ cũ.

## ② Đọc trước

- `nhan-su/CLAUDE.md`, `docs/backend/bridges/office.md` (bản đã sync, các đoạn "UAT đợt B"), file này.
- Báo cáo gốc kèm ảnh (đọc khi cần xem đúng màn hình người dùng thấy):
  `/tmp/claude-1000/-home-tuanpham-work-hr-system-hr-system-be/fd7df120-0745-4bd0-817c-06818b898892/scratchpad/uat/<vai>/bao-cao-dot-b.md`,
  ảnh ở `uat/<vai>/dot-b/shots/`, với `<vai>` là `truong-phong`, `thu-ky`, `nhan-vien`. Mã lỗi gốc ghi trong ngoặc (TP5 =
  lỗi 5 của trưởng phòng).

## ③ Thay đổi API (đã có ở BE, xem bridge doc)

| Chỗ | Thay đổi |
|---|---|
| `GET /office/supply-periods/:id/summary` (và Excel) | Thêm `scope: 'ALL' \| 'DEPARTMENT'`. `DEPARTMENT` (trưởng phòng): `rows[].reserveQty = null`, `purchaseQty` là số của phòng mình. Ẩn cột Dự trù, gọi cột số là "Tổng". |
| `GET /office/reports/supply-costs` | Khai thêm `scope`, `departmentId` (trước đã trả `departmentId` nhưng chưa có trong Swagger). `DEPARTMENT`: khoá ô Phòng ban ở `departmentId`. |
| Mọi lượt họp (`RoomBookingResponseDto`) | Thêm `timing: 'UPCOMING' \| 'ONGOING' \| 'ENDED'`; `statusLabel` của lượt chưa huỷ theo `timing`: "Đã đặt", "Đang họp", "Đã kết thúc". |
| `OFFICE_ROOM_BOOKING_CONFLICT` | Câu "…không cần đặt lại." chỉ khi đặt lại đúng khung giờ; trùng một phần là "Phòng này đã có lượt của bạn lúc … Bạn chọn giờ hoặc phòng khác." |
| `OFFICE_SUPPLY_LINE_IN_CATALOG`, `OFFICE_SUPPLY_LINE_EXISTS` | So tên bỏ qua dấu tiếng Việt, dấu câu, ngoặc, hoa thường. Không đổi mã lỗi. |
| CORS | `Access-Control-Expose-Headers: Content-Disposition`: đường đọc tên file của bạn nay chạy thật. |
| Thông báo | Tên kỳ giữa câu viết thường ("văn phòng phẩm tháng 12/2026"). Không đổi type. |

Chưa có, sẽ tới ở đợt 2 (đổi schema): "sửa cuối bởi" không đổi khi chốt, nhận (BE tự sửa, `updatedAt` của dòng đọc từ cột
mới, FE không phải làm gì); thông báo HCNS khi phòng nhận thiếu (type mới, cần thêm vào bảng định tuyến chuông).

## ④ Việc phải làm và màn hình

Ưu tiên theo thứ tự. "Gộp" là cùng một gốc, sửa một lần.

**Nặng**
- F-32 `BookingFormModal.vue`: hộp "Sửa lượt họp" điền ô Ngày bằng **hôm nay** thay vì ngày của lượt; chỉ đổi giờ rồi Lưu là
  lượt bị dời sang hôm nay, thông báo người dự ghi ngày sai (NV1, có cả desktop). Sửa: điền ngày theo `startAt` của lượt (giờ
  Việt Nam). Toast đặt, lưu lượt nói cả ngày: "Đã đặt Phòng họp nhỏ từ 09:00 đến 10:00 ngày 22/11/2026." (NV13).

**Dùng chung mọi trang**
- F-1 `components/ui/PageHeader.vue`: chạm ⓘ trên điện thoại mở rồi đóng ngay; chuỗi sự kiện "touchend → mouseenter (mở) →
  click → mouseleave (đóng)" trong 3–50 ms (TP1, TK4, NV7, cả ba vai). Chỉ mở/đóng theo hover khi `pointerType === 'mouse'`
  (hoặc `@media (hover: hover)`), chạm thì bật tắt bằng click, chạm ra ngoài thì đóng.
- F-28 Nút trợ lý nổi đè chữ dòng cuối trên điện thoại (TK9, NV14): chừa khoảng dưới cùng ở các màn office (như bạn đã làm
  cho tổng tiền kỳ).

**Văn phòng phẩm, `app/pages/office/supplies.vue` và form dòng**
- F-8 Ô số lượng: "2,5"/"1.5" thành 25/15, "-3" thành 3, "5 hộp" thành 5, âm thầm (TP9, NV3). Không ghép chữ số: có ký tự
  khác chữ số thì báo dưới ô "Số lượng là số nguyên, ví dụ 2" và không cho thêm/lưu.
- F-10 Nút xám không nói thiếu gì (TP11, TP12, NV10, NV17): "Thêm dòng" khi chưa có số, "Thêm" khi thiếu đơn vị, "Lưu" khi ô
  trống. Nút vẫn bấm được và báo dưới ô thiếu; xoá câu lỗi cũ khi giá trị đã hợp lệ (cả TK6 ở form đặt phòng).
- F-34 Số đã gõ chưa bấm Lưu mất khi chuyển thẻ tháng, rời trang (NV4): lưu khi rời ô hoặc Enter, hoặc hỏi lại trước khi
  rời trang khi còn số chưa lưu.
- F-11 Xoá dòng không hỏi lại, nút Xoá sát nút Lưu trên điện thoại (TP13, NV5): hỏi lại kèm tên, số, người nhập; hoặc toast
  có Hoàn tác vài giây.
- F-33 Phiếu bị khoá sớm không có câu giải thích, vẫn ghi hạn chót cũ (NV2): dùng `period.lockAt`/trạng thái kỳ để ghi
  "HCNS đã khoá kỳ này lúc {giờ ngày}, phiếu không sửa được nữa. Phòng còn thiếu thì báo HCNS tạo phiếu bổ sung."
- F-7 Tìm mặt hàng đã có trong phiếu ra "Không tìm thấy kết quả" (TP7): vẫn hiện, ghi "đã có trong phiếu, sửa số ở dòng bên
  dưới". F-35 Tìm không dấu (NV8): "but chi" phải ra "Bút chì gỗ".
- F-12 Điện thoại: ô chọn mặt hàng hiện tên nhóm che tên mặt hàng (TP14, NV15): tên mặt hàng trước, nhóm là dòng phụ.
- F-17 Định mức thiếu đơn vị ở dòng phiếu và câu kiểm tại chỗ (TP20): "Định mức 10 Chiếc mỗi tháng".
- F-14 Nhóm "ngoài danh mục" chen giữa các nhóm (TP17): luôn ở cuối.
- F-19 Lấy số tháng trước lần hai: "Đã thêm 0 dòng…" (TP23) → "Phiếu đã có đủ các mặt hàng của tháng 11/2026, không có gì
  để thêm."
- F-36 Hai người cùng sửa: gặp 404 dòng đã xoá hoặc 409 dòng đã có thì tự tải lại phiếu (NV11).
- F-38 Ô tên, đơn vị ngoài danh mục: `maxlength` 200 và 30 theo API (NV18).
- F-13 Đầu mối: ẩn "Bỏ đầu mối" khi chưa có ai; "Lưu đầu mối" khi chưa chọn thì báo "Bạn chọn một nhân viên", không gửi
  `null` (TP16).
- F-2 Hộp "Xác nhận đã nhận hàng" trên điện thoại cắt cột, ô thực nhận trông trống, cột Ghi chú khuất (TP2): mỗi mặt hàng
  một khối dọc (tên, đã chốt, ô thực nhận, ô ghi chú).
- F-6 + F-39 Phiếu đã chốt/đã nhận: thành tiền đứng cạnh số chốt dù tính theo số nhận; "Số xin" in to hơn số chốt (TP6,
  NV19). Thứ tự Số xin (nhỏ) → HCNS chốt (nổi nhất trước khi nhận) → Đã nhận; thành tiền đứng cạnh số dùng để tính.

**Bảng tổng hợp, báo cáo chi phí (`management/office/supply-periods/[id].vue`, `reports.vue`)**
- F-5 Theo `scope` mới (TP5): `DEPARTMENT` ẩn Dự trù, cột số là "Tổng".
- F-4 Báo cáo chi phí: trưởng phòng chọn được phòng khác rồi nhận 403 kèm "Thử lại" (TP4): khoá ô theo `scope`/`departmentId`.
- F-3 Điện thoại: báo cáo và bảng tổng hợp khuất cột tiền, dòng tổng không thấy số (TP3): cột tiền thấy ngay (ghim cột hoặc
  đổi thành thẻ), có dấu hiệu còn nội dung bên phải.
- F-18 Tên trang "Báo cáo chi phí văn phòng" → "Chi phí văn phòng phẩm" (menu, tiêu đề, Excel cùng một tên); cột "Số dòng"
  → "Số mặt hàng", "Dòng chưa có đơn giá" → "Mặt hàng chưa có đơn giá" như Excel (TP21).
- F-20 "Khoá sớm" khoá ngay không hỏi lại (TP, NV gặp khi dựng tình huống): hỏi lại kèm số phòng chưa nhập.
- F-21 Toast mở kỳ "hạn chót ngày 2026-12-25" (ngày dạng máy) → `dd/mm/yyyy`.

**Phòng họp (`app/pages/office/rooms.vue`, `BookingFormModal.vue`, `BookingDetailModal.vue`)**
- F-9 Trùng giờ: hộp đặt hoặc sửa tự đóng, mất hết chữ (TP10, TK2, NV6): giữ hộp mở, hiện câu của server dưới ô giờ.
- F-22 + F-16 Lịch phòng: bề rộng tối thiểu làm lượt 30 phút đè lượt kế tiếp như trùng giờ, lượt 10 phút bị che kín không bấm
  được (TK1, TP19). Bề rộng đúng thời lượng, chữ cắt bớt (hoặc chỉ giờ); lượt ngắn vẫn bấm được (điểm bấm có thể rộng hơn
  nhưng không vẽ đè). Rê hoặc chạm hiện đủ tên.
- F-23 + F-41 Lịch điện thoại: cột tên phòng không dính khi cuộn ngang, chiếm gần nửa màn, không có dấu hiệu còn buổi chiều
  (TK3, NV16, TP19): cột tên dính trái và hẹp lại, tự cuộn tới giờ hiện tại khi xem hôm nay, có bóng mờ báo còn nội dung.
- F-24 Thiết bị phòng (`room.equipment`, đã có trong API) không hiện ở lịch và ô chọn phòng (TK5): hiện cạnh sức chứa.
- F-27 + F-37 Ngày, giờ đã qua vẫn bấm ô đặt được, lỗi "Không đặt được giờ đã qua." hiện dưới ô Giờ kết thúc (TK8, NV12):
  làm mờ, không cho bấm ô đã qua.
- F-26 Xoá ô Ngày ở lịch → hộp lỗi máy chủ "Ngày không được để trống." + nút "Thử lại", nút "Đặt phòng" biến mất (TK7):
  xoá ngày thì về hôm nay.
- F-15 Ô Người dự trong hộp sửa không ghi "(đã nghỉ việc)" (TP18).
- F-29 Lượt riêng tư đã huỷ, người ngoài xem: tiêu đề hộp vẫn "Đã có người đặt" (TK10) → "Lượt riêng tư đã huỷ".
- F-30 "Trống cả ngày" sau khi phòng đã có người họp hôm nay (TK11): `until: null` là "Trống đến hết ngày".
- F-31 Lịch của tôi: dùng `timing`; lượt `ENDED` làm mờ, xếp sau lượt sắp tới (TK15).
- F-40 Toast huỷ "Người liên quan vừa nhận thông báo." khi không có ai khác (NV20): chỉ nói câu sau khi có chủ trì hoặc người
  dự khác người huỷ.

Không làm (đã báo user, ngoài module): "Công ty Công ty D" ở thanh trên, tên menu Chấm công khác tiêu đề trang, "Hủy"/"Huỷ"
cả app, toast "Bạn không có quyền truy cập trang này" của guard chung.

## ⑤ Scenario FE phải smoke (bấm thật, chụp ảnh)

| # | Kịch bản | Mong đợi |
|---|---|---|
| FE-35 | Sửa lượt ngày mai, chỉ đổi giờ kết thúc, lưu | Lượt vẫn ở ngày mai; toast có ngày; thông báo người dự đúng ngày |
| FE-36 | Chạm ⓘ trên 390×844 ở 3 trang (office, nghỉ phép, chấm công); chạm ra ngoài | Mở và giữ; chạm ngoài thì đóng; desktop rê vẫn mở |
| FE-37 | Ô số: gõ "2,5", "-3", "5 hộp", để trống rồi Lưu | Báo dưới ô, không lưu số sai, không im lặng |
| FE-38 | Gõ 12 chưa lưu rồi chuyển thẻ tháng | Lưu khi rời ô, hoặc hỏi lại; không mất im lặng |
| FE-39 | Xoá dòng | Hỏi lại hoặc có Hoàn tác |
| FE-40 | Trưởng phòng mở bảng tổng hợp và báo cáo chi phí (desktop, điện thoại) | Không có cột Dự trù; ô phòng khoá; cột tiền thấy được trên điện thoại |
| FE-41 | Đặt trùng một phần lượt của mình, rồi trùng lượt người khác | Hộp vẫn mở với dữ liệu; câu mới dưới ô giờ |
| FE-42 | Lịch có lượt 10 phút, 30 phút nối lượt khác (desktop, điện thoại) | Không đè; lượt ngắn bấm được; cột tên phòng dính khi cuộn ngang |
| FE-43 | Lịch của tôi có lượt đã qua, đang họp, sắp tới | Nhãn "Đã kết thúc" (mờ, xếp sau), "Đang họp", "Đã đặt" |
| FE-44 | HCNS khoá sớm; nhân viên mở phiếu | Hỏi lại trước khi khoá; phiếu có câu khoá sớm kèm giờ |
| FE-45 | Tìm "but chi"; tìm mặt hàng đã có trong phiếu; thêm ngoài danh mục "but bi note mau xanh" | Ra kết quả; ghi "đã có trong phiếu"; server chặn với câu nêu tên đúng |
| FE-46 | Nhận hàng trên điện thoại, báo thiếu một dòng | Từng mặt hàng một khối dọc, ô thực nhận, ghi chú thấy ngay |

Chạy lại FE-01..FE-34 theo bộ hiện có, sandbox mới nên FE-04 chạy lại được.

## ⑥ Báo lại

File đã sửa (theo nhóm), bảng smoke `# | Vai | Kịch bản | Thực tế | ✓` cho FE-35..FE-46 cộng tổng FE-01..FE-34, đường dẫn ảnh,
`build` + `vitest` (exit code), và mọi chỗ hợp đồng API không khớp.

## ⑦ Giới hạn

Không sửa repo BE, không tự workaround ở FE một contract sai của BE (báo lại để sửa ở BE). Không commit, không push. Không
dừng hay dựng lại sandbox. Không chạy `nuxt build` lúc bài bấm thử đang chạy (cùng `.nuxt` với dev server).

---

# Đợt 2 (HCNS, giám đốc; thêm hai thay đổi schema)

Báo cáo gốc: `uat/hcns/bao-cao-dot-b.md`, `uat/giam-doc/bao-cao-dot-b.md` (cùng thư mục scratchpad ở mục ②), ảnh ở
`uat/<vai>/dot-b/shots/`. Mã lỗi gốc: H = HCNS, GĐ = giám đốc. Sandbox 3190 được dựng lại lần nữa với migration mới
(cột `editedAt`, type `OFFICE_SUPPLY_RECEIVED`); dữ liệu lại mới.

## ③b Thay đổi API thêm

| Chỗ | Thay đổi |
|---|---|
| Lượt họp | Thêm `canCancel`. `canEdit` nay `false` khi OFFICE ở chế độ chỉ xem (hết hạn, ân hạn); huỷ vẫn được. Nút Huỷ theo `canCancel`, nút Sửa theo `canEdit`. |
| Phiếu văn phòng phẩm | `canEdit=false` khi OFFICE chỉ xem; `canReceive` không đổi (vẫn nhận được). |
| Bảng tổng hợp | `rows[].overQuota` (có phòng xin vượt định mức, lý do trong `notes`). |
| Kỳ `LOCKED` | `statusLabel` theo tiến độ: "Đã khoá, chờ HCNS chốt", "Đã chốt, chờ cấp", "Đã cấp, chờ các phòng nhận", "Các phòng đã nhận, chờ đóng kỳ". `status` vẫn `LOCKED`. |
| Dòng phiếu | `updatedAt` là giờ phòng sửa; HCNS chốt, cấp, phòng nhận không đổi giờ này nữa. |
| `correct-received` | Chỉ đếm dòng đổi số hay ghi chú; không đổi gì → 400 `OFFICE_SUPPLY_NOTHING_CHANGED`. |
| Thông báo mới | `OFFICE_SUPPLY_RECEIVED` (refType `office_supply_period`, mở `/management/office/supply-periods/{refId}`): phòng nhận thiếu (có push), các phòng đã nhận hết. `OFFICE_SUPPLY_PERIOD_CHANGED` khi HCNS huỷ kỳ: **không có `refId`**, mở `/office/supplies`. Thêm vào định tuyến chuông (`docs/backend/bridges/fcm-notification-routing.json` 1.3.2). |
| Nhập danh mục | Dòng có nhóm, đơn vị, giá mà thiếu tên có trong danh sách lỗi; ô số có số lẻ làm tròn tới đồng. Không đổi contract. |
| Phòng họp | Thiết bị bỏ trùng khác hoa thường. Không đổi contract. |

## ④b Việc phải làm

**Chế độ chỉ xem (GĐ2)**: F-43 ẩn "Đặt phòng", ô trống trên lịch, "Sửa, dời giờ", ô nhập phiếu khi `/me/entitlements` cho
OFFICE `state: 'READ_ONLY'`, cộng theo `canEdit`; huỷ lượt theo `canCancel`, nhận hàng theo `canReceive`. Băng chỉ xem gọi đúng
tên phân hệ ("Hành chính văn phòng"), không "tính năng".

**Văn phòng phẩm**
- F-44 Bảng tổng hợp tô dòng `overQuota` (GĐ4).
- F-46 Hai phiếu cùng tháng ở hai văn phòng: ô chọn phiếu ghi tên văn phòng (GĐ6).
- F-47 Người không thuộc phòng ban (giám đốc, HCNS): "Bạn chưa thuộc phòng ban nào nên không có phiếu văn phòng phẩm. Cần gì
  bạn báo HCNS." thay vì bảo chờ HCNS mở kỳ (GĐ8, H13).
- F-51 "Khoá sớm" và "Đóng kỳ" hỏi lại kèm hậu quả ("còn 7 ngày tới hạn, các phòng sẽ không sửa được nữa"; "đóng kỳ thì
  không sửa số được nữa") (H2, gộp F-20).
- F-52 Bấm thông báo cũ của kỳ đã huỷ: phiếu 404 thì nói "Phiếu này không còn, có thể kỳ đã bị HCNS huỷ", ở lại trang
  danh sách, không nhảy sang kỳ khác, không bảo tải lại (H3).
- F-53 Khi công ty chưa có văn phòng: người có quyền cài đặt thấy "Bạn tạo văn phòng ở Cài đặt hành chính" kèm liên kết;
  đừng nói "bấm Mở kỳ mới" khi nút không hiện, đừng bảo HCNS "liên hệ HCNS" (H5, H22).
- F-54 Cài đặt định mức trên điện thoại: tên mặt hàng trước, nhóm dòng phụ; ô số có nhãn "Định mức mỗi tháng" (H6).
- F-55 Hộp chốt phiếu của HCNS trên điện thoại: mỗi mặt hàng một khối dọc như F-2 (H7).
- F-58 "Sửa số thực nhận": chỉ gửi dòng đã đổi; khi đổi số thì nhắc sửa ghi chú dòng (đang còn "thiếu 2" sau khi sửa thành
  9/10) (H15).
- F-59 Báo cáo chi phí: "Đến tháng" tự theo "Từ tháng" khi nhỏ hơn; mặc định tháng gần nhất có số (H16).
- F-60 Mở kỳ mới: mặc định tháng gần nhất văn phòng đó chưa có kỳ (H17).
- F-61 Hộp chốt: thành tiền và tổng tiền phiếu tính ngay khi sửa số chốt, theo đơn giá kỳ (H18).
- F-45 Báo cáo chi phí: một câu cơ sở tính dưới bảng: "Chi phí tính theo số các phòng thực nhận (chưa nhận thì số chốt) nhân
  đơn giá của kỳ; chưa gồm dự trù HCNS mua thêm. Kỳ chưa khoá chưa có số." (GĐ5; user đã để sau dòng dự trù.)
- F-50 "Số cần mua bằng tổng cộng dự trù." → "Số cần mua bằng tổng số các phòng cộng dự trù." (GĐ17).

**Phòng họp**
- F-48 "(đã nghỉ việc)" ở dòng Lịch của tôi và ô Người dự trong hộp sửa (GĐ10, gộp F-15).
- F-49 Nút "Đặt phòng" góc trên: giờ mặc định nằm trong khung lịch (giờ làm việc đầu tiên còn trống, hôm nay thì từ giờ hiện
  tại), không phải 02:00 (GĐ11).

**Chung**
- F-42 Trang Tổng quan: tiêu đề "Dashboard" → "Tổng quan"; "Tổng quan toàn công ty" là mô tả, đưa vào ⓘ (GĐ14).
- F-56 Ô ngày: gõ ngày không có thật ("31/11/2026") thì báo dưới ô và giữ chữ đã gõ, không lặng lẽ quay về ngày cũ; lỗi cũ tắt
  khi ngày đã hợp lệ (H10, H11, gộp F-25).
- F-57 Nút trợ lý che "Tổng tiền phiếu" cả trên desktop (H12, gộp F-28).
- F-62 Định tuyến chuông cho `OFFICE_SUPPLY_RECEIVED` và `OFFICE_SUPPLY_PERIOD_CHANGED` không có `refId`.

Không làm (đã báo user): mô tả vai trò Admin có chữ kỹ thuật, toast gõ thẳng route module chưa mua, biểu tượng 🔄 ở lời mời.

## ⑤b Scenario thêm

| # | Kịch bản | Mong đợi |
|---|---|---|
| FE-47 | Công ty `exp` trên sandbox 3190 (OFFICE hết hạn, chỉ xem; tài khoản ở `sandbox-office-fe.json` → `companies.exp`): HR, nhân viên mở Đặt phòng họp, Văn phòng phẩm; nhân viên mở lượt họp ngày mai của mình | Không có nút đặt, ô trống không bấm được, không có nút sửa; nút Huỷ còn và huỷ được |
| FE-48 | Kỳ có dòng vượt định mức: bảng tổng hợp | Dòng tô màu, ghi chú có lý do |
| FE-49 | Phòng nhận thiếu; nhận phiếu cuối của kỳ | Chuông HCNS có hai thông báo, bấm mở trang kỳ |
| FE-50 | HCNS huỷ kỳ đã gửi thông báo; trưởng phòng bấm thông báo mở kỳ cũ và thông báo huỷ | Câu "phiếu không còn", không nhảy kỳ khác; thông báo huỷ mở /office/supplies |
| FE-51 | Khoá sớm, đóng kỳ | Hộp hỏi lại có hậu quả |
| FE-52 | HCNS "Sửa số thực nhận" một dòng | Thông báo "ở 1 dòng"; không đổi gì thì câu 400 hiện ở hộp |
| FE-53 | Giám đốc không thuộc phòng ban mở Văn phòng phẩm | Câu "Bạn chưa thuộc phòng ban nào…" |
| FE-54 | Công ty mới chưa có văn phòng: HCNS mở Kỳ và Đặt phòng | Câu dẫn tới Cài đặt kèm liên kết |

---

# Đợt C (bấm lại lỗi đợt B): việc còn sót

Năm vai bấm lại lỗi của mình trên web 4032 (bản build từ worktree của bạn lúc ~03:40). Đa số đã hết. Còn sót dưới đây; báo cáo
gốc `uat/<vai>/bao-cao-dot-c.md`, ảnh `uat/<vai>/dot-c/shots/c-*.png`. Sandbox 3190 vừa dựng lại (bản BE mới nhất; `exp` nay
có hai lượt họp).

## API đổi thêm

| Chỗ | Thay đổi |
|---|---|
| `POST /me/office/supply-requests/:id/copy-previous` | Thêm `existing`: số mặt hàng phiếu đã có, KHÔNG còn nằm trong `skipped`/`skippedItems`. `added = 0`, `skipped = 0` là phiếu đã đủ. |
| `POST /office/supply-periods` | Tháng trước tháng hiện tại → 400 `OFFICE_SUPPLY_PERIOD_MONTH_PAST` ("Tháng 10/2026 đã qua. Bạn chọn tháng 11/2026 hoặc tháng sau."). |
| Excel báo cáo chi phí | Thêm dòng cơ sở tính (cùng câu với trang). Không đổi contract. |

## Việc phải làm (ưu tiên theo thứ tự)

- C-9 **NẶNG, lệch tiền** `RequestDetailModal.vue` (HCNS M1): phiếu đã nhận, HCNS sửa thực nhận Bút bi 10 → 9; hộp phiếu của
  HCNS ghi "Tổng tiền phiếu 586.000" (tính theo số chốt), trang của phòng và báo cáo ghi 581.000 (theo số thực nhận). Sau
  khi nhận, thành tiền phải theo số thực nhận như `amount` của API (F-61 chỉ tính lại khi đang sửa số chốt). Ảnh
  `uat/hcns/dot-c/shots/c-moi-hop-phieu-tien-sau-nhan-desktop.png`.
- C-10 (HCNS M2, H17) Hộp Mở kỳ chọn sẵn "Tháng 10/2026" vào ngày 19/11: chỉ cho chọn từ tháng hiện tại trở đi, mặc định tháng
  gần nhất từ tháng hiện tại chưa có kỳ; bắt `OFFICE_SUPPLY_PERIOD_MONTH_PAST` ở ô tháng.
- C-1 (NV11) Thêm mặt hàng người khác vừa thêm: 409 `OFFICE_SUPPLY_LINE_EXISTS` ở form THÊM chưa tự tải lại phiếu (F-36 mới
  phủ đường sửa, xoá).
- C-2 (NV16, NV mới, TP19) Lịch điện thoại: cột tên phòng hẹp quá, hai phòng đều "Phòng họ…" (tên phòng là thứ phải đọc được:
  cho xuống dòng hoặc rộng hơn); khối 30 phút chỉ còn "0."; desktop khối 1 giờ vẫn cắt "Giao ba…" (cân nhắc chỉ in giờ bắt đầu
  hoặc tên rút gọn, câu đủ ở title như đã làm).
- C-3 (NV, TP) Ô số: gõ "2,5"/"1,5" thì ô hiện 25/15 dù đã báo lỗi; câu "đang có chữ không phải chữ số" khó hiểu. Giữ nguyên chữ
  người dùng gõ ("2,5") và nói "Số lượng là số nguyên, ví dụ 2".
- C-4 (NV mới) Xoá trắng ô số của dòng có định mức thì hiện thừa ô "Lý do vượt định mức".
- C-5 (TP6) Phiếu đã nhận: "Số xin" vẫn nằm dưới cùng sau "HCNS chốt", "Đã nhận"; thứ tự Số xin → HCNS chốt → Đã nhận.
- C-6 (TP20) Câu lỗi vượt định mức tại chỗ còn thiếu đơn vị: "Số này vượt định mức 10 của phòng, bạn ghi lý do." → "…10 Chiếc mỗi
  tháng…".
- C-7 (TP23) Lấy số tháng trước lần hai vẫn "Đã thêm 0 dòng… Bỏ qua 3 dòng": dùng `existing` mới.
- C-8 (TP mới) Bảng tổng hợp điện thoại: cột Thành tiền ghim đè lên cột số của phòng (tiêu đề còn "Tài c", không thấy số).
- C-11 (H10, H11) Ô hạn chót: câu "Hạn chót không được trước hôm nay." còn treo sau khi đã sửa đúng; gõ "31/11/2026" vẫn hiện câu
  cũ thay vì câu "ngày không có thật" của DatePicker (lỗi của form đè lỗi của ô).
- C-12 (H13) HCNS không thuộc phòng ban: "…Cần gì bạn báo HCNS." → người có quyền quản lý kỳ thì chỉ tới mục Kỳ văn phòng phẩm.
- C-13 (H16) Báo cáo: "Tháng kết thúc không được trước tháng bắt đầu." còn treo khi hai ô đã cùng tháng.
- C-14 (H nhẹ) Kết quả nhập Excel ghi "0 dòng được bỏ qua" mà ngay dưới có 5 dòng "bỏ qua dòng này" (đếm cả dòng lỗi bị bỏ);
  "Cài đặt hành chính ," thừa dấu cách trước dấu phẩy.

Còn chờ báo cáo đợt C của vai thư ký; có gì tôi gửi thêm.

## Scenario

Chạy lại các bài có liên quan (supplies, manage, rooms, mobile) và thêm: FE-55 tiền hộp HCNS sau khi sửa thực nhận khớp trang
phòng và báo cáo; FE-56 mở kỳ không chọn được tháng đã qua; FE-57 lấy số tháng trước lần hai ra "Phiếu đã có đủ…"; FE-58 lịch
điện thoại đọc được tên hai phòng; FE-59 thêm trùng người khác vừa thêm thì phiếu tự tải lại. Báo lại theo mục ⑥.
