# FE prompt — Logo, favicon, tiêu đề trang theo công ty; mã nhân viên theo công ty

> Bàn giao từ BE ngày 17/11/2026, nhánh BE `feat/company-profile`. Hợp đồng chi tiết:
> [auth.md](./auth.md) mục "Logo, favicon, tiêu đề trang theo công ty" và
> [employees.md](./employees.md) mục `POST /v1/employees/import`.

## Bối cảnh

Hệ thống phục vụ nhiều công ty. Người vận hành (vai trò Chủ) đặt cho từng công ty, ở control plane:

- logo hiện ở góc trên thanh bên, favicon hiện trên tab trình duyệt;
- mô tả công ty cho trợ lý AI (FE không phải làm gì, trợ lý tự đọc);
- mã nhân viên của công ty, ví dụ `STH`: nhân viên mới mang mã `STH-0001`, `STH-0002`…

FE chỉ đọc. Không có màn hình sửa logo hay mã trong `nhan-su`.

## Thay đổi API

| Chỗ | Thay đổi |
|---|---|
| `CompanyOption` (trong `company`, `companies[]` của login, select-company, switch, refresh, `/auth/me`) | Thêm `logoUrl: string \| null`, `faviconUrl: string \| null` |
| `GET /v1/public/companies/:code/logo`, `/favicon` | Mới, công khai, trả ảnh. FE không gọi bằng `$fetch`, chỉ đặt URL vào `<img>`, `<link rel="icon">` |
| `POST /v1/employees` | Không đổi request. `employeeCode` trong response có thể là `STH-0001` |
| `POST /v1/employees/import` | Công ty có mã thì cột A "Mã nhân viên" được để trống, giá trị ghi trong cột A chỉ là khoá cho cột K "Mã quản lý". Không đổi response, không thêm mã lỗi |
| `GET /v1/employees?search=` | Nhận cả mã cũ trước lần đánh lại mã |

Không có mã lỗi mới nào FE phải xử lý ngoài 404 `COMPANY_IMAGE_NOT_FOUND` của hai route ảnh, và
404 đó chỉ hiện ra dưới dạng ảnh không tải được.

## Việc phía FE

1. **Kiểu:** `app/types/auth.types.ts`, thêm hai trường vào `CompanyOption`.
2. **Logo thanh bên:** `app/components/layout/AppSidebar.vue` (`logoSrc`, khoảng dòng 52 và 205).
   `company.logoUrl` có thì dùng, không thì giữ logo theo theme như hiện nay. Khung hiện tại là
   `w-8 h-8`: logo công ty thường nằm ngang, nên cho khung rộng hơn với chiều cao cố định và
   `object-fit: contain`, nhìn ổn ở cả sidebar thu gọn. Bắt `@error` của `<img>` để quay về logo mặc định.
3. **Favicon:** `nuxt.config.ts` đang đặt cứng `/favicon.svg`. Khi đã đăng nhập và `company.faviconUrl`
   có giá trị thì đổi `<link rel="icon">` sang URL đó (`useHead` ở layout mặc định hoặc một plugin
   client), không có thì giữ `/favicon.svg`.
4. **Tiêu đề tab:** dạng `{tên công ty} - {tên trang hoặc tên module}`, ví dụ `Công ty A - Nghỉ phép`.
   Hiện `titleTemplate` cố định `Hệ thống nhân sự - %s`, `title` mặc định là `Booking`, và
   `definePageMeta({ title })` có ở nhiều trang nhưng **chưa được đưa vào head**. Cần:
   - lấy tên trang từ `route.meta.title`, trang nào chưa có thì lấy nhãn của mục menu đang chọn ở
     sidebar (module), không còn trang nào ra chữ `Booking`;
   - đã đăng nhập: `titleTemplate` theo `company.name`; chưa đăng nhập (login, kích hoạt, quên mật
     khẩu, trang tuyển dụng công khai): giữ `Hệ thống nhân sự - %s` hoặc chỉ tên trang;
   - các trang đang tự gọi `useHead({ title })` vẫn chạy đúng với template mới.
5. **Đổi công ty** (`/switch` ở `AppHeader.vue`): logo, favicon, tiêu đề đổi theo `company` mới ngay,
   không cần tải lại trang.
6. **Bộ chọn công ty** (`login.vue` bước chọn công ty, `AppHeader.vue`): tuỳ chọn, vẽ logo nhỏ cạnh tên
   khi `logoUrl` có giá trị.
7. **Nhập Excel nhân viên:** `app/components/modules/employee/EmployeeImportModal.vue`, thêm một dòng
   hướng dẫn: "Cột **Mã nhân viên** (cột A): công ty đã có mã nhân viên thì để trống, hệ thống tự cấp mã
   theo thứ tự dòng; mã ghi ở cột này chỉ dùng để cột Mã quản lý trỏ tới người trong cùng file." API
   chưa trả mã công ty cho FE nên ghi chung, không cần rẽ nhánh.

## Không làm

- Không tự sinh hay đoán mã nhân viên ở FE: luôn đọc `employeeCode` từ response.
- Không gắn token hay presign cho URL ảnh công ty, không bỏ hay đổi tham số `?v=`.
- Không sửa repo BE. Contract sai thì báo lại để BE sửa, không workaround ở FE.

## Kịch bản smoke phía FE

| # | Kịch bản | Kỳ vọng |
|---|---|---|
| F1 | Đăng nhập công ty có logo | Thanh bên hiện logo công ty, đúng tỉ lệ, cả khi thu gọn sidebar |
| F2 | Đăng nhập công ty chưa có logo | Logo mặc định theo theme sáng, tối như trước |
| F3 | Công ty có favicon / chưa có | Tab trình duyệt đổi icon / giữ `/favicon.svg` |
| F4 | Mở các trang Nghỉ phép, Nhân viên, Tài sản, Trợ lý, một trang chi tiết | Tiêu đề `{tên công ty} - {tên trang}`, không còn `Booking` |
| F5 | Trang đăng nhập, quên mật khẩu, trang tuyển dụng công khai | Không có tên công ty của phiên cũ trong tiêu đề |
| F6 | Tài khoản hai công ty, chuyển công ty ở header | Logo, favicon, tiêu đề đổi ngay sang công ty mới |
| F7 | URL logo trả 404 (người vận hành vừa gỡ logo) | `@error` đưa về logo mặc định, không có ảnh vỡ |
| F8 | Vai trò nhân viên, quản lý, HR, admin | Logo, tiêu đề như nhau ở mọi vai trò |
| F9 | Mở modal nhập Excel nhân viên | Có dòng hướng dẫn cột A |
| F10 | Tạo nhân viên ở công ty có mã | Danh sách và chi tiết hiện mã `{mã}-000N` server trả về |

Dữ liệu thử: BE chạy sandbox có công ty có logo, favicon và công ty không có gì, xem phần bàn giao.

## Báo lại cho BE

- Danh sách file đã sửa.
- Bảng kết quả smoke F1–F10 (kèm ảnh chụp thanh bên và tab trình duyệt).
- Chỗ nào doc BE không khớp với API thật.
