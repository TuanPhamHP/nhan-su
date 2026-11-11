# Bridge Docs — Tuyển dụng (`/v1/recruitment`, module `RECRUIT`)

> Đọc [api-response-envelope.md](./api-response-envelope.md) trước nếu chưa rõ cách response được bọc trong
> `{ success, data }`, và [entitlements.md](./entitlements.md) cho cách xử lý trạng thái module.
> Thiết kế đầy đủ: `docs/modules/13-recruitment.md` (repo BE), phiếu yêu cầu
> `docs/templates/recruitment/tuyen-dung.md`. Cập nhật 10/11/2026. Ví dụ JSON trong file được dựng theo
> transformer của BE, chưa phải response chụp từ server thật, nên tên trường và kiểu là chính xác còn giá trị
> chỉ để minh hoạ.

Module **bán riêng**: công ty chưa được cấp thì mọi route cần đăng nhập trả 403 `MODULE_NOT_SUBSCRIBED`, còn
trang tuyển dụng công khai trả 404. Module quản lý trọn một vòng tuyển: định biên theo năm và vị trí, yêu cầu
tuyển dụng có duyệt hai bước, tin tuyển dụng với quy trình và hội đồng riêng, ứng viên và hồ sơ ứng tuyển,
phỏng vấn và phiếu đánh giá, offer có duyệt và link phản hồi, rồi chuyển ứng viên thành nhân viên. Có ba nhóm
người dùng, mỗi nhóm một họ route:

- **Trang quản lý** (`/v1/recruitment/...`): `ADMIN`, `HR`, `DIRECTOR`, `CHIEF`, `MANAGER`. Thấy gì và làm
  được gì tuỳ permission và phòng ban, xem mục "Quyền và phạm vi dữ liệu".
- **Hội đồng tuyển dụng và người phỏng vấn** (`/v1/me/recruitment/...`): mọi vai trò, kể cả `EMPLOYEE`. Chỉ
  thấy các tin mình ngồi hội đồng và phiếu đánh giá của mình.
- **Ứng viên, không đăng nhập** (`/v1/public/...`): trang tuyển dụng của công ty, nộp hồ sơ, xem và phản hồi
  offer qua link trong email.

---

## Endpoints

Mọi path có tiền tố `/v1`. Route dưới `/v1/recruitment` cần JWT và vai trò `ADMIN`, `HR`, `DIRECTOR`, `MANAGER`
hoặc `CHIEF`; vai trò `EMPLOYEE` luôn nhận 403 `FORBIDDEN` ở đây, kể cả khi được gán permission. Route dưới
`/v1/me/recruitment` chỉ cần JWT. Route dưới `/v1/public` không cần đăng nhập và **không được gửi header
`Authorization`** (xem mục "Quy ước chung"). Cột **RO** đánh dấu route vẫn chạy khi module ở trạng thái chỉ
xem. Chữ "+ phạm vi" nghĩa là service lọc thêm theo phòng ban và hội đồng như mục "Quyền và phạm vi dữ liệu".

### Cài đặt và danh mục (`RecruitmentSettingsController`)

| Method | Path | Điều kiện gọi | RO | Ghi chú |
|--------|------|---------------|----|---------|
| GET | `/v1/recruitment/settings` | `recruitment:read` | ✓ | Reply-To, thời hạn lưu, điều khoản đồng ý, giới thiệu trang tuyển dụng |
| PUT | `/v1/recruitment/settings` | `recruitment:manage` | | Sửa điều khoản thì phiên bản tự tăng |
| GET | `/v1/recruitment/templates` | `recruitment:read` | ✓ | Mẫu email và mẫu thư mời, lọc `kind` |
| GET | `/v1/recruitment/templates/variables` | `recruitment:read` | ✓ | Biến dùng được theo từng mục đích |
| POST | `/v1/recruitment/templates` | `recruitment:manage` | | Tạo mẫu |
| PATCH | `/v1/recruitment/templates/:id` | `recruitment:manage` | | Sửa mẫu, ngừng dùng bằng `isActive: false` |
| GET | `/v1/recruitment/sources` | `recruitment:read` | ✓ | Nguồn ứng viên |
| POST | `/v1/recruitment/sources` | `recruitment:manage` | | |
| PATCH | `/v1/recruitment/sources/:id` | `recruitment:manage` | | Mục hệ thống không đổi tên hay tắt được |
| GET | `/v1/recruitment/reasons` | `recruitment:read` | ✓ | Lý do loại hồ sơ và lý do từ chối offer |
| POST | `/v1/recruitment/reasons` | `recruitment:manage` | | |
| PATCH | `/v1/recruitment/reasons/:id` | `recruitment:manage` | | Mục hệ thống không đổi tên hay tắt được |
| GET | `/v1/recruitment/tags` | `recruitment:read` | ✓ | Tag ứng viên |
| POST | `/v1/recruitment/tags` | `recruitment:manage` | | |
| PATCH | `/v1/recruitment/tags/:id` | `recruitment:manage` | | |
| GET | `/v1/recruitment/pipeline-templates` | `recruitment:read` | ✓ | Quy trình mẫu, mẫu mặc định đứng đầu |
| POST | `/v1/recruitment/pipeline-templates` | `recruitment:manage` | | |
| PUT | `/v1/recruitment/pipeline-templates/:id` | `recruitment:manage` | | Thay toàn bộ, tin đã tạo không bị ảnh hưởng |
| GET | `/v1/recruitment/scorecard-templates` | `recruitment:read` | ✓ | Mẫu phiếu phỏng vấn và mẫu điểm thi |
| POST | `/v1/recruitment/scorecard-templates` | `recruitment:manage` | | |
| PUT | `/v1/recruitment/scorecard-templates/:id` | `recruitment:manage` | | Thay toàn bộ, không đổi được loại |

### SMTP công ty (`RecruitmentSmtpController`)

| Method | Path | Điều kiện gọi | RO | Ghi chú |
|--------|------|---------------|----|---------|
| GET | `/v1/recruitment/smtp` | Vai trò `ADMIN` | ✓ | Không bao giờ có mật khẩu |
| PUT | `/v1/recruitment/smtp` | Vai trò `ADMIN` | | Không gửi mật khẩu thì giữ mật khẩu cũ |
| POST | `/v1/recruitment/smtp/test` | Vai trò `ADMIN` | | Gửi thử đồng bộ |
| DELETE | `/v1/recruitment/smtp` | Vai trò `ADMIN` | | Quay về email hệ thống (204) |

### Định biên (`RecruitmentHeadcountController`)

| Method | Path | Điều kiện gọi | RO | Ghi chú |
|--------|------|---------------|----|---------|
| GET | `/v1/recruitment/headcount-plans` | `recruitment:read` + phạm vi | ✓ | Bắt buộc `year` |
| POST | `/v1/recruitment/headcount-plans` | `recruitment:manage` hoặc `recruitment:headcount:confirm` | | HR tạo nháp đề xuất; DIRECTOR, CHIEF, ADMIN tạo thì chốt luôn |
| POST | `/v1/recruitment/headcount-plans/submit` | `recruitment:manage` | | Gửi đề xuất cho người chốt (N-15) |
| POST | `/v1/recruitment/headcount-plans/confirm` | `recruitment:headcount:confirm` | | Chốt đề xuất (N-16) |
| POST | `/v1/recruitment/headcount-plans/reject` | `recruitment:headcount:confirm` | | Trả lại đề xuất, bắt buộc lý do (N-16) |
| PATCH | `/v1/recruitment/headcount-plans/:id/proposal` | `recruitment:manage` | | Mở hoặc sửa đề xuất của dòng |
| PATCH | `/v1/recruitment/headcount-plans/:id/confirmed` | `recruitment:headcount:confirm` | | Sửa thẳng số đã chốt |
| DELETE | `/v1/recruitment/headcount-plans/:id/proposal` | `recruitment:manage` hoặc `recruitment:headcount:confirm` | | Rút đề xuất Nháp, Bị trả lại của dòng đã chốt |
| DELETE | `/v1/recruitment/headcount-plans/:id` | Chưa từng chốt: `recruitment:manage` hoặc quyền chốt. Đã chốt: quyền chốt | | Xoá dòng; dòng đã chốt đang dùng thì body bắt buộc `reason` |
| GET | `/v1/recruitment/headcount-plans/:id/changes` | `recruitment:read` + phạm vi | ✓ | Lịch sử thay đổi |

### Yêu cầu tuyển dụng (`RecruitmentRequisitionsController`)

| Method | Path | Điều kiện gọi | RO | Ghi chú |
|--------|------|---------------|----|---------|
| GET | `/v1/recruitment/requisitions` | `recruitment:read` + phạm vi | ✓ | Có phân trang |
| GET | `/v1/recruitment/requisitions/availability` | `recruitment:read` + phạm vi | ✓ | Còn trống của (vị trí, năm) cho form |
| GET | `/v1/recruitment/requisitions/:id` | `recruitment:read` + phạm vi | ✓ | Kèm luồng duyệt, tin, đã tuyển, còn trống |
| GET | `/v1/recruitment/requisitions/:id/jd-url` | `recruitment:read` + phạm vi | ✓ | Link file JD có hạn 10 phút |
| POST | `/v1/recruitment/requisitions` | `recruitment:requisition:create` + phạm vi | | Tạo bản Nháp |
| PATCH | `/v1/recruitment/requisitions/:id` | `recruitment:requisition:create`; người tạo hoặc `recruitment:manage` | | Chỉ khi Nháp hoặc Từ chối |
| POST | `/v1/recruitment/requisitions/:id/jd` | Như trên | | `multipart/form-data`, trường `file` |
| POST | `/v1/recruitment/requisitions/:id/submit` | Như trên | | Kiểm định biên, dựng bước duyệt, N-01 |
| POST | `/v1/recruitment/requisitions/:id/approve` | `recruitment:read`; người duyệt đến lượt hoặc `ADMIN` | | |
| POST | `/v1/recruitment/requisitions/:id/reject` | Như trên | | Bắt buộc lý do |
| POST | `/v1/recruitment/requisitions/:id/cancel` | `recruitment:requisition:create`; người tạo hoặc `recruitment:manage` | | Còn tin đang mở thì không huỷ được |
| DELETE | `/v1/recruitment/requisitions/:id` | Như trên | | Xoá mềm bản Nháp (204) |

### Việc chờ duyệt (`RecruitmentApprovalsController`)

| Method | Path | Điều kiện gọi | RO | Ghi chú |
|--------|------|---------------|----|---------|
| GET | `/v1/recruitment/approvals` | `recruitment:read` | ✓ | Yêu cầu và offer chờ mình duyệt, đề xuất định biên chờ chốt |
| GET | `/v1/recruitment/approvals/counts` | `recruitment:read` | ✓ | Số cho badge |

### Tin tuyển dụng (`RecruitmentJobsController`)

| Method | Path | Điều kiện gọi | RO | Ghi chú |
|--------|------|---------------|----|---------|
| GET | `/v1/recruitment/jobs` | `recruitment:read` + phạm vi | ✓ | Có phân trang |
| POST | `/v1/recruitment/jobs` | `recruitment:manage` | | Từ yêu cầu Đã duyệt hoặc Đang tuyển |
| GET | `/v1/recruitment/jobs/:id` | `recruitment:read` + phạm vi | ✓ | Vòng, số hồ sơ, hội đồng, link công khai |
| PATCH | `/v1/recruitment/jobs/:id` | `recruitment:manage` | | Trừ tin Đã đóng |
| POST | `/v1/recruitment/jobs/:id/open` | `recruitment:manage` | | Từ Nháp hoặc Tạm dừng |
| POST | `/v1/recruitment/jobs/:id/pause` | `recruitment:manage` | | Từ Đang mở |
| POST | `/v1/recruitment/jobs/:id/close` | `recruitment:manage` | | Từ Nháp, Đang mở hoặc Tạm dừng |
| DELETE | `/v1/recruitment/jobs/:id` | `recruitment:manage` | | Xoá mềm tin Nháp (204) |
| PUT | `/v1/recruitment/jobs/:id/stages` | `recruitment:manage` | | Thay danh sách vòng của tin |
| GET | `/v1/recruitment/jobs/:id/team` | `recruitment:read` + phạm vi | ✓ | Hội đồng của tin |
| PUT | `/v1/recruitment/jobs/:id/team` | `recruitment:manage` | | Thay toàn bộ hội đồng |

### Ứng viên (`RecruitmentCandidatesController` và các controller nhỏ cùng file)

| Method | Path | Điều kiện gọi | RO | Ghi chú |
|--------|------|---------------|----|---------|
| GET | `/v1/recruitment/candidates` | `recruitment:read` + phạm vi | ✓ | Có phân trang; lọc `isBlacklisted` chỉ cho người thấy blacklist |
| POST | `/v1/recruitment/candidates/check-duplicates` | `recruitment:manage` | ✓ | Trả 200; tìm trùng email, SĐT |
| POST | `/v1/recruitment/candidates/bulk-cv` | `recruitment:manage` | | Nhiều CV, mỗi file một ứng viên nháp |
| POST | `/v1/recruitment/candidates` | `recruitment:manage` | | Thêm một ứng viên, có thể kèm CV và tin |
| GET | `/v1/recruitment/candidates/:id` | `recruitment:read` + phạm vi | ✓ | Ghi nhật ký xem |
| GET | `/v1/recruitment/candidates/:id/timeline` | `recruitment:read` + phạm vi | ✓ | Sự kiện blacklist chỉ người thấy blacklist nhận |
| GET | `/v1/recruitment/candidates/:id/emails` | `recruitment:read` + phạm vi | ✓ | Lịch sử email |
| GET | `/v1/recruitment/candidates/:id/comments` | `recruitment:read` + phạm vi | ✓ | |
| POST | `/v1/recruitment/candidates/:id/comments` | `recruitment:read` + phạm vi | | Bình luận hoặc đề xuất (N-10, N-17) |
| PATCH | `/v1/recruitment/candidates/:id` | `recruitment:manage` | | |
| POST | `/v1/recruitment/candidates/:id/emails` | `recruitment:manage` | | Gửi ngay hoặc hẹn giờ |
| POST | `/v1/recruitment/candidates/:id/files` | `recruitment:manage` | | `multipart/form-data` |
| POST | `/v1/recruitment/candidates/:id/merge` | `recruitment:manage` | | Gộp ứng viên trùng |
| POST | `/v1/recruitment/candidates/:id/blacklist` | `recruitment:manage` | | Đánh dấu không tái tuyển |
| DELETE | `/v1/recruitment/candidates/:id/blacklist` | `recruitment:manage` | | Gỡ đánh dấu |
| POST | `/v1/recruitment/candidates/:id/talent-pool` | `recruitment:manage` | | Cần đồng ý lưu kho còn hiệu lực |
| DELETE | `/v1/recruitment/candidates/:id/talent-pool` | `recruitment:manage` | | |
| POST | `/v1/recruitment/candidates/:id/consents` | `recruitment:manage` | | HR ghi nhận đồng ý |
| PUT | `/v1/recruitment/candidates/:id/tags` | `recruitment:manage` | | Thay toàn bộ tag |
| POST | `/v1/recruitment/candidates/:id/applications` | `recruitment:manage` | | Thêm ứng viên vào tin |
| POST | `/v1/recruitment/candidates/:id/anonymize` | `recruitment:manage` | ✓ | Xoá dữ liệu theo yêu cầu (204) |
| GET | `/v1/recruitment/candidate-files/:id/url` | `recruitment:read` + phạm vi | ✓ | Link file có hạn 10 phút, ghi nhật ký xem |
| POST | `/v1/recruitment/emails/:id/cancel` | `recruitment:manage` | | Huỷ email đang chờ hoặc đang hẹn (204) |
| GET | `/v1/recruitment/candidate-imports/template` | `recruitment:manage` | ✓ | File mẫu `.xlsx` |
| POST | `/v1/recruitment/candidate-imports` | `recruitment:manage` | | Nhập Excel |

### Hồ sơ ứng tuyển (`RecruitmentApplicationsController`)

| Method | Path | Điều kiện gọi | RO | Ghi chú |
|--------|------|---------------|----|---------|
| GET | `/v1/recruitment/jobs/:jobId/applications` | `recruitment:read` + phạm vi | ✓ | Thẻ kanban của tin |
| GET | `/v1/recruitment/applications/:id` | `recruitment:read` + phạm vi | ✓ | Ghi nhật ký xem |
| POST | `/v1/recruitment/applications/bulk-move` | `recruitment:manage` | | |
| POST | `/v1/recruitment/applications/bulk-reject` | `recruitment:manage` | | |
| POST | `/v1/recruitment/applications/:id/move` | `recruitment:manage` | | Không vào vòng Đã tuyển bằng route này |
| POST | `/v1/recruitment/applications/:id/reject` | `recruitment:manage` | | Email loại NOW, SCHEDULED hoặc NONE |
| POST | `/v1/recruitment/applications/:id/withdraw` | `recruitment:manage` | | |
| POST | `/v1/recruitment/applications/:id/reopen` | `recruitment:manage` | | Huỷ email loại đang hẹn |

### Phỏng vấn và đánh giá (`RecruitmentInterviewsController`)

| Method | Path | Điều kiện gọi | RO | Ghi chú |
|--------|------|---------------|----|---------|
| GET | `/v1/recruitment/interviews` | `recruitment:read` + phạm vi | ✓ | Lịch, tối đa 62 ngày |
| GET | `/v1/recruitment/interviews/:id` | `recruitment:read` + phạm vi | ✓ | |
| POST | `/v1/recruitment/applications/:id/interviews` | `recruitment:manage` | | Đặt lịch, email `.ics`, N-04 |
| PATCH | `/v1/recruitment/interviews/:id` | `recruitment:manage` | | Đổi lịch, gửi lại `.ics`, N-04 |
| POST | `/v1/recruitment/interviews/:id/cancel` | `recruitment:manage` | | |
| POST | `/v1/recruitment/interviews/:id/status` | `recruitment:manage` | | `DONE` hoặc `NO_SHOW` |
| POST | `/v1/recruitment/scorecards/request` | `recruitment:manage` | | Yêu cầu một người đánh giá (N-05) |
| POST | `/v1/recruitment/test-results` | `recruitment:manage` | | Nhập điểm thi nhiều hồ sơ |
| GET | `/v1/recruitment/applications/:id/scorecards` | `recruitment:read` + phạm vi | ✓ | Ẩn phiếu người khác theo BR-08 |

### Offer phía HR (`RecruitmentOffersController`)

| Method | Path | Điều kiện gọi | RO | Ghi chú |
|--------|------|---------------|----|---------|
| GET | `/v1/recruitment/offers` | `recruitment:read` + phạm vi | ✓ | Có phân trang, tiền che theo quyền |
| GET | `/v1/recruitment/offers/:id` | `recruitment:read` + phạm vi | ✓ | Phiên bản, luồng duyệt, kênh phản hồi |
| GET | `/v1/recruitment/offers/:id/pdf-url` | `recruitment:read`; người xem được lương | ✓ | PDF đã gửi ứng viên |
| GET | `/v1/recruitment/offers/:id/preview.pdf` | `recruitment:read`; `recruitment:manage` hoặc người duyệt | ✓ | PDF sinh tại chỗ, không lưu |
| POST | `/v1/recruitment/applications/:id/offers` | `recruitment:manage` | | Tạo offer Nháp |
| PATCH | `/v1/recruitment/offers/:id` | `recruitment:manage` | | Chỉ offer Nháp |
| POST | `/v1/recruitment/offers/:id/submit` | `recruitment:manage` | | Gửi duyệt (N-06) |
| POST | `/v1/recruitment/offers/:id/approve` | `recruitment:read`; người duyệt đến lượt hoặc `ADMIN` | | |
| POST | `/v1/recruitment/offers/:id/reject` | Như trên | | Bắt buộc lý do |
| POST | `/v1/recruitment/offers/:id/send` | `recruitment:manage` | | Sinh link phản hồi, lưu PDF, gửi email |
| POST | `/v1/recruitment/offers/:id/revise` | `recruitment:manage` | | Phiên bản mới, luôn duyệt lại |
| POST | `/v1/recruitment/offers/:id/record-response` | `recruitment:manage` | | HR ghi nhận phản hồi (N-07) |
| POST | `/v1/recruitment/offers/:id/cancel` | `recruitment:manage` | | |
| POST | `/v1/recruitment/offers/:id/no-show` | `recruitment:manage` | | Đồng ý nhưng không nhận việc |
| POST | `/v1/recruitment/offers/:id/hire` | `recruitment:manage` | | Tạo hoặc nối hồ sơ nhân viên |

### Tổng quan và báo cáo (`RecruitmentReportsController`)

| Method | Path | Điều kiện gọi | RO | Ghi chú |
|--------|------|---------------|----|---------|
| GET | `/v1/recruitment/dashboard` | `recruitment:read` + phạm vi | ✓ | Tổng quan |
| GET | `/v1/recruitment/reports/funnel` | `recruitment:read` + phạm vi | ✓ | RP-01 |
| GET | `/v1/recruitment/reports/funnel/export` | `recruitment:read` + phạm vi | ✓ | Excel |
| GET | `/v1/recruitment/reports/sources` | `recruitment:report:read` | ✓ | RP-02 |
| GET | `/v1/recruitment/reports/sources/export` | `recruitment:report:read` | ✓ | Excel |
| GET | `/v1/recruitment/reports/headcount` | `recruitment:read` + phạm vi | ✓ | RP-03, các dòng như màn Định biên |
| GET | `/v1/recruitment/reports/headcount/export` | `recruitment:read` + phạm vi | ✓ | RP-03, bản Excel |
| GET | `/v1/recruitment/reports/time-to-hire` | `recruitment:report:read` | ✓ | RP-04 |
| GET | `/v1/recruitment/reports/costs` | `recruitment:report:read` | ✓ | RP-05 |
| GET | `/v1/recruitment/reports/costs/export` | `recruitment:report:read` | ✓ | Excel |
| GET | `/v1/recruitment/jobs/:id/applications/export` | `recruitment:manage` | ✓ | RP-07 |

### Hội đồng và người phỏng vấn (`MyRecruitmentController`, chỉ cần đăng nhập)

| Method | Path | Điều kiện gọi | RO | Ghi chú |
|--------|------|---------------|----|---------|
| GET | `/v1/me/recruitment/interviews` | Mọi user | ✓ | `scope=upcoming` (mặc định) hoặc `pending-scorecards` |
| GET | `/v1/me/recruitment/interviews/:id` | Người phỏng vấn của buổi hoặc thành viên hội đồng | ✓ | |
| GET | `/v1/me/recruitment/jobs` | Mọi user | ✓ | Tin mình ngồi hội đồng, trừ tin Nháp |
| GET | `/v1/me/recruitment/jobs/:id/applications` | Thành viên hội đồng | ✓ | Kanban của tin |
| GET | `/v1/me/recruitment/applications/:id` | Thành viên hội đồng | ✓ | Ghi nhật ký xem |
| GET | `/v1/me/recruitment/applications/:id/scorecards` | Thành viên hội đồng | ✓ | Theo BR-08 |
| GET | `/v1/me/recruitment/candidate-files/:id/url` | Thành viên hội đồng | ✓ | Link file có hạn 10 phút |
| GET | `/v1/me/recruitment/applications/:id/comments` | Thành viên hội đồng | ✓ | |
| POST | `/v1/me/recruitment/applications/:id/comments` | Thành viên hội đồng | | Bình luận hoặc đề xuất |
| PUT | `/v1/me/recruitment/scorecards/:id` | Chủ phiếu | | Lưu nháp |
| POST | `/v1/me/recruitment/scorecards/:id/submit` | Chủ phiếu | | Nộp phiếu |

### Công khai, không đăng nhập (`PublicCareersController`, `PublicOfferResponsesController`)

| Method | Path | Điều kiện gọi | RO | Ghi chú |
|--------|------|---------------|----|---------|
| GET | `/v1/public/careers/:companyCode` | Không đăng nhập | ✓ | Trang tuyển dụng của công ty |
| GET | `/v1/public/careers/:companyCode/jobs/:slug` | Không đăng nhập | ✓ | Chi tiết tin kèm điều khoản đồng ý |
| POST | `/v1/public/careers/:companyCode/jobs/:slug/applications` | Không đăng nhập | ✓ | `multipart/form-data`, trường file `cv` |
| GET | `/v1/public/offer-responses/:token` | Không đăng nhập | ✓ | Trạng thái link và tóm tắt offer |
| POST | `/v1/public/offer-responses/:token/accept` | Không đăng nhập | ✓ | Trả 200, bắt buộc `{ confirmed: true }` |
| POST | `/v1/public/offer-responses/:token/decline` | Không đăng nhập | ✓ | Trả 200, bắt buộc `reasonId` |

> **Lưu ý thứ tự route:** `/v1/recruitment/requisitions/availability` được khai báo **trước**
> `/v1/recruitment/requisitions/:id`, và `/v1/recruitment/templates/variables` là route riêng (mẫu chỉ có
> `PATCH /templates/:id`, không có `GET /templates/:id`).
>
> **Không có route xoá** cho mẫu email, nguồn, lý do, tag, quy trình mẫu và mẫu đánh giá. Ngừng dùng bằng
> `isActive: false`.

---

## Quyền và phạm vi dữ liệu

### Quyền

| Mã | Ý nghĩa | HR | DIRECTOR | MANAGER | CHIEF | EMPLOYEE |
|---|---|---|---|---|---|---|
| `recruitment:read` | Xem tuyển dụng theo phạm vi, duyệt khi đến lượt | ✓ | ✓ | ✓ | ✓ | – |
| `recruitment:requisition:create` | Tạo và gửi yêu cầu tuyển dụng | ✓ | – | ✓ | – | – |
| `recruitment:manage` | Phụ trách tuyển dụng: tin, ứng viên, lịch phỏng vấn, offer, blacklist, cài đặt, nhập nháp định biên | ✓ | – | – | – | – |
| `recruitment:salary:read` | Xem khung lương, lương mong muốn và offer của mọi hồ sơ | ✓ | ✓ | – | ✓ | – |
| `recruitment:headcount:confirm` | Chốt định biên và sửa định biên đã chốt | – | ✓ | – | ✓ | – |
| `recruitment:report:read` | Xem báo cáo tuyển dụng toàn công ty (RP-02, RP-04, RP-05) | ✓ | ✓ | – | ✓ | – |

Bảng trên là bộ quyền mặc định khi tạo công ty. `ADMIN` có tất cả: guard bỏ qua kiểm permission với `ADMIN`, và
service cũng coi `ADMIN` như có mọi quyền tuyển dụng. ADMIN gán thêm hay bớt được ở màn Phân quyền, nên FE đọc
quyền thật từ `permissions` của `GET /v1/auth/me`, không suy từ vai trò.

`recruitment:manage` đã bao gồm việc xem mọi lương và xem blacklist. Cấu hình SMTP không đi theo permission mà
theo **vai trò `ADMIN`**: HR có `recruitment:manage` vẫn nhận 403 `FORBIDDEN` ở `/v1/recruitment/smtp`.

⚠ **Vai trò `EMPLOYEE` gọi route `/v1/recruitment/...` luôn nhận 403 `FORBIDDEN`**, kể cả khi được gán
permission, vì FE chặn EMPLOYEE khỏi `/management/**`. Nhân viên ngồi hội đồng dùng nhóm `/v1/me/recruitment`.

### Phạm vi

Permission không mang phạm vi; service tự lọc theo vai trò và theo dữ liệu.

| Người gọi | Thấy gì ở trang quản lý |
|---|---|
| `ADMIN`, `HR`, `DIRECTOR`, `CHIEF`, hoặc bất kỳ ai có `recruitment:manage` | Toàn công ty |
| `MANAGER` có `recruitment:read` | Định biên, yêu cầu và tin của phòng mình (`departmentId` của chính người đó) cộng các phòng người đó là trưởng phòng (`Department.managerId`); thêm các tin người đó ngồi hội đồng dù thuộc phòng khác |
| Người không có `recruitment:read`, hoặc MANAGER không thuộc phòng nào và không ngồi hội đồng nào | Không thấy gì |

Vài chỗ phạm vi rộng hơn bảng trên, để người tạo và người duyệt luôn thấy thứ của mình:

- Danh sách yêu cầu tuyển dụng của MANAGER gồm cả yêu cầu **do chính người đó tạo**.
- Chi tiết yêu cầu và chi tiết offer mở được cho **người tạo** và **người duyệt** (đã quyết ở một vòng nào
  đó, hoặc đang đến lượt), kể cả khi nằm ngoài phòng của họ.
- Định biên chỉ lọc theo phòng, không theo hội đồng.

Ngoài phạm vi thì **403 `RECRUIT_SCOPE_FORBIDDEN`**, không phải 200 kèm mảng rỗng: lọc `departmentId` phòng khác
ở `/headcount-plans`, mở `/requisitions/:id` hay `/jobs/:id` của phòng khác, gọi `/requisitions/availability` với
vị trí phòng khác, hay MANAGER tạo yêu cầu cho phòng khác. Danh sách không lọc thì chỉ trả phần trong phạm vi.

```json
{ "success": false, "error": { "code": "RECRUIT_SCOPE_FORBIDDEN", "message": "Bạn không có quyền xem dữ liệu tuyển dụng này" } }
```

### Hội đồng tuyển dụng

Hội đồng là danh sách thành viên của từng tin (`PUT /v1/recruitment/jobs/:id/team`). Trưởng phòng của phòng
tuyển được tự thêm khi tạo tin (`notifyNewApplications: true`, `canViewOffer: false`), và người được giao phỏng
vấn cũng tự được thêm. Thành viên có thể là `EMPLOYEE`; quyền của họ là dữ liệu trên tin, không phải permission.

Qua `/v1/me/recruitment`, thành viên hội đồng thấy:

- **Mọi** hồ sơ ứng tuyển của tin mình ngồi hội đồng (trừ tin Nháp) và phần chung của ứng viên đó, nhưng không
  thấy hồ sơ của tin khác.
- CV và tài liệu (qua `.../candidate-files/:id/url`), phiếu đánh giá theo quy tắc BR-08, bình luận và đề xuất.
- Buổi phỏng vấn của mình và phiếu đánh giá đang chờ mình.
- Lương mong muốn và offer **chỉ khi** cờ `canViewOffer` của mình ở tin đó là `true`.
- **Không bao giờ** nhận trường blacklist ở nhóm route này.

MANAGER ngồi hội đồng một tin của phòng khác thì thấy tin đó cả ở trang quản lý. EMPLOYEE không vào được
`/management/**`, nên thông báo gửi cho EMPLOYEE trỏ về trang tự phục vụ (`/recruitment/my-interviews`,
`/recruitment/jobs/:id`, `/recruitment/applications/:id`), xem mục "Thông báo".

### Trường lương

Người không được xem nhận **`null`** ở trường lương, kèm cờ **`canViewSalary: false`**. Ẩn cột theo cờ này,
đừng suy từ vai trò, và hiển thị `null` là "—", không phải 0.

| Dữ liệu | Trường bị che | Ai thấy |
|---|---|---|
| Yêu cầu tuyển dụng | `salaryMin`, `salaryMax` | Có `recruitment:salary:read` hoặc `recruitment:manage` (gọi chung là "xem mọi lương"), người tạo yêu cầu, người duyệt yêu cầu |
| Tin, trường `requisition.salaryMin/Max` | Như trên | Xem mọi lương, người tạo yêu cầu của tin, hoặc thành viên hội đồng có `canViewOffer`. Danh sách và chi tiết tin dùng cùng luật |
| Offer | Mọi số tiền của offer | Xem mọi lương, người tạo offer, người duyệt offer, thành viên hội đồng có `canViewOffer` |
| Ứng viên và hồ sơ | `expectedSalary` | Xem mọi lương, thành viên hội đồng có `canViewOffer` (chi tiết ở mục ứng viên) |
| Hộp việc chờ duyệt | `offer.baseSalary` | Luôn có số, vì hộp này chỉ trả cho người đang đến lượt duyệt |

"Người duyệt" là người đã quyết một bước ở bất kỳ vòng gửi nào, hoặc đang đến lượt ở bước đang chờ. Người ở bước
2 chưa tới lượt (`WAITING`) thì chưa thấy. Với yêu cầu tuyển dụng, `salaryMax: null` kèm `canViewSalary: true`
nghĩa là chưa nhập khung, và khi đó mọi offer của yêu cầu đều tính là vượt khung (BR-10).

### Không tái tuyển (blacklist)

Chỉ `ADMIN` và người có `recruitment:manage` thấy blacklist; response ứng viên có cờ **`canSeeBlacklist`** để FE
ẩn cột và banner. Người khác nhận **`null`** ở `isBlacklisted`, `blacklistReason`, `blacklistedAt` và
`duplicateBlacklisted`, **không phải `false`**. FE đừng hiểu `null` là "không bị đánh dấu" và đừng hiện nhãn kiểu
"Không có trong danh sách đen". Ngoài ra:

- Timeline bỏ hẳn các sự kiện chỉ HR thấy (đánh dấu, gỡ đánh dấu).
- Lọc `isBlacklisted` ở danh sách ứng viên khi không thấy blacklist trả 403 `RECRUIT_SCOPE_FORBIDDEN`.
- File Excel RP-07 chỉ có cột "Không tái tuyển" khi người xuất thấy blacklist.
- Thông báo N-13 chỉ gửi cho người thấy blacklist.

### Cờ trong response

| Cờ | Có ở | Nghĩa |
|---|---|---|
| `canViewSalary` | Yêu cầu, tin, offer, ứng viên, hồ sơ | Người gọi xem được các trường lương của bản ghi này |
| `canApprove` | Yêu cầu, offer | Bản ghi đang chờ duyệt và người gọi là người duyệt đến lượt. `ADMIN` luôn `true` khi bản ghi đang chờ duyệt |
| `canSeeBlacklist` | Ứng viên (danh sách, chi tiết) | Người gọi thấy các trường blacklist |
| `hasJdFile` | Yêu cầu | Đã có file JD, lấy link qua `GET .../jd-url` |
| `hasPassword`, `secretKeyConfigured` | SMTP | Đã lưu mật khẩu; máy chủ đã có khoá mã hoá |

### Luồng duyệt

| Việc | Bước 1 | Bước 2 |
|---|---|---|
| Yêu cầu tuyển dụng | Trưởng phòng của phòng tuyển (`DEPARTMENT_MANAGER`). Phòng không có trưởng phòng, hoặc trưởng phòng là người tạo, thì vai trò `DIRECTOR` (`DIRECTOR_FALLBACK`) | Vai trò `HR` (`HR`) |
| Offer trong khung lương | Như bước 1 của yêu cầu | – |
| Offer vượt khung lương | Trưởng phòng (`DEPARTMENT_MANAGER`) | Vai trò `DIRECTOR` (`OVER_BAND`). Không có trưởng phòng hoặc trưởng phòng là người tạo thì chỉ một bước `DIRECTOR_FALLBACK` |
| Định biên | Người có `recruitment:headcount:confirm` chốt hàng loạt | – |

- "Trưởng phòng" là `Department.managerId` của phòng tuyển, không phải mọi người có vai trò `MANAGER`. Trưởng
  phòng phải có vai trò vào được trang quản lý (`ADMIN`, `HR`, `DIRECTOR`, `MANAGER`, `CHIEF`); người mang vai trò
  `EMPLOYEE` được coi như phòng không có trưởng phòng, nên bước 1 thành `DIRECTOR_FALLBACK`.
- Bước giao theo vai trò thì ai đang làm việc có vai trò đó đều duyệt được, và tất cả cùng nhận thông báo.
  **`CHIEF` làm được mọi bước giao cho `DIRECTOR`** (Q-24), kể cả nhận N-01, N-06 và thấy bước đó trong hộp
  duyệt. `ADMIN` duyệt thay được mọi bước.
- Route duyệt chỉ cần `recruitment:read`; người không đến lượt nhận 403 `RECRUIT_APPROVAL_NOT_YOUR_TURN`. FE
  hiện nút Duyệt, Từ chối theo cờ `canApprove`.
- Bước 2 chỉ mở khi bước 1 duyệt xong. Từ chối ở bất kỳ bước nào kết thúc vòng duyệt; gửi lại tạo vòng mới
  (`round` tăng 1), các bước của vòng cũ vẫn nằm trong `approvalSteps` để hiện lịch sử.

---

## Trạng thái module

| `state` (từ `/v1/me/entitlements`) | Trang quản lý `/v1/recruitment` | Hội đồng `/v1/me/recruitment` | Công khai `/v1/public` |
|---|---|---|---|
| `ENABLED` | Bình thường | Bình thường | Bình thường |
| `READ_ONLY` | Mọi `GET` chạy, kể cả xuất Excel và xem PDF. Ghi trả 403 `MODULE_READ_ONLY` hoặc `MODULE_EXPIRED`, **trừ** `POST /candidates/check-duplicates` và `POST /candidates/:id/anonymize` | `GET` chạy. Lưu, nộp phiếu và bình luận trả 403 `MODULE_*` | Trang tuyển dụng vẫn hiện tin và **vẫn nhận hồ sơ** (Q-12). Link phản hồi offer vẫn xem và vẫn đồng ý, từ chối được (Q-19 = A) |
| `DISABLED` | Mọi route 403 `MODULE_NOT_SUBSCRIBED`, `MODULE_SUSPENDED` hoặc `MODULE_LAPSED` | Như trang quản lý | Trang tuyển dụng, chi tiết tin và nộp hồ sơ trả **404 `RECRUIT_CAREERS_CLOSED`**. `GET` link offer trả 200 với **`state: 'UNAVAILABLE'`**; đồng ý hay từ chối trả 409 `RECRUIT_OFFER_LINK_UNAVAILABLE` |

Khi chỉ xem, HR vẫn ẩn danh được ứng viên theo yêu cầu của người đó (`POST /candidates/:id/anonymize`), để công
ty không vi phạm nghĩa vụ xoá dữ liệu chỉ vì hết hạn gói. Trang công khai không đi qua cổng module của API (không
có công ty trong token), nên service của trang tự kiểm trạng thái: chỉ `DISABLED` mới đóng.

Việc chạy ngầm theo trạng thái:

- **Ẩn danh định kỳ J-05 (02:00) chạy ở mọi trạng thái, kể cả khi module tắt** (Q-14), vì đây là nghĩa vụ xoá
  dữ liệu cá nhân đúng hạn.
- Các job còn lại chỉ chạy khi `ENABLED`: nhắc phiếu quá hạn (J-01), phỏng vấn hôm nay (J-02), tự đóng tin quá
  hạn (J-03), offer hết hạn (J-04), nhắc nhân viên sắp đi làm (J-07), nhắc duyệt (J-08), gom hồ sơ mới (J-09).
  Hệ quả khi chỉ xem: hồ sơ tự nộp vẫn vào nhưng không có thông báo N-03; tin quá hạn không tự chuyển `CLOSED`
  nhưng trang công khai vẫn ẩn vì lọc theo hạn nộp; offer quá hạn không tự chuyển `EXPIRED` nhưng link vẫn báo
  `EXPIRED` vì trạng thái link tính theo hạn phản hồi.
- Email hẹn giờ đến giờ gửi mà module không còn `ENABLED` thì bị huỷ (`CANCELLED`). Email gửi ngay như xác nhận
  ứng tuyển vẫn đi.

FE: khi `READ_ONLY` vẫn hiện menu, ẩn các nút tạo, sửa, duyệt, chuyển vòng, gửi email, nhưng giữ nút Ẩn danh.
Khi `DISABLED` ẩn menu Tuyển dụng ở cả trang quản lý lẫn trang "Phỏng vấn của tôi" của nhân viên.

---

## Quy ước chung

- **Tiền** là số nguyên đồng (VND), không phải chuỗi: `salaryMin`, `salaryMax`, `budget`, `actualCost` gửi lên
  phải là số nguyên ≥ 0 (số lẻ bị 400). Module không có trường tiền tệ hay tỷ giá. `salaryText` của tin là chuỗi
  hiển thị tự do cho ứng viên ("18–25 triệu"), khác hẳn khung lương nội bộ.
- **Ngày thuần** (`neededBy`, `deadline`, `startDate`, `responseDeadline`, `probationEndDate`) gửi và nhận dạng
  `YYYY-MM-DD`. BE chỉ kiểm đúng định dạng, chưa kiểm ngày có thật hay không, nên FE dùng date picker. **Thời
  điểm** (`createdAt`, `submittedAt`, `decidedAt`, `openedAt`...) là ISO 8601 đầy đủ theo UTC.
- **Múi giờ Việt Nam** cho mọi quy tắc theo ngày: "hôm nay" khi so hạn nộp hồ sơ, năm của mã tự sinh, giờ chạy
  việc định kỳ. Hạn phản hồi offer hết lúc 23:59:59 giờ Việt Nam của ngày `responseDeadline`.
- **Mã tự sinh** theo năm: yêu cầu `YCTD-2026-0007`, tin `TD-2026-0012`, offer `OF-2026-0003`. Số đã cấp không
  cấp lại, kể cả khi bản ghi bị xoá mềm.
- **Mọi enum có `*Label` tiếng Việt** đi kèm (`status` + `statusLabel`, `reason` + `reasonLabel`, `kind` +
  `kindLabel`...). Hiển thị nhãn, đừng tự dịch mã.
- **Trường tuỳ chọn gửi `""` hay `null` đều coi như không gửi.** Ô ngày để trống không bị 400.
- ⚠ **`PATCH` chưa xoá được một trường tuỳ chọn đã có giá trị** (khung lương, ngày cần có người, mô tả của yêu
  cầu; hạn nộp, lương hiển thị của tin), vì `null` và `""` bị coi là "không đổi". FE cứ gửi nguyên form. Ngoại lệ:
  `PUT /settings` xoá được `replyToEmail` và `careersIntro` bằng `null` hoặc `""`; `verdict` của phiếu đánh giá
  xoá được bằng `null`; `PUT /smtp` là thay toàn bộ, bỏ trống `replyTo` thì xoá.
- **Trường lạ trong body bị bỏ qua**, không gây lỗi. **BE trả một lỗi validate mỗi lần** (400 `BAD_REQUEST`,
  `message` là lỗi đầu tiên), không gộp. Ngoại lệ là tạo, sửa offer: mọi lỗi điều khoản trả cùng lúc trong
  `errors`.
- **Danh sách có phân trang** (`/requisitions`, `/jobs`, `/candidates`, `/offers`) nhận `page` (mặc định 1) và
  `limit` (mặc định 20, tối đa 100), trả `meta { page, limit, total, totalPages }`. Các danh sách khác trả mảng.
- **POST hành động** (gửi duyệt, duyệt, mở tin...) trả **201** kèm bản ghi mới nhất, trừ các route ghi rõ 200
  (`check-duplicates`, đồng ý, từ chối offer công khai) và các route trả 204 không có body (xoá, huỷ email, ẩn
  danh, xoá SMTP).
- **Upload** dùng `multipart/form-data`. Tên trường file: `file` cho JD của yêu cầu, `cv` cho form ứng tuyển
  công khai (các route upload của ứng viên ở phần sau của file). BE kiểm loại file theo **chữ ký đầu file**, không
  tin đuôi file hay `Content-Type`:

  | Loại | Định dạng nhận | Tối đa |
  |---|---|---|
  | JD của yêu cầu | PDF, DOCX | 5 MB |
  | CV ứng viên tự nộp (trang công khai) | PDF, DOCX | 5 MB |
  | CV do HR tải lên | PDF, DOC, DOCX, JPG, PNG | 5 MB |
  | Tài liệu khác của ứng viên | PDF, JPG, PNG, ZIP, DOCX | 20 MB |

  Thiếu file trả 400 `RECRUIT_FILE_REQUIRED`, quá dung lượng trả 400 `RECRUIT_FILE_TOO_LARGE`, sai loại trả 400
  `RECRUIT_FILE_TYPE_INVALID`. File **trên 20 MB** bị chặn trước khi tới service và trả **413** với mã
  `UNKNOWN_ERROR`, nên FE kiểm dung lượng trước khi gửi. Tên file tiếng Việt được giữ nguyên.
- **URL file không nằm trong response.** Bấm xem thì gọi route `.../url` (`/requisitions/:id/jd-url`,
  `/candidate-files/:id/url`, `/offers/:id/pdf-url`...), nhận `{ url }` là presigned URL **hết hạn sau 10 phút**.
  Mở ngay, đừng lưu vào store hay gắn sẵn vào `href` lúc tải trang.
- **Body lỗi** chỉ giữ `code`, `message` và `errors` (khi là mảng). Mọi trường khác service gắn vào lỗi
  (`available`, `state`) **bị bộ lọc lỗi bỏ đi**, xem mục "Mã lỗi".
- **Trang công khai KHÔNG được gửi header `Authorization`**, kể cả khi người xem đang đăng nhập app. Có token
  hợp lệ thì API đặt ngữ cảnh theo **công ty trong token** và cổng module kiểm module `RECRUIT` của công ty đó,
  không phải công ty của trang tuyển dụng. Nhân viên của một công ty chưa mua module mở trang tuyển dụng của công
  ty khác sẽ nhận 403 `MODULE_NOT_SUBSCRIBED`, và công ty trong token đang ngừng phục vụ thì nhận 403
  `TENANT_SUSPENDED`. Gọi `/v1/public/**` bằng một instance fetch riêng không gắn token và không chuyển về
  `/login` khi gặp 401.
- **Chống spam ở form ứng tuyển** không dùng captcha:
  - Ô ẩn `website` (ẩn bằng CSS, không dùng `type="hidden"`) phải để trống.
  - `formStartedAt` là `Date.now()` lúc mở form, tính bằng mili giây. Gửi sau chưa đủ 3 giây bị coi là tự động.
  - Hai trường hợp trên **vẫn trả 201 "Đã nhận hồ sơ" nhưng không lưu gì**, để bot không dò được.
  - Cùng email nộp lại cùng tin trong 10 phút tính từ **lần nộp gần nhất** cũng trả 201 mà không tạo thêm gì.
  - Mỗi công ty nhận tối đa 60 **lần nộp** mỗi giờ, quá thì 429 `RECRUIT_RATE_LIMITED`. Nộp lại vào hồ sơ đang có
    (thay CV) cũng tính là một lần.

---

## Nhãn tiếng Việt của enum

Response luôn kèm trường `*Label` cho mọi enum, FE hiển thị trường đó. Bảng dưới chỉ dùng cho chỗ **chưa có bản ghi để
lấy nhãn**, như ô lọc, ô chọn, tiêu đề cột kanban rỗng: chép **đúng từng chữ**, đừng tự đặt tên khác, kẻo ô lọc và bảng gọi cùng
một trạng thái bằng hai tên. Bảng sinh tự động từ `src/common/constants/vi-labels.ts` của BE; nhãn ở đó đổi thì BE cập nhật
bảng này.

| Enum | Hằng ở BE | Mã → nhãn |
|---|---|---|
| Trạng thái đề xuất định biên | `RECRUITMENT_PROPOSAL_STATUS_LABELS` | `DRAFT` Nháp · `PENDING` Chờ chốt · `REJECTED` Bị trả lại |
| Loại thay đổi định biên | `RECRUITMENT_HEADCOUNT_CHANGE_TYPE_LABELS` | `PROPOSED` Đề xuất · `SUBMITTED` Gửi chốt · `CONFIRMED` Chốt · `REJECTED` Trả lại · `EDITED` Sửa số đã chốt · `WITHDRAWN` Rút đề xuất |
| Lý do tuyển | `RECRUITMENT_REQUISITION_REASON_LABELS` | `REPLACEMENT` Thay thế · `ADDITIONAL` Bổ sung · `NEW_POSITION` Mở mới |
| Loại hình lao động (dùng chung với module Nhân viên; yêu cầu tuyển và offer nhận mọi giá trị **trừ `PROBATION`**, thử việc khai riêng ở offer) | `EMPLOYMENT_TYPE_LABELS` | `FULL_TIME` Nhân viên chính thức · `PROBATION` Thử việc · `APPRENTICE` Học việc · `INTERN` Thực tập sinh · `PART_TIME` Bán thời gian · `CONTRACTOR` Cộng tác viên |
| Trạng thái yêu cầu tuyển | `RECRUITMENT_REQUISITION_STATUS_LABELS` | `DRAFT` Nháp · `PENDING` Chờ duyệt · `APPROVED` Đã duyệt · `REJECTED` Từ chối · `RECRUITING` Đang tuyển · `FILLED` Đã đủ · `CANCELLED` Huỷ |
| Đối tượng duyệt | `RECRUITMENT_APPROVAL_TARGET_LABELS` | `REQUISITION` Yêu cầu tuyển dụng · `OFFER` Offer |
| Trạng thái bước duyệt | `RECRUITMENT_APPROVAL_STEP_STATUS_LABELS` | `WAITING` Chưa tới lượt · `PENDING` Chờ duyệt · `APPROVED` Đã duyệt · `REJECTED` Từ chối |
| Căn cứ bước duyệt | `RECRUITMENT_APPROVAL_BASIS_LABELS` | `DEPARTMENT_MANAGER` Trưởng phòng · `DIRECTOR_FALLBACK` Giám đốc (phòng không có trưởng phòng hoặc trưởng phòng là người tạo) · `HR` Nhân sự · `OVER_BAND` Giám đốc (vượt khung lương) · `DIRECTOR` Giám đốc |
| Loại vòng | `RECRUITMENT_STAGE_KIND_LABELS` | `APPLIED` Ứng tuyển · `SCREENING` Sơ loại · `TEST` Thi tuyển · `INTERVIEW` Phỏng vấn · `OFFER` Offer · `HIRED` Đã tuyển |
| Hiển thị tin | `RECRUITMENT_JOB_VISIBILITY_LABELS` | `PUBLIC` Công khai · `INTERNAL` Nội bộ |
| Trạng thái tin | `RECRUITMENT_JOB_STATUS_LABELS` | `DRAFT` Nháp · `OPEN` Đang mở · `PAUSED` Tạm dừng · `CLOSED` Đã đóng |
| Loại file ứng viên | `RECRUITMENT_FILE_KIND_LABELS` | `CV` CV · `OTHER` Tài liệu khác |
| Trạng thái hồ sơ ứng tuyển | `RECRUITMENT_APPLICATION_STATUS_LABELS` | `ACTIVE` Đang xét · `REJECTED` Đã loại · `WITHDRAWN` Rút hồ sơ · `HIRED` Đã tuyển |
| Loại lý do | `RECRUITMENT_REASON_KIND_LABELS` | `REJECTION` Lý do loại · `OFFER_DECLINE` Lý do từ chối offer |
| Sự kiện lịch sử | `RECRUITMENT_EVENT_TYPE_LABELS` | `APPLIED` Ứng tuyển · `REAPPLIED` Nộp lại hồ sơ · `STAGE_CHANGED` Chuyển vòng · `REJECTED` Loại hồ sơ · `WITHDRAWN` Rút hồ sơ · `REOPENED` Mở lại hồ sơ · `INTERVIEW_SCHEDULED` Đặt lịch phỏng vấn · `INTERVIEW_RESCHEDULED` Đổi lịch phỏng vấn · `INTERVIEW_CANCELLED` Huỷ lịch phỏng vấn · `INTERVIEW_STATUS_CHANGED` Cập nhật buổi phỏng vấn · `SCORECARD_SUBMITTED` Nộp phiếu đánh giá · `EMAIL_SENT` Gửi email · `EMAIL_FAILED` Gửi email lỗi · `COMMENTED` Bình luận · `UPDATED` Sửa thông tin · `FILE_ADDED` Thêm tài liệu · `CONSENT_RECORDED` Ghi nhận đồng ý · `OFFER_CREATED` Tạo offer · `OFFER_SUBMITTED` Gửi duyệt offer · `OFFER_APPROVED` Duyệt offer · `OFFER_APPROVAL_REJECTED` Từ chối duyệt offer · `OFFER_SENT` Gửi offer · `OFFER_ACCEPTED` Ứng viên đồng ý offer · `OFFER_DECLINED` Ứng viên từ chối offer · `OFFER_EXPIRED` Offer hết hạn · `OFFER_CANCELLED` Huỷ offer · `OFFER_NO_SHOW` Không nhận việc · `MERGED` Gộp hồ sơ trùng · `BLACKLISTED` Đánh dấu không tái tuyển · `UNBLACKLISTED` Bỏ đánh dấu không tái tuyển · `TALENT_POOL_ADDED` Thêm vào kho tiềm năng · `TALENT_POOL_REMOVED` Gỡ khỏi kho tiềm năng · `HIRED` Chuyển thành nhân viên · `MINIMIZED` Thu gọn dữ liệu · `ANONYMIZED` Ẩn danh |
| Hình thức phỏng vấn | `RECRUITMENT_INTERVIEW_MODE_LABELS` | `ONSITE` Trực tiếp · `ONLINE` Online · `PHONE` Điện thoại |
| Trạng thái buổi phỏng vấn | `RECRUITMENT_INTERVIEW_STATUS_LABELS` | `SCHEDULED` Đã lên lịch · `DONE` Đã diễn ra · `NO_SHOW` Ứng viên vắng · `CANCELLED` Huỷ |
| Loại mẫu đánh giá | `RECRUITMENT_SCORECARD_KIND_LABELS` | `INTERVIEW` Phỏng vấn · `TEST` Thi tuyển |
| Trạng thái phiếu | `RECRUITMENT_SCORECARD_STATUS_LABELS` | `PENDING` Chờ đánh giá · `SUBMITTED` Đã nộp |
| Kết luận phiếu | `RECRUITMENT_VERDICT_LABELS` | `PASS` Đạt · `FAIL` Không đạt · `CONSIDER` Cân nhắc |
| Trạng thái offer | `RECRUITMENT_OFFER_STATUS_LABELS` | `DRAFT` Nháp · `PENDING_APPROVAL` Chờ duyệt · `APPROVED` Đã duyệt · `APPROVAL_REJECTED` Từ chối duyệt · `SENT` Đã gửi · `ACCEPTED` Đồng ý · `DECLINED` Ứng viên từ chối · `EXPIRED` Hết hạn · `NO_SHOW` Không nhận việc · `CANCELLED` Huỷ · `SUPERSEDED` Đã có phiên bản mới |
| Nhóm thử việc | `RECRUITMENT_PROBATION_GROUP_LABELS` | `NONE` Không thử việc · `ENTERPRISE_MANAGER` Người quản lý doanh nghiệp (tối đa 180 ngày) · `COLLEGE_OR_ABOVE` Cần trình độ cao đẳng trở lên (tối đa 60 ngày) · `INTERMEDIATE` Trung cấp, công nhân kỹ thuật, nhân viên nghiệp vụ (tối đa 30 ngày) · `OTHER` Công việc khác (tối đa 6 ngày làm việc) |
| Kênh phản hồi offer | `RECRUITMENT_RESPONSE_CHANNEL_LABELS` | `LINK` Qua link · `HR` HR ghi nhận |
| Loại mẫu | `RECRUITMENT_TEMPLATE_KIND_LABELS` | `EMAIL` Mẫu email · `OFFER_LETTER` Mẫu thư mời nhận việc |
| Mục đích mẫu email | `RECRUITMENT_TEMPLATE_PURPOSE_LABELS` | `APPLICATION_RECEIVED` Xác nhận ứng tuyển · `INTERVIEW_INVITE` Mời phỏng vấn · `INTERVIEW_RESCHEDULED` Đổi lịch phỏng vấn · `INTERVIEW_CANCELLED` Huỷ lịch phỏng vấn · `REJECTION` Thông báo không trúng tuyển · `OFFER` Gửi offer · `WELCOME` Chào mừng nhận việc · `STAGE_AUTO` Tự gửi khi vào vòng · `CUSTOM` Soạn tay · `OFFER_LETTER` Thư mời nhận việc · `SMTP_TEST` Gửi thử SMTP |
| Bảo mật SMTP | `RECRUITMENT_SMTP_SECURITY_LABELS` | `TLS` TLS (SSL) · `STARTTLS` STARTTLS · `NONE` Không mã hoá |
| Kết quả gửi thử SMTP | `RECRUITMENT_SMTP_TEST_STATUS_LABELS` | `UNTESTED` Chưa gửi thử · `SUCCESS` Gửi thử thành công · `FAILED` Gửi thử lỗi |
| Kênh gửi email | `RECRUITMENT_EMAIL_CHANNEL_LABELS` | `COMPANY_SMTP` SMTP công ty · `SYSTEM` Email hệ thống |
| Trạng thái email | `RECRUITMENT_EMAIL_STATUS_LABELS` | `PENDING` Chờ gửi · `SENT` Đã gửi · `FAILED` Lỗi · `CANCELLED` Huỷ · `SKIPPED` Bỏ qua (môi trường thử) |
| Loại đồng ý | `RECRUITMENT_CONSENT_KIND_LABELS` | `PROCESSING` Xử lý dữ liệu cho tuyển dụng · `TALENT_POOL` Lưu vào kho tiềm năng |
| Cách ghi nhận đồng ý | `RECRUITMENT_CONSENT_METHOD_LABELS` | `FORM` Ứng viên tích trên form · `HR_RECORDED` HR ghi nhận |
| Căn cứ đồng ý | `RECRUITMENT_CONSENT_BASIS_LABELS` | `CANDIDATE_APPLIED` Ứng viên gửi CV ứng tuyển · `WRITTEN_CONSENT` Ứng viên đồng ý bằng văn bản hoặc email · `OTHER` Khác |
| Loại bình luận | `RECRUITMENT_COMMENT_KIND_LABELS` | `COMMENT` Bình luận · `SUGGEST_MOVE` Đề xuất chuyển vòng · `SUGGEST_REJECT` Đề xuất loại · `SUGGEST_OFFER` Đề xuất offer |

---

## Mã lỗi

Lỗi theo envelope chung, `message` là tiếng Việt hiển thị được ngay. Bộ lọc lỗi của API chỉ giữ ba trường
`code`, `message` và `errors` (khi `errors` là mảng):

```json
{ "success": false, "error": { "code": "RECRUIT_HEADCOUNT_EXCEEDED", "message": "Định biên còn trống 1, yêu cầu xin 2. Hãy giảm số lượng, hoặc đề xuất tăng định biên để Giám đốc chốt." } }
```

⚠ Các trường thêm mà service gắn vào lỗi **không tới được FE**:

- `RECRUIT_HEADCOUNT_EXCEEDED` và `RECRUIT_HEADCOUNT_NOT_CONFIRMED` có `available` ở service nhưng bị bỏ. Số còn
  trống chỉ còn trong `message`; FE cần số thì gọi lại `GET /requisitions/availability`.
- Lỗi phản hồi offer công khai có `state` ở service nhưng bị bỏ. FE suy trạng thái từ **hậu tố của `code`**:
  `RECRUIT_OFFER_LINK_EXPIRED` → `EXPIRED`, hoặc gọi lại `GET /public/offer-responses/:token`.
- Lỗi điều khoản offer giữ được số `min`, `max` vì chúng nằm **trong từng phần tử của `errors`**:
  `{ code, message, errors: [{ code: 'RECRUIT_PROBATION_SALARY_TOO_LOW', min: 18700000, message }] }`.

| HTTP | Mã | Ý nghĩa |
|---|---|---|
| 400 | `RECRUIT_APPLICATION_NOT_FOUND` | `applicationId` gửi kèm bình luận không thuộc ứng viên này (ở route đọc là 404) |
| 400 | `RECRUIT_APPLICATION_REQUIRED` | Đề xuất (bình luận loại `SUGGEST_*`) phải chọn hồ sơ ứng tuyển |
| 400 | `RECRUIT_CANDIDATE_NO_EMAIL` | Ứng viên chưa có email nên không gửi email hay offer được |
| 400 | `RECRUIT_CATALOG_SYSTEM_ITEM` | Mục hệ thống của danh mục không đổi tên hay ngừng dùng được |
| 400 | `RECRUIT_CONSENT_REQUIRED` | Form ứng tuyển công khai chưa tích đồng ý xử lý dữ liệu |
| 400 | `RECRUIT_CONTACT_REQUIRED` | Ứng viên phải có email hoặc số điện thoại |
| 400 | `RECRUIT_CRITERION_INVALID` | Tiêu chí hay môn không thuộc mẫu của phiếu |
| 400 | `RECRUIT_EMAIL_CONTENT_REQUIRED` | Gửi email phải chọn mẫu hoặc nhập tiêu đề và nội dung |
| 400 | `RECRUIT_FILE_NOT_FOUND` | `cvFileId` gửi lên không thuộc ứng viên này (ở route lấy link là 404) |
| 400 | `RECRUIT_FILE_REQUIRED` | Chưa chọn file |
| 400 | `RECRUIT_FILE_TOO_LARGE` | File quá dung lượng cho phép của loại đó |
| 400 | `RECRUIT_FILE_TYPE_INVALID` | Nội dung file không đúng loại cho phép |
| 400 | `RECRUIT_HIRE_EMAIL_REQUIRED` | Ứng viên phải có email mới tạo được hồ sơ nhân viên |
| 400 | `RECRUIT_IMPORT_INVALID_FILE` | File Excel không đọc được hoặc thiếu cột bắt buộc |
| 400 | `RECRUIT_IMPORT_TOO_MANY_ROWS` | Quá số dòng Excel hoặc số CV cho phép mỗi lần |
| 400 | `RECRUIT_INTERVIEWER_INVALID` | Có người phỏng vấn hay người đánh giá không tồn tại hoặc đã nghỉ |
| 400 | `RECRUIT_INTERVIEW_TIME_INVALID` | Giờ kết thúc không sau giờ bắt đầu, hoặc buổi dài quá 12 giờ |
| 400 | `RECRUIT_JOB_CLOSED` | Chỉ ở tải nhiều CV: tin không có hoặc đã đóng (các route khác là 409) |
| 400 | `RECRUIT_JOB_DESCRIPTION_REQUIRED` | Tin phải có mô tả công việc |
| 400 | `RECRUIT_LOCATION_REQUIRED` | Phỏng vấn trực tiếp phải có địa điểm |
| 400 | `RECRUIT_MEETING_URL_REQUIRED` | Phỏng vấn online phải có link họp |
| 400 | `RECRUIT_MERGE_SAME` | Không gộp ứng viên với chính nó |
| 400 | `RECRUIT_OWNER_INVALID` | Người phụ trách tin không tồn tại hoặc đã nghỉ |
| 400 | `RECRUIT_PIPELINE_INVALID` | Quy trình sai luật vòng (`message` nói rõ luật nào), hoặc tin chưa có vòng Ứng tuyển |
| 400 | `RECRUIT_PIPELINE_REQUIRED` | Chưa có quy trình mẫu dùng được để tạo tin |
| 400 | `RECRUIT_POSITION_INVALID` | Vị trí không tồn tại hoặc đã ngừng dùng |
| 400 | `RECRUIT_PROBATION_DAYS_REQUIRED` | Có thử việc thì phải nhập số ngày thử việc |
| 400 | `RECRUIT_PROBATION_SALARY_REQUIRED` | Có thử việc thì phải nhập lương thử việc |
| 400 | `RECRUIT_PROBATION_SALARY_TOO_LOW` | Lương thử việc dưới 85% lương chính thức (BR-02), `min` trong `errors` |
| 400 | `RECRUIT_PROBATION_TOO_LONG` | Số ngày thử việc vượt trần của nhóm (BR-03), `max` trong `errors` |
| 400 | `RECRUIT_RANGE_INVALID` | Khoảng ngày lịch phỏng vấn ngược hoặc dài quá 62 ngày |
| 400 | `RECRUIT_REASON_INVALID` | Lý do loại hoặc lý do từ chối offer không hợp lệ hay đã ngừng dùng |
| 400 | `RECRUIT_REASON_REQUIRED` | Từ chối, trả lại, xoá dòng định biên đang dùng phải có lý do |
| 400 | `RECRUIT_REPLACED_EMPLOYEE_POSITION` | Nhân viên được thay phải đang ở đúng phòng ban và vị trí của yêu cầu |
| 400 | `RECRUIT_REPLACED_EMPLOYEE_REQUIRED` | Lý do Thay thế phải chọn nhân viên được thay, và nhân viên đó phải tồn tại |
| 400 | `RECRUIT_RESPONSE_DEADLINE_INVALID` | Hạn phản hồi offer phải từ hôm nay đến ngày bắt đầu làm việc (BR-11) |
| 400 | `RECRUIT_SALARY_RANGE_INVALID` | Khung lương "từ" lớn hơn "đến" |
| 400 | `RECRUIT_SCORECARD_KIND_LOCKED` | Không đổi được loại của mẫu đánh giá đã tạo |
| 400 | `RECRUIT_SCORECARD_TEMPLATE_INVALID` | Chưa có mẫu đánh giá, hoặc mẫu không hợp với vòng |
| 400 | `RECRUIT_SCORE_INVALID` | Điểm ngoài khoảng cho phép (1–5, hoặc vượt điểm tối đa của môn) |
| 400 | `RECRUIT_SCORE_MISSING` | Nộp phiếu còn tiêu chí chưa chấm |
| 400 | `RECRUIT_SEND_AT_PAST` | Giờ hẹn gửi email đã qua |
| 400 | `RECRUIT_SMTP_PASSWORD_REQUIRED` | Lần đầu cấu hình SMTP, hoặc đổi host, cổng, kiểu bảo mật, tài khoản SMTP, thì phải nhập mật khẩu |
| 400 | `RECRUIT_SMTP_HOST_NOT_ALLOWED` | Máy chủ SMTP trỏ vào mạng nội bộ |
| 400 | `RECRUIT_SOURCE_INVALID` | Nguồn ứng viên không hợp lệ |
| 400 | `RECRUIT_STAGE_HIRED_RESERVED` | Vào vòng Đã tuyển chỉ bằng nút Tạo hồ sơ nhân viên |
| 400 | `RECRUIT_STAGE_NOT_IN_JOB` | Vòng không thuộc tin của hồ sơ |
| 400 | `RECRUIT_START_DATE_PAST` | Ngày bắt đầu làm việc của offer đã qua |
| 400 | `RECRUIT_TAG_INVALID` | Có tag không tồn tại |
| 400 | `RECRUIT_TEAM_MEMBER_INVALID` | Có thành viên hội đồng không tồn tại hoặc đã nghỉ |
| 400 | `RECRUIT_TEMPLATE_KIND_MISMATCH` | Mẫu thư mời chỉ dùng mục đích Thư mời nhận việc, và ngược lại |
| 400 | `RECRUIT_TEMPLATE_NOT_FOUND` | Chưa có mẫu email gửi offer |
| 400 | `RECRUIT_TEMPLATE_SUBJECT_REQUIRED` | Mẫu email phải có tiêu đề |
| 400 | `RECRUIT_TEMPLATE_UNKNOWN_VARIABLES` | Mẫu dùng biến không có cho mục đích này |
| 400 | `RECRUIT_TEST_MAX_SCORE_REQUIRED` | Môn thi thiếu điểm tối đa |
| 400 | `RECRUIT_TEST_PASS_SCORE_INVALID` | Điểm đạt của môn lớn hơn điểm tối đa |
| 400 | `RECRUIT_VERDICT_REQUIRED` | Nộp phiếu phỏng vấn phải có kết luận |
| 403 | `RECRUIT_APPROVAL_NOT_YOUR_TURN` | Người gọi không phải người duyệt của bước đang chờ |
| 403 | `RECRUIT_HEADCOUNT_CONFIRM_FORBIDDEN` | Chỉ người có quyền chốt định biên mới chốt, trả lại, sửa số đã chốt, xoá dòng đã chốt |
| 403 | `RECRUIT_HEADCOUNT_FORBIDDEN` | Chỉ người phụ trách tuyển dụng nhập nháp, đề xuất, gửi, rút đề xuất, xoá dòng nháp |
| 403 | `RECRUIT_OFFER_SALARY_FORBIDDEN` | Không xem được lương nên không tải được PDF offer |
| 403 | `RECRUIT_SCOPE_FORBIDDEN` | Ngoài phạm vi dữ liệu, hoặc không phải người tạo hay người phụ trách tuyển dụng |
| 409 | `RECRUIT_HIRE_CONFLICT` | Tạo hồ sơ nhân viên trùng mã hoặc email: thử lại hoặc chọn nhân viên có sẵn |
| 403 | `RECRUIT_SUGGESTION_FORBIDDEN` | Bình luận loại `SUGGEST_*` chỉ dành cho vai trò `MANAGER` (L15) |
| 403 | `RECRUIT_SCORECARD_NOT_YOURS` | Không phải phiếu đánh giá của mình |
| 404 | `RECRUIT_APPLICATION_NOT_FOUND` | Không tìm thấy hồ sơ ứng tuyển |
| 404 | `RECRUIT_CANDIDATE_NOT_FOUND` | Không tìm thấy ứng viên |
| 404 | `RECRUIT_CAREERS_CLOSED` | Trang tuyển dụng không mở: mã công ty lạ, công ty ngừng phục vụ hoặc module đã tắt |
| 404 | `RECRUIT_EMPLOYEE_NOT_FOUND` | Không tìm thấy nhân viên để nối khi tạo hồ sơ nhân viên |
| 404 | `RECRUIT_FILE_NOT_FOUND` | Không tìm thấy file hoặc không mở được file |
| 404 | `RECRUIT_INTERVIEW_NOT_FOUND` | Không tìm thấy buổi phỏng vấn |
| 404 | `RECRUIT_JOB_NOT_FOUND` | Không tìm thấy tin tuyển dụng |
| 404 | `RECRUIT_JOB_NOT_OPEN` | Trang công khai: tin không còn nhận hồ sơ |
| 404 | `RECRUIT_OFFER_NOT_FOUND` | Không tìm thấy offer |
| 404 | `RECRUIT_OFFER_PDF_NOT_FOUND` | Offer chưa gửi nên chưa có PDF |
| 404 | `RECRUIT_REQUISITION_NOT_FOUND` | Không tìm thấy yêu cầu tuyển dụng |
| 404 | `RECRUIT_SCORECARD_NOT_FOUND` | Không tìm thấy phiếu đánh giá |
| 404 | `RECRUIT_SMTP_NOT_CONFIGURED` | Gửi thử khi chưa lưu cấu hình SMTP |
| 409 | `RECRUIT_ALREADY_BLACKLISTED` | Ứng viên đã bị đánh dấu không tái tuyển |
| 409 | `RECRUIT_APPLICATION_ACTIVE_EXISTS` | Ứng viên đang có hồ sơ đang xét ở tin này (BR-05) |
| 409 | `RECRUIT_APPLICATION_CLOSED` | Hồ sơ không còn đang xét |
| 409 | `RECRUIT_APPLICATION_NOT_CLOSED` | Chỉ mở lại được hồ sơ đã loại hoặc đã rút |
| 409 | `RECRUIT_APPROVAL_NOT_PENDING` | Không ở trạng thái chờ duyệt, hoặc bước vừa được người khác quyết |
| 409 | `RECRUIT_CANDIDATE_ANONYMIZED` | Ứng viên đã được ẩn danh |
| 409 | `RECRUIT_CANDIDATE_HIRED` | Ứng viên đã thành nhân viên nên không ẩn danh ở module này |
| 409 | `RECRUIT_CATALOG_NAME_EXISTS` | Tên đã có trong danh mục |
| 409 | `RECRUIT_EMAIL_NOT_PENDING` | Email đã gửi hoặc đã huỷ |
| 409 | `RECRUIT_EMPLOYEE_ALREADY_LINKED` | Nhân viên đã gắn với một ứng viên khác |
| 409 | `RECRUIT_HEADCOUNT_EXCEEDED` | Số lượng vượt định biên còn trống (BR-01), lúc gửi hoặc ở bất kỳ bước duyệt nào; số còn trống chỉ có trong `message` |
| 409 | `RECRUIT_HEADCOUNT_EXISTS` | Đã có dòng định biên cho vị trí này trong năm |
| 409 | `RECRUIT_HEADCOUNT_NEVER_CONFIRMED` | Dòng chưa từng chốt nên không có gì để rút; muốn bỏ thì xoá dòng |
| 409 | `RECRUIT_HEADCOUNT_NOT_CONFIRMED` | Vị trí chưa có định biên Đã chốt của năm nên chưa gửi, chưa duyệt được |
| 409 | `RECRUIT_HEADCOUNT_NOT_DRAFT` | Dòng không có bản nháp hay bản bị trả lại để gửi |
| 409 | `RECRUIT_HEADCOUNT_NOT_PENDING` | Dòng không chờ chốt nên không trả lại được |
| 409 | `RECRUIT_HEADCOUNT_NOTHING_TO_CONFIRM` | Dòng không có đề xuất để chốt |
| 409 | `RECRUIT_HEADCOUNT_NOTHING_TO_WITHDRAW` | Dòng không có đề xuất để rút |
| 409 | `RECRUIT_HEADCOUNT_PENDING` | Đề xuất đang chờ chốt nên chưa sửa, rút hay xoá được; người chốt phải chốt hoặc trả lại trước |
| 409 | `RECRUIT_INTERVIEW_LOCKED` | Buổi phỏng vấn đã huỷ, hoặc không còn ở trạng thái Đã lên lịch |
| 409 | `RECRUIT_JOB_CLOSED` | Tin đã đóng, không sửa hay thêm hồ sơ được |
| 409 | `RECRUIT_JOB_SLUG_EXISTS` | Đường dẫn công khai đã có tin khác dùng |
| 409 | `RECRUIT_JOB_STATUS_INVALID` | Không chuyển được trạng thái tin từ trạng thái hiện tại, hoặc xoá tin không phải Nháp |
| 409 | `RECRUIT_MERGE_ACTIVE_CONFLICT` | Hai ứng viên cùng có hồ sơ đang xét ở một tin |
| 409 | `RECRUIT_MERGE_BOTH_HIRED` | Hai ứng viên đều đã thành nhân viên |
| 409 | `RECRUIT_NOT_BLACKLISTED` | Ứng viên không bị đánh dấu nên không gỡ được |
| 409 | `RECRUIT_OFFER_ALREADY_HIRED` | Offer đã có hồ sơ nhân viên |
| 409 | `RECRUIT_OFFER_ALREADY_RESPONDED` | Offer vừa được phản hồi ở nơi khác |
| 409 | `RECRUIT_OFFER_EXISTS` | Hồ sơ đã có offer đang xử lý |
| 409 | `RECRUIT_OFFER_EXPIRED` | Offer đã hết hạn |
| 409 | `RECRUIT_OFFER_LINK_UNAVAILABLE`, `_RESPONDED`, `_EXPIRED`, `_SUPERSEDED`, `_CANCELLED` | Trang công khai: link phản hồi không còn nhận đồng ý hay từ chối; hậu tố là trạng thái link |
| 409 | `RECRUIT_OFFER_LOCKED` | Offer không ở trạng thái cho phép sửa, gửi duyệt hay huỷ |
| 409 | `RECRUIT_OFFER_NOT_ACCEPTED` | Chỉ offer Đồng ý mới tạo hồ sơ nhân viên hay ghi Không nhận việc |
| 409 | `RECRUIT_OFFER_NOT_APPROVED` | Offer chưa duyệt xong nên chưa gửi được |
| 409 | `RECRUIT_OFFER_NOT_REVISABLE` | Offer ở trạng thái này không tạo phiên bản mới được |
| 409 | `RECRUIT_OFFER_NOT_SENT` | Offer không ở trạng thái chờ phản hồi |
| 409 | `RECRUIT_REPLACED_EMPLOYEE_TAKEN` | Nhân viên được thay đã nằm trong một yêu cầu thay thế khác đang mở |
| 409 | `RECRUIT_REQUISITION_HAS_OPEN_JOB` | Yêu cầu còn tin Đang mở nên chưa huỷ được |
| 409 | `RECRUIT_REQUISITION_LOCKED` | Yêu cầu không ở trạng thái cho phép sửa, gửi, xoá hay huỷ |
| 409 | `RECRUIT_REQUISITION_NOT_APPROVED` | Yêu cầu không ở Đã duyệt hay Đang tuyển nên không tạo, không mở được tin |
| 409 | `RECRUIT_SCORECARD_LOCKED` | Phiếu đã nộp quá 24 giờ nên đã khoá (BR-08) |
| 409 | `RECRUIT_SCORECARD_SUBMITTED` | Người được yêu cầu đã nộp phiếu cho vòng này |
| 409 | `RECRUIT_STAGE_KIND_LOCKED` | Vòng đã có hồ sơ nên không đổi loại được |
| 409 | `RECRUIT_STAGE_NOT_EMPTY` | Không xoá được vòng đã có hồ sơ, lịch hoặc phiếu đánh giá |
| 409 | `RECRUIT_STAGE_NOT_INTERVIEW` | Chỉ đặt lịch cho hồ sơ ở vòng Phỏng vấn hoặc Thi tuyển |
| 409 | `RECRUIT_STAGE_NOT_OFFER` | Chỉ tạo offer cho hồ sơ ở vòng Offer |
| 409 | `RECRUIT_TALENT_POOL_NO_CONSENT` | Ứng viên chưa đồng ý lưu vào kho tiềm năng |
| 409 | `RECRUIT_TERMS_CHANGED` | Trang công khai: điều khoản vừa đổi, ứng viên phải tải lại trang |
| 429 | `RECRUIT_RATE_LIMITED` | Trang công khai: công ty nhận quá 60 lần nộp trong giờ qua |
| 503 | `RECRUIT_SECRET_KEY_NOT_CONFIGURED` | Máy chủ chưa có khoá mã hoá nên chưa lưu hay dùng được SMTP riêng |

Mã chung có thể gặp ở module này:

| HTTP | Mã | Khi nào |
|---|---|---|
| 400 | `BAD_REQUEST` | Body hay query sai kiểu, thiếu trường bắt buộc |
| 403 | `FORBIDDEN` | Vai trò không được vào (EMPLOYEE ở trang quản lý, người không phải ADMIN ở SMTP) hoặc thiếu permission |
| 403 | `MODULE_*` | Module chỉ xem hoặc đã tắt, xem [entitlements.md](./entitlements.md) |
| 404 | `NOT_FOUND` | Vài chỗ trả 404 không kèm mã riêng: dòng định biên, mẫu, nguồn, lý do, tag, quy trình mẫu, mẫu đánh giá, vị trí |
| 413 | `UNKNOWN_ERROR` | File trên 20 MB |

---

## Luồng trạng thái

### Định biên

Mỗi dòng là một cặp (năm, vị trí) và chứa hai số cùng lúc: số đã chốt (`confirmedQuantity`, đang có hiệu lực)
và một đề xuất đang mở (`proposedQuantity` + `proposalStatus`). Số đã chốt giữ hiệu lực cho tới khi đề xuất mới
được chốt (Q-21). Chỉ số đã chốt dùng để kiểm yêu cầu tuyển (BR-01); `confirmedQuantity: null` nghĩa là chưa
từng chốt và còn trống tính là 0.

Đề xuất (`RecruitmentProposalStatus`):

| Từ | Sang | Route |
|---|---|---|
| (không có) | `DRAFT` | HR tạo dòng mới, hoặc `PATCH /:id/proposal` |
| `DRAFT`, `REJECTED` | `PENDING` | `POST /submit` |
| `PENDING`, `DRAFT` | (xoá đề xuất, số đề xuất thành số đã chốt) | `POST /confirm` |
| `PENDING` | `REJECTED` | `POST /reject` |
| `REJECTED`, hoặc không có | `DRAFT` | `PATCH /:id/proposal`; đang `PENDING` thì 409 |
| `DRAFT`, `REJECTED` của dòng đã chốt | (xoá đề xuất, số đã chốt giữ nguyên) | `DELETE /:id/proposal`, lịch sử `WITHDRAWN` |

Xoá cả dòng (`DELETE /:id`) là xoá hẳn, kèm lịch sử, vì (năm, vị trí) là khoá duy nhất và phải tạo lại được;
nhật ký hệ thống `recruitment.headcount_delete` giữ bản chụp, lý do và số đang dùng lúc xoá. Ba trường hợp:

| Dòng | Ai xoá được | Điều kiện |
|---|---|---|
| Chưa từng chốt (`confirmedQuantity: null`) | `recruitment:manage` hoặc quyền chốt | Đề xuất không `PENDING`; lý do không bắt buộc |
| Đã chốt, chưa ai dùng (`current` = 0 và `requisitionCount` = 0) | Chỉ quyền chốt (DIRECTOR, CHIEF, ADMIN) | Đề xuất không `PENDING`; lý do không bắt buộc |
| Đã chốt, **đang dùng** (`current` > 0 hoặc `requisitionCount` > 0) | Chỉ quyền chốt | Đề xuất không `PENDING`; **bắt buộc `reason`**, thiếu thì 400 `RECRUIT_REASON_REQUIRED` |

Xoá dòng đang dùng thì: nhân viên đang làm không bị gì; yêu cầu đã duyệt hoặc đang tuyển chạy tiếp; yêu cầu
nháp không gửi duyệt được và yêu cầu chờ duyệt không duyệt được (409 `RECRUIT_HEADCOUNT_NOT_CONFIRMED`) cho tới
khi vị trí có định biên Đã chốt lại. Không gửi thông báo, giống khi sửa số đã chốt.

Đề xuất `PENDING` không sửa, rút hay xoá được, vì người chốt đã được báo phải xử lý (N-15). Người chốt chốt hoặc
trả lại trước.

DIRECTOR, CHIEF, ADMIN tạo dòng mới thì chốt luôn, không qua đề xuất, và sửa thẳng số đã chốt bằng
`PATCH /:id/confirmed`. Response có trường gộp `status` để hiện một nhãn: `CONFIRMED` ("Đã chốt") khi đã có số
chốt, nếu chưa thì là trạng thái đề xuất (`DRAFT`, `PENDING`, `REJECTED`), không có gì thì `NONE` ("Chưa chốt").
Dòng đã chốt mà có đề xuất đang chờ vẫn là `CONFIRMED`; xem `proposalStatus` để hiện thêm nhãn "Chờ chốt".

### Yêu cầu tuyển dụng (`RecruitmentRequisitionStatus`)

| Từ | Sang | Route hoặc sự kiện |
|---|---|---|
| `DRAFT`, `REJECTED` | `PENDING` | `POST /:id/submit` (kiểm BR-01, dựng bước duyệt, `round` + 1) |
| `PENDING` | `APPROVED` | `POST /:id/approve` ở bước cuối. **Mọi bước** kiểm lại BR-01; vượt thì 409, bước không đổi |
| `PENDING` | `REJECTED` | `POST /:id/reject` ở bất kỳ bước nào |
| `APPROVED` | `RECRUITING` | Tin đầu tiên của yêu cầu được mở |
| `APPROVED`, `RECRUITING` | `FILLED` | Số offer Đồng ý đạt `quantity` (BR-12), sau khi tạo hồ sơ nhân viên |
| `FILLED` | `RECRUITING` | Ghi Không nhận việc làm số đã tuyển tụt dưới `quantity` |
| Mọi trạng thái trừ `CANCELLED`, `FILLED` | `CANCELLED` | `POST /:id/cancel`, khi không còn tin `OPEN` |
| `DRAFT` | (xoá mềm) | `DELETE /:id` |

Chỉ sửa và tải JD được khi `DRAFT` hoặc `REJECTED` (người phụ trách tuyển dụng tải JD được ở mọi trạng thái).
Khi yêu cầu `FILLED`, các tin của nó **không đổi trạng thái** nhưng biến khỏi trang công khai và không nhận hồ
sơ tự nộp nữa.

### Bước duyệt (`RecruitmentApprovalStepStatus`)

`WAITING` (chưa tới lượt) → `PENDING` (đang chờ người này) → `APPROVED` hoặc `REJECTED`. Bước 1 tạo ra ở
`PENDING`, bước 2 ở `WAITING` và chỉ mở khi bước 1 duyệt. Một bước bị từ chối thì vòng kết thúc, các bước
`WAITING` còn lại giữ nguyên.

### Tin tuyển dụng (`RecruitmentJobStatus`)

| Từ | Sang | Route |
|---|---|---|
| `DRAFT`, `PAUSED` | `OPEN` | `POST /:id/open`, yêu cầu phải `APPROVED` hoặc `RECRUITING` |
| `OPEN` | `PAUSED` | `POST /:id/pause` |
| `DRAFT`, `OPEN`, `PAUSED` | `CLOSED` (`closedReason: 'MANUAL'`) | `POST /:id/close` |
| `OPEN` | `CLOSED` (`closedReason: 'DEADLINE'`) | J-03 lúc 00:15 khi qua hạn nộp, gửi N-18 |
| `DRAFT` | (xoá mềm) | `DELETE /:id` |

`CLOSED` là trạng thái cuối: không mở lại và không sửa được. Hồ sơ đang xét của tin đã đóng vẫn xử lý tiếp.
Trang công khai chỉ nhận hồ sơ cho tin `OPEN`, chưa qua hạn nộp, có yêu cầu chưa `FILLED`.

### Hồ sơ ứng tuyển (`RecruitmentApplicationStatus`)

| Từ | Sang | Khi nào |
|---|---|---|
| (mới) | `ACTIVE` ở vòng Ứng tuyển | Tự nộp, HR thêm ứng viên vào tin |
| `ACTIVE` | `ACTIVE` ở vòng khác | Chuyển vòng (không vào được vòng `HIRED` bằng route chuyển vòng) |
| `ACTIVE` | `REJECTED` | HR loại, hoặc ứng viên từ chối offer |
| `ACTIVE` | `WITHDRAWN` | Ứng viên rút, hoặc HR ghi Không nhận việc |
| `ACTIVE` | `HIRED` | Tạo hồ sơ nhân viên từ offer Đồng ý |
| `REJECTED`, `WITHDRAWN` | `ACTIVE` | Mở lại, ứng viên nộp lại cùng tin, HR thêm lại vào tin, hoặc tạo phiên bản mới cho offer bị từ chối hay hết hạn |

Mỗi (ứng viên, tin) có tối đa một hồ sơ `ACTIVE` (BR-05).

### Offer (`RecruitmentOfferStatus`)

| Từ | Sang | Route hoặc sự kiện |
|---|---|---|
| (mới) | `DRAFT` | Tạo offer, hoặc tạo phiên bản mới |
| `DRAFT` | `PENDING_APPROVAL` | Gửi duyệt (chốt `overBand`) |
| `PENDING_APPROVAL` | `APPROVED` | Bước duyệt cuối đồng ý |
| `PENDING_APPROVAL` | `APPROVAL_REJECTED` | Một bước từ chối duyệt |
| `APPROVED` | `SENT` | Gửi cho ứng viên |
| `SENT` | `ACCEPTED`, `DECLINED` | Ứng viên bấm qua link, hoặc HR ghi nhận |
| `SENT` | `EXPIRED` | J-04 lúc 00:05 sau hạn phản hồi |
| `ACCEPTED` | `NO_SHOW` | Đồng ý nhưng không nhận việc |
| `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `APPROVAL_REJECTED`, `SENT` | `CANCELLED` | Huỷ |
| `APPROVAL_REJECTED`, `APPROVED`, `SENT`, `DECLINED`, `EXPIRED` | `SUPERSEDED` | Tạo phiên bản mới; bản mới là `DRAFT`, phải duyệt lại, link cũ hết hiệu lực |

Trạng thái link phản hồi trên trang công khai suy ra từ trạng thái offer:

| `state` | Khi nào | FE hiện |
|---|---|---|
| `ACTIVE` | Offer `SENT` và chưa qua 23:59:59 giờ Việt Nam của ngày hạn | Tóm tắt, PDF, nút Đồng ý và Từ chối |
| `RESPONDED` | `ACCEPTED`, `DECLINED` hoặc `NO_SHOW` | "Bạn đã phản hồi offer này", kèm lựa chọn đã chọn |
| `EXPIRED` | `EXPIRED`, hoặc `SENT` mà đã qua hạn | "Offer đã hết hạn" |
| `SUPERSEDED` | Đã có phiên bản mới | "Offer đã được cập nhật, vui lòng xem email mới nhất" |
| `CANCELLED` | Offer bị huỷ | "Offer đã bị huỷ" |
| `UNAVAILABLE` | Token sai, công ty không phục vụ, module tắt, hoặc offer ở trạng thái chưa gửi | "Link không còn hiệu lực" |

### Phiếu đánh giá và buổi phỏng vấn

- Phiếu (`RecruitmentScorecardStatus`): `PENDING` → `SUBMITTED`. Sau lần nộp đầu, chủ phiếu sửa được trong 24
  giờ; quá 24 giờ thì 409 `RECRUIT_SCORECARD_LOCKED`.
- Buổi phỏng vấn (`RecruitmentInterviewStatus`): `SCHEDULED` → `DONE` hoặc `NO_SHOW` (đổi qua lại được), hoặc
  `SCHEDULED` → `CANCELLED`. Chỉ sửa và huỷ được buổi `SCHEDULED`; buổi `CANCELLED` không đổi gì được nữa.

---

## Thông báo

Mọi thông báo tạo bằng `NotificationCenterService.create`, nên đều có bản trong app và đẩy FCM tới thiết bị của
người nhận. Cột Email là thông báo có kèm email nội bộ. `refType` và `refId` có trong mỗi thông báo để FE mở đúng
chỗ khi `targetUrl` không đủ. Thông báo có `actionType: 'APPROVE_REJECT'` mang `actionPayload` với
`approveEndpoint`, `rejectEndpoint` (ví dụ `/v1/recruitment/requisitions/4/approve`) để duyệt nhanh; nút Từ chối
nhanh vẫn phải hỏi lý do vì BE bắt buộc `note`.

| Mã | `NotificationType` | Người nhận | Khi nào | Email | `targetUrl` | `actionType` |
|---|---|---|---|---|---|---|
| N-01 | `RECRUIT_REQUISITION_APPROVAL_NEEDED` | Người duyệt đến lượt; bước theo vai trò thì mọi người đang làm có vai trò đó (bước `DIRECTOR` gửi cả `CHIEF`) | Gửi duyệt, bước trước vừa duyệt xong, nhắc lúc 09:00 sau 3 ngày (J-08) | ✓ | `/management/recruitment/requisitions/:id` | `APPROVE_REJECT` |
| N-02 | `RECRUIT_REQUISITION_DECIDED` | Người tạo; mọi HR đang làm (dạng "📌 Thông tin"), trừ người vừa quyết | Duyệt xong bước cuối, hoặc bị từ chối ở bất kỳ bước nào | – | `/management/recruitment/requisitions/:id` | `NAVIGATE_ONLY` |
| N-03 | `RECRUIT_NEW_APPLICATIONS` | HR phụ trách tin; thành viên hội đồng bật `notifyNewApplications` | Gom hồ sơ mới trong giờ qua, phút thứ 5 mỗi giờ (J-09) | – | Vai trò quản lý: `/management/recruitment/jobs/:id`; EMPLOYEE: `/recruitment/jobs/:id` | `NAVIGATE_ONLY` |
| N-04 | `RECRUIT_INTERVIEW_ASSIGNED` khi được giao; `RECRUIT_INTERVIEW_UPDATED` khi đổi lịch hoặc huỷ | Từng người phỏng vấn | Đặt, đổi, huỷ lịch phỏng vấn | ✓ kèm `.ics` | `/recruitment/my-interviews` | `NAVIGATE_ONLY` |
| N-05 | `RECRUIT_SCORECARD_DUE` | Người đánh giá | HR yêu cầu đánh giá; phiếu chưa nộp quá 24 giờ sau buổi (J-01) | – | `/recruitment/my-interviews` | `NAVIGATE_ONLY` |
| N-06 | `RECRUIT_OFFER_APPROVAL_NEEDED` | Người duyệt đến lượt (bước `DIRECTOR` gửi cả `CHIEF`) | Gửi duyệt offer, bước trước vừa duyệt, nhắc sau 1 ngày (J-08) | ✓ | `/management/recruitment/offers/:id` | `APPROVE_REJECT` |
| N-07 | `RECRUIT_OFFER_RESPONDED` | Người tạo offer, HR phụ trách tin, trưởng phòng tuyển, trừ người vừa thao tác | Ứng viên đồng ý, từ chối (qua link hoặc HR ghi nhận); offer hết hạn (J-04) | ✓ | `/management/recruitment/offers/:id` | `NAVIGATE_ONLY` |
| N-08 | `RECRUIT_NEW_HIRE` | Trưởng phòng tuyển và mọi nhân viên vai trò HR, trừ người vừa thao tác | Tạo hồ sơ nhân viên; 3 ngày trước ngày đi làm lúc 08:00 (J-07) | ✓ | `/management/employees/:employeeId` | `NAVIGATE_ONLY` |
| N-09 | `RECRUIT_INTERVIEW_TODAY` | Người phỏng vấn | 07:30 ngày có buổi phỏng vấn (J-02) | – | `/recruitment/my-interviews` | `NAVIGATE_ONLY` |
| N-10 | `RECRUIT_MENTIONED` | Người được nhắc trong `mentionIds`, trừ tác giả | Bình luận có nhắc tên | – | Vai trò quản lý: `/management/recruitment/candidates/:candidateId`; EMPLOYEE: `/recruitment/applications/:applicationId` | `NAVIGATE_ONLY` |
| N-11 | `RECRUIT_REQUISITION_FILLED` | Người tạo yêu cầu, mọi nhân viên vai trò HR, HR phụ trách các tin của yêu cầu | Yêu cầu vừa đủ người (BR-12) | – | `/management/recruitment/requisitions/:id` | `NAVIGATE_ONLY` |
| N-12 | `RECRUIT_EMAIL_FAILED` | Người gửi (hệ thống gửi thì HR phụ trách tin); thêm mọi ADMIN khi lỗi SMTP công ty | Email gửi ứng viên lỗi hẳn | ✓ | `/management/recruitment/candidates/:candidateId` | `NAVIGATE_ONLY` |
| N-13 | `RECRUIT_BLACKLISTED_REAPPLIED` | ADMIN và người có `recruitment:manage` | Ứng viên trùng email hoặc SĐT với người bị đánh dấu vừa tự nộp hồ sơ | – | `/management/recruitment/candidates/:candidateId` | `NAVIGATE_ONLY` |
| N-14 | `RECRUIT_OFFER_DECIDED` | Người tạo offer | Offer duyệt xong, hoặc bị từ chối duyệt | – | `/management/recruitment/offers/:id` | `NAVIGATE_ONLY` |
| N-15 | `RECRUIT_HEADCOUNT_CONFIRM_NEEDED` | ADMIN và người có `recruitment:headcount:confirm` | HR gửi đề xuất định biên; nhắc sau 3 ngày (J-08) | ✓ | `/management/recruitment/headcount?year=YYYY` | `NAVIGATE_ONLY` |
| N-16 | `RECRUIT_HEADCOUNT_DECIDED` | Người đề xuất | Đề xuất được chốt hoặc bị trả lại | – | `/management/recruitment/headcount?year=YYYY` | `NAVIGATE_ONLY` |
| N-17 | `RECRUIT_SUGGESTION` | HR phụ trách tin, trừ tác giả | Bình luận loại `SUGGEST_MOVE`, `SUGGEST_REJECT`, `SUGGEST_OFFER` | – | `/management/recruitment/candidates/:candidateId` | `NAVIGATE_ONLY` |
| N-18 | `RECRUIT_JOB_AUTO_CLOSED` | HR phụ trách tin | Tin tự đóng vì qua hạn nộp (J-03) | – | `/management/recruitment/jobs/:id` | `NAVIGATE_ONLY` |

- `refType` dùng các giá trị `recruitment_requisition`, `recruitment_offer`, `recruitment_job`,
  `recruitment_my_job`, `recruitment_candidate`, `recruitment_my_application`, `recruitment_my_interviews`,
  `recruitment_headcount` (khi đó `refId` là **năm**) và `employee`.
- Thông báo nhắc (J-08) dùng cùng `NotificationType`, tiêu đề bắt đầu bằng "Nhắc:".
- N-04 khi huỷ buổi dùng type `RECRUIT_INTERVIEW_UPDATED` với tiêu đề "Buổi phỏng vấn đã huỷ".
- FE phải có các trang đích: `/management/recruitment/{requisitions,jobs,candidates,offers}/[id]`,
  `/management/recruitment/headcount?year=`, `/management/recruitment/approvals`, và cho EMPLOYEE trong hội đồng
  `/recruitment/my-interviews`, `/recruitment/jobs/[id]`, `/recruitment/applications/[id]`.

---

## Chi tiết endpoint: cài đặt, định biên, yêu cầu, tin, trang công khai

### Kiểu dùng chung

```typescript
// types/recruitment.types.ts (phần dùng chung)

export type SystemRole = 'ADMIN' | 'HR' | 'DIRECTOR' | 'MANAGER' | 'CHIEF' | 'EMPLOYEE';
export type EmploymentType = 'FULL_TIME' | 'PROBATION' | 'APPRENTICE' | 'INTERN' | 'PART_TIME' | 'CONTRACTOR';
/** Loại hình của yêu cầu tuyển: như EmploymentType nhưng không có PROBATION. */
export type RequisitionEmploymentType = Exclude<EmploymentType, 'PROBATION'>;

export type RecruitmentProposalStatus = 'DRAFT' | 'PENDING' | 'REJECTED';
export type HeadcountRowStatus = 'CONFIRMED' | 'DRAFT' | 'PENDING' | 'REJECTED' | 'NONE';
export type RecruitmentHeadcountChangeType = 'PROPOSED' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED' | 'EDITED' | 'WITHDRAWN';
export type RecruitmentRequisitionReason = 'REPLACEMENT' | 'ADDITIONAL' | 'NEW_POSITION';
export type RecruitmentRequisitionStatus =
  | 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'RECRUITING' | 'FILLED' | 'CANCELLED';
export type RecruitmentApprovalTarget = 'REQUISITION' | 'OFFER';
export type RecruitmentApprovalStepStatus = 'WAITING' | 'PENDING' | 'APPROVED' | 'REJECTED';
export type RecruitmentApprovalBasis = 'DEPARTMENT_MANAGER' | 'DIRECTOR_FALLBACK' | 'HR' | 'OVER_BAND' | 'DIRECTOR';
export type RecruitmentStageKind = 'APPLIED' | 'SCREENING' | 'TEST' | 'INTERVIEW' | 'OFFER' | 'HIRED';
export type RecruitmentJobVisibility = 'PUBLIC' | 'INTERNAL';
export type RecruitmentJobStatus = 'DRAFT' | 'OPEN' | 'PAUSED' | 'CLOSED';
export type RecruitmentOfferStatus =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'APPROVAL_REJECTED' | 'SENT'
  | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'NO_SHOW' | 'CANCELLED' | 'SUPERSEDED';
export type RecruitmentTemplateKind = 'EMAIL' | 'OFFER_LETTER';
export type RecruitmentTemplatePurpose =
  | 'APPLICATION_RECEIVED' | 'INTERVIEW_INVITE' | 'INTERVIEW_RESCHEDULED' | 'INTERVIEW_CANCELLED'
  | 'REJECTION' | 'OFFER' | 'WELCOME' | 'STAGE_AUTO' | 'CUSTOM' | 'OFFER_LETTER' | 'SMTP_TEST';
export type RecruitmentReasonKind = 'REJECTION' | 'OFFER_DECLINE';
export type RecruitmentScorecardKind = 'INTERVIEW' | 'TEST';
export type RecruitmentSmtpSecurity = 'TLS' | 'STARTTLS' | 'NONE';
export type RecruitmentSmtpTestStatus = 'UNTESTED' | 'SUCCESS' | 'FAILED';
export type OfferLinkState = 'ACTIVE' | 'RESPONDED' | 'EXPIRED' | 'SUPERSEDED' | 'CANCELLED' | 'UNAVAILABLE';

// ── Tham chiếu dùng lại ──
export interface RecruitNamedRef { id: number; name: string }
export interface RecruitPersonRef { id: number; fullName: string }
export interface RecruitEmployeeRef extends RecruitPersonRef { employeeCode: string }

export interface RecruitApprovalStep {
  id: number;
  round: number;                       // lần gửi duyệt; gửi lại tạo vòng mới
  level: number;                       // 1, 2
  basis: RecruitmentApprovalBasis; basisLabel: string;
  approver: RecruitPersonRef | null;   // null khi bước giao theo vai trò
  approverRole: SystemRole | null; approverRoleLabel: string | null;
  status: RecruitmentApprovalStepStatus; statusLabel: string;
  decidedBy: RecruitPersonRef | null;
  decidedAt: string | null;
  note: string | null;                 // ghi chú khi duyệt hoặc lý do từ chối
}
```

---

### Cài đặt chung

#### GET `/v1/recruitment/settings`

Cài đặt của module cho công ty. Cần `recruitment:read`. Công ty chưa có dòng cài đặt thì BE trả giá trị mặc
định mà không ghi gì, khi đó `updatedById` là `null` và `updatedAt` là `"1970-01-01T00:00:00.000Z"`.

```typescript
export interface RecruitmentSettings {
  replyToEmail: string | null;      // Reply-To khi email ứng viên đi bằng kênh hệ thống (BR-17)
  retentionDaysNoConsent: number;   // ngày giữ dữ liệu khi không đồng ý lưu kho, mặc định 30
  retentionMonthsConsent: number;   // tháng giữ dữ liệu khi đồng ý lưu kho, mặc định 24
  consentTermsVersion: number;      // tăng mỗi lần sửa điều khoản
  consentTermsText: string;         // điều khoản xử lý dữ liệu hiện hành
  careersIntro: string | null;      // giới thiệu trên trang tuyển dụng công khai
  updatedById: number | null;
  updatedAt: string;
}
```

```json
{
  "success": true,
  "data": {
    "replyToEmail": "tuyendung@congty.vn",
    "retentionDaysNoConsent": 30,
    "retentionMonthsConsent": 24,
    "consentTermsVersion": 2,
    "consentTermsText": "Công ty thu thập và xử lý dữ liệu cá nhân của bạn cho mục đích tuyển dụng...",
    "careersIntro": "Chúng tôi đang tìm đồng đội cho nhóm sản phẩm...",
    "updatedById": 1,
    "updatedAt": "2026-11-10T08:00:00.000Z"
  }
}
```

#### PUT `/v1/recruitment/settings`

Sửa cài đặt. Cần `recruitment:manage`. Mọi trường đều tuỳ chọn; trường không gửi giữ nguyên.
`replyToEmail` và `careersIntro` xoá được bằng `null` hoặc chuỗi rỗng.

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| `replyToEmail` | string \| null | Email hợp lệ; `null` hoặc `""` là xoá |
| `retentionDaysNoConsent` | number | Số nguyên 1–3650 |
| `retentionMonthsConsent` | number | Số nguyên 1–120 |
| `consentTermsText` | string | 20–20000 ký tự. Nội dung khác bản cũ thì `consentTermsVersion` tự tăng 1 |
| `careersIntro` | string \| null | Tối đa 5000 ký tự; `null` hoặc `""` là xoá |

Response như `GET`. Sửa điều khoản thì người đang mở form ứng tuyển với phiên bản cũ sẽ nhận 409
`RECRUIT_TERMS_CHANGED` khi nộp, nên báo HR điều này ngay trên màn hình sửa.

---

### Mẫu email, mẫu thư mời

```typescript
export interface RecruitmentTemplate {
  id: number;
  kind: RecruitmentTemplateKind; kindLabel: string;
  purpose: RecruitmentTemplatePurpose; purposeLabel: string;
  name: string;
  subject: string | null;   // mẫu thư mời (OFFER_LETTER) không có tiêu đề
  body: string;             // HTML với mẫu email, chữ thường với thư mời; biến dạng {ten_bien}
  isDefault: boolean;       // mẫu mặc định của mục đích đó
  isActive: boolean;
  createdAt: string; updatedAt: string;
}
```

#### GET `/v1/recruitment/templates?kind=`

Danh sách mẫu, xếp theo loại, mục đích rồi id. Cần `recruitment:read`. `kind` tuỳ chọn (`EMAIL`, `OFFER_LETTER`).
Trả cả mẫu đã ngừng dùng; FE tự lọc `isActive` khi dựng dropdown.

```json
{
  "success": true,
  "data": [
    {
      "id": 3, "kind": "EMAIL", "kindLabel": "Mẫu email",
      "purpose": "INTERVIEW_INVITE", "purposeLabel": "Mời phỏng vấn",
      "name": "Mời phỏng vấn", "subject": "Mời phỏng vấn vị trí {vi_tri}",
      "body": "<p>Chào {ten_ung_vien},</p><p>Mời bạn phỏng vấn lúc {thoi_gian_phong_van}...</p>",
      "isDefault": true, "isActive": true,
      "createdAt": "2026-11-10T08:00:00.000Z", "updatedAt": "2026-11-10T08:00:00.000Z"
    }
  ]
}
```

#### GET `/v1/recruitment/templates/variables`

Biến dùng được theo từng mục đích, khoá là `RecruitmentTemplatePurpose`, giá trị là danh sách tên biến không
có ngoặc. Cần `recruitment:read`. Dùng để dựng nút "Chèn biến" trong trình soạn mẫu.

```json
{
  "success": true,
  "data": {
    "APPLICATION_RECEIVED": ["ten_ung_vien", "ten_cong_ty", "vi_tri"],
    "INTERVIEW_INVITE": ["ten_ung_vien", "ten_cong_ty", "vi_tri", "thoi_gian_phong_van", "hinh_thuc", "dia_diem", "link_hop"],
    "INTERVIEW_RESCHEDULED": ["ten_ung_vien", "ten_cong_ty", "vi_tri", "thoi_gian_phong_van", "hinh_thuc", "dia_diem", "link_hop"],
    "INTERVIEW_CANCELLED": ["ten_ung_vien", "ten_cong_ty", "vi_tri", "thoi_gian_phong_van"],
    "REJECTION": ["ten_ung_vien", "ten_cong_ty", "vi_tri"],
    "OFFER": ["ten_ung_vien", "ten_cong_ty", "vi_tri", "han_phan_hoi", "link_phan_hoi", "nut_phan_hoi_html"],
    "WELCOME": ["ten_ung_vien", "ten_cong_ty", "vi_tri", "ngay_bat_dau"],
    "STAGE_AUTO": ["ten_ung_vien", "ten_cong_ty", "vi_tri", "ten_vong"],
    "CUSTOM": ["ten_ung_vien", "ten_cong_ty", "vi_tri"],
    "OFFER_LETTER": ["ten_ung_vien", "ten_cong_ty", "vi_tri", "phong_ban", "cap_bac", "luong_chinh_thuc", "luong_thu_viec", "so_ngay_thu_viec", "ngay_bat_dau", "ngay_ket_thuc_thu_viec", "han_phan_hoi", "phu_cap", "ma_offer"],
    "SMTP_TEST": ["ten_cong_ty"]
  }
}
```

#### POST `/v1/recruitment/templates`

Tạo mẫu. Cần `recruitment:manage`. Response 201 là `RecruitmentTemplate`.

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| `kind` | `RecruitmentTemplateKind` | Bắt buộc |
| `purpose` | `RecruitmentTemplatePurpose` trừ `SMTP_TEST` | Bắt buộc. `OFFER_LETTER` đi với `kind: 'OFFER_LETTER'` và ngược lại. `SMTP_TEST` là email gửi thử cấu hình SMTP, nội dung cố định nên không tạo mẫu được (400 `BAD_REQUEST`) |
| `name` | string | Bắt buộc, 1–150 ký tự |
| `subject` | string | Tối đa 300 ký tự; bắt buộc với mẫu email |
| `body` | string | Bắt buộc, 1–50000 ký tự |
| `isDefault` | boolean | Mặc định `false`. Đặt `true` thì mẫu mặc định cũ cùng mục đích tự bỏ cờ |
| `isActive` | boolean | Mặc định `true` |

BE kiểm biến trong cả tiêu đề lẫn nội dung theo danh sách của mục đích. Lỗi: 400 `RECRUIT_TEMPLATE_KIND_MISMATCH`,
`RECRUIT_TEMPLATE_SUBJECT_REQUIRED`, `RECRUIT_TEMPLATE_UNKNOWN_VARIABLES` (`message` liệt kê biến sai).

#### PATCH `/v1/recruitment/templates/:id`

Sửa mẫu, không đổi được `kind` và `purpose`. Cần `recruitment:manage`. Nhận `name`, `subject`, `body`,
`isDefault`, `isActive`, đều tuỳ chọn; ngừng dùng bằng `isActive: false`. Lỗi như khi tạo, thêm 404 `NOT_FOUND`.

---

### Nguồn, lý do, tag

```typescript
export interface RecruitmentSource {
  id: number; name: string;
  systemCode: string | null;   // 'CAREERS_PAGE': gán tự động cho hồ sơ tự nộp, không đổi tên hay tắt được
  isActive: boolean; order: number;
}
export interface RecruitmentReason {
  id: number;
  kind: RecruitmentReasonKind; kindLabel: string;
  name: string;
  systemCode: string | null;   // 'OFFER_DECLINED', 'DUPLICATE', 'SPAM': không đổi tên hay tắt được
  isActive: boolean; order: number;
}
export interface RecruitmentTag { id: number; name: string; isActive: boolean }
```

| Route | Cần | Query hoặc body | Ghi chú |
|---|---|---|---|
| `GET /v1/recruitment/sources` | `recruitment:read` | `activeOnly?: boolean` | Xếp theo `order` rồi id |
| `POST /v1/recruitment/sources` | `recruitment:manage` | `{ name (1–100), order?: số nguyên ≥ 0, isActive? }` | 201 |
| `PATCH /v1/recruitment/sources/:id` | `recruitment:manage` | Như trên, đều tuỳ chọn | |
| `GET /v1/recruitment/reasons` | `recruitment:read` | `kind?: RecruitmentReasonKind`, `activeOnly?: boolean` | Xếp theo loại, `order`, id |
| `POST /v1/recruitment/reasons` | `recruitment:manage` | `{ kind, name (1–150), order?, isActive? }` | Tên duy nhất trong cùng `kind` |
| `PATCH /v1/recruitment/reasons/:id` | `recruitment:manage` | `{ name?, order?, isActive? }` | Không đổi được `kind` |
| `GET /v1/recruitment/tags` | `recruitment:read` | `activeOnly?: boolean` | Xếp theo tên |
| `POST /v1/recruitment/tags` | `recruitment:manage` | `{ name (1–50), isActive? }` | |
| `PATCH /v1/recruitment/tags/:id` | `recruitment:manage` | `{ name?, isActive? }` | |

`activeOnly=true` dùng cho dropdown; màn hình cài đặt gọi không có tham số để thấy cả mục đã ngừng dùng. Lỗi: 409
`RECRUIT_CATALOG_NAME_EXISTS` khi trùng tên; 400 `RECRUIT_CATALOG_SYSTEM_ITEM` khi đổi tên hay tắt mục có
`systemCode` (đổi `order` thì được); 404 `NOT_FOUND`. FE nên khoá ô tên và công tắc của mục có `systemCode`.

```json
{ "success": true, "data": [
  { "id": 1, "name": "Trang tuyển dụng công ty", "systemCode": "CAREERS_PAGE", "isActive": true, "order": 0 },
  { "id": 2, "name": "TopCV", "systemCode": null, "isActive": true, "order": 1 }
] }
```

---

### Quy trình mẫu

```typescript
export interface PipelineTemplateStage {
  id: number;
  name: string;                            // tên tự đặt, VD "Phỏng vấn chuyên môn"
  kind: RecruitmentStageKind; kindLabel: string;
  order: number;                           // bắt đầu từ 0, theo vị trí trong mảng đã gửi
  scorecardTemplateId: number | null;
  autoEmailTemplateId: number | null;      // mẫu email tự gửi khi hồ sơ vào vòng
}
export interface PipelineTemplate {
  id: number; name: string;
  isDefault: boolean; isActive: boolean;
  stages: PipelineTemplateStage[];
  createdAt: string; updatedAt: string;
}
export interface StageInput {
  id?: number;                 // chỉ có tác dụng ở PUT /jobs/:id/stages; quy trình mẫu bỏ qua
  name: string;                // 1–100 ký tự
  kind: RecruitmentStageKind;
  scorecardTemplateId?: number;
  autoEmailTemplateId?: number;
}
export interface SavePipelineTemplateBody {
  name: string;                // 1–150 ký tự
  isDefault?: boolean;         // mặc định false
  isActive?: boolean;          // mặc định true
  stages: StageInput[];        // 3–20 vòng
}
```

#### GET `/v1/recruitment/pipeline-templates?activeOnly=`

Danh sách quy trình mẫu, mẫu mặc định đứng đầu. Cần `recruitment:read`.

#### POST `/v1/recruitment/pipeline-templates` · PUT `/v1/recruitment/pipeline-templates/:id`

Tạo (201) hoặc thay toàn bộ (200) một quy trình mẫu. Cần `recruitment:manage`. Body là `SavePipelineTemplateBody`.
PUT xoá hết vòng cũ rồi tạo lại, nên `id` của vòng trong response đổi sau mỗi lần lưu. Tin đã tạo giữ bản sao
riêng nên không bị ảnh hưởng. Đặt `isDefault: true` thì mẫu mặc định cũ tự bỏ cờ.

Luật vòng, sai thì 400 `RECRUIT_PIPELINE_INVALID` với `message` nói rõ luật nào:

- `APPLIED`, `OFFER`, `HIRED` mỗi loại đúng một vòng; `SCREENING`, `TEST`, `INTERVIEW` lặp được.
- Vòng đầu là `APPLIED`, vòng cuối là `HIRED`, và `OFFER` đứng trước `HIRED`.

PUT với id không có thì 404 `NOT_FOUND`.

```json
{
  "success": true,
  "data": {
    "id": 1, "name": "Quy trình Kỹ thuật", "isDefault": true, "isActive": true,
    "stages": [
      { "id": 11, "name": "Ứng tuyển", "kind": "APPLIED", "kindLabel": "Ứng tuyển", "order": 0, "scorecardTemplateId": null, "autoEmailTemplateId": null },
      { "id": 12, "name": "Sơ loại CV", "kind": "SCREENING", "kindLabel": "Sơ loại", "order": 1, "scorecardTemplateId": null, "autoEmailTemplateId": null },
      { "id": 13, "name": "Phỏng vấn chuyên môn", "kind": "INTERVIEW", "kindLabel": "Phỏng vấn", "order": 2, "scorecardTemplateId": 1, "autoEmailTemplateId": null },
      { "id": 14, "name": "Offer", "kind": "OFFER", "kindLabel": "Offer", "order": 3, "scorecardTemplateId": null, "autoEmailTemplateId": null },
      { "id": 15, "name": "Đã tuyển", "kind": "HIRED", "kindLabel": "Đã tuyển", "order": 4, "scorecardTemplateId": null, "autoEmailTemplateId": null }
    ],
    "createdAt": "2026-11-10T08:00:00.000Z", "updatedAt": "2026-11-10T08:00:00.000Z"
  }
}
```

---

### Mẫu đánh giá

```typescript
export interface ScorecardCriterion {
  id: number; name: string; description: string | null;
  weight: number;            // trọng số 1–10 với mẫu phỏng vấn; mẫu thi luôn 1
  maxScore: number | null;   // điểm tối đa, chỉ mẫu thi
  passScore: number | null;  // điểm đạt, chỉ mẫu thi
  order: number;
}
export interface ScorecardTemplate {
  id: number; name: string;
  kind: RecruitmentScorecardKind; kindLabel: string;
  isActive: boolean;
  criteria: ScorecardCriterion[];   // chỉ tiêu chí đang dùng, theo thứ tự
  createdAt: string; updatedAt: string;
}
export interface CriterionInput {
  id?: number;              // giữ id để sửa tiêu chí đang có
  name: string;             // 1–150 ký tự
  description?: string;     // tối đa 1000 ký tự
  weight?: number;          // số nguyên 1–10, chỉ mẫu phỏng vấn, mặc định 1
  maxScore?: number;        // 0,5–1000, bắt buộc với mẫu thi
  passScore?: number;       // 0–1000, không lớn hơn maxScore
}
export interface SaveScorecardTemplateBody {
  name: string;             // 1–150 ký tự
  kind: RecruitmentScorecardKind;
  isActive?: boolean;
  criteria: CriterionInput[];   // 1–30 tiêu chí
}
```

#### GET `/v1/recruitment/scorecard-templates?activeOnly=`

Danh sách mẫu đánh giá. Cần `recruitment:read`. Mẫu phỏng vấn chấm từng tiêu chí 1–5 có trọng số; mẫu thi nhập
điểm từng môn theo điểm tối đa và điểm đạt.

#### POST `/v1/recruitment/scorecard-templates` · PUT `/v1/recruitment/scorecard-templates/:id`

Tạo (201) hoặc thay toàn bộ (200). Cần `recruitment:manage`. Tiêu chí bị bỏ khỏi danh sách thì ngừng dùng chứ
không xoá, vì phiếu cũ còn trỏ tới; response không còn trả tiêu chí đó. Lỗi: 400 `RECRUIT_SCORECARD_KIND_LOCKED`
khi PUT đổi `kind`, `RECRUIT_TEST_MAX_SCORE_REQUIRED`, `RECRUIT_TEST_PASS_SCORE_INVALID`; 404 `NOT_FOUND`.

---

### SMTP công ty (chỉ ADMIN)

SMTP riêng của công ty để email gửi ứng viên đi từ hộp thư của công ty (Q-10, BR-17). Mọi route chỉ nhận
**vai trò `ADMIN`**; vai trò khác nhận 403 `FORBIDDEN` bất kể permission. **Response không bao giờ có mật khẩu**,
kể cả bản đã mã hoá; chỉ có cờ `hasPassword`.

Email ứng viên chỉ đi qua SMTP công ty khi `testStatus` là `SUCCESS`. Lưu cấu hình (kể cả chỉ đổi một trường)
đưa trạng thái về `UNTESTED`, và từ lúc đó email đi bằng kênh hệ thống cho tới khi gửi thử thành công lại.

Máy chủ SMTP chạy chung tiến trình với mọi công ty, nên BE giới hạn chỗ được nối tới:

- Cổng chỉ nhận 25, 465, 587 hoặc 2525. FE nên cho chọn từ danh sách thay vì gõ tự do.
- Host phải là tên miền hoặc IP trên Internet. IP nội bộ (127.x, 10.x, 172.16–31.x, 192.168.x, 169.254.x…), tên
  một nhãn như `redis` hay `localhost`, và tên miền phân giải ra địa chỉ nội bộ đều bị từ chối. BE kiểm lúc lưu,
  lúc gửi thử và lúc gửi thật; lúc gửi thật mà host đã trỏ vào mạng nội bộ thì email đi kênh hệ thống.
- **Đổi `host`, `port`, `security` hoặc `username` thì phải nhập lại mật khẩu**, để mật khẩu đã lưu không bị
  chuyển sang một máy chủ khác. Chỉ đổi tên hiển thị, email người gửi hay Reply-To thì vẫn để trống mật khẩu được.

```typescript
export interface RecruitmentSmtp {
  configured: boolean;            // false: chưa cấu hình, mọi trường dưới là null
  secretKeyConfigured: boolean;   // false: máy chủ thiếu khoá mã hoá, lưu và gửi thử sẽ 503
  host: string | null; port: number | null;
  security: RecruitmentSmtpSecurity | null; securityLabel: string | null;
  username: string | null;
  hasPassword: boolean;
  fromName: string | null; fromEmail: string | null; replyTo: string | null;
  testStatus: RecruitmentSmtpTestStatus | null; testStatusLabel: string | null;
  testedAt: string | null;
  testError: string | null;       // nhóm lỗi của lần gửi thử gần nhất, không phải thông điệp gốc của máy chủ thư
  updatedById: number | null; updatedAt: string | null;
}
export interface SaveSmtpBody {
  host: string;                   // 3–200 ký tự; tên miền hoặc IP trên Internet, không trỏ vào mạng nội bộ
  port: number;                   // 25 | 465 | 587 | 2525
  security: RecruitmentSmtpSecurity;
  username: string;               // 1–200 ký tự
  password?: string;              // 1–500 ký tự; bỏ trống khi sửa thì giữ mật khẩu cũ, trừ khi đổi host, port, security, username
  fromName: string;               // 1–150 ký tự
  fromEmail: string;              // email
  replyTo?: string;               // email; bỏ trống thì xoá
}
```

#### GET `/v1/recruitment/smtp`

```json
{
  "success": true,
  "data": {
    "configured": true, "secretKeyConfigured": true,
    "host": "smtp.gmail.com", "port": 587, "security": "STARTTLS", "securityLabel": "STARTTLS",
    "username": "hr@congty.vn", "hasPassword": true,
    "fromName": "Phòng Nhân sự Công ty A", "fromEmail": "hr@congty.vn", "replyTo": "tuyendung@congty.vn",
    "testStatus": "SUCCESS", "testStatusLabel": "Gửi thử thành công",
    "testedAt": "2026-11-10T08:05:00.000Z", "testError": null,
    "updatedById": 1, "updatedAt": "2026-11-10T08:05:00.000Z"
  }
}
```

Chưa cấu hình thì `configured: false`, `hasPassword: false` và mọi trường còn lại `null`. Khi
`secretKeyConfigured: false`, FE khoá form và báo "Máy chủ chưa cấu hình khoá mã hoá, hãy báo quản trị hệ thống";
email ứng viên vẫn đi bằng kênh hệ thống.

#### PUT `/v1/recruitment/smtp`

Lưu cấu hình, thay toàn bộ. Body là `SaveSmtpBody`. Ô mật khẩu trên form để trống và chỉ gửi khi người dùng gõ
mật khẩu mới; khi người dùng sửa `host`, `port`, `security` hoặc `username` so với cấu hình đang lưu thì FE đánh
dấu ô mật khẩu là bắt buộc.

Lỗi:

| HTTP | Mã | Khi nào |
|---|---|---|
| 400 | `RECRUIT_SMTP_PASSWORD_REQUIRED` | Lần đầu cấu hình mà không có mật khẩu, hoặc đổi `host`, `port`, `security`, `username` mà không nhập lại mật khẩu |
| 400 | `RECRUIT_SMTP_HOST_NOT_ALLOWED` | Host trỏ vào mạng nội bộ (IP nội bộ, tên một nhãn, tên miền phân giải ra địa chỉ nội bộ) |
| 400 | `BAD_REQUEST` | Cổng ngoài 25, 465, 587, 2525, hoặc trường khác sai dạng |
| 503 | `RECRUIT_SECRET_KEY_NOT_CONFIGURED` | Máy chủ thiếu khoá mà có gửi mật khẩu |

Tên miền chưa phân giải được (gõ sai, DNS tạm lỗi) vẫn lưu được; gửi thử sẽ báo lỗi kết nối.

#### POST `/v1/recruitment/smtp/test`

Gửi thử **đồng bộ** tới `{ to: string }` (email). Response 201 là cấu hình mới. **Gửi thử thất bại không phải
lỗi HTTP**: BE vẫn trả 201 với `testStatus: 'FAILED'`, nên FE đọc `testStatus` để báo kết quả. Lỗi HTTP: 404
`RECRUIT_SMTP_NOT_CONFIGURED`, 503 `RECRUIT_SECRET_KEY_NOT_CONFIGURED`. Request có thể mất vài giây vì chờ máy chủ
thư trả lời.

`testError` chỉ là một trong các câu sau, không chép thông điệp gốc của máy chủ thư (thông điệp đó có thể lộ địa
chỉ IP và dòng chào của dịch vụ ở đầu bên kia). FE hiện nguyên câu:

| Nhóm | `testError` |
|---|---|
| Sai tài khoản | Máy chủ SMTP từ chối tài khoản hoặc mật khẩu |
| Lỗi TLS | Không thiết lập được kết nối bảo mật với máy chủ SMTP, kiểm tra cổng và kiểu bảo mật |
| Máy chủ từ chối thư | Máy chủ SMTP từ chối email gửi thử, kiểm tra email người gửi |
| Host trỏ vào mạng nội bộ | Máy chủ SMTP trỏ vào mạng nội bộ, không được phép |
| Còn lại (không phân giải, không nối được, hết giờ) | Không kết nối được máy chủ SMTP, kiểm tra tên máy chủ, cổng và kiểu bảo mật |

#### DELETE `/v1/recruitment/smtp`

Xoá cấu hình, email ứng viên quay về kênh hệ thống. Response 204.

---

### Định biên

```typescript
export interface HeadcountRow {
  id: number;
  year: number;
  department: RecruitNamedRef;           // lấy theo vị trí
  position: RecruitNamedRef;
  confirmedQuantity: number | null;      // null = chưa từng chốt, còn trống tính là 0
  confirmedAt: string | null; confirmedById: number | null;
  current: number;                       // nhân viên đang có ở vị trí (BR-01)
  recruiting: number;                    // chỉ tiêu của các yêu cầu đang mở cùng năm
  available: number;                     // = chốt − đang có − đang tuyển; có thể âm
  overCommitted: boolean;                // available < 0: định biên bị giảm dưới số đang dùng
  requisitionCount: number;              // yêu cầu tuyển chưa kết thúc của (năm, vị trí): kể cả nháp, bị từ chối;
                                         // không tính Đã huỷ, Đã đủ, đã xoá (khác `recruiting`, chỉ tính chỉ tiêu
                                         // của yêu cầu đã gửi). Dòng đã chốt có current > 0 hoặc số này > 0 là
                                         // đang dùng: xoá phải kèm reason
  proposedQuantity: number | null;       // đề xuất đang mở
  proposalStatus: RecruitmentProposalStatus | null; proposalStatusLabel: string | null;
  proposalNote: string | null;
  proposedById: number | null; proposedAt: string | null;
  rejectReason: string | null;           // lý do lần trả lại gần nhất
  note: string | null;
  status: HeadcountRowStatus; statusLabel: string;   // xem mục "Luồng trạng thái"
  createdAt: string; updatedAt: string;
}
export interface HeadcountChange {
  id: number; planId: number;
  type: RecruitmentHeadcountChangeType; typeLabel: string;
  fromQuantity: number | null; toQuantity: number | null;
  note: string | null;
  actor: RecruitPersonRef | null;        // null = hệ thống
  createdAt: string;
}
```

"Đang có" là nhân viên đang làm hoặc đang nghỉ phép ở đúng phòng và vị trí của dòng, trừ người đang được thay
trong một yêu cầu thay thế còn mở, cộng offer đã đồng ý mà chưa thành nhân viên. "Đang tuyển" là phần còn thiếu
của các yêu cầu `PENDING`, `APPROVED`, `RECRUITING` cùng năm và vị trí. BE tính khi đọc, không lưu.

#### GET `/v1/recruitment/headcount-plans?year=&departmentId=`

Định biên của một năm, mảng không phân trang, xếp theo id phòng rồi id vị trí. Cần `recruitment:read` + phạm vi.
`year` bắt buộc (2000–2100); `departmentId` tuỳ chọn, ngoài phạm vi thì 403 `RECRUIT_SCOPE_FORBIDDEN`. MANAGER
chỉ nhận dòng của phòng mình.

```json
{
  "success": true,
  "data": [
    {
      "id": 1, "year": 2026,
      "department": { "id": 3, "name": "Phòng Kỹ thuật" },
      "position": { "id": 7, "name": "Lập trình viên backend" },
      "confirmedQuantity": 5, "confirmedAt": "2026-01-05T03:00:00.000Z", "confirmedById": 4,
      "current": 3, "recruiting": 1, "available": 1, "overCommitted": false,
      "proposedQuantity": 6, "proposalStatus": "PENDING", "proposalStatusLabel": "Chờ chốt",
      "proposalNote": "Thêm 1 người cho dự án mới", "proposedById": 5, "proposedAt": "2026-11-09T03:00:00.000Z",
      "rejectReason": null, "note": null,
      "status": "CONFIRMED", "statusLabel": "Đã chốt",
      "createdAt": "2026-01-03T03:00:00.000Z", "updatedAt": "2026-11-09T03:00:00.000Z"
    }
  ]
}
```

#### POST `/v1/recruitment/headcount-plans`

Tạo dòng định biên cho (năm, vị trí). Decorator chỉ đòi `recruitment:read`, còn service đòi `recruitment:manage`
hoặc `recruitment:headcount:confirm`; thiếu cả hai thì 403 `RECRUIT_HEADCOUNT_FORBIDDEN`. Người có quyền chốt
(DIRECTOR, CHIEF, ADMIN) tạo thì **chốt luôn**; người chỉ có `recruitment:manage` (HR) tạo thì thành **đề xuất
Nháp** chờ gửi.

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| `year` | number | Bắt buộc, 2000–2100 |
| `positionId` | number | Bắt buộc; phòng ban lấy theo vị trí |
| `quantity` | number | Bắt buộc, số nguyên 0–10000 |
| `note` | string | Tối đa 2000 ký tự |

Response 201 là `HeadcountRow`. Lỗi: 400 `RECRUIT_POSITION_INVALID`; 403 `RECRUIT_HEADCOUNT_FORBIDDEN`; 409
`RECRUIT_HEADCOUNT_EXISTS` khi đã có dòng cho vị trí đó trong năm (sửa dòng đang có thay vì tạo mới).

#### PATCH `/v1/recruitment/headcount-plans/:id/proposal`

Mở hoặc ghi đè đề xuất của một dòng, đưa đề xuất về `DRAFT`. Cần `recruitment:manage`. Body
`{ quantity: number (0–10000), note?: string (≤ 2000) }`. Số đã chốt giữ nguyên hiệu lực. Response là
`HeadcountRow`. Lỗi: 403 `RECRUIT_HEADCOUNT_FORBIDDEN`; 404 `NOT_FOUND`; 409 `RECRUIT_HEADCOUNT_PENDING` khi đề
xuất đang chờ chốt.

#### POST `/v1/recruitment/headcount-plans/submit`

Gửi các đề xuất `DRAFT` hoặc `REJECTED` cho người chốt, chuyển sang `PENDING` và gửi N-15 (mỗi năm một thông báo).
Cần `recruitment:manage`. Body `{ ids: number[] }` (1–500 phần tử). Response 201 là mảng `HeadcountRow` của các
id đã gửi. Lỗi: 403 `RECRUIT_HEADCOUNT_FORBIDDEN`; 404 `NOT_FOUND` khi có id không tồn tại; 409
`RECRUIT_HEADCOUNT_NOT_DRAFT` khi có dòng không có gì để gửi (cả lô không đổi gì).

#### POST `/v1/recruitment/headcount-plans/confirm`

Chốt hàng loạt: số đề xuất thành số đã chốt, đề xuất bị xoá, người đề xuất nhận N-16. Cần
`recruitment:headcount:confirm`. Body `{ ids: number[], reason?: string }`; `reason` ở đây là ghi chú lưu vào
lịch sử. Chốt được đề xuất `PENDING` và cả `DRAFT` (người chốt không phải chờ HR gửi). Response 201 là mảng
`HeadcountRow`. Lỗi: 403 `RECRUIT_HEADCOUNT_CONFIRM_FORBIDDEN`; 404 `NOT_FOUND`; 409
`RECRUIT_HEADCOUNT_NOTHING_TO_CONFIRM`.

#### POST `/v1/recruitment/headcount-plans/reject`

Trả lại các đề xuất `PENDING`, số đã chốt cũ giữ hiệu lực, người đề xuất nhận N-16. Cần
`recruitment:headcount:confirm`. Body `{ ids: number[], reason: string }`; thiếu `reason` thì 400
`RECRUIT_REASON_REQUIRED`. Response 201 là mảng `HeadcountRow` với `proposalStatus: 'REJECTED'` và `rejectReason`.
Lỗi khác: 403 `RECRUIT_HEADCOUNT_CONFIRM_FORBIDDEN`; 404 `NOT_FOUND`; 409 `RECRUIT_HEADCOUNT_NOT_PENDING`.

#### PATCH `/v1/recruitment/headcount-plans/:id/confirmed`

Người có quyền chốt sửa thẳng số đã chốt, ghi lịch sử `EDITED`. Body `{ quantity, note? }` như đề xuất. Đề xuất
đang mở của dòng không bị đụng tới. Lỗi: 403 `RECRUIT_HEADCOUNT_CONFIRM_FORBIDDEN`; 404 `NOT_FOUND`. Giảm số đã
chốt dưới số đang dùng thì dòng có `overCommitted: true`, FE tô cảnh báo. Yêu cầu đã duyệt **không bị huỷ**; chỉ
yêu cầu gửi mới và các bước duyệt còn chờ bị chặn theo số mới.

#### DELETE `/v1/recruitment/headcount-plans/:id/proposal`

Rút đề xuất `DRAFT` hoặc `REJECTED` của một dòng **đã chốt**: xoá số đề xuất, ghi chú và lý do trả lại, số đã chốt
giữ nguyên, ghi lịch sử `WITHDRAWN` (`fromQuantity` = số đã chốt, `toQuantity` = số vừa rút). Khi hiện lịch sử,
đừng vẽ dòng `WITHDRAWN` thành "`from` → `to`" như các loại khác, vì người đọc sẽ hiểu là định biên vừa tăng; web
hiện thành câu "bỏ đề xuất 5, giữ số đã chốt 3", mobile nên làm giống. Không có body. Cần
`recruitment:manage` hoặc `recruitment:headcount:confirm`. Không gửi thông báo, vì chưa ai phải xử lý đề xuất đó.
Response 200 là `HeadcountRow`.

Lỗi: 403 `RECRUIT_HEADCOUNT_FORBIDDEN`; 404 `NOT_FOUND`; 409 `RECRUIT_HEADCOUNT_PENDING` (đang chờ chốt),
`RECRUIT_HEADCOUNT_NEVER_CONFIRMED` (dòng chưa từng chốt, dùng `DELETE /:id`),
`RECRUIT_HEADCOUNT_NOTHING_TO_WITHDRAW` (không có đề xuất).

#### DELETE `/v1/recruitment/headcount-plans/:id`

Xoá hẳn dòng định biên cùng lịch sử, response 204 không có body. Điều kiện ở mục "Luồng trạng thái → Định biên".
Xoá xong thì tạo lại được dòng cùng (năm, vị trí).

Body (JSON, tuỳ chọn): `{ reason?: string }`, cắt khoảng trắng hai đầu, tối đa 2000 ký tự. Bắt buộc khi dòng đã
chốt đang dùng; dòng khác gửi kèm thì cũng được lưu vào nhật ký.

Lỗi: 400 `RECRUIT_REASON_REQUIRED` (dòng đang dùng mà thiếu lý do, hoặc lý do chỉ có khoảng trắng); 400 validate
(lý do quá 2000 ký tự); 403 `RECRUIT_HEADCOUNT_FORBIDDEN` (không có `recruitment:manage` lẫn quyền chốt),
`RECRUIT_HEADCOUNT_CONFIRM_FORBIDDEN` (dòng đã chốt, người gọi không có quyền chốt); 404 `NOT_FOUND`; 409
`RECRUIT_HEADCOUNT_PENDING`.

```json
{ "success": false, "error": { "code": "RECRUIT_REASON_REQUIRED",
  "message": "Backend Developer năm 2026 đang có 5 người và 2 yêu cầu tuyển. Xoá dòng đang dùng phải nhập lý do." } }
```

Vế nào bằng 0 thì bị bỏ khỏi câu, ví dụ "Designer năm 2026 đang có 1 yêu cầu tuyển. …".

Gợi ý FE: nút Xoá chỉ hiện khi `proposalStatus !== 'PENDING'`, và với dòng đã chốt chỉ hiện cho người có quyền
chốt. Bấm Xoá mở **một** hộp duy nhất: dòng đã chốt đang dùng (`current > 0 || requisitionCount > 0`) thì là
hộp cảnh báo nêu số người, số yêu cầu và hậu quả ở trên, có ô lý do bắt buộc; dòng khác thì là hộp xác nhận
thường. 400 `RECRUIT_REASON_REQUIRED` chỉ còn xảy ra khi dữ liệu trên màn đã cũ (vừa có yêu cầu mới), FE hiện
`message` và tải lại bảng.

#### GET `/v1/recruitment/headcount-plans/:id/changes`

Lịch sử thay đổi của dòng, mới nhất trước, mảng `HeadcountChange`. Cần `recruitment:read` + phạm vi.

```json
{ "success": true, "data": [
  { "id": 10, "planId": 1, "type": "CONFIRMED", "typeLabel": "Chốt", "fromQuantity": 4, "toQuantity": 5, "note": null,
    "actor": { "id": 4, "fullName": "Phạm Văn Giám Đốc" }, "createdAt": "2026-01-05T03:00:00.000Z" }
] }
```

---

### Yêu cầu tuyển dụng

```typescript
export interface Requisition {
  id: number;
  code: string;                           // YCTD-2026-0007
  year: number;                           // năm định biên áp dụng: năm của neededBy, trống thì năm tạo
  department: RecruitNamedRef; position: RecruitNamedRef;
  quantity: number;
  reason: RecruitmentRequisitionReason; reasonLabel: string;
  replacedEmployee: RecruitEmployeeRef | null;   // có khi reason = REPLACEMENT
  employmentType: RequisitionEmploymentType; employmentTypeLabel: string;
  salaryMin: number | null; salaryMax: number | null;   // null khi canViewSalary = false hoặc chưa nhập
  neededBy: string | null;
  jobDescription: string | null; requirements: string | null;
  hasJdFile: boolean; jdFileName: string | null;        // không có URL, lấy qua GET .../jd-url
  note: string | null;
  status: RecruitmentRequisitionStatus; statusLabel: string;
  round: number;                          // lần gửi duyệt hiện tại; 0 = chưa gửi
  submittedAt: string | null; approvedAt: string | null;
  rejectReason: string | null;
  cancelledAt: string | null; cancelReason: string | null;
  createdBy: RecruitPersonRef;
  createdAt: string; updatedAt: string;
  jobs: { id: number; code: string; title: string; status: RecruitmentJobStatus; statusLabel: string }[];
  approvalSteps: RecruitApprovalStep[];   // mọi bước của mọi lần gửi, theo vòng rồi theo cấp
  hiredCount: number;                     // số offer Đồng ý thuộc các tin của yêu cầu (BR-12)
  available: number | null;               // còn trống hiện tại, không tính chính yêu cầu này; danh sách trả null
  canViewSalary: boolean;
  canApprove: boolean;
}
export interface Availability {
  confirmed: number | null;   // định biên Đã chốt; null = chưa chốt, chưa gửi được yêu cầu
  current: number; recruiting: number;
  available: number;          // có thể âm
}
export interface CreateRequisitionBody {
  positionId: number;
  quantity: number;                      // số nguyên 1–1000
  reason: RecruitmentRequisitionReason;
  replacedEmployeeId?: number;           // bắt buộc khi reason = REPLACEMENT
  employmentType: RequisitionEmploymentType;
  salaryMin?: number; salaryMax?: number;   // số nguyên ≥ 0, salaryMin ≤ salaryMax; trống salaryMax thì mọi offer vượt khung
  neededBy?: string;                     // YYYY-MM-DD, quyết định năm định biên
  jobDescription?: string;               // ≤ 20000 ký tự
  requirements?: string;                 // ≤ 20000 ký tự
  note?: string;                         // ≤ 5000 ký tự
}
```

#### GET `/v1/recruitment/requisitions`

Danh sách có phân trang, mới nhất trước. Cần `recruitment:read` + phạm vi; MANAGER thấy yêu cầu của phòng mình và
yêu cầu mình tạo. Query: `status`, `departmentId`, `positionId`, `year`, `search` (tìm trong mã), `page`, `limit`.
Mỗi phần tử là `Requisition` với `available: null`.

#### GET `/v1/recruitment/requisitions/availability?positionId=&year=&excludeId=`

Còn trống của (vị trí, năm) để form hiện ngay "Còn trống X". Cần `recruitment:read` + phạm vi theo phòng của
vị trí. `positionId`, `year` bắt buộc; `excludeId` là id yêu cầu đang sửa, để không tự trừ chính nó. Khi tạo mới,
`year` là năm của ngày cần có người, hoặc năm nay nếu chưa chọn ngày.

```json
{ "success": true, "data": { "confirmed": 5, "current": 3, "recruiting": 1, "available": 1 } }
```

Lỗi: 403 `RECRUIT_SCOPE_FORBIDDEN`; 404 `NOT_FOUND` khi không có vị trí. `confirmed: null` thì FE báo "Vị trí
chưa có định biên Đã chốt năm X" và khoá nút Gửi duyệt. Với lý do Thay thế, lúc gửi BE không tính người được thay
vào "đang có", nên số còn trống thật khi gửi có thể lớn hơn số form đang hiện một người.

#### GET `/v1/recruitment/requisitions/:id`

Chi tiết `Requisition`, có `available` và mọi bước duyệt. Cần `recruitment:read`, và người gọi phải trong phạm
vi, là người tạo, hoặc là người duyệt. Lỗi: 403 `RECRUIT_SCOPE_FORBIDDEN`; 404 `RECRUIT_REQUISITION_NOT_FOUND`.

```json
{
  "success": true,
  "data": {
    "id": 4, "code": "YCTD-2026-0007", "year": 2026,
    "department": { "id": 3, "name": "Phòng Kỹ thuật" },
    "position": { "id": 7, "name": "Lập trình viên backend" },
    "quantity": 1, "reason": "REPLACEMENT", "reasonLabel": "Thay thế",
    "replacedEmployee": { "id": 12, "fullName": "Nguyễn Văn A", "employeeCode": "NV012" },
    "employmentType": "FULL_TIME", "employmentTypeLabel": "Nhân viên chính thức",
    "salaryMin": 18000000, "salaryMax": 25000000,
    "neededBy": "2026-12-15",
    "jobDescription": "Phát triển API cho hệ thống nội bộ...", "requirements": "2 năm NestJS...",
    "hasJdFile": true, "jdFileName": "JD-backend.pdf",
    "note": null,
    "status": "PENDING", "statusLabel": "Chờ duyệt",
    "round": 1, "submittedAt": "2026-11-10T02:00:00.000Z", "approvedAt": null,
    "rejectReason": null, "cancelledAt": null, "cancelReason": null,
    "createdBy": { "id": 9, "fullName": "Lê Văn Trưởng" },
    "createdAt": "2026-11-09T08:00:00.000Z", "updatedAt": "2026-11-10T02:00:00.000Z",
    "jobs": [],
    "approvalSteps": [
      { "id": 21, "round": 1, "level": 1, "basis": "DIRECTOR_FALLBACK",
        "basisLabel": "Giám đốc (phòng không có trưởng phòng hoặc trưởng phòng là người tạo)",
        "approver": null, "approverRole": "DIRECTOR", "approverRoleLabel": "Giám đốc",
        "status": "PENDING", "statusLabel": "Chờ duyệt", "decidedBy": null, "decidedAt": null, "note": null },
      { "id": 22, "round": 1, "level": 2, "basis": "HR", "basisLabel": "Nhân sự",
        "approver": null, "approverRole": "HR", "approverRoleLabel": "Nhân sự",
        "status": "WAITING", "statusLabel": "Chưa tới lượt", "decidedBy": null, "decidedAt": null, "note": null }
    ],
    "hiredCount": 0, "available": 1,
    "canViewSalary": true, "canApprove": false
  }
}
```

#### GET `/v1/recruitment/requisitions/:id/jd-url`

`{ url: string | null }`, presigned URL hết hạn sau 10 phút; `null` khi chưa có file. Cùng điều kiện xem như chi
tiết.

#### POST `/v1/recruitment/requisitions`

Tạo yêu cầu ở trạng thái `DRAFT`, mã sinh tự động. Cần `recruitment:requisition:create`; người không có
`recruitment:manage` chỉ tạo cho phòng trong phạm vi của mình (403 `RECRUIT_SCOPE_FORBIDDEN`). Body là
`CreateRequisitionBody`. Response 201 là `Requisition` đầy đủ.

Lỗi: 400 `RECRUIT_POSITION_INVALID`, `RECRUIT_SALARY_RANGE_INVALID`, `RECRUIT_REPLACED_EMPLOYEE_REQUIRED` (thiếu
hoặc không tìm thấy nhân viên được thay), `RECRUIT_REPLACED_EMPLOYEE_POSITION` (nhân viên được thay còn làm mà
không ở đúng phòng và vị trí); 403 `RECRUIT_SCOPE_FORBIDDEN`; 409 `RECRUIT_REPLACED_EMPLOYEE_TAKEN` (nhân viên đó
đã nằm trong một yêu cầu thay thế khác đang mở, `message` có mã yêu cầu kia).

#### PATCH `/v1/recruitment/requisitions/:id`

Sửa yêu cầu `DRAFT` hoặc `REJECTED`. Cần `recruitment:requisition:create`, và phải là người tạo hoặc có
`recruitment:manage` (403 `RECRUIT_SCOPE_FORBIDDEN`). Body như tạo, mọi trường tuỳ chọn; đổi `neededBy` thì `year`
tính lại. Lỗi như tạo, thêm 404 `RECRUIT_REQUISITION_NOT_FOUND` và 409 `RECRUIT_REQUISITION_LOCKED`.

#### POST `/v1/recruitment/requisitions/:id/jd`

Tải file JD, thay file cũ. `multipart/form-data`, trường **`file`**, PDF hoặc DOCX tối đa 5 MB. Cùng điều kiện như
sửa, riêng người có `recruitment:manage` tải được ở mọi trạng thái. Response 201 là `Requisition` với
`hasJdFile: true`. Lỗi: 400 `RECRUIT_FILE_REQUIRED`, `RECRUIT_FILE_TOO_LARGE`, `RECRUIT_FILE_TYPE_INVALID`; 409
`RECRUIT_REQUISITION_LOCKED`.

#### POST `/v1/recruitment/requisitions/:id/submit`

Gửi duyệt, không có body. Cần `recruitment:requisition:create`, và là người tạo hoặc có `recruitment:manage`. BE
kiểm định biên (BR-01), dựng bước duyệt theo mục "Luồng duyệt", tăng `round`, chuyển `PENDING` và gửi N-01 cho
người duyệt bước 1. Response 201 là `Requisition`.

Lỗi: 409 `RECRUIT_REQUISITION_LOCKED` (không ở `DRAFT`, `REJECTED`, vừa có người gửi, hoặc yêu cầu vừa bị sửa
trong lúc gửi: FE tải lại rồi cho bấm lại);
`RECRUIT_HEADCOUNT_NOT_CONFIRMED` (vị trí chưa có định biên Đã chốt của năm); `RECRUIT_HEADCOUNT_EXCEEDED`
(`quantity` lớn hơn số còn trống, số còn trống chỉ có trong `message`).

```json
{ "success": false, "error": { "code": "RECRUIT_HEADCOUNT_EXCEEDED",
  "message": "Định biên còn trống 1, yêu cầu xin 2. Hãy giảm số lượng, hoặc đề xuất tăng định biên để Giám đốc chốt." } }
```

`message` luôn bắt đầu bằng "Định biên còn trống X, yêu cầu xin Y." rồi mới tới câu gợi ý. FE không cần tách
số từ chuỗi: `Requisition.available` đã có số còn trống (chưa tính chính yêu cầu), so với `quantity` là biết trước
có bị chặn hay không.

#### POST `/v1/recruitment/requisitions/:id/approve`

Duyệt bước đang chờ. Cần `recruitment:read`; service kiểm người gọi là người duyệt đến lượt hoặc `ADMIN`. Body
`{ note?: string }` (1–2000 ký tự). **Mọi bước** kiểm lại định biên, vì định biên có thể đã giảm từ lúc gửi; vượt
thì 409 `RECRUIT_HEADCOUNT_EXCEEDED`, bước giữ nguyên chờ, `message` gợi ý người duyệt từ chối kèm lý do hoặc đề
xuất tăng định biên. Qua ở bước cuối thì yêu cầu thành `APPROVED` và gửi N-02. Bước chưa cuối thì mở bước kế và
gửi N-01 cho người duyệt kế. Response 201 là `Requisition`. Hộp duyệt trả sẵn
`requisition.headcountAvailable`, nên FE cảnh báo được trước khi người duyệt bấm.

Lỗi: 403 `RECRUIT_APPROVAL_NOT_YOUR_TURN`; 404 `RECRUIT_REQUISITION_NOT_FOUND`; 409 `RECRUIT_APPROVAL_NOT_PENDING`
(không chờ duyệt, hoặc người khác vừa quyết), `RECRUIT_HEADCOUNT_NOT_CONFIRMED`, `RECRUIT_HEADCOUNT_EXCEEDED`.

#### POST `/v1/recruitment/requisitions/:id/reject`

Từ chối bước đang chờ. Body **`{ note: string }`** là lý do, bắt buộc (400 `RECRUIT_REASON_REQUIRED`); chú ý tên
trường là `note`, không phải `reason`. Yêu cầu thành `REJECTED`, `rejectReason` là lý do, người tạo và HR nhận
N-02. Người tạo sửa rồi gửi lại thì thành vòng mới. Lỗi khác như duyệt.

#### POST `/v1/recruitment/requisitions/:id/cancel`

Huỷ yêu cầu. Cần `recruitment:requisition:create`, và là người tạo hoặc có `recruitment:manage`. Body
**`{ reason: string }`** (1–2000 ký tự), bắt buộc. Huỷ được ở mọi trạng thái trừ `CANCELLED` và `FILLED`, nhưng
còn tin `OPEN` thì phải đóng tin trước (tin `PAUSED` không chặn). Response 201 là `Requisition`. Lỗi: 409
`RECRUIT_REQUISITION_LOCKED`, `RECRUIT_REQUISITION_HAS_OPEN_JOB`.

#### DELETE `/v1/recruitment/requisitions/:id`

Xoá mềm yêu cầu `DRAFT`, mã không cấp lại. Cùng điều kiện như huỷ. Response 204. Yêu cầu không phải Nháp thì 409
`RECRUIT_REQUISITION_LOCKED`; FE dùng nút Huỷ thay thế.

---

### Việc chờ duyệt

```typescript
export interface RecruitInboxItem {
  type: RecruitmentApprovalTarget; typeLabel: string;
  stepId: number; level: number;
  basis: RecruitmentApprovalBasis; basisLabel: string;
  waitingSince: string;
  requisition: {
    id: number; code: string;
    department: RecruitNamedRef; position: RecruitNamedRef;
    quantity: number;
    reason: RecruitmentRequisitionReason; reasonLabel: string;
    status: RecruitmentRequisitionStatus; statusLabel: string;
    createdBy: RecruitPersonRef;
    submittedAt: string | null;
    headcountAvailable: number;               // còn trống lúc này, chưa tính chính yêu cầu; có thể âm.
                                              // < quantity thì bấm duyệt sẽ nhận 409 RECRUIT_HEADCOUNT_EXCEEDED
  } | null;                                   // có khi type = REQUISITION
  offer: {
    id: number; code: string; version: number;
    candidateName: string; positionName: string;
    overBand: boolean;                        // vượt khung lương (BR-10)
    baseSalary: number;                       // người duyệt luôn xem được
    status: RecruitmentOfferStatus; statusLabel: string;
  } | null;                                   // có khi type = OFFER
}
export interface RecruitInboxCounts { requisitions: number; offers: number; headcount: number }
export interface RecruitInbox {
  items: RecruitInboxItem[];
  headcountPending: { year: number; count: number }[];   // đề xuất định biên chờ chốt, gom theo năm
  counts: RecruitInboxCounts;
}
```

#### GET `/v1/recruitment/approvals?type=`

Việc đang chờ chính người gọi duyệt, cũ nhất trước. Cần `recruitment:read` và vai trò trang quản lý. `type` tuỳ
chọn (`REQUISITION`, `OFFER`). Không lọc `type` và người gọi có quyền chốt định biên thì có thêm
`headcountPending`; có lọc thì mảng này rỗng. `ADMIN` thấy mọi bước đang chờ của công ty. Bấm một dòng thì mở
`/management/recruitment/requisitions/:id` hoặc `/management/recruitment/offers/:id`; dòng định biên mở
`/management/recruitment/headcount?year=`.

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "type": "REQUISITION", "typeLabel": "Yêu cầu tuyển dụng",
        "stepId": 21, "level": 1, "basis": "DEPARTMENT_MANAGER", "basisLabel": "Trưởng phòng",
        "waitingSince": "2026-11-10T02:00:00.000Z",
        "requisition": {
          "id": 4, "code": "YCTD-2026-0007",
          "department": { "id": 3, "name": "Phòng Kỹ thuật" },
          "position": { "id": 7, "name": "Lập trình viên backend" },
          "quantity": 1, "reason": "ADDITIONAL", "reasonLabel": "Bổ sung",
          "status": "PENDING", "statusLabel": "Chờ duyệt",
          "createdBy": { "id": 5, "fullName": "Trần Thị HR" },
          "submittedAt": "2026-11-10T02:00:00.000Z"
        },
        "offer": null
      }
    ],
    "headcountPending": [{ "year": 2027, "count": 4 }],
    "counts": { "requisitions": 1, "offers": 0, "headcount": 4 }
  }
}
```

#### GET `/v1/recruitment/approvals/counts`

Chỉ phần `counts` (`RecruitInboxCounts`) cho badge menu. `headcount` chỉ khác 0 với người có quyền chốt định
biên. Số này chưa nằm trong `/v1/approval/counts` dùng chung của hệ thống.

---

### Tin tuyển dụng

```typescript
export interface RecruitmentJobStage {
  id: number; name: string;
  kind: RecruitmentStageKind; kindLabel: string;
  order: number;                                  // bắt đầu từ 0
  scorecardTemplate: RecruitNamedRef | null;
  autoEmailTemplate: RecruitNamedRef | null;      // mẫu email tự gửi khi hồ sơ vào vòng
  activeCount: number;                            // số hồ sơ đang xét ở vòng
}
export interface RecruitmentTeamMember {
  id: number;
  employee: RecruitPersonRef;
  role: SystemRole; roleLabel: string;            // vai trò hệ thống của thành viên
  canViewOffer: boolean;                          // xem lương mong muốn và offer của tin này
  notifyNewApplications: boolean;                 // nhận N-03
  addedById: number | null;
  createdAt: string;
}
export interface RecruitmentJob {
  id: number;
  code: string;                                   // TD-2026-0012
  title: string;
  locations: string[];
  salaryText: string | null;                      // lương hiển thị cho ứng viên
  description: string; requirements: string | null; benefits: string | null;
  deadline: string | null;                        // hạn nộp hồ sơ
  visibility: RecruitmentJobVisibility; visibilityLabel: string;
  status: RecruitmentJobStatus; statusLabel: string;
  budget: number | null; actualCost: number | null;   // tiền, dùng cho báo cáo chi phí RP-05
  slug: string;
  publicPath: string;                             // '/careers/<mã công ty>/<slug>', ghép với domain FE
  openedAt: string | null; closedAt: string | null;
  closedReason: 'MANUAL' | 'DEADLINE' | null;
  requisition: {
    id: number; code: string;
    status: RecruitmentRequisitionStatus; statusLabel: string;
    quantity: number;
    employmentType: RequisitionEmploymentType; employmentTypeLabel: string;
    salaryMin: number | null; salaryMax: number | null;   // null khi canViewSalary = false
    department: RecruitNamedRef; position: RecruitNamedRef;
  };
  owner: RecruitPersonRef;                        // HR phụ trách tin
  stages: RecruitmentJobStage[];
  activeApplicationCount: number;
  team: RecruitmentTeamMember[];
  canViewSalary: boolean;
  createdById: number;
  createdAt: string; updatedAt: string;
}
export interface CreateJobBody {
  requisitionId: number;                 // yêu cầu APPROVED hoặc RECRUITING
  pipelineTemplateId?: number;           // trống thì lấy quy trình mẫu mặc định
  title?: string;                        // 2–200 ký tự; trống thì lấy tên vị trí
  locations?: string[];                  // tối đa 10, mỗi mục ≤ 100 ký tự
  salaryText?: string;                   // ≤ 100 ký tự
  description?: string;                  // ≤ 50000; trống thì lấy JD của yêu cầu, cả hai trống thì 400
  requirements?: string;                 // ≤ 50000; trống thì lấy của yêu cầu
  benefits?: string;                     // ≤ 50000
  deadline?: string;                     // YYYY-MM-DD
  visibility?: RecruitmentJobVisibility; // mặc định PUBLIC
  ownerId?: number;                      // trống thì là người tạo
  budget?: number; actualCost?: number;  // số nguyên ≥ 0
  slug?: string;                         // chữ thường không dấu, số, gạch ngang, ≤ 80 ký tự; trống thì sinh từ tiêu đề
}
export type UpdateJobBody = Partial<Omit<CreateJobBody, 'requisitionId' | 'pipelineTemplateId'>>;
```

#### GET `/v1/recruitment/jobs`

Danh sách có phân trang, mỗi phần tử là `RecruitmentJob`. Cần `recruitment:read` + phạm vi (phòng mình và tin mình
ngồi hội đồng). Query: `status`, `requisitionId`, `departmentId`, `search`, `page`, `limit`. Ở danh sách,
`canViewSalary` chỉ `true` với người xem mọi lương; mở chi tiết để thành viên hội đồng có `canViewOffer` thấy khung
lương.

#### POST `/v1/recruitment/jobs`

Tạo tin `DRAFT` từ một yêu cầu `APPROVED` hoặc `RECRUITING`. Cần `recruitment:manage`. Body là `CreateJobBody`.
BE sao chép các vòng của quy trình mẫu vào tin, và tự thêm trưởng phòng của phòng tuyển vào hội đồng với
`notifyNewApplications: true`, `canViewOffer: false`. Tin `INTERNAL` mà không tự đặt `slug` thì BE thêm hậu tố
ngẫu nhiên vào đường dẫn, để chỉ ai có link mới mở được. Response 201 là `RecruitmentJob`.

Lỗi: 400 `RECRUIT_PIPELINE_REQUIRED` (không có quy trình mẫu, mẫu đã ngừng dùng, hoặc chưa có mẫu mặc định),
`RECRUIT_JOB_DESCRIPTION_REQUIRED`, `RECRUIT_OWNER_INVALID`; 404 `RECRUIT_REQUISITION_NOT_FOUND`; 409
`RECRUIT_REQUISITION_NOT_APPROVED`, `RECRUIT_JOB_SLUG_EXISTS`.

#### GET `/v1/recruitment/jobs/:id`

Chi tiết `RecruitmentJob`. Cần `recruitment:read` + phạm vi. Lỗi: 403 `RECRUIT_SCOPE_FORBIDDEN`; 404
`RECRUIT_JOB_NOT_FOUND`.

```json
{
  "success": true,
  "data": {
    "id": 8, "code": "TD-2026-0012", "title": "Backend Developer (NestJS)",
    "locations": ["Hà Nội"], "salaryText": "18–25 triệu",
    "description": "Phát triển API cho hệ thống nội bộ...", "requirements": "2 năm NestJS...", "benefits": null,
    "deadline": "2026-12-15",
    "visibility": "PUBLIC", "visibilityLabel": "Công khai",
    "status": "OPEN", "statusLabel": "Đang mở",
    "budget": 5000000, "actualCost": 1200000,
    "slug": "backend-developer-nestjs",
    "publicPath": "/careers/cty-a/backend-developer-nestjs",
    "openedAt": "2026-11-10T03:00:00.000Z", "closedAt": null, "closedReason": null,
    "requisition": {
      "id": 4, "code": "YCTD-2026-0007", "status": "RECRUITING", "statusLabel": "Đang tuyển",
      "quantity": 1, "employmentType": "FULL_TIME", "employmentTypeLabel": "Nhân viên chính thức",
      "salaryMin": 18000000, "salaryMax": 25000000,
      "department": { "id": 3, "name": "Phòng Kỹ thuật" },
      "position": { "id": 7, "name": "Lập trình viên backend" }
    },
    "owner": { "id": 5, "fullName": "Trần Thị HR" },
    "stages": [
      { "id": 31, "name": "Ứng tuyển", "kind": "APPLIED", "kindLabel": "Ứng tuyển", "order": 0,
        "scorecardTemplate": null, "autoEmailTemplate": null, "activeCount": 4 },
      { "id": 32, "name": "Phỏng vấn chuyên môn", "kind": "INTERVIEW", "kindLabel": "Phỏng vấn", "order": 1,
        "scorecardTemplate": { "id": 1, "name": "Phỏng vấn Dev" }, "autoEmailTemplate": null, "activeCount": 2 },
      { "id": 33, "name": "Offer", "kind": "OFFER", "kindLabel": "Offer", "order": 2,
        "scorecardTemplate": null, "autoEmailTemplate": null, "activeCount": 0 },
      { "id": 34, "name": "Đã tuyển", "kind": "HIRED", "kindLabel": "Đã tuyển", "order": 3,
        "scorecardTemplate": null, "autoEmailTemplate": null, "activeCount": 0 }
    ],
    "activeApplicationCount": 6,
    "team": [
      { "id": 7, "employee": { "id": 9, "fullName": "Lê Văn Trưởng" }, "role": "MANAGER", "roleLabel": "Quản lý",
        "canViewOffer": false, "notifyNewApplications": true, "addedById": 5, "createdAt": "2026-11-10T02:30:00.000Z" }
    ],
    "canViewSalary": true,
    "createdById": 5,
    "createdAt": "2026-11-10T02:30:00.000Z", "updatedAt": "2026-11-10T03:00:00.000Z"
  }
}
```

#### PATCH `/v1/recruitment/jobs/:id`

Sửa tin ở `DRAFT`, `OPEN`, `PAUSED`. Cần `recruitment:manage`. Body là `UpdateJobBody`. Chuyển `PUBLIC` sang
`INTERNAL` mà không tự đặt `slug` thì BE đổi đường dẫn, link công khai cũ không còn mở được; chuyển ngược lại thì
giữ đường dẫn đang có. Lỗi: 400 `RECRUIT_OWNER_INVALID`, `RECRUIT_JOB_DESCRIPTION_REQUIRED` (gửi mô tả rỗng); 404
`RECRUIT_JOB_NOT_FOUND`; 409 `RECRUIT_JOB_CLOSED`, `RECRUIT_JOB_SLUG_EXISTS`.

#### POST `/v1/recruitment/jobs/:id/open` · `/pause` · `/close`

Chuyển trạng thái tin, không có body. Cần `recruitment:manage`. Response 201 là `RecruitmentJob`.

| Route | Từ | Sang | Ghi chú |
|---|---|---|---|
| `open` | `DRAFT`, `PAUSED` | `OPEN` | Yêu cầu phải còn `APPROVED` hoặc `RECRUITING`; tin đầu tiên mở thì yêu cầu sang `RECRUITING` |
| `pause` | `OPEN` | `PAUSED` | Trang công khai không còn hiện tin |
| `close` | `DRAFT`, `OPEN`, `PAUSED` | `CLOSED` | `closedReason: 'MANUAL'`, không mở lại được |

Lỗi: 404 `RECRUIT_JOB_NOT_FOUND`; 409 `RECRUIT_JOB_STATUS_INVALID`, và với `open` thêm
`RECRUIT_REQUISITION_NOT_APPROVED`.

#### DELETE `/v1/recruitment/jobs/:id`

Xoá mềm tin `DRAFT`. Cần `recruitment:manage`. Response 204. Tin khác Nháp thì 409 `RECRUIT_JOB_STATUS_INVALID`;
FE dùng nút Đóng tin.

#### PUT `/v1/recruitment/jobs/:id/stages`

Thay danh sách vòng của tin. Cần `recruitment:manage`. Body `{ stages: StageInput[] }` (3–20 vòng, luật như quy
trình mẫu). **Gửi kèm `id` của vòng đang có để giữ vòng đó**; vòng không có `id` là vòng mới, vòng cũ không còn
trong mảng bị xoá. `order` lấy theo vị trí trong mảng. Response 200 là `RecruitmentJob`.

Lỗi: 400 `RECRUIT_PIPELINE_INVALID`, `RECRUIT_STAGE_NOT_IN_JOB` (gửi `id` của vòng tin khác); 404
`RECRUIT_JOB_NOT_FOUND`; 409 `RECRUIT_STAGE_NOT_EMPTY` (xoá vòng đã có hồ sơ, lịch hay phiếu đánh giá),
`RECRUIT_STAGE_KIND_LOCKED` (đổi loại của vòng đã có hồ sơ).

#### GET `/v1/recruitment/jobs/:id/team`

Mảng `RecruitmentTeamMember` của tin. Cần `recruitment:read` + phạm vi.

#### PUT `/v1/recruitment/jobs/:id/team`

Thay toàn bộ hội đồng. Cần `recruitment:manage`. Body
`{ members: { employeeId: number; canViewOffer?: boolean; notifyNewApplications?: boolean }[] }` (tối đa 50, hai
cờ mặc định `false`). Người không có trong mảng bị gỡ, kể cả trưởng phòng được thêm tự động, nên FE gửi lại đủ
danh sách đang có. Response 200 là `RecruitmentJob` kèm hội đồng mới. Lỗi: 400 `RECRUIT_TEAM_MEMBER_INVALID` khi
có người không tồn tại hoặc đã nghỉ; 404 `RECRUIT_JOB_NOT_FOUND`.

---

### Trang công khai (không đăng nhập)

Mọi route dưới đây **không gửi header `Authorization`** (mục "Quy ước chung"). `:companyCode` là mã công ty
(chữ thường, số, gạch ngang), lấy từ đoạn giữa của `publicPath`. FE dựng các trang `/careers/[company]`,
`/careers/[company]/[slug]` và trang phản hồi offer theo token trong link email; các trang này phải mở được cả khi
người xem chưa đăng nhập lẫn khi đã đăng nhập.

```typescript
export interface PublicCareersJob {
  title: string; slug: string;
  locations: string[];
  salaryText: string | null;
  deadline: string | null;
  departmentName: string; positionName: string;
  employmentType: RequisitionEmploymentType; employmentTypeLabel: string;
}
export interface PublicCareers {
  company: { code: string; name: string };
  intro: string | null;            // giới thiệu trang tuyển dụng
  jobs: PublicCareersJob[];        // tin Công khai đang mở, mới mở trước
}
export interface PublicJobDetail {
  company: { code: string; name: string };
  job: PublicCareersJob & {
    visibility: RecruitmentJobVisibility; visibilityLabel: string;
    description: string; requirements: string | null; benefits: string | null;
  };
  terms: { version: number; text: string };   // gửi lại version trong termsVersion khi nộp
}
```

Response công khai không có khung lương nội bộ, người phụ trách, hội đồng, id của yêu cầu, phòng ban hay vị trí.

#### GET `/v1/public/careers/:companyCode`

Trang tuyển dụng của công ty: tên, giới thiệu, và các tin `PUBLIC` đang `OPEN`, chưa qua hạn nộp, có yêu cầu chưa
đủ người. Tin `INTERNAL` không bao giờ nằm trong danh sách.

```json
{
  "success": true,
  "data": {
    "company": { "code": "cty-a", "name": "Công ty A" },
    "intro": "Chúng tôi đang tìm đồng đội cho nhóm sản phẩm...",
    "jobs": [
      { "title": "Backend Developer (NestJS)", "slug": "backend-developer-nestjs", "locations": ["Hà Nội"],
        "salaryText": "18–25 triệu", "deadline": "2026-12-15",
        "departmentName": "Phòng Kỹ thuật", "positionName": "Lập trình viên backend",
        "employmentType": "FULL_TIME", "employmentTypeLabel": "Nhân viên chính thức" }
    ]
  }
}
```

Mã công ty sai, công ty ngừng phục vụ hay module tắt đều trả cùng một lỗi, để không lộ công ty nào tồn tại:

```json
{ "success": false, "error": { "code": "RECRUIT_CAREERS_CLOSED", "message": "Không còn tuyển" } }
```

#### GET `/v1/public/careers/:companyCode/jobs/:slug`

Chi tiết một tin `PUBLIC` hoặc `INTERNAL` đang mở, kèm điều khoản xử lý dữ liệu hiện hành (`PublicJobDetail`).
Tin `INTERNAL` mở được bằng đúng `slug` và response có header **`X-Robots-Tag: noindex`**; FE cũng nên đặt thẻ
`<meta name="robots" content="noindex">` cho trang tin Nội bộ. Lỗi: 404 `RECRUIT_CAREERS_CLOSED`; 404
`RECRUIT_JOB_NOT_OPEN` khi tin không có, chưa mở, tạm dừng, đã đóng, qua hạn nộp, hoặc yêu cầu đã đủ người.

```json
{
  "success": true,
  "data": {
    "company": { "code": "cty-a", "name": "Công ty A" },
    "job": {
      "title": "Backend Developer (NestJS)", "slug": "backend-developer-nestjs", "locations": ["Hà Nội"],
      "salaryText": "18–25 triệu", "deadline": "2026-12-15",
      "departmentName": "Phòng Kỹ thuật", "positionName": "Lập trình viên backend",
      "employmentType": "FULL_TIME", "employmentTypeLabel": "Nhân viên chính thức",
      "visibility": "PUBLIC", "visibilityLabel": "Công khai",
      "description": "Phát triển API cho hệ thống nội bộ...", "requirements": "2 năm NestJS...", "benefits": "Lương tháng 13..."
    },
    "terms": { "version": 2, "text": "Công ty thu thập và xử lý dữ liệu cá nhân của bạn cho mục đích tuyển dụng..." }
  }
}
```

#### POST `/v1/public/careers/:companyCode/jobs/:slug/applications`

Nộp hồ sơ. `multipart/form-data`, mọi giá trị gửi dạng chuỗi.

| Trường | Kiểu | Ràng buộc |
|---|---|---|
| `fullName` | string | Bắt buộc, 2–150 ký tự |
| `email` | string | Bắt buộc, email hợp lệ, tối đa 200 ký tự (BE tự cắt khoảng trắng) |
| `phone` | string | Tuỳ chọn, tối đa 30 ký tự |
| `consentProcessing` | `"true"` | Bắt buộc là `true`; thiếu hoặc `false` thì 400 `RECRUIT_CONSENT_REQUIRED` |
| `consentTalentPool` | `"true"` \| `"false"` | Tuỳ chọn, đồng ý lưu vào kho tiềm năng |
| `termsVersion` | số | Bắt buộc, đúng `terms.version` của trang chi tiết tin |
| `website` | string | Ô ẩn chống spam, người thật để trống |
| `formStartedAt` | số | `Date.now()` lúc mở form, mili giây |
| `cv` | file | Bắt buộc, PDF hoặc DOCX, tối đa 5 MB |

Thành công luôn trả 201 với cùng một nội dung, kể cả khi bị coi là gửi tự động hay là bấm trùng:

```json
{ "success": true, "data": { "message": "Đã nhận hồ sơ" } }
```

BE làm gì khi nhận hồ sơ hợp lệ:

- Email (đã chuẩn hoá) trùng một ứng viên còn trong hệ thống thì dùng lại ứng viên đó, chỉ điền thêm trường còn
  trống và thêm CV mới. Ứng viên đó đang có hồ sơ đang xét ở tin này thì BE gắn CV mới vào hồ sơ đó; có hồ sơ đã
  đóng thì mở lại về vòng Ứng tuyển. Chỉ trùng số điện thoại thì tạo ứng viên mới.
- Ghi đồng ý xử lý dữ liệu (và lưu kho nếu có tích) kèm phiên bản, nội dung điều khoản, thời điểm và IP.
- Nguồn là "Trang tuyển dụng công ty", gửi email xác nhận ứng tuyển ngay nếu công ty có mẫu đang dùng.
- Ứng viên trùng email hoặc số điện thoại với người bị đánh dấu không tái tuyển thì người phụ trách tuyển dụng
  nhận N-13. Thông báo hồ sơ mới cho HR phụ trách tin được gom theo giờ (N-03).

Lỗi:

| HTTP | Mã | FE xử lý |
|---|---|---|
| 400 | `RECRUIT_CONSENT_REQUIRED` | Chưa tích đồng ý xử lý dữ liệu. Chặn ngay trên form trước khi gửi |
| 400 | `BAD_REQUEST` | Thiếu trường bắt buộc, email sai. Chặn ngay trên form trước khi gửi |
| 400 | `RECRUIT_FILE_REQUIRED`, `RECRUIT_FILE_TOO_LARGE`, `RECRUIT_FILE_TYPE_INVALID` | Báo chọn lại CV |
| 404 | `RECRUIT_CAREERS_CLOSED`, `RECRUIT_JOB_NOT_OPEN` | Báo tin không còn nhận hồ sơ, dẫn về trang tuyển dụng |
| 409 | `RECRUIT_TERMS_CHANGED` | Điều khoản vừa đổi: tải lại chi tiết tin, giữ dữ liệu đã nhập, yêu cầu tích đồng ý lại |
| 413 | `UNKNOWN_ERROR` | File trên 20 MB |
| 429 | `RECRUIT_RATE_LIMITED` | Báo thử lại sau ít phút |

#### GET `/v1/public/offer-responses/:token`

Trang phản hồi offer theo token trong link email. Luôn trả **200**, kể cả khi link sai hay hết hiệu lực
(`state: 'UNAVAILABLE'`), để không lộ link nào có thật. Response có header **`Cache-Control: no-store`** và
**`X-Robots-Tag: noindex`**; FE không lưu response này vào cache hay store dùng lâu.

```typescript
export interface PublicOfferSummary {
  candidateName: string;
  positionName: string; departmentName: string;
  level: string | null;
  employmentType: EmploymentType; employmentTypeLabel: string;
  baseSalary: number;                       // lương chính thức
  probationGroup: 'NONE' | 'ENTERPRISE_MANAGER' | 'COLLEGE_OR_ABOVE' | 'INTERMEDIATE' | 'OTHER';
  probationGroupLabel: string;
  probationDays: number | null; probationSalary: number | null;
  startDate: string; probationEndDate: string | null;
  allowances: string | null;
  responseDeadline: string;                 // hết 23:59:59 giờ Việt Nam của ngày này
  decision: 'ACCEPTED' | 'DECLINED' | null; // chỉ có khi state = RESPONDED
  respondedAt: string | null;
  respondedVia: 'LINK' | 'HR' | null; respondedViaLabel: string | null;
  pdfUrl: string | null;                    // thư mời PDF, presigned URL hết hạn sau 10 phút
}
export interface PublicOfferResponse {
  state: OfferLinkState;
  companyName: string | null;               // null khi link không xác định được công ty
  offer: PublicOfferSummary | null;         // chỉ có khi state = ACTIVE hoặc RESPONDED
  declineReasons: { id: number; name: string }[];   // chỉ có khi state = ACTIVE
}
```

```json
{
  "success": true,
  "data": {
    "state": "ACTIVE",
    "companyName": "Công ty A",
    "offer": {
      "candidateName": "Trần Thị B",
      "positionName": "Lập trình viên backend", "departmentName": "Phòng Kỹ thuật",
      "level": "Senior",
      "employmentType": "FULL_TIME", "employmentTypeLabel": "Nhân viên chính thức",
      "baseSalary": 22000000,
      "probationGroup": "COLLEGE_OR_ABOVE", "probationGroupLabel": "Cần trình độ cao đẳng trở lên (tối đa 60 ngày)",
      "probationDays": 60, "probationSalary": 18700000,
      "startDate": "2026-12-01", "probationEndDate": "2027-01-29",
      "allowances": "Phụ cấp ăn trưa 730.000 đ/tháng",
      "responseDeadline": "2026-11-25",
      "decision": null, "respondedAt": null, "respondedVia": null, "respondedViaLabel": null,
      "pdfUrl": "https://storage.example.com/...pdf?X-Amz-Signature=..."
    },
    "declineReasons": [{ "id": 11, "name": "Nhận offer nơi khác" }, { "id": 12, "name": "Mức lương chưa phù hợp" }]
  }
}
```

FE hiện nội dung theo `state` như bảng ở mục "Luồng trạng thái". Bấm xem PDF sau hơn 10 phút thì gọi lại route này
để lấy link mới. Offer đã được "Không nhận việc" vẫn hiện với ứng viên là `decision: 'ACCEPTED'`.

#### POST `/v1/public/offer-responses/:token/accept`

Ứng viên đồng ý. Body JSON **`{ "confirmed": true }`**, giá trị phải là boolean `true` (chuỗi `"true"` bị 400).
Đây là bước xác nhận lần hai (BR-15): FE hiện hộp thoại "Bạn chắc chắn đồng ý?" rồi mới gửi. Response **200** là
`PublicOfferResponse` mới với `state: 'RESPONDED'`, `decision: 'ACCEPTED'`. BE ghi IP, user agent, kênh `LINK`, và
gửi N-07 cho HR. Hoạt động cả khi module chỉ xem.

#### POST `/v1/public/offer-responses/:token/decline`

Ứng viên từ chối. Body `{ "reasonId": number, "note"?: string }`; `reasonId` lấy từ `declineReasons`, `note` tối
đa 2000 ký tự. Response **200** với `state: 'RESPONDED'`, `decision: 'DECLINED'`. Hồ sơ ứng tuyển tự chuyển Đã
loại với lý do "Ứng viên từ chối offer", HR nhận N-07.

Lỗi chung của hai route (response lỗi cũng có `Cache-Control: no-store`):

| HTTP | Mã | Khi nào |
|---|---|---|
| 400 | `BAD_REQUEST` | Thiếu `confirmed: true`, hoặc thiếu `reasonId` |
| 400 | `RECRUIT_REASON_INVALID` | `reasonId` không phải lý do từ chối offer đang dùng |
| 409 | `RECRUIT_OFFER_LINK_UNAVAILABLE` | Token sai, công ty không phục vụ, module đã tắt |
| 409 | `RECRUIT_OFFER_LINK_RESPONDED`, `RECRUIT_OFFER_LINK_EXPIRED`, `RECRUIT_OFFER_LINK_SUPERSEDED`, `RECRUIT_OFFER_LINK_CANCELLED` | Link không còn ở `ACTIVE`; hậu tố là `state` mới |
| 409 | `RECRUIT_OFFER_ALREADY_RESPONDED` | Hai lần bấm cùng lúc, lần sau thua |

Gặp 409 thì FE gọi lại `GET /v1/public/offer-responses/:token` để hiện đúng trạng thái mới, vì trường `state` mà
service gắn vào lỗi không tới được FE.

---

## Ứng viên

Kho ứng viên ở trang quản lý nằm dưới `/v1/recruitment/candidates`. Mọi route trong mục này gắn vai trò quản lý
(`ADMIN`, `HR`, `DIRECTOR`, `MANAGER`, `CHIEF`), nên `EMPLOYEE` luôn nhận 403 `FORBIDDEN` kể cả khi ngồi hội đồng;
thành viên hội đồng dùng nhóm `/v1/me/recruitment` ở mục "Hội đồng tuyển dụng". Người có `recruitment:manage` thấy
mọi ứng viên, còn `MANAGER` chỉ thấy ứng viên có ít nhất một hồ sơ ở tin của phòng mình hoặc ở tin mình ngồi hội
đồng. Ứng viên đã bị gộp vào ứng viên khác thì biến mất khỏi mọi route và trả 404.

Các kiểu dùng chung cho mục này và hai mục sau:

```typescript
// types/recruitment-candidate.types.ts

export interface RecruitmentRef { id: number; name: string }
export interface RecruitmentPerson { id: number; fullName: string }

/** Một lần ứng tuyển vào một tin, dạng gọn. */
export interface RecruitmentApplicationBrief {
  id: number;
  candidateId: number;
  jobId: number;
  job: { id: number; code: string; title: string; status: 'DRAFT' | 'OPEN' | 'PAUSED' | 'CLOSED'; statusLabel: string };
  stage: { id: number; name: string; kind: 'APPLIED' | 'SCREENING' | 'TEST' | 'INTERVIEW' | 'OFFER' | 'HIRED'; kindLabel: string; order: number };
  status: 'ACTIVE' | 'REJECTED' | 'WITHDRAWN' | 'HIRED';
  statusLabel: string;              // Đang xét · Đã loại · Rút hồ sơ · Đã tuyển
  source: RecruitmentRef | null;
  rejectReason: RecruitmentRef | null;
  closedNote: string | null;
  cvFileId: number | null;          // CV dùng cho lần ứng tuyển này
  appliedAt: string;                // ISO
  stageEnteredAt: string;           // ISO
  closedAt: string | null;
  hiredAt: string | null;
}

export interface RecruitmentCandidateFile {
  id: number;
  candidateId: number;
  kind: 'CV' | 'OTHER';
  kindLabel: string;                // CV · Tài liệu khác
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  // Không có URL: mở file qua GET /v1/recruitment/candidate-files/:id/url
}

export interface RecruitmentConsent {
  id: number;
  kind: 'PROCESSING' | 'TALENT_POOL';
  kindLabel: string;
  method: 'FORM' | 'HR_RECORDED';
  methodLabel: string;
  basis: 'CANDIDATE_APPLIED' | 'WRITTEN_CONSENT' | 'OTHER' | null;
  basisLabel: string | null;
  basisNote: string | null;
  termsVersion: number | null;
  givenAt: string;
  expiresAt: string | null;
  withdrawnAt: string | null;
}

/** Phần thông tin của một ứng viên, dùng ở chi tiết ứng viên và chi tiết hồ sơ. */
export interface RecruitmentCandidateProfile {
  id: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;       // YYYY-MM-DD
  gender: 'Nam' | 'Nữ' | 'Khác' | null;
  address: string | null;
  educationLevel: string | null;
  school: string | null;
  yearsOfExperience: number | null;
  currentTitle: string | null;
  currentCompany: string | null;
  linkedinUrl: string | null;
  portfolioUrl: string | null;
  expectedSalary: number | null;    // null khi canViewSalary = false
  sourceId: number | null;
  isDraft: boolean;                 // tạo từ tải nhiều CV, chờ HR điền
  inTalentPool: boolean;
  isBlacklisted: boolean | null;    // null khi người gọi không thấy blacklist
  blacklistReason: string | null;   // chỉ người thấy blacklist
  blacklistedAt: string | null;     // chỉ người thấy blacklist
  minimizedAt: string | null;       // đã thu gọn dữ liệu (BR-16)
  anonymizedAt: string | null;      // đã ẩn danh (BR-06)
  employeeId: number | null;        // nhân viên tạo từ ứng viên này (F-16)
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentCandidateListItem {
  id: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  yearsOfExperience: number | null;
  source: RecruitmentRef | null;
  tags: RecruitmentRef[];
  isDraft: boolean;
  inTalentPool: boolean;
  isBlacklisted: boolean | null;
  minimizedAt: string | null;
  createdAt: string;
  applications: RecruitmentApplicationBrief[];   // chỉ hồ sơ trong phạm vi người gọi
}

export interface RecruitmentCandidateDetail extends RecruitmentCandidateProfile {
  source: RecruitmentRef | null;
  tags: RecruitmentRef[];
  files: RecruitmentCandidateFile[];
  consents: RecruitmentConsent[];
  applications: RecruitmentApplicationBrief[];   // chỉ hồ sơ trong phạm vi người gọi
  duplicates: { id: number; fullName: string; isBlacklisted: boolean | null }[];
  duplicateBlacklisted: boolean | null;          // có ứng viên trùng đang bị đánh dấu không tái tuyển
  canViewSalary: boolean;
  canSeeBlacklist: boolean;
}
```

---

### GET /v1/recruitment/candidates — Danh sách, tìm kiếm

Danh sách có phân trang, mới tạo trước (theo `id` giảm dần). Cần `recruitment:read`.

**Query:**

| Param | Type | Ghi chú |
|-------|------|---------|
| `search` | string ≤ 200 | So với họ tên (chứa, không phân biệt hoa thường), email đã chuẩn hoá, và SĐT đã chuẩn hoá khi chuỗi tìm có từ 3 chữ số trở lên. Gõ `+84 912.345.678` vẫn tìm ra `0912345678` (BR-04) |
| `jobId` | number | Có hồ sơ ở tin này |
| `stageKind` | `APPLIED` · `SCREENING` · `TEST` · `INTERVIEW` · `OFFER` · `HIRED` | Có hồ sơ đang nằm ở vòng thuộc loại này |
| `appliedFrom`, `appliedTo` | `YYYY-MM-DD` | Ngày ứng tuyển của hồ sơ, `appliedTo` tính hết ngày |
| `sourceId` | number | Nguồn ghi trên ứng viên, không phải nguồn của từng hồ sơ |
| `tagId` | number | |
| `talentPool` | boolean | `true` là chỉ lấy ứng viên trong kho tiềm năng (F-08) |
| `isBlacklisted` | boolean | Chỉ người có `recruitment:manage` (hoặc ADMIN) mới gửi được; người khác gửi tham số này nhận 403 `RECRUIT_SCOPE_FORBIDDEN`, để không đoán được ai bị đánh dấu |
| `page`, `limit` | number | Mặc định 1 và 20, `limit` tối đa 100 |

Các điều kiện `jobId`, `stageKind`, `appliedFrom`, `appliedTo` cùng áp lên **một** hồ sơ: lọc `jobId=12&stageKind=INTERVIEW`
nghĩa là ứng viên có hồ sơ ở tin 12 đang ở vòng phỏng vấn. Danh sách không bao giờ có ứng viên đã ẩn danh hay đã bị
gộp.

**Response:** `ApiPaginated<RecruitmentCandidateListItem>`

```json
{
  "success": true,
  "data": [
    {
      "id": 45,
      "fullName": "Nguyễn Văn A",
      "email": "nguyenvana@gmail.com",
      "phone": "0912345678",
      "currentTitle": "Backend Developer",
      "currentCompany": "Công ty X",
      "yearsOfExperience": 3.5,
      "source": { "id": 2, "name": "TopCV" },
      "tags": [{ "id": 1, "name": "Java" }],
      "isDraft": false,
      "inTalentPool": false,
      "isBlacklisted": false,
      "minimizedAt": null,
      "createdAt": "2026-11-10T03:00:00.000Z",
      "applications": [
        {
          "id": 101,
          "candidateId": 45,
          "jobId": 12,
          "job": { "id": 12, "code": "TD-2026-0012", "title": "Backend Developer", "status": "OPEN", "statusLabel": "Đang mở" },
          "stage": { "id": 34, "name": "Phỏng vấn vòng 1", "kind": "INTERVIEW", "kindLabel": "Phỏng vấn", "order": 3 },
          "status": "ACTIVE",
          "statusLabel": "Đang xét",
          "source": { "id": 2, "name": "TopCV" },
          "rejectReason": null,
          "closedNote": null,
          "cvFileId": 8,
          "appliedAt": "2026-11-10T03:00:00.000Z",
          "stageEnteredAt": "2026-11-12T03:00:00.000Z",
          "closedAt": null,
          "hiredAt": null
        }
      ]
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

`MANAGER` gọi cùng route thì `isBlacklisted` là `null` và `applications` chỉ còn hồ sơ ở tin trong phạm vi. Lỗi:
403 `RECRUIT_SCOPE_FORBIDDEN` (người gọi không có phạm vi nào, hoặc lọc `isBlacklisted` khi không được thấy).

### POST /v1/recruitment/candidates/check-duplicates — Kiểm trùng trước khi lưu

Form thêm hoặc sửa ứng viên gọi route này khi người dùng rời ô email hoặc SĐT, để cảnh báo trùng theo BR-04 trước khi
bấm Lưu. BE **không** tự chặn tạo ứng viên trùng, nên cảnh báo này là việc của FE. Cần `recruitment:manage`. Route vẫn
chạy khi module chỉ xem, và trả **200** (không phải 201).

**Body:** `{ "email"?: string ≤ 200, "phone"?: string ≤ 30 }`. Gửi cả hai trống thì nhận mảng rỗng.

**Response 200:** `ApiSuccess<RecruitmentDuplicateMatch[]>`

```typescript
export interface RecruitmentDuplicateMatch {
  id: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  matchedBy: ('EMAIL' | 'PHONE')[];
  isBlacklisted: boolean | null;    // null khi người gọi không thấy blacklist
}
```

```json
{
  "success": true,
  "data": [
    { "id": 38, "fullName": "Nguyễn Văn A", "email": null, "phone": "0912345678", "matchedBy": ["PHONE"], "isBlacklisted": false }
  ]
}
```

Có phần tử `isBlacklisted: true` thì hiện cảnh báo đỏ "Trùng với ứng viên đã đánh dấu không tái tuyển". Cảnh báo
không chặn việc lưu.

### GET /v1/recruitment/candidates/:id — Chi tiết

Cần `recruitment:read`. Người có phạm vi toàn công ty mở được mọi ứng viên; `MANAGER` chỉ mở được khi thấy ít nhất một
hồ sơ của ứng viên đó, ngược lại nhận 403 `RECRUIT_SCOPE_FORBIDDEN`. Mỗi lần mở được ghi nhật ký
`recruitment.candidate_view` (xem mục "Báo cáo và xuất").

**Response:** `ApiSuccess<RecruitmentCandidateDetail>`

```json
{
  "success": true,
  "data": {
    "id": 45,
    "fullName": "Nguyễn Văn A",
    "email": "nguyenvana@gmail.com",
    "phone": "0912345678",
    "dateOfBirth": "1998-05-20",
    "gender": "Nam",
    "address": null,
    "educationLevel": "Đại học",
    "school": "ĐH Bách khoa Hà Nội",
    "yearsOfExperience": 3.5,
    "currentTitle": "Backend Developer",
    "currentCompany": "Công ty X",
    "linkedinUrl": "https://linkedin.com/in/abc",
    "portfolioUrl": null,
    "expectedSalary": 25000000,
    "sourceId": 2,
    "isDraft": false,
    "inTalentPool": false,
    "isBlacklisted": false,
    "blacklistReason": null,
    "blacklistedAt": null,
    "minimizedAt": null,
    "anonymizedAt": null,
    "employeeId": null,
    "createdAt": "2026-11-10T03:00:00.000Z",
    "updatedAt": "2026-11-12T03:00:00.000Z",
    "source": { "id": 2, "name": "TopCV" },
    "tags": [{ "id": 1, "name": "Java" }],
    "files": [
      { "id": 8, "candidateId": 45, "kind": "CV", "kindLabel": "CV", "fileName": "cv-nguyen-van-a.pdf", "mimeType": "application/pdf", "sizeBytes": 245000, "createdAt": "2026-11-10T03:00:00.000Z" }
    ],
    "consents": [
      { "id": 3, "kind": "PROCESSING", "kindLabel": "Xử lý dữ liệu cho tuyển dụng", "method": "HR_RECORDED", "methodLabel": "HR ghi nhận", "basis": "CANDIDATE_APPLIED", "basisLabel": "Ứng viên gửi CV ứng tuyển", "basisNote": null, "termsVersion": null, "givenAt": "2026-11-10T03:00:00.000Z", "expiresAt": null, "withdrawnAt": null }
    ],
    "applications": [ /* RecruitmentApplicationBrief, như ví dụ ở danh sách */ ],
    "duplicates": [{ "id": 38, "fullName": "Nguyễn Văn A", "isBlacklisted": false }],
    "duplicateBlacklisted": false,
    "canViewSalary": true,
    "canSeeBlacklist": true
  }
}
```

Cách hiển thị theo cờ:

- `duplicates` là các ứng viên khác trùng email hoặc SĐT (BR-04). Chỉ người có `recruitment:manage` nhận danh sách
  này; người khác luôn nhận mảng rỗng. Có phần tử thì hiện thanh "Có N ứng viên trùng" kèm nút Gộp.
- `duplicateBlacklisted: true` thì hiện banner đỏ "Trùng với ứng viên đã đánh dấu không tái tuyển" (F-21). Người không
  thấy blacklist nhận `null` và không được hiện gì.
- `canSeeBlacklist: false` thì ẩn mọi phần không tái tuyển (cờ, lý do, nút đánh dấu); các trường đó đã là `null`.
- `canViewSalary: false` thì `expectedSalary` là `null`, hiển thị "—". Cờ này là `true` khi người gọi có
  `recruitment:salary:read` hoặc `recruitment:manage`, hoặc ngồi hội đồng có cờ "xem offer" của một tin mà ứng viên
  đã nộp.
- `anonymizedAt` khác `null` nghĩa là ứng viên đã ẩn danh: họ tên thành "Ứng viên đã ẩn danh #45", liên hệ và chi
  tiết là `null`, không còn file. Hiện nhãn "Đã ẩn danh" và khoá mọi nút sửa, vì mọi thao tác ghi trả 409
  `RECRUIT_CANDIDATE_ANONYMIZED`.
- `minimizedAt` khác `null` nghĩa là ứng viên đang bị đánh dấu không tái tuyển đã được thu gọn (BR-16): chỉ còn họ
  tên, email, SĐT và thông tin đánh dấu.

Lỗi: 403 `RECRUIT_SCOPE_FORBIDDEN`, 404 `RECRUIT_CANDIDATE_NOT_FOUND` (không có, hoặc đã bị gộp vào ứng viên khác).

### POST /v1/recruitment/candidates — Thêm ứng viên

HR thêm từng người (F-09), kèm CV tuỳ chọn. Cần `recruitment:manage`.

**Content-Type:** `multipart/form-data`

| Field | Type | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| `fullName` | string 2–150 | ✅ | |
| `email` | email ≤ 200 | Email hoặc SĐT | BE tự cắt khoảng trắng hai đầu |
| `phone` | string ≤ 30 | Email hoặc SĐT | Lưu nguyên, so trùng theo dạng chuẩn hoá |
| `consentBasis` | `CANDIDATE_APPLIED` · `WRITTEN_CONSENT` · `OTHER` | ✅ | Căn cứ xử lý dữ liệu HR chọn (T-04) |
| `consentNote` | string ≤ 1000 | | Ghi chú bằng chứng, ví dụ "Ứng viên gửi CV qua email ngày 10/11" |
| `talentPoolConsent` | `"true"` · `"false"` | | Ứng viên đã đồng ý lưu kho tiềm năng: BE ghi thêm một đồng ý `TALENT_POOL` và đưa luôn vào kho |
| `jobId` | number | | Có thì tạo hồ sơ ở vòng Ứng tuyển của tin đó. Tin `DRAFT` hay `PAUSED` vẫn nhận; tin `CLOSED` trả 409 |
| `sourceId` | number | | Nguồn đang dùng trong danh mục |
| `tagIds` | number[] | | `[1,2]` dạng JSON, `"1,2"`, hoặc lặp trường |
| `dateOfBirth` | `YYYY-MM-DD` | | |
| `gender` | `Nam` · `Nữ` · `Khác` | | |
| `address` | string ≤ 300 | | |
| `educationLevel` | string ≤ 100 | | |
| `school` | string ≤ 200 | | |
| `yearsOfExperience` | number 0–60, một chữ số thập phân | | |
| `currentTitle` | string ≤ 150 | | |
| `currentCompany` | string ≤ 200 | | |
| `linkedinUrl`, `portfolioUrl` | URL có `http(s)://`, ≤ 300 | | |
| `expectedSalary` | số nguyên ≥ 0 | | |
| `cv` | `File` | | PDF, DOC, DOCX, JPG, PNG, tối đa 5 MB. BE kiểm loại theo nội dung file, không theo đuôi |

```typescript
const form = new FormData();
form.append('fullName', 'Nguyễn Văn A');
form.append('email', 'nguyenvana@gmail.com');
form.append('consentBasis', 'CANDIDATE_APPLIED');
form.append('jobId', '12');
form.append('tagIds', JSON.stringify([1, 3]));
form.append('cv', file);
await authFetch('/v1/recruitment/candidates', { method: 'POST', body: form }); // không tự đặt Content-Type
```

**Response 201:** `ApiSuccess<RecruitmentCandidateDetail>`, cùng shape với chi tiết.

BE luôn ghi một đồng ý `PROCESSING` theo `consentBasis` và sự kiện `CONSENT_RECORDED`; có `jobId` thì thêm sự kiện
`APPLIED`. Route này **không** kiểm trùng, nên FE gọi `check-duplicates` trước.

| Mã lỗi | HTTP | Khi nào |
|---|---|---|
| `RECRUIT_CONTACT_REQUIRED` | 400 | Thiếu cả email lẫn SĐT |
| `RECRUIT_SOURCE_INVALID` | 400 | Nguồn không có hoặc đã ngừng dùng |
| `RECRUIT_PIPELINE_INVALID` | 400 | Tin chưa có vòng Ứng tuyển |
| `RECRUIT_FILE_TOO_LARGE`, `RECRUIT_FILE_TYPE_INVALID` | 400 | CV quá 5 MB hoặc sai loại |
| `RECRUIT_JOB_NOT_FOUND` | 404 | |
| `RECRUIT_JOB_CLOSED` | 409 | Tin đã đóng |

File lớn hơn 20 MB bị tầng upload chặn với HTTP 413 trước khi tới BE, nên FE nên kiểm dung lượng ngay khi chọn file.

### PATCH /v1/recruitment/candidates/:id — Sửa

**Body:** JSON, mọi trường của bảng trên trừ `consentBasis`, `consentNote`, `talentPoolConsent`, `jobId`, `tagIds`,
`cv`; trường nào cũng tuỳ chọn. Cần `recruitment:manage`. **Response 200:** `ApiSuccess<RecruitmentCandidateDetail>`.

Mọi lần sửa đều bỏ cờ `isDraft`, nên ứng viên nháp từ "Tải nhiều CV" thôi là nháp ngay khi HR lưu lần đầu. Sau khi
sửa, ứng viên phải còn email hoặc SĐT. Gửi `""` hay `null` cho một trường coi như không đổi trường đó, nên route này
chưa xoá được một trường đã có giá trị.

Lỗi: 400 `RECRUIT_CONTACT_REQUIRED`, `RECRUIT_SOURCE_INVALID`; 404 `RECRUIT_CANDIDATE_NOT_FOUND`; 409
`RECRUIT_CANDIDATE_ANONYMIZED`.

### POST /v1/recruitment/candidates/:id/merge — Gộp trùng

Gộp hai ứng viên trùng (F-07): id ở đường dẫn và `sourceId` chỉ là hai ứng viên cần gộp, thứ tự không quan trọng.
Cần `recruitment:manage`.

**Body:** `{ "sourceId": 38 }`

**Response 201:** `ApiSuccess<RecruitmentCandidateDetail>` của **bản được giữ**, là bản **tạo sau** (thiết kế mục
10.4), nên `data.id` có thể khác id ở đường dẫn. Bản còn lại bị đánh dấu đã gộp và từ đó trả 404 ở mọi route. FE
**luôn chuyển sang trang của `data.id`**, không dùng lại id ở đường dẫn.

Quy tắc gộp theo BR-04:

- **Bản tạo sau là bản chính.** BE so `createdAt`, hai bản tạo cùng lúc thì giữ bản có id lớn hơn. Trường nào bản
  chính để trống (null hoặc chuỗi rỗng) thì lấy của bản kia; email đi cùng email chuẩn hoá, SĐT đi cùng SĐT chuẩn hoá.
  Họ tên luôn lấy của bản chính.
- **Cộng dồn** mọi hồ sơ ứng tuyển, file, đồng ý, bình luận, sự kiện lịch sử và nhật ký email của bản bị gộp sang bản
  giữ lại. Tag lấy hợp của hai bản.
- **Kho tiềm năng và blacklist lấy theo "một trong hai".** Một bản trong kho thì bản giữ lại ở trong kho. Một bản bị
  đánh dấu không tái tuyển thì bản giữ lại bị đánh dấu, với lý do, ngày và người đánh dấu của lần đánh dấu sớm nhất.
- Bản giữ lại thôi là nháp, nhận sự kiện `MERGED` với `payload: { mergedCandidateId }`.

| Mã lỗi | HTTP | Khi nào |
|---|---|---|
| `RECRUIT_MERGE_SAME` | 400 | `sourceId` trùng id ở đường dẫn |
| `RECRUIT_CANDIDATE_NOT_FOUND` | 404 | Một trong hai không có hoặc đã bị gộp trước đó |
| `RECRUIT_CANDIDATE_ANONYMIZED` | 409 | Một trong hai đã ẩn danh |
| `RECRUIT_MERGE_BOTH_HIRED` | 409 | Cả hai đều đã thành nhân viên |
| `RECRUIT_MERGE_ACTIVE_CONFLICT` | 409 | Hai bản cùng có hồ sơ đang xét ở một tin: HR đóng một hồ sơ (loại hoặc rút) rồi gộp lại |

### Không tái tuyển — POST, DELETE /v1/recruitment/candidates/:id/blacklist

Đánh dấu và gỡ đánh dấu "Không tái tuyển" (F-21). Cần `recruitment:manage`, nên chỉ HR và ADMIN thấy nút này.

| Route | Body | Response |
|---|---|---|
| `POST .../blacklist` | `{ "reason": "Gian lận hồ sơ" }`, 3–2000 ký tự, bắt buộc | 201 `ApiSuccess<RecruitmentCandidateDetail>` |
| `DELETE .../blacklist` | `{ "note": "Đã xác minh lại, không còn lý do" }`, 3–2000 ký tự, bắt buộc | 200 `ApiSuccess<RecruitmentCandidateDetail>` |

⚠ Route gỡ là `DELETE` **có body**. Với `$fetch` hay `ofetch` gửi `{ method: 'DELETE', body: { note } }`; với axios
gửi `axios.delete(url, { data: { note } })`.

Mỗi lần đánh dấu hay gỡ sinh sự kiện `BLACKLISTED` (`payload: { reason }`) hoặc `UNBLACKLISTED` (`payload: { note }`)
với `hrOnly: true`, nên chỉ người thấy blacklist mới thấy hai sự kiện này trong lịch sử. Gỡ đánh dấu xoá lý do, ngày và
người đánh dấu trên ứng viên; lý do cũ chỉ còn trong sự kiện lịch sử. Hai thao tác đều ghi nhật ký hệ thống.

Lỗi: 404 `RECRUIT_CANDIDATE_NOT_FOUND`; 409 `RECRUIT_ALREADY_BLACKLISTED` (đánh dấu lần hai),
`RECRUIT_NOT_BLACKLISTED` (gỡ khi chưa bị đánh dấu), `RECRUIT_CANDIDATE_ANONYMIZED`.

### Kho tiềm năng — POST, DELETE /v1/recruitment/candidates/:id/talent-pool

Đưa vào hoặc gỡ khỏi kho tiềm năng (F-08). Không có body. Cần `recruitment:manage`. Đưa vào trả 201, gỡ trả 200, cả
hai trả `ApiSuccess<RecruitmentCandidateDetail>`. Gọi khi ứng viên đã ở đúng trạng thái đó thì BE trả lại chi tiết
mà không ghi gì thêm.

Đưa vào kho đòi một đồng ý `TALENT_POOL` chưa bị rút (S-19); thiếu thì nhận:

```json
{ "success": false, "error": { "code": "RECRUIT_TALENT_POOL_NO_CONSENT", "message": "Ứng viên chưa đồng ý lưu vào kho tiềm năng" } }
```

FE nên hiện nút "Ghi nhận đồng ý" ngay trong thông báo lỗi này, trỏ tới route ghi nhận đồng ý bên dưới. Lỗi khác: 404
`RECRUIT_CANDIDATE_NOT_FOUND`, 409 `RECRUIT_CANDIDATE_ANONYMIZED`.

### POST /v1/recruitment/candidates/:id/consents — Ghi nhận đồng ý

HR ghi nhận một đồng ý mà ứng viên đã đưa ngoài hệ thống (T-04), ví dụ trả lời email. Cần `recruitment:manage`.

**Body:**

```json
{ "kind": "TALENT_POOL", "basis": "WRITTEN_CONSENT", "note": "Email đồng ý ngày 10/11/2026" }
```

`kind` là `PROCESSING` hoặc `TALENT_POOL`, `basis` là `CANDIDATE_APPLIED`, `WRITTEN_CONSENT` hoặc `OTHER`, `note` tuỳ
chọn và tối đa 1000 ký tự. BE ghi kèm phiên bản điều khoản hiện hành và sinh sự kiện `CONSENT_RECORDED`.

**Response 201:** `ApiSuccess<RecruitmentCandidateDetail>`, đồng ý mới nằm đầu mảng `consents`. Ghi nhận đồng ý
`TALENT_POOL` **không** tự đưa ứng viên vào kho: FE gọi tiếp `POST .../talent-pool`.

Lỗi: 404 `RECRUIT_CANDIDATE_NOT_FOUND`, 409 `RECRUIT_CANDIDATE_ANONYMIZED`.

### PUT /v1/recruitment/candidates/:id/tags — Thay tag

**Body:** `{ "tagIds": [1, 3] }`, tối đa 50 phần tử; mảng rỗng là gỡ hết tag. Route thay **toàn bộ** tag của ứng
viên, nên FE gửi danh sách đầy đủ sau khi chỉnh. Cần `recruitment:manage`. **Response 200:**
`ApiSuccess<RecruitmentCandidateDetail>`.

Lỗi: 400 `RECRUIT_TAG_INVALID` (có id tag không tồn tại), 404 `RECRUIT_CANDIDATE_NOT_FOUND`, 409
`RECRUIT_CANDIDATE_ANONYMIZED`. Danh mục tag lấy ở `GET /v1/recruitment/tags`.

### POST /v1/recruitment/candidates/:id/applications — Thêm vào tin

Đưa một ứng viên có sẵn (thường từ kho tiềm năng) vào một tin (F-08). Cần `recruitment:manage`.

**Body:**

```json
{ "jobId": 12, "sourceId": 3, "cvFileId": 8 }
```

| Field | Bắt buộc | Ghi chú |
|---|---|---|
| `jobId` | ✅ | Tin `CLOSED` trả 409 |
| `sourceId` | | Trống thì lấy nguồn đang ghi trên ứng viên |
| `cvFileId` | | CV dùng cho lần ứng tuyển này, phải thuộc ứng viên; trống thì lấy CV mới nhất |

Theo BR-05, ứng viên đã có hồ sơ **đang xét** ở tin này thì nhận 409 `RECRUIT_APPLICATION_ACTIVE_EXISTS`. Ứng viên có
hồ sơ **đã loại hoặc đã rút** ở tin này thì BE mở lại chính hồ sơ đó về vòng Ứng tuyển (sự kiện `REAPPLIED`) thay vì
tạo hồ sơ mới; ngược lại BE tạo hồ sơ mới ở vòng Ứng tuyển (sự kiện `APPLIED`).

**Response 201:** `ApiSuccess<RecruitmentApplicationDetail>` (kiểu ở mục "Hồ sơ ứng tuyển").

Lỗi: 400 `RECRUIT_SOURCE_INVALID`, `RECRUIT_FILE_NOT_FOUND` (CV không thuộc ứng viên), `RECRUIT_PIPELINE_INVALID`;
404 `RECRUIT_CANDIDATE_NOT_FOUND`, `RECRUIT_JOB_NOT_FOUND`; 409 `RECRUIT_APPLICATION_ACTIVE_EXISTS`,
`RECRUIT_JOB_CLOSED`, `RECRUIT_CANDIDATE_ANONYMIZED`.

### POST /v1/recruitment/candidates/:id/anonymize — Xoá dữ liệu theo yêu cầu

Ứng viên yêu cầu xoá dữ liệu (F-19). Route chạy cả khi ứng viên đang bị đánh dấu không tái tuyển, và chạy cả khi module
ở trạng thái chỉ xem (Q-12). Cần `recruitment:manage`.

**Body:** `{ "reason": "Ứng viên yêu cầu xoá dữ liệu qua email ngày 12/11" }`, 3–2000 ký tự, bắt buộc.

**Response: 204 No Content.**

BE làm theo thứ tự sau. Hồ sơ đang xét được đóng thành "Rút hồ sơ". Mọi file của ứng viên bị xoá khỏi kho lưu trữ.
Họ tên thành "Ứng viên đã ẩn danh #<id>"; email, SĐT, ngày sinh, giới tính, địa chỉ, học vấn, kinh nghiệm, công ty,
link, lương mong muốn và lý do blacklist về `null`. Nội dung email đã gửi, bình luận và nhận xét phiếu đánh giá bị thay
bằng "[đã ẩn danh]", còn điểm và kết luận giữ lại để thống kê. Ứng viên bị gỡ tag và ra khỏi kho tiềm năng, sinh sự kiện
`ANONYMIZED` và nhật ký `recruitment.candidate_anonymize`. Sau đó ứng viên biến khỏi danh sách nhưng `GET
/v1/recruitment/candidates/:id` vẫn trả bản ghi đã ẩn danh, nên FE quay về danh sách và báo "Đã xoá dữ liệu ứng viên".

Lỗi: 404 `RECRUIT_CANDIDATE_NOT_FOUND`; 409 `RECRUIT_CANDIDATE_ANONYMIZED` (đã ẩn danh), `RECRUIT_CANDIDATE_HIRED`
(ứng viên đã thành nhân viên: dữ liệu đi theo hồ sơ nhân viên, xử lý ở module Nhân viên).

### GET /v1/recruitment/candidates/:id/timeline — Lịch sử

Mọi sự kiện của ứng viên, mới nhất trước. Cần `recruitment:read`, cùng điều kiện phạm vi như chi tiết, nhưng không
ghi nhật ký xem. Route chỉ trả **sự kiện**; bình luận và email lấy ở hai route riêng bên dưới, FE tự trộn theo thời
gian nếu muốn hiện chung một dòng thời gian.

```typescript
export interface RecruitmentTimelineEvent {
  id: number;
  applicationId: number | null;
  type: string;                     // mã sự kiện, xem bảng dưới
  typeLabel: string;
  actor: RecruitmentPerson | null;  // null = ứng viên hoặc hệ thống
  payload: Record<string, unknown> | null;
  hrOnly: boolean;                  // true chỉ có ở sự kiện blacklist
  createdAt: string;
}
```

```json
{
  "success": true,
  "data": [
    {
      "id": 905,
      "applicationId": 101,
      "type": "STAGE_CHANGED",
      "typeLabel": "Chuyển vòng",
      "actor": { "id": 3, "fullName": "Lê Thu Hà" },
      "payload": { "fromStageId": 32, "toStageId": 34, "from": "Sơ loại", "to": "Phỏng vấn vòng 1", "toKind": "INTERVIEW" },
      "hrOnly": false,
      "createdAt": "2026-11-12T03:00:00.000Z"
    },
    {
      "id": 900,
      "applicationId": 101,
      "type": "APPLIED",
      "typeLabel": "Ứng tuyển",
      "actor": null,
      "payload": { "jobId": 12, "jobTitle": "Backend Developer", "stage": "Ứng tuyển" },
      "hrOnly": false,
      "createdAt": "2026-11-10T03:00:00.000Z"
    }
  ]
}
```

Hiển thị theo `typeLabel` và `actor`; `payload` chỉ dùng để hiện chi tiết phụ:

| `type` | `payload` |
|---|---|
| `APPLIED` | `{ jobId, jobTitle, stage }` |
| `REAPPLIED` | `{ jobId, stage }` |
| `STAGE_CHANGED` | `{ fromStageId, toStageId, from, to, toKind }` |
| `REJECTED`, `WITHDRAWN` | `{ reasonId }` |
| `REOPENED` | `{ stage }` |
| `INTERVIEW_SCHEDULED` | `{ interviewId, startAt, mode }` |
| `INTERVIEW_RESCHEDULED` | `{ interviewId, startAt }` |
| `INTERVIEW_CANCELLED` | `{ interviewId }` |
| `INTERVIEW_STATUS_CHANGED` | `{ interviewId, status }` |
| `SCORECARD_SUBMITTED` | `{ scorecardId, stageId, verdict }`, thêm `test: true` khi là điểm thi |
| `EMAIL_SENT`, `EMAIL_FAILED` | `{ emailLogId, purpose, channel }` |
| `COMMENTED` | `{ commentId, kind }` |
| `UPDATED` | `{ fields: string[] }` |
| `FILE_ADDED` | `{ fileId, kind }` |
| `CONSENT_RECORDED` | `{ kind, basis }` |
| `OFFER_CREATED` | `{ offerId, code, version }`, thêm `revisedFrom` khi là phiên bản mới |
| `OFFER_SUBMITTED` | `{ offerId, overBand }` |
| `OFFER_SENT` | `{ offerId, deadline }` |
| `OFFER_ACCEPTED`, `OFFER_DECLINED` | `{ offerId, channel, reasonId }` |
| `OFFER_APPROVED`, `OFFER_APPROVAL_REJECTED`, `OFFER_CANCELLED`, `OFFER_NO_SHOW`, `OFFER_EXPIRED` | `{ offerId }` |
| `MERGED` | `{ mergedCandidateId }` |
| `BLACKLISTED` | `{ reason }`, `hrOnly: true` |
| `UNBLACKLISTED` | `{ note }`, `hrOnly: true` |
| `TALENT_POOL_ADDED`, `TALENT_POOL_REMOVED` | `null` |
| `HIRED` | `{ offerId, employeeId }` |
| `MINIMIZED`, `ANONYMIZED` | `{ reason }` |

Người không thấy blacklist không nhận sự kiện `hrOnly`. `MANAGER` chỉ nhận sự kiện chung của ứng viên
(`applicationId: null`) và sự kiện của hồ sơ trong phạm vi mình. Lỗi: 403 `RECRUIT_SCOPE_FORBIDDEN`, 404
`RECRUIT_CANDIDATE_NOT_FOUND`.

### File ứng viên

#### POST /v1/recruitment/candidates/:id/files — Tải lên

**Content-Type:** `multipart/form-data`. Cần `recruitment:manage`.

| Field | Type | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| `file` | `File` | ✅ | |
| `kind` | `CV` · `OTHER` | ✅ | Quyết định loại file và dung lượng, xem bảng dưới |

| `kind` | Loại nhận | Tối đa |
|---|---|---|
| `CV` | PDF, DOC, DOCX, JPG, PNG | 5 MB |
| `OTHER` | PDF, JPG, PNG, ZIP | 20 MB |

BE kiểm loại theo nội dung file, nên file đổi đuôi thành `.pdf` vẫn bị trả 400. Mỗi lần tải sinh sự kiện `FILE_ADDED`.
CV mới không tự gắn vào hồ sơ đang xét; nó được dùng khi thêm ứng viên vào tin sau đó, hoặc khi chuyển thành nhân viên
mà hồ sơ không có CV riêng.

**Response 201:** `ApiSuccess<RecruitmentCandidateFile>`

```json
{
  "success": true,
  "data": { "id": 9, "candidateId": 45, "kind": "OTHER", "kindLabel": "Tài liệu khác", "fileName": "bang-diem.pdf", "mimeType": "application/pdf", "sizeBytes": 812300, "createdAt": "2026-11-12T04:10:00.000Z" }
}
```

Lỗi: 400 `RECRUIT_FILE_REQUIRED`, `RECRUIT_FILE_TOO_LARGE`, `RECRUIT_FILE_TYPE_INVALID`; 404
`RECRUIT_CANDIDATE_NOT_FOUND`; 409 `RECRUIT_CANDIDATE_ANONYMIZED`.

#### GET /v1/recruitment/candidate-files/:id/url — Mở file

Lấy link có thời hạn **10 phút** khi người dùng bấm vào file. Cần `recruitment:read` và phải xem được ứng viên đó (cùng
điều kiện như chi tiết). Mỗi lần lấy link được ghi nhật ký `recruitment.candidate_file_view`.

```json
{ "success": true, "data": { "url": "https://…/tenants/sth/recruitment/cv/…pdf?X-Amz-Signature=…" } }
```

```typescript
// Lấy URL khi bấm rồi mở tab mới; không lưu URL lại, hết hạn thì gọi lại
const { url } = (await authFetch(`/v1/recruitment/candidate-files/${fileId}/url`)).data;
window.open(url, '_blank');
```

Lỗi: 403 `RECRUIT_SCOPE_FORBIDDEN`; 404 `RECRUIT_FILE_NOT_FOUND` (không có, đã xoá do ẩn danh, hoặc ký link lỗi),
`RECRUIT_CANDIDATE_NOT_FOUND`. Thành viên hội đồng dùng `GET /v1/me/recruitment/candidate-files/:id/url`.

#### Xoá file

Bản này **chưa có route xoá từng file** của ứng viên. File chỉ bị xoá khỏi kho khi ứng viên được ẩn danh (theo yêu cầu
hoặc hết thời hạn lưu). FE không hiện nút xoá file.

### Bình luận và đề xuất — GET, POST /v1/recruitment/candidates/:id/comments

Bình luận về ứng viên, nhắc đồng nghiệp, và đề xuất của trưởng phòng (F-18, L15). Cả hai route chỉ cần
`recruitment:read`, nên `MANAGER` bình luận và gửi đề xuất được; HR xem đề xuất rồi tự bấm chuyển vòng, loại hay tạo
offer, vì BE không tự áp dụng đề xuất.

```typescript
export interface RecruitmentComment {
  id: number;
  candidateId: number;
  applicationId: number | null;
  author: RecruitmentPerson;
  kind: 'COMMENT' | 'SUGGEST_MOVE' | 'SUGGEST_REJECT' | 'SUGGEST_OFFER';
  kindLabel: string;                // Bình luận · Đề xuất chuyển vòng · Đề xuất loại · Đề xuất offer
  body: string;
  mentionIds: number[];
  suggestion: { toStageId?: number; reasonId?: number } | null;
  createdAt: string;
  updatedAt: string;
}
```

**GET** trả `ApiSuccess<RecruitmentComment[]>`, mới nhất trước. `MANAGER` chỉ nhận bình luận chung của ứng viên và bình
luận gắn với hồ sơ trong phạm vi mình.

**POST body:**

```json
{
  "body": "Đề xuất mời vòng 2, kỹ năng hệ thống tốt",
  "applicationId": 101,
  "kind": "SUGGEST_MOVE",
  "suggestion": { "toStageId": 35 },
  "mentionIds": [5]
}
```

| Field | Bắt buộc | Ghi chú |
|---|---|---|
| `body` | ✅ | 1–5000 ký tự |
| `applicationId` | Khi `kind` khác `COMMENT` | Hồ sơ phải thuộc ứng viên ở đường dẫn và nằm trong phạm vi người gọi |
| `kind` | | Mặc định `COMMENT` |
| `suggestion.toStageId` | Khi `SUGGEST_MOVE` | Vòng phải thuộc tin của hồ sơ |
| `suggestion.reasonId` | Khi `SUGGEST_REJECT` | Phải là lý do loại (`REJECTION`) |
| `mentionIds` | | Tối đa 20 id nhân viên được nhắc |

`SUGGEST_OFFER` không cần `suggestion`. **Chỉ người có vai trò `MANAGER` gửi được bình luận loại `SUGGEST_*`** (L15);
người khác, kể cả `ADMIN` và `HR`, nhận 403 `RECRUIT_SUGGESTION_FORBIDDEN`, nên FE chỉ hiện nút đề xuất cho
trưởng phòng. **Response 201:** `ApiSuccess<RecruitmentComment>`.

Tác dụng phụ: sự kiện `COMMENTED`; người trong `mentionIds` (trừ chính người viết) nhận thông báo N-10 "được nhắc";
bình luận loại `SUGGEST_*` gửi N-17 cho HR phụ trách tin của hồ sơ. Hai thông báo này chỉ có trong ứng dụng và push,
không có email.

Lỗi: 400 `RECRUIT_APPLICATION_REQUIRED` (đề xuất mà thiếu hồ sơ), `RECRUIT_APPLICATION_NOT_FOUND` (hồ sơ không thuộc
ứng viên), `RECRUIT_STAGE_NOT_IN_JOB`, `RECRUIT_REASON_INVALID`; 403 `RECRUIT_SCOPE_FORBIDDEN`, `RECRUIT_SUGGESTION_FORBIDDEN`; 404
`RECRUIT_CANDIDATE_NOT_FOUND`, `RECRUIT_APPLICATION_NOT_FOUND`; 409 `RECRUIT_CANDIDATE_ANONYMIZED`.

### Email gửi ứng viên

```typescript
export interface RecruitmentEmailLog {
  id: number;
  candidateId: number | null;
  applicationId: number | null;
  offerId: number | null;
  interviewId: number | null;
  templateId: number | null;
  purpose: 'APPLICATION_RECEIVED' | 'INTERVIEW_INVITE' | 'INTERVIEW_RESCHEDULED' | 'INTERVIEW_CANCELLED'
    | 'REJECTION' | 'OFFER' | 'WELCOME' | 'STAGE_AUTO' | 'CUSTOM' | 'OFFER_LETTER' | 'SMTP_TEST';
  purposeLabel: string;
  channel: 'COMPANY_SMTP' | 'SYSTEM' | null;     // chốt lúc gửi (BR-17); null khi chưa gửi
  channelLabel: string | null;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'CANCELLED' | 'SKIPPED';
  statusLabel: string;              // Chờ gửi · Đã gửi · Lỗi · Huỷ · Bỏ qua (môi trường thử)
  toEmail: string | null;
  subject: string | null;
  body: string | null;              // HTML đã dựng
  attachments: string[];            // tên file đính kèm, ví dụ ["phong-van.ics"]
  scheduledAt: string | null;       // có giá trị = email hẹn giờ
  sentAt: string | null;
  attempts: number;
  error: string | null;
  sentBy: RecruitmentPerson | null; // null = hệ thống gửi
  createdAt: string;
}
```

#### GET /v1/recruitment/candidates/:id/emails — Lịch sử email

Email đã gửi, đang chờ hoặc đã huỷ của ứng viên, mới nhất trước. Cần `recruitment:read` và xem được ứng viên.
**Response:** `ApiSuccess<RecruitmentEmailLog[]>`. Email có `status: "PENDING"` và `scheduledAt` là email đang hẹn
giờ: hiện nút "Huỷ gửi" cho người có `recruitment:manage`.

- Lọc theo phạm vi như bình luận và lịch sử: người xem toàn công ty thấy mọi email; MANAGER chỉ thấy email chung
  (`applicationId: null`) và email gắn với hồ sơ trong phạm vi của mình.
- Email offer: link phản hồi trong `body` đã bị che phần bí mật của token (`…/offer-response?token=<mã công
  ty>.[đã ẩn]`). Token chỉ đi tới hộp thư ứng viên; HR ghi nhận phản hồi thay ứng viên bằng `record-response`.

#### POST /v1/recruitment/candidates/:id/emails — Gửi email tay

Gửi theo mẫu hoặc soạn tay, ngay hoặc hẹn giờ (F-17). Cần `recruitment:manage`.

**Body:**

```json
{ "templateId": 5, "applicationId": 101, "sendAt": "2026-11-23T01:00:00.000Z" }
```
```json
{ "subject": "Bổ sung hồ sơ", "body": "<p>Chào {ten_ung_vien}, …</p>" }
```

| Field | Ghi chú |
|---|---|
| `templateId` | Mẫu email đang dùng; email lấy mục đích của mẫu |
| `subject`, `body` | Bắt buộc khi không có `templateId`. `subject` ≤ 300, `body` là HTML ≤ 50.000 ký tự. Email ghi mục đích `CUSTOM` |
| `applicationId` | Hồ sơ của chính ứng viên này; có thì biến `{vi_tri}` được điền tên tin |
| `sendAt` | ISO; trống là gửi ngay |

Biến dùng được khi soạn tay là `{ten_ung_vien}`, `{vi_tri}`, `{ten_cong_ty}`; mọi giá trị được escape HTML.

**Response 201:** `ApiSuccess<RecruitmentEmailLog>` với `status: "PENDING"`. Email đi qua hàng đợi, nên trạng thái
chuyển sang `SENT`, `FAILED` hoặc `SKIPPED` sau vài giây đến vài phút: FE tải lại lịch sử email thay vì báo "Đã gửi".
SMTP công ty lỗi thì BE thử lại sau 1, 5, 15 phút rồi mới đặt `FAILED` và gửi N-12 cho người gửi.

Lỗi: 400 `RECRUIT_CANDIDATE_NO_EMAIL`, `RECRUIT_EMAIL_CONTENT_REQUIRED`, `RECRUIT_SEND_AT_PAST` (giờ hẹn đã qua quá một
phút), `RECRUIT_TEMPLATE_NOT_FOUND` (mẫu không có hoặc đã ngừng dùng), `RECRUIT_APPLICATION_NOT_FOUND` (hồ sơ không
thuộc ứng viên); 404 `RECRUIT_CANDIDATE_NOT_FOUND`, `RECRUIT_APPLICATION_NOT_FOUND`; 409
`RECRUIT_CANDIDATE_ANONYMIZED`.

#### POST /v1/recruitment/emails/:id/cancel — Huỷ email đang chờ

`:id` là id nhật ký email. Không có body. Cần `recruitment:manage`. **Response: 204.** Email đã gửi, đã huỷ hoặc id
không tồn tại đều trả 409 `RECRUIT_EMAIL_NOT_PENDING`.

### Nhập Excel và tải nhiều CV

Ba route của F-09, đều cần `recruitment:manage`.

#### GET /v1/recruitment/candidate-imports/template

Trả file `mau-nhap-ung-vien.xlsx` gồm sheet "Ứng viên" (một dòng mẫu) và sheet "Hướng dẫn". Gọi bằng
`responseType: 'blob'`, lấy tên file từ `Content-Disposition`. Các cột: Họ tên (*), Email, Số điện thoại, Ngày sinh
(dd/mm/yyyy), Giới tính (Nam/Nữ/Khác), Trình độ, Trường, Số năm kinh nghiệm, Vị trí hiện tại, Công ty hiện tại, Nguồn,
Tag (cách nhau dấu phẩy), Mã tin (VD TD-2026-0012), Căn cứ dữ liệu, Ghi chú căn cứ.

#### POST /v1/recruitment/candidate-imports

**Content-Type:** `multipart/form-data`, field `file` (.xlsx theo mẫu, tối đa 2.000 dòng).

**Response 201:** `ApiSuccess<RecruitmentImportResult>`

```typescript
export interface RecruitmentImportResult {
  created: number;
  errors: { row: number; message: string }[];   // row là số dòng trong file Excel
}
```

```json
{
  "success": true,
  "data": {
    "created": 18,
    "errors": [
      { "row": 5, "message": "Phải có email hoặc số điện thoại" },
      { "row": 9, "message": "Trùng ứng viên #38 (gộp tay ở màn Ứng viên)" }
    ]
  }
}
```

Mỗi dòng độc lập: dòng hợp lệ được tạo, dòng lỗi trả về kèm số dòng để người dùng sửa file rồi nhập lại. Dòng trùng
email hoặc SĐT với ứng viên đã có bị trả lỗi, không tự gộp. Nguồn và tag phải có sẵn trong danh mục. Có mã tin thì BE
tạo hồ sơ ở vòng Ứng tuyển của tin đó. Bỏ trống "Căn cứ dữ liệu" thì hiểu là "Ứng viên gửi CV ứng tuyển".

Lỗi cả file (400): `RECRUIT_FILE_REQUIRED`, `RECRUIT_IMPORT_INVALID_FILE` (không đọc được hoặc thiếu cột "Họ tên (*)"),
`RECRUIT_IMPORT_TOO_MANY_ROWS`.

#### POST /v1/recruitment/candidates/bulk-cv — Tải nhiều CV một lần

**Content-Type:** `multipart/form-data`, field `files` lặp lại cho từng file (tối đa 50 file, mỗi file theo quy tắc CV:
PDF, DOC, DOCX, JPG, PNG ≤ 5 MB) và `jobId` tuỳ chọn.

Mỗi file thành một ứng viên **nháp** (`isDraft: true`), họ tên tạm lấy theo tên file, căn cứ dữ liệu là "Ứng viên gửi
CV ứng tuyển". Có `jobId` thì mỗi ứng viên có hồ sơ ở vòng Ứng tuyển của tin đó. HR mở từng ứng viên nháp để điền
email, SĐT; lần lưu đầu bỏ cờ nháp.

**Response 201:** `ApiSuccess<RecruitmentBulkCvResult[]>`

```typescript
export interface RecruitmentBulkCvResult {
  fileName: string;
  ok: boolean;
  candidateId: number | null;   // ứng viên nháp vừa tạo
  message: string | null;       // lý do khi ok = false
}
```

```json
{
  "success": true,
  "data": [
    { "fileName": "cv-nguyen-van-a.pdf", "ok": true, "candidateId": 46, "message": null },
    { "fileName": "anh-chup.heic", "ok": false, "candidateId": null, "message": "Chỉ nhận file PDF, DOC, DOCX, JPG, PNG" }
  ]
}
```

Lỗi cả request (400): `RECRUIT_FILE_REQUIRED`, `RECRUIT_IMPORT_TOO_MANY_ROWS` (quá 50 file), `RECRUIT_JOB_CLOSED`
(tin không có hoặc đã đóng).

---

## Hồ sơ ứng tuyển

Một hồ sơ ứng tuyển là một lần ứng viên nộp vào một tin. Theo BR-05, mỗi cặp (ứng viên, tin) có tối đa một hồ sơ đang
xét. Các route đọc cần `recruitment:read` và phạm vi; các route thay đổi trạng thái cần `recruitment:manage`. Trưởng
phòng không chuyển vòng hay loại được, mà gửi đề xuất qua bình luận (mục "Bình luận và đề xuất").

```typescript
// types/recruitment-application.types.ts

/** Thẻ kanban. */
export interface RecruitmentApplicationCard extends RecruitmentApplicationBrief {
  candidate: {
    id: number;
    fullName: string;
    email: string | null;
    phone: string | null;
    isBlacklisted: boolean | null;  // null khi người gọi không thấy blacklist
    isAnonymized: boolean;
    expectedSalary: number | null;  // null khi canViewSalary = false
  };
  score: number | null;             // trung bình các phiếu phỏng vấn đã nộp, mọi vòng (BR-07)
  verdicts: { PASS: number; FAIL: number; CONSIDER: number };   // số phiếu phỏng vấn đã nộp
  canViewSalary: boolean;
}

/** Trả về sau mỗi thao tác chuyển vòng, loại, rút, mở lại, thêm vào tin. */
export interface RecruitmentApplicationDetail extends RecruitmentApplicationBrief {
  cvFile: RecruitmentCandidateFile | null;    // CV của lần ứng tuyển này, không có URL
  candidate: RecruitmentCandidateProfile;
  canViewSalary: boolean;
  canSeeBlacklist: boolean;
}

/** Chi tiết hồ sơ khi mở trang hồ sơ. */
export interface RecruitmentApplicationView extends RecruitmentApplicationDetail {
  files: RecruitmentCandidateFile[];          // mọi file của ứng viên
}

/** Kết quả từng hồ sơ của thao tác hàng loạt. */
export interface RecruitmentBulkResult {
  id: number;                       // id hồ sơ ứng tuyển
  ok: boolean;
  code: string | null;              // mã lỗi khi ok = false
  message: string | null;
}
```

### GET /v1/recruitment/jobs/:jobId/applications — Kanban của tin

Mọi hồ sơ của một tin cho màn kanban (UI-05), không phân trang, sắp theo thời điểm vào vòng hiện tại (cũ trước). Cần
`recruitment:read` và tin phải trong phạm vi.

**Query:** `status` (`ACTIVE` · `REJECTED` · `WITHDRAWN` · `HIRED`), `stageId`. Kanban thường gọi `status=ACTIVE` rồi
nhóm theo `stage.id`; tab "Đã loại" gọi `status=REJECTED`.

**Response:** `ApiSuccess<RecruitmentApplicationCard[]>`

```json
{
  "success": true,
  "data": [
    {
      "id": 101,
      "candidateId": 45,
      "jobId": 12,
      "job": { "id": 12, "code": "TD-2026-0012", "title": "Backend Developer", "status": "OPEN", "statusLabel": "Đang mở" },
      "stage": { "id": 34, "name": "Phỏng vấn vòng 1", "kind": "INTERVIEW", "kindLabel": "Phỏng vấn", "order": 3 },
      "status": "ACTIVE",
      "statusLabel": "Đang xét",
      "source": { "id": 2, "name": "TopCV" },
      "rejectReason": null,
      "closedNote": null,
      "cvFileId": 8,
      "appliedAt": "2026-11-10T03:00:00.000Z",
      "stageEnteredAt": "2026-11-12T03:00:00.000Z",
      "closedAt": null,
      "hiredAt": null,
      "candidate": {
        "id": 45,
        "fullName": "Nguyễn Văn A",
        "email": "nguyenvana@gmail.com",
        "phone": "0912345678",
        "isBlacklisted": false,
        "isAnonymized": false,
        "expectedSalary": 25000000
      },
      "score": 3.8,
      "verdicts": { "PASS": 2, "FAIL": 0, "CONSIDER": 1 },
      "canViewSalary": true
    }
  ]
}
```

`score` là trung bình điểm các phiếu **phỏng vấn** đã nộp của hồ sơ ở mọi vòng, làm tròn một chữ số; chưa có phiếu nào
thì `null`. Điểm thi không tính vào đây. `score` và `verdicts` **chỉ tính những phiếu người gọi được thấy theo BR-08**
(xem mục Phỏng vấn và đánh giá): thành viên hội đồng chưa nộp phiếu của mình ở một vòng thì phiếu của vòng đó không được
tính, và nếu không còn phiếu nào được thấy thì `score: null`, `verdicts` toàn 0. Lỗi: 403 `RECRUIT_SCOPE_FORBIDDEN`, 404 `RECRUIT_JOB_NOT_FOUND`.

### GET /v1/recruitment/applications/:id — Chi tiết hồ sơ

Cần `recruitment:read`. Người trong phạm vi quản lý hoặc người ngồi hội đồng của tin đều mở được. Mỗi lần mở được ghi
nhật ký `recruitment.candidate_view`.

**Response:** `ApiSuccess<RecruitmentApplicationView>`

```json
{
  "success": true,
  "data": {
    "id": 101,
    "candidateId": 45,
    "jobId": 12,
    "job": { "id": 12, "code": "TD-2026-0012", "title": "Backend Developer", "status": "OPEN", "statusLabel": "Đang mở" },
    "stage": { "id": 34, "name": "Phỏng vấn vòng 1", "kind": "INTERVIEW", "kindLabel": "Phỏng vấn", "order": 3 },
    "status": "ACTIVE",
    "statusLabel": "Đang xét",
    "source": { "id": 2, "name": "TopCV" },
    "rejectReason": null,
    "closedNote": null,
    "cvFileId": 8,
    "appliedAt": "2026-11-10T03:00:00.000Z",
    "stageEnteredAt": "2026-11-12T03:00:00.000Z",
    "closedAt": null,
    "hiredAt": null,
    "cvFile": { "id": 8, "candidateId": 45, "kind": "CV", "kindLabel": "CV", "fileName": "cv-nguyen-van-a.pdf", "mimeType": "application/pdf", "sizeBytes": 245000, "createdAt": "2026-11-10T03:00:00.000Z" },
    "candidate": { /* RecruitmentCandidateProfile */ },
    "canViewSalary": true,
    "canSeeBlacklist": true,
    "files": [ /* RecruitmentCandidateFile[] */ ]
  }
}
```

Phiếu đánh giá của hồ sơ lấy riêng qua `GET /v1/recruitment/applications/:id/scorecards`. Lỗi: 403
`RECRUIT_SCOPE_FORBIDDEN`, 404 `RECRUIT_APPLICATION_NOT_FOUND`.

### POST /v1/recruitment/applications/:id/move — Chuyển vòng

**Body:** `{ "stageId": 35 }`. Cần `recruitment:manage`. **Response 201:** `ApiSuccess<RecruitmentApplicationDetail>`.

- Chỉ hồ sơ đang xét mới chuyển được, và vòng đích phải thuộc tin của hồ sơ.
- **Không chuyển thẳng vào vòng Đã tuyển** (`kind: HIRED`) bằng route này: hồ sơ vào vòng đó khi HR bấm "Tạo hồ sơ nhân
  viên" ở offer (F-16). FE nên chặn thả thẻ vào cột Đã tuyển; BE trả 400 `RECRUIT_STAGE_HIRED_RESERVED` nếu bị gọi.
- Chuyển sang đúng vòng hiện tại thì không có gì thay đổi.
- Mỗi lần chuyển sinh sự kiện `STAGE_CHANGED`. Vòng đích có gắn mẫu email tự gửi và ứng viên có email thì BE xếp
  email mục đích `STAGE_AUTO` vào hàng gửi ngay; vòng không gắn mẫu hay ứng viên không có email thì bỏ qua.
- Vòng đích gắn một mẫu email đã ngừng dùng (và ứng viên có email) thì BE trả 400 `RECRUIT_TEMPLATE_NOT_FOUND`
  **trước khi** ghi gì: hồ sơ giữ nguyên vòng cũ. FE báo HR sửa mẫu của vòng ở cài đặt quy trình. `bulk-move` báo lỗi
  này theo từng dòng.

Lỗi: 400 `RECRUIT_STAGE_NOT_IN_JOB`, `RECRUIT_STAGE_HIRED_RESERVED`, `RECRUIT_TEMPLATE_NOT_FOUND`; 404
`RECRUIT_APPLICATION_NOT_FOUND`; 409 `RECRUIT_APPLICATION_CLOSED` (hồ sơ không còn đang xét).

**Chuyển hàng loạt** — `POST /v1/recruitment/applications/bulk-move` với body
`{ "applicationIds": [101, 102], "stageId": 35 }` (1–200 hồ sơ). **Response 201:** `ApiSuccess<RecruitmentBulkResult[]>`;
mỗi hồ sơ xử lý riêng, hồ sơ lỗi không kéo hồ sơ khác:

```json
{
  "success": true,
  "data": [
    { "id": 101, "ok": true, "code": null, "message": null },
    { "id": 102, "ok": false, "code": "RECRUIT_APPLICATION_CLOSED", "message": "Hồ sơ không còn đang xét" }
  ]
}
```

### POST /v1/recruitment/applications/:id/reject — Loại

Cần `recruitment:manage`. **Response 201:** `ApiSuccess<RecruitmentApplicationDetail>` với `status: "REJECTED"`.

**Body:**

```json
{
  "reasonId": 2,
  "note": "Chưa đủ kinh nghiệm hệ thống lớn",
  "email": { "mode": "SCHEDULED", "sendAt": "2026-11-23T01:00:00.000Z", "templateId": 5 }
}
```

| Field | Bắt buộc | Ghi chú |
|---|---|---|
| `reasonId` | ✅ | Lý do loại đang dùng (loại `REJECTION`) |
| `note` | | ≤ 2000 ký tự |
| `email` | | Bỏ cả khối này thì BE coi như `{ mode: "SCHEDULED" }` |
| `email.mode` | Khi có khối `email` | `NOW` gửi ngay · `SCHEDULED` hẹn giờ · `NONE` không gửi |
| `email.sendAt` | | ISO, chỉ dùng khi `SCHEDULED`; trống thì BE tính theo BR-09 |
| `email.templateId` | | Mẫu email loại; trống thì dùng mẫu mặc định của mục đích `REJECTION` |

**Giờ gửi mặc định theo BR-09:** 24 giờ sau lúc bấm; rơi vào thứ Bảy, Chủ nhật hoặc ngoài 08:00–18:00 giờ Việt Nam thì
dời sang 08:00 ngày làm việc kế tiếp. Ví dụ loại lúc 22:00 thứ Sáu thì email đi lúc 08:00 thứ Hai. FE nên hiện giờ dự
kiến này trong hộp thoại Loại để người dùng biết.

Lý do có mã hệ thống `SPAM` thì BE không gửi email dù `mode` là gì. Ứng viên không có email, hoặc công ty không có mẫu
email loại nào đang dùng, thì BE bỏ qua email mà vẫn loại hồ sơ. Hồ sơ bị loại sinh sự kiện `REJECTED` và bắt đầu tính
thời hạn lưu dữ liệu (BR-06). Email hẹn giờ hiện trong lịch sử email với `status: "PENDING"` và `scheduledAt`.

BE kiểm theo thứ tự: hồ sơ còn đang xét (409), lý do (400), giờ hẹn (400), mẫu email (400), và chỉ đổi trạng thái khi
mọi thứ hợp lệ. Gặp lỗi thì hồ sơ **giữ nguyên**, FE giữ hộp thoại mở để người dùng sửa. `templateId` sai trả 400 kể cả
khi ứng viên không có email. `bulk-reject` báo lỗi theo từng dòng, dòng lỗi giữ nguyên trạng thái.

Lỗi: 400 `RECRUIT_REASON_INVALID`, `RECRUIT_SEND_AT_PAST`, `RECRUIT_TEMPLATE_NOT_FOUND`; 404
`RECRUIT_APPLICATION_NOT_FOUND`; 409 `RECRUIT_APPLICATION_CLOSED`.

**Loại hàng loạt** — `POST /v1/recruitment/applications/bulk-reject` với body như trên cộng `applicationIds` (1–200).
Mọi hồ sơ dùng cùng lý do và cùng cách gửi email. **Response 201:** `ApiSuccess<RecruitmentBulkResult[]>`.

### POST /v1/recruitment/applications/:id/withdraw — Ứng viên rút hồ sơ

**Body:** `{ "note": "Ứng viên báo đã nhận việc nơi khác" }`, `note` tuỳ chọn và tối đa 2000 ký tự. Cần
`recruitment:manage`. **Response 201:** `ApiSuccess<RecruitmentApplicationDetail>` với `status: "WITHDRAWN"`. Hồ sơ sinh
sự kiện `WITHDRAWN` và bắt đầu tính thời hạn lưu. Không có email nào được gửi.

Lỗi: 404 `RECRUIT_APPLICATION_NOT_FOUND`, 409 `RECRUIT_APPLICATION_CLOSED`.

### POST /v1/recruitment/applications/:id/reopen — Mở lại

Mở lại hồ sơ đã loại hoặc đã rút. Không có body. Cần `recruitment:manage`. **Response 201:**
`ApiSuccess<RecruitmentApplicationDetail>` với `status: "ACTIVE"`.

Hồ sơ trở lại đúng vòng nó đang nằm lúc bị đóng; lý do loại và ghi chú đóng bị xoá. Mọi email loại **đang hẹn giờ** của
hồ sơ bị huỷ (S-08), nên ứng viên không nhận thư từ chối sau khi được mở lại. Email loại đã gửi rồi thì không thu hồi
được.

Lỗi: 404 `RECRUIT_APPLICATION_NOT_FOUND`; 409 `RECRUIT_APPLICATION_NOT_CLOSED` (hồ sơ đang xét hoặc đã tuyển),
`RECRUIT_APPLICATION_ACTIVE_EXISTS` (ứng viên đã có hồ sơ khác đang xét ở tin này).

### GET /v1/recruitment/jobs/:id/applications/export — Xuất Excel ứng viên của tin (RP-07)

Xuất danh sách hồ sơ của một tin ra `ho-so-tin-<id>.xlsx`. Cần `recruitment:manage`, nên trưởng phòng nhận 403
`FORBIDDEN`. **Query:** `status`, `stageId`, giống bộ lọc của kanban. Gọi bằng `responseType: 'blob'`.

Các cột: Mã hồ sơ, Họ tên, Email, Số điện thoại, Vòng, Trạng thái, Nguồn, Ngày ứng tuyển, Lý do loại, Điểm phỏng vấn.
Cột "Không tái tuyển" (ghi lý do đánh dấu) chỉ có khi người xuất thấy được blacklist. Mỗi lần xuất ghi nhật ký
`recruitment.candidates_export`.

Lỗi: 403 `RECRUIT_SCOPE_FORBIDDEN`, 404 `RECRUIT_JOB_NOT_FOUND`.

---

## Phỏng vấn và đánh giá

Lịch phỏng vấn, phiếu đánh giá và điểm thi (F-11, F-12, F-13). Route quản lý ở `/v1/recruitment/...` cần vai trò quản
lý; người phỏng vấn và thành viên hội đồng dùng `/v1/me/recruitment/...` (mục sau). Riêng hai route lưu và nộp phiếu
đánh giá nằm dưới `/v1/me/recruitment/scorecards` cho **mọi** người đánh giá, kể cả HR.

```typescript
// types/recruitment-interview.types.ts

export interface RecruitmentInterview {
  id: number;
  application: { id: number; jobId: number; status: 'ACTIVE' | 'REJECTED' | 'WITHDRAWN' | 'HIRED'; statusLabel: string };
  candidate: RecruitmentPerson;
  job: { id: number; title: string };
  stage: { id: number; name: string; kind: string; kindLabel: string };
  startAt: string;                  // ISO
  endAt: string;
  mode: 'ONSITE' | 'ONLINE' | 'PHONE';
  modeLabel: string;                // Trực tiếp · Online · Điện thoại
  location: string | null;
  meetingUrl: string | null;
  note: string | null;
  status: 'SCHEDULED' | 'DONE' | 'NO_SHOW' | 'CANCELLED';
  statusLabel: string;              // Đã lên lịch · Đã diễn ra · Ứng viên vắng · Huỷ
  interviewers: RecruitmentPerson[];
  createdById: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentScorecard {
  id: number;
  applicationId: number;
  stage: { id: number; name: string; kind: string; kindLabel: string };
  interview: { id: number; startAt: string; endAt: string } | null;  // null = phiếu HR yêu cầu ngoài buổi phỏng vấn
  template: { id: number; name: string; kind: 'INTERVIEW' | 'TEST'; kindLabel: string };
  evaluator: RecruitmentPerson;
  kind: 'INTERVIEW' | 'TEST';
  kindLabel: string;
  status: 'PENDING' | 'SUBMITTED';
  statusLabel: string;              // Chờ đánh giá · Đã nộp
  verdict: 'PASS' | 'FAIL' | 'CONSIDER' | null;
  verdictLabel: string | null;      // Đạt · Không đạt · Cân nhắc
  comment: string | null;
  totalScore: number | null;        // làm tròn 1 chữ số (BR-07)
  criteria: {
    id: number;
    name: string;
    description: string | null;
    weight: number;                 // trọng số (phỏng vấn)
    maxScore: number | null;        // điểm tối đa (thi)
    passScore: number | null;       // điểm đạt (thi)
    order: number;
    isActive: boolean;
    score: number | null;           // điểm đã chấm; null khi chưa chấm
  }[];
  requestedById: number | null;     // HR yêu cầu đánh giá (F-12)
  submittedAt: string | null;
  editableUntil: string | null;     // submittedAt + 24 giờ (BR-08)
  createdAt: string;
  updatedAt: string;
}

export interface RecruitmentStageScorecards {
  stageId: number;
  stageName: string;
  scorecards: RecruitmentScorecard[];   // phiếu người gọi được thấy (BR-08)
  hiddenCount: number;                  // số phiếu của người khác đang bị ẩn
  score: number | null;                 // điểm vòng (BR-07); null khi chưa được xem
  verdicts: { PASS: number; FAIL: number; CONSIDER: number } | null;   // null khi chưa được xem
}
```

### GET /v1/recruitment/interviews — Lịch

Lịch tuần hoặc tháng, sắp theo giờ bắt đầu, gồm cả buổi đã huỷ. Cần `recruitment:read`.

**Query:**

| Param | Type | Bắt buộc | Ghi chú |
|-------|------|----------|---------|
| `from`, `to` | ISO 8601 | ✅ | `to` phải sau `from`, khoảng tối đa 62 ngày; buổi có `startAt` trong `[from, to)` |
| `jobId` | number | | |
| `interviewerId` | number | | Lọc theo một người phỏng vấn |

**Response:** `ApiSuccess<RecruitmentInterview[]>`

```json
{
  "success": true,
  "data": [
    {
      "id": 20,
      "application": { "id": 101, "jobId": 12, "status": "ACTIVE", "statusLabel": "Đang xét" },
      "candidate": { "id": 45, "fullName": "Nguyễn Văn A" },
      "job": { "id": 12, "title": "Backend Developer" },
      "stage": { "id": 34, "name": "Phỏng vấn vòng 1", "kind": "INTERVIEW", "kindLabel": "Phỏng vấn" },
      "startAt": "2026-11-20T07:00:00.000Z",
      "endAt": "2026-11-20T08:00:00.000Z",
      "mode": "ONLINE",
      "modeLabel": "Online",
      "location": null,
      "meetingUrl": "https://meet.google.com/abc-defg-hij",
      "note": null,
      "status": "SCHEDULED",
      "statusLabel": "Đã lên lịch",
      "interviewers": [{ "id": 5, "fullName": "Trần Thị Lan" }, { "id": 9, "fullName": "Phạm Minh Đức" }],
      "createdById": 3,
      "createdAt": "2026-11-12T03:00:00.000Z",
      "updatedAt": "2026-11-12T03:00:00.000Z"
    }
  ]
}
```

`MANAGER` thấy buổi của tin trong phạm vi và mọi buổi mình là người phỏng vấn. Lỗi: 400 `RECRUIT_RANGE_INVALID`.

`GET /v1/recruitment/interviews/:id` trả `ApiSuccess<RecruitmentInterview>` cho người phỏng vấn của buổi đó hoặc người
xem được hồ sơ. Lỗi: 403 `RECRUIT_SCOPE_FORBIDDEN`, 404 `RECRUIT_INTERVIEW_NOT_FOUND`.

### POST /v1/recruitment/applications/:id/interviews — Đặt lịch

Cần `recruitment:manage`. Hồ sơ phải đang xét và đang ở vòng loại `INTERVIEW` hoặc `TEST`.

**Body:**

```json
{
  "startAt": "2026-11-20T07:00:00.000Z",
  "endAt": "2026-11-20T08:00:00.000Z",
  "mode": "ONLINE",
  "meetingUrl": "https://meet.google.com/abc-defg-hij",
  "interviewerIds": [5, 9],
  "note": "Phỏng vấn chuyên môn",
  "scorecardTemplateId": 1,
  "notifyCandidate": true
}
```

| Field | Bắt buộc | Ghi chú |
|---|---|---|
| `startAt`, `endAt` | ✅ | ISO; kết thúc sau bắt đầu, một buổi tối đa 12 giờ. BE không chặn giờ đã qua, FE nên tự cảnh báo |
| `mode` | ✅ | `ONSITE` · `ONLINE` · `PHONE` |
| `location` | Khi `ONSITE` | ≤ 300 ký tự |
| `meetingUrl` | Khi `ONLINE` | URL `http(s)://` ≤ 500 ký tự, nhập tay (Q-11) |
| `interviewerIds` | ✅ | 1–10 nhân viên đang làm việc |
| `note` | | ≤ 2000 ký tự |
| `scorecardTemplateId` | | Mẫu đánh giá cùng loại với vòng; trống thì lấy mẫu gắn với vòng, rồi đến mẫu đang dùng đầu tiên cùng loại |
| `notifyCandidate` | | Mặc định `true`; `false` thì không gửi email mời ứng viên |

**Response 201:** `ApiSuccess<RecruitmentInterview>`

Tác dụng phụ, theo thứ tự:

1. Người phỏng vấn chưa ngồi hội đồng của tin được tự thêm vào hội đồng (L12), để mở được CV.
2. Mỗi người phỏng vấn có một phiếu đánh giá `PENDING` theo mẫu đã chọn. Không tìm được mẫu nào thì không tạo phiếu.
   Một người chỉ có một phiếu cho mỗi (hồ sơ, vòng), kể cả khi phỏng vấn nhiều buổi ở cùng vòng.
3. Sự kiện `INTERVIEW_SCHEDULED`.
4. Ứng viên có email và công ty có mẫu "Mời phỏng vấn" thì nhận email kèm `phong-van.ics` (`METHOD:REQUEST`).
5. Mỗi người phỏng vấn nhận N-04 trong ứng dụng, push, và email nội bộ kèm `.ics` của riêng mình.

File `.ics` giữ cùng `UID` suốt vòng đời buổi phỏng vấn và tăng `SEQUENCE` mỗi lần đổi hay huỷ, nên lịch Google hay
Outlook của người nhận cập nhật đúng sự kiện cũ thay vì tạo sự kiện mới.

| Mã lỗi | HTTP | Khi nào |
|---|---|---|
| `RECRUIT_INTERVIEW_TIME_INVALID` | 400 | Kết thúc không sau bắt đầu, hoặc dài quá 12 giờ |
| `RECRUIT_MEETING_URL_REQUIRED` | 400 | Online thiếu link họp |
| `RECRUIT_LOCATION_REQUIRED` | 400 | Trực tiếp thiếu địa điểm |
| `RECRUIT_INTERVIEWER_INVALID` | 400 | Có người không tồn tại hoặc đã nghỉ |
| `RECRUIT_SCORECARD_TEMPLATE_INVALID` | 400 | Mẫu chọn tay không có, đã ngừng dùng, hoặc khác loại vòng |
| `RECRUIT_APPLICATION_NOT_FOUND` | 404 | |
| `RECRUIT_APPLICATION_CLOSED` | 409 | Hồ sơ không còn đang xét |
| `RECRUIT_STAGE_NOT_INTERVIEW` | 409 | Hồ sơ không ở vòng Phỏng vấn hay Thi tuyển |

### PATCH /v1/recruitment/interviews/:id — Đổi lịch, đổi người

**Body:** các trường như khi đặt lịch, trường nào cũng tuỳ chọn. Cần `recruitment:manage`. Chỉ buổi `SCHEDULED` sửa
được. **Response 200:** `ApiSuccess<RecruitmentInterview>`.

- Mỗi lần lưu tăng `SEQUENCE` của `.ics` và sinh sự kiện `INTERVIEW_RESCHEDULED`.
- Ứng viên chỉ nhận email "Đổi lịch phỏng vấn" kèm `.ics` mới khi giờ, hình thức, địa điểm hay link thay đổi, và
  `notifyCandidate` không phải `false`. Chỉ đổi người phỏng vấn hay ghi chú thì ứng viên không nhận gì.
- Người phỏng vấn mới nhận N-04 "được giao" kèm `.ics`; người vẫn giữ nhận N-04 "đổi lịch" khi giờ hay địa điểm đổi;
  người bị bỏ khỏi buổi nhận N-04 "huỷ" kèm `.ics` `METHOD:CANCEL` để gỡ sự kiện khỏi lịch của họ.
- Người mới được thêm vào hội đồng và có phiếu `PENDING`. Phiếu chờ của người bị bỏ khỏi buổi **không** tự xoá.

Lỗi: như khi đặt lịch, thêm 404 `RECRUIT_INTERVIEW_NOT_FOUND` và 409 `RECRUIT_INTERVIEW_LOCKED` (buổi đã diễn ra, vắng
hoặc đã huỷ).

### POST /v1/recruitment/interviews/:id/cancel — Huỷ buổi

Không có body. Cần `recruitment:manage`. **Response 201:** `ApiSuccess<RecruitmentInterview>` với `status:
"CANCELLED"`.

Ứng viên có email luôn nhận email "Huỷ lịch phỏng vấn" kèm `.ics` `METHOD:CANCEL` (không có tuỳ chọn tắt). Mọi người
phỏng vấn nhận N-04 "huỷ" kèm `.ics` `METHOD:CANCEL`. Sự kiện `INTERVIEW_CANCELLED`. Phiếu đánh giá `PENDING` tự sinh
của buổi bị xoá với những người không còn buổi nào khác (chưa huỷ, chưa vắng) ở cùng hồ sơ và vòng; còn buổi khác thì
phiếu chuyển sang buổi đó. Phiếu do HR yêu cầu và phiếu đã nộp không bao giờ bị xoá. Sửa buổi mà bỏ bớt người phỏng vấn
(`PATCH`) cũng dọn phiếu của người bị bỏ theo cùng luật.

Lỗi: 404 `RECRUIT_INTERVIEW_NOT_FOUND`, 409 `RECRUIT_INTERVIEW_LOCKED` (buổi không còn `SCHEDULED`).

### POST /v1/recruitment/interviews/:id/status — Đã diễn ra, ứng viên vắng

**Body:** `{ "status": "DONE" }` hoặc `{ "status": "NO_SHOW" }`. Cần `recruitment:manage`. **Response 201:**
`ApiSuccess<RecruitmentInterview>`. Đổi qua lại giữa `DONE` và `NO_SHOW` được, nhưng không đưa buổi về `SCHEDULED`
được; buổi đã huỷ trả 409 `RECRUIT_INTERVIEW_LOCKED`. Sinh sự kiện `INTERVIEW_STATUS_CHANGED`, không gửi thông báo hay
email. `NO_SHOW` dọn phiếu `PENDING` tự sinh giống như huỷ buổi, để J-01 không nhắc chấm buổi ứng viên vắng.

### Mẫu đánh giá

Mẫu đánh giá (tiêu chí, trọng số cho phỏng vấn; môn, điểm tối đa, điểm đạt cho thi) quản lý ở
`/v1/recruitment/scorecard-templates` trong phần Cài đặt. Mẫu loại `INTERVIEW` dùng cho vòng Sơ loại và Phỏng vấn, mẫu
loại `TEST` dùng cho vòng Thi tuyển. Phiếu luôn lấy danh sách tiêu chí hiện hành của mẫu; tiêu chí đã ngừng dùng chỉ còn
hiện trên phiếu đã chấm tiêu chí đó.

### POST /v1/recruitment/scorecards/request — Yêu cầu đánh giá

HR nhờ một người đánh giá một hồ sơ ở một vòng mà không cần buổi phỏng vấn (F-12). Cần `recruitment:manage`.

**Body:** `{ "applicationId": 101, "stageId": 33, "evaluatorId": 9 }`

Vòng phải thuộc tin của hồ sơ và có loại `SCREENING`, `TEST` hoặc `INTERVIEW`. Mẫu lấy theo vòng, rồi đến mẫu đang dùng
đầu tiên cùng loại. Người đánh giá được thêm vào hội đồng của tin và nhận N-05 (trong ứng dụng và push, không email).
Người đó đã có phiếu `PENDING` ở vòng này thì BE trả lại phiếu cũ và nhắc lần nữa.

**Response 201:** `ApiSuccess<RecruitmentScorecard>`

Lỗi: 400 `RECRUIT_STAGE_NOT_IN_JOB`, `RECRUIT_INTERVIEWER_INVALID`, `RECRUIT_SCORECARD_TEMPLATE_INVALID` (chưa có mẫu
nào); 404 `RECRUIT_APPLICATION_NOT_FOUND`; 409 `RECRUIT_APPLICATION_CLOSED`, `RECRUIT_SCORECARD_SUBMITTED` (người đó đã
nộp phiếu vòng này).

### GET /v1/recruitment/applications/:id/scorecards — Phiếu theo vòng

Cần `recruitment:read` và xem được hồ sơ (phạm vi quản lý hoặc hội đồng). Thành viên hội đồng không có vai trò quản lý
gọi bản giống hệt ở `GET /v1/me/recruitment/applications/:id/scorecards`.

**Response:** `ApiSuccess<RecruitmentStageScorecards[]>`, một phần tử cho mỗi vòng **có ít nhất một phiếu**, theo thứ tự
vòng của tin.

```json
{
  "success": true,
  "data": [
    {
      "stageId": 34,
      "stageName": "Phỏng vấn vòng 1",
      "scorecards": [
        {
          "id": 60,
          "applicationId": 101,
          "stage": { "id": 34, "name": "Phỏng vấn vòng 1", "kind": "INTERVIEW", "kindLabel": "Phỏng vấn" },
          "interview": { "id": 20, "startAt": "2026-11-20T07:00:00.000Z", "endAt": "2026-11-20T08:00:00.000Z" },
          "template": { "id": 1, "name": "Phỏng vấn chuyên môn", "kind": "INTERVIEW", "kindLabel": "Phỏng vấn" },
          "evaluator": { "id": 5, "fullName": "Trần Thị Lan" },
          "kind": "INTERVIEW",
          "kindLabel": "Phỏng vấn",
          "status": "SUBMITTED",
          "statusLabel": "Đã nộp",
          "verdict": "PASS",
          "verdictLabel": "Đạt",
          "comment": "Nắm chắc kiến thức nền",
          "totalScore": 4.0,
          "criteria": [
            { "id": 3, "name": "Chuyên môn", "description": null, "weight": 3, "maxScore": null, "passScore": null, "order": 1, "isActive": true, "score": 4 },
            { "id": 4, "name": "Giao tiếp", "description": null, "weight": 1, "maxScore": null, "passScore": null, "order": 2, "isActive": true, "score": 3 },
            { "id": 5, "name": "Thái độ", "description": null, "weight": 1, "maxScore": null, "passScore": null, "order": 3, "isActive": true, "score": 5 }
          ],
          "requestedById": null,
          "submittedAt": "2026-11-20T09:00:00.000Z",
          "editableUntil": "2026-11-21T09:00:00.000Z",
          "createdAt": "2026-11-12T03:00:00.000Z",
          "updatedAt": "2026-11-20T09:00:00.000Z"
        }
      ],
      "hiddenCount": 0,
      "score": 3.7,
      "verdicts": { "PASS": 1, "FAIL": 0, "CONSIDER": 1 }
    }
  ]
}
```

**Cách tính điểm (BR-07).** Điểm một phiếu phỏng vấn là Σ(điểm × trọng số) ÷ Σ trọng số, làm tròn một chữ số; ví dụ
4 (×3), 3 (×1), 5 (×1) cho 20 ÷ 5 = 4,0. Điểm vòng (`score`) là trung bình các phiếu **phỏng vấn đã nộp** của vòng; hai
phiếu 4,0 và 3,4 cho 3,7. Phiếu thi không tính vào điểm vòng, nên vòng Thi tuyển có `score: null` và `verdicts` toàn 0;
xem điểm thi ở `totalScore` của từng phiếu. Kết luận cuối do HR chọn bằng cách chuyển vòng hay loại; hệ thống chỉ đếm
số phiếu theo kết luận.

**Ẩn phiếu người khác (BR-08).** Ở mỗi vòng, người gọi thấy mọi phiếu khi thoả một trong các điều kiện sau: có
`recruitment:manage`; có vai trò `ADMIN`, `HR`, `DIRECTOR` hoặc `CHIEF`; là HR phụ trách tin hoặc người tạo tin; đã nộp
phiếu của mình ở vòng đó; hoặc không có buổi phỏng vấn nào (chưa huỷ) ở vòng đó. Ngược lại, `scorecards` chỉ còn phiếu
của chính người gọi, `hiddenCount` là số phiếu đang ẩn, còn `score` và `verdicts` là `null`:

```json
{ "stageId": 34, "stageName": "Phỏng vấn vòng 1", "scorecards": [ /* chỉ phiếu của tôi */ ], "hiddenCount": 2, "score": null, "verdicts": null }
```

Khi được thấy phiếu người khác, phiếu **chưa nộp** của họ chỉ hiện trạng thái: `totalScore`, `verdict`, `comment` là `null`
và `scores` rỗng, để không lộ điểm nháp. Khi đó FE hiện dòng "Còn 2 phiếu của người khác, nộp phiếu của bạn để xem". Lỗi: 403 `RECRUIT_SCOPE_FORBIDDEN`, 404
`RECRUIT_APPLICATION_NOT_FOUND`.

### PUT /v1/me/recruitment/scorecards/:id, POST /v1/me/recruitment/scorecards/:id/submit — Lưu nháp, nộp phiếu

Chỉ chủ phiếu gọi được, ở bất kỳ vai trò nào. `PUT` lưu nháp và trả 200; `POST .../submit` nộp và trả 201. Cả hai trả
`ApiSuccess<RecruitmentScorecard>`.

**Body (cả hai route):**

```json
{
  "scores": [
    { "criterionId": 3, "score": 4 },
    { "criterionId": 4, "score": 3 },
    { "criterionId": 5, "score": 5 }
  ],
  "verdict": "PASS",
  "comment": "Nắm chắc kiến thức nền"
}
```

| Field | Ghi chú |
|---|---|
| `scores` | Tối đa 30 phần tử. Mỗi lần lưu **thay toàn bộ** điểm đã chấm, nên FE luôn gửi đủ danh sách hiện có trên form |
| `scores[].score` | Phiếu phỏng vấn: số nguyên 1–5. Phiếu thi: từ 0 đến điểm tối đa của môn, tối đa hai chữ số thập phân |
| `verdict` | `PASS` · `FAIL` · `CONSIDER`. Bắt buộc khi nộp phiếu phỏng vấn. Phiếu thi bỏ trống thì BE gợi ý Đạt khi mọi môn đạt điểm đạt |
| `comment` | ≤ 5000 ký tự; bỏ trống thì giữ nhận xét cũ |

Khi nộp, mọi tiêu chí đang dùng của mẫu phải có điểm. `totalScore` của phiếu phỏng vấn tính theo trọng số (BR-07); của
phiếu thi là tổng điểm các môn. Lần nộp đầu ghi `submittedAt`, sinh sự kiện `SCORECARD_SUBMITTED`, và mở cho người nộp
xem phiếu của người khác ở vòng đó (BR-08). Sau khi nộp, chủ phiếu vẫn sửa được trong 24 giờ tính từ lần nộp đầu
(`editableUntil`); quá hạn thì cả lưu lẫn nộp đều trả 409 `RECRUIT_SCORECARD_LOCKED`.

`verdict` không gửi thì BE giữ kết luận đã lưu; gửi `null` hoặc `""` thì xoá. Nộp phiếu mà không gửi `verdict` vẫn được
khi phiếu đã có kết luận lưu sẵn. Phiếu thi không gửi `verdict` thì BE gợi ý lại theo điểm.

| Mã lỗi | HTTP | Khi nào |
|---|---|---|
| `RECRUIT_CRITERION_INVALID` | 400 | Tiêu chí không thuộc mẫu hoặc đã ngừng dùng |
| `RECRUIT_SCORE_INVALID` | 400 | Điểm phỏng vấn ngoài 1–5 hoặc không nguyên; điểm thi vượt điểm tối đa |
| `RECRUIT_SCORE_MISSING` | 400 | Nộp khi còn tiêu chí chưa chấm (message liệt kê tên) |
| `RECRUIT_VERDICT_REQUIRED` | 400 | Nộp phiếu phỏng vấn thiếu kết luận |
| `RECRUIT_SCORECARD_NOT_YOURS` | 403 | Không phải chủ phiếu |
| `RECRUIT_SCORECARD_NOT_FOUND` | 404 | |
| `RECRUIT_SCORECARD_LOCKED` | 409 | Đã nộp quá 24 giờ |

### POST /v1/recruitment/test-results — Nhập điểm thi hàng loạt

HR nhập điểm thi cho nhiều hồ sơ cùng một vòng (F-13). Cần `recruitment:manage`.

**Body:**

```json
{
  "templateId": 4,
  "stageId": 33,
  "entries": [
    { "applicationId": 101, "scores": [{ "criterionId": 21, "score": 8 }, { "criterionId": 22, "score": 6.5 }] },
    { "applicationId": 102, "scores": [{ "criterionId": 21, "score": 4 }, { "criterionId": 22, "score": 7 }], "verdict": "FAIL" }
  ]
}
```

`templateId` phải là mẫu thi (`TEST`) đang dùng và `stageId` phải là vòng Bài test (`kind: TEST`) của tin; `entries` có 1–200 phần tử, mỗi phần tử 1–30 điểm. `verdict` chỉ nhận
`PASS` hoặc `FAIL`; bỏ trống thì BE gợi ý `PASS` khi mọi môn có điểm đạt đều đạt.

Mỗi hồ sơ thành một phiếu loại thi **đã nộp**, người đánh giá là người nhập, `totalScore` là tổng điểm các môn, và sinh
sự kiện `SCORECARD_SUBMITTED` với `test: true`. Nhập lại cho cùng hồ sơ và vòng thì ghi đè phiếu cũ của chính người
nhập, trong 24 giờ kể từ lần nhập đầu như mọi phiếu (BR-08). Hồ sơ không còn đang xét thì dòng đó lỗi.

**Response 201:** `ApiSuccess<RecruitmentTestResult[]>`, mỗi hồ sơ một dòng, dòng lỗi không kéo dòng khác:

```typescript
export interface RecruitmentTestResult {
  applicationId: number;
  ok: boolean;
  scorecardId: number | null;
  code: string | null;      // RECRUIT_APPLICATION_NOT_FOUND, RECRUIT_APPLICATION_CLOSED, RECRUIT_STAGE_NOT_IN_JOB (sai tin hoặc không phải vòng Bài test),
                            // RECRUIT_CRITERION_INVALID, RECRUIT_SCORE_INVALID, RECRUIT_SCORECARD_LOCKED
  message: string | null;
}
```

```json
{
  "success": true,
  "data": [
    { "applicationId": 101, "ok": true, "scorecardId": 61, "code": null, "message": null },
    { "applicationId": 102, "ok": false, "scorecardId": null, "code": "RECRUIT_SCORE_INVALID", "message": "Điểm \"Lập trình\" vượt điểm tối đa" }
  ]
}
```

Lỗi cả request: 400 `RECRUIT_SCORECARD_TEMPLATE_INVALID`.

---

## Hội đồng tuyển dụng — `/v1/me/recruitment`

Trang tự phục vụ cho người phỏng vấn và thành viên hội đồng (F-30, Q-09). Nhóm này chỉ cần đăng nhập, **không** kiểm
vai trò hay permission, nên `EMPLOYEE` dùng được; BE tự kiểm người gọi có ngồi hội đồng của tin, là người phỏng vấn của
buổi, hoặc là chủ phiếu. Người có phạm vi quản lý cũng gọi được các route xem hồ sơ ở nhóm này. Công ty chưa có module
thì mọi route trả 403 `MODULE_*` như phần còn lại; FE ẩn mục "Phỏng vấn của tôi" khi module không bật.

Những gì bị che ở nhóm này:

| Trường | Người ngồi hội đồng nhận gì |
|---|---|
| `candidate.expectedSalary` (thẻ kanban và chi tiết hồ sơ) | `null`, trừ khi người đó có cờ "xem offer" (`canViewOffer`) ở hội đồng của tin, hoặc có `recruitment:salary:read` hay `recruitment:manage`. Cờ `canViewSalary` của response cho biết điều này |
| `candidate.isBlacklisted`, `blacklistReason`, `blacklistedAt` | Luôn `null`, trừ người có `recruitment:manage`. `canSeeBlacklist` là `false` |
| Ứng viên trùng | Không có trường `duplicates` ở nhóm này |
| Lịch sử, email | Không có route lịch sử hay email cho hội đồng |
| Phiếu đánh giá của người khác | Ẩn theo BR-08 như mục trên |

Thông báo cho thành viên hội đồng (N-04, N-05, N-09, N-10) trỏ về trang tự phục vụ, không trỏ vào `/management/**`.

### GET /v1/me/recruitment/interviews — Phỏng vấn của tôi

**Query:** `scope=upcoming` (mặc định) hoặc `scope=pending-scorecards`.

- `upcoming` trả `ApiSuccess<RecruitmentInterview[]>`: các buổi `SCHEDULED` mà tôi là người phỏng vấn, bắt đầu từ 12
  giờ trước đến 90 ngày tới, sắp theo giờ bắt đầu. Buổi vừa diễn ra trong 12 giờ qua vẫn còn trong danh sách để tôi
  vào chấm phiếu.
- `pending-scorecards` trả `ApiSuccess<RecruitmentMyScorecard[]>`: mọi phiếu `PENDING` của tôi, cũ trước.

```typescript
export interface RecruitmentMyScorecard extends RecruitmentScorecard {
  candidate: RecruitmentPerson;
  job: { id: number; title: string };
}
```

```json
{
  "success": true,
  "data": [
    {
      "id": 62,
      "applicationId": 101,
      "stage": { "id": 34, "name": "Phỏng vấn vòng 1", "kind": "INTERVIEW", "kindLabel": "Phỏng vấn" },
      "interview": { "id": 20, "startAt": "2026-11-20T07:00:00.000Z", "endAt": "2026-11-20T08:00:00.000Z" },
      "template": { "id": 1, "name": "Phỏng vấn chuyên môn", "kind": "INTERVIEW", "kindLabel": "Phỏng vấn" },
      "evaluator": { "id": 9, "fullName": "Phạm Minh Đức" },
      "kind": "INTERVIEW",
      "kindLabel": "Phỏng vấn",
      "status": "PENDING",
      "statusLabel": "Chờ đánh giá",
      "verdict": null,
      "verdictLabel": null,
      "comment": null,
      "totalScore": null,
      "criteria": [ /* tiêu chí của mẫu, score: null */ ],
      "requestedById": null,
      "submittedAt": null,
      "editableUntil": null,
      "createdAt": "2026-11-12T03:00:00.000Z",
      "updatedAt": "2026-11-12T03:00:00.000Z",
      "candidate": { "id": 45, "fullName": "Nguyễn Văn A" },
      "job": { "id": 12, "title": "Backend Developer" }
    }
  ]
}
```

Bấm một phiếu thì mở form chấm, lưu và nộp bằng hai route ở mục "Lưu nháp, nộp phiếu". Phiếu của buổi đã huỷ vẫn nằm
trong danh sách này vì BE không xoá chúng.

`GET /v1/me/recruitment/interviews/:id` trả `ApiSuccess<RecruitmentInterview>` cho người phỏng vấn của buổi, hoặc người
ngồi hội đồng hay có phạm vi quản lý của tin. Lỗi: 403 `RECRUIT_SCOPE_FORBIDDEN`, 404 `RECRUIT_INTERVIEW_NOT_FOUND`.

### GET /v1/me/recruitment/jobs — Tin tôi ngồi hội đồng

Mọi tin tôi ngồi hội đồng, trừ tin nháp. Người không ngồi hội đồng nào nhận mảng rỗng.

```typescript
export interface RecruitmentMyJob {
  id: number;
  code: string;
  title: string;
  status: 'OPEN' | 'PAUSED' | 'CLOSED';
  statusLabel: string;
  department: RecruitmentRef | null;
  deadline: string | null;          // YYYY-MM-DD
  activeCount: number;              // tổng hồ sơ đang xét
  stages: { id: number; name: string; kind: string; kindLabel: string; order: number; activeCount: number }[]; // order bắt đầu từ 0
  team: { id: number; fullName: string }[]; // thành viên hội đồng, dùng cho ô nhắc tên (mentionIds) khi bình luận
}
```

```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "code": "TD-2026-0012",
      "title": "Backend Developer",
      "status": "OPEN",
      "statusLabel": "Đang mở",
      "department": { "id": 4, "name": "Phòng kỹ thuật" },
      "deadline": "2026-12-31",
      "activeCount": 9,
      "stages": [
        { "id": 31, "name": "Ứng tuyển", "kind": "APPLIED", "kindLabel": "Ứng tuyển", "order": 0, "activeCount": 3 },
        { "id": 34, "name": "Phỏng vấn vòng 1", "kind": "INTERVIEW", "kindLabel": "Phỏng vấn", "order": 3, "activeCount": 4 }
      ],
      "team": [
        { "id": 21, "fullName": "Phạm Quốc Khánh" },
        { "id": 35, "fullName": "Vũ Đức Bình" }
      ]
    }
  ]
}
```

`team` là mọi thành viên hội đồng của tin, gồm cả người được thêm vì được giao phỏng vấn. Thành viên hội đồng dùng danh
sách này để chọn người được nhắc khi bình luận ở `POST /v1/me/recruitment/applications/:id/comments`.

### GET /v1/me/recruitment/jobs/:id/applications — Hồ sơ của tin

Mọi hồ sơ của tin tôi ngồi hội đồng, cùng query (`status`, `stageId`) và cùng shape `RecruitmentApplicationCard[]` với
kanban ở trang quản lý. `candidate.expectedSalary` và `candidate.isBlacklisted` bị che như bảng trên. Lỗi: 403
`RECRUIT_SCOPE_FORBIDDEN` (không ngồi hội đồng tin này), 404 `RECRUIT_JOB_NOT_FOUND`.

### GET /v1/me/recruitment/applications/:id — Chi tiết hồ sơ

Thông tin ứng viên, CV và file (không có URL), kèm phiếu đánh giá theo vòng đã lọc theo BR-08. Mỗi lần mở được ghi nhật
ký `recruitment.candidate_view`.

**Response:** `ApiSuccess<RecruitmentTeamApplication>`

```typescript
export interface RecruitmentTeamApplication extends RecruitmentApplicationView {
  scorecards: RecruitmentStageScorecards[];
}
```

Ví dụ phần ứng viên mà một `EMPLOYEE` trong hội đồng (không có cờ xem offer) nhận được:

```json
{
  "candidate": {
    "id": 45,
    "fullName": "Nguyễn Văn A",
    "email": "nguyenvana@gmail.com",
    "phone": "0912345678",
    "expectedSalary": null,
    "isBlacklisted": null,
    "blacklistReason": null,
    "blacklistedAt": null
  },
  "canViewSalary": false,
  "canSeeBlacklist": false,
  "scorecards": [
    { "stageId": 34, "stageName": "Phỏng vấn vòng 1", "scorecards": [ /* phiếu của tôi */ ], "hiddenCount": 1, "score": null, "verdicts": null }
  ]
}
```

`GET /v1/me/recruitment/applications/:id/scorecards` trả riêng phần `scorecards`, dùng để tải lại sau khi nộp phiếu.
Lỗi: 403 `RECRUIT_SCOPE_FORBIDDEN`, 404 `RECRUIT_APPLICATION_NOT_FOUND`.

### GET /v1/me/recruitment/candidate-files/:id/url — Mở CV

Như route mở file ở trang quản lý, link sống 10 phút và mỗi lần lấy được ghi nhật ký `recruitment.candidate_file_view`.
Điều kiện là người gọi ngồi hội đồng của **một tin bất kỳ** mà ứng viên đã nộp. Route này chỉ xét hội đồng, nên người
có phạm vi quản lý mà không ngồi hội đồng dùng `GET /v1/recruitment/candidate-files/:id/url`. Lỗi: 403
`RECRUIT_SCOPE_FORBIDDEN`, 404 `RECRUIT_FILE_NOT_FOUND`.

### GET, POST /v1/me/recruitment/applications/:id/comments — Bình luận

**GET** trả `ApiSuccess<RecruitmentComment[]>`, mới nhất trước, gồm bình luận chung của ứng viên và bình luận gắn với
hồ sơ này.

**POST** nhận body như `POST /v1/recruitment/candidates/:id/comments`, nhưng hồ sơ luôn lấy theo đường dẫn: trường
`applicationId` trong body bị bỏ qua. Chỉ thành viên hội đồng có vai trò `MANAGER` gửi được `SUGGEST_*`, người
khác nhận 403 `RECRUIT_SUGGESTION_FORBIDDEN` và chỉ viết được bình luận thường (`COMMENT`). Tác dụng phụ giống hệt (N-10 cho người được nhắc, N-17 cho HR phụ trách tin khi là đề xuất).
**Response 201:** `ApiSuccess<RecruitmentComment>`.

Lỗi: 400 `RECRUIT_STAGE_NOT_IN_JOB`, `RECRUIT_REASON_INVALID`; 403 `RECRUIT_SCOPE_FORBIDDEN`, `RECRUIT_SUGGESTION_FORBIDDEN`; 404
`RECRUIT_APPLICATION_NOT_FOUND`, `RECRUIT_CANDIDATE_NOT_FOUND`; 409 `RECRUIT_CANDIDATE_ANONYMIZED`.

### Phiếu của tôi

Danh sách phiếu chờ là `GET /v1/me/recruitment/interviews?scope=pending-scorecards`. Lưu nháp và nộp phiếu dùng
`PUT /v1/me/recruitment/scorecards/:id` và `POST /v1/me/recruitment/scorecards/:id/submit`, mô tả ở mục "Phỏng vấn và
đánh giá". Hai route ghi này bị chặn khi module ở trạng thái chỉ xem.

---

## Offer

Offer gồm tạo, duyệt, gửi, phản hồi và chuyển thành nhân viên (F-14, F-15, F-16, F-24). Mỗi phiên bản là một bản ghi có
`id` riêng nhưng cùng `code` (`OF-2026-0003`); phiên bản mới trỏ về bản trước, bản cũ thành `SUPERSEDED`.

```typescript
// types/recruitment-offer.types.ts

export type RecruitmentOfferStatus =
  | 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'APPROVAL_REJECTED' | 'SENT'
  | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'NO_SHOW' | 'CANCELLED' | 'SUPERSEDED';
// Nhãn: Nháp · Chờ duyệt · Đã duyệt · Từ chối duyệt · Đã gửi · Đồng ý · Ứng viên từ chối
//       · Hết hạn · Không nhận việc · Huỷ · Đã có phiên bản mới

export interface RecruitmentOfferApprovalStep {
  id: number;
  round: number;                    // lần gửi duyệt; gửi lại sau khi bị từ chối thì tăng 1
  level: number;
  approver: RecruitmentPerson | null;       // bước chỉ định một người
  approverRole: 'DIRECTOR' | 'HR' | null;   // bước theo vai trò: ai có vai trò này đều duyệt được
  approverRoleLabel: string | null;
  approverLabel: string;            // tên người, hoặc tên vai trò
  basis: 'DEPARTMENT_MANAGER' | 'DIRECTOR_FALLBACK' | 'OVER_BAND';
  basisLabel: string;
  status: 'WAITING' | 'PENDING' | 'APPROVED' | 'REJECTED';
  statusLabel: string;              // Chưa tới lượt · Chờ duyệt · Đã duyệt · Từ chối
  decidedBy: RecruitmentPerson | null;
  decidedAt: string | null;
  note: string | null;
}

export interface RecruitmentOffer {
  id: number;
  code: string;                     // giữ nguyên qua các phiên bản
  version: number;
  status: RecruitmentOfferStatus;
  statusLabel: string;
  application: { id: number; status: string; statusLabel: string; appliedAt: string };
  candidate: { id: number; fullName: string; email: string | null; phone: string | null };
  job: { id: number; code: string; title: string };
  requisition: { id: number; code: string };
  department: RecruitmentRef;
  position: RecruitmentRef;
  level: string | null;
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'INTERN' | 'APPRENTICE' | 'CONTRACTOR';
  employmentTypeLabel: string;
  baseSalary: number | null;        // null khi canViewSalary = false
  probationGroup: 'NONE' | 'ENTERPRISE_MANAGER' | 'COLLEGE_OR_ABOVE' | 'INTERMEDIATE' | 'OTHER';
  probationGroupLabel: string;
  probationDays: number | null;
  probationSalary: number | null;   // null khi không thử việc hoặc canViewSalary = false
  startDate: string;                // YYYY-MM-DD
  probationEndDate: string | null;  // BE tính (BR-03)
  allowances: string | null;        // null khi canViewSalary = false
  responseDeadline: string;         // YYYY-MM-DD
  overBand: boolean;                // vượt khung lương (BR-10), chốt lúc gửi duyệt
  round: number;
  approvedAt: string | null;
  sentAt: string | null;
  hasSentPdf: boolean;              // có bản PDF đã gửi và người gọi được xem: lấy qua /pdf-url
  responseState: 'ACTIVE' | 'RESPONDED' | 'EXPIRED' | 'SUPERSEDED' | 'CANCELLED' | 'UNAVAILABLE';
  respondedAt: string | null;
  respondedVia: 'LINK' | 'HR' | null;
  respondedViaLabel: string | null; // Qua link · HR ghi nhận
  declineReason: RecruitmentRef | null;
  responseNote: string | null;
  noShowAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;      // lý do huỷ, hoặc lý do không nhận việc
  employee: { id: number; fullName: string; employeeCode: string } | null;   // F-16
  createdBy: RecruitmentPerson;
  createdAt: string;
  updatedAt: string;
  approvalSteps: RecruitmentOfferApprovalStep[];   // mọi vòng duyệt, theo vòng rồi theo cấp
  versions: { id: number; version: number; status: RecruitmentOfferStatus; statusLabel: string; sentAt: string | null }[];
  canViewSalary: boolean;
  canApprove: boolean;              // người gọi đang là người duyệt đến lượt
}
```

**Ai thấy số tiền.** `baseSalary`, `probationSalary`, `allowances` có giá trị khi người gọi có
`recruitment:salary:read` hoặc `recruitment:manage`, là người tạo offer, là người duyệt (đang đến lượt hoặc đã quyết
định) của offer, hoặc ngồi hội đồng có cờ "xem offer" của tin. Người khác nhận `null` kèm `canViewSalary: false`;
`probationDays` và các ngày không bị che. Mảng `versions` không bao giờ có số tiền.

### GET /v1/recruitment/offers — Danh sách

**Query:** `status`, `jobId`, `page`, `limit` (mặc định 1 và 20, tối đa 100). Cần `recruitment:read`.

**Response:** `ApiPaginated<RecruitmentOffer>`, mới tạo trước. Danh sách gồm mọi phiên bản, kể cả bản đã
`SUPERSEDED`, nên màn danh sách thường lọc theo trạng thái hoặc ẩn bản `SUPERSEDED` ở FE. `MANAGER` thấy offer của tin
trong phạm vi, offer mình tạo và offer mình là người duyệt.

### GET /v1/recruitment/offers/:id — Chi tiết

**Response:** `ApiSuccess<RecruitmentOffer>`

```json
{
  "success": true,
  "data": {
    "id": 10,
    "code": "OF-2026-0003",
    "version": 1,
    "status": "PENDING_APPROVAL",
    "statusLabel": "Chờ duyệt",
    "application": { "id": 101, "status": "ACTIVE", "statusLabel": "Đang xét", "appliedAt": "2026-11-10T03:00:00.000Z" },
    "candidate": { "id": 45, "fullName": "Nguyễn Văn A", "email": "nguyenvana@gmail.com", "phone": "0912345678" },
    "job": { "id": 12, "code": "TD-2026-0012", "title": "Backend Developer" },
    "requisition": { "id": 7, "code": "YCTD-2026-0007" },
    "department": { "id": 4, "name": "Phòng kỹ thuật" },
    "position": { "id": 15, "name": "Lập trình viên backend" },
    "level": "Senior",
    "employmentType": "FULL_TIME",
    "employmentTypeLabel": "Nhân viên chính thức",
    "baseSalary": 27000000,
    "probationGroup": "COLLEGE_OR_ABOVE",
    "probationGroupLabel": "Cần trình độ cao đẳng trở lên (tối đa 60 ngày)",
    "probationDays": 60,
    "probationSalary": 23000000,
    "startDate": "2026-12-01",
    "probationEndDate": "2027-01-29",
    "allowances": "Phụ cấp ăn trưa 730.000 đ/tháng",
    "responseDeadline": "2026-11-25",
    "overBand": true,
    "round": 1,
    "approvedAt": null,
    "sentAt": null,
    "hasSentPdf": false,
    "responseState": "UNAVAILABLE",
    "respondedAt": null,
    "respondedVia": null,
    "respondedViaLabel": null,
    "declineReason": null,
    "responseNote": null,
    "noShowAt": null,
    "cancelledAt": null,
    "cancelReason": null,
    "employee": null,
    "createdBy": { "id": 3, "fullName": "Lê Thu Hà" },
    "createdAt": "2026-11-18T02:00:00.000Z",
    "updatedAt": "2026-11-18T03:00:00.000Z",
    "approvalSteps": [
      {
        "id": 55, "round": 1, "level": 1,
        "approver": { "id": 6, "fullName": "Đỗ Văn Hùng" },
        "approverRole": null, "approverRoleLabel": null, "approverLabel": "Đỗ Văn Hùng",
        "basis": "DEPARTMENT_MANAGER", "basisLabel": "Trưởng phòng",
        "status": "APPROVED", "statusLabel": "Đã duyệt",
        "decidedBy": { "id": 6, "fullName": "Đỗ Văn Hùng" }, "decidedAt": "2026-11-18T03:00:00.000Z", "note": "Đồng ý"
      },
      {
        "id": 56, "round": 1, "level": 2,
        "approver": null,
        "approverRole": "DIRECTOR", "approverRoleLabel": "Giám đốc", "approverLabel": "Giám đốc",
        "basis": "OVER_BAND", "basisLabel": "Giám đốc (vượt khung lương)",
        "status": "PENDING", "statusLabel": "Chờ duyệt",
        "decidedBy": null, "decidedAt": null, "note": null
      }
    ],
    "versions": [{ "id": 10, "version": 1, "status": "PENDING_APPROVAL", "statusLabel": "Chờ duyệt", "sentAt": null }],
    "canViewSalary": true,
    "canApprove": false
  }
}
```

`responseState` cho biết link phản hồi của ứng viên đang ở trạng thái nào: `ACTIVE` khi offer đã gửi và chưa quá hạn,
`RESPONDED` khi đã đồng ý, từ chối hay không nhận việc, `EXPIRED`, `SUPERSEDED`, `CANCELLED`, và `UNAVAILABLE` khi offer
chưa gửi. Hiện nút Duyệt, Từ chối theo `canApprove`, đừng suy từ vai trò.

Lỗi: 403 `RECRUIT_SCOPE_FORBIDDEN`, 404 `RECRUIT_OFFER_NOT_FOUND`.

### POST /v1/recruitment/applications/:id/offers — Tạo offer

Tạo offer **Nháp** cho hồ sơ đang ở vòng Offer. Cần `recruitment:manage`. Phòng ban, vị trí lấy theo yêu cầu tuyển dụng
của tin; mã `OF-<năm>-<số>` tự sinh.

**Body:** `CreateOfferBody`

```json
{
  "level": "Senior",
  "employmentType": "FULL_TIME",
  "baseSalary": 22000000,
  "probationGroup": "COLLEGE_OR_ABOVE",
  "probationDays": 60,
  "probationSalary": 18700000,
  "startDate": "2026-12-01",
  "responseDeadline": "2026-11-25",
  "allowances": "Phụ cấp ăn trưa 730.000 đ/tháng"
}
```

| Field | Bắt buộc | Ghi chú |
|---|---|---|
| `baseSalary` | ✅ | Lương chính thức gross, số nguyên ≥ 1 |
| `startDate` | ✅ | `YYYY-MM-DD`, không trước hôm nay |
| `probationGroup` | | Mặc định `NONE`. `NONE` thì BE bỏ qua `probationDays`, `probationSalary` |
| `probationDays` | Khi có thử việc | 1–180; trần theo nhóm ở dưới |
| `probationSalary` | Khi có thử việc | Số nguyên ≥ 0, phải ≥ 85% lương chính thức |
| `responseDeadline` | | `YYYY-MM-DD`, từ hôm nay đến ngày bắt đầu. Trống thì BE đặt hôm nay + 5 ngày, không quá ngày bắt đầu |
| `employmentType` | | `FULL_TIME` · `PART_TIME` · `INTERN` · `APPRENTICE` · `CONTRACTOR`; trống thì lấy theo yêu cầu tuyển |
| `level` | | ≤ 100 ký tự |
| `allowances` | | ≤ 5000 ký tự |

**Luật thử việc.** BR-02: lương thử việc tối thiểu là `ceil(lương chính thức × 0,85 / 1000) × 1000`, ví dụ 22.000.000
cho tối thiểu 18.700.000. BR-03: trần số ngày theo nhóm là `ENTERPRISE_MANAGER` 180, `COLLEGE_OR_ABOVE` 60,
`INTERMEDIATE` 30, `OTHER` 6 ngày làm việc. BE tự tính `probationEndDate`: các nhóm đếm ngày lịch (bắt đầu + số ngày −
1, ví dụ 01/12/2026 + 60 ngày → 29/01/2027); nhóm `OTHER` đếm ngày làm việc, bỏ Chủ nhật, không trừ ngày lễ.

**Mọi lỗi điều khoản trả cùng lúc** trong `error.errors[]` (S-13); `error.code` là mã của lỗi đầu tiên, `error.message`
nối mọi thông điệp. Phần tử lỗi lương có `min`, phần tử lỗi số ngày có `max`, để FE gợi ý ngay trên ô nhập:

```json
{
  "success": false,
  "error": {
    "code": "RECRUIT_PROBATION_TOO_LONG",
    "message": "Số ngày thử việc vượt trần của nhóm (BR-03). Lương thử việc thấp hơn 85% lương chính thức (BR-02)",
    "errors": [
      { "code": "RECRUIT_PROBATION_TOO_LONG", "max": 60, "message": "Số ngày thử việc vượt trần của nhóm (BR-03)" },
      { "code": "RECRUIT_PROBATION_SALARY_TOO_LOW", "min": 18700000, "message": "Lương thử việc thấp hơn 85% lương chính thức (BR-02)" }
    ]
  }
}
```

```typescript
// Gắn lỗi vào đúng ô
const e = err.data?.error;
for (const x of e?.errors ?? []) {
  if (x.code === 'RECRUIT_PROBATION_SALARY_TOO_LOW') fieldErrors.probationSalary = `Tối thiểu ${formatMoney(x.min)}`;
  if (x.code === 'RECRUIT_PROBATION_TOO_LONG') fieldErrors.probationDays = `Tối đa ${x.max} ngày`;
  if (x.code === 'RECRUIT_PROBATION_SALARY_REQUIRED') fieldErrors.probationSalary = x.message;
  if (x.code === 'RECRUIT_PROBATION_DAYS_REQUIRED') fieldErrors.probationDays = x.message;
  if (x.code === 'RECRUIT_START_DATE_PAST') fieldErrors.startDate = x.message;
  if (x.code === 'RECRUIT_RESPONSE_DEADLINE_INVALID') fieldErrors.responseDeadline = x.message;
}
```

Sai kiểu dữ liệu (ví dụ `probationDays` quá 180, ngày sai định dạng) bị tầng kiểm DTO chặn trước với 400 `BAD_REQUEST`
và **không** có `errors[]`.

**Response 201:** `ApiSuccess<RecruitmentOffer>` với `status: "DRAFT"`, `version: 1`. Sinh sự kiện `OFFER_CREATED`.

| Mã lỗi | HTTP | Khi nào |
|---|---|---|
| `RECRUIT_PROBATION_SALARY_TOO_LOW`, `RECRUIT_PROBATION_SALARY_REQUIRED`, `RECRUIT_PROBATION_TOO_LONG`, `RECRUIT_PROBATION_DAYS_REQUIRED`, `RECRUIT_START_DATE_PAST`, `RECRUIT_RESPONSE_DEADLINE_INVALID` | 400 | Như trên, kèm `errors[]` |
| `RECRUIT_APPLICATION_NOT_FOUND` | 404 | |
| `RECRUIT_APPLICATION_CLOSED` | 409 | Hồ sơ không còn đang xét |
| `RECRUIT_STAGE_NOT_OFFER` | 409 | Hồ sơ chưa ở vòng Offer: chuyển vòng trước |
| `RECRUIT_OFFER_EXISTS` | 409 | Hồ sơ đã có offer Nháp, Chờ duyệt, Đã duyệt, Đã gửi hoặc Đồng ý: muốn đổi điều khoản thì tạo phiên bản mới |

### PATCH /v1/recruitment/offers/:id — Sửa nháp

**Body:** các trường như khi tạo, trường nào cũng tuỳ chọn. Cần `recruitment:manage`. Chỉ offer `DRAFT` sửa được; offer
ở trạng thái khác trả 409 `RECRUIT_OFFER_LOCKED`, muốn đổi điều khoản thì dùng `revise`. Offer vừa được gửi duyệt
trong lúc đang sửa cũng nhận 409 này (lương đã sửa không được nhận). Ngược lại, gửi duyệt đúng lúc offer vừa bị sửa
thì `submit` trả 409 `RECRUIT_OFFER_LOCKED` "Offer vừa được sửa hoặc gửi duyệt": FE tải lại offer rồi cho bấm lại. BE kiểm lại toàn bộ điều khoản
sau khi trộn với giá trị cũ, trả lỗi theo đúng dạng `errors[]` như khi tạo. **Response 200:**
`ApiSuccess<RecruitmentOffer>`.

### GET /v1/recruitment/offers/:id/preview.pdf, GET /v1/recruitment/offers/:id/pdf-url — Thư mời PDF

| Route | Ai gọi được | Trả về |
|---|---|---|
| `GET .../preview.pdf` | Người có `recruitment:manage`, hoặc người duyệt của offer | File PDF sinh tại chỗ từ dữ liệu hiện tại, **không lưu**. `Content-Type: application/pdf`, mở inline. Gọi bằng `responseType: 'blob'` rồi mở `URL.createObjectURL` |
| `GET .../pdf-url` | Người xem được offer và có `canViewSalary` | `ApiSuccess<{ url: string }>`, link 10 phút tới **bản PDF đã gửi** ứng viên |

Thư mời dùng mẫu "Thư mời nhận việc" đang dùng của công ty; chưa có mẫu thì dùng mẫu mặc định của hệ thống. Lỗi
`preview.pdf`: 403 `RECRUIT_SCOPE_FORBIDDEN`, 404 `RECRUIT_OFFER_NOT_FOUND`. Lỗi `pdf-url`: 403
`RECRUIT_SCOPE_FORBIDDEN`, `RECRUIT_OFFER_SALARY_FORBIDDEN`; 404 `RECRUIT_OFFER_NOT_FOUND`, `RECRUIT_OFFER_PDF_NOT_FOUND`
(offer chưa gửi). Hiện nút "Tải thư đã gửi" theo `hasSentPdf`.

### POST /v1/recruitment/offers/:id/submit — Gửi duyệt

Không có body. Cần `recruitment:manage`. Chỉ offer `DRAFT` gửi duyệt được. **Response 201:**
`ApiSuccess<RecruitmentOffer>` với `status: "PENDING_APPROVAL"`, `overBand` đã chốt và `approvalSteps` của vòng mới.

**Vượt khung (BR-10)** khi khung lương tối đa của yêu cầu tuyển trống, hoặc lương chính thức lớn hơn khung tối đa. Ví
dụ khung đến 25 triệu, offer 27 triệu là vượt. Cờ `overBand` chốt tại lúc gửi duyệt.

**Luồng duyệt** dựng theo "trưởng phòng" là người quản lý (`managerId`) của phòng tuyển, không phải mọi người có vai trò
`MANAGER`:

| Trường hợp | Bước 1 | Bước 2 |
|---|---|---|
| Phòng có trưởng phòng và người đó không phải người tạo offer, trong khung | Trưởng phòng (`DEPARTMENT_MANAGER`) | – |
| Như trên, vượt khung | Trưởng phòng (`DEPARTMENT_MANAGER`) | Vai trò `DIRECTOR` (`OVER_BAND`) |
| Phòng không có trưởng phòng, hoặc trưởng phòng là người tạo offer | Vai trò `DIRECTOR` (`DIRECTOR_FALLBACK`) | – |

Hiện `basisLabel` cạnh từng bước để người xem hiểu vì sao có bước Giám đốc. Bước theo vai trò thì ai đang làm việc có vai
trò đó đều duyệt được và đều nhận thông báo. Bước 2 ở `WAITING` cho tới khi bước 1 duyệt xong. Người duyệt đến lượt
nhận N-06 trong ứng dụng, push và email; J-08 nhắc lại mỗi ngày khi offer chờ quá một ngày.

Lỗi: 404 `RECRUIT_OFFER_NOT_FOUND`, 409 `RECRUIT_OFFER_LOCKED`. Offer bị từ chối duyệt không gửi duyệt lại trực tiếp
được: tạo phiên bản mới bằng `revise`, sửa rồi gửi duyệt phiên bản đó.

### POST /v1/recruitment/offers/:id/approve, POST /v1/recruitment/offers/:id/reject — Duyệt, từ chối

Chỉ cần `recruitment:read` ở tầng quyền; BE tự kiểm người gọi có phải người duyệt của bước đang chờ không. ADMIN duyệt
thay được mọi bước.

| Route | Body | Kết quả |
|---|---|---|
| `POST .../approve` | `{ "note"?: string ≤ 2000 }` | Bước hiện tại `APPROVED`. Còn bước sau thì bước đó thành `PENDING` và người duyệt kế tiếp nhận N-06. Hết bước thì offer `APPROVED`, sự kiện `OFFER_APPROVED`, người tạo offer nhận N-14 |
| `POST .../reject` | `{ "note": "Lương vượt ngân sách quý" }`, bắt buộc | Bước hiện tại `REJECTED`, offer `APPROVAL_REJECTED`, sự kiện `OFFER_APPROVAL_REJECTED`, người tạo offer nhận N-14 kèm lý do |

**Response 201:** `ApiSuccess<RecruitmentOffer>`. N-14 chỉ có trong ứng dụng và push.

Lỗi: 400 `RECRUIT_REASON_REQUIRED` (từ chối thiếu lý do); 403 `RECRUIT_APPROVAL_NOT_YOUR_TURN`; 404
`RECRUIT_OFFER_NOT_FOUND`; 409 `RECRUIT_APPROVAL_NOT_PENDING` (offer không chờ duyệt, hoặc người khác vừa quyết định
bước này).

### POST /v1/recruitment/offers/:id/send — Gửi offer cho ứng viên

Cần `recruitment:manage`. Chỉ offer `APPROVED` gửi được (S-14).

**Body:** `{ "responseDeadline"?: "YYYY-MM-DD", "templateId"?: number }`

Hạn phản hồi chọn theo thứ tự: `responseDeadline` gửi lên; không gửi thì hạn đã lưu trên offer nếu chưa qua; không nữa
thì ngày gửi + 5 ngày (không quá ngày bắt đầu). Hạn gửi lên ở quá khứ hoặc sau ngày bắt đầu thì 400
`RECRUIT_RESPONSE_DEADLINE_INVALID`. FE điền sẵn ô hạn trong hộp thoại Gửi bằng `offer.responseDeadline`. Offer hết hiệu lực
lúc 23:59:59 giờ Việt Nam của ngày hạn (BR-11).

BE làm theo thứ tự: sinh link phản hồi một lần dùng (BR-15), sinh và lưu bản PDF thư mời, đặt offer `SENT`, sinh sự kiện
`OFFER_SENT`, rồi xếp email mục đích `OFFER` gửi ngay cho ứng viên. Email theo mẫu `templateId` hoặc mẫu mặc định "Gửi
offer", kèm file `thu-moi-nhan-viec.pdf`; nút "Xem và phản hồi offer" trong email trỏ tới
`<FRONTEND_URL>/offer-response?token=…`. Token chỉ nằm trong email, không bao giờ trả ra API hay ghi log: lịch sử
email (`GET /candidates/:id/emails`) trả nội dung email offer với phần bí mật của token đã che.

**Response 201:** `ApiSuccess<RecruitmentOffer>` với `status: "SENT"`, `responseState: "ACTIVE"`, `hasSentPdf: true`.

Offer quá hạn mà ứng viên chưa phản hồi được J-04 chuyển sang `EXPIRED` lúc 00:05 hôm sau; hồ sơ ứng tuyển thành "Rút hồ
sơ" với ghi chú "Offer hết hạn, ứng viên không phản hồi", và người tạo offer, HR phụ trách tin, trưởng phòng nhận N-07.

Lỗi: 400 `RECRUIT_CANDIDATE_NO_EMAIL`, `RECRUIT_RESPONSE_DEADLINE_INVALID`, `RECRUIT_TEMPLATE_NOT_FOUND` (mẫu chọn
không hợp lệ, hoặc công ty không có mẫu email gửi offer nào đang dùng); 404 `RECRUIT_OFFER_NOT_FOUND`; 409
`RECRUIT_OFFER_NOT_APPROVED`.

### POST /v1/recruitment/offers/:id/revise — Phiên bản mới

Đổi điều khoản sau khi offer đã qua bước Nháp (F-15). Không có body. Cần `recruitment:manage`.

Gọi được khi offer ở `APPROVAL_REJECTED`, `APPROVED`, `SENT`, `DECLINED` hoặc `EXPIRED`. BE chuyển bản hiện tại sang
`SUPERSEDED` (link phản hồi cũ báo "Offer đã được cập nhật") và tạo phiên bản mới `DRAFT` cùng `code`, `version` tăng 1,
chép nguyên điều khoản của bản cũ. Phiên bản mới **luôn phải duyệt lại** dù trong hay ngoài khung (L17): HR sửa bằng
`PATCH`, rồi `submit`, rồi `send`. Offer cũ đang `DECLINED` hoặc `EXPIRED` thì hồ sơ ứng tuyển được mở lại thành đang
xét.

**Response 201:** `ApiSuccess<RecruitmentOffer>` của **phiên bản mới**, có `id` khác bản cũ: FE chuyển sang trang của id
mới. Hạn phản hồi chép từ bản cũ có thể đã qua; khi đó sửa ở `PATCH` hoặc truyền lại ở `send`.

Lỗi: 404 `RECRUIT_OFFER_NOT_FOUND`; 409 `RECRUIT_OFFER_NOT_REVISABLE`, `RECRUIT_APPLICATION_ACTIVE_EXISTS` (mở lại hồ sơ
nhưng ứng viên đã có hồ sơ khác đang xét ở tin này).

### POST /v1/recruitment/offers/:id/record-response — HR ghi nhận phản hồi

HR ghi lại câu trả lời của ứng viên qua điện thoại hay email, thay cho việc ứng viên bấm link. Cần `recruitment:manage`.

**Body:**

```json
{ "decision": "ACCEPT", "note": "Ứng viên gọi điện đồng ý ngày 22/11" }
```
```json
{ "decision": "DECLINE", "reasonId": 11, "note": "Đã nhận offer nơi khác" }
```

`reasonId` bắt buộc khi `DECLINE` và phải là lý do từ chối offer (`OFFER_DECLINE`) đang dùng; danh mục lấy ở
`GET /v1/recruitment/reasons`. `note` tối đa 2000 ký tự.

Kết quả: offer thành `ACCEPTED` hoặc `DECLINED` với `respondedVia: "HR"`, sinh sự kiện `OFFER_ACCEPTED` hoặc
`OFFER_DECLINED`. Từ chối thì hồ sơ ứng tuyển thành "Đã loại" với lý do "Ứng viên từ chối offer". Đồng ý thì BE tính
lại số đã tuyển của yêu cầu (BR-12): đủ số lượng thì yêu cầu sang `FILLED` và người tạo yêu cầu cùng HR phụ trách tin
nhận N-11. Người tạo offer, HR phụ trách tin và trưởng phòng (trừ chính người ghi nhận) nhận N-07 trong ứng dụng, push
và email.

**Response 201:** `ApiSuccess<RecruitmentOffer>`.

Lỗi: 400 `RECRUIT_REASON_INVALID`; 404 `RECRUIT_OFFER_NOT_FOUND`; 409 `RECRUIT_OFFER_NOT_SENT` (offer không ở trạng thái
chờ phản hồi), `RECRUIT_OFFER_EXPIRED` (đã quá hạn), `RECRUIT_OFFER_ALREADY_RESPONDED` (ứng viên vừa phản hồi qua link).

### POST /v1/recruitment/offers/:id/cancel — Huỷ offer

**Body:** `{ "reason": "Vị trí tạm dừng tuyển" }`, 3–2000 ký tự, bắt buộc. Cần `recruitment:manage`.

Huỷ được offer `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `APPROVAL_REJECTED` hoặc `SENT`; offer đã có phản hồi thì trả
409 `RECRUIT_OFFER_LOCKED`. Offer thành `CANCELLED`, sinh sự kiện `OFFER_CANCELLED`; link phản hồi của offer đã gửi báo
"Offer đã bị huỷ". BE **không** gửi email cho ứng viên và **không** đóng hồ sơ ứng tuyển, nên HR tự báo ứng viên và tự
loại hồ sơ nếu cần. **Response 201:** `ApiSuccess<RecruitmentOffer>`.

### POST /v1/recruitment/offers/:id/no-show — Không nhận việc

Ứng viên đã đồng ý nhưng không đến nhận việc (S-17). **Body:** `{ "reason": "Ứng viên không đến nhận việc" }`, 3–2000
ký tự, bắt buộc. Cần `recruitment:manage`. Chỉ offer `ACCEPTED` ghi nhận được, ngược lại 409
`RECRUIT_OFFER_NOT_ACCEPTED`.

Offer thành `NO_SHOW`, lý do lưu ở `cancelReason`, sinh sự kiện `OFFER_NO_SHOW`. Hồ sơ ứng tuyển còn đang xét thì thành
"Rút hồ sơ" với ghi chú "Không nhận việc: <lý do>". Offer `NO_SHOW` không còn tính vào số đã tuyển (BR-12), nên yêu cầu
đang `FILLED` quay về `RECRUITING` và chỉ tiêu được mở lại. Nếu đã tạo hồ sơ nhân viên từ offer này thì hồ sơ nhân viên
**không** bị động tới: HR xử lý cho nghỉ ở module Nhân viên. **Response 201:** `ApiSuccess<RecruitmentOffer>`.

### POST /v1/recruitment/offers/:id/hire — Chuyển thành nhân viên

Tạo hồ sơ nhân viên từ offer đã đồng ý (F-16, mục 11 của thiết kế). Cần `recruitment:manage`.

**Body:** `{ "existingEmployeeId"?: number }`. Bỏ trống để tạo nhân viên mới; truyền id để nối với một nhân viên đã có,
ví dụ HR đã tạo tay, hoặc lần gọi trước tạo xong nhân viên nhưng lỗi ở bước sau.

Điều kiện: offer `ACCEPTED`, chưa có nhân viên, và hồ sơ ứng tuyển còn đang xét. Tạo mới thì ứng viên phải có email.

Khi tạo mới, BE gọi đúng luồng tạo nhân viên của module Nhân viên với:

| Trường nhân viên | Lấy từ |
|---|---|
| Họ tên, email, SĐT (dạng chuẩn hoá), ngày sinh, giới tính, địa chỉ | Ứng viên |
| Phòng ban, vị trí | Offer |
| Ngày vào làm (`joinDate`) | Ngày bắt đầu của offer (Q-26) |
| Vai trò | `EMPLOYEE` |
| Loại hình | `PROBATION` khi offer có thử việc, ngược lại loại hình của offer |
| Trạng thái | `ACTIVE` ngay từ lúc tạo |

Lương và ngày kết thúc thử việc **không** được ghi vào hồ sơ nhân viên vì hồ sơ không có hai trường này (Q-29); hai số
đó nằm ở offer, HR tự tạo hợp đồng thử việc ở module Hợp đồng.

Tác dụng phụ:

1. Luồng tạo nhân viên tự tạo tài khoản và gửi email kích hoạt (hoặc lời mời nếu email đã có tài khoản ở công ty khác),
   và khởi tạo phép năm, như mọi nhân viên mới.
2. CV mới nhất của ứng viên (thiết kế mục 11) được đính vào giấy tờ nhân viên, loại `OTHER`, tên
   "CV - <tên file>", dùng chung file chứ không sao chép.
3. Trong một transaction: offer gắn `employee`, hồ sơ ứng tuyển thành "Đã tuyển" và vào vòng Đã tuyển, ứng viên gắn
   `employeeId`, sinh sự kiện `HIRED`.
4. Trưởng phòng của phòng tuyển và mọi nhân viên vai trò HR (trừ chính người bấm) nhận N-08 "Ứng viên đã thành nhân viên"
   trong ứng dụng, push và email, trỏ tới hồ sơ nhân viên mới.
5. Ứng viên nhận email chào mừng (mục đích `WELCOME`) nếu công ty có mẫu đang dùng.
6. BE tính lại số đã tuyển của yêu cầu (BR-12).

Ba ngày trước ngày bắt đầu, J-07 gửi lại N-08 dạng "Nhân viên mới sắp đi làm".

**Response 201:** `ApiSuccess<RecruitmentOffer>`, có `employee: { id, fullName, employeeCode }`; FE hiện link "Mở hồ sơ
nhân viên".

| Mã lỗi | HTTP | Khi nào |
|---|---|---|
| `RECRUIT_HIRE_EMAIL_REQUIRED` | 400 | Tạo mới mà ứng viên chưa có email: sửa ứng viên rồi gọi lại |
| `RECRUIT_OFFER_NOT_FOUND`, `RECRUIT_EMPLOYEE_NOT_FOUND`, `RECRUIT_CANDIDATE_NOT_FOUND` | 404 | |
| `RECRUIT_PIPELINE_INVALID` | 409 | Tin không có vòng Đã tuyển |
| `RECRUIT_HIRE_CONFLICT` | 409 | Tạo nhân viên trùng mã hoặc email với nhân viên khác (hai người bấm cùng lúc, hay email vừa được dùng): thử lại, hoặc gọi lại với `existingEmployeeId` |
| `RECRUIT_OFFER_NOT_ACCEPTED` | 409 | Offer chưa ở trạng thái Đồng ý |
| `RECRUIT_OFFER_ALREADY_HIRED` | 409 | Offer đã có hồ sơ nhân viên |
| `RECRUIT_APPLICATION_CLOSED` | 409 | Hồ sơ ứng tuyển không còn đang xét |
| `RECRUIT_EMPLOYEE_ALREADY_LINKED` | 409 | `existingEmployeeId` đã gắn với ứng viên hay offer khác |
| `CONFLICT` ("Email đã tồn tại"), `EMPLOYEE_ACCOUNT_IN_COMPANY` | 409 | Email ứng viên đã thuộc một nhân viên của công ty: dùng `existingEmployeeId` để nối |

Bước 1 có tác động ngoài transaction (tài khoản, email kích hoạt). Nếu bước 3 lỗi thì nhân viên đã được tạo nhưng offer
chưa gắn; khi đó HR gọi lại route này với `existingEmployeeId` của nhân viên vừa tạo để nối.

---

## Báo cáo và xuất

Tổng quan (F-20) và các báo cáo RP-01 đến RP-05, RP-07. Mọi route cần vai trò quản lý. Báo cáo theo phạm vi dùng
`recruitment:read`; báo cáo toàn công ty dùng `recruitment:report:read`, mà `MANAGER` mặc định không có.

| Route | Quyền | `MANAGER` |
|---|---|---|
| `GET /v1/recruitment/dashboard` | `recruitment:read` | Số liệu của phòng mình và tin mình ngồi hội đồng |
| `GET /v1/recruitment/reports/funnel` (+ `/export`) | `recruitment:read` | Theo phạm vi; mở tin phòng khác → 403 `RECRUIT_SCOPE_FORBIDDEN` |
| `GET /v1/recruitment/reports/headcount` (+ `/export`) | `recruitment:read` | Theo phạm vi; `departmentId` phòng khác → 403 `RECRUIT_SCOPE_FORBIDDEN` |
| `GET /v1/recruitment/reports/sources` (+ `/export`) | `recruitment:report:read` | 403 `FORBIDDEN` |
| `GET /v1/recruitment/reports/time-to-hire` | `recruitment:report:read` | 403 `FORBIDDEN` |
| `GET /v1/recruitment/reports/costs` (+ `/export`) | `recruitment:report:read` | 403 `FORBIDDEN` |
| `GET /v1/recruitment/jobs/:id/applications/export` (RP-07) | `recruitment:manage` | 403 `FORBIDDEN` |

FE ẩn tab báo cáo theo permission của người dùng, đừng suy từ vai trò. Ngày lọc (`from`, `to`) là ngày theo giờ Việt
Nam dạng `YYYY-MM-DD`, `to` tính hết ngày; `to` trước `from` trả 400 `RECRUIT_RANGE_INVALID`. Các route `/export` nhận
đúng query của route xem, trả file `.xlsx`; gọi bằng `responseType: 'blob'` và lấy tên file từ `Content-Disposition`.

### GET /v1/recruitment/dashboard — Tổng quan

**Query:** `year` (bắt buộc, 2000–2100), năm dùng cho phần định biên so với thực tế.

```typescript
export interface RecruitmentDashboard {
  openJobs: {
    id: number;
    code: string;
    title: string;
    deadline: string | null;                     // YYYY-MM-DD
    quantity: number;                            // số người cần tuyển của yêu cầu
    byStageKind: { kind: string; kindLabel: string; count: number }[];   // hồ sơ đang xét theo loại vòng
  }[];
  interviewsToday: number;
  interviewsThisWeek: number;                    // tuần tính từ thứ Hai
  overdueScorecards: number;                     // phiếu chưa nộp sau khi buổi phỏng vấn kết thúc quá 1 ngày
  offersPendingApproval: number;
  offersAwaitingResponse: number;                // offer đã gửi, chờ ứng viên phản hồi
  headcount: { confirmed: number; current: number; recruiting: number; available: number; overCommitted: number };
}
```

```json
{
  "success": true,
  "data": {
    "openJobs": [
      {
        "id": 12, "code": "TD-2026-0012", "title": "Backend Developer", "deadline": "2026-12-15", "quantity": 2,
        "byStageKind": [
          { "kind": "APPLIED", "kindLabel": "Ứng tuyển", "count": 3 },
          { "kind": "SCREENING", "kindLabel": "Sơ loại", "count": 2 },
          { "kind": "TEST", "kindLabel": "Thi tuyển", "count": 0 },
          { "kind": "INTERVIEW", "kindLabel": "Phỏng vấn", "count": 4 },
          { "kind": "OFFER", "kindLabel": "Offer", "count": 1 },
          { "kind": "HIRED", "kindLabel": "Đã tuyển", "count": 0 }
        ]
      }
    ],
    "interviewsToday": 2,
    "interviewsThisWeek": 7,
    "overdueScorecards": 1,
    "offersPendingApproval": 1,
    "offersAwaitingResponse": 2,
    "headcount": { "confirmed": 40, "current": 35, "recruiting": 3, "available": 2, "overCommitted": 0 }
  }
}
```

`headcount` cộng mọi dòng định biên của năm trong phạm vi người xem. `available` chỉ cộng phần còn trống dương;
`overCommitted` là **số dòng** định biên đang âm (định biên bị giảm xuống dưới số đang có), hiện cảnh báo khi lớn hơn 0.

### GET /v1/recruitment/reports/funnel — Phễu tuyển dụng (RP-01)

**Query:** `jobId`, `from`, `to` (lọc theo ngày ứng tuyển).

```typescript
export interface RecruitmentFunnel {
  total: number;                    // số hồ sơ trong bộ lọc
  stages: { key: string; label: string; reached: number; conversionRate: number | null }[];
  rejectionReasons: { reasonId: number; name: string; count: number }[];   // nhiều nhất trước
}
```

```json
{
  "success": true,
  "data": {
    "total": 40,
    "stages": [
      { "key": "APPLIED", "label": "Ứng tuyển", "reached": 40, "conversionRate": null },
      { "key": "SCREENING", "label": "Sơ loại", "reached": 25, "conversionRate": 62.5 },
      { "key": "TEST", "label": "Thi tuyển", "reached": 18, "conversionRate": 72.0 },
      { "key": "INTERVIEW", "label": "Phỏng vấn", "reached": 12, "conversionRate": 66.7 },
      { "key": "OFFER", "label": "Offer", "reached": 3, "conversionRate": 25.0 },
      { "key": "HIRED", "label": "Đã tuyển", "reached": 2, "conversionRate": 66.7 }
    ],
    "rejectionReasons": [{ "reasonId": 3, "name": "Không đủ kinh nghiệm", "count": 6 }]
  }
}
```

`reached` là số hồ sơ **từng đến** vòng đó hoặc một vòng sau nó, dựng từ lịch sử chuyển vòng, nên hồ sơ đã bị loại vẫn
được tính ở các vòng nó từng qua; hồ sơ đã ẩn danh cũng vẫn được đếm (S-18). `conversionRate` là phần trăm so với dòng
trước, dòng đầu là `null`. Không lọc `jobId` thì các dòng là sáu loại vòng chuẩn và `key` là mã loại vòng; lọc một tin
thì các dòng là các vòng của tin đó và `key` là id vòng dạng chuỗi.

`GET .../funnel/export` trả `pheu-tuyen-dung.xlsx`. Lỗi: 400 `RECRUIT_RANGE_INVALID`, 403 `RECRUIT_SCOPE_FORBIDDEN`, 404
`RECRUIT_JOB_NOT_FOUND`.

### GET /v1/recruitment/reports/sources — Hiệu quả nguồn (RP-02)

**Query:** `from`, `to` (ngày ứng tuyển), `departmentId` (phòng của tin), `sourceId`. Toàn công ty, cần
`recruitment:report:read`.

**Response:** `ApiSuccess<RecruitmentSourceRow[]>`

```typescript
export interface RecruitmentSourceRow {
  sourceId: number | null;          // null = hồ sơ chưa rõ nguồn
  sourceName: string;
  applications: number;
  passedScreening: number;          // từng đến vòng Thi tuyển, Phỏng vấn, Offer hoặc Đã tuyển
  hired: number;                    // đã tuyển, hoặc có offer Đồng ý
  hireRate: number | null;          // % được tuyển trên số hồ sơ
}
```

```json
{
  "success": true,
  "data": [
    { "sourceId": 1, "sourceName": "Trang tuyển dụng", "applications": 25, "passedScreening": 10, "hired": 2, "hireRate": 8.0 },
    { "sourceId": null, "sourceName": "Chưa rõ nguồn", "applications": 3, "passedScreening": 0, "hired": 0, "hireRate": 0 }
  ]
}
```

Báo cáo không có cột chi phí theo nguồn (L21); chi phí xem ở RP-05 theo tin. `GET .../sources/export` trả
`nguon-ung-vien.xlsx`. Lỗi: 400 `RECRUIT_RANGE_INVALID`, 403 `FORBIDDEN`.

### GET /v1/recruitment/reports/headcount (+ `/export`) — Định biên (RP-03)

**Query:** `year` (bắt buộc, 2000–2100), `departmentId` (tuỳ chọn). Bản xem trả `ApiSuccess<HeadcountRow[]>`, mỗi
dòng giống hệt một dòng của `GET /v1/recruitment/headcount-plans?year=` (xem phần Định biên), theo phạm vi người xem:
trưởng phòng chỉ thấy phòng mình. Bản `/export` trả `dinh-bien-<year>.xlsx` với các cột Phòng ban, Vị trí, Định biên
đã chốt, Đang có, Đang tuyển, Còn trống. Xem không ghi nhật ký, xuất thì ghi. Lỗi: 403 `RECRUIT_SCOPE_FORBIDDEN` khi
`departmentId` nằm ngoài phạm vi.

### GET /v1/recruitment/reports/time-to-hire — Thời gian tuyển (RP-04)

**Query:** `from`, `to` (lọc theo ngày ứng viên phản hồi offer; offer hết hạn tính theo ngày chuyển sang Hết hạn),
`departmentId`, `positionId`. Toàn công ty, cần `recruitment:report:read`. Không có bản xuất Excel.

```typescript
export interface RecruitmentTimeToHire {
  acceptedOffers: number;           // Đồng ý, kể cả sau đó không nhận việc
  declinedOffers: number;
  expiredOffers: number;
  offerAcceptanceRate: number | null;   // Đồng ý ÷ (Đồng ý + Từ chối + Hết hạn), %
  timeToFill: { average: number | null; median: number | null };   // ngày, từ lúc duyệt yêu cầu đến lúc ứng viên đồng ý
  timeToHire: { average: number | null; median: number | null };   // ngày, từ lúc ứng tuyển đến lúc ứng viên đồng ý
}
```

```json
{
  "success": true,
  "data": {
    "acceptedOffers": 6,
    "declinedOffers": 2,
    "expiredOffers": 1,
    "offerAcceptanceRate": 66.7,
    "timeToFill": { "average": 21.5, "median": 20 },
    "timeToHire": { "average": 14.2, "median": 13 }
  }
}
```

Chỉ tính phiên bản cuối của mỗi offer, vì bản đã có phiên bản mới mang trạng thái `SUPERSEDED` và không lọt vào báo cáo
(BR-14). Số ngày là ngày lịch theo giờ Việt Nam, trung bình làm tròn một chữ số. Lỗi: 400 `RECRUIT_RANGE_INVALID`, 403
`FORBIDDEN`.

### GET /v1/recruitment/reports/costs — Chi phí (RP-05)

**Query:** `from`, `to` (lọc theo ngày mở tin; bỏ trống thì lấy mọi tin đã từng mở). Toàn công ty, cần
`recruitment:report:read`.

**Response:** `ApiSuccess<RecruitmentCostRow[]>`

```typescript
export interface RecruitmentCostRow {
  jobId: number;
  code: string;
  title: string;
  departmentName: string;
  status: 'DRAFT' | 'OPEN' | 'PAUSED' | 'CLOSED';
  statusLabel: string;
  budget: number | null;
  actualCost: number | null;
  hires: number;                    // số hồ sơ Đã tuyển của tin
  costPerHire: number | null;       // actualCost ÷ hires, làm tròn đến đồng; null khi chưa tuyển ai hoặc chưa nhập chi phí
}
```

```json
{
  "success": true,
  "data": [
    { "jobId": 12, "code": "TD-2026-0012", "title": "Backend Developer", "departmentName": "Phòng kỹ thuật", "status": "CLOSED", "statusLabel": "Đã đóng", "budget": 10000000, "actualCost": 8500000, "hires": 2, "costPerHire": 4250000 }
  ]
}
```

Ngân sách và chi phí thực tế nhập ở tin tuyển dụng. `GET .../costs/export` trả `chi-phi-tuyen-dung.xlsx`. Lỗi: 400
`RECRUIT_RANGE_INVALID`, 403 `FORBIDDEN`.

### Xuất danh sách ứng viên của tin (RP-07)

Mô tả ở mục "Hồ sơ ứng tuyển", route `GET /v1/recruitment/jobs/:id/applications/export`.

### Nhật ký xem và xuất

Theo mục 22 của phiếu, BE ghi nhật ký hệ thống cả cho một số thao tác **đọc** hồ sơ ứng viên. Đây là ngoại lệ có chủ ý
của quy tắc "không ghi log GET". FE không phải làm gì, nhưng nên tránh gọi lặp các route dưới đây (ví dụ gọi lại chi
tiết mỗi lần chuyển tab), vì mỗi lần gọi là một dòng nhật ký.

| Hành động | Route | Mã nhật ký |
|---|---|---|
| Mở chi tiết ứng viên | `GET /v1/recruitment/candidates/:id` | `recruitment.candidate_view` |
| Mở chi tiết hồ sơ | `GET /v1/recruitment/applications/:id`, `GET /v1/me/recruitment/applications/:id` | `recruitment.candidate_view` |
| Lấy link CV, file | `GET /v1/recruitment/candidate-files/:id/url`, `GET /v1/me/recruitment/candidate-files/:id/url` | `recruitment.candidate_file_view` |
| Xuất danh sách ứng viên của tin | `GET /v1/recruitment/jobs/:id/applications/export` | `recruitment.candidates_export` |
| Xuất báo cáo | Mọi route `/v1/recruitment/reports/**/export` | `recruitment.report_export` |

Nhật ký chỉ chứa id và bộ lọc, không chứa dữ liệu cá nhân. Các route lịch sử, bình luận, email và danh sách không ghi
nhật ký xem.
