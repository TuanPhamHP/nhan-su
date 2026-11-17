export interface SIEmployeeSummary {
	id: number;
	employeeCode: string;
	fullName: string;
}

/**
 * Người phụ thuộc, lô 3a đọc từ thân nhân trong hồ sơ nhân viên.
 *
 * Trước lô 3a đây là dữ liệu nhập tay trong form BHXH nên mọi trường đều tuỳ chọn; nay server
 * dựng từ bảng thân nhân, luôn có đủ trường và kèm `relativeId` để mở hồ sơ.
 */
export interface DependentDetail {
	name: string;
	/** Nhãn quan hệ, ví dụ "Con" hoặc "Vợ hoặc chồng". */
	relationship: string;
	relationshipCode: string;
	/** Số định danh; chuỗi rỗng khi chưa có. */
	idNumber: string;
	/** Ngày 1 của tháng bắt đầu giảm trừ; chuỗi rỗng khi chưa có. */
	effectiveDate: string;
	/** Tháng cuối được giảm trừ; bỏ trống là đang giảm trừ. */
	endDate: string | null;
	relativeId: number;
}

export interface TaxInfo {
	/** Mã số thuế riêng nếu có, không thì số căn cước. */
	taxCode: string | null;
	/** Số người phụ thuộc đang được giảm trừ trong tháng hiện tại. */
	dependents: number;
	/** Mọi người phụ thuộc, kể cả người đã thôi được giảm trừ. */
	dependentDetails: DependentDetail[];
	taxExemptionDocUrl: string | null;
}

export interface SocialInsuranceResponse {
	id: number;
	employee: SIEmployeeSummary;
	/** Mã số BHXH — luôn có giá trị, không bao giờ null */
	socialInsuranceNumber: string;
	/** Mức lương tham gia BHXH (VND) — luôn có giá trị */
	insuranceSalary: number;
	/** Người lao động có sổ BHXH hay không */
	hasSocialInsuranceBook: boolean;
	healthInsuranceNumber: string | null;
	healthInsuranceExpiry: string | null;
	registeredHospital: string | null;
	effectiveDate: string | null;
	siDocUrl: string | null;
	taxInfo: TaxInfo;
	note: string | null;
	updatedAt: string;
}

/**
 * Dùng cho PUT /v1/social-insurance/:employeeId.
 *
 * Endpoint là upsert, KHÔNG phải PATCH từng phần: `socialInsuranceNumber` và
 * `insuranceSalary` phải có trong mọi request, kể cả khi chỉ sửa ghi chú — thiếu một
 * trong hai thì BE trả 400.
 */
export interface UpsertSocialInsuranceDto {
	socialInsuranceNumber: string;
	insuranceSalary: number;
	/** Bỏ trống: tạo mới → false; update → giữ giá trị cũ */
	hasSocialInsuranceBook?: boolean;
	healthInsuranceNumber?: string;
	healthInsuranceExpiry?: string;
	registeredHospital?: string;
	effectiveDate?: string;
	/** @deprecated Lô 3a bỏ qua: mã số thuế sửa ở hồ sơ nhân viên. */
	taxCode?: string;
	/** @deprecated Lô 3a bỏ qua: người phụ thuộc sửa ở tab Thân nhân. */
	dependents?: number;
	/** @deprecated Lô 3a bỏ qua: người phụ thuộc sửa ở tab Thân nhân. */
	dependentDetails?: unknown[];
	note?: string;
}

export interface QuerySocialInsuranceParams {
	page?: number;
	limit?: number;
	departmentId?: number;
}
