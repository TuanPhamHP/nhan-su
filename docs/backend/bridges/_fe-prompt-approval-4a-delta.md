# Bàn giao FE — lô 4a, đợt sửa sau báo cáo FE (17/11/2026)

Đợt này nối tiếp `_fe-prompt-approval-4a.md`. Gồm ba phần: yêu cầu mới của chủ sản phẩm về ô nhập số, các thay đổi
contract BE theo báo cáo của FE, và phần mẫu in.

## ① Repo, nhánh

- FE: worktree `/home/tuanpham/work/hr-system/.worktrees/fe-approval`, nhánh `feat/approval`. Sửa cả các màn tài sản
  ngay trên nhánh này để thành phần ô số chỉ viết một lần.
- BE: worktree `/home/tuanpham/work/hr-system/.worktrees/be-approval`, nhánh `feat/approval`. FE không sửa repo BE.

## ② Đọc trước

- `nhan-su/CLAUDE.md` (luật của repo FE).
- `docs/backend/bridges/general-requests.md`, đã đồng bộ với bản BE. Đọc mục 2.1, 2.3 và các gạch đầu dòng mới ở mục 6:
  người đã chọn khi nộp lại, câu lý do bỏ bước, ô số.
- `../be-approval/docs/openapi.json` đã sinh lại.

## ③ Thay đổi API

| # | Thay đổi | FE cần làm |
|---|---|---|
| A1 | `PUT /general-requests/templates/:id/flow` nhận thêm `expectedVersion?: number`. Khác phiên bản hiện tại thì 409 `APPROVAL_FLOW_CHANGED`; vắng thì ghi đè như cũ | Gửi `version` của lần `GET` gần nhất. Nhánh xử lý 409 FE đã viết sẵn |
| A2 | `PATCH /:id/submit` khi nộp lại mà không có `pickedApprovers`: máy chủ dùng lựa chọn của vòng ngay trước. HR đã lưu luồng phiên bản mới giữa hai vòng thì 400 `REQUEST_NO_APPROVER` | Giữ cách FE đang tự điền lại người đã chọn vào form cũng được, vì gửi `pickedApprovers` thì máy chủ luôn dùng bản mới. Khi gặp 400 thì mở lại ô chọn người |
| A3 | `basis` của bước bị bỏ qua là câu tiếng Việt có dấu nhóm nghìn, VD "Bỏ qua vì phiếu không thoả điều kiện: Số tiền từ 100.000.000 trở lên" | Hiện nguyên văn |
| A4 | openapi khai đúng kiểu: các mảng id là `number[]`, `DocumentTemplateResponseDto.fields` là `FieldDefinitionDto[]`, các trường ngày là `string` `date-time` nullable, `PendingRequestResponseDto.dueAt` bắt buộc và nullable | Đối chiếu lại type tay nếu có lệch |
| A5 | Không thêm `/v1/approval-delegations/candidates`. `GET /v1/employees` chỉ cần đăng nhập, không gắn quyền nào | Giữ cách lấy danh bạ hiện tại |

Hai quyết định FE tự làm ở báo cáo trước đều giữ: nút duyệt nhanh trong chuông chỉ mở cho `general_request`, và quản
trị viên dùng chữ "Quyết định thay".

## ④ Việc phải làm

### N. Ô nhập số tự định dạng (yêu cầu mới, áp dụng module Tài sản và module Phê duyệt)

Gõ `80000` thì ô hiện `80.000`, gõ `1234,59` thì hiện `1.234,59`. Dấu chấm là dấu nhóm nghìn, dấu phẩy là phần thập
phân, theo kiểu Việt Nam.

Làm một thành phần dùng chung (gợi ý `UiNumberInput`, đặt cạnh `UiDatePicker`):
- `v-model` là `number | undefined`; ô trống là `undefined`, không phải `0`. Gửi lên API luôn là số JSON, không gửi chuỗi
  đã định dạng (BE đọc `"80.000"` thành 80).
- Prop `decimals` là số chữ số thập phân tối đa; `0` là ô số nguyên, không nhận dấu phẩy. Có thêm `min`, `max`,
  `placeholder`, `disabled`, `id`, và nhận được `v-bind="xxxAttrs"` của vee-validate.
- `type="text"`, `inputmode="numeric"` khi `decimals = 0`, còn lại `inputmode="decimal"`.
- Định dạng ngay khi gõ và giữ vị trí con trỏ, kể cả khi sửa giữa chuỗi. Gõ dở `1.234,` hay `1.234,50` thì giữ nguyên
  phần đang gõ, rời ô mới chuẩn hoá.
- Ô có số lẻ mà người dùng gõ dấu chấm thì coi là dấu thập phân, vì dấu chấm nhóm nghìn là ô tự chèn, người dùng không
  phải gõ. Thừa số lẻ thì cắt bớt. Chữ cái và dấu trừ bị bỏ.
- Dán chuỗi vào ô thì đọc như sau. Có dấu phẩy thì dấu phẩy là phần thập phân và mọi dấu chấm là dấu nhóm. Không có
  dấu phẩy mà có nhiều dấu chấm thì đều là dấu nhóm. Chỉ một dấu chấm và đúng 3 chữ số sau nó thì là dấu nhóm
  (`1.234` là 1234). Còn lại một dấu chấm là dấu thập phân (`1234.59` là 1234,59).
- Không cho vượt `Number.MAX_SAFE_INTEGER`.

Thay mọi ô số dưới đây. Số lẻ tối đa lấy theo DTO của BE:

| # | File | Ô | Số lẻ |
|---|---|---|---|
| 1 | `components/modules/asset/AssetFormModal.vue` ~510 | Nguyên giá (`cost`). Đang tự định dạng và cho 6 số lẻ, trong khi BE chỉ nhận 2. Bỏ `moneyText`/`moneyValue` cục bộ | 2 |
| 2 | như trên ~528 | Tỷ giá | 4 |
| 3 | như trên ~571, ~583, ~598 | Bảo hành, số tháng khấu hao, chu kỳ bảo dưỡng (tháng) | 0 |
| 4 | như trên ~587, ~670 | Giá trị thanh lý ước tính, đơn giá | 2 |
| 5 | như trên ~658, ~666 | Ngày neo, số ghế | 0 |
| 6 | `RenewalModal.vue` ~110, ~120, ~130 | Số tiền, tỷ giá, số ghế | 2, 4, 0 |
| 7 | `MaintenanceFormModal.vue` ~199, `MaintenanceCloseModal.vue` ~181 | Chi phí | 2 |
| 8 | `DocumentUploadModal.vue` ~159 | Số tiền | 2 |
| 9 | `DisposalFormModal.vue` ~458 | Giá thu về; đang dùng `formatVndInput`, đổi sang thành phần chung cho đồng bộ | 0 |
| 10 | `pages/management/assets/settings.vue` ~187, ~193 | Số tháng khấu hao, chu kỳ bảo dưỡng mặc định | 0 |
| 11 | `pages/general-requests/create.vue` ~624 | Trường kiểu `number` của mẫu phiếu | 2 |
| 12 | `pages/management/settings/request-types/[id]/flow.vue` ~398, ~454, ~464, ~495 | Số người được chọn, hạn xử lý (giờ) | 0 |
| 13 | như trên ~556 | Giá trị điều kiện khi trường là số và phép so không phải `in` | 2 |

Hai chỗ đi kèm:
- `parseConditionValue` với trường số và phép `in`: hiện `Number("100.000.000")` ra `NaN` nên giá trị thành chuỗi, và
  máy chủ so chuỗi. Bỏ dấu nhóm trước khi đổi sang số, và dùng dấu chấm phẩy để tách các giá trị, vì dấu phẩy đã là phần
  thập phân. Sửa câu hướng dẫn dưới ô cho khớp.
- Bản in định dạng trường `number` như màn chi tiết (`108.000.000`), giống cách đang truyền `dateKeys`.

### P. Mẫu in

- **Trường trống:** khoá là trường có trong mẫu mà không có trong `fieldValues` (trường tuỳ chọn để trống) thì in ra rỗng,
  không in `{{can_cu_2}}`. Dòng `<li>` thành rỗng sau khi ghép thì bỏ. Khoá không phải trường của mẫu thì giữ như cũ
  để HR thấy mẫu gõ sai.
- **Script trong mẫu (bảo mật):** mẫu in là HTML do người có quyền `request-type:manage` soạn. Màn chi tiết đã hiện
  bằng iframe sandbox không có `allow-scripts`, nhưng còn hai chỗ chạy được script của mẫu bằng phiên của người xem:
  phần xem trước trong `TemplateFormModal.vue` (`v-html`, nên `<img src=x onerror=…>` chạy) và cửa sổ in
  (`window.open('')` + `document.write`). Cả hai phải không chạy script. Xem trước thì dùng iframe sandbox như màn chi
  tiết. In thì in từ iframe `sandbox="allow-same-origin allow-modals"`, gọi `contentWindow.print()` từ trang cha; hoặc
  lọc mẫu bằng `DOMParser` (bỏ `script`, `iframe`, `object`, `embed`, mọi thuộc tính `on*`, mọi URL `javascript:`)
  trước khi ghi. Không thêm package mới.
- **Nút "In trang này" trong mẫu Tờ trình** (`.preview-badge`): khi không còn script thì nút này bấm không ăn, nên ẩn
  bằng CSS chèn vào tài liệu in và tài liệu xem trước.
- **"CÔNG TY CÔNG TY A":** mẫu viết sẵn chữ "CÔNG TY" trước `{{ten_cong_ty}}`, và gợi ý của ô là "VD: TNHH ABC". Đây là
  cách nhập, FE không sửa.

## ⑤ Scenario FE phải smoke (bấm thật, có ảnh desktop 1440 và điện thoại 390)

| # | Kịch bản | Mong đợi |
|---|---|---|
| N-01 | Ô tiền phiếu đề xuất gõ `80000` | Hiện `80.000`; payload gửi `80000` (đọc request trong DevTools hoặc log) |
| N-02 | Ô tiền tài sản gõ `1234,59` | Hiện `1.234,59`; payload `1234.59` |
| N-03 | Ô có số lẻ gõ `1234.5` bằng phím dấu chấm | Hiện `1.234,5` |
| N-04 | Ô số nguyên (số tháng, số ghế, hạn xử lý) gõ `,` hoặc `.` | Không nhận |
| N-05 | Ô tiền gõ `1,2345` | Cắt còn `1,23` |
| N-06 | Đặt con trỏ giữa `1.234.567` rồi xoá một chữ số | Con trỏ đứng đúng chỗ, không nhảy về cuối |
| N-07 | Dán `1.234.567,89`, `1234567.89`, `1.234` | Lần lượt `1.234.567,89`, `1.234.567,89`, `1.234` |
| N-08 | Xoá hết một ô tuỳ chọn rồi lưu | Payload không có trường đó hoặc là null, không phải 0 |
| N-09 | Mở sửa tài sản có nguyên giá 18500000.5 | Hiện `18.500.000,5` |
| N-10 | Gõ chữ cái vào ô số | Không hiện |
| N-11 | Điện thoại 390px | Hiện bàn phím số, không tràn ngang |
| N-12 | Luồng duyệt: điều kiện "Số tiền ≥" gõ `100000000`, lưu, mở lại | Payload `value: 100000000` (số); mở lại hiện `100.000.000` |
| N-13 | Điều kiện phép `in` trên trường số, gõ `1.000; 2.000` | Payload `[1000, 2000]` |
| N-14 | Phiếu 108 triệu: chi tiết và bản in | Hiện `108.000.000` |
| N-15 | Nhập tỷ giá `0` | Lỗi BE hiện đúng chỗ, không trắng trang |
| C-01 | Hai tab cùng mở màn luồng duyệt, tab 1 lưu rồi tab 2 lưu | Tab 2 nhận câu "Luồng duyệt vừa được người khác lưu…" rồi tải lại luồng |
| C-02 | Nộp lại phiếu Tờ trình bị trả, không đổi người chọn | Gửi được, vòng 2, cùng người duyệt |
| C-03 | Xem trước 80 triệu | Câu "Số tiền từ 100.000.000 trở lên" |
| P-01 | In Tờ trình bỏ trống Căn cứ 2 và 3 | Không có `{{…}}`, không có dòng gạch đầu dòng rỗng |
| P-02 | Mẫu in có `<img src=x onerror=alert(1)>` và `<script>alert(2)</script>`: xem trước ở màn sửa mẫu, mở chi tiết phiếu, bấm In | Không có hộp alert ở cả ba chỗ |
| P-03 | In Tờ trình | Không còn nút "In trang này" |

Chạy lại các kịch bản FE-01..FE-20 bị chạm (gửi phiếu, sửa luồng, in, các form tài sản), không chỉ bài mới.

## ⑥ Báo lại

File đã sửa, bảng smoke `# | Kịch bản | Mong đợi | Thực tế | ✓/✗ | Ảnh`, exit code của `build` và `vitest`, chỗ nào lệch
contract hoặc doc.

## ⑦ Giới hạn

Không sửa repo BE. Không commit. Không tự lách ở FE một contract sai mà báo lại để BE sửa.
