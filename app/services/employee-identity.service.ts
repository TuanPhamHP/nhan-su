import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type { MyIdentityResponse } from '~/types/employee-identity.types';

export const useEmployeeIdentityService = () => {
	const authFetch = useAuthFetch();

	return {
		/**
		 * Nhân viên tự xem CCCD + hộ chiếu của mình — phải xác thực lại mật khẩu mỗi lần.
		 *
		 * Không truyền `employeeId`: server lấy từ JWT nên không xem được của người khác.
		 * Trả cả hai khối trong một lần gọi để người dùng chỉ nhập mật khẩu một lần.
		 *
		 * 3 route `GET` cũ (`/citizen-id`, `/citizen-id/history`, `/passport`) nay CHỈ dành
		 * cho người có permission — chính chủ gọi id của mình cũng `403`. Đừng dùng
		 * `useEmployeeCitizenIdService().findOne()` / `useEmployeePassportService().findOne()`
		 * cho màn hình hồ sơ cá nhân.
		 *
		 * Thành công là HTTP **201** (POST của NestJS), không phải 200 — đừng so `=== 200`.
		 * Sai mật khẩu trả **400** `AUTH_INVALID_CREDENTIALS` (cố ý không dùng 401, xem lớp
		 * phòng vệ trong `http/auth.fetch.ts`).
		 */
		async viewOwn(password: string): Promise<MyIdentityResponse> {
			const res = await authFetch<ApiResponse<MyIdentityResponse>>('/v1/employees/me/identity', {
				method: 'POST',
				body: { password },
			});
			return res.data;
		},
	};
};
