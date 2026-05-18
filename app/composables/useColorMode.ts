const isDark = ref(false);

export function useColorMode() {
	function applyClass() {
		if (import.meta.client) {
			document.documentElement.classList.toggle('dark', isDark.value);
		}
	}

	function toggle() {
		isDark.value = !isDark.value;
		applyClass();
		useCookie('color-mode', { maxAge: 60 * 60 * 24 * 365 }).value = isDark.value ? 'dark' : 'light';
	}

	function init() {
		const saved = useCookie('color-mode').value;
		isDark.value = saved === 'dark';
		applyClass();
	}

	return { isDark: readonly(isDark), toggle, init };
}
