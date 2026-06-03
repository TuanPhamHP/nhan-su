export type BusinessTripStatus =
	| 'DRAFT'
	| 'PENDING'
	| 'APPROVED'
	| 'IN_PROGRESS'
	| 'COMPLETED'
	| 'REJECTED';

export type TripReportStatus = 'DRAFT' | 'SUBMITTED';

export type TransportType = 'PLANE' | 'TRAIN' | 'CAR' | 'OTHER';

export interface TripReportResponse {
	id: number;
	summary: string;
	results: string;
	actualCost: number | null;
	issues: string | null;
	status: TripReportStatus;
	submittedAt: string | null;
}

export interface BusinessTripEmployee {
	id: number;
	fullName: string;
	employeeCode: string;
	department: string | null;
}

export interface BusinessTripApprover {
	id: number;
	fullName: string;
}

export interface TripCompanion {
	employeeId: number;
}

export interface BusinessTripResponse {
	id: number;
	title: string;
	destination: string;
	purpose: string;
	startDate: string;
	endDate: string;
	totalDays: number;
	estimatedCost: number | null;
	transportType: TransportType | null;
	companions: TripCompanion[] | null;
	status: BusinessTripStatus;
	statusLabel: string;
	approver: BusinessTripApprover | null;
	approvedAt: string | null;
	rejectedAt: string | null;
	rejectNote: string | null;
	report: TripReportResponse | null;
	employee: BusinessTripEmployee;
	canSubmit: boolean;
	canApprove: boolean;
	canAddReport: boolean;
	createdAt: string;
}

export interface CreateBusinessTripDto {
	title: string;
	destination: string;
	purpose: string;
	startDate: string;
	endDate: string;
	estimatedCost?: number;
	transportType?: TransportType;
	companions?: Array<{ employeeId: number }>;
}

export type UpdateBusinessTripDto = Partial<CreateBusinessTripDto>;

export interface SubmitBusinessTripDto {
	approverId: number;
}

export interface RejectBusinessTripDto {
	note: string;
}

export interface CreateTripReportDto {
	summary: string;
	results: string;
	actualCost?: number;
	issues?: string;
}

export type UpdateTripReportDto = Partial<CreateTripReportDto>;

export interface QueryBusinessTripsParams {
	page?: number;
	limit?: number;
	status?: BusinessTripStatus;
	departmentId?: number;
	employeeId?: number;
}
