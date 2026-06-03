export interface SIEmployeeSummary {
	id: number;
	employeeCode: string;
	fullName: string;
}

export interface InsuranceRates {
	socialInsurance: number;
	healthInsurance: number;
	unemployment: number;
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
	socialInsuranceNumber: string | null;
	healthInsuranceNumber: string | null;
	healthInsuranceExpiry: string | null;
	registeredHospital: string | null;
	effectiveDate: string | null;
	siDocUrl: string | null;
	rates: InsuranceRates;
	taxInfo: TaxInfo;
	totalDeductionRate: number;
	note: string | null;
	updatedAt: string;
}

export interface UpsertSocialInsuranceDto {
	socialInsuranceNumber?: string;
	healthInsuranceNumber?: string;
	healthInsuranceExpiry?: string;
	socialInsuranceRate?: number;
	healthInsuranceRate?: number;
	unemploymentInsuranceRate?: number;
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
