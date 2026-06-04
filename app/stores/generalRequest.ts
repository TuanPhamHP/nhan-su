import { defineStore } from 'pinia';

export const useGeneralRequestStore = defineStore('generalRequest', () => {
	const refreshSignal = ref(0);
	const lastRefreshId = ref<number | null>(null);

	function triggerRefresh(id?: number) {
		lastRefreshId.value = id ?? null;
		refreshSignal.value++;
	}

	return { refreshSignal, lastRefreshId, triggerRefresh };
});
