import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse, PaginatedResponse, PaginatedMeta } from '~/types/api.types';
import type {
	Asset,
	AssetAssignBody,
	AssetAssignResult,
	AssetAssignment,
	AssetCategory,
	AssetDateRangeQuery,
	AssetDepreciation,
	AssetDepreciationReport,
	AssetDepreciationReportQuery,
	AssetDocument,
	AssetDocumentUploadBody,
	AssetEvent,
	AssetExpiringQuery,
	AssetExpiringRow,
	AssetHandoverPdf,
	AssetImportResult,
	AssetIncident,
	AssetIncidentQueryParams,
	AssetKind,
	AssetMaintenance,
	AssetMaintenanceCostQuery,
	AssetMaintenanceCostReport,
	AssetMaintenanceQueryParams,
	AssetOverview,
	AssetQueryParams,
	AssetRenewal,
	AssetRenewalBody,
	AssetReturnBody,
	AssetSeatBody,
	AssetServiceCostQuery,
	AssetServiceCostReport,
	AssetStatusBody,
	AssetTransferBody,
	AssetVendor,
	AssetVendorDetail,
	CloseAssetMaintenanceBody,
	ConfirmAssetLossBody,
	ConfirmAssignmentBody,
	CreateAssetBody,
	CreateAssetCategoryBody,
	CreateAssetMaintenanceBody,
	CreateAssetVendorBody,
	HandleAssetIncidentBody,
	MyAssets,
	RepairFromAssetIncidentBody,
	ReportAssetIncidentBody,
	RespondDisputeBody,
	UpdateAssetBody,
	UpdateAssetCategoryBody,
	UpdateAssetMaintenanceBody,
	UpdateAssetVendorBody,
} from '~/types/asset.types';

/**
 * Gắn giấy tờ vào form multipart.
 *
 * `assetIds` gửi dạng JSON (`[1,2]`) — BE nhận cả ba kiểu (JSON, `"1,2"`, lặp trường),
 * chọn JSON vì nó không mập mờ khi chỉ có một id.
 */
function documentFormData(body: AssetDocumentUploadBody): FormData {
	const form = new FormData();
	form.append('file', body.file);
	form.append('type', body.type);
	if (body.number) form.append('number', body.number);
	if (body.issuedDate) form.append('issuedDate', body.issuedDate);
	if (body.amount != null) form.append('amount', String(body.amount));
	if (body.assetIds?.length) form.append('assetIds', JSON.stringify(body.assetIds));
	if (body.assignmentId != null) form.append('assignmentId', String(body.assignmentId));
	if (body.renewalId != null) form.append('renewalId', String(body.renewalId));
	if (body.maintenanceId != null) form.append('maintenanceId', String(body.maintenanceId));
	return form;
}

/**
 * Form báo hỏng, báo mất.
 *
 * Mỗi ảnh `append` một lần vào cùng tên `photos` — BE đọc chúng thành mảng. Không đặt
 * `Content-Type` ở nơi gọi để trình duyệt tự điền boundary.
 */
function incidentFormData(body: ReportAssetIncidentBody): FormData {
	const form = new FormData();
	form.append('type', body.type);
	form.append('description', body.description);
	if (body.occurredOn) form.append('occurredOn', body.occurredOn);
	for (const photo of body.photos ?? []) form.append('photos', photo);
	return form;
}

/**
 * Mọi route của trang quản lý cần vai trò ADMIN, HR, DIRECTOR, MANAGER hoặc CHIEF.
 * EMPLOYEE gọi vào nhận 403 kể cả khi có `asset:manage`, nên nhân viên chỉ dùng nhóm
 * `me*` ở cuối file. Xem `docs/backend/bridges/assets.md`.
 */
export const useAssetService = () => {
	const authFetch = useAuthFetch();

	return {
		// ─── Cài đặt: loại tài sản ────────────────────────────────────────────────

		async findCategories(params?: { kind?: AssetKind; isActive?: boolean }): Promise<AssetCategory[]> {
			const res = await authFetch<ApiResponse<AssetCategory[]>>('/v1/asset-categories', { params });
			return res.data;
		},

		async createCategory(body: CreateAssetCategoryBody): Promise<AssetCategory> {
			const res = await authFetch<ApiResponse<AssetCategory>>('/v1/asset-categories', {
				method: 'POST',
				body,
			});
			return res.data;
		},

		async updateCategory(id: number, body: UpdateAssetCategoryBody): Promise<AssetCategory> {
			const res = await authFetch<ApiResponse<AssetCategory>>(`/v1/asset-categories/${id}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		// ─── Cài đặt: nhà cung cấp ────────────────────────────────────────────────

		async findVendors(params?: { search?: string; isActive?: boolean }): Promise<AssetVendor[]> {
			const res = await authFetch<ApiResponse<AssetVendor[]>>('/v1/asset-vendors', { params });
			return res.data;
		},

		async findVendor(id: number): Promise<AssetVendorDetail> {
			const res = await authFetch<ApiResponse<AssetVendorDetail>>(`/v1/asset-vendors/${id}`);
			return res.data;
		},

		async createVendor(body: CreateAssetVendorBody): Promise<AssetVendor> {
			const res = await authFetch<ApiResponse<AssetVendor>>('/v1/asset-vendors', {
				method: 'POST',
				body,
			});
			return res.data;
		},

		async updateVendor(id: number, body: UpdateAssetVendorBody): Promise<AssetVendor> {
			const res = await authFetch<ApiResponse<AssetVendor>>(`/v1/asset-vendors/${id}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		// ─── Tài sản ──────────────────────────────────────────────────────────────

		async findAll(params?: AssetQueryParams): Promise<{ data: Asset[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<Asset>>('/v1/assets', { params });
			return { data: res.data, meta: res.meta };
		},

		async exportExcel(params?: AssetQueryParams): Promise<Blob> {
			return authFetch<Blob>('/v1/assets/export', { params, responseType: 'blob' });
		},

		async findOne(id: number): Promise<Asset> {
			const res = await authFetch<ApiResponse<Asset>>(`/v1/assets/${id}`);
			return res.data;
		},

		async create(body: CreateAssetBody): Promise<Asset> {
			const res = await authFetch<ApiResponse<Asset>>('/v1/assets', { method: 'POST', body });
			return res.data;
		},

		async update(id: number, body: UpdateAssetBody): Promise<Asset> {
			const res = await authFetch<ApiResponse<Asset>>(`/v1/assets/${id}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		async remove(id: number): Promise<void> {
			await authFetch<unknown>(`/v1/assets/${id}`, { method: 'DELETE' });
		},

		async changeStatus(id: number, body: AssetStatusBody): Promise<Asset> {
			const res = await authFetch<ApiResponse<Asset>>(`/v1/assets/${id}/status`, {
				method: 'POST',
				body,
			});
			return res.data;
		},

		async findEvents(id: number): Promise<AssetEvent[]> {
			const res = await authFetch<ApiResponse<AssetEvent[]>>(`/v1/assets/${id}/events`);
			return res.data;
		},

		async findAssignments(id: number): Promise<AssetAssignment[]> {
			const res = await authFetch<ApiResponse<AssetAssignment[]>>(`/v1/assets/${id}/assignments`);
			return res.data;
		},

		async findDepreciation(id: number, asOf?: string): Promise<AssetDepreciation> {
			const res = await authFetch<ApiResponse<AssetDepreciation>>(`/v1/assets/${id}/depreciation`, {
				params: asOf ? { asOf } : undefined,
			});
			return res.data;
		},

		// ─── License key (trang quản lý) ──────────────────────────────────────────

		async setLicenseKey(id: number, licenseKey: string): Promise<Asset> {
			const res = await authFetch<ApiResponse<Asset>>(`/v1/assets/${id}/license-key`, {
				method: 'PUT',
				body: { licenseKey },
			});
			return res.data;
		},

		async clearLicenseKey(id: number): Promise<Asset> {
			const res = await authFetch<ApiResponse<Asset>>(`/v1/assets/${id}/license-key`, {
				method: 'DELETE',
			});
			return res.data;
		},

		/** Chỉ ADMIN. Mỗi lần gọi BE ghi nhật ký — đừng gọi sẵn, chỉ khi người dùng bấm. */
		async revealLicenseKey(id: number): Promise<string> {
			const res = await authFetch<ApiResponse<{ licenseKey: string }>>(
				`/v1/assets/${id}/license-key/reveal`,
				{ method: 'POST' },
			);
			return res.data.licenseKey;
		},

		// ─── Cấp phát, điều chuyển, thu hồi ───────────────────────────────────────

		async assign(id: number, body: AssetAssignBody): Promise<AssetAssignResult> {
			const res = await authFetch<ApiResponse<AssetAssignResult>>(`/v1/assets/${id}/assignments`, {
				method: 'POST',
				body,
			});
			return res.data;
		},

		async transfer(id: number, body: AssetTransferBody): Promise<AssetAssignResult> {
			const res = await authFetch<ApiResponse<AssetAssignResult>>(`/v1/assets/${id}/transfer`, {
				method: 'POST',
				body,
			});
			return res.data;
		},

		async returnAssignment(assignmentId: number, body?: AssetReturnBody): Promise<AssetAssignment> {
			const res = await authFetch<ApiResponse<AssetAssignment>>(
				`/v1/asset-assignments/${assignmentId}/return`,
				{ method: 'POST', body: body ?? {} },
			);
			return res.data;
		},

		/**
		 * Trả lời người nhận đã báo cấp phát chưa đúng. Cấp phát về "Chờ người nhận xác nhận"
		 * và người nhận được báo để kiểm lại rồi bấm Đã nhận.
		 */
		async respondToDispute(assignmentId: number, response: string): Promise<AssetAssignment> {
			const body: RespondDisputeBody = { response };
			const res = await authFetch<ApiResponse<AssetAssignment>>(
				`/v1/asset-assignments/${assignmentId}/dispute-response`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		// ─── Gia hạn dịch vụ ──────────────────────────────────────────────────────

		async findRenewals(id: number): Promise<AssetRenewal[]> {
			const res = await authFetch<ApiResponse<AssetRenewal[]>>(`/v1/assets/${id}/renewals`);
			return res.data;
		},

		async createRenewal(id: number, body: AssetRenewalBody): Promise<AssetRenewal> {
			const res = await authFetch<ApiResponse<AssetRenewal>>(`/v1/assets/${id}/renewals`, {
				method: 'POST',
				body,
			});
			return res.data;
		},

		// ─── Sửa chữa ─────────────────────────────────────────────────────────────

		async findMaintenances(
			params?: AssetMaintenanceQueryParams,
		): Promise<{ data: AssetMaintenance[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<AssetMaintenance>>('/v1/asset-maintenances', {
				params,
			});
			return { data: res.data, meta: res.meta };
		},

		async createMaintenance(
			assetId: number,
			body: CreateAssetMaintenanceBody,
		): Promise<AssetMaintenance> {
			const res = await authFetch<ApiResponse<AssetMaintenance>>(
				`/v1/assets/${assetId}/maintenances`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		async updateMaintenance(
			id: number,
			body: UpdateAssetMaintenanceBody,
		): Promise<AssetMaintenance> {
			const res = await authFetch<ApiResponse<AssetMaintenance>>(`/v1/asset-maintenances/${id}`, {
				method: 'PATCH',
				body,
			});
			return res.data;
		},

		async closeMaintenance(id: number, body: CloseAssetMaintenanceBody): Promise<AssetMaintenance> {
			const res = await authFetch<ApiResponse<AssetMaintenance>>(
				`/v1/asset-maintenances/${id}/close`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		// ─── Giấy tờ ──────────────────────────────────────────────────────────────

		async findDocuments(assetId: number): Promise<AssetDocument[]> {
			const res = await authFetch<ApiResponse<AssetDocument[]>>(`/v1/assets/${assetId}/documents`);
			return res.data;
		},

		async uploadDocument(body: AssetDocumentUploadBody): Promise<AssetDocument> {
			const res = await authFetch<ApiResponse<AssetDocument>>('/v1/asset-documents', {
				method: 'POST',
				body: documentFormData(body),
			});
			return res.data;
		},

		/** Presigned URL sống ngắn: mở ngay, đừng lưu lại. */
		async documentUrl(documentId: number): Promise<string> {
			const res = await authFetch<ApiResponse<{ url: string }>>(
				`/v1/asset-documents/${documentId}/url`,
			);
			return res.data.url;
		},

		async linkDocument(
			documentId: number,
			target: { assetId?: number; assignmentId?: number; renewalId?: number; maintenanceId?: number },
		): Promise<AssetDocument> {
			const res = await authFetch<ApiResponse<AssetDocument>>(
				`/v1/asset-documents/${documentId}/links`,
				{ method: 'POST', body: target },
			);
			return res.data;
		},

		async unlinkDocument(documentId: number, linkId: number): Promise<void> {
			await authFetch<unknown>(`/v1/asset-documents/${documentId}/links/${linkId}`, {
				method: 'DELETE',
			});
		},

		async removeDocument(documentId: number): Promise<void> {
			await authFetch<unknown>(`/v1/asset-documents/${documentId}`, { method: 'DELETE' });
		},

		// ─── Báo cáo và nhập Excel ────────────────────────────────────────────────

		async depreciationReport(
			params?: AssetDepreciationReportQuery,
		): Promise<AssetDepreciationReport> {
			const res = await authFetch<ApiResponse<AssetDepreciationReport>>(
				'/v1/asset-reports/depreciation',
				{ params },
			);
			return res.data;
		},

		async exportDepreciationReport(params?: AssetDepreciationReportQuery): Promise<Blob> {
			return authFetch<Blob>('/v1/asset-reports/depreciation/export', {
				params,
				responseType: 'blob',
			});
		},

		async expiringReport(params?: AssetExpiringQuery): Promise<AssetExpiringRow[]> {
			const res = await authFetch<ApiResponse<AssetExpiringRow[]>>('/v1/asset-reports/expiring', {
				params,
			});
			return res.data;
		},

		// ─── Đợt 2: tổng quan và báo cáo tiền ─────────────────────────────────────

		async overview(): Promise<AssetOverview> {
			const res = await authFetch<ApiResponse<AssetOverview>>('/v1/asset-reports/overview');
			return res.data;
		},

		async serviceCosts(params: AssetServiceCostQuery): Promise<AssetServiceCostReport> {
			const res = await authFetch<ApiResponse<AssetServiceCostReport>>(
				'/v1/asset-reports/service-costs',
				{ params },
			);
			return res.data;
		},

		async exportServiceCosts(params: AssetServiceCostQuery): Promise<Blob> {
			return authFetch<Blob>('/v1/asset-reports/service-costs/export', {
				params,
				responseType: 'blob',
			});
		},

		async maintenanceCosts(params: AssetMaintenanceCostQuery): Promise<AssetMaintenanceCostReport> {
			const res = await authFetch<ApiResponse<AssetMaintenanceCostReport>>(
				'/v1/asset-reports/maintenance-costs',
				{ params },
			);
			return res.data;
		},

		async exportMaintenanceCosts(params: AssetMaintenanceCostQuery): Promise<Blob> {
			return authFetch<Blob>('/v1/asset-reports/maintenance-costs/export', {
				params,
				responseType: 'blob',
			});
		},

		/** Excel ba sheet cho kế toán; kỳ tối đa 12 tháng. */
		async exportAccounting(params: AssetDateRangeQuery): Promise<Blob> {
			return authFetch<Blob>('/v1/asset-reports/accounting-export', {
				params,
				responseType: 'blob',
			});
		},

		// ─── Đợt 2: biên bản PDF ──────────────────────────────────────────────────

		/**
		 * Biên bản bàn giao (`assign`) hoặc thu hồi (`return`).
		 *
		 * Khác các file Excel: route trả JSON `{ document, url }`, `url` là presigned sống
		 * một giờ nên mở ngay, đừng lưu lại. Lần sau gọi lại ra cùng giấy tờ, URL mới.
		 */
		async handoverPdf(assignmentId: number, kind: 'assign' | 'return'): Promise<AssetHandoverPdf> {
			const res = await authFetch<ApiResponse<AssetHandoverPdf>>(
				`/v1/asset-assignments/${assignmentId}/handover-pdf`,
				{ params: { kind } },
			);
			return res.data;
		},

		// ─── Đợt 2: báo hỏng, báo mất (trang quản lý) ─────────────────────────────

		async findIncidents(
			params?: AssetIncidentQueryParams,
		): Promise<{ data: AssetIncident[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<AssetIncident>>('/v1/asset-incidents', {
				params,
			});
			return { data: res.data, meta: res.meta };
		},

		async findIncident(id: number): Promise<AssetIncident> {
			const res = await authFetch<ApiResponse<AssetIncident>>(`/v1/asset-incidents/${id}`);
			return res.data;
		},

		/** Chỉ báo hỏng: mở phiếu sửa mang sẵn mô tả và ảnh của báo cáo. */
		async repairFromIncident(
			id: number,
			body: RepairFromAssetIncidentBody,
		): Promise<AssetIncident> {
			const res = await authFetch<ApiResponse<AssetIncident>>(
				`/v1/asset-incidents/${id}/repair`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		/** Chỉ báo mất: tài sản sang Mất, đóng cấp phát, thôi khấu hao từ `lostOn`. */
		async confirmIncidentLoss(id: number, body: ConfirmAssetLossBody): Promise<AssetIncident> {
			const res = await authFetch<ApiResponse<AssetIncident>>(
				`/v1/asset-incidents/${id}/confirm-loss`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		/** Báo hỏng: đóng không cần sửa. Báo mất: đã tìm thấy, tài sản về trạng thái cũ. */
		async closeIncident(id: number, body: HandleAssetIncidentBody): Promise<AssetIncident> {
			const res = await authFetch<ApiResponse<AssetIncident>>(`/v1/asset-incidents/${id}/close`, {
				method: 'POST',
				body,
			});
			return res.data;
		},

		async downloadImportTemplate(): Promise<Blob> {
			return authFetch<Blob>('/v1/asset-imports/template', { responseType: 'blob' });
		},

		async importFromExcel(file: File): Promise<AssetImportResult> {
			const form = new FormData();
			form.append('file', file);
			const res = await authFetch<ApiResponse<AssetImportResult>>('/v1/asset-imports', {
				method: 'POST',
				body: form,
			});
			return res.data;
		},

		// ─── Hồ sơ nhân viên và nghỉ việc ─────────────────────────────────────────

		async findEmployeeAssets(employeeId: number, openOnly = false): Promise<AssetAssignment[]> {
			const res = await authFetch<ApiResponse<AssetAssignment[]>>(
				`/v1/employees/${employeeId}/assets`,
				{ params: openOnly ? { open: true } : undefined },
			);
			return res.data;
		},

		async returnAllEmployeeAssets(employeeId: number): Promise<number> {
			const res = await authFetch<ApiResponse<{ returned: number }>>(
				`/v1/employees/${employeeId}/assets/return-all`,
				{ method: 'POST' },
			);
			return res.data.returned;
		},

		// ─── Tự phục vụ: tài sản của tôi (chỉ cần JWT, mọi vai trò) ───────────────

		async myAssets(): Promise<MyAssets> {
			const res = await authFetch<ApiResponse<MyAssets>>('/v1/me/assets');
			return res.data;
		},

		async confirmMyAssignment(
			assignmentId: number,
			body: ConfirmAssignmentBody,
		): Promise<AssetAssignment> {
			const res = await authFetch<ApiResponse<AssetAssignment>>(
				`/v1/me/assets/assignments/${assignmentId}/confirm`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		/** Nhân viên chỉ mở được biên bản bàn giao và ảnh tình trạng của chính mình. */
		async myDocumentUrl(documentId: number): Promise<string> {
			const res = await authFetch<ApiResponse<{ url: string }>>(
				`/v1/me/assets/documents/${documentId}/url`,
			);
			return res.data.url;
		},

		// ─── Đợt 2, tự phục vụ: báo hỏng, báo mất và biên bản của tôi ─────────────

		/** Chỉ thiết bị mình đang giữ hoặc chịu trách nhiệm (403 `ASSET_NOT_HELD`). */
		async reportIncident(assetId: number, body: ReportAssetIncidentBody): Promise<AssetIncident> {
			const res = await authFetch<ApiResponse<AssetIncident>>(
				`/v1/me/assets/${assetId}/incidents`,
				{ method: 'POST', body: incidentFormData(body) },
			);
			return res.data;
		},

		async myIncidents(
			params?: AssetIncidentQueryParams,
		): Promise<{ data: AssetIncident[]; meta: PaginatedMeta }> {
			const res = await authFetch<PaginatedResponse<AssetIncident>>('/v1/me/assets/incidents', {
				params,
			});
			return { data: res.data, meta: res.meta };
		},

		/** Biên bản của lần bàn giao cho chính mình (403 `ASSET_ASSIGNMENT_NOT_YOURS`). */
		async myHandoverPdf(
			assignmentId: number,
			kind: 'assign' | 'return',
		): Promise<AssetHandoverPdf> {
			const res = await authFetch<ApiResponse<AssetHandoverPdf>>(
				`/v1/me/assets/assignments/${assignmentId}/handover-pdf`,
				{ params: { kind } },
			);
			return res.data;
		},

		// ─── Tự phục vụ: dịch vụ tôi phụ trách ────────────────────────────────────

		/** Mảng rỗng nghĩa là người này không phụ trách dịch vụ nào: ẩn tab. */
		async myServices(): Promise<Asset[]> {
			const res = await authFetch<ApiResponse<Asset[]>>('/v1/me/asset-services');
			return res.data;
		},

		async myServiceRenewals(id: number): Promise<AssetRenewal[]> {
			const res = await authFetch<ApiResponse<AssetRenewal[]>>(
				`/v1/me/asset-services/${id}/renewals`,
			);
			return res.data;
		},

		/** Response luôn có số tiền, kể cả khi người gọi không có `asset:value:read`. */
		async createMyServiceRenewal(id: number, body: AssetRenewalBody): Promise<AssetRenewal> {
			const res = await authFetch<ApiResponse<AssetRenewal>>(
				`/v1/me/asset-services/${id}/renewals`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		async addMyServiceSeat(id: number, body: AssetSeatBody): Promise<AssetAssignResult> {
			const res = await authFetch<ApiResponse<AssetAssignResult>>(
				`/v1/me/asset-services/${id}/seats`,
				{ method: 'POST', body },
			);
			return res.data;
		},

		async returnMyServiceSeat(
			id: number,
			assignmentId: number,
			body?: { returnedAt?: string; note?: string },
		): Promise<AssetAssignment> {
			const res = await authFetch<ApiResponse<AssetAssignment>>(
				`/v1/me/asset-services/${id}/seats/${assignmentId}/return`,
				{ method: 'POST', body: body ?? {} },
			);
			return res.data;
		},

		async setMyServiceLicenseKey(id: number, licenseKey: string): Promise<Asset> {
			const res = await authFetch<ApiResponse<Asset>>(`/v1/me/asset-services/${id}/license-key`, {
				method: 'PUT',
				body: { licenseKey },
			});
			return res.data;
		},

		async clearMyServiceLicenseKey(id: number): Promise<Asset> {
			const res = await authFetch<ApiResponse<Asset>>(`/v1/me/asset-services/${id}/license-key`, {
				method: 'DELETE',
			});
			return res.data;
		},

		async revealMyServiceLicenseKey(id: number): Promise<string> {
			const res = await authFetch<ApiResponse<{ licenseKey: string }>>(
				`/v1/me/asset-services/${id}/license-key/reveal`,
				{ method: 'POST' },
			);
			return res.data.licenseKey;
		},

		/** `renewalId` bắt buộc và phải là lần gia hạn của chính dịch vụ này. */
		async uploadMyServiceDocument(
			id: number,
			body: AssetDocumentUploadBody & { renewalId: number },
		): Promise<AssetDocument> {
			const res = await authFetch<ApiResponse<AssetDocument>>(
				`/v1/me/asset-services/${id}/documents`,
				{ method: 'POST', body: documentFormData(body) },
			);
			return res.data;
		},
	};
};
