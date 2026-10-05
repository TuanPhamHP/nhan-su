export interface SIEmployeeSummary {
	id: number;
	employeeCode: string;
	fullName: string;
}

export interface DependentDetail {
	name?: string;
	relationship?: string;
	idNumber?: string;
	effectiveDate?: string;
}

export interface TaxInfo {
	taxCode: string | null;
	dependents: number;
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
	taxCode?: string;
	dependents?: number;
	dependentDetails?: DependentDetail[];
	note?: string;
}

export interface QuerySocialInsuranceParams {
	page?: number;
	limit?: number;
	departmentId?: number;
}
