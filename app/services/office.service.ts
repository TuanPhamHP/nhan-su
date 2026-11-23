import { useAuthFetch } from './http/auth.fetch';
import { fileNameFromDisposition, type OfficeDownload } from '~/utils/office.utils';
import type { ApiResponse } from '~/types/api.types';
import type {
	AddPeriodDepartmentsBody,
	CancelPeriodResult,
	CorrectReceivedBody,
	CancelRoomBookingBody,
	CopyPreviousResult,
	CreateMeetingRoomBody,
	CreateOfficeSiteBody,
	CreateRoomBookingBody,
	CreateSupplementBody,
	CreateSupplyGroupBody,
	CreateSupplyItemBody,
	CreateSupplyLineBody,
	CreateSupplyPeriodBody,
	FinalizeSupplyRequestBody,
	MarkDeliveredBody,
	MeetingRoom,
	MyRoomBookingQueryParams,
	OfficeSite,
	ReceiveSupplyRequestBody,
	ReplaceSupplyQuotasBody,
	RoomBooking,
	RoomGrid,
	SetSupplyContactBody,
	SupplyContact,
	SupplyCostQueryParams,
	SupplyCostReport,
	SupplyGroup,
	SupplyImportResult,
	SupplyItem,
	SupplyPeriod,
	SupplyPeriodItemBody,
	SupplyPeriodQueryParams,
	SupplyPeriodSummary,
	SupplyQuota,
	SupplyRequest,
	SupplyRequestListItem,
	UpdateMeetingRoomBody,
	UpdateOfficeSiteBody,
	UpdateRoomBookingBody,
	UpdateSupplyGroupBody,
	UpdateSupplyItemBody,
	UpdateSupplyLineBody,
	SetSupplyLineShareBody,
	UpdateSupplyPeriodBody,
} from '~/types/office.types';

/**
 * Module Hành chính văn phòng, lô 1 (`docs/backend/bridges/office.md`).
 *
 * Ba nhóm route nằm chung một service vì chúng cùng một nghiệp vụ: danh mục và cài đặt
 * (`office:manage`), kỳ đăng ký và báo cáo (`office:supply:manage`, `office:supply:report`), và
 * nhóm `me*` ở cuối file mà mọi nhân viên của công ty đều gọi được. Nhân viên thường gọi route
 * quản lý sẽ nhận 403 như module Tài sản, nên trang của họ chỉ dùng nhóm `me*`.
 *
 * Mọi lệnh ghi dòng phiếu trả lại TOÀN BỘ phiếu đã cập nhật: nơi gọi thay luôn state chứ không
 * tự sửa một dòng, vì máy chủ còn tính lại `canEdit`, `overQuota` và tổng tiền.
 */
export const useOfficeService = () => {
	const authFetch = useAuthFetch();

	/**
	 * Tải một file kèm tên do máy chủ đặt ở `Content-Disposition`.
	 *
	 * `$fetch` không trả header ra ngoài, nên bắt ở `onResponse`. Trình duyệt chỉ đọc được header
	 * này khi máy chủ có `Access-Control-Expose-Headers`, vì vậy tên rỗng là chuyện có thể xảy ra
	 * và nơi gọi phải có tên dự phòng.
	 */
	async function download(url: string, params?: Record<string, unknown>): Promise<OfficeDownload> {
		let fileName = '';
		const blob = await authFetch<Blob>(url, {
			params,
			responseType: 'blob',
			onResponse({ response }) {
				fileName = fileNameFromDisposition(response.headers.get('content-disposition'));
			},
		});
		return { blob, fileName };
	}

	return {
		// ─── Danh mục (mọi nhân viên đọc được) ────────────────────────────────────

		async findSites(params?: { includeInactive?: boolean }): Promise<OfficeSite[]> {
			const res = await authFetch<ApiResponse<OfficeSite[]>>('/v1/office/sites', { params });
			return res.data;
		},

		async createSite(body: CreateOfficeSiteBody): Promise<OfficeSite> {
			const res = await authFetch<ApiResponse<OfficeSite>>('/v1/office/sites', { method: 'POST', body });
			return res.data;
		},

		async updateSite(id: number, body: UpdateOfficeSiteBody): Promise<OfficeSite> {
			const res = await authFetch<ApiResponse<OfficeSite>>(`/v1/office/sites/${id}`, { method: 'PATCH', body });
			return res.data;
		},

		async findRooms(params?: { siteId?: number; includeInactive?: boolean }): Promise<MeetingRoom[]> {
			const res = await authFetch<ApiResponse<MeetingRoom[]>>('/v1/office/rooms', { params });
			return res.data;
		},

		async createRoom(body: CreateMeetingRoomBody): Promise<MeetingRoom> {
			const res = await authFetch<ApiResponse<MeetingRoom>>('/v1/office/rooms', { method: 'POST', body });
			return res.data;
		},

		async updateRoom(id: number, body: UpdateMeetingRoomBody): Promise<MeetingRoom> {
			const res = await authFetch<ApiResponse<MeetingRoom>>(`/v1/office/rooms/${id}`, { method: 'PATCH', body });
			return res.data;
		},

		async findSupplyGroups(params?: { includeInactive?: boolean }): Promise<SupplyGroup[]> {
			const res = await authFetch<ApiResponse<SupplyGroup[]>>('/v1/office/supply-groups', { params });
			return res.data;
		},

		async createSupplyGroup(body: CreateSupplyGroupBody): Promise<SupplyGroup> {
			const res = await authFetch<ApiResponse<SupplyGroup>>('/v1/office/supply-groups', { method: 'POST', body });
			return res.data;
		},

		async updateSupplyGroup(id: number, body: UpdateSupplyGroupBody): Promise<SupplyGroup> {
			const res = await authFetch<ApiResponse<SupplyGroup>>(`/v1/office/supply-groups/${id}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		async findSupplyItems(params?: { groupId?: number; includeInactive?: boolean }): Promise<SupplyItem[]> {
			const res = await authFetch<ApiResponse<SupplyItem[]>>('/v1/office/supply-items', { params });
			return res.data;
		},

		async createSupplyItem(body: CreateSupplyItemBody): Promise<SupplyItem> {
			const res = await authFetch<ApiResponse<SupplyItem>>('/v1/office/supply-items', { method: 'POST', body });
			return res.data;
		},

		async updateSupplyItem(id: number, body: UpdateSupplyItemBody): Promise<SupplyItem> {
			const res = await authFetch<ApiResponse<SupplyItem>>(`/v1/office/supply-items/${id}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		/** File mẫu nhập danh mục. Lỗi 4xx vẫn là JSON, `auth.fetch` đọc lại blob để lấy câu lỗi. */
		async downloadItemTemplate(): Promise<OfficeDownload> {
			return download('/v1/office/supply-items/import-template');
		},

		/** Nhận cả file mẫu và chính file đăng ký hằng tháng của HCNS. */
		async importSupplyItems(file: File): Promise<SupplyImportResult> {
			const form = new FormData();
			form.append('file', file);
			const res = await authFetch<ApiResponse<SupplyImportResult>>('/v1/office/supply-items/import', {
				method: 'POST',
				body: form,
			});
			return res.data;
		},

		async findQuotas(departmentId: number): Promise<SupplyQuota[]> {
			const res = await authFetch<ApiResponse<SupplyQuota[]>>('/v1/office/supply-quotas', {
				params: { departmentId },
			});
			return res.data;
		},

		async replaceQuotas(body: ReplaceSupplyQuotasBody): Promise<SupplyQuota[]> {
			const res = await authFetch<ApiResponse<SupplyQuota[]>>('/v1/office/supply-quotas', {
				method: 'PUT',
				body,
			});
			return res.data;
		},

		// ─── Kỳ đăng ký (quản lý) ─────────────────────────────────────────────────

		async findPeriods(params?: SupplyPeriodQueryParams): Promise<SupplyPeriod[]> {
			const res = await authFetch<ApiResponse<SupplyPeriod[]>>('/v1/office/supply-periods', { params });
			return res.data;
		},

		async createPeriod(body: CreateSupplyPeriodBody): Promise<SupplyPeriod> {
			const res = await authFetch<ApiResponse<SupplyPeriod>>('/v1/office/supply-periods', {
				method: 'POST',
				body,
			});
			return res.data;
		},

		async findPeriodSummary(id: number): Promise<SupplyPeriodSummary> {
			const res = await authFetch<ApiResponse<SupplyPeriodSummary>>(`/v1/office/supply-periods/${id}`);
			return res.data;
		},

		async updatePeriod(id: number, body: UpdateSupplyPeriodBody): Promise<SupplyPeriod> {
			const res = await authFetch<ApiResponse<SupplyPeriod>>(`/v1/office/supply-periods/${id}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		async lockPeriod(id: number): Promise<SupplyPeriod> {
			const res = await authFetch<ApiResponse<SupplyPeriod>>(`/v1/office/supply-periods/${id}/lock`, {
				method: 'POST',
			});
			return res.data;
		},

		async closePeriod(id: number): Promise<SupplyPeriod> {
			const res = await authFetch<ApiResponse<SupplyPeriod>>(`/v1/office/supply-periods/${id}/close`, {
				method: 'POST',
			});
			return res.data;
		},

		/** Dự trù và đơn giá thực; trả lại bảng tổng hợp mới nên nơi gọi thay luôn state. */
		async savePeriodItems(id: number, items: SupplyPeriodItemBody[]): Promise<SupplyPeriodSummary> {
			const res = await authFetch<ApiResponse<SupplyPeriodSummary>>(`/v1/office/supply-periods/${id}/items`, {
				method: 'PUT',
				body: { items },
			});
			return res.data;
		},

		async createSupplement(periodId: number, body: CreateSupplementBody): Promise<SupplyRequest> {
			const res = await authFetch<ApiResponse<SupplyRequest>>(
				`/v1/office/supply-periods/${periodId}/supplements`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		async exportPeriod(id: number): Promise<OfficeDownload> {
			return download(`/v1/office/supply-periods/${id}/export`);
		},

		/** Thêm phòng vào kỳ còn mở (Q4). */
		async addPeriodDepartments(id: number, body: AddPeriodDepartmentsBody): Promise<SupplyPeriod> {
			const res = await authFetch<ApiResponse<SupplyPeriod>>(`/v1/office/supply-periods/${id}/departments`, {
				method: 'POST',
				body,
			});
			return res.data;
		},

		/** Huỷ kỳ mở nhầm khi chưa phòng nào nhập dòng nào; kỳ bị xoá hẳn (Q4). */
		async cancelPeriod(id: number): Promise<CancelPeriodResult> {
			const res = await authFetch<ApiResponse<CancelPeriodResult>>(`/v1/office/supply-periods/${id}/cancel`, {
				method: 'POST',
			});
			return res.data;
		},

		async findRequest(id: number): Promise<SupplyRequest> {
			const res = await authFetch<ApiResponse<SupplyRequest>>(`/v1/office/supply-requests/${id}`);
			return res.data;
		},

		async finalizeRequest(id: number, body: FinalizeSupplyRequestBody): Promise<SupplyRequest> {
			const res = await authFetch<ApiResponse<SupplyRequest>>(`/v1/office/supply-requests/${id}/finalize`, {
				method: 'POST',
				body,
			});
			return res.data;
		},

		/** Sửa số thực nhận của phiếu đã nhận khi kỳ chưa đóng (Q1); `reason` bắt buộc. */
		async correctReceived(id: number, body: CorrectReceivedBody): Promise<SupplyRequest> {
			const res = await authFetch<ApiResponse<SupplyRequest>>(
				`/v1/office/supply-requests/${id}/correct-received`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		async issueRequest(id: number): Promise<SupplyRequest> {
			const res = await authFetch<ApiResponse<SupplyRequest>>(`/v1/office/supply-requests/${id}/issue`, {
				method: 'POST',
			});
			return res.data;
		},

		async markDelivered(id: number, body: MarkDeliveredBody): Promise<SupplyRequest> {
			const res = await authFetch<ApiResponse<SupplyRequest>>(
				`/v1/office/supply-requests/${id}/mark-delivered`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		// ─── Báo cáo chi phí ──────────────────────────────────────────────────────

		async supplyCostReport(params: SupplyCostQueryParams): Promise<SupplyCostReport> {
			const res = await authFetch<ApiResponse<SupplyCostReport>>('/v1/office/reports/supply-costs', { params });
			return res.data;
		},

		async exportSupplyCostReport(params: SupplyCostQueryParams): Promise<OfficeDownload> {
			return download('/v1/office/reports/supply-costs/export', { ...params });
		},

		// ─── Phòng họp ────────────────────────────────────────────────────────────

		async roomGrid(siteId: number, date: string): Promise<RoomGrid> {
			const res = await authFetch<ApiResponse<RoomGrid>>('/v1/office/room-bookings', {
				params: { siteId, date },
			});
			return res.data;
		},

		/**
		 * Lịch phòng của một khoảng ngày, tính cả hai đầu, tối đa 31 ngày.
		 *
		 * Mỗi phòng mang `bookings` của cả khoảng, xếp theo giờ bắt đầu; trang tự chia theo ngày bằng
		 * `startAt` giờ Việt Nam. `now` chỉ có khi khoảng chứa hôm nay.
		 */
		async roomGridRange(siteId: number, fromDate: string, toDate: string): Promise<RoomGrid> {
			const res = await authFetch<ApiResponse<RoomGrid>>('/v1/office/room-bookings', {
				params: { siteId, from_date: fromDate, to_date: toDate },
			});
			return res.data;
		},

		async findBooking(id: number): Promise<RoomBooking> {
			const res = await authFetch<ApiResponse<RoomBooking>>(`/v1/office/room-bookings/${id}`);
			return res.data;
		},

		async createBooking(body: CreateRoomBookingBody): Promise<RoomBooking> {
			const res = await authFetch<ApiResponse<RoomBooking>>('/v1/office/room-bookings', {
				method: 'POST',
				body,
			});
			return res.data;
		},

		async updateBooking(id: number, body: UpdateRoomBookingBody): Promise<RoomBooking> {
			const res = await authFetch<ApiResponse<RoomBooking>>(`/v1/office/room-bookings/${id}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		async cancelBooking(id: number, body: CancelRoomBookingBody): Promise<RoomBooking> {
			const res = await authFetch<ApiResponse<RoomBooking>>(`/v1/office/room-bookings/${id}/cancel`, {
				method: 'POST',
				body,
			});
			return res.data;
		},

		// ─── Của tôi, của phòng tôi (mọi nhân viên) ───────────────────────────────

		async myRequests(): Promise<SupplyRequestListItem[]> {
			const res = await authFetch<ApiResponse<SupplyRequestListItem[]>>('/v1/me/office/supply-requests');
			return res.data;
		},

		async myRequest(id: number): Promise<SupplyRequest> {
			const res = await authFetch<ApiResponse<SupplyRequest>>(`/v1/me/office/supply-requests/${id}`);
			return res.data;
		},

		async addLine(requestId: number, body: CreateSupplyLineBody): Promise<SupplyRequest> {
			const res = await authFetch<ApiResponse<SupplyRequest>>(
				`/v1/me/office/supply-requests/${requestId}/lines`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		async updateLine(requestId: number, lineId: number, body: UpdateSupplyLineBody): Promise<SupplyRequest> {
			const res = await authFetch<ApiResponse<SupplyRequest>>(
				`/v1/me/office/supply-requests/${requestId}/lines/${lineId}`,
				{ method: 'PATCH', body },
			);
			return res.data;
		},

		/** Đặt phần của một người trên dòng; dòng hết phần thì máy chủ xoá dòng. */
		async setLineShare(
			requestId: number,
			lineId: number,
			employeeId: number,
			body: SetSupplyLineShareBody,
		): Promise<SupplyRequest> {
			const res = await authFetch<ApiResponse<SupplyRequest>>(
				`/v1/me/office/supply-requests/${requestId}/lines/${lineId}/shares/${employeeId}`,
				{ method: 'PUT', body },
			);
			return res.data;
		},

		async deleteLine(requestId: number, lineId: number): Promise<SupplyRequest> {
			const res = await authFetch<ApiResponse<SupplyRequest>>(
				`/v1/me/office/supply-requests/${requestId}/lines/${lineId}`,
				{ method: 'DELETE' },
			);
			return res.data;
		},

		async copyPrevious(requestId: number): Promise<CopyPreviousResult> {
			const res = await authFetch<ApiResponse<CopyPreviousResult>>(
				`/v1/me/office/supply-requests/${requestId}/copy-previous`,
				{ method: 'POST' },
			);
			return res.data;
		},

		async receiveRequest(requestId: number, body: ReceiveSupplyRequestBody): Promise<SupplyRequest> {
			const res = await authFetch<ApiResponse<SupplyRequest>>(
				`/v1/me/office/supply-requests/${requestId}/receive`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		/** Mặt hàng cho ô chọn của phiếu: đang dùng, đã bỏ nhóm chỉ HCNS đặt. */
		async mySupplyItems(): Promise<SupplyItem[]> {
			const res = await authFetch<ApiResponse<SupplyItem[]>>('/v1/me/office/supply-items');
			return res.data;
		},

		async mySupplyContact(): Promise<SupplyContact> {
			const res = await authFetch<ApiResponse<SupplyContact>>('/v1/me/office/supply-contact');
			return res.data;
		},

		async setSupplyContact(body: SetSupplyContactBody): Promise<SupplyContact> {
			const res = await authFetch<ApiResponse<SupplyContact>>('/v1/me/office/supply-contact', {
				method: 'PUT',
				body,
			});
			return res.data;
		},

		async myBookings(params: MyRoomBookingQueryParams): Promise<RoomBooking[]> {
			const res = await authFetch<ApiResponse<RoomBooking[]>>('/v1/me/office/room-bookings', { params });
			return res.data;
		},
	};
};
