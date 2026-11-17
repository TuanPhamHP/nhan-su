import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type { EmployeeDocumentResponse } from '~/types/employee-document.types';
import type {
	CreateEmergencyContactDto,
	CreateProfileChangeDto,
	CreateProfileChangeResult,
	MyPrivateProfile,
	MyProfile,
	MyProfileChange,
	PendingDocument,
	Relative,
	UpdateEmergencyContactDto,
	UpdateMyContactDto,
	WorkExperience,
} from '~/types/hr-profile.types';

/**
 * Hồ sơ mở rộng của chính mình và luồng yêu cầu thay đổi (lô 3a).
 *
 * Mọi route lấy nhân viên từ token nên không truyền id. Trường liên hệ nhân viên tự sửa được,
 * trường nhạy cảm thì phải gửi yêu cầu cho phòng nhân sự duyệt.
 */
export const useMeProfileService = () => {
	const authFetch = useAuthFetch();

	return {
		async findProfile(): Promise<MyProfile> {
			const res = await authFetch<ApiResponse<MyProfile>>('/v1/me/profile');
			return res.data;
		},

		/**
		 * Mở phần nhạy cảm bằng mật khẩu đăng nhập.
		 *
		 * Sai mật khẩu BE trả 400 `AUTH_INVALID_CREDENTIALS` chứ không phải 401, nên lỗi này
		 * không làm người dùng bị đăng xuất; năm lần sai thì khoá 30 phút.
		 */
		async viewPrivateProfile(password: string): Promise<MyPrivateProfile> {
			const res = await authFetch<ApiResponse<MyPrivateProfile>>('/v1/me/profile/private', {
				method: 'POST',
				body: { password },
			});
			return res.data;
		},

		/** Số điện thoại, email cá nhân và địa chỉ được ghi ngay, không cần duyệt. */
		async updateContact(payload: UpdateMyContactDto): Promise<MyProfile> {
			const res = await authFetch<ApiResponse<MyProfile>>('/v1/me/profile/contact', {
				method: 'PATCH',
				body: payload,
			});
			return res.data;
		},

		async findEmergencyContacts(): Promise<Relative[]> {
			const res = await authFetch<ApiResponse<Relative[]>>('/v1/me/emergency-contacts');
			return res.data;
		},

		async createEmergencyContact(payload: CreateEmergencyContactDto): Promise<Relative> {
			const res = await authFetch<ApiResponse<Relative>>('/v1/me/emergency-contacts', {
				method: 'POST',
				body: payload,
			});
			return res.data;
		},

		/**
		 * Người này đang là người phụ thuộc thì BE trả 409 `PROFILE_RELATIVE_NEEDS_REQUEST`:
		 * phải gửi yêu cầu thay đổi mục thân nhân chứ không sửa trực tiếp được.
		 */
		async updateEmergencyContact(id: number, payload: UpdateEmergencyContactDto): Promise<Relative> {
			const res = await authFetch<ApiResponse<Relative>>(`/v1/me/emergency-contacts/${id}`, {
				method: 'PATCH',
				body: payload,
			});
			return res.data;
		},

		removeEmergencyContact(id: number): Promise<void> {
			return authFetch<void>(`/v1/me/emergency-contacts/${id}`, { method: 'DELETE' });
		},

		/** Chỉ xem; muốn đổi thì gửi yêu cầu mục kinh nghiệm. */
		async findWorkExperiences(): Promise<WorkExperience[]> {
			const res = await authFetch<ApiResponse<WorkExperience[]>>('/v1/me/work-experiences');
			return res.data;
		},

		async findDocuments(): Promise<EmployeeDocumentResponse[]> {
			const res = await authFetch<ApiResponse<EmployeeDocumentResponse[]>>('/v1/employees/me/documents');
			return res.data;
		},

		/** 100 yêu cầu gần nhất của chính mình, kèm giá trị cũ và mới. */
		async findChangeRequests(): Promise<MyProfileChange[]> {
			const res = await authFetch<ApiResponse<MyProfileChange[]>>('/v1/me/profile-change-requests');
			return res.data;
		},

		async createChangeRequest(payload: CreateProfileChangeDto): Promise<CreateProfileChangeResult> {
			const res = await authFetch<ApiResponse<CreateProfileChangeResult>>('/v1/me/profile-change-requests', {
				method: 'POST',
				body: payload,
			});
			return res.data;
		},

		async cancelChangeRequest(id: number): Promise<MyProfileChange> {
			const res = await authFetch<ApiResponse<MyProfileChange>>(
				`/v1/me/profile-change-requests/${id}/cancel`,
				{ method: 'POST' },
			);
			return res.data;
		},

		/**
		 * Tải giấy tờ kèm theo yêu cầu.
		 *
		 * Giấy tờ ở trạng thái chờ: không hiện trong danh sách tài liệu nào cho tới khi yêu cầu
		 * được duyệt, và bị xoá nếu yêu cầu bị từ chối, bị huỷ hoặc bị thay bằng yêu cầu mới.
		 */
		async uploadChangeRequestDocument(
			file: File,
			documentTypeId: number,
		): Promise<EmployeeDocumentResponse> {
			const formData = new FormData();
			formData.append('file', file);
			formData.append('documentTypeId', String(documentTypeId));
			const res = await authFetch<ApiResponse<EmployeeDocumentResponse>>(
				'/v1/me/profile-change-requests/documents',
				{ method: 'POST', body: formData },
			);
			return res.data;
		},

		/** Giấy tờ chờ của chính mình; dòng có `requestId` là đang kèm một yêu cầu chờ duyệt. */
		async findChangeRequestDocuments(): Promise<PendingDocument[]> {
			const res = await authFetch<ApiResponse<PendingDocument[]>>('/v1/me/profile-change-requests/documents');
			return res.data;
		},

		/**
		 * Xoá một giấy tờ chờ chưa gửi kèm yêu cầu, xoá luôn cả file.
		 *
		 * Giấy tờ đang kèm một yêu cầu chờ duyệt thì BE trả 409 `PROFILE_CHANGE_DOCUMENT_IN_USE`:
		 * muốn bỏ thì huỷ yêu cầu đó, huỷ xong giấy tờ tự xoá.
		 */
		removeChangeRequestDocument(id: number): Promise<void> {
			return authFetch<void>(`/v1/me/profile-change-requests/documents/${id}`, { method: 'DELETE' });
		},
	};
};
