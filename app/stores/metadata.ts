import { defineStore } from 'pinia';
import { useMetaDataService } from '~/services';
import type { RoleOption, BusinessTripStatusOption } from '~/types/meta-data.types';
import type { UserRole } from '~/types/auth.types';
import type { BusinessTripStatus } from '~/types/business-trip.types';

export const useMetaDataStore = defineStore('metadata', () => {
	const roles = ref<RoleOption[]>([]);
	const businessTripStatuses = ref<BusinessTripStatusOption[]>([]);
	const loaded = ref(false);
	const loading = ref(false);

	async function load() {
		if (loaded.value || loading.value) return;
		loading.value = true;
		try {
			const service = useMetaDataService();
			const [rolesRes, tripStatusesRes] = await Promise.all([
				service.findRoles(),
				service.findBusinessTripStatuses(),
			]);
			roles.value = rolesRes;
			businessTripStatuses.value = tripStatusesRes;
			loaded.value = true;
		} finally {
			loading.value = false;
		}
	}

	function reset() {
		roles.value = [];
		businessTripStatuses.value = [];
		loaded.value = false;
	}

	function labelForRole(role: UserRole | string | null | undefined): string {
		if (!role) return '';
		return roles.value.find(r => r.value === role)?.label ?? role;
	}

	function labelForBusinessTripStatus(status: BusinessTripStatus | string | null | undefined): string {
		if (!status) return '';
		return businessTripStatuses.value.find(s => s.value === status)?.label ?? status;
	}

	return {
		roles,
		businessTripStatuses,
		loaded,
		loading,
		load,
		reset,
		labelForRole,
		labelForBusinessTripStatus,
	};
});
