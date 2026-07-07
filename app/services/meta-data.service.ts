import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type { RoleOption, BusinessTripStatusOption } from '~/types/meta-data.types';

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
	};
};
