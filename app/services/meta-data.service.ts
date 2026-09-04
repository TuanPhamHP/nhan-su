import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type {
	RoleOption,
	BusinessTripStatusOption,
	EmploymentTypeOption,
	PassportTypeOption,
} from '~/types/meta-data.types';

export const useMetaDataService = () => {
	const authFetch = useAuthFetch();

	return {
		async findRoles(): Promise<RoleOption[]> {
			const res = await authFetch<ApiResponse<RoleOption[]>>('/v1/meta-data/roles');
			return res.data;
		},

		async findBusinessTripStatuses(): Promise<BusinessTripStatusOption[]> {
			const res = await authFetch<ApiResponse<BusinessTripStatusOption[]>>('/v1/meta-data/business-trip-statuses');
			return res.data;
		},

		async findEmploymentTypes(): Promise<EmploymentTypeOption[]> {
			const res = await authFetch<ApiResponse<EmploymentTypeOption[]>>('/v1/meta-data/employment-types');
			return res.data;
		},

		async findPassportTypes(): Promise<PassportTypeOption[]> {
			const res = await authFetch<ApiResponse<PassportTypeOption[]>>('/v1/meta-data/passport-types');
			return res.data;
		},
	};
};
