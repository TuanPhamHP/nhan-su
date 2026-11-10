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
	// dịch vụ
	| 'ACTIVE'
	| 'EXPIRED'
	| 'CANCELLED';

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
	| 'LICENSE_KEY_CHANGED';

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
	/**
	 * Ẩn cột tiền theo cờ này, đừng tự suy từ vai trò: người thiếu `asset:value:read`
	 * nhận `null` ở mọi trường tiền.
	 */
	canViewValue: boolean;
	createdAt: string;
	updatedAt: string;
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
	/** Bản đầu chỉ có sửa chữa. */
	type: 'REPAIR';
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
	createdBy: AssetIdName;
	createdAt: string;
}

export interface AssetDocumentLink {
	id: number;
	assetId: number | null;
	assetCode: string | null;
	assignmentId: number | null;
	renewalId: number | null;
	maintenanceId: number | null;
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
	assetId?: number;
	vendorId?: number;
}

export interface CreateAssetMaintenanceBody {
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

export interface AssetSeatBody {
	employeeId: number;
	assignedAt?: string;
	note?: string;
}

// ─── Nhãn tĩnh cho bộ lọc ─────────────────────────────────────────────────────
//
// BE đã gửi `*Label` kèm mọi bản ghi nên chỗ hiển thị KHÔNG dùng mấy bảng này. Chúng chỉ
// để dựng option cho ô lọc và ô chọn, nơi chưa có bản ghi nào để lấy nhãn.

export const ASSET_KIND_LABELS: Record<AssetKind, string> = {
	PHYSICAL: 'Thiết bị',
	SERVICE: 'Dịch vụ',
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
	AVAILABLE: 'Sẵn sàng',
	IN_USE: 'Đang dùng',
	IN_REPAIR: 'Đang sửa',
	BROKEN: 'Hỏng',
	LOST: 'Mất',
	DISPOSED: 'Đã thanh lý',
	ACTIVE: 'Đang hoạt động',
	EXPIRED: 'Hết hạn',
	CANCELLED: 'Đã huỷ',
};

export const ASSET_CONDITION_LABELS: Record<AssetCondition, string> = {
	NEW: 'Mới',
	GOOD: 'Tốt',
	SCRATCHED: 'Xước',
	FAULTY: 'Lỗi',
	BROKEN: 'Hỏng',
};

export const ASSET_BILLING_CYCLE_LABELS: Record<AssetBillingCycle, string> = {
	MONTHLY: 'Hàng tháng',
	QUARTERLY: 'Hàng quý',
	YEARLY: 'Hàng năm',
	ONE_TIME: 'Mua đứt',
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
	SUPPLIER: 'Nhà cung cấp',
	REPAIR: 'Đơn vị sửa chữa',
	SERVICE: 'Nhà cung cấp dịch vụ',
};

export const ASSET_MAINTENANCE_STATUS_LABELS: Record<AssetMaintenanceStatus, string> = {
	OPEN: 'Mới mở',
	IN_PROGRESS: 'Đang sửa',
	DONE: 'Xong',
	UNREPAIRABLE: 'Không sửa được',
	CANCELLED: 'Đã huỷ',
};

export const ASSET_DOCUMENT_TYPE_LABELS: Record<AssetDocumentType, string> = {
	PURCHASE_CONTRACT: 'Hợp đồng mua',
	SERVICE_CONTRACT: 'Hợp đồng dịch vụ',
	INVOICE: 'Hoá đơn',
	WARRANTY: 'Phiếu bảo hành',
	HANDOVER_RECORD: 'Biên bản bàn giao',
	CONDITION_PHOTO: 'Ảnh tình trạng',
	REPAIR_QUOTE: 'Báo giá sửa chữa',
	DISPOSAL_RECORD: 'Biên bản thanh lý',
	OTHER: 'Khác',
};

/** Trạng thái nào thuộc họ nào — để dựng option lọc theo `kind` đang chọn. */
export const PHYSICAL_STATUSES: AssetStatus[] = [
	'AVAILABLE',
	'IN_USE',
	'IN_REPAIR',
	'BROKEN',
	'LOST',
	'DISPOSED',
];
export const SERVICE_STATUSES: AssetStatus[] = ['ACTIVE', 'EXPIRED', 'CANCELLED'];
