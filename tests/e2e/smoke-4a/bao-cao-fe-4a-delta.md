# Báo cáo FE — đợt sửa lô 4a (ô nhập số, chốt luồng, bản in)

Nhánh `feat/approval` trong worktree `/home/tuanpham/work/hr-system/.worktrees/fe-approval`, chưa commit.
Sandbox API `http://localhost:3170`, web Nuxt `http://localhost:4020`.
Ảnh nằm ở `tests/e2e/__shots__/approval-4a/`.

## 1. File đã sửa trong đợt này

### Mới

| File | Việc |
|---|---|
| `app/utils/number-input.ts` | Toàn bộ phép tính của ô số: `formatNumberTyping`, `parsePastedNumber`, `formatNumberValue`, `digitsBefore`, `caretAfterDigits`. Thuần hàm, không biết tới Vue. |
| `app/components/ui/NumberInput.vue` | `UiNumberInput` dùng chung cho mười ba ô số. `v-model` là `number \| undefined`, chữ trong ô là kiểu Việt Nam, ô là `type="text"` với `inputmode` số. |
| `tests/number-input.test.ts` | 18 test cho phần tính toán. |
| `tests/number-input-component.test.ts` | 13 test ở mức thành phần, coi như hợp đồng mà mười ba ô kia dựa vào. |

### Sửa

| File | Việc |
|---|---|
| `app/components/modules/asset/AssetFormModal.vue` | Nguyên giá, giá trị thu hồi, đơn giá dùng `UiNumberInput` hai số lẻ; tỷ giá bốn số lẻ; số tháng, số ghế, ngày chốt là ô số nguyên. Bỏ khối `moneyText/moneyValue/onMoneyInput` tự viết trong file. |
| `app/components/modules/asset/RenewalModal.vue` | Ô tiền gia hạn. |
| `app/components/modules/asset/MaintenanceFormModal.vue` | Ô chi phí dự kiến. |
| `app/components/modules/asset/MaintenanceCloseModal.vue` | Ô chi phí thực tế. |
| `app/components/modules/asset/DocumentUploadModal.vue` | Ô số tiền của giấy tờ, giá trị trống là `undefined`. |
| `app/components/modules/asset/DisposalFormModal.vue` | Ô số tiền thu về, bỏ `formatVndInput/parseVndInput`. |
| `app/pages/management/assets/settings.vue` | Ngưỡng tiền và số ngày trong cài đặt tài sản. |
| `app/pages/general-requests/create.vue` | Trường `number` của biểu mẫu dùng `UiNumberInput`; thêm `prefillPicks()` cho lần nộp lại; viền đỏ và cuộn tới ô sai đầu tiên. |
| `app/pages/general-requests/[id].vue` | `printFormat` (khoá ngày, khoá số, khoá đã biết) cho cả khung xem trong trang và bản in. |
| `app/pages/management/settings/request-types/[id]/flow.vue` | Gửi `expectedVersion` khi lưu luồng; ô bậc, số người tối thiểu và tối đa, hạn xử lý, giá trị điều kiện đều là ô số; đệm chữ thô của ô điều kiện bằng `conditionDrafts` để gõ được `.` và `;`. |
| `app/components/modules/general-request/TemplateFormModal.vue` | Khung xem trước mẫu in dựng bằng iframe sandbox, không còn `v-html`. |
| `app/utils/print-template.ts` | `sanitizePrintTemplate` lọc thẻ và thuộc tính nguy hiểm, `tidyPrintHtml` bỏ dòng `<li>` rỗng, `renderPrintHtml` định dạng ngày và số, `PRINT_EXTRA_CSS` ẩn nút trong mẫu. |
| `app/composables/usePrint.ts` | In bằng iframe sandbox thay cho `window.open` cộng `document.write`. |
| `app/utils/general-request.utils.ts` | Câu lý do bỏ bước viết bằng tiếng Việt với số có dấu nhóm nghìn. |
| `tests/print-template.test.ts`, `tests/approval-4a.test.ts` | Cập nhật theo cách in mới và các câu chữ mới. |

## 2. Bảng smoke — ô nhập số

Bài chạy: `smoke-delta.mjs` (phiếu đề xuất, luồng duyệt, bản in) và `smoke-delta-asset.mjs` (màn tài sản).

| # | Kịch bản | Mong đợi | Thực tế | ✓/✗ | Ảnh |
|---|---|---|---|---|---|
| N-01 | Ô tiền phiếu đề xuất gõ `80000` | Hiện `80.000`, payload `80000` | Ô hiện `80.000`; bản PATCH nháp gần nhất có `don_gia: 80000` là số JSON | ✓ | `N-01-o-tien-phieu-de-xuat.png` |
| N-02 | Ô tiền tài sản gõ `1234,59` | Hiện `1.234,59`, payload `1234.59` | Ô hiện `1.234,59`; tạo tài sản với nguyên giá `18500000,5` thì POST `/v1/assets` gửi `cost: 18500000.5` | ✓ | `N-02-o-nguyen-gia-tai-san.png` |
| N-03 | Gõ `1234.5` bằng phím dấu chấm | Hiện `1.234,5` | Cả ô đơn giá của phiếu và ô nguyên giá của tài sản đều ra `1.234,5` | ✓ | `N-01-o-tien-phieu-de-xuat.png`, `N-02-o-nguyen-gia-tai-san.png` |
| N-04 | Ô số nguyên gõ `,` hoặc `.` | Không nhận | Hạn xử lý gõ `16,5` ra `165`; bảo hành gõ `12,5` ra `125`; payload `physical.warrantyMonths` là số nguyên `12` | ✓ | `N-12-dieu-kien-so.png`, `N-08-payload-o-trong.png` |
| N-05 | Ô tiền gõ `1,2345` | Cắt còn `1,23` | Cả hai module cắt còn `1,23` | ✓ | `N-01-o-tien-phieu-de-xuat.png`, `N-02-o-nguyen-gia-tai-san.png` |
| N-06 | Xoá một chữ số ở giữa `1.234.567` | Con trỏ đứng đúng chỗ | Ra `123.567`, `selectionStart` là 3, không nhảy về cuối | ✓ | `N-06-con-tro-giu-cho.png` |
| N-07 | Dán `1.234.567,89`, `1234567.89`, `1.234` | `1.234.567,89`, `1.234.567,89`, `1.234` | Đúng cả ba, trên cả ô phiếu và ô tài sản | ✓ | `N-07-dan-chuoi-so.png` |
| N-08 | Xoá hết một ô tuỳ chọn rồi lưu | Payload không có trường đó, không phải `0` | Xoá ô tỷ giá thì POST không có `exchangeRate` | ✓ | `N-08-payload-o-trong.png` |
| N-09 | Mở sửa tài sản nguyên giá `18500000.5` | Hiện `18.500.000,5` | Trang chi tiết hiện `18.500.000,5`; mở menu Tác vụ rồi Chỉnh sửa thì ô nguyên giá hiện `18.500.000,5` | ✓ | `N-09-mo-sua-tai-san.png` |
| N-10 | Gõ chữ cái vào ô số | Không hiện | `12a3` ra `123`; `18a500b000,5` ra `18.500.000,5` | ✓ | `N-02-o-nguyen-gia-tai-san.png` |
| N-11 | Điện thoại 390 px | Bàn phím số, không tràn ngang | `inputmode="decimal"`, gõ ra `1.500.000` và `2.500.000`; `scrollWidth` bằng `clientWidth` ở cả hai màn | ✓ | `N-11-dien-thoai-o-so.png`, `N-11-dien-thoai-o-so-tai-san.png` |
| N-12 | Điều kiện "Số tiền ≥" gõ `100000000`, lưu, mở lại | Payload số, mở lại hiện `100.000.000` | Payload `value: 100000000` là số JSON; mở lại hiện `100.000.000`, gõ tiếp ra `120.000.000` | ✓ | `N-12-dieu-kien-so.png` |
| N-13 | Phép `in` trên trường số, gõ `1.000; 2.000` | Payload `[1000, 2000]` | Gõ được cả dấu chấm và dấu chấm phẩy, payload `[1000, 2000]`; có câu hướng dẫn tách bằng dấu chấm phẩy | ✓ | `N-13-phep-nam-trong.png` |
| N-14 | Phiếu 108 triệu, chi tiết và bản in | Hiện `108.000.000` | Khung nội dung hiện `108.000.000`, không còn chuỗi `108000000` viết liền | ✓ | `N-14-chi-tiet-so-co-dau-nhom.png` |
| N-15 | Nhập tỷ giá `0` | Lỗi BE hiện đúng chỗ, không trắng trang | Ô nhận số `0` chứ không tự sửa thành 1; lưu thì máy chủ chặn, màn hiện câu lỗi, hộp thoại vẫn mở | ✓ | `N-15-ty-gia-khong.png` |

## 3. Bảng smoke — chốt luồng và nộp lại

| # | Kịch bản | Mong đợi | Thực tế | ✓/✗ | Ảnh |
|---|---|---|---|---|---|
| C-01 | Hai tab cùng lưu luồng duyệt | Tab sau nhận câu "người khác vừa lưu" rồi tải lại | Tab sau nhận câu lỗi của máy chủ, màn tự tải lại và hiện đúng bước của người kia | ✓ | `C-01-xung-dot-luu-luong.png` |
| C-02 | Nộp lại phiếu bị trả, không đổi người chọn | Gửi được, lên vòng 2, cùng người duyệt | Màn nộp lại điền sẵn người đã chọn, nộp được, máy chủ ghi `round: 2`, người duyệt giữ nguyên | ✓ | `C-02-nop-lai-giu-nguoi-duyet.png` |
| C-03 | Xem trước phiếu 80 triệu | Câu "Số tiền từ 100.000.000 trở lên" | Câu lý do bỏ bước đúng như vậy, không còn `>=` và không còn số viết liền | ✓ | `C-03-cau-ly-do-bo-buoc.png` |

## 4. Bảng smoke — bản in

| # | Kịch bản | Mong đợi | Thực tế | ✓/✗ | Ảnh |
|---|---|---|---|---|---|
| P-01 | In Tờ trình bỏ trống Căn cứ 2 và 3 | Không có `{{…}}`, không có dòng gạch đầu dòng rỗng | Không còn `{{`; còn đúng một dòng căn cứ có nội dung | ✓ | `P-01-ban-in-khong-con-o-trong.png` |
| P-02 | Mẫu in có `<img src=x onerror=alert(1)>` và `<script>alert(2)</script>`: xem trước, mở chi tiết, bấm In | Không có hộp alert ở cả ba chỗ | Không hộp thoại nào, `window.__danger` vẫn null ở cả ba chỗ. Xem trước là iframe `sandbox="allow-same-origin"`, bản in là iframe sandbox không có `allow-scripts`, `srcdoc` đã bị lọc hết `script` và `onerror` | ✓ | `P-02a-xem-truoc-khong-chay-script.png`, `P-02b-in-khong-chay-script.png` |
| P-03 | In Tờ trình | Không còn nút "In trang này" | `srcdoc` của bản in có CSS ẩn `.preview-badge, .no-print`, và không còn ô trống dạng `{{…}}` | ✓ | `P-03-ban-in-to-trinh.png` |

Tổng: `smoke-delta.mjs` 53/53, `smoke-delta-asset.mjs` 27/27 khẳng định xanh, không lỗi console.

## 5. Chạy lại các bài FE-xx bị chạm

Sandbox 3170 dựng lại nên dữ liệu của lượt trước mất; BE chạy lại `smoke-4a.cjs` để dựng dữ liệu mầm.

Máy khởi động lại hai lần trong lúc làm, mà bộ smoke FE để trong `/tmp` nên mất sạch. Tôi dựng lại
từ transcript rồi dời vào worktree: `tests/e2e/smoke-4a/` (chưa commit). Bản dựng lại bị cũ ở vài
chỗ câu chữ, nên có mấy bài phải sửa lời khẳng định cho khớp giao diện hiện tại — ghi rõ ở cột ghi chú.

| Bài | Kết quả | Ghi chú |
|---|---|---|
| `smoke-fe01` (FE-01, FE-02, FE-03) | 32/32 ✓ | Bài tự dựng luồng hai bước có điều kiện số tiền cho "Đề xuất đào tạo" trước khi bấm, vì bộ dựng dữ liệu của BE kết thúc khi luồng đó còn một bước "HR duyệt". |
| `smoke-fe04` | 36/36 ✓ | |
| `smoke-fe06` | 24/24 ✓ | |
| `smoke-fe08` | 31/31 ✓ | |
| `smoke-fe10` | 34/34 ✓ | Sửa ba chỗ: nhãn nút đổi thành "Tắt loại phiếu", hai ô chọn đổi nhãn thành "Người duyệt của bước" và "Số người cần đồng ý", câu diễn giải điều kiện nay có dấu nhóm nghìn ("Bước này chỉ được áp dụng khi Số tiền lớn hơn hoặc bằng 100.000.000."). Bài FE-10g nay tự tạo loại phiếu riêng thay vì mượn mã số 12 của bộ dựng dữ liệu. |
| `smoke-fe11` | 27/27 ✓ | |
| `smoke-fe14` | 37/37 ✓ | |
| `smoke-fe17` + `fe18` | 25/25 ✓ | Đã sửa bài: bản in giờ là iframe sandbox nên bài đọc nội dung trong khung, không chờ cửa sổ mới. Ảnh `FE-17b-ban-in.png`. |
| `smoke-fe19` (FE-19, FE-20) | 33/33 ✓ | Sửa ba lời khẳng định theo câu chữ mới sau vòng soát giao diện: "Sửa luồng duyệt", "Điều kiện để bước này được áp dụng", "Bạn chưa được thêm vào phiếu nào để theo dõi". |

## 6. Exit code

| Lệnh | Exit code | Ghi chú |
|---|---|---|
| `npm run build` | 0 | |
| `npx vitest run` | 1 | 312 test xanh, 2 test đỏ sẵn có trong `tests/leave.test.ts` (TC45 so chuỗi `'Đã được duyệt'` với `'Đơn đã được duyệt'`, và một bài so tham số `findOne`), không liên quan lô 4a. |

## 7. Chỗ lệch contract hoặc doc

Chưa thấy chỗ nào lệch trong đợt này. Bốn chỗ báo lần trước (A1 `expectedVersion`, A2 nộp lại giữ người chọn, A3 câu `basis` tiếng Việt, A4 kiểu trong openapi) đều đã khớp khi bấm thật.

Một chỗ đáng ghi lại, không tính là lỗi: trường `number` của mẫu phiếu không có cờ số nguyên, nên ô `so_luong` của mẫu "Đề xuất mua sắm" nhận hai số lẻ. Đúng theo mục 11 của bảng bàn giao.
