export type BusinessTripStatus =
	| 'DRAFT'
	| 'PENDING'
	| 'APPROVED'
	| 'IN_PROGRESS'
	| 'COMPLETED'
	| 'REJECTED'
	| 'CANCELLED';

export type TripReportStatus = 'DRAFT' | 'SUBMITTED';

export type TransportType = 'PLANE' | 'TRAIN' | 'CAR' | 'OTHER';

export type DesiredTimeType = 'ARRIVAL' | 'PICKUP';

export interface TripCompanion {
	employeeId: number;
}

export interface TripTransportResponse {
	id: number;
	order: number;
	transportType: TransportType;
	pickupLocation: string | null;
	dropLocation: string | null;
	pickupTime: string | null;
	dropTime: string | null;
	licensePlate: string | null;
	driverPhone: string | null;
	flightNumber: string | null;
	checkInTime: string | null;
	ticketImageUrl: string | null;
	note: string | null;
}

export interface TripRouteResponse {
	id: number;
	order: number;
	pickupPoint: string;
	dropPoint: string;
	desiredTimeType: DesiredTimeType;
	desiredTime: string | null;
	isSelfTransport: boolean;
	transports: TripTransportResponse[];
}

export interface TripReportResponse {
	id: number;
	summary: string;
	results: string;
	actualCost: number | null;
	issues: string | null;
	attachmentUrls: string[];
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

export interface BusinessTripCreatedFor {
	id: number;
	fullName: string;
	employeeCode: string;
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
	/** @deprecated Trip-level transportType is legacy — new trips always null. Transport nằm ở routes[].transports[]. */
	transportType: TransportType | null;
	companions: TripCompanion[] | null;
	routes: TripRouteResponse[];
	status: BusinessTripStatus;
	statusLabel: string;
	approver: BusinessTripApprover | null;
	approvedAt: string | null;
	autoApproved: boolean;
	rejectedAt: string | null;
	rejectNote: string | null;
	report: TripReportResponse | null;
	employee: BusinessTripEmployee;
	createdForEmployee: BusinessTripCreatedFor | null;
	canSubmit: boolean;
	canApprove: boolean;
	canAddReport: boolean;
	canCancel: boolean;
	createdAt: string;
}

export interface CreateTripRouteDto {
	pickupPoint: string;
	dropPoint: string;
	desiredTimeType: DesiredTimeType;
	desiredTime?: string;
}

export interface CreateBusinessTripDto {
	title: string;
	destination: string;
	purpose: string;
	startDate: string;
	endDate: string;
	estimatedCost?: number;
	companions?: Array<{ employeeId: number }>;
	routes: CreateTripRouteDto[];
	createdForEmployeeId?: number;
}

export type UpdateBusinessTripDto = Partial<Omit<CreateBusinessTripDto, 'routes' | 'createdForEmployeeId'>>;

export interface SubmitBusinessTripDto {
	approverId?: number;
}

export interface RejectBusinessTripDto {
	note: string;
}

export interface CreateTripTransportDto {
	order: number;
	transportType: TransportType;
	pickupLocation?: string;
	dropLocation?: string;
	pickupTime?: string;
	dropTime?: string;
	licensePlate?: string;
	driverPhone?: string;
	flightNumber?: string;
	checkInTime?: string;
	ticketImageUrl?: string;
	note?: string;
}

export interface UpdateRouteTransportDto {
	isSelfTransport?: boolean;
	transports?: CreateTripTransportDto[];
}

export interface CreateTripReportDto {
	summary: string;
	results: string;
	actualCost?: number;
	issues?: string;
	attachmentUrls?: string[];
}

export type UpdateTripReportDto = Partial<CreateTripReportDto>;

export interface QueryBusinessTripsParams {
	page?: number;
	limit?: number;
	status?: BusinessTripStatus;
	departmentId?: number;
	employeeId?: number;
}
