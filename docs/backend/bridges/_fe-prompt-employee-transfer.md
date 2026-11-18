# FE prompt — Thông báo chuyển nhân viên giữa hai công ty

> Bàn giao từ BE ngày 17/11/2026, nhánh BE `feat/employee-transfer`. Hợp đồng chi tiết:
> [notifications.md](./notifications.md) (loại mới, `refType: employee`) và
> [fcm-notification-routing.json](./fcm-notification-routing.json) (`EMPLOYEE_TRANSFERRED_IN`, `EMPLOYEE_TRANSFERRED_OUT`).

## Bối cảnh

Người vận hành vai trò Chủ chuyển một hoặc nhiều nhân viên từ công ty A sang công ty B **ở control plane** (giao
diện riêng của BE, không nằm trong `nhan-su`). Hai cách:

- **Giữ song song:** B tạo hồ sơ mới và gửi lời mời qua email; người đó vẫn làm ở A.
- **Chuyển hẳn:** B tạo hồ sơ mới, người đó vào B ngay; đăng nhập ở A bị khoá. Hồ sơ ở A giữ nguyên để HR A tự làm
  thủ tục nghỉ việc.

FE không có màn hình nào để chuyển người. FE chỉ hiện đúng hai loại thông báo mới cho HR, admin.

## Thay đổi API

| Chỗ | Thay đổi |
|---|---|
| `NotificationType` (`GET /v1/notifications`, socket, FCM data) | Thêm `EMPLOYEE_TRANSFERRED_IN` (HR, admin công ty nhận) và `EMPLOYEE_TRANSFERRED_OUT` (HR, admin công ty cũ, chỉ khi chuyển hẳn) |
| Thông báo hai loại trên | Category `EVENT`, `actionType: NAVIGATE_ONLY`, `refType: 'employee'`, `refId` là id hồ sơ ở chính công ty đang mở, `targetUrl: /management/employees/{refId}` |

Không có endpoint, DTO hay mã lỗi mới.

## Việc phía FE

1. `app/types/notification.types.ts`: thêm `'EMPLOYEE_TRANSFERRED_IN'` và `'EMPLOYEE_TRANSFERRED_OUT'` vào
   `NotificationType`.
2. Kiểm chỗ nào FE rẽ nhánh theo `type` hoặc `refType` (icon, màu, điều hướng khi bấm). Hai loại mới phải điều hướng
   theo `targetUrl` tới hồ sơ nhân viên như `RECRUIT_NEW_HIRE`, và có icon hợp lý (không rơi vào nhánh mặc định trông
   như lỗi).

## Không làm

- Không thêm màn hình chuyển nhân viên trong `nhan-su`: việc đó chỉ ở control plane.
- Không tự suy ra tên công ty kia: thông báo cố ý không nêu tên.
- Không sửa repo BE. Contract sai thì báo lại để BE sửa.

## Kịch bản smoke phía FE

| # | Kịch bản | Kỳ vọng |
|---|---|---|
| F1 | HR công ty nhận mở chuông thông báo | Thấy "📌 Thông tin: Nhân viên chuyển tới", bấm vào mở đúng hồ sơ mới |
| F2 | HR công ty cũ (sau khi chuyển hẳn) mở chuông | Thấy "📌 Thông tin: Nhân viên đã chuyển sang công ty khác", bấm vào mở hồ sơ ở công ty cũ (vẫn đang làm) |
| F3 | Người được chuyển hẳn đăng nhập bằng mật khẩu cũ | Vào thẳng công ty mới, mã nhân viên theo công ty mới, không còn thấy công ty cũ trong bộ chọn |
| F4 | Người được giữ song song đăng nhập | Vẫn vào công ty cũ; bấm link lời mời (trang `/accept-invite`) thì có thêm công ty mới trong bộ chọn |
| F5 | Nhân viên thường (không phải HR) | Không nhận hai loại thông báo này |

## Báo lại cho BE

- Danh sách file đã sửa.
- Bảng kết quả smoke F1–F5 kèm ảnh chụp chuông thông báo và trang mở ra.
- Chỗ nào doc BE không khớp với API thật.
