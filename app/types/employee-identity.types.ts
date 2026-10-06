import type { CitizenIdResponse } from './employee-citizen-id.types';
import type { PassportResponse } from './employee-passport.types';

/**
 * Kết quả `POST /v1/employees/me/identity` — nhân viên tự xem định danh của mình.
 *
 * Hai khối ĐỘC LẬP và đều nullable: có thể có CCCD mà chưa có hộ chiếu, hoặc chưa có cả
 * hai. `null` KHÔNG phải lỗi → màn hình hiện trạng thái rỗng cho từng khối, đừng hiện
 * thông báo lỗi.
 *
 * 4 URL ảnh bên trong (`frontPhotoUrl`, `backPhotoUrl`, `photoFrontUrl`, `photoBackUrl`)
 * đã được backend presign — dùng trực tiếp, không gọi thêm gì để sign.
 */
export interface MyIdentityResponse {
	citizenId: CitizenIdResponse | null;
	passport: PassportResponse | null;
}
