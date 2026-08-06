import { defineStore } from 'pinia';
import { useMetaDataService } from '~/services';
import type { RoleOption, BusinessTripStatusOption, EmploymentTypeOption } from '~/types/meta-data.types';
import type { UserRole } from '~/types/auth.types';
import type { BusinessTripStatus } from '~/types/business-trip.types';
import type { EmploymentType } from '~/types/employee.types';

export const useMetaDataStore = defineStore('metadata', () => {
	const roles = ref<RoleOption[]>([]);
	const businessTripStatuses = ref<BusinessTripStatusOption[]>([]);
	const employmentTypes = ref<EmploymentTypeOption[]>([]);
	const loaded = ref(false);
	const loading = ref(false);

	async function load() {
		if (loaded.value || loading.value) return;
		loading.value = true;
		try {
			const service = useMetaDataService();
			const [rolesRes, tripStatusesRes, employmentTypesRes] = await Promise.all([
				service.findRoles(),
				service.findBusinessTripStatuses(),
				service.findEmploymentTypes(),
			]);
			roles.value = rolesRes;
			businessTripStatuses.value = tripStatusesRes;
			employmentTypes.value = employmentTypesRes;
			loaded.value = true;
		} finally {
			loading.value = false;
		}
	}

	function reset() {
		roles.value = [];
		businessTripStatuses.value = [];
		employmentTypes.value = [];
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

	function labelForEmploymentType(type: EmploymentType | string | null | undefined): string {
		if (!type) return '';
		return employmentTypes.value.find(t => t.value === type)?.label ?? type;
	}

	return {
		roles,
		businessTripStatuses,
		employmentTypes,
		loaded,
		loading,
		load,
		reset,
		labelForRole,
		labelForBusinessTripStatus,
		labelForEmploymentType,
	};
});
