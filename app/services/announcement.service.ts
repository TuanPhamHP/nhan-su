import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	AnnouncementComment,
	AvailableRecipient,
	CompanyAnnouncementResponse,
	CompanyAnnouncementSummary,
	CreateCommentDto,
	EmojiKey,
	MyAnnouncementItem,
	QueryAnnouncementParams,
	ReactActionResponse,
	ReactionResponse,
	ReadStatusResponse,
} from '~/types/announcement.types';

export const useCompanyAnnouncementService = () => {
	const authFetch = useAuthFetch();

	return {
		async fetchAll(
			params?: QueryAnnouncementParams,
		): Promise<{ data: CompanyAnnouncementSummary[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<CompanyAnnouncementSummary>>(
				'/v1/company-announcements',
				{ params },
			);
			return { data: res.data, meta: res.meta };
		},

		async fetchById(id: number): Promise<CompanyAnnouncementResponse> {
			const res = await authFetch<ApiResponse<CompanyAnnouncementResponse>>(
				`/v1/company-announcements/${id}`,
			);
			return res.data;
		},

		async getReadStatus(id: number): Promise<ReadStatusResponse> {
			const res = await authFetch<ApiResponse<ReadStatusResponse>>(
				`/v1/company-announcements/${id}/read-status`,
			);
			return res.data;
		},

		async create(formData: FormData): Promise<CompanyAnnouncementSummary> {
			const res = await authFetch<ApiResponse<CompanyAnnouncementSummary>>(
				'/v1/company-announcements',
				{ method: 'POST', body: formData },
			);
			return res.data;
		},

		async deleteAnnouncement(id: number): Promise<void> {
			await authFetch<void>(`/v1/company-announcements/${id}`, { method: 'DELETE' });
		},

		async recall(id: number): Promise<CompanyAnnouncementSummary> {
			const res = await authFetch<ApiResponse<CompanyAnnouncementSummary>>(
				`/v1/company-announcements/${id}/recall`,
				{ method: 'PATCH' },
			);
			return res.data;
		},

		async getMentionableEmployees(announcementId: number): Promise<AvailableRecipient[]> {
			const res = await authFetch<ApiResponse<AvailableRecipient[]>>(
				`/v1/company-announcements/${announcementId}/mentionable-employees`,
			);
			return res.data;
		},

		async fetchMyAnnouncements(
			params?: QueryAnnouncementParams,
		): Promise<{ data: MyAnnouncementItem[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<MyAnnouncementItem>>(
				'/v1/company-announcements/my',
				{ params },
			);
			return { data: res.data, meta: res.meta };
		},

		async markAsRead(id: number): Promise<void> {
			await authFetch<void>(`/v1/company-announcements/${id}/read`, { method: 'PATCH' });
		},

		async react(id: number, emoji: EmojiKey): Promise<ReactActionResponse> {
			const res = await authFetch<ApiResponse<ReactActionResponse>>(
				`/v1/company-announcements/${id}/react`,
				{ method: 'POST', body: { emoji } },
			);
			return res.data;
		},

		async getReactions(id: number): Promise<ReactionResponse> {
			const res = await authFetch<ApiResponse<ReactionResponse>>(
				`/v1/company-announcements/${id}/reactions`,
			);
			return res.data;
		},

		async getComments(announcementId: number): Promise<AnnouncementComment[]> {
			const res = await authFetch<ApiResponse<AnnouncementComment[]>>(
				`/v1/company-announcements/${announcementId}/comments`,
			);
			return res.data;
		},

		async addComment(announcementId: number, dto: CreateCommentDto): Promise<AnnouncementComment> {
			const res = await authFetch<ApiResponse<AnnouncementComment>>(
				`/v1/company-announcements/${announcementId}/comments`,
				{ method: 'POST', body: dto },
			);
			return res.data;
		},

		async deleteComment(commentId: number): Promise<void> {
			await authFetch<void>(`/v1/company-announcements/comments/${commentId}`, { method: 'DELETE' });
		},
	};
};
