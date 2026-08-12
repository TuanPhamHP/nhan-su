import type { UserRole } from './auth.types';
import type { BusinessTripStatus } from './business-trip.types';
import type { EmploymentType } from './employee.types';
import type { PassportType } from './employee-passport.types';

export interface RoleOption {
	value: UserRole;
	label: string;
}

export interface BusinessTripStatusOption {
	value: BusinessTripStatus;
	label: string;
}

export interface EmploymentTypeOption {
	value: EmploymentType;
	label: string;
}

export interface PassportTypeOption {
	value: PassportType;
	label: string;
}
