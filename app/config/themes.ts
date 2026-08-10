export interface ThemeColors {
	headerBg: string;
	headerText: string;
	sidebarBg: string;
	sidebarText: string;
	accent: string;
	border: string;

	/** Sidebar nav item — hover state */
	navHoverBg: string;
	navHoverText: string;

	/** Sidebar nav item — active state (also drives the left indicator color via `accent`) */
	navActiveBg: string;
	navActiveText: string;
}

export interface Theme {
	id: string;
	nameEn: string;
	nameVi: string;
	colors: ThemeColors;
	/** Which logo file to render inside the sidebar.
	 *  `'light'` → `app-logo-light-mode.svg` (dark-colored logo, for light sidebars).
	 *  `'dark'`  → `app-logo-dark-mode.svg`  (light-colored logo, for dark sidebars). */
	logo: 'light' | 'dark';
}

export const THEMES: Theme[] = [
	{
		id: 'sky',
		nameEn: 'Sky',
		nameVi: 'Bầu trời',
		colors: {
			headerBg: '#EFF6FF',
			headerText: '#1E3A8A',
			sidebarBg: '#EFF6FF',
			sidebarText: '#1E3A8A',
			accent: '#2563EB',
			border: '#BFDBFE',
			navHoverBg: '#DBEAFE',
			navHoverText: '#1E3A8A',
			navActiveBg: '#BFDBFE',
			navActiveText: '#2563EB',
		},
		logo: 'light',
	},
	{
		id: 'pearl',
		nameEn: 'Pearl',
		nameVi: 'Ngọc trai',
		colors: {
			headerBg: '#FFFFFF',
			headerText: '#1E3A5F',
			sidebarBg: '#1E3A5F',
			sidebarText: '#F1F5F9',
			accent: '#3B82F6',
			border: '#E2E8F0',
			navHoverBg: 'rgba(255, 255, 255, 0.08)',
			navHoverText: '#F1F5F9',
			navActiveBg: 'rgba(59, 130, 246, 0.18)',
			navActiveText: '#93C5FD',
		},
		logo: 'dark',
	},
	{
		id: 'sunset',
		nameEn: 'Sunset',
		nameVi: 'Hoàng hôn',
		colors: {
			headerBg: '#FFF7ED',
			headerText: '#7C2D12',
			sidebarBg: '#FB923C',
			sidebarText: '#FFFFFF',
			accent: '#EA580C',
			border: '#FED7AA',
			navHoverBg: 'rgba(255, 255, 255, 0.15)',
			navHoverText: '#FFFFFF',
			navActiveBg: 'rgba(124, 45, 18, 0.25)',
			navActiveText: '#FFEDD5',
		},
		logo: 'light',
	},
	{
		id: 'midnight',
		nameEn: 'Midnight',
		nameVi: 'Nửa đêm',
		colors: {
			headerBg: '#0F172A',
			headerText: '#E2E8F0',
			sidebarBg: '#0F172A',
			sidebarText: '#E2E8F0',
			accent: '#60A5FA',
			border: '#1E293B',
			navHoverBg: 'rgba(255, 255, 255, 0.06)',
			navHoverText: '#F1F5F9',
			navActiveBg: 'rgba(96, 165, 250, 0.15)',
			navActiveText: '#93C5FD',
		},
		logo: 'dark',
	},
];

export const DEFAULT_THEME_ID = 'sky';

export const THEME_STORAGE_KEY = 'app.theme';

export function getThemeById(id: string | null | undefined): Theme {
	if (!id) return THEMES.find(t => t.id === DEFAULT_THEME_ID) ?? THEMES[0]!;
	return THEMES.find(t => t.id === id) ?? THEMES.find(t => t.id === DEFAULT_THEME_ID) ?? THEMES[0]!;
}

export function themeToCssVars(theme: Theme): Record<string, string> {
	return {
		'--color-header-bg': theme.colors.headerBg,
		'--color-header-text': theme.colors.headerText,
		'--color-sidebar-bg': theme.colors.sidebarBg,
		'--color-sidebar-text': theme.colors.sidebarText,
		'--color-accent': theme.colors.accent,
		'--color-border-theme': theme.colors.border,
		'--color-nav-hover-bg': theme.colors.navHoverBg,
		'--color-nav-hover-text': theme.colors.navHoverText,
		'--color-nav-active-bg': theme.colors.navActiveBg,
		'--color-nav-active-text': theme.colors.navActiveText,
	};
}

export function applyThemeToDocument(theme: Theme): void {
	if (typeof document === 'undefined') return;
	const vars = themeToCssVars(theme);
	const root = document.documentElement;
	for (const [key, value] of Object.entries(vars)) {
		root.style.setProperty(key, value);
	}
}
