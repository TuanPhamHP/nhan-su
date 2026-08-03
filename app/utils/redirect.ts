export function safeRedirectPath(raw: unknown): string | null {
	if (typeof raw !== 'string' || !raw) return null;
	// Only allow same-origin relative paths; reject protocol-relative "//host" and absolute URLs
	if (!raw.startsWith('/') || raw.startsWith('//')) return null;
	return raw;
}
