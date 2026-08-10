import {
	DEFAULT_THEME_ID,
	THEME_STORAGE_KEY,
	THEMES,
	applyThemeToDocument,
	getThemeById,
} from '~/config/themes';

export default defineNuxtPlugin(() => {
	const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
	const valid = stored && THEMES.some(t => t.id === stored) ? stored : DEFAULT_THEME_ID;
	applyThemeToDocument(getThemeById(valid));

	const uiStore = useUiStore();
	uiStore.initTheme();
});
