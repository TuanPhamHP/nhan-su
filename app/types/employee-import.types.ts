import type { Employee } from './employee.types';

export interface ImportAutoCreatedPosition {
	id: number;
	name: string;
	departmentId: number;
	departmentName: string;
}

export interface ImportEmployeesResponse {
	importedCount: number;
	fileUrl: string;
	autoCreatedPositions: ImportAutoCreatedPosition[];
	employees: Employee[];
}

export type ImportEmployeesRowField =
	| 'employeeCode'
	| 'fullName'
	| 'email'
	| 'phone'
	| 'joinDate'
	| 'password'
	| 'role'
	| 'employmentType'
	| 'departmentName'
	| 'positionName'
	| 'managerCode'
	| 'dateOfBirth'
	| 'gender'
	| 'address'
	| 'citizenIdNumber'
	| 'citizenFullName'
	| 'citizenIssuedDate'
	| 'citizenExpiryDate'
	| 'citizenIssuedPlace'
	| 'hometown'
	| 'passportNumber'
	| 'passportFullName'
	| 'passportType'
	| 'passportIssuedDate'
	| 'passportExpiryDate';

export interface ImportEmployeesRowError {
	row: number;
	field: ImportEmployeesRowField | null;
	value: string | null;
	message: string;
}

export interface ImportEmployeesValidationErrorPayload {
	code: 'EMPLOYEE_IMPORT_VALIDATION';
	message: string;
	errors: ImportEmployeesRowError[];
}
