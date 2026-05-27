export type PayrollStatus = 'DRAFT' | 'PUBLISHED';

export interface PayrollItem {
	label: string;
	amount: number;
	type: 'ADDITION' | 'DEDUCTION';
}

export interface PayrollEmployeeRef {
	id: number;
	fullName: string;
	employeeCode: string;
	department: { id: number; name: string } | null;
	position: { id: number; name: string } | null;
}

export interface PayrollSummary {
	id: number;
	month: string;
	employee: PayrollEmployeeRef;
	baseSalary: number;
	allowances: number;
	deductions: number;
	bonus: number;
	netSalary: number;
	status: PayrollStatus;
}

export interface PayrollDetail extends PayrollSummary {
	items: PayrollItem[];
}

export interface CreatePayrollDto {
	employeeId: number;
	month: string;
	baseSalary: number;
	allowances?: number;
	deductions?: number;
	bonus?: number;
}

export interface UpdatePayrollDto {
	baseSalary?: number;
	allowances?: number;
	deductions?: number;
	bonus?: number;
}

export interface QueryPayrollParams {
	month?: string;
	employeeId?: number;
	status?: PayrollStatus;
	page?: number;
	limit?: number;
}
