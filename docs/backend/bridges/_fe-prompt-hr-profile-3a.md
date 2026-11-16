# Prompt cho agent FE — Lô 3a hồ sơ nhân sự mở rộng

> User đã duyệt thiết kế lô 3a ngày 16/11/2026 ("duyệt"). Backend đã code xong và smoke trên sandbox. Việc của bạn là làm phần
> giao diện trên `nhan-su` theo đúng contract dưới đây.

## ① Repo và nhánh

- Repo FE: `/home/tuanpham/work/hr-system/nhan-su`, đang ở `develop` sạch. Tạo nhánh `feat/hr-profile` từ `develop`, nên dùng
  worktree riêng (ví dụ `/home/tuanpham/work/hr-system/.worktrees/fe-hr-profile`) để không đụng session khác. Không đặt worktree
  trong `/tmp`.
- Backend nằm ở worktree `/home/tuanpham/work/hr-system/.worktrees/be-hr-profile` (nhánh `feat/hr-profile`, **chưa merge**). Không
  sửa repo BE.

## ② Đọc trước

1. `nhan-su/CLAUDE.md` (quy ước repo FE).
2. `docs/backend/bridges/hr-profile.md` — contract chính của lô 3a.
3. `docs/backend/bridges/employee-documents.md`, `employees.md`, `auth-profile.md`, `approval.md`, `social-insurance.md`,
   `employee-citizen-id-passport.md`, `positions.md`, `dashboard.md`, `fcm-notification-routing.json` — các chỗ lô 3a đổi.
4. Kiểu dữ liệu: khớp `/home/tuanpham/work/hr-system/.worktrees/be-hr-profile/docs/openapi.json` (bản sống của nhánh BE), **không**
   dùng `nhan-su/docs/api-endpoint.json` (đã cũ).

## ③ Thay đổi API

Mới (chi tiết ở `hr-profile.md`):

| Nhóm | Endpoint |
|---|---|
| Hồ sơ mở rộng người khác | `GET/PATCH /v1/employees/:id/profile`, `GET /v1/employees/:id/private-profile` (ghi nhật ký mỗi lần gọi) |
| Thân nhân | `GET/POST /v1/employees/:id/relatives`, `PATCH/DELETE /v1/employees/:id/relatives/:relativeId` |
| Kinh nghiệm | `GET/POST /v1/employees/:id/work-experiences`, `PATCH/DELETE .../:experienceId` |
| Lịch sử công tác | `GET /v1/employees/:id/employment-history` (giao diện ở lô 3d, chưa làm) |
| Tự phục vụ | `GET /v1/me/profile`, `POST /v1/me/profile/private` (mật khẩu), `PATCH /v1/me/profile/contact`, `GET/POST/PATCH/DELETE /v1/me/emergency-contacts`, `GET /v1/me/work-experiences` |
| Yêu cầu thay đổi (nhân viên) | `POST/GET /v1/me/profile-change-requests`, `POST /v1/me/profile-change-requests/:id/cancel`, `POST /v1/me/profile-change-requests/documents` |
| Yêu cầu thay đổi (người duyệt) | `GET /v1/profile-change-requests`, `GET /:id`, `GET /:id/documents/:documentId/url`, `POST /:id/approve`, `POST /:id/reject` |
| Loại giấy tờ | `GET/POST /v1/employee-document-types`, `PATCH /:id` |

Đổi ở endpoint có sẵn:

| Endpoint | Đổi |
|---|---|
| `GET/POST/PATCH /v1/employees...` | Thêm `genderCode` (mã), `gender` vẫn là nhãn. Thêm `terminationReason`, `terminationReasonLabel`. `PATCH` nhận `effectiveDate`, `historyNote`. `GET /:id` trưởng phòng chỉ phòng mình (403 `EMPLOYEE_SCOPE_FORBIDDEN`) |
| `POST /v1/employees/:id/terminate` | `terminationReason` **bắt buộc** |
| Tài liệu nhân viên | `documentTypeId` thay `type`; thêm `issuedDate`, `expiryDate`, `note`, `relativeId`; response thêm `typeLabel` theo danh mục, `isSensitive`, `uploadedBy`... Loại nhạy cảm cần `employee:private:read` |
| `PATCH /v1/auth/profile` | Họ tên, email, ngày sinh, giới tính → tạo yêu cầu, response có `pendingChangeRequestId` |
| `GET /v1/approval/counts` | Thêm `profileChanges` |
| `PUT /v1/social-insurance/:id` | Bỏ qua `taxCode`, `dependents`, `dependentDetails`; `taxInfo` đọc từ hồ sơ, `dependentDetails[]` có `relationshipCode`, `endDate`, `relativeId` |
| CCCD | Thêm `expiryDate`, `birthRegistrationPlace` |
| Chức vụ | Thêm `jobGroup`, `jobGroupLabel` |
| Dashboard | `genderBreakdown[]` thêm `genderCode` |
| Nhập Excel nhân viên | Cột tuỳ chọn 25 Ngân hàng, 26 Số tài khoản, 27 Chủ tài khoản |

Quyền mới: `employee:private:read`, `employee:profile-change:approve`, `employee:document-type:manage` (HR mặc định có cả ba).
Thông báo mới: `PROFILE_CHANGE_REQUESTED`, `PROFILE_CHANGE_DECIDED`, `PROFILE_UPDATED_BY_HR` (mục 10 của `hr-profile.md`).

## ④ Màn hình và file phải sửa

| Mã | Màn hình | File (hiện có) |
|---|---|---|
| UI-01 | Chi tiết nhân viên, tab Thông tin: khối "Thông tin thêm"; khối "Ngân hàng và thuế" ẩn, nút **Xem** chỉ hiện khi có `employee:private:read`; form sửa thêm ô **Ngày hiệu lực**, **Ghi chú** khi đổi phòng ban, chức vụ, quản lý, loại lao động; giới tính thành ô chọn (gửi mã); bảng kinh nghiệm nhỏ; hộp nghỉ việc thêm ô **Lý do nghỉ việc** bắt buộc | `app/pages/management/employees/[id].vue`, `app/composables/useEmployee.ts`, `app/services/employee.service.ts`, `app/types/employee.types.ts`, `app/pages/management/employees/new.vue` |
| UI-02 | Chi tiết nhân viên, tab **Thân nhân** (mới): bảng, cột liên hệ khẩn cấp, người phụ thuộc, giảm trừ từ/đến (MM/yyyy), trạng thái đăng ký; thêm, sửa, xoá; hiện `warnings` BR-04 sau khi lưu. Chỉ hiện tab khi có `employee:private:read` | mới, trong `app/components/modules/employee/` |
| UI-03 | Tab Tài liệu: nhóm theo loại, ngày cấp, ngày hết hạn (tô màu sắp hết hạn), người tải; form tải lấy loại từ danh mục | `EmployeeDocuments.vue`, `UploadDocumentModal.vue`, `app/composables/useEmployeeDocuments.ts`, `app/services/employee-document.service.ts` |
| UI-04 | Trang cá nhân: khối liên hệ sửa ngay; khối nhạy cảm (nhập mật khẩu) có nút "Đề nghị thay đổi" theo mục; liên hệ khẩn cấp; tab **Yêu cầu của tôi** (`?tab=requests&id=` mở đúng yêu cầu); tài liệu của tôi; kinh nghiệm | `app/pages/profile/index.vue`, `app/components/modules/profile/*` |
| UI-05 | Trang Phê duyệt, tab `profileChanges`: danh sách; chi tiết so ba cột Lúc gửi / Đề nghị / Hiện tại từ `fields` (tô cảnh báo dòng `current` khác `before`); giấy tờ kèm theo mở qua link ký; duyệt, từ chối bắt buộc lý do | `app/pages/management/approval/index.vue`, `app/services/approval.service.ts` |
| UI-06 | Cài đặt, **Loại giấy tờ**: danh sách (kèm loại đã tắt), thêm, sửa, tắt | `app/pages/management/settings/` (trang mới hoặc tab trong `index.vue`) |
| — | Danh mục chức vụ: ô nhóm vị trí việc làm | `app/pages/management/positions/index.vue` |
| — | BHXH: bỏ ô MST, số người phụ thuộc, bảng người phụ thuộc khỏi form; hiện chỉ đọc kèm link sang hồ sơ | `EmployeeSocialInsurance.vue`, `ProfileSocialInsurance.vue`, `app/types/social-insurance.types.ts` |
| — | CCCD: hai ô mới | `EmployeeCitizenId.vue` |
| — | Nhập Excel: thêm ba cột 25–27 vào file mẫu và mô tả "File gồm 27 cột" | `EmployeeImportModal.vue`, `public/import-templates/employees-import-template.xlsx` |
| — | Thông báo: định tuyến ba `type` mới theo `refType` | `app/utils/notification-route.ts`, `app/types/notification.types.ts` |

Nhãn enum (giới tính, hôn nhân, trình độ, quan hệ, trạng thái đăng ký, lý do nghỉ việc, nhóm vị trí) server trả sẵn ở trường
`...Label`; ô chọn cần danh sách nhãn thì khai trong FE theo bảng ở `hr-profile.md`, đừng hiện mã.

## ⑤ Kịch bản smoke FE (bấm thật, mọi vai trò)

Sandbox BE: API `http://localhost:3150` (Postgres 55450, Redis 56460), CORS cho `http://localhost:4020`. Chạy FE ở cổng **4020**
với `NUXT_PUBLIC_BASE_API_URL=http://localhost:3150` (file `.env` riêng cho sandbox, đừng sửa `.env.local`). Tài khoản và mật khẩu
ở `/tmp/claude-1000/-home-tuanpham-work-hr-system-hr-system-be/59411ccd-e298-4126-96c4-d007b1b55ef3/scratchpad/sandbox-3a.json`
(HR `hr01@cta.drill`, HR thứ hai `hr02@cta.drill`, giám đốc `gd01`, trưởng phòng KD `qlkd`, trưởng phòng KT `qlkt`, nhân viên
`kd01`, `kd02`, `kt01`, `kto01`, ADMIN `admin@cta.drill`).

| # | Vai trò | Kịch bản | Kỳ vọng |
|---|---|---|---|
| F-01 | HR | Mở KD01, khối Ngân hàng và thuế, bấm Xem, nhập ngân hàng, số tài khoản có dấu cách | Lưu được, số hiển thị không dấu cách; MST hiện số CCCD kèm chú thích "lấy từ CCCD" |
| F-02 | Trưởng phòng KD | Mở KD01 | Không thấy nút Xem, không thấy tab Thân nhân, tài liệu không có giấy khám sức khoẻ |
| F-03 | Trưởng phòng KD | Mở KT01 bằng URL | Toast lỗi 403 có câu tiếng Việt, không trắng trang |
| F-04 | HR | Tab Thân nhân KD01: thêm con là người phụ thuộc từ 15/01/2025 | Hiện "01/2025", trạng thái Chưa đăng ký; thêm cùng số định danh cho KD02 thì hiện cảnh báo vàng |
| F-05 | HR | Thêm người phụ thuộc quan hệ Khác không tick Sống cùng | Báo lỗi tiếng Việt, form không đóng |
| F-06 | KD01 | Trang cá nhân đổi số điện thoại | Lưu ngay, không tạo yêu cầu |
| F-07 | KD01 | Đề nghị đổi số tài khoản, kèm một file | Yêu cầu Chờ duyệt hiện ngay dưới khối; HR nhận thông báo, badge Phê duyệt tăng |
| F-08 | HR | Tab Thông tin nhân sự ở Phê duyệt, mở yêu cầu F-07 | Ba cột cũ/mới/hiện tại, mở được file; từ chối không ghi lý do bị chặn; duyệt thì KD01 nhận thông báo, hồ sơ đổi |
| F-09 | HR | Sửa ngân hàng của KD01 khi KD01 có yêu cầu đang chờ, rồi duyệt yêu cầu | Dòng hiện tại tô cảnh báo; duyệt báo lỗi 409 bằng tiếng Việt |
| F-10 | HR01 | Gửi yêu cầu đổi họ tên của chính mình, tự duyệt | Bị chặn với câu tiếng Việt; HR02 duyệt được |
| F-11 | KD01 | Liên hệ khẩn cấp: thêm mẹ làm liên hệ chính; sửa con (người phụ thuộc) qua liên hệ khẩn cấp | Thêm được, người chính cũ bỏ cờ; sửa người phụ thuộc báo phải gửi yêu cầu |
| F-12 | HR | Đổi phòng ban KD02 với ngày hiệu lực sau hôm nay | Lỗi tiếng Việt ở ô ngày |
| F-13 | ADMIN | Cho KD02 nghỉ việc không chọn lý do | Không gửi được |
| F-14 | HR | Tải giấy khám sức khoẻ có ngày cấp, bỏ trống ngày hết hạn | Ngày hết hạn tự là +12 tháng |
| F-15 | HR | Cài đặt, Loại giấy tờ: thêm, tắt, đổi mã loại mặc định | Thêm và tắt được; đổi mã loại mặc định báo lỗi |
| F-16 | HR | Chức vụ: đặt nhóm vị trí việc làm | Lưu và hiện nhãn |
| F-17 | HR | Mở form BHXH của KD01 | Không còn ô MST, số người phụ thuộc; dòng chỉ đọc khớp hồ sơ |
| F-18 | Mọi vai trò | Bấm từng thông báo mới | Mở đúng trang theo `targetUrl` |
| F-19 | — | Trạng thái tải, rỗng (nhân viên chưa có thân nhân, chưa có yêu cầu), phân trang danh sách yêu cầu | Không trắng trang |

Cộng `npx vitest run` và `nuxt build` (`npm --prefix <worktree FE> run build`); `nhan-su` không có script `typecheck`.

## ⑥ Báo lại

1. Danh sách file đã sửa, đã thêm.
2. Bảng smoke `# | Vai trò | Kịch bản | Kỳ vọng | Thực tế | ✓/✗`, kèm kết quả vitest và build (exit code).
3. Chỗ contract trong bridge doc lệch với API thật hoặc thiếu (ghi cụ thể endpoint, trường, response thật).

## ⑦ Giới hạn

- **Không sửa repo BE**, không chạy lệnh nào chạm database thật; chỉ dùng sandbox ở trên.
- **Không tự workaround ở FE một contract sai của BE**: báo lại để BE sửa.
- Không commit, không push; người điều phối sẽ chạy cổng bảo mật và commit khi user đồng ý.
- Không ghi đè cả thư mục `docs/backend/bridges/`.
