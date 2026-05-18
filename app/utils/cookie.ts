export function getCookie(name: string): string | null {
	if (!import.meta.client) return null;
	const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : null;
}

export function setCookie(name: string, value: string, maxAge: number) {
	if (!import.meta.client) return;
	document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=/; samesite=lax`;
}

export function deleteCookie(name: string) {
	if (!import.meta.client) return;
	document.cookie = `${name}=; max-age=0; path=/; samesite=lax`;
}
