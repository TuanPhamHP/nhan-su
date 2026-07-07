import type { UserRole } from './auth.types';
import type { BusinessTripStatus } from './business-trip.types';

export interface RoleOption {
	value: UserRole;
	label: string;
}

export interface BusinessTripStatusOption {
	value: BusinessTripStatus;
	label: string;
}
