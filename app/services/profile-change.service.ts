import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedMeta, PaginatedResponse } from '~/types/api.types';
import type {
	MyProfileChange,
	ProfileChange,
	ProfileChangeDetail,
	ProfileChangeQueryParams,
} from '~/types/hr-profile.types';

/**
 * Yêu cầu thay đổi thông tin nhân sự, phía người duyệt (lô 3a).
 *
 * Cần quyền `employee:profile-change:approve`. Danh sách không mang giá trị cũ mới, phải mở
 * chi tiết mới có; mỗi lần mở chi tiết ghi một dòng nhật ký `employee.private_view`.
 */
export const useProfileChangeService = () => {
	const authFetch = useAuthFetch();

	return {
		async findAll(
			params?: ProfileChangeQueryParams,
		): Promise<{ data: ProfileChange[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<ProfileChange>>('/v1/profile-change-requests', { params });
			return { data: res.data, meta: res.meta };
		},

		async findOne(id: number): Promise<ProfileChangeDetail> {
			const res = await authFetch<ApiResponse<ProfileChangeDetail>>(`/v1/profile-change-requests/${id}`);
			return res.data;
		},

		/** Link có hiệu lực một giờ; gọi lại để lấy link mới. */
		async getDocumentUrl(id: number, documentId: number): Promise<string> {
			const res = await authFetch<ApiResponse<{ presignedUrl: string }>>(
				`/v1/profile-change-requests/${id}/documents/${documentId}/url`,
			);
			return res.data.presignedUrl;
		},

		/**
		 * Duyệt yêu cầu.
		 *
		 * Giá trị hiện tại đã khác lúc gửi thì BE trả 409 `PROFILE_CHANGE_STALE`; đó là lý do
		 * màn chi tiết tô cảnh báo những dòng lệch và gợi ý từ chối.
		 */
		async approve(id: number, note?: string): Promise<MyProfileChange> {
			const res = await authFetch<ApiResponse<MyProfileChange>>(
				`/v1/profile-change-requests/${id}/approve`,
				{ method: 'POST', body: note ? { note } : {} },
			);
			return res.data;
		},

		/** Lý do bắt buộc: thiếu thì BE trả 400 `PROFILE_CHANGE_REJECT_NOTE_REQUIRED`. */
		async reject(id: number, note: string): Promise<MyProfileChange> {
			const res = await authFetch<ApiResponse<MyProfileChange>>(
				`/v1/profile-change-requests/${id}/reject`,
				{ method: 'POST', body: { note } },
			);
			return res.data;
		},
	};
};
