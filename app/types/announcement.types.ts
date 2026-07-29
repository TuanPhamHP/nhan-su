export type AnnouncementType =
	| 'ATTENDANCE_REPORT'
	| 'PROFILE_UPDATE'
	| 'DOCUMENT_SUBMIT'
	| 'GENERAL';

export interface AnnouncementAttachment {
	name: string;
	url: string;
}

export interface AnnouncementLink {
	label: string;
	url: string;
}

export interface AnnouncementCreator {
	id: number;
	fullName: string;
	avatarUrl?: string | null;
}

export type AnnouncementStatus = 'ACTIVE' | 'RECALLED';

export interface CompanyAnnouncementSummary {
	id: number;
	title: string;
	announcementType: AnnouncementType;
	status: AnnouncementStatus;
	sentAt: string;
	createdAt: string;
	createdBy: AnnouncementCreator;
	recalledAt: string | null;
}

export interface AnnouncementRecipientStatus {
	employeeId: number;
	fullName: string;
	avatarUrl: string | null;
	isRead: boolean;
	readAt: string | null;
}

export interface CompanyAnnouncementResponse {
	id: number;
	title: string;
	body: string;
	announcementType: AnnouncementType;
	attachments: AnnouncementAttachment[];
	links: AnnouncementLink[];
	sentAt: string;
	createdBy: AnnouncementCreator;
	recipients: AnnouncementRecipientStatus[];
	recalledAt: string | null;
	recalledBy: AnnouncementCreator | null;
}

export interface ReadStatusResponse {
	total: number;
	readCount: number;
	unreadCount: number;
	recipients: AnnouncementRecipientStatus[];
}

export interface MyAnnouncementItem {
	id: number;
	title: string;
	announcementType: AnnouncementType;
	sentAt: string;
	createdAt: string;
	createdBy: AnnouncementCreator;
	isRead: boolean;
	readAt: string | null;
}

export interface MyAnnouncementDetail {
	id: number;
	title: string;
	body: string;
	announcementType: AnnouncementType;
	attachments: AnnouncementAttachment[];
	links: AnnouncementLink[];
	sentAt: string;
	createdAt: string;
	createdBy: AnnouncementCreator;
	isRead: boolean;
	readAt: string | null;
}

export interface AvailableRecipient {
	id: number;
	fullName: string;
	departmentId: number | null;
	avatarUrl: string | null;
}

export interface CreateAnnouncementDto {
	title: string;
	body: string;
	announcementType: AnnouncementType;
	recipientIds?: number[];
	links?: AnnouncementLink[];
}

export interface QueryAnnouncementParams {
	page?: number;
	limit?: number;
	isRead?: boolean;
	search?: string;
	created_at_from?: string;
	created_at_to?: string;
}

export type EmojiKey = 'heart' | 'thumbsup' | 'haha' | 'sad' | 'wow';

export const EMOJI_KEYS: EmojiKey[] = ['heart', 'thumbsup', 'haha', 'sad', 'wow'];

export const EMOJI_MAP: Record<EmojiKey, { src: string; label: string }> = {
	heart: { src: '/social-icons/heart.svg', label: 'Yêu thích' },
	thumbsup: { src: '/social-icons/thumbsup.svg', label: 'Thích' },
	haha: { src: '/social-icons/haha.svg', label: 'Haha' },
	sad: { src: '/social-icons/sad.svg', label: 'Buồn' },
	wow: { src: '/social-icons/wow.svg', label: 'Wow' },
};

export interface ReactionSummary {
	heart: number;
	thumbsup: number;
	haha: number;
	sad: number;
	wow: number;
}

export interface ReactionEmployee {
	id: number;
	fullName: string;
	avatarUrl: string | null;
}

export interface ReactionDetail {
	emoji: EmojiKey;
	employees: ReactionEmployee[];
}

export interface ReactionResponse {
	summary: ReactionSummary;
	details: ReactionDetail[];
	myReaction: EmojiKey | null;
}

export interface ReactActionResponse {
	action: 'added' | 'changed' | 'removed';
	emoji: EmojiKey;
}

export interface CommentAuthor {
	id: number;
	fullName: string;
	avatarUrl: string | null;
	employeeCode: string;
	positionName: string | null;
}

export interface AnnouncementReply {
	id: number;
	announcementId: number;
	parentId: number;
	author: CommentAuthor;
	content: string;
	mentionIds: number[];
	isDeleted: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface AnnouncementComment {
	id: number;
	announcementId: number;
	parentId: number | null;
	author: CommentAuthor;
	content: string;
	mentionIds: number[];
	isDeleted: boolean;
	createdAt: string;
	updatedAt: string;
	replies: AnnouncementReply[];
	replyCount: number;
}

export interface CreateCommentDto {
	content: string;
	parentId?: number;
}

export const ANNOUNCEMENT_TYPE_CONFIG: Record<
	AnnouncementType,
	{
		label: string;
		icon: string;
		actionLabel?: string;
		actionUrl?: string;
	}
> = {
	ATTENDANCE_REPORT: {
		label: 'Báo cáo chấm công',
		icon: '📊',
		actionLabel: 'Xem báo cáo công tháng',
		actionUrl: '/attendance/my',
	},
	PROFILE_UPDATE: {
		label: 'Cập nhật thông tin cá nhân',
		icon: '👤',
		actionLabel: 'Cập nhật ngay',
		actionUrl: '/profile',
	},
	DOCUMENT_SUBMIT: {
		label: 'Nộp hồ sơ lao động',
		icon: '📄',
		actionLabel: 'Nộp hồ sơ',
		actionUrl: '/employees/me/documents',
	},
	GENERAL: {
		label: 'Thông báo chung',
		icon: '📢',
	},
};
