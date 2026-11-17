# Báo cáo FE lô 4a — Phê duyệt điện tử (phiếu đề xuất)

Worktree `/home/tuanpham/work/hr-system/.worktrees/fe-approval`, nhánh `feat/approval`, chưa commit.
Web chạy `npx nuxt dev --dotenv <env trỏ 3170> --port 4020`, API sandbox `http://localhost:3170`.

## ① File đã tạo, đã sửa

**Tạo mới (13)**

| File | Việc |
|---|---|
| `app/types/approval-delegation.types.ts` | Kiểu uỷ quyền duyệt |
| `app/utils/general-request.utils.ts` | Hàm thuần: dựng câu hạn xử lý, nhóm nhật ký theo vòng, diễn giải điều kiện, `buildFlowPayload`, `validateFlowDraft`, `parseConditionValue`, `mapFieldErrors`, `printCodeHeader` |
| `app/services/approval-delegation.service.ts` | `/v1/approval-delegations` |
| `app/components/modules/general-request/EmployeePicker.vue` | Ô chọn người có gõ tìm, thẻ tên, giữ thứ tự chọn |
| `app/components/modules/general-request/FlowPreviewPanel.vue` | Xem trước chuỗi duyệt, bước bị bỏ qua, ô chọn người của bước "người gửi chọn" |
| `app/components/modules/general-request/RequestActionModal.vue` | Một hộp thoại cho sáu quyết định: đồng ý, từ chối, trả lại, chuyển, duyệt thay, đổi người duyệt; gửi kèm `stepOrder`, gặp 409 thì tải lại phiếu |
| `app/components/modules/general-request/RequestTimeline.vue` | Nhật ký chia theo vòng |
| `app/components/modules/general-request/RequestComments.vue` | Bình luận có nhắc tên trong số người xem được phiếu |
| `app/components/modules/general-request/RequestAttachments.vue` | Đính kèm, gỡ, mở bằng link ký |
| `app/components/modules/general-request/RequestWatchers.vue` | Người theo dõi và mời cho ý kiến |
| `app/components/modules/approval/GeneralRequestApprovalTab.vue` | Tab "Phiếu đề xuất" của hộp thư phê duyệt (UI-04) |
| `app/components/modules/profile/ProfileApprovalDelegations.vue` | Khối uỷ quyền duyệt ở trang cá nhân (UI-06) |
| `app/pages/management/settings/request-types/index.vue` + `[id]/flow.vue` | Màn loại phiếu và màn cấu hình luồng duyệt (UI-05) |
| `tests/approval-4a.test.ts` | 30 test cho các hàm thuần mới |

**Sửa (21)**

`app/types/general-request.types.ts` (viết lại theo mục 4 bridge doc, thêm 15 cờ `can*`, `steps`, `timeline`, `watchers`, `attachments`, luồng duyệt, xem trước), `app/types/approval.types.ts` + `app/stores/approval.ts` (`counts.generalRequests`), `app/types/notification.types.ts` (9 loại `GENERAL_REQUEST_*` và `APPROVER_REASSIGNED`), `app/services/general-request.service.ts` (toàn bộ route mới), `app/services/index.ts`, `app/composables/useGeneralRequests.ts` (năm hộp phiếu), `app/composables/useDocumentTemplates.ts` (flow), `app/composables/usePrint.ts` (số hiệu trên bản in), `app/utils/permission.ts` (bỏ `general-request:approve`, thêm `REQUEST_PERMISSIONS`), `app/utils/notification-route.ts`, `app/utils/print-template.ts` (`buildPreviewHtml` escape giá trị mẫu), `app/components/notifications/NotificationItem.vue` (mở nút duyệt nhanh cho phiếu đề xuất, thêm đường lùi theo `targetUrl`), `app/components/modules/general-request/ApproverChain.vue` (dựng theo `steps`), `RequestStatusBadge.vue` (thêm `RETURNED`, dùng `statusLabel`), `TemplateFormModal.vue` (tiền tố, bật tắt, người theo dõi mặc định, **vá v-html**), `app/pages/general-requests/{index,create,[id]}.vue`, `app/pages/management/approval/index.vue` (tab mới), `app/pages/management/settings/index.vue` (thẻ dẫn sang màn loại phiếu), `app/pages/profile/index.vue` (tab Uỷ quyền duyệt), `app/config/app-modules.ts` (chuyển `APV` từ `PLANNED_MODULES` sang phân hệ thật: "Phiếu đề xuất", "Chờ tôi duyệt", "Loại phiếu & luồng duyệt").

`business-trips/create.vue` không đổi; `/suggested-approvers` vẫn giữ trong service cho trang đó.

## ② Bảng smoke FE-01..FE-20

Chạy thật trên trình duyệt Chrome, 277 khẳng định, tất cả xanh. Ảnh ở
`tests/e2e/__shots__/approval-4a/` (thư mục không commit). Desktop 1440×900, điện thoại 390×844.

| # | Vai | Kịch bản | Mong đợi | Thực tế | ✓ | Ảnh |
|---|---|---|---|---|---|---|
| FE-01 | KD01 | Gửi "Tờ trình BGĐ", xem trước chuỗi, chọn người duyệt | Danh sách không có mình; xong hiện số hiệu TT- | Gõ tên mình ra "Không tìm thấy ai phù hợp"; chọn QLKD rồi CH01, chuỗi tính lại; gửi xong toast "Đã gửi phiếu, số hiệu TT-0014/2026", mở thẳng trang phiếu | ✓ | `FE-01a-chon-loai-phieu.png`, `FE-01b-khong-chon-duoc-chinh-minh.png`, `FE-01c-chuoi-sau-khi-chon.png`, `FE-01d-phieu-vua-gui.png` |
| FE-02 | KD01 | "Đề xuất đào tạo" 80tr rồi 120tr | 80tr: bước Giám đốc mờ kèm lý do; 120tr: hai giám đốc | 80tr: bước 2 mờ, nhãn "Bỏ qua" và câu "Bỏ qua vì phiếu không thoả điều kiện: Số tiền >= 100000000"; 120tr: hiện Trần Văn Bình và Vũ Thị Hạnh | ✓ | `FE-02a-80-trieu-bo-qua-giam-doc.png`, `FE-02b-120-trieu-hien-hai-giam-doc.png`, `FE-02c-phieu-dao-tao-da-gui.png` |
| FE-03 | KD01 | Thiếu trường bắt buộc, gõ chữ vào ô số | Lỗi tiếng Việt cạnh ô, không trắng trang | Thiếu tiêu đề báo tại ô; `REQUEST_FIELDS_INVALID` được tách theo nhãn trong ngoặc kép nên `"Nội dung" là bắt buộc.` nằm cạnh ô Nội dung, `"Số tiền" là bắt buộc.` cạnh ô Số tiền; ô số không nhận chữ | ✓ | `FE-03b-thieu-truong-bat-buoc.png`, `FE-03c-chu-trong-o-so.png` |
| FE-04 | QLKD | Tab Phiếu đề xuất, đồng ý có ghi chú | Badge đúng `counts.generalRequests`; phiếu sang bước kế | Badge khớp API; bấm dòng mở phiếu; đồng ý kèm ghi chú xong phiếu sang bước 2 (CH01), `canApprove` về false, phiếu rời hộp "Chờ tôi duyệt" | ✓ | `FE-04a-tab-phieu-de-xuat.png`, `FE-04b-chi-tiet-phieu-cho-duyet.png`, `FE-04d-sau-khi-dong-y.png`, `FE-04e-cho-toi-duyet.png` |
| FE-05 | QLKD, KD01 | Trả lại rồi sửa, nộp lại | Về "Cần bổ sung"; nộp lại thành vòng 2, số hiệu giữ; nhật ký tách vòng | Trả lại thiếu lý do bị chặn tại hộp thoại; tab "Cần bổ sung" có số đếm; màn nộp lại tự điền lại người duyệt vòng trước; nộp lại ra "vòng 2", số hiệu giữ nguyên, nhật ký có "VÒNG 1" và "VÒNG 2 (ĐANG CHẠY)" | ✓ | `FE-05a-da-tra-lai.png`, `FE-05b-tab-can-bo-sung.png`, `FE-05c-sua-va-nop-lai.png`, `FE-05d-phieu-vong-2.png` |
| FE-06 | QLKD | Từ chối không lý do, có lý do, duyệt và từ chối nhanh từ chuông | Không lý do bị chặn; có lý do thì "Bị từ chối" | Chặn tại hộp thoại, phiếu giữ PENDING; có lý do thì REJECTED kèm lý do trong nhật ký; chuông có nút "✓ Duyệt" và "✗ Từ chối" cho `GENERAL_REQUEST_PENDING`, bấm xong phiếu APPROVED và REJECTED đúng, lý do từ chối nhanh được lưu | ✓ | `FE-06a-tu-choi-thieu-ly-do.png`, `FE-06b-da-tu-choi.png`, `FE-06c-chuong-thong-bao.png`, `FE-06c-duyet-nhanh-xong.png`, `FE-06d-tu-choi-nhanh-xong.png` |
| FE-07 | QLKD | Chuyển lượt, thử chuyển cho người gửi | Người nhận thấy phiếu; chuyển cho người gửi báo lỗi | Chuyển cho CH01 xong phiếu vào `pending-for-me` của CH01, nhật ký ghi việc chuyển; chuyển cho KD01 bị toast chặn, lượt vẫn ở QLKD | ✓ | `FE-07a-da-chuyen-luot.png`, `FE-07c-chuyen-cho-nguoi-gui-bi-chan.png` |
| FE-08 | KD01, QLKD, KT01 | Bình luận nhắc tên, mời ý kiến, người được mời mở phiếu | KT01 bình luận được, không có nút duyệt | Gõ @ ra danh sách người xem được phiếu, bình luận hiện "Đã nhắc Lê Văn Dũng", `mentionIds` đúng id; mời KT01 xong KT01 nằm trong người theo dõi; KT01 mở phiếu không có nút Đồng ý hay Từ chối, bình luận được (`canApprove=false`, `canComment=true`) | ✓ | `FE-08a-soan-binh-luan-nhac-ten.png`, `FE-08a-binh-luan-da-gui.png`, `FE-08b-moi-cho-y-kien.png`, `FE-08c-nguoi-duoc-moi-binh-luan.png` |
| FE-09 | KD01 | Đính kèm PDF, ảnh, tệp sai loại, tệp thứ 11, mở tệp | Sai loại và quá số lượng báo lỗi; mở tệp tải được | PDF và PNG lên được, khối đếm "2 / 10 tệp"; `.txt` bị chặn ngay ở ô chọn kèm câu lỗi, máy chủ vẫn hai tệp; đủ 10 tệp thì ô chọn bị khoá kèm câu nhắc gỡ bớt; "Mở tệp" mở link ký; gỡ tệp xong còn "9 / 10 tệp" | ✓ | `FE-09a-dinh-kem-pdf-va-anh.png`, `FE-09b-tep-sai-loai.png`, `FE-09c-du-muoi-tep.png`, `FE-09e-sau-khi-go-tep.png` |
| FE-10 | HR01 | Loại phiếu: tiền tố chữ thường, tắt mẫu, người theo dõi mặc định; luồng hai bước có điều kiện; luồng sai | Tiền tố sai báo lỗi; lưu luồng tăng phiên bản; luồng sai hiện câu của BE | Tiền tố `dt` báo "Tiền tố gồm 1 đến 10 chữ in hoa hoặc số"; tắt rồi bật lại mẫu khớp `isActive`; thêm KT01 làm người theo dõi mặc định, máy chủ lưu đúng; soạn bước "Giám đốc phê duyệt" ROLE DIRECTOR kèm điều kiện `so_tien >= 100000000` (lưu đúng kiểu số) và hạn 16 giờ, lưu xong phiên bản +1; bước thiếu tên và thiếu vai trò bị màn chặn trước khi gọi API; dựng tình huống trường điều kiện vừa bị bỏ khỏi biểu mẫu thì toast hiện nguyên văn `APPROVAL_FLOW_INVALID` của BE | ✓ | `FE-10a-danh-sach-loai-phieu.png`, `FE-10b-tien-to-chu-thuong.png`, `FE-10d-tat-mau.png`, `FE-10e-soan-luong.png`, `FE-10e-luong-da-luu.png`, `FE-10f-luong-sai-tu-kiem.png`, `FE-10g-loi-may-chu.png` |
| FE-11 | ADMIN | Duyệt thay phiếu người khác, mở phiếu của mình | Có nút duyệt thay ở phiếu người khác, không có ở phiếu mình | Lý do dưới năm ký tự bị chặn; có lý do thì phiếu APPROVED, nhật ký có `OVERRIDE`; phiếu của chính admin không có nút duyệt thay (`canOverride=false`), có nút thu hồi | ✓ | `FE-11a-nut-duyet-thay.png`, `FE-11b-da-duyet-thay.png`, `FE-11c-phieu-cua-chinh-minh.png` |
| FE-12 | HR01 | Đổi người duyệt phiếu đang chờ | Người mới nhận phiếu; nhật ký ghi "Đổi người duyệt" | Ô "người đang giữ lượt" tự điền QLKD, chọn CH01, lưu xong phiếu vào hộp chờ của CH01 và nhật ký ghi đúng | ✓ | `FE-12b-da-doi-nguoi-duyet.png` |
| FE-13 | QLKT, GĐ02 | Mở phiếu không liên quan | Trang "không tồn tại hoặc không có quyền", không trắng | Cả hai vai nhận trang giải thích kèm đường về danh sách, không lộ số hiệu, không lỗi JS | ✓ | `FE-13a-khong-co-quyen-xem.png`, `FE-13b-giam-doc-khong-lien-quan.png` |
| FE-14 | QLKT, CH01 | Uỷ quyền ba ngày, trùng khoảng, huỷ | Trùng khoảng báo lỗi; CH01 thấy uỷ quyền nhận được | Lập uỷ quyền xong hiện trong "Tôi uỷ quyền cho người khác"; khoảng chồng nhau bị chặn, câu lỗi của máy chủ hiện trong hộp thoại; CH01 thấy ở "Người khác uỷ quyền cho tôi" kèm câu giải thích không huỷ được; huỷ xong danh sách rỗng | ✓ | `FE-14a-khoi-uy-quyen.png`, `FE-14b-da-lap-uy-quyen.png`, `FE-14c-trung-khoang-ngay.png`, `FE-14d-nguoi-nhan-uy-quyen.png`, `FE-14e-da-huy-uy-quyen.png` |
| FE-15 | HR01 | Tra cứu theo số hiệu, tiêu đề, người duyệt, phân trang | Kết quả đúng; HR không thấy nháp của người khác | Số hiệu ra đúng một phiếu; tiêu đề và người duyệt ra đúng; không lọc thì hơn một trang (hiện 58 phiếu), bấm được trang 2; tra tiêu đề nháp của KD01 ra "Không có phiếu nào khớp bộ lọc này", API cũng trả rỗng | ✓ | `FE-15a-tab-tra-cuu.png`, `FE-15b-tra-theo-so-hieu.png`, `FE-15d-tra-theo-nguoi-duyet.png`, `FE-15e-phan-trang.png`, `FE-15f-khong-thay-nhap-nguoi-khac.png` |
| FE-16 | KD01 | Xoá nháp, thu hồi, thu hồi khi đã có người đồng ý | Hai việc đầu được; việc thứ ba báo lỗi rõ | Xoá nháp xong máy chủ trả 404 cho phiếu đó; thu hồi phiếu chưa ai duyệt được; phiếu đã có một lượt đồng ý thì nút thu hồi biến mất và trang nói rõ "Phiếu đã có người đồng ý ở vòng này nên không thu hồi được nữa. Bạn nhờ người đang giữ lượt trả lại phiếu để bổ sung, rồi nộp lại.", API trả 409 | ✓ | `FE-16a-da-xoa-nhap.png`, `FE-16b-da-thu-hoi.png`, `FE-16c-khong-thu-hoi-duoc.png` |
| FE-17 | KD01 | In phiếu đã duyệt có `<b>` trong nội dung | Bản in hiện ký tự thô | Khung nội dung và cửa sổ in đều hiện `<b>chữ đậm</b>` dạng chữ, không sinh thẻ `b` hay `script`; bản in có dòng số hiệu; `printCount` tăng | ✓ | `FE-17a-noi-dung-ky-tu-tho.png`, `FE-17b-ban-in.png` |
| FE-18 | e1@old.drill | Đơn cũ sau nâng cấp | Hiện đúng số hiệu, các bước, nhật ký | Danh sách có đơn đã duyệt và đơn đang chờ kèm số hiệu; đơn 4 hiện đủ "Người duyệt 1", "Người duyệt 2" và nhật ký; đơn 3 đang chờ ở "Người duyệt 2"; đơn cũ không có hạn thì màn ghi "Không có hạn"; không lỗi JS | ✓ | `FE-18a-danh-sach-don-cu.png`, `FE-18b-don-cu-da-duyet.png`, `FE-18c-don-cu-dang-cho.png` |
| FE-19 | Mọi màn | Điện thoại 390×844 | Không tràn ngang, nút bấm được | Sáu màn (danh sách, gửi phiếu, chi tiết, loại phiếu, luồng duyệt, tab phê duyệt) đều `scrollWidth == clientWidth`, bấm được tab, các khối dồn một cột | ✓ | `FE-19a-dien-thoai-danh-sach.png`, `FE-19b-dien-thoai-gui-phieu.png`, `FE-19c-dien-thoai-chi-tiet.png`, `FE-19d-dien-thoai-loai-phieu.png`, `FE-19e-dien-thoai-luong-duyet.png`, `FE-19f-dien-thoai-tab-phe-duyet.png` |
| FE-20 | Mọi màn | Đang tải, rỗng, lỗi mạng | Có khung xương hoặc chữ rỗng, toast lỗi, không trắng trang | Tải chậm thì có khung xương và đầu trang hiện ngay; tab rỗng có câu giải thích, không lộ `undefined`; chặn API thì có toast tiếng Việt về mạng, trang vẫn dùng được; chi tiết phiếu lỗi mạng cũng vậy | ✓ | `FE-20a-tab-rong.png`, `FE-20b-dang-tai.png`, `FE-20c-loi-mang.png`, `FE-20d-chi-tiet-loi-mang.png` |

## ③ Build và test

- `npm run build` → **exit 0**.
- `npx vitest run` → **exit 1**: 279 pass, 2 fail. Hai bài hỏng là `tests/leave.test.ts` TC14 và TC45, **hỏng sẵn trên develop** (chạy lại ở checkout `nhan-su` chưa sửa gì cũng 2 failed / 48 passed), không liên quan lô 4a.
- File test mới `tests/approval-4a.test.ts`: 30 bài, xanh cả — payload luồng duyệt, kiểm luồng trước khi gửi, đổi kiểu giá trị điều kiện, tách câu lỗi `REQUEST_FIELDS_INVALID` theo nhãn trường, escape bản xem trước mẫu in, nhóm nhật ký theo vòng.

## ④ Chỗ lệch giữa bridge doc, openapi và hành vi thật

1. **`APPROVAL_FLOW_CHANGED` không bao giờ bắn được.** Bridge doc và openapi đều ghi `PUT /templates/:id/flow` trả 409 khi người khác vừa lưu, nhưng `PutFlowDto` chỉ có `steps`, không có chỗ gửi phiên bản mà màn đang xem. Hai lần PUT liên tiếp đều thành công:
   `PUT /v1/general-requests/templates/12/flow {"steps":[{"name":"Vai tro nhan vien","approver":{"kind":"ROLE","role":"EMPLOYEE"},"mode":"ANY"}]}` → 200 `version: 2`, gọi lại y hệt → 200 `version: 3`.
   FE đã viết sẵn nhánh xử lý 409 (tải lại luồng của người kia, không ghi đè) nhưng không có cách kích hoạt. Đề nghị thêm `version` hoặc `expectedVersion` vào `PutFlowDto`.

2. **Nộp lại phiếu `RETURNED` không giữ người đã chọn ở vòng trước.** `PATCH /v1/general-requests/41/submit {}` → 400 `REQUEST_NO_APPROVER` "Bước "Người duyệt do người gửi chọn" cần chọn người duyệt.". Bridge doc mục 2.3 chỉ nói `pickedApprovers?` là tuỳ chọn nên dễ hiểu là máy chủ giữ lựa chọn cũ. FE hiện tự điền lại từ `steps` của vòng bị trả (ghép theo `order`, lấy `onBehalfOf ?? employee`) để người gửi không phải chọn lại từ đầu. Nếu BE muốn giữ lựa chọn cũ ở phía máy chủ thì FE bỏ phần tự điền được; còn nếu giữ nguyên thì nên ghi rõ trong doc là nộp lại phải gửi lại `pickedApprovers`.

3. **openapi khai mảng số thành mảng chuỗi.** `defaultWatcherIds`, `FlowApproverDto.employeeIds`, `PickedApproversDto.employeeIds`, `SubmitRequestDto.watcherIds`, `AddWatchersDto.employeeIds`, `CreateRequestCommentDto.mentionIds` đều là `items: { type: string }` trong openapi, còn API thật trả và nhận số (`GET /templates/6` trả `defaultWatcherIds: [14]`). Thiếu `@ApiProperty({ type: [Number] })`. FE khai `number[]` theo hành vi thật.

4. **`DocumentTemplateResponseDto.fields` khai `type: object`** trong openapi nhưng là mảng `FieldDefinition[]`. Tương tự `description`, `templateFileUrl`, `printedAt`, `submittedAt`, `basis`, `slaHours`, `dueAt` khai `type: object, nullable: true` thay vì kiểu thật, nên công cụ sinh kiểu tự động sẽ ra `object`.

5. **`PendingRequestResponseDto.dueAt` khai tuỳ chọn (`dueAt?`)** còn bridge doc nói mỗi phần tử có `dueAt` (có thể null). Nhỏ, FE đã coi là `string | null`.

6. **Chưa có nguồn danh sách người để chọn khi lập uỷ quyền.** Màn uỷ quyền phải lấy danh bạ từ `/v1/employees`. Trên sandbox nhân viên gọi được (200), nhưng nếu công ty nào siết `employee:read` thì nhân viên là người duyệt sẽ không có ai để chọn. Hỏi BE: có nên có một endpoint kiểu `/v1/approval-delegations/candidates` không, hay cứ dựa vào `/v1/employees`?

Hai điểm không phải lệch, chỉ báo để BE biết:
- Phần trợ lý AI (`approval_decide` phủ `requestKind: GENERAL`) **không cần sửa FE**: `AgentActionForm.vue` dựng form tổng quát từ `AgentForm`, không hardcode loại đơn nào.
- `APPROVER_REASSIGNED` không mang `refType` lẫn `refId`, nên FE định tuyến theo `type` về `/general-requests?tab=pending` đúng như `webUrl` trong `fcm-notification-routing.json`; thêm đường lùi là dùng `targetUrl` của thông báo khi bảng định tuyến không có nhánh nào khớp.

## ⑤ Vòng soát UI, UX và câu chữ (user yêu cầu)

Sau khi smoke xanh, tôi cho ba người soát độc lập: một soát ảnh máy tính, một soát ảnh điện
thoại 390×844 và đo vùng bấm, một đọc toàn bộ chữ trên màn hình. Những chỗ đã sửa:

**Chặn người dùng, đã sửa**
- Lỗi mạng ở danh sách phiếu trước đây hiện ra như "Bạn chưa gửi phiếu nào", tức là nói sai với
  người dùng. Giờ tách hẳn trạng thái lỗi: khối lỗi trong vùng nội dung, kèm nút "Thử lại" ngay
  tại chỗ. Trang chi tiết cũng vậy, và không còn nhầm sang câu "phiếu không tồn tại".
- Thanh tab ở trang Phê duyệt có chín tab nên trên điện thoại tab đang mở nằm ngoài màn hình,
  không tab nào sáng. Giờ tab đang mở được cuộn vào tầm nhìn, cả ở trang Phê duyệt và trang
  Phiếu đề xuất.
- Bản phiếu nhúng dựng theo khổ A4 nên trên điện thoại bị cắt chữ. Giờ điện thoại đọc danh sách
  giá trị biểu mẫu, khung bản phiếu chỉ hiện từ khổ máy tính, còn muốn xem đúng bản in thì bấm
  "Xem bản in".

**Nên sửa, đã sửa**
- Ngày trong bản in và trong danh sách giá trị hiện theo kiểu Việt Nam (16/11/2026) thay vì
  2026-11-16, dựa vào kiểu trường của biểu mẫu.
- "Duyệt thay" trước đây mang hai nghĩa. Việc của quản trị viên đổi thành **"Quyết định thay"**,
  còn "duyệt thay ai" giữ nguyên cho lượt nhận theo uỷ quyền. Câu xác nhận cũng nói đúng quyết
  định vừa chọn thay vì luôn nói là đã duyệt.
- Nút gửi của hộp thoại quyết định đổi thành "Xác nhận đồng ý", "Xác nhận từ chối", "Xác nhận
  trả lại", "Xác nhận chuyển lượt", "Xác nhận quyết định thay", "Xác nhận đổi người duyệt".
- Câu nhắc thiếu lý do trước đây ghép từ nhãn nên ra câu sai ngữ pháp; giờ mỗi việc một câu viết sẵn.
- Số trong điều kiện luồng duyệt có dấu nhóm nghìn (100.000.000), ô phép so nới rộng để không
  cắt chữ "lớn hơn hoặc bằng".
- Luồng sai thì bước sai được tô viền đỏ và trang tự cuộn tới bước đó, thay vì chỉ một dòng chữ
  ở đầu trang.
- Ô nhập sai ở màn gửi phiếu được tô viền đỏ, trang cuộn tới ô đầu tiên bị sai, và toast chỉ nói
  một câu tổng quát thay vì lặp lại cả chuỗi câu của máy chủ.
- Màn gửi phiếu có thanh nút dính ở đáy trên điện thoại, nên không phải cuộn hết biểu mẫu mới gửi được.
- Nút trên thẻ loại phiếu và nút chuyển bước trong màn luồng duyệt cao tối thiểu 44 điểm, nút
  "Xoá bước" tách hẳn sang phải để ngón tay không bấm trượt.
- Loại phiếu xếp nhóm theo thứ tự, nhóm "Khác" xuống cuối; thẻ cùng hàng cao bằng nhau; tiền tố
  số hiệu thành một chip nhỏ cạnh tên thay vì một dòng lặp ở mười thẻ.
- Nhãn nhóm `BUSINESS_TRIP` nay có chữ tiếng Việt là "Công tác".
- Thống nhất "loại phiếu" thay cho "mẫu" ở nút bật tắt, "Sửa luồng duyệt" và "Sửa loại phiếu"
  thay cho hai nút cùng tên "Sửa", cột người theo dõi tách khỏi cột biểu mẫu, chip trạng thái
  không bị bẻ dòng.
- Ô "Hạn xử lý" trong bảng chỉ còn mốc thời gian, không lặp lại tên cột; cột "Phiếu" đổi thành
  "Tiêu đề"; dòng đếm kết quả tra cứu chuyển lên trên bảng.
- Nhiều câu lỗi và câu rỗng thêm vế nói việc cần làm tiếp; các câu ghép bằng dấu giữa dòng viết
  lại thành câu trọn vẹn.
- Chữ "—" trơ trọi ở dòng bước hiện tại đổi thành "Không còn bước nào đang chờ".
- Người gửi mở phiếu đang chờ mà không thu hồi được nay có một câu nói rõ vì sao và phải làm gì.

**Thuộc mẫu in của BE, tôi không sửa, nhờ BE xem**
- Mẫu in của "Tờ trình BGĐ" in ra nguyên `{{can_cu_2}}`, `{{can_cu_3}}` khi hai trường đó trống,
  hoặc ra hai dấu gạch đầu dòng rỗng; mẫu in không có cú pháp điều kiện nên FE không ẩn được dòng.
- Mẫu in tự thêm tiền tố "CÔNG TY" vào tên công ty nên ra "CÔNG TY CÔNG TY A" với dữ liệu sandbox.
- Mẫu in có nút xanh "In trang này" nằm trong chính nội dung, nên trên màn có hai lối in với hai
  cách gọi khác nhau, và nút đó chỉ cao 26 điểm trên điện thoại.
- Câu `basis` của bước bị bỏ qua viết "Bỏ qua vì phiếu không thoả điều kiện: Số tiền >= 100000000",
  dùng ký hiệu toán và số không có dấu nhóm nghìn. FE hiện thẳng câu của máy chủ theo đúng thiết kế
  nên không tự viết lại; nếu BE đổi thành câu tiếng Việt có định dạng số thì màn hình tốt lên ngay.

**Ghi nhận, chưa sửa vì nằm ngoài lô 4a**
- Vùng toast dùng chung đặt ở `fixed top-4 right-4` nên đè lên khối tên người dùng ở thanh đầu
  trang, nền lại trong suốt; và hai lần tải hỏng cùng lúc thì hiện hai toast giống nhau. Đây là
  `AppToastContainer` dùng cho cả hệ thống.
- Nút trợ lý nổi ở góc dưới phải che dòng cuối của danh sách trên điện thoại. Tôi chỉ chừa thêm
  lề đáy cho hai trang của lô này; chỗ đặt nút là chuyện của khung chung.

## ⑥ Hai chỗ FE tự sửa so với bản thiết kế, báo để biết

1. `NotificationItem.vue`: nút duyệt nhanh, từ chối nhanh trong chuông trước đây bị tắt bằng `v-if="false"` cho MỌI loại đơn. Tôi chỉ mở lại cho `refType === 'general_request'` (FE-06 cần), các loại đơn khác giữ nguyên trạng tắt vì chúng cần xem ngày giờ trước khi quyết định.
2. Dữ liệu sandbox tôi thêm: một loại phiếu `Thu luong sai (FE smoke)` id 12 (dùng cho bài FE-10g, biểu mẫu đã dựng lại đủ hai trường), người theo dõi mặc định của mẫu 6 có thêm KT01, luồng mẫu 6 nay là hai bước (HR duyệt → Giám đốc phê duyệt khi số tiền từ 100 triệu), cùng khoảng hai mươi phiếu `FE-xx …`. Nếu BE cần sandbox sạch thì nói tôi dọn.
