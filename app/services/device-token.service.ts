import { useAuthFetch } from './http/auth.fetch';
import type { ApiResponse } from '~/types/api.types';
import type { RegisterDeviceTokenDto } from '~/types/notification.types';

export const useDeviceTokenService = () => {
	const authFetch = useAuthFetch();

	return {
		async register(dto: RegisterDeviceTokenDto): Promise<void> {
			await authFetch<ApiResponse<{ message: string }>>('/v1/device-tokens', {
				method: 'POST',
				body: dto,
			});
		},

		async unregister(token: string): Promise<void> {
			await authFetch<ApiResponse<{ message: string }>>('/v1/device-tokens', {
				method: 'DELETE',
				params: { token },
			});
		},
	};
};
