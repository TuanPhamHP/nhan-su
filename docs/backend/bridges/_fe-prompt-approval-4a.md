# Prompt cho agent FE — Lô 4a phê duyệt điện tử (phiếu đề xuất)

> User duyệt thiết kế lô 4a ngày 16/11/2026 ("duyệt thiết kế, làm đi nhé") và yêu cầu test đủ UI, UX kèm **ảnh chụp màn
> hình**. Backend đã code xong, smoke 77/77 kịch bản trên sandbox. Việc của bạn là làm giao diện trên `nhan-su` theo đúng
> contract dưới đây, smoke thật trên trình duyệt, chụp màn hình.

## ① Repo và nhánh

- FE: worktree **`/home/tuanpham/work/hr-system/.worktrees/fe-approval`**, nhánh `feat/approval` (tạo từ `develop` 545d3fc,
  `node_modules` là symlink sang `nhan-su`). Chỉ làm trong worktree này, không sửa checkout `nhan-su` chính, không commit
  (session BE gom và chạy cổng bảo mật trước khi commit).
- BE: worktree `/home/tuanpham/work/hr-system/.worktrees/be-approval`, nhánh `feat/approval`, **chưa merge**. Không sửa
  repo BE.

## ② Đọc trước

1. `nhan-su/CLAUDE.md` (quy ước repo FE: component, token màu, toast, service, store).
2. `docs/backend/bridges/general-requests.md` — contract chính, đọc hết mục 1 "Thay đổi so với trước lô 4a".
3. `docs/backend/bridges/approval.md` (khoá `generalRequests` trong `/v1/approval/counts`),
   `docs/backend/bridges/fcm-notification-routing.json` (9 loại `GENERAL_REQUEST_*`, `APPROVER_REASSIGNED`).
4. Kiểu dữ liệu: khớp `/home/tuanpham/work/hr-system/.worktrees/be-approval/docs/openapi.json` (bản của nhánh BE), không
   dùng `docs/api-endpoint.json`.
5. Thiết kế đầy đủ nếu cần: `/home/tuanpham/work/hr-system/.worktrees/be-approval/docs/modules/16-approval.md` mục 4a.8.

## ③ Thay đổi API (tóm tắt, chi tiết ở bridge doc)

| Nhóm | Thay đổi |
|---|---|
| Loại phiếu | `POST/PATCH /v1/general-requests/templates` cần quyền `request-type:manage` (thay `@Roles(HR, ADMIN)`); thêm `codePrefix`, `defaultWatcherIds`, `isActive` |
| Luồng duyệt | Mới: `GET/PUT /templates/:id/flow`, `POST /templates/:id/flow/preview` |
| Danh sách | `GET /me` chỉ còn phiếu của tôi (HR không còn thấy hết ở đây); mới `GET /watching`; `GET /` tra cứu theo phạm vi với `approverId, from, to, code, q`; `pending-for-me` mở cho mọi vai trò, phần tử có `dueAt, overdue, onBehalfOf` |
| Phiếu | Response thêm `code, round, currentStep, steps[], returnedAt, cancelledAt, updatedAt` và 15 cờ `can*`; chi tiết thêm `timeline[], watchers[], attachments[], commentCount`. Mọi thao tác trả chi tiết mới nhất |
| Thao tác mới | `DELETE /:id` (xoá nháp), `PATCH /:id/return`, `/transfer`, `/override` (ADMIN), `/reassign` (`request:reassign`); `approve/reject/return/override` nhận `stepOrder` |
| Gửi | `PATCH /:id/submit { pickedApprovers: [{ stepOrder, employeeIds }], watcherIds }`; nộp lại phiếu `RETURNED` cũng là route này |
| Bình luận, theo dõi, file | `GET/POST /:id/comments`, `POST /:id/watchers { employeeIds, consult }`, `POST /:id/attachments` (multipart `file`), `DELETE /:id/attachments/:attId`, `GET /:id/attachments/:attId/url` |
| Uỷ quyền | `GET/POST /v1/approval-delegations`, `DELETE /v1/approval-delegations/:id` |
| Trạng thái | Thêm `RETURNED` ("Cần bổ sung"). Mọi `status` đều có `statusLabel`, bước có `statusLabel`, `modeLabel`; nhật ký có `actionLabel` — hiện thẳng, không tự dịch |
| Quyền | Mới `request-type:manage`, `request:read:all`, `request:reassign` (HR mặc định). `general-request:*` **không còn dùng**: bỏ mọi chỗ FE dựa vào `general-request:approve` để hiện nút (dùng cờ `can*`) |
| Mã lỗi | Bảng ở mục 8 bridge doc; mọi lỗi có `message` tiếng Việt, hiện bằng toast |

## ④ Màn hình và file

| Mã | Màn | File (hiện có) | Việc |
|---|---|---|---|
| UI-01 | Danh sách | `app/pages/general-requests/index.vue` | Đổi tên "Phiếu đề xuất" (cả menu). Tab: **Của tôi** (`/me`), **Cần bổ sung** (`/me?status=RETURNED`, có số đếm), **Chờ tôi duyệt** (`/pending-for-me`, quá hạn tô đỏ, ghi "duyệt thay X" khi có `onBehalfOf`), **Đang theo dõi** (`/watching`), **Tra cứu** (`GET /`, có lọc trạng thái, loại phiếu, người gửi, người duyệt, khoảng ngày, số hiệu, ô tìm). Cột số hiệu, bước hiện tại và người đang giữ. Đọc `?tab=pending` và `?id=` trên URL (link từ thông báo) |
| UI-02 | Gửi phiếu | `app/pages/general-requests/create.vue` | Bỏ bước chọn người duyệt tự do và `suggested-approvers`. Thay bằng **xem trước chuỗi** gọi `flow/preview` (gọi lại khi đổi giá trị trường hoặc chọn người): bước bị bỏ hiện mờ kèm `basis`; bước `needsPick` hiện ô chọn từ `candidates` (số người theo `pick.min..max`, `sequential` thì giữ thứ tự chọn). Thêm đính kèm file và người theo dõi. Lỗi `REQUEST_FIELDS_INVALID` hiện cạnh ô (`error.errors[]`). Dùng lại màn này để **sửa và nộp lại** phiếu `RETURNED` |
| UI-03 | Chi tiết | `app/pages/general-requests/[id].vue`, `components/modules/general-request/ApproverChain.vue`, `RequestStatusBadge.vue` | Đầu trang: số hiệu, trạng thái, vòng. Các bước của vòng hiện tại (tên, chế độ, người, trạng thái từng người, hạn, quá hạn, `basis`, "duyệt thay"). Dòng thời gian theo vòng (`timeline`, nhóm theo `round`). Bình luận có nhắc tên (chọn trong người xem được: người gửi, người theo dõi, người duyệt). File: danh sách, tải bằng link ký. Nút theo cờ: Đồng ý (ghi chú tuỳ chọn), Từ chối (lý do bắt buộc), Trả lại (bắt buộc), Chuyển (chọn người), Duyệt thay (ADMIN, chọn quyết định + lý do ≥5 ký tự), Đổi người duyệt (HR: chọn người đang giữ và người nhận), Thu hồi, Sửa và nộp lại, Xoá nháp, In, Thêm người theo dõi, Mời ý kiến. Gửi `stepOrder = currentStep.order`. Gặp 409 thì toast rồi tải lại phiếu. Không xem được (404) thì trang báo "không tồn tại hoặc không có quyền", không trắng trang |
| UI-04 | Tab trong trang Phê duyệt | `app/pages/management/approval/index.vue` (1647 dòng: **làm component riêng**, VD `components/modules/approval/GeneralRequestApprovalTab.vue`) | Tab "Phiếu đề xuất", badge `counts.generalRequests`, bấm dòng mở chi tiết phiếu. Tab hiện cho mọi vai trò vào được trang này, không kiểm `general-request:approve` (`app/utils/permission.ts` dòng `generalRequest`) |
| UI-05 | Cấu hình loại phiếu | `components/modules/general-request/TemplateFormModal.vue`, `app/pages/management/settings/index.vue` + màn luồng mới | Form mẫu thêm tiền tố số hiệu (in hoa, 1–10 ký tự), bật/tắt mẫu, người theo dõi mặc định. **Màn luồng duyệt** (mở từ từng mẫu): bảng các bước, mỗi bước có tên, kiểu người duyệt (6 kiểu, nhãn tiếng Việt) và tham số theo kiểu, chế độ một người/tất cả, hạn (giờ làm việc), điều kiện (trường của mẫu hoặc phòng/vai trò người gửi, phép so, giá trị; nhiều điều kiện "tất cả"/"một trong"). Thêm, xoá, đổi thứ tự bước; hiện phiên bản. Hiện chỉ cho người có `request-type:manage`. **Vá XSS**: xem trước mẫu in đang `v-html` HTML chưa escape (dòng ~66–73), giá trị mẫu phải escape |
| UI-06 | Uỷ quyền duyệt | Trang cá nhân `app/pages/profile/...` | Khối "Uỷ quyền duyệt": danh sách (tôi uỷ quyền / người khác uỷ quyền cho tôi), tạo (chọn người, từ ngày, đến ngày, ghi chú), huỷ của mình |
| Chung | Kiểu, service, thông báo | `app/types/general-request.types.ts`, `app/services/general-request.service.ts`, `app/composables/useGeneralRequests.ts`, `useDocumentTemplates.ts`, `app/stores/generalRequest.ts`, `app/utils/notification-route.ts`, `app/plugins/fcm.client.ts`, `app/composables/usePrint.ts` | Kiểu theo mục 4 bridge doc. Route thông báo cho 9 loại `GENERAL_REQUEST_*` và `APPROVER_REASSIGNED`. In: escape giá trị, có thể thêm số hiệu. Trang tạo đơn công tác (`business-trips/create.vue`) vẫn dùng `suggested-approvers`, **giữ nguyên** |

## ⑤ Kịch bản smoke FE (bấm thật, chụp màn hình)

Sandbox BE đang chạy: API `http://localhost:3170` (Postgres, Redis dùng một lần, không phải DB thật). Tài khoản, mật khẩu và
id lấy ở `/tmp/claude-1000/-home-tuanpham-work-hr-system-hr-system-be/59411ccd-e298-4126-96c4-d007b1b55ef3/scratchpad/sandbox-4a.json`
(`people.*.email`, `password`; công ty `cta`; công ty `old` có đơn cũ đã chuyển sang, tài khoản ở `old.people`). Sandbox đã
có sẵn khoảng 40 phiếu ở đủ trạng thái do smoke BE tạo. Chạy web trỏ vào sandbox, **cổng 4020** (CORS của sandbox chỉ
mở 4020, 4021):

```bash
cd /home/tuanpham/work/hr-system/.worktrees/fe-approval
sed 's|^NUXT_PUBLIC_BASE_API_URL=.*|NUXT_PUBLIC_BASE_API_URL=http://localhost:3170|' /home/tuanpham/work/hr-system/nhan-su/.env.local > <scratch>/env.4a
npx nuxt dev --dotenv <scratch>/env.4a --port 4020
```

Chụp bằng `playwright-core` + `/usr/bin/google-chrome` (xem mẫu `tests/e2e/agent-chart-shots.mjs`), desktop 1440×900 và
điện thoại 390×844. Lưu ảnh vào `tests/e2e/__shots__/approval-4a/` (thư mục này không commit), tên file theo mã kịch bản.

| # | Vai | Kịch bản | Mong đợi |
|---|---|---|---|
| FE-01 | KD01 (nhân viên KD) | Gửi "Tờ trình BGĐ": điền form, xem trước chuỗi, chọn người duyệt | Danh sách chọn không có chính mình; gửi xong hiện số hiệu `TT-…` |
| FE-02 | KD01 | Gửi "Đề xuất đào tạo" với số tiền 80tr rồi 120tr ở xem trước | 80tr: bước Giám đốc mờ kèm lý do; 120tr: hiện hai giám đốc |
| FE-03 | KD01 | Gửi thiếu trường bắt buộc, nhập chữ vào ô số | Lỗi tiếng Việt cạnh ô, không trắng trang |
| FE-04 | QLKD (trưởng phòng) | Trang Phê duyệt → tab Phiếu đề xuất; trang phiếu đề xuất → Chờ tôi duyệt | Badge đúng `counts.generalRequests`; đồng ý có ghi chú; phiếu sang bước kế |
| FE-05 | QLKD | Trả lại một phiếu; KD01 mở tab Cần bổ sung, sửa, nộp lại | Phiếu về "Cần bổ sung"; nộp lại thành vòng 2, số hiệu giữ; dòng thời gian tách vòng 1, vòng 2 |
| FE-06 | QLKD | Từ chối không lý do; từ chối có lý do; duyệt nhanh/từ chối nhanh từ chuông thông báo | Không lý do bị chặn; có lý do thì phiếu "Bị từ chối" |
| FE-07 | QLKD | Chuyển lượt cho người khác; thử chuyển cho chính người gửi | Người nhận thấy phiếu trong hộp; chuyển cho người gửi báo lỗi bằng toast |
| FE-08 | Người gửi, người duyệt | Bình luận nhắc tên; người duyệt mời KT01 cho ý kiến; KT01 mở phiếu | KT01 bình luận được, **không** có nút duyệt |
| FE-09 | KD01 | Đính kèm PDF, ảnh; file sai loại; file thứ 11; mở file | Sai loại, quá số lượng báo lỗi; mở file tải được |
| FE-10 | HR01 | Cài đặt → loại phiếu: sửa tiền tố (thử chữ thường), tắt mẫu, người theo dõi mặc định; màn luồng: tạo luồng 2 bước có điều kiện, lưu; thử luồng sai | Tiền tố sai báo lỗi; lưu luồng tăng phiên bản; luồng sai hiện câu lỗi của BE |
| FE-11 | ADMIN | Duyệt thay phiếu của người khác (có lý do); mở phiếu của chính mình | Có nút duyệt thay ở phiếu người khác, không có ở phiếu của mình |
| FE-12 | HR01 | Đổi người duyệt của một phiếu đang chờ | Người mới nhận phiếu; dòng thời gian ghi "Đổi người duyệt" |
| FE-13 | QLKT (trưởng phòng KT) | Mở link phiếu của nhân viên KD; GĐ02 mở phiếu không liên quan | Trang "không tồn tại hoặc không có quyền", không trắng |
| FE-14 | QLKT | Trang cá nhân → Uỷ quyền duyệt cho CH01 3 ngày; tạo trùng khoảng; huỷ | Trùng khoảng báo lỗi; CH01 thấy uỷ quyền nhận được |
| FE-15 | HR01 | Tra cứu theo số hiệu, tiêu đề, người duyệt, khoảng ngày; phân trang | Kết quả đúng; HR không thấy nháp của người khác |
| FE-16 | KD01 | Xoá nháp; thu hồi phiếu chưa ai duyệt; thu hồi phiếu đã có người đồng ý | Hai việc đầu được; việc thứ ba báo lỗi rõ |
| FE-17 | Bất kỳ | In phiếu đã duyệt có ký tự `<b>` trong nội dung | Bản in hiện ký tự thô, không thành chữ đậm |
| FE-18 | e1@old.drill (công ty `old`) | Danh sách đơn cũ sau nâng cấp, mở đơn đã duyệt và đơn đang chờ | Hiện đúng số hiệu, các bước, dòng thời gian |
| FE-19 | Mọi màn | Điện thoại 390×844: danh sách, gửi phiếu, chi tiết, cấu hình luồng | Không tràn ngang, nút bấm được |
| FE-20 | Mọi màn | Trạng thái đang tải, rỗng (tab không có phiếu), lỗi mạng | Có skeleton hoặc chữ rỗng, toast lỗi, không trắng trang |

Kiểm thêm: `npm --prefix /home/tuanpham/work/hr-system/.worktrees/fe-approval run build` xanh, `npx vitest run` xanh (thêm
test cho hàm thuần mới nếu có, VD dựng payload luồng, escape in).

## ⑥ Báo lại

Gửi về session BE (`hr-system-be-f4`):

1. Danh sách file đã sửa, tạo.
2. Bảng smoke `# | Vai | Kịch bản | Mong đợi | Thực tế | ✓/✗` cho FE-01..FE-20, kèm đường dẫn **từng ảnh chụp**.
3. Kết quả `build`, `vitest` (in exit code).
4. Chỗ lệch giữa bridge doc, openapi và hành vi thật của API (nếu có), kèm request và response.

## ⑦ Giới hạn

- Không sửa repo BE, không sửa database (kể cả sandbox) bằng tay ngoài thao tác qua API.
- **Không tự workaround contract sai ở FE**: thấy API trả sai, thiếu field, thiếu nhãn thì dừng chỗ đó và báo session BE.
- Không commit, không push.
- Không đổi `business-trips/create.vue` ngoài phần cần để nó vẫn build.
- Giữ đúng component, token màu, cách hiện toast của `nhan-su`; văn bản giao diện tiếng Việt câu trọn vẹn.
