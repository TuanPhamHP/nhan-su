# Bàn giao FE — hiện phân hệ chưa mua ở trạng thái khoá (17/11/2026)

Yêu cầu của chủ sản phẩm: lưới chọn phân hệ phải hiện cả phân hệ mà công ty chưa đăng ký. Phân hệ đó ở trạng thái
khoá (mờ, không vào được); bấm vào thì mở hộp thoại báo công ty chưa mua phân hệ này. Việc này chỉ sửa FE, BE không đổi.

## ① Repo, nhánh

- Repo `nhan-su`. Tạo worktree mới **ngoài `/tmp`** (máy khởi động lại là mất):
  `git -C /home/tuanpham/work/hr-system/nhan-su worktree add /home/tuanpham/work/hr-system/.worktrees/fe-module-lock -b feat/module-launcher-lock develop`,
  rồi `ln -s /home/tuanpham/work/hr-system/nhan-su/node_modules /home/tuanpham/work/hr-system/.worktrees/fe-module-lock/node_modules`.
- Không đụng worktree `fe-approval` (lô 4a, chưa commit).

## ② Đọc trước

- `nhan-su/CLAUDE.md`.
- `docs/backend/bridges/entitlements.md` (đã khớp bản BE, `diff` = 0).
- `app/composables/useAppModules.ts`, `app/components/layout/AppLauncher.vue`, `app/components/layout/AppSidebar.vue`
  (khối "Phân hệ" ở trang chủ, khoảng dòng 364–397), `app/composables/useModuleAccess.ts`,
  `app/middleware/module-guard.global.ts`, `app/components/common/AppModuleNotice.vue`, `app/utils/module-expiry.ts`,
  `app/config/app-modules.ts`, `app/types/navigation.types.ts`.

## ③ Thay đổi API

Không có. `GET /v1/me/entitlements` đã trả **mọi** module trong danh mục, kể cả module chưa mua
(`state: "DISABLED"`, `reason: "NOT_SUBSCRIBED"`). Chỉ `ASSET`, `RECRUIT` và `AI_AGENT` tắt được; các module khác
luôn `ENABLED`. Trong lưới, chỉ hai ô **Tuyển dụng** (`rec`, mọi mục là `RECRUIT`) và **Quản lý tài sản** (`ast`, mọi
mục là `ASSET`) có thể bị khoá.

## ④ Việc phải làm

Hiện trạng: `useAppModules.ts` (dòng 55–62) bỏ mọi mục có `module` mà `canUse` trả false; app hết mục thì biến mất.
Vì vậy công ty chưa mua thì không thấy ô Tuyển dụng, Quản lý tài sản đâu cả.

1. **Khai module của cả phân hệ.** Thêm `module?: ModuleCode` vào `AppModuleDef` cho app mà toàn bộ mục thuộc một
   module bán riêng (`rec` → `RECRUIT`, `ast` → `ASSET`). App gộp nhiều thứ (`chr`, `tal`) giữ cách lọc từng mục như cũ.
2. **`useAppModules` trả thêm danh sách phân hệ khoá.** App có `module` mà `canUse(module)` là false thì không bỏ đi,
   mà đánh dấu khoá. Chỉ hiện ô khoá cho người mà nếu công ty mua thì thấy được ít nhất một mục (lọc vai trò và quyền
   như cũ, chỉ bỏ qua điều kiện module). `visibleApps`, `currentApp`, "Gần đây" và nút mở lưới ở header vẫn chỉ tính
   phân hệ dùng được: ô khoá không bao giờ vào mục "Gần đây".
3. **Lưới (`AppLauncher.vue`).** Ô khoá nằm đúng nhóm của nó, mờ đi, có biểu tượng ổ khoá và nhãn ngắn "Chưa đăng ký"
   (hoặc "Tạm ngưng", "Đã hết hạn" theo `reason`). Tìm kiếm vẫn ra ô khoá. Bấm ô khoá thì **không chuyển trang**, mở
   hộp thoại.
4. **Hộp thoại** (một component dùng chung, theo modal sẵn có của app). Tiêu đề là tên phân hệ, kèm mô tả của phân hệ.
   Câu chính theo `reason`:
   - `NOT_SUBSCRIBED`: "Công ty bạn chưa đăng ký phân hệ <tên>."
   - `SUSPENDED`: "Phân hệ <tên> đang tạm ngưng với công ty bạn."
   - `LAPSED`: dùng `moduleLapsedMessage(label)` có sẵn.

   Câu hướng dẫn: ADMIN đọc "Liên hệ nhà cung cấp phần mềm để đăng ký thêm phân hệ này."; người khác đọc "Bạn liên hệ
   quản trị viên của công ty nếu cần dùng phân hệ này." Không ghi số điện thoại hay email vì hệ thống chưa có thông tin
   này. Có một nút "Đóng"; Esc và bấm ra ngoài cũng đóng.
5. **Sidebar trang chủ (`AppSidebar.vue`, khối "Phân hệ").** Hiện cả ô khoá, cùng kiểu mờ và ổ khoá, bấm mở cùng hộp
   thoại (dùng `button`, không dùng `NuxtLink` cho ô khoá).
6. **Không đổi:** `module-guard.global.ts` (gõ thẳng URL vẫn toast rồi chuyển trang); module `READ_ONLY` hoặc hết hạn
   còn trong thời gian chỉ xem (`EXPIRED`) vẫn vào được như cũ, không khoá; danh sách entitlement rỗng (chưa nạp được)
   thì mọi ô mở như cũ.

## ⑤ Scenario phải smoke (bấm thật, có ảnh desktop 1440 và điện thoại 390)

Sandbox API `http://localhost:3170` (đã chạy, CORS cho cổng 4020 và 4021). Tài khoản và mật khẩu chung ở
`/home/tuanpham/work/hr-system/.sandbox-4a/sandbox-4a.json` (`people.<khoá>.email`, `password`). Công ty `cta`: Tài sản
**đã mua**, Tuyển dụng **chưa mua**. Công ty `old` (`admin@old.drill`): chưa mua cả hai. Đổi trạng thái module trên
sandbox bằng:
`node /home/tuanpham/work/hr-system/.sandbox-4a/set-module-4a.cjs <cta|old> <ASSET|RECRUIT> <ENABLED|READ_ONLY|DISABLED|NONE> [hạn YYYY-MM-DD]`
(chỉ ghi vào container tạm; hạn trong quá khứ dưới 14 ngày là hết hạn chỉ xem, quá 14 ngày là tắt hẳn). Đăng nhập lại
hoặc tải lại trang sau khi đổi.

| # | Kịch bản | Mong đợi |
|---|---|---|
| L-01 | `admin@cta.drill` mở lưới | Quản lý tài sản mở như thường; Tuyển dụng mờ, có ổ khoá, nhãn "Chưa đăng ký" |
| L-02 | Bấm ô Tuyển dụng khoá | Hộp thoại "Công ty bạn chưa đăng ký phân hệ Tuyển dụng.", câu ADMIN; URL không đổi |
| L-03 | Tìm "ứng viên" trong lưới | Ra ô Tuyển dụng khoá |
| L-04 | Trước đó đã vào Tuyển dụng khi còn mua (đặt `ENABLED`, vào, rồi đặt `NONE`) | Ô khoá không còn trong "Gần đây" |
| L-05 | Trang chủ, sidebar "Phân hệ" | Có ô Tuyển dụng khoá, bấm mở cùng hộp thoại |
| L-06 | `admin@old.drill` | Cả Tuyển dụng và Quản lý tài sản đều khoá |
| L-07 | Đặt `cta RECRUIT DISABLED` (tạm ngưng); đặt hạn quá 14 ngày (tắt hẳn); đặt `READ_ONLY`; đặt hạn trong quá khứ dưới 14 ngày | Hai trường hợp đầu khoá với câu "tạm ngưng" và câu hết hạn; hai trường hợp sau vào được như cũ, có dòng `AppModuleNotice` |
| L-08 | `hr` và `kd1` (nhân viên) của `cta` | Thấy ô Tuyển dụng khoá với câu "liên hệ quản trị viên của công ty" |
| L-09 | Gõ thẳng `/management/recruitment` khi chưa mua | Vẫn toast rồi chuyển trang như cũ |
| L-10 | Điện thoại 390px: lưới và hộp thoại | Không tràn ngang, nút bấm được |
| L-11 | Chặn `GET /v1/me/entitlements` (trả lỗi) rồi tải lại | Mọi ô mở như cũ, không ô nào khoá |
| L-12 | Đặt lại `cta RECRUIT ENABLED` | Ô Tuyển dụng mở bình thường, vào được |

Thêm test vitest cho phần tính danh sách ô khoá trong `useAppModules` nếu tách được thành hàm thuần.

## ⑥ Báo lại

File đã sửa, bảng smoke `# | Kịch bản | Mong đợi | Thực tế | ✓/✗ | Ảnh` (ảnh lưu trong worktree, ví dụ
`tests/e2e/__shots__/module-lock/`, không để trong `/tmp`), exit code của `npm run build` và `npx vitest run`, chỗ nào
lệch contract hoặc doc.

## ⑦ Giới hạn

Không sửa repo BE. Không commit. Không đụng worktree `fe-approval`. Không tự lách ở FE nếu thấy contract sai, báo lại để
BE sửa. Script smoke và ảnh để trong worktree hoặc thư mục ngoài `/tmp`.

---

# Đợt 2 — hotline trong hộp thoại (17/11/2026)

Chủ sản phẩm muốn hộp thoại phân hệ chưa mua ghi hotline của nhà cung cấp, lấy từ `.env`.

1. **Repo, nhánh:** như trên (`fe-module-lock`, `feat/module-launcher-lock`). BE cùng tên nhánh ở worktree
   `/home/tuanpham/work/hr-system/.worktrees/be-module-lock`.
2. **Đọc trước:** `docs/backend/bridges/entitlements.md` đã đồng bộ lại (`diff` = 0), mục GET và bảng trạng thái.
3. **Thay đổi API:** `GET /v1/me/entitlements` trả thêm `businessHotline: string | null`, lấy từ env
   `BUSINESS_HOTLINE` của BE (bỏ khoảng trắng hai đầu, trống là `null`). Mọi người đã đăng nhập nhận cùng giá trị.
   Không có mã lỗi mới. Web không thêm biến môi trường nào.
4. **Việc phải làm:**
   - `types/entitlement.types.ts`: thêm `businessHotline` vào `EntitlementsResponse`.
   - Auth store lưu `businessHotline` cạnh `modules`. Nạp lỗi hoặc BE cũ không có trường thì coi là `null`.
   - `AppModuleLockedDialog.vue`: với **ADMIN**, khi có hotline thì câu hướng dẫn là "Liên hệ nhà cung cấp phần mềm
     qua hotline <số> để đăng ký thêm phân hệ này.", số là liên kết `tel:` (bấm gọi được trên điện thoại). Khi không
     có hotline thì giữ câu cũ. HR và nhân viên giữ câu "liên hệ quản trị viên của công ty", không ghi số.
   - Câu chữ để trong `utils/app-launcher.ts` cùng chỗ các câu khác, kèm test vitest.
5. **Scenario smoke** (bấm thật, có ảnh). Sandbox BE của nhánh này chạy ở `http://localhost:3140` (khác sandbox lô 4a
   ở 3170), CORS mở cho 4020 và 4021. Web chạy thử phải đặt `NUXT_PUBLIC_BASE_API_URL=http://localhost:3140`. Công ty
   `ml` chưa mua cả Tài sản lẫn Tuyển dụng. Tài khoản và mật khẩu đọc từ
   `/home/tuanpham/work/hr-system/.sandbox-4a/sandbox-ml.json` (`people.admin`, `people.hr`, `people.kd1`, `password`),
   không ghi vào file.

   | # | Kịch bản | Mong đợi |
   |---|---|---|
   | T-01 | ADMIN công ty chưa mua Tuyển dụng bấm ô khoá, API có hotline | Câu "…qua hotline 0888888888…", số bấm được (`href="tel:0888888888"`) |
   | T-02 | HR và nhân viên bấm ô khoá | Câu "liên hệ quản trị viên của công ty", không có số |
   | T-03 | API không có hotline (BE báo khi đã đổi sandbox) | ADMIN thấy lại câu cũ, không có chữ "hotline" |
   | T-04 | Điện thoại 390px | Hộp thoại không tràn, bấm số mở trình gọi |
   | T-05 | Chạy lại L-01..L-12 | Vẫn xanh |
6. **Báo lại:** như mục ⑥.
7. **Giới hạn:** như mục ⑦.
