export type ContractType = 'PROBATION' | 'FIXED_TERM' | 'INDEFINITE' | 'SEASONAL';
export type ContractStatus = 'DRAFT' | 'ACTIVE' | 'EXPIRED' | 'TERMINATED';

export interface ContractEmployeeSummary {
	id: number;
	employeeCode: string;
	fullName: string;
	department: string | null;
}

export interface ContractCreator {
	id: number;
	fullName: string;
}

export interface ContractResponse {
	id: number;
	contractNumber: string;
	contractType: ContractType;
	contractTypeLabel: string;
	startDate: string;
	endDate: string | null;
	baseSalary: number | null;
	position: string | null;
	status: ContractStatus;
	statusLabel: string;
	fileUrl: string | null;
	note: string | null;
	employee: ContractEmployeeSummary;
	createdBy: ContractCreator;
	daysUntilExpiry: number | null;
	isExpiringSoon: boolean;
	createdAt: string;
}

export interface CreateContractDto {
	employeeId: number;
	contractNumber: string;
	contractType: ContractType;
	startDate: string;
	endDate?: string;
	baseSalary?: number;
	position?: string;
	note?: string;
}

export type UpdateContractDto = Partial<Omit<CreateContractDto, 'employeeId'>>;

export interface TerminateContractDto {
	note?: string;
}

export interface QueryContractParams {
	page?: number;
	limit?: number;
	employeeId?: number;
	status?: ContractStatus;
	contractType?: ContractType;
	departmentId?: number;
	search?: string;
}
