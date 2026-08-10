import type { UserRole } from '~/types/auth.types';
import {
	DEFAULT_THEME_ID,
	THEME_STORAGE_KEY,
	THEMES,
	applyThemeToDocument,
	getThemeById,
} from '~/config/themes';

export const useUiStore = defineStore('ui', () => {
	const previewRole = ref<UserRole | null>(null);

	function previewAs(role: UserRole | null) {
		previewRole.value = role;
	}

	const themeId = ref<string>(DEFAULT_THEME_ID);
	const previewThemeId = ref<string | null>(null);

	const activeThemeId = computed(() => previewThemeId.value ?? themeId.value);
	const activeTheme = computed(() => getThemeById(activeThemeId.value));

	function initTheme() {
		if (typeof window === 'undefined') return;
		const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
		const valid = stored && THEMES.some(t => t.id === stored) ? stored : DEFAULT_THEME_ID;
		themeId.value = valid;
		applyThemeToDocument(getThemeById(valid));
	}

	function setPreviewTheme(id: string) {
		if (!THEMES.some(t => t.id === id)) return;
		previewThemeId.value = id;
		applyThemeToDocument(getThemeById(id));
	}

	function clearPreviewTheme() {
		previewThemeId.value = null;
		applyThemeToDocument(getThemeById(themeId.value));
	}

	function saveTheme(id: string) {
		if (!THEMES.some(t => t.id === id)) return;
		themeId.value = id;
		previewThemeId.value = null;
		if (typeof window !== 'undefined') {
			window.localStorage.setItem(THEME_STORAGE_KEY, id);
		}
		applyThemeToDocument(getThemeById(id));
	}

	return {
		previewRole,
		previewAs,
		themeId,
		previewThemeId,
		activeThemeId,
		activeTheme,
		initTheme,
		setPreviewTheme,
		clearPreviewTheme,
		saveTheme,
	};
});
