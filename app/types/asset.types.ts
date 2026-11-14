/**
 * Module Quản lý tài sản (`ASSET`).
 *
 * Chép theo `docs/backend/bridges/assets.md` mục 4 và 5, đã đối chiếu với
 * `hr-system-be/docs/openapi.json` ngày 10/11/2026. Hai họ tài sản dùng chung một bảng:
 * thiết bị (`PHYSICAL`) giao cho một người hoặc một phòng ban, dịch vụ (`SERVICE`) cấp
 * theo ghế cho nhiều người.
 */

// ─── Enum ─────────────────────────────────────────────────────────────────────

export type AssetKind = 'PHYSICAL' | 'SERVICE';

export type AssetStatus =
	// thiết bị
	| 'AVAILABLE'
	| 'IN_USE'
	| 'IN_REPAIR'
	| 'BROKEN'
	| 'LOST'
	| 'DISPOSED'
	// thiết bị, đợt 2
	| 'LOSS_REPORTED'
	| 'IN_MAINTENANCE'
	// dịch vụ
	| 'ACTIVE'
	| 'EXPIRED'
	| 'CANCELLED';

/** Đợt 2 thêm `MAINTENANCE`: phiếu bảo dưỡng định kỳ, bên cạnh phiếu sửa chữa. */
export type AssetMaintenanceType = 'REPAIR' | 'MAINTENANCE';

/** Đợt 2. Nhân viên báo hỏng hoặc báo mất thiết bị mình đang giữ. */
export type AssetIncidentType = 'DAMAGE' | 'LOSS';

/**
 * Sửa sau bài nhập vai (14/11) thêm `RESOLVED`: phiếu sửa tạo từ báo hỏng đã đóng (Xong, Không
 * sửa được hoặc Huỷ), kết quả nằm ở `AssetIncident.maintenance`.
 */
export type AssetIncidentStatus = 'OPEN' | 'REPAIR_OPENED' | 'LOSS_CONFIRMED' | 'CLOSED' | 'RESOLVED';

/** Sửa sau bài nhập vai. Vì sao một lần cấp phát kết thúc; `null` khi còn đang giữ. */
export type AssetAssignmentEndReason = 'RETURNED' | 'TRANSFERRED' | 'LOST';

export type AssetCondition = 'NEW' | 'GOOD' | 'SCRATCHED' | 'FAULTY' | 'BROKEN';
export type AssetAccountingClass = 'FIXED_ASSET' | 'TOOL';
export type AssetBillingCycle = 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ONE_TIME';
export type AssetPricingUnit = 'PER_SEAT' | 'PER_PLAN';
export type AssetAssignmentConfirmation = 'PENDING' | 'CONFIRMED' | 'DISPUTED' | 'NOT_REQUIRED';
export type AssetMaintenanceStatus = 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'UNREPAIRABLE' | 'CANCELLED';
export type AssetVendorType = 'SUPPLIER' | 'REPAIR' | 'SERVICE';

export type AssetDocumentType =
	| 'PURCHASE_CONTRACT'
	| 'SERVICE_CONTRACT'
	| 'INVOICE'
	| 'WARRANTY'
	| 'HANDOVER_RECORD'
	| 'CONDITION_PHOTO'
	| 'REPAIR_QUOTE'
	| 'DISPOSAL_RECORD'
	| 'OTHER';

export type AssetEventType =
	| 'CREATED'
	| 'UPDATED'
	| 'STATUS_CHANGED'
	| 'ASSIGNED'
	| 'RETURNED'
	| 'ASSIGNMENT_CONFIRMED'
	| 'ASSIGNMENT_DISPUTED'
	| 'REPAIR_OPENED'
	| 'REPAIR_CLOSED'
	| 'RENEWED'
	| 'SEATS_CHANGED'
	| 'VALUE_CHANGED'
	| 'DOCUMENT_ADDED'
	| 'DOCUMENT_REMOVED'
	| 'LICENSE_KEY_CHANGED'
	// đợt 2
	| 'INCIDENT_REPORTED'
	| 'INCIDENT_HANDLED'
	| 'MAINTENANCE_SCHEDULED'
	// sửa sau bài nhập vai: người quản lý tài sản trả lời người nhận báo chưa đúng
	| 'ASSIGNMENT_DISPUTE_RESOLVED';

// ─── Thành phần dùng lại ──────────────────────────────────────────────────────

export interface AssetPersonSummary {
	id: number;
	fullName: string;
	employeeCode: string;
}

export interface AssetIdName {
	id: number;
	name: string;
}

// ─── Danh mục ─────────────────────────────────────────────────────────────────

export interface AssetCategory {
	id: number;
	/** Loại, VD "Laptop". */
	name: string;
	/** Nhóm, VD "Máy tính". Màn cài đặt hiển thị Nhóm → Loại. */
	groupName: string;
	kind: AssetKind;
	kindLabel: string;
	/** `null` = loại này không khấu hao. */
	defaultDepreciationMonths: number | null;
	/** Đợt 2. Chu kỳ bảo dưỡng mặc định của loại, tính bằng tháng; `null` = không có lịch. */
	defaultMaintenanceMonths: number | null;
	requireSerial: boolean;
	isActive: boolean;
}

/**
 * Đơn vị sở hữu: mỗi công ty đúng một, tự có, không thêm hay sửa được và KHÔNG có màn
 * hình nào. `code` là mã công ty chuẩn hoá, cũng là tiền tố mã tài sản (`CTYSTH000140`).
 */
export interface AssetOwnerUnit {
	id: number;
	code: string;
	name: string;
	isDefault: boolean;
	isActive: boolean;
}

export interface AssetVendor {
	id: number;
	name: string;
	types: AssetVendorType[];
	typeLabels: string[];
	taxCode: string | null;
	address: string | null;
	website: string | null;
	contactName: string | null;
	phone: string | null;
	email: string | null;
	note: string | null;
	isActive: boolean;
}

export interface AssetVendorDetail extends AssetVendor {
	assets: { id: number; code: string; name: string; kind: AssetKind; statusLabel: string }[];
	maintenances: {
		id: number;
		statusLabel: string;
		description: string;
		assetCode: string;
		doneAt: string | null;
	}[];
}

// ─── Tài sản ──────────────────────────────────────────────────────────────────

/** Cấp phát đang mở. Với dịch vụ, mỗi phần tử là một ghế. */
export interface AssetHolder {
	assignmentId: number;
	employee: AssetPersonSummary | null;
	department: AssetIdName | null;
	/** Người chịu trách nhiệm khi giao cho phòng ban. */
	responsible: AssetPersonSummary | null;
	assignedAt: string;
	confirmation: AssetAssignmentConfirmation;
	confirmationLabel: string;
}

export interface AssetPhysical {
	manufacturer: string | null;
	model: string | null;
	serialNumber: string | null;
	location: string | null;
	condition: AssetCondition | null;
	conditionLabel: string | null;
	warrantyMonths: number | null;
	warrantyEndDate: string | null;
	depreciationStartDate: string | null;
	depreciationMonths: number | null;
	salvageValue: number | null;
	/** Ngày mất, thôi trích khấu hao. */
	depreciationStopDate: string | null;
	accountingClass: AssetAccountingClass | null;
	accountingClassLabel: string | null;
	/** Đợt 2. Chu kỳ bảo dưỡng định kỳ, tính bằng tháng; `null` = không có lịch. */
	maintenanceIntervalMonths: number | null;
	/** Đợt 2. Hạn bảo dưỡng kế tiếp, `YYYY-MM-DD`. */
	nextMaintenanceDate: string | null;
}

export interface AssetServiceInfo {
	plan: string | null;
	billingCycle: AssetBillingCycle;
	billingCycleLabel: string;
	/** `null` khi mua đứt (`ONE_TIME`). */
	nextRenewalDate: string | null;
	/** Âm là đã quá hạn. Tô màu theo số này. */
	daysUntilRenewal: number | null;
	anchorDay: number | null;
	/** `null` = không tính theo ghế. */
	seatCount: number | null;
	/** Vượt `seatCount` là được phép, chỉ cảnh báo. */
	seatsUsed: number;
	unitPrice: number | null;
	pricingUnit: AssetPricingUnit;
	pricingUnitLabel: string;
	autoRenew: boolean;
	owner: AssetPersonSummary;
	adminAccount: string | null;
	adminUrl: string | null;
	passwordManagerUrl: string | null;
	/** Chỉ tên thẻ và 4 số cuối. Ghi đủ số thẻ thì BE trả 400. */
	paymentMethodNote: string | null;
	technicalInfo: string | null;
	hasLicenseKey: boolean;
	licenseKeyMasked: string | null;
}

export interface Asset {
	id: number;
	/** VD `CTYSTH000140`. */
	code: string;
	name: string;
	kind: AssetKind;
	kindLabel: string;
	status: AssetStatus;
	statusLabel: string;
	category: AssetCategory;
	ownerUnit: AssetOwnerUnit;
	vendor: AssetIdName | null;
	purchaseDate: string | null;
	cost: number | null;
	currency: string;
	exchangeRate: number | null;
	costVnd: number | null;
	/** Giá trị còn lại hôm nay, chỉ thiết bị có khấu hao. */
	bookValue: number | null;
	note: string | null;
	holders: AssetHolder[];
	physical: AssetPhysical | null;
	service: AssetServiceInfo | null;
	/** Đợt 2. Báo hỏng, báo mất đang chờ xử lý; mảng rỗng là không có. */
	openIncidents: AssetOpenIncident[];
	/**
	 * Ẩn cột tiền theo cờ này, đừng tự suy từ vai trò: người thiếu `asset:value:read`
	 * nhận `null` ở mọi trường tiền.
	 */
	canViewValue: boolean;
	createdAt: string;
	updatedAt: string;
}

/** Đợt 2. Bản rút gọn của báo cáo đang chờ, đính kèm trong mỗi tài sản. */
export interface AssetOpenIncident {
	id: number;
	type: AssetIncidentType;
	typeLabel: string;
	createdAt: string;
}

export interface AssetEvent {
	id: number;
	type: AssetEventType;
	typeLabel: string;
	/** `null` khi do việc định kỳ. */
	actor: AssetIdName | null;
	occurredAt: string;
	/** Tuỳ loại; chỉ để hiện chi tiết phụ, đừng dựa vào cấu trúc. */
	payload: Record<string, unknown>;
}

// ─── Cấp phát ─────────────────────────────────────────────────────────────────

export interface AssetAssignmentAsset {
	id: number;
	code: string;
	name: string;
	kind: AssetKind;
	kindLabel: string;
	status: AssetStatus;
	statusLabel: string;
	categoryName: string;
	groupName: string;
	/** Sửa sau bài nhập vai: hiện ở "Tài sản của tôi" để người nhận đối chiếu máy thật. */
	serialNumber: string | null;
}

/** Hai đầu của một lần điều chuyển: lần cấp phát bên kia và tên người giữ ở lần đó. */
export interface AssetTransferLink {
	assignmentId: number;
	holderName: string;
}

export interface AssetAssignment {
	id: number;
	asset: AssetAssignmentAsset;
	employee: AssetPersonSummary | null;
	department: AssetIdName | null;
	responsible: AssetPersonSummary | null;
	assignedAt: string;
	assignedBy: AssetIdName;
	conditionOnAssign: AssetCondition | null;
	conditionOnAssignLabel: string | null;
	expectedReturnDate: string | null;
	note: string | null;
	confirmation: AssetAssignmentConfirmation;
	confirmationLabel: string;
	confirmedAt: string | null;
	disputeReason: string | null;
	/** `null` = đang giữ. */
	returnedAt: string | null;
	returnedBy: AssetIdName | null;
	conditionOnReturn: AssetCondition | null;
	conditionOnReturnLabel: string | null;
	returnNote: string | null;
	// ─── sửa sau bài nhập vai (14/11) ───
	/** `null` khi đang giữ. `LOST` thì không có biên bản thu hồi (409 `ASSET_ASSIGNMENT_LOST`). */
	endReason: AssetAssignmentEndReason | null;
	/** "Thu hồi", "Điều chuyển" hoặc "Mất". */
	endReasonLabel: string | null;
	/** Lần cấp phát này sinh ra do điều chuyển từ người khác. */
	transferredFrom: AssetTransferLink | null;
	/** Lần cấp phát này kết thúc vì điều chuyển sang người khác. */
	transferredTo: AssetTransferLink | null;
	/** Câu trả lời của người quản lý tài sản khi người nhận báo chưa đúng. */
	disputeResponse: string | null;
	disputeRespondedAt: string | null;
}

export interface AssetAssignResult {
	assignment: AssetAssignment;
	/** Vượt số ghế vẫn 201, chỉ kèm cảnh báo. */
	warnings: 'SEATS_EXCEEDED'[];
}

export interface MyAssets {
	/** Đang giữ, gồm cả thứ mình chịu trách nhiệm thay phòng ban. */
	holding: AssetAssignment[];
	history: AssetAssignment[];
	/** Badge của menu "Tài sản của tôi". */
	pendingConfirmationCount: number;
}

// ─── Gia hạn, sửa chữa, giấy tờ ───────────────────────────────────────────────

export interface AssetRenewal {
	id: number;
	periodStart: string;
	periodEnd: string;
	seatCount: number | null;
	amount: number | null;
	currency: string;
	exchangeRate: number | null;
	amountVnd: number | null;
	paidAt: string;
	note: string | null;
	createdBy: AssetIdName;
}

export interface AssetMaintenance {
	id: number;
	asset: { id: number; code: string; name: string };
	type: AssetMaintenanceType;
	typeLabel: string;
	status: AssetMaintenanceStatus;
	statusLabel: string;
	description: string;
	workDone: string | null;
	vendor: AssetIdName | null;
	underWarranty: boolean;
	cost: number | null;
	sentAt: string | null;
	expectedDoneAt: string | null;
	doneAt: string | null;
	/** Đợt 2: `null` là phiếu bảo dưỡng do việc định kỳ tự mở — hiển thị "Hệ thống". */
	createdBy: AssetIdName | null;
	createdAt: string;
}

export interface AssetDocumentLink {
	id: number;
	assetId: number | null;
	assetCode: string | null;
	assignmentId: number | null;
	renewalId: number | null;
	maintenanceId: number | null;
	/** Đợt 2. Ảnh kèm theo một báo hỏng, báo mất. */
	incidentId: number | null;
}

/** KHÔNG có URL file: lấy qua `GET /asset-documents/:id/url` khi người dùng bấm mở. */
export interface AssetDocument {
	id: number;
	type: AssetDocumentType;
	typeLabel: string;
	number: string | null;
	issuedDate: string | null;
	amount: number | null;
	fileName: string;
	mimeType: string;
	sizeBytes: number;
	uploadedBy: AssetIdName;
	uploadedAt: string;
	links: AssetDocumentLink[];
}

// ─── Khấu hao, báo cáo, nhập Excel ────────────────────────────────────────────

export interface AssetDepreciationPeriod {
	/** "2025-03". */
	month: string;
	from: string;
	to: string;
	days: number;
	daysInMonth: number;
	amount: number;
	accumulated: number;
	bookValue: number;
}

export interface AssetDepreciation {
	asOf: string;
	costVnd: number | null;
	salvageValue: number;
	startDate: string | null;
	months: number | null;
	stopDate: string | null;
	accumulated: number;
	bookValue: number | null;
	accountingClass: AssetAccountingClass | null;
	/** Nhãn của phân loại ĐÃ ĐẶT. `null` khi chưa đặt — lúc đó dùng bản gợi ý bên dưới. */
	accountingClassLabel: string | null;
	suggestedAccountingClass: AssetAccountingClass;
	suggestedAccountingClassLabel: string;
	schedule: AssetDepreciationPeriod[];
}

export interface AssetDepreciationReportRow {
	assetId: number;
	code: string;
	name: string;
	categoryName: string;
	ownerUnitCode: string;
	accountingClass: AssetAccountingClass | null;
	accountingClassLabel: string | null;
	startDate: string | null;
	months: number | null;
	costVnd: number;
	accumulated: number;
	bookValue: number;
}

export interface AssetDepreciationReport {
	asOf: string;
	rows: AssetDepreciationReportRow[];
	totals: { costVnd: number; accumulated: number; bookValue: number };
}

export interface AssetExpiringRow {
	type: 'renewal' | 'warranty';
	assetId: number;
	code: string;
	name: string;
	date: string;
	/** Âm là đã quá hạn. */
	daysLeft: number;
	/** Người phụ trách, chỉ với dịch vụ. */
	ownerName: string | null;
}

export interface AssetImportResult {
	created: { physical: number; service: number };
	autoCreated: { categories: string[]; vendors: string[] };
	errors: { sheet: 'Tài sản' | 'Dịch vụ'; row: number; messages: string[] }[];
	/** VD `["Dịch vụ: Password"]`. Báo người dùng các cột mật khẩu đã bị bỏ qua. */
	ignoredColumns: string[];
}

// ─── Đợt 2: báo hỏng, báo mất ─────────────────────────────────────────────────

export interface AssetIncident {
	id: number;
	asset: { id: number; code: string; name: string; status: AssetStatus; statusLabel: string };
	type: AssetIncidentType;
	typeLabel: string;
	status: AssetIncidentStatus;
	statusLabel: string;
	description: string;
	/** Ngày phát hiện do nhân viên khai, `YYYY-MM-DD`. */
	occurredOn: string | null;
	reportedBy: AssetIdName;
	handledBy: AssetIdName | null;
	handledAt: string | null;
	handlingNote: string | null;
	/** Phiếu sửa được tạo từ báo hỏng này. */
	maintenanceId: number | null;
	/** Sửa sau bài nhập vai: phiếu sửa tạo từ báo hỏng, kèm kết quả khi phiếu đã đóng. */
	maintenance: AssetIncidentMaintenance | null;
	/**
	 * Ảnh kèm theo. Mở từng ảnh qua `GET /asset-documents/:id/url` (người quản lý) hoặc
	 * `GET /me/assets/documents/:id/url` (người gửi) — response không mang sẵn URL.
	 */
	photoDocumentIds: number[];
	createdAt: string;
}

export interface AssetIncidentMaintenance {
	id: number;
	status: AssetMaintenanceStatus;
	/** "Xong", "Không sửa được", "Đã huỷ"... */
	statusLabel: string;
	doneAt: string | null;
	workDone: string | null;
}

/**
 * Biên bản bàn giao, thu hồi hoặc điều chuyển. `url` là presigned, hết hạn sau 1 giờ.
 * Lần cấp phát kết thúc vì điều chuyển thì `kind=return` trả cùng biên bản `BBDC-…` với
 * `kind=assign` của lần mới.
 */
export interface AssetHandoverPdf {
	document: AssetDocument;
	url: string;
}

// ─── Đợt 2: tổng quan và báo cáo tiền ─────────────────────────────────────────

export interface AssetOverviewStatus {
	status: AssetStatus;
	statusLabel: string;
	count: number;
}

export interface AssetOverviewDepartment {
	/** "Chưa giao" khi thiết bị chưa ở ai; web hiện thành "Chưa cấp phát" và xếp cuối. */
	departmentName: string;
	count: number;
	costVnd: number | null;
	bookValue: number | null;
}

export interface AssetOverview {
	asOf: string;
	canViewValue: boolean;
	/** Sửa sau bài nhập vai: KHÔNG gồm Mất, Đã thanh lý, Đã huỷ (`byStatus` vẫn đủ). */
	total: number;
	physicalCount: number;
	serviceCount: number;
	/** Bằng `meta.total` của `GET /assets?disputed=true`. */
	disputedConfirmations: number;
	/** Chỉ những trạng thái đang có ít nhất một tài sản. */
	byStatus: AssetOverviewStatus[];
	byDepartment: AssetOverviewDepartment[];
	/** `null` khi người xem không có `asset:value:read`. */
	totals: { costVnd: number; bookValue: number } | null;
	serviceCostThisMonth: number | null;
	/** Dịch vụ sắp gia hạn cộng thiết bị sắp hết bảo hành trong 30 ngày tới. */
	expiringIn30Days: number;
	maintenanceDueIn30Days: number;
	pendingConfirmations: number;
	openIncidents: number;
}

export interface AssetServiceCostRow {
	renewalId: number;
	assetId: number;
	code: string;
	name: string;
	categoryName: string;
	vendorName: string | null;
	ownerName: string | null;
	periodStart: string;
	periodEnd: string;
	/** Số tiền của cả kỳ gia hạn. */
	amountVnd: number;
	/** Phần phân bổ vào tháng đang xem — cột chính của báo cáo. */
	shareVnd: number;
}

export interface AssetServiceCostReport {
	/** `YYYY-MM`. */
	month: string;
	rows: AssetServiceCostRow[];
	/** Tổng của `shareVnd`. */
	totalVnd: number;
}

export interface AssetMaintenanceCostRow {
	maintenanceId: number;
	assetId: number;
	code: string;
	name: string;
	type: AssetMaintenanceType;
	typeLabel: string;
	vendorName: string | null;
	underWarranty: boolean;
	doneAt: string;
	cost: number;
}

export interface AssetMaintenanceCostReport {
	from: string;
	to: string;
	rows: AssetMaintenanceCostRow[];
	totalVnd: number;
}

// ─── Query và body ────────────────────────────────────────────────────────────

export interface AssetQueryParams {
	page?: number;
	limit?: number;
	kind?: AssetKind;
	categoryId?: number;
	groupName?: string;
	status?: AssetStatus;
	vendorId?: number;
	employeeId?: number;
	departmentId?: number;
	search?: string;
	/**
	 * Đợt 2. Thiết bị Sẵn sàng hoặc Đang sử dụng, có lịch bảo dưỡng và hạn kế tiếp trong
	 * `N` ngày tới, kể cả đã quá hạn. Nhận 1–365, ngoài khoảng đó BE trả 400.
	 */
	maintenanceDueWithinDays?: number;
	/** Đợt 2. `true` = chỉ tài sản có lần cấp phát đang chờ người nhận xác nhận. */
	pendingConfirmation?: boolean;
	/** Sửa sau bài nhập vai. `true` = chỉ tài sản có lần cấp phát người nhận báo chưa đúng. */
	disputed?: boolean;
}

export interface AssetPhysicalBody {
	manufacturer?: string;
	model?: string;
	serialNumber?: string;
	location?: string;
	condition?: AssetCondition;
	warrantyMonths?: number;
	/** Nhập thẳng thì thắng `warrantyMonths`. */
	warrantyEndDate?: string;
	depreciationStartDate?: string;
	depreciationMonths?: number;
	salvageValue?: number;
	/** Bỏ trống = BE gợi ý. */
	accountingClass?: AssetAccountingClass;
	/** Đợt 2. 0–120 tháng. Khi tạo bỏ trống = theo loại; khi sửa gửi `0` là bỏ lịch. */
	maintenanceIntervalMonths?: number;
	/** Đợt 2. Bỏ trống khi đã có chu kỳ = hôm nay cộng chu kỳ. */
	nextMaintenanceDate?: string;
}

export interface AssetServiceBody {
	billingCycle: AssetBillingCycle;
	/** Người phụ trách, phải đang làm việc. */
	ownerId: number;
	/** Bắt buộc trừ `ONE_TIME`. */
	nextRenewalDate?: string;
	anchorDay?: number;
	plan?: string;
	seatCount?: number;
	unitPrice?: number;
	pricingUnit?: AssetPricingUnit;
	autoRenew?: boolean;
	adminAccount?: string;
	adminUrl?: string;
	passwordManagerUrl?: string;
	/** Chuỗi có ≥ 12 chữ số liền → 400 `ASSET_PAYMENT_NOTE_INVALID`. */
	paymentMethodNote?: string;
	technicalInfo?: string;
	/** Chỉ khi tạo; sau đó dùng `PUT /assets/:id/license-key`. */
	licenseKey?: string;
}

export interface CreateAssetBody {
	kind: AssetKind;
	name: string;
	categoryId: number;
	vendorId?: number;
	/** Bỏ trống = tự sinh `{mã công ty}{6 số}`. */
	code?: string;
	purchaseDate?: string;
	cost?: number;
	currency?: string;
	exchangeRate?: number;
	note?: string;
	physical?: AssetPhysicalBody;
	service?: AssetServiceBody;
}

/** `PATCH` không nhận `kind`, và khối `service` không nhận `licenseKey`. */
export type UpdateAssetBody = Omit<Partial<CreateAssetBody>, 'kind' | 'service'> & {
	service?: Partial<Omit<AssetServiceBody, 'licenseKey'>>;
};

export interface AssetAssignBody {
	/** Chọn đúng một trong hai: `employeeId`, hoặc `departmentId` + `responsibleId`. */
	employeeId?: number;
	/** Chỉ thiết bị. */
	departmentId?: number;
	responsibleId?: number;
	/** Mặc định hôm nay, nhập được ngày quá khứ. */
	assignedAt?: string;
	condition?: AssetCondition;
	expectedReturnDate?: string;
	note?: string;
}

export interface AssetTransferBody extends AssetAssignBody {
	conditionOnReturn?: AssetCondition;
}

export interface AssetReturnBody {
	returnedAt?: string;
	/** `BROKEN` thì tài sản về `BROKEN`, ngược lại về `AVAILABLE`. */
	condition?: AssetCondition;
	note?: string;
}

export interface AssetRenewalBody {
	amount: number;
	currency?: string;
	exchangeRate?: number;
	paidAt?: string;
	/** Khác hiện tại thì cập nhật số ghế của dịch vụ. */
	seatCount?: number;
	nextRenewalDate?: string;
	note?: string;
}

export interface AssetStatusBody {
	status: 'LOST' | 'CANCELLED';
	date?: string;
	reason: string;
}

export interface CreateAssetCategoryBody {
	name: string;
	groupName: string;
	kind: AssetKind;
	defaultDepreciationMonths?: number;
	/** Đợt 2. Chu kỳ bảo dưỡng mặc định, tính bằng tháng; gửi `0` để bỏ. */
	defaultMaintenanceMonths?: number;
	requireSerial?: boolean;
	isActive?: boolean;
}

export type UpdateAssetCategoryBody = Partial<Omit<CreateAssetCategoryBody, 'kind'>> & {
	kind?: AssetKind;
};

export interface CreateAssetVendorBody {
	name: string;
	types?: AssetVendorType[];
	taxCode?: string;
	address?: string;
	website?: string;
	contactName?: string;
	phone?: string;
	email?: string;
	note?: string;
	isActive?: boolean;
}

export type UpdateAssetVendorBody = Partial<CreateAssetVendorBody>;

export interface AssetMaintenanceQueryParams {
	page?: number;
	limit?: number;
	status?: AssetMaintenanceStatus;
	/** Đợt 2. Lọc phiếu sửa chữa hay phiếu bảo dưỡng. */
	type?: AssetMaintenanceType;
	assetId?: number;
	vendorId?: number;
}

export interface CreateAssetMaintenanceBody {
	/** Đợt 2. Mặc định `REPAIR`; `MAINTENANCE` là phiếu bảo dưỡng định kỳ. */
	type?: AssetMaintenanceType;
	description: string;
	vendorId?: number;
	underWarranty?: boolean;
	cost?: number;
	sentAt?: string;
	expectedDoneAt?: string;
}

export interface UpdateAssetMaintenanceBody extends Partial<CreateAssetMaintenanceBody> {
	workDone?: string;
	status?: 'OPEN' | 'IN_PROGRESS';
}

export interface CloseAssetMaintenanceBody {
	outcome: 'DONE' | 'UNREPAIRABLE' | 'CANCELLED';
	workDone?: string;
	cost?: number;
	doneAt?: string;
}

export interface AssetDocumentUploadBody {
	file: File;
	type: AssetDocumentType;
	number?: string;
	issuedDate?: string;
	amount?: number;
	/** Một hoá đơn mua 10 máy gửi một lần với 10 `assetIds`. */
	assetIds?: number[];
	assignmentId?: number;
	renewalId?: number;
	maintenanceId?: number;
}

export interface AssetDepreciationReportQuery {
	asOf?: string;
	categoryId?: number;
	accountingClass?: AssetAccountingClass;
}

export interface AssetExpiringQuery {
	/** 1–365, mặc định 30. */
	withinDays?: number;
	/** Bỏ trống là cả hai. */
	type?: 'renewal' | 'warranty';
}

export interface ConfirmAssignmentBody {
	accepted: boolean;
	/** Bắt buộc khi `accepted: false`. */
	reason?: string;
}

/** Sửa sau bài nhập vai. Câu trả lời cho người nhận, tối đa 1000 ký tự, không chỉ khoảng trắng. */
export interface RespondDisputeBody {
	response: string;
}

export interface AssetSeatBody {
	employeeId: number;
	assignedAt?: string;
	note?: string;
}

// ─── Đợt 2: query và body ─────────────────────────────────────────────────────

export interface AssetIncidentQueryParams {
	page?: number;
	limit?: number;
	status?: AssetIncidentStatus;
	type?: AssetIncidentType;
	assetId?: number;
}

/** Đóng báo cáo: "không cần sửa" với báo hỏng, "đã tìm thấy" với báo mất. */
export interface HandleAssetIncidentBody {
	note?: string;
}

export interface ConfirmAssetLossBody extends HandleAssetIncidentBody {
	/** Ngày mất, thôi khấu hao từ ngày này. Mặc định là ngày nhân viên khai. */
	lostOn?: string;
}

export interface RepairFromAssetIncidentBody extends HandleAssetIncidentBody {
	vendorId?: number;
	underWarranty?: boolean;
}

/** Nhân viên gửi báo hỏng, báo mất. Ảnh gửi kèm dưới dạng `multipart/form-data`. */
export interface ReportAssetIncidentBody {
	type: AssetIncidentType;
	description: string;
	occurredOn?: string;
	/** Tối đa 10 ảnh, mỗi ảnh ≤ 5 MB, JPG/PNG/HEIC. */
	photos?: File[];
}

export interface AssetServiceCostQuery {
	/** `YYYY-MM`, bắt buộc. */
	month: string;
	vendorId?: number;
	categoryId?: number;
	ownerId?: number;
}

export interface AssetMaintenanceCostQuery {
	from: string;
	to: string;
	assetId?: number;
	vendorId?: number;
	type?: AssetMaintenanceType;
}

/** Kỳ của Excel kế toán, tối đa 12 tháng. */
export interface AssetDateRangeQuery {
	from: string;
	to: string;
}

// ─── Nhãn tĩnh cho bộ lọc ─────────────────────────────────────────────────────
//
// BE đã gửi `*Label` kèm mọi bản ghi nên chỗ hiển thị KHÔNG dùng mấy bảng này. Chúng chỉ
// để dựng option cho ô lọc và ô chọn, nơi chưa có bản ghi nào để lấy nhãn.
//
// Từng chữ ở đây phải khớp đúng bảng nhãn của BE (`vi-labels.ts`, bảng "Nhãn đổi" ở bridge
// doc mục sửa sau bài nhập vai): lệch một chữ là cùng màn hình có hai cách gọi một trạng thái,
// ví dụ ô lọc ghi "Đang dùng" mà chip ghi "Đang sử dụng".

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
	PHYSICAL: 'Thiết bị',
	SERVICE: 'Dịch vụ thuê bao',
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
	AVAILABLE: 'Sẵn sàng',
	IN_USE: 'Đang sử dụng',
	IN_REPAIR: 'Đang sửa',
	BROKEN: 'Hỏng',
	LOST: 'Mất',
	LOSS_REPORTED: 'Chờ xác minh mất',
	IN_MAINTENANCE: 'Đang bảo dưỡng',
	DISPOSED: 'Đã thanh lý',
	ACTIVE: 'Đang hoạt động',
	EXPIRED: 'Hết hạn',
	CANCELLED: 'Đã huỷ',
};

export const ASSET_CONDITION_LABELS: Record<AssetCondition, string> = {
	NEW: 'Mới',
	GOOD: 'Tốt',
	SCRATCHED: 'Trầy xước',
	FAULTY: 'Có lỗi nhỏ',
	BROKEN: 'Hỏng',
};

export const ASSET_BILLING_CYCLE_LABELS: Record<AssetBillingCycle, string> = {
	MONTHLY: 'Hằng tháng',
	QUARTERLY: 'Hằng quý',
	YEARLY: 'Hằng năm',
	ONE_TIME: 'Mua đứt',
};

export const ASSET_CONFIRMATION_LABELS: Record<AssetAssignmentConfirmation, string> = {
	PENDING: 'Chờ người nhận xác nhận',
	CONFIRMED: 'Đã nhận',
	DISPUTED: 'Người nhận báo chưa đúng',
	NOT_REQUIRED: 'Không cần xác nhận',
};

export const ASSET_PRICING_UNIT_LABELS: Record<AssetPricingUnit, string> = {
	PER_SEAT: 'Theo ghế',
	PER_PLAN: 'Theo gói',
};

export const ASSET_ACCOUNTING_CLASS_LABELS: Record<AssetAccountingClass, string> = {
	FIXED_ASSET: 'Tài sản cố định',
	TOOL: 'Công cụ dụng cụ',
};

export const ASSET_VENDOR_TYPE_LABELS: Record<AssetVendorType, string> = {
	SUPPLIER: 'Bán thiết bị',
	REPAIR: 'Sửa chữa',
	SERVICE: 'Cung cấp dịch vụ',
};

export const ASSET_MAINTENANCE_STATUS_LABELS: Record<AssetMaintenanceStatus, string> = {
	OPEN: 'Mới mở',
	IN_PROGRESS: 'Đang xử lý',
	DONE: 'Xong',
	UNREPAIRABLE: 'Không sửa được',
	CANCELLED: 'Đã huỷ',
};

export const ASSET_DOCUMENT_TYPE_LABELS: Record<AssetDocumentType, string> = {
	PURCHASE_CONTRACT: 'Hợp đồng mua',
	SERVICE_CONTRACT: 'Hợp đồng dịch vụ',
	INVOICE: 'Hoá đơn',
	WARRANTY: 'Phiếu bảo hành',
	HANDOVER_RECORD: 'Biên bản bàn giao, thu hồi',
	CONDITION_PHOTO: 'Ảnh tình trạng',
	REPAIR_QUOTE: 'Báo giá, biên bản sửa chữa',
	DISPOSAL_RECORD: 'Biên bản thanh lý',
	OTHER: 'Khác',
};

export const ASSET_MAINTENANCE_TYPE_LABELS: Record<AssetMaintenanceType, string> = {
	REPAIR: 'Sửa chữa',
	MAINTENANCE: 'Bảo dưỡng',
};

export const ASSET_INCIDENT_TYPE_LABELS: Record<AssetIncidentType, string> = {
	DAMAGE: 'Báo hỏng',
	LOSS: 'Báo mất',
};

export const ASSET_INCIDENT_STATUS_LABELS: Record<AssetIncidentStatus, string> = {
	OPEN: 'Chờ xử lý',
	REPAIR_OPENED: 'Đã tạo phiếu sửa',
	LOSS_CONFIRMED: 'Đã xác nhận mất',
	CLOSED: 'Đã đóng',
	RESOLVED: 'Đã xử lý xong',
};

export const ASSET_END_REASON_LABELS: Record<AssetAssignmentEndReason, string> = {
	RETURNED: 'Thu hồi',
	TRANSFERRED: 'Điều chuyển',
	LOST: 'Mất',
};

/** Trạng thái nào thuộc họ nào — để dựng option lọc theo `kind` đang chọn. */
export const PHYSICAL_STATUSES: AssetStatus[] = [
	'AVAILABLE',
	'IN_USE',
	'IN_REPAIR',
	'IN_MAINTENANCE',
	'BROKEN',
	'LOSS_REPORTED',
	'LOST',
	'DISPOSED',
];
export const SERVICE_STATUSES: AssetStatus[] = ['ACTIVE', 'EXPIRED', 'CANCELLED'];
