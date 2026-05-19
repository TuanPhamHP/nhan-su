import { useAttendanceService } from '~/services/attendance.service';

interface CacheEntry {
	url: string;
	expiresAt: number;
}

// Module-level cache — shared across all component instances
const urlCache = new Map<string, CacheEntry>();

const CACHE_TTL_MS = 55 * 60 * 1000; // 55 min (presigned URL expires at 60 min)
const SAFETY_BUFFER_MS = 5 * 60 * 1000; // evict 5 min before expiry

export function usePresignedUrl() {
	const attendanceService = useAttendanceService();

	async function getPresignedUrl(fileUrl: string | null): Promise<string | null> {
		if (!fileUrl) return null;

		const cached = urlCache.get(fileUrl);
		if (cached && cached.expiresAt > Date.now() + SAFETY_BUFFER_MS) {
			return cached.url;
		}

		const presignedUrl = await attendanceService.getPhotoPresignedUrl(fileUrl);

		urlCache.set(fileUrl, {
			url: presignedUrl,
			expiresAt: Date.now() + CACHE_TTL_MS,
		});

		return presignedUrl;
	}

	return { getPresignedUrl };
}
