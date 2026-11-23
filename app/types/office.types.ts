/**
 * Hành chính văn phòng (module `OFFICE`, lô 1): văn phòng phẩm theo kỳ và đặt phòng họp.
 *
 * Khớp `docs/backend/bridges/office.md` và tag `office` của openapi nhánh BE. Mọi trường
 * `status` đi kèm `statusLabel` tiếng Việt của máy chủ: hiện thẳng `statusLabel`, đừng tự dịch
 * lại ở FE, vì nhãn là thứ BE đổi được mà không phát hành lại web.
 */

/** Tham chiếu gọn một bản ghi có tên, dùng cho văn phòng, phòng ban, phòng họp. */
export interface OfficeIdName {
	id: number;
	name: string;
}

/**
 * Phạm vi dữ liệu máy chủ trả về cho người đang xem.
 *
 * `ALL` là HCNS và ban giám đốc, thấy cả văn phòng. `DEPARTMENT` là trưởng phòng, chỉ thấy phòng
 * mình: khi đó máy chủ tự lọc dù màn hình gửi tham số nào, nên màn hình phải khoá ô lọc phòng ban
 * và bỏ những cột chỉ có nghĩa với cả văn phòng.
 */
export type OfficeScope = 'ALL' | 'DEPARTMENT';

/** Một người trong phiếu hoặc lượt đặt phòng. */
export interface OfficePersonRef {
	id: number;
	fullName: string;
}

/**
 * Người trong lượt đặt phòng, kèm cờ còn làm việc.
 *
 * `isActive: false` là đã nghỉ việc: màn hình ghi thêm "(đã nghỉ việc)" để người xem hiểu vì sao
 * lượt họp có tên lạ, và khi lưu lại danh sách người dự thì máy chủ tự bỏ họ ra.
 */
export interface BookingPerson extends OfficePersonRef {
	isActive: boolean;
}

// ─── Danh mục ─────────────────────────────────────────────────────────────────

export interface OfficeSite {
	id: number;
	name: string;
	address: string | null;
	isActive: boolean;
}

export interface MeetingRoom {
	id: number;
	officeSiteId: number;
	officeSiteName: string;
	name: string;
	capacity: number | null;
	equipment: string[];
	note: string | null;
	sortOrder: number;
	isActive: boolean;
}

export interface SupplyGroup {
	id: number;
	name: string;
	/** Chỉ HCNS đặt: nhân viên phòng ban không thêm được mặt hàng của nhóm này. */
	hrOnly: boolean;
	sortOrder: number;
	isActive: boolean;
}

export interface SupplyItem {
	id: number;
	groupId: number;
	groupName: string;
	hrOnly: boolean;
	name: string;
	unit: string;
	/**
	 * Đơn giá gồm VAT, đồng. `null` nghĩa là danh mục chưa có giá HOẶC người xem không có quyền
	 * xem chi phí, nên màn hình của nhân viên thường phải ẩn hẳn cột giá chứ không hiện số 0.
	 */
	unitPrice: number | null;
	sortOrder: number;
	isActive: boolean;
	/** Chỉ có ở `/me/office/supply-items`: định mức tháng của phòng tôi; `null` là không giới hạn. */
	quota?: number | null;
}

export interface SupplyQuota {
	itemId: number;
	itemName: string;
	unit: string;
	groupName: string;
	monthlyQty: number;
}

export interface CreateOfficeSiteBody {
	name: string;
	address?: string;
}

export interface UpdateOfficeSiteBody {
	name?: string;
	address?: string;
	isActive?: boolean;
}

export interface CreateSupplyGroupBody {
	name: string;
	hrOnly?: boolean;
	sortOrder?: number;
}

export interface UpdateSupplyGroupBody {
	name?: string;
	hrOnly?: boolean;
	sortOrder?: number;
	isActive?: boolean;
}

export interface CreateSupplyItemBody {
	groupId: number;
	name: string;
	unit: string;
	unitPrice?: number;
	sortOrder?: number;
}

export interface UpdateSupplyItemBody {
	groupId?: number;
	name?: string;
	unit?: string;
	unitPrice?: number;
	sortOrder?: number;
	isActive?: boolean;
}

export interface CreateMeetingRoomBody {
	officeSiteId: number;
	name: string;
	capacity?: number;
	equipment?: string[];
	note?: string;
	sortOrder?: number;
}

export interface UpdateMeetingRoomBody {
	officeSiteId?: number;
	name?: string;
	capacity?: number;
	equipment?: string[];
	note?: string;
	sortOrder?: number;
	isActive?: boolean;
}

export interface ReplaceSupplyQuotasBody {
	departmentId: number;
	/** Thay TOÀN BỘ định mức của phòng; mảng rỗng là bỏ hết. */
	quotas: Array<{ itemId: number; monthlyQty: number }>;
}

/** Kết quả nhập danh mục từ Excel, gồm cả file đăng ký hằng tháng của HCNS. */
export interface SupplyImportResult {
	createdGroups: string[];
	createdItems: number;
	updatedPrices: number;
	existingItems: number;
	/** Dòng bỏ qua có chủ ý: nhóm ngoài danh sách, dòng tổng. */
	skipped: number;
	errors: Array<{ row: number; message: string }>;
}

// ─── Kỳ đăng ký văn phòng phẩm ────────────────────────────────────────────────

export type SupplyPeriodStatus = 'OPEN' | 'LOCKED' | 'CLOSED';

export interface SupplyPeriod {
	id: number;
	officeSite: OfficeIdName;
	/** `YYYY-MM`, tháng chi phí của kỳ. */
	month: string;
	title: string;
	/** `YYYY-MM-DD`. */
	deadline: string;
	/** ISO 8601, thời điểm phiếu tự khoá (00:00 ngày sau hạn chót, giờ Việt Nam). */
	lockAt: string;
	status: SupplyPeriodStatus;
	statusLabel: string;
	/** Chỉ có ở danh sách kỳ của trang quản lý. */
	departmentsTotal?: number;
	departmentsWithLines?: number;
	/** Phòng tham gia; dùng làm mặc định khi mở kỳ sau của cùng văn phòng. */
	departmentIds?: number[];
	createdBy: OfficePersonRef | null;
	lockedAt: string | null;
	closedAt: string | null;
}

export interface CreateSupplyPeriodBody {
	officeSiteId: number;
	/** `YYYY-MM`. */
	month: string;
	/** `YYYY-MM-DD`. */
	deadline: string;
	title?: string;
	departmentIds: number[];
}

export interface UpdateSupplyPeriodBody {
	title?: string;
	deadline?: string;
}

export interface SupplyPeriodQueryParams {
	siteId?: number;
	status?: SupplyPeriodStatus;
}

/** Dự trù và đơn giá thực của một mặt hàng trong kỳ. */
export interface SupplyPeriodItemBody {
	itemId: number;
	reserveQty?: number;
	unitPrice?: number;
}

// ─── Phiếu của một phòng ──────────────────────────────────────────────────────

export type SupplyRequestStatus = 'OPEN' | 'LOCKED' | 'FINALIZED' | 'ISSUED' | 'RECEIVED';

export interface SupplyLine {
	id: number;
	/** `null` với dòng ngoài danh mục. */
	itemId: number | null;
	isCustom: boolean;
	name: string;
	unit: string | null;
	groupName: string | null;
	requestedQty: number;
	/** Định mức tháng của phòng cho mặt hàng này; `null` khi phòng không có định mức. */
	quota: number | null;
	overQuota: boolean;
	overQuotaReason: string | null;
	note: string | null;
	/** Số HCNS chốt; `null` khi chưa chốt. */
	finalQty: number | null;
	finalNote: string | null;
	receivedQty: number | null;
	receivedNote: string | null;
	/** `null` cũng có nghĩa "bạn không được xem chi phí", không phải bằng không. */
	unitPrice: number | null;
	amount: number | null;
	/** Số của phiếu chính kỳ trước, để gợi ý. */
	previousQty: number | null;
	createdBy: OfficePersonRef;
	updatedBy: OfficePersonRef;
	updatedAt: string;
	/** Phần đăng ký của từng người, tổng bằng `requestedQty`. Rỗng ở phiếu bổ sung do HCNS nhập thay phòng. */
	shares: SupplyLineShare[];
	/** Phần của người đang xem; 0 khi họ chưa đăng ký dòng này. */
	myQty: number;
}

export interface SupplyLineShare {
	employee: OfficePersonRef;
	qty: number;
	isMine: boolean;
}

export interface SupplyRequest {
	id: number;
	period: SupplyPeriod;
	department: OfficeIdName;
	/** 0 là phiếu chính, lớn hơn 0 là phiếu bổ sung. */
	sequence: number;
	isSupplement: boolean;
	note: string | null;
	status: SupplyRequestStatus;
	statusLabel: string;
	/** Cờ của máy chủ: thêm, sửa, xoá dòng. Đừng tự suy từ trạng thái. */
	canEdit: boolean;
	/** Cờ của máy chủ: hiện nút Đã nhận. */
	canReceive: boolean;
	/** Cờ của máy chủ: trưởng phòng hoặc đầu mối, sửa được phần của mọi người và xoá được cả dòng. */
	canEditAllShares: boolean;
	/** Từ lúc này HCNS được ghi đã giao thay; `null` là chưa tới lúc. */
	proxyAllowedAt: string | null;
	totalAmount: number | null;
	finalizedAt: string | null;
	finalizedBy: OfficePersonRef | null;
	issuedAt: string | null;
	issuedBy: OfficePersonRef | null;
	receivedAt: string | null;
	receivedBy: OfficePersonRef | null;
	receivedByProxy: boolean;
	receiverName: string | null;
	createdBy: OfficePersonRef | null;
	lines: SupplyLine[];
}

export interface SupplyRequestListItem {
	id: number;
	period: SupplyPeriod;
	sequence: number;
	isSupplement: boolean;
	status: SupplyRequestStatus;
	statusLabel: string;
	lineCount: number;
}

/** Thêm dòng: hoặc `itemId` của danh mục, hoặc `customName` kèm `customUnit`. */
export interface CreateSupplyLineBody {
	itemId?: number;
	customName?: string;
	customUnit?: string;
	requestedQty: number;
	overQuotaReason?: string;
	note?: string;
}

export interface UpdateSupplyLineBody {
	requestedQty?: number;
	overQuotaReason?: string;
	note?: string;
	customName?: string;
	customUnit?: string;
}

/** Đặt phần của một người trên dòng; `qty` 0 là rút phần. */
export interface SetSupplyLineShareBody {
	qty: number;
	overQuotaReason?: string;
}

export interface CopySkippedItem {
	name: string;
	/** Câu của máy chủ, ví dụ "vượt định mức 5, bạn tự nhập kèm lý do". */
	reason: string;
}

export interface CopyPreviousResult {
	/** Kỳ đã lấy số; `null` là phòng chưa có kỳ trước ở văn phòng này. */
	previousTitle: string | null;
	added: number;
	/**
	 * Mặt hàng phiếu ĐÃ CÓ nên không chép lại.
	 *
	 * Tách khỏi `skipped` từ đợt UAT C: trước đây chúng bị đếm là "bỏ qua", nên bấm lần thứ hai ra
	 * câu "Đã thêm 0 dòng, bỏ qua 3 dòng" làm người dùng tưởng ba mặt hàng của họ bị loại.
	 */
	existing: number;
	/** Dòng bỏ qua: mặt hàng ngừng dùng, nhóm chỉ HCNS đặt, vượt định mức mà kỳ trước không có lý do. */
	skipped: number;
	skippedItems: CopySkippedItem[];
	request: SupplyRequest;
}

export interface ReceiveSupplyRequestBody {
	/** Dòng không gửi thì coi như nhận đủ số đã chốt. */
	lines: Array<{ lineId: number; receivedQty: number; receivedNote?: string }>;
}

/**
 * Chốt phiếu, và chốt LẠI phiếu đã chốt, đã cấp, đã nhận cho tới khi đóng kỳ (Q1).
 *
 * Mỗi `lineId` chỉ được gửi một lần; dòng không gửi giữ số đang có. Đổi số so với số đã chốt thì
 * phải có `finalNote`, và số chốt không được nhỏ hơn số phòng đã nhận.
 */
export interface FinalizeSupplyRequestBody {
	lines: Array<{ lineId: number; finalQty: number; finalNote?: string; customUnitPrice?: number }>;
}

/** Sửa số thực nhận của phiếu đã nhận khi kỳ chưa đóng (Q1); `reason` bắt buộc. */
export interface CorrectReceivedBody {
	lines: Array<{ lineId: number; receivedQty: number; receivedNote?: string }>;
	reason: string;
}

/** Thêm phòng vào kỳ còn mở (Q4); phòng đã có trong kỳ thì máy chủ bỏ qua. */
export interface AddPeriodDepartmentsBody {
	departmentIds: number[];
}

/** Kết quả huỷ một kỳ mở nhầm (Q4): kỳ bị xoá hẳn nên danh sách phải tải lại. */
export interface CancelPeriodResult {
	id: number;
	cancelled: boolean;
}

export interface MarkDeliveredBody {
	receiverName: string;
}

export interface CreateSupplementBody {
	departmentId: number;
	/** Ghi chú bắt buộc: phiếu bổ sung luôn phải nói vì sao. */
	note: string;
	lines: CreateSupplyLineBody[];
}

export interface SupplyContact {
	departmentId: number;
	departmentName: string;
	manager: OfficePersonRef | null;
	/** Đầu mối do trưởng phòng chỉ định; `null` thì đầu mối là trưởng phòng. */
	contact: OfficePersonRef | null;
}

export interface SetSupplyContactBody {
	employeeId: number | null;
}

// ─── Bảng tổng hợp kỳ ─────────────────────────────────────────────────────────

export interface SummaryCell {
	departmentId: number;
	/** Số đã chốt; chưa chốt thì số xin. */
	qty: number;
}

export interface SummaryRequestRef {
	id: number;
	sequence: number;
	status: SupplyRequestStatus;
	/** Phiếu rỗng sau khi kỳ khoá mang nhãn "Không đăng ký". */
	statusLabel: string;
	lineCount: number;
	/** Ghi chú của phiếu bổ sung. */
	note: string | null;
}

export interface SummaryDepartment {
	departmentId: number;
	name: string;
	requests: SummaryRequestRef[];
}

export interface SummaryRow {
	/** `null` là mặt hàng ngoài danh mục: đơn giá nhập ở bước chốt, không ở ô dự trù. */
	itemId: number | null;
	name: string;
	unit: string | null;
	groupName: string | null;
	cells: SummaryCell[];
	totalQty: number;
	/** `null` ở phạm vi phòng ban: số dự trù của cả văn phòng không liên quan tới trưởng phòng. */
	reserveQty: number | null;
	/** Phạm vi cả văn phòng là số cần mua; phạm vi phòng ban là tổng của phòng mình. */
	purchaseQty: number;
	unitPrice: number | null;
	amount: number | null;
	/** Ghi chú của dòng theo từng phòng: lý do chốt khác số xin, nhận thiếu, ghi chú phiếu bổ sung. */
	notes: string[];
	/** Có phòng xin vượt định mức ở dòng này; lý do nằm trong `notes`. */
	overQuota: boolean;
}

export interface SupplyPeriodSummary {
	period: SupplyPeriod;
	departments: SummaryDepartment[];
	rows: SummaryRow[];
	totalAmount: number;
	/** Số dòng cần mua chưa có đơn giá nên chưa tính vào `totalAmount`. */
	unpricedRows: number;
	/** Phạm vi của người đang xem: trưởng phòng nhận `DEPARTMENT` và không có cột Dự trù. */
	scope: OfficeScope;
}

// ─── Báo cáo chi phí ──────────────────────────────────────────────────────────

export interface SupplyCostRow {
	/** `YYYY-MM`. */
	month: string;
	departmentId: number;
	departmentName: string;
	officeSiteName: string;
	lineCount: number;
	amount: number;
	/** Số dòng chưa có đơn giá, chưa tính vào `amount`. */
	unpricedLines: number;
}

export interface SupplyCostReport {
	rows: SupplyCostRow[];
	totalAmount: number;
	/** `DEPARTMENT` là trưởng phòng: máy chủ luôn lọc về `departmentId`, màn hình khoá ô phòng ban. */
	scope: OfficeScope;
	/** Phòng đang lọc; `null` ở phạm vi cả công ty nghĩa là mọi phòng. */
	departmentId: number | null;
}

export interface SupplyCostQueryParams {
	/** `YYYY-MM`, bắt buộc. */
	monthFrom: string;
	monthTo?: string;
	departmentId?: number;
	groupId?: number;
}

// ─── Phòng họp ────────────────────────────────────────────────────────────────

export type RoomBookingStatus = 'CONFIRMED' | 'CANCELLED';

/**
 * Lượt này đang ở đâu so với bây giờ, tính theo giờ máy chủ lúc trả dữ liệu.
 *
 * Màn hình dùng cờ này thay vì tự so giờ của máy người dùng: máy đặt sai giờ thì một cuộc họp đã
 * xong vẫn hiện là "Đang họp", mà đó là thứ người dùng tin ngay vì nó nằm trên lịch của họ.
 */
export type RoomBookingTiming = 'UPCOMING' | 'ONGOING' | 'ENDED';

export interface RoomBooking {
	id: number;
	room: OfficeIdName;
	officeSite: OfficeIdName;
	/** ISO 8601 UTC. */
	startAt: string;
	endAt: string;
	status: RoomBookingStatus;
	timing: RoomBookingTiming;
	statusLabel: string;
	isPrivate: boolean;
	/** `false` là lượt riêng tư của người khác: `title`, `note` rỗng và `attendees` trống. */
	detailsVisible: boolean;
	title: string | null;
	note: string | null;
	organizer: BookingPerson;
	createdBy: OfficePersonRef;
	attendees: BookingPerson[];
	/**
	 * Người đang xem sửa được lượt này không.
	 *
	 * `false` cả khi phân hệ OFFICE đang ở chế độ chỉ xem (hết hạn, ân hạn), nên nút Sửa đi theo cờ
	 * này, còn nút Huỷ đi theo `canCancel`: hết hạn thì không đặt thêm và không dời được, nhưng vẫn
	 * phải huỷ được để nhường phòng.
	 */
	canEdit: boolean;
	canCancel: boolean;
	cancelledAt: string | null;
	cancelledBy: OfficePersonRef | null;
	cancelReason: string | null;
}

export interface RoomStatusNow {
	busy: boolean;
	/** Đang bận là bận tới lúc này, đang trống là trống tới lúc này; `null` là tới hết ngày. */
	until: string | null;
}

export interface RoomGridRoom {
	room: MeetingRoom;
	/** Chỉ có khi ngày đang xem là hôm nay. */
	now: RoomStatusNow | null;
	bookings: RoomBooking[];
}

export interface RoomGrid {
	/** `YYYY-MM-DD`; xem theo khoảng ngày thì bằng `fromDate`. */
	date: string;
	/** Ngày đầu và ngày cuối của khoảng xem, tính cả hai đầu; xem một ngày thì cả hai bằng `date`. */
	fromDate: string;
	toDate: string;
	site: OfficeSite;
	rooms: RoomGridRoom[];
}

export interface CreateRoomBookingBody {
	roomId: number;
	/** ISO 8601 CÓ múi giờ (`Z` hoặc `+07:00`); máy chủ làm tròn xuống phút. */
	startAt: string;
	endAt: string;
	title: string;
	note?: string;
	isPrivate?: boolean;
	/** Chủ trì khi đặt hộ; bỏ trống là chính người đặt. */
	organizerId?: number;
	attendeeIds?: number[];
}

/**
 * Sửa một lượt đặt phòng.
 *
 * Lượt riêng tư mà người sửa không thấy nội dung (`detailsVisible=false`, kể cả HCNS) chỉ được
 * gửi `roomId`, `startAt`, `endAt`; gửi thêm tiêu đề, ghi chú, người dự hay chủ trì thì 403.
 * Lượt đang diễn ra chỉ đổi được `endAt`, phải giữ nguyên `startAt`.
 */
export interface UpdateRoomBookingBody {
	roomId?: number;
	startAt?: string;
	endAt?: string;
	title?: string;
	/** Chuỗi rỗng hoặc `null` là xoá ghi chú. */
	note?: string | null;
	isPrivate?: boolean;
	/** Đổi người chủ trì; chủ trì cũ và mới đều được báo. */
	organizerId?: number;
	/** Thay toàn bộ người dự. */
	attendeeIds?: number[];
}

export interface CancelRoomBookingBody {
	/** Bắt buộc khi huỷ lượt của người khác. */
	reason?: string;
}

export interface MyRoomBookingQueryParams {
	/** `YYYY-MM-DD`, khoảng xem tối đa ba tháng. */
	from: string;
	to: string;
}
