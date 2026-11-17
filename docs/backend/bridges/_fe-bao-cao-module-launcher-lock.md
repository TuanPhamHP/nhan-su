# Báo cáo FE — hiện phân hệ chưa mua ở trạng thái khoá

Worktree `/home/tuanpham/work/hr-system/.worktrees/fe-module-lock`, nhánh `feat/module-launcher-lock`
tách từ `develop`, chưa commit. Sandbox API `http://localhost:3170`, web dev `http://localhost:4021`.
Ảnh nằm trong worktree, ở `tests/e2e/__shots__/module-lock/`.

## 1. File đã sửa

### Mới

| File | Việc |
|---|---|
| `app/utils/app-launcher.ts` | Phần tính toán thuần: `splitLauncherApps` chia danh mục phân hệ thành phần dùng được và phần khoá, cùng `lockBadgeText`, `lockMessage`, `lockHintText` giữ toàn bộ câu chữ ở một chỗ. |
| `app/components/common/AppModuleLockedDialog.vue` | Hộp thoại dùng chung cho cả lưới và sidebar: tên phân hệ, mô tả, câu theo `reason`, câu hướng dẫn theo người đọc, nút Đóng, đóng được bằng Esc và bằng cách bấm ra ngoài. |
| `tests/app-launcher.test.ts` | 12 test cho phần tính toán và câu chữ. |
| `tests/e2e/module-lock/helper.mjs`, `tests/e2e/module-lock/smoke-lock.mjs` | Bộ bấm thật L-01 đến L-12, tự đổi trạng thái module bằng `set-module-4a.cjs` của BE rồi trả sandbox về trạng thái ban đầu. |

### Sửa

| File | Việc |
|---|---|
| `app/types/navigation.types.ts` | `AppModuleDef` thêm `module?: ModuleCode` cho phân hệ mà mọi màn hình đều thuộc một module bán riêng. |
| `app/config/app-modules.ts` | `rec` nhận `module: 'RECRUIT'`, `ast` nhận `module: 'ASSET'`. Phân hệ gộp nhiều module không khai gì, vẫn lọc từng mục như cũ. |
| `app/composables/useAppModules.ts` | Tách `canSeeItemIgnoringModule` khỏi `canSeeItem`, gọi `splitLauncherApps`, trả thêm `lockedApps`, và `appsByGroup` nay mang cả hai danh sách. `visibleApps`, `currentApp`, "Gần đây", nút mở lưới ở header giữ đúng nghĩa cũ là chỉ tính phân hệ dùng được. |
| `app/components/layout/AppLauncher.vue` | Ô khoá nằm đúng nhóm, viền nét đứt, biểu tượng mờ, có ổ khoá và nhãn ngắn theo `reason`; tìm kiếm lọc cả ô khoá; bấm ô khoá mở hộp thoại chứ không chuyển trang. Ô mở nhận thêm `data-app` để bài smoke phân biệt được ô mở với ô khoá. |
| `app/components/layout/AppSidebar.vue` | Khối "Phân hệ" ở trang chủ hiện cả ô khoá, bằng `button` chứ không phải `NuxtLink`, cùng kiểu mờ và ổ khoá, bấm mở cùng hộp thoại. |

Không đổi `module-guard.global.ts`, `useModuleAccess.ts`, `AppModuleNotice.vue`, `module-expiry.ts`.

## 2. Hai quyết định đáng nói

**Ô khoá không gộp vào `visibleApps`.** `currentApp`, mục "Gần đây" và nút mở lưới ở header đều tính
trên `visibleApps`, mà ô khoá không dẫn đi đâu, nên gộp vào sẽ làm "Gần đây" hiện một ô bấm vào chỉ
ra hộp thoại. Vì vậy composable trả hai danh sách riêng.

**Esc chỉ đóng một lớp.** Lưới chọn phân hệ cũng đóng bằng Esc, nên hộp thoại bắt Esc ở pha capture
rồi chặn lại: một lần Esc đóng hộp thoại và giữ lưới đang mở, bấm Esc lần nữa mới đóng lưới.

## 3. Bảng smoke

Bấm thật trên sandbox 3170, desktop 1440×900 và điện thoại 390×844. Bộ `tests/e2e/module-lock/smoke-lock.mjs`
chạy **56/56 khẳng định xanh**, không lỗi console.

| # | Kịch bản | Mong đợi | Thực tế | ✓/✗ | Ảnh |
|---|---|---|---|---|---|
| L-01 | `admin` của `cta` mở lưới | Tài sản mở như thường, Tuyển dụng mờ có ổ khoá và nhãn "Chưa đăng ký" | Ô Tuyển dụng ở trạng thái khoá, nhãn "Chưa đăng ký", có hình ổ khoá cạnh tên; Quản lý tài sản vẫn là ô mở bình thường | ✓ | `L-01-luoi-co-o-khoa.png` |
| L-02 | Bấm ô Tuyển dụng khoá | Hộp thoại với câu chưa đăng ký và câu dành cho ADMIN, URL không đổi | Hộp thoại hiện "Công ty bạn chưa đăng ký phân hệ Tuyển dụng.", câu "Liên hệ nhà cung cấp phần mềm để đăng ký thêm phân hệ này.", kèm mô tả phân hệ; URL y nguyên; nút Đóng và phím Esc đều đóng được, và một lần Esc chỉ đóng hộp thoại chứ không đóng luôn lưới | ✓ | `L-02-hop-thoai-chua-dang-ky.png` |
| L-03 | Tìm "ứng viên" trong lưới | Ra ô Tuyển dụng khoá | Ô khoá vẫn nằm trong kết quả tìm | ✓ | `L-03-tim-kiem-ra-o-khoa.png` |
| L-04 | Mua rồi vào Tuyển dụng, sau đó bỏ mua | Ô khoá không có trong "Gần đây" | Khi còn mua thì vào được `/management/recruitment`; bỏ mua rồi thì mục "Gần đây" không còn Tuyển dụng, còn ô trong lưới trở lại trạng thái khoá | ✓ | `L-04-gan-day-khong-co-o-khoa.png` |
| L-05 | Trang chủ, danh sách "Phân hệ" ở sidebar | Có ô Tuyển dụng khoá, bấm mở cùng hộp thoại | Ô khoá có trong sidebar, bấm mở đúng hộp thoại với đúng câu, trang không chuyển | ✓ | `L-05-sidebar-trang-chu.png` |
| L-06 | `admin@old.drill` | Cả Tuyển dụng và Quản lý tài sản đều khoá | Hai ô đều khoá, không còn ô Quản lý tài sản mở nào | ✓ | `L-06-cong-ty-chua-mua-ca-hai.png` |
| L-07a | `cta RECRUIT DISABLED` | Khoá, câu "tạm ngưng" | Nhãn ô là "Tạm ngưng", hộp thoại đọc "Phân hệ Tuyển dụng đang tạm ngưng với công ty bạn." | ✓ | `L-07-tam-ngung.png` |
| L-07b | Hạn 01/10/2026, quá 14 ngày | Khoá, câu hết hạn | Nhãn ô là "Đã hết hạn", hộp thoại đọc "Tuyển dụng đã hết hạn dùng nên đang tạm tắt, dữ liệu vẫn được giữ nguyên." | ✓ | `L-07-het-han-qua-lau.png` |
| L-07c | `READ_ONLY` | Vào được như cũ, có dòng `AppModuleNotice` | Ô không khoá, vào được màn tuyển dụng, trang có dòng báo chế độ chỉ xem | ✓ | `L-07-chi-xem.png` |
| L-07d | Hạn 10/11/2026, dưới 14 ngày | Vào được như cũ, có dòng báo hết hạn | Ô không khoá, vào được màn tuyển dụng, dòng báo nói đã hết hạn và chỉ còn xem | ✓ | `L-07-het-han-con-xem.png` |
| L-08 | `hr` và `kd1` của `cta` | Thấy ô khoá với câu "liên hệ quản trị viên của công ty" | Cả hai thấy ô khoá và đọc đúng câu đó, không ai đọc câu dành cho quản trị viên | ✓ | `L-08-hr-hop-thoai.png`, `L-08-kd1-hop-thoai.png` |
| L-09 | Gõ thẳng `/management/recruitment` khi chưa mua | Vẫn toast rồi chuyển trang như cũ | Có câu báo module chưa được mở, bị chuyển khỏi màn tuyển dụng | ✓ | `L-09-go-thang-url.png` |
| L-10 | Điện thoại 390 px: lưới và hộp thoại | Không tràn ngang, nút bấm được | `scrollWidth` bằng `clientWidth` ở cả lưới và hộp thoại; nút Đóng cao 40 px, bấm là đóng | ✓ | `L-10-dien-thoai-luoi.png`, `L-10-dien-thoai-hop-thoai.png` |
| L-11 | Chặn `GET /v1/me/entitlements` trả 500 rồi tải lại | Mọi ô mở như cũ, không ô nào khoá | Không còn ô khoá nào, Tuyển dụng trở lại ô mở | ✓ | `L-11-khong-nap-duoc-entitlements.png` |
| L-12 | Đặt lại `cta RECRUIT ENABLED` | Ô mở bình thường, vào được | Không còn ô khoá, bấm ô là vào phân hệ, không còn hộp thoại chặn | ✓ | `L-12-mua-lai-vao-duoc.png` |

Bài tự trả sandbox về trạng thái ban đầu ở cuối (`cta RECRUIT` về `NONE`).

## 4. Exit code

| Lệnh | Exit code | Ghi chú |
|---|---|---|
| `npm run build` | 0 | |
| `npx vitest run` | 1 | 261 test xanh, 2 test đỏ sẵn có trong `tests/leave.test.ts` (TC14 so tham số `findOne`, TC45 so chuỗi `'Đã được duyệt'` với `'Đơn đã được duyệt'`). Hai bài này đỏ sẵn trên `develop`, không liên quan việc khoá phân hệ. `tests/app-launcher.test.ts` 12/12 xanh. |

## 5. Chỗ lệch contract hoặc doc

Không có. `GET /v1/me/entitlements` trả đúng mọi module kể cả module chưa mua, `state` và `reason`
khớp bảng trong `entitlements.md` ở cả bốn trạng thái đã thử.

Hai điều ghi lại cho lần sau, không phải lỗi:

Một, ô khoá hiện được cho mọi người đã đăng nhập vì phân hệ Tuyển dụng có mục "Phỏng vấn của tôi"
(`/recruitment/my-interviews`) không đòi vai trò hay quyền. Nếu sau này phân hệ bán riêng nào chỉ
gồm màn hình quản lý thì nhân viên thường sẽ không thấy ô khoá của nó, đúng theo mục ④ của bàn giao.

Hai, trạng thái module nằm trong store theo phiên, nên sau khi người vận hành đổi gói thì người dùng
phải tải lại trang mới thấy ô đổi trạng thái. Bộ smoke vì vậy đăng nhập lại sau mỗi lần đổi.
