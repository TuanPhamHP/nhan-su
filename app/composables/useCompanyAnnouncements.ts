import { useCompanyAnnouncementService } from '~/services/announcement.service';
import type {
	AnnouncementComment,
	AvailableRecipient,
	CompanyAnnouncementResponse,
	CompanyAnnouncementSummary,
	EmojiKey,
	MyAnnouncementDetail,
	MyAnnouncementItem,
	QueryAnnouncementParams,
	ReactActionResponse,
	ReactionResponse,
	ReadStatusResponse,
} from '~/types/announcement.types';
import type { PaginatedMeta } from '~/types/api.types';

export function useCompanyAnnouncements() {
	const service = useCompanyAnnouncementService();

	// ── HR / ADMIN ──
	async function fetchAll(
		params?: QueryAnnouncementParams,
	): Promise<{ data: CompanyAnnouncementSummary[]; meta: PaginatedMeta }> {
		return service.fetchAll(params);
	}

	async function create(formData: FormData): Promise<CompanyAnnouncementSummary> {
		return service.create(formData);
	}

	async function uploadInlineMedia(file: File): Promise<string> {
		const { url } = await service.uploadInlineMedia(file);
		return url;
	}

	async function fetchById(id: number): Promise<CompanyAnnouncementResponse> {
		return service.fetchById(id);
	}

	async function getReadStatus(id: number): Promise<ReadStatusResponse> {
		return service.getReadStatus(id);
	}

	async function deleteAnnouncement(id: number): Promise<void> {
		return service.deleteAnnouncement(id);
	}

	async function recall(id: number): Promise<CompanyAnnouncementSummary> {
		return service.recall(id);
	}

	async function getMentionableEmployees(announcementId: number): Promise<AvailableRecipient[]> {
		return service.getMentionableEmployees(announcementId);
	}

	// ── Employee ──
	async function fetchMyAnnouncements(
		params?: QueryAnnouncementParams,
	): Promise<{ data: MyAnnouncementItem[]; meta: PaginatedMeta }> {
		return service.fetchMyAnnouncements(params);
	}

	async function fetchMyAnnouncementDetail(id: number): Promise<MyAnnouncementDetail> {
		return service.fetchMyAnnouncementDetail(id);
	}

	async function markAsRead(id: number): Promise<void> {
		return service.markAsRead(id);
	}

	async function react(id: number, emoji: EmojiKey): Promise<ReactActionResponse> {
		return service.react(id, emoji);
	}

	async function getReactions(id: number): Promise<ReactionResponse> {
		return service.getReactions(id);
	}

	async function getComments(announcementId: number): Promise<AnnouncementComment[]> {
		return service.getComments(announcementId);
	}

	async function addComment(
		announcementId: number,
		content: string,
		parentId?: number,
	): Promise<AnnouncementComment> {
		return service.addComment(announcementId, { content, parentId });
	}

	async function deleteComment(commentId: number): Promise<void> {
		return service.deleteComment(commentId);
	}

	return {
		fetchAll,
		create,
		uploadInlineMedia,
		fetchById,
		getReadStatus,
		deleteAnnouncement,
		recall,
		getMentionableEmployees,
		fetchMyAnnouncements,
		fetchMyAnnouncementDetail,
		markAsRead,
		react,
		getReactions,
		getComments,
		addComment,
		deleteComment,
	};
}
