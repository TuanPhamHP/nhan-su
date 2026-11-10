import { storeToRefs } from 'pinia';
import { useAuthStore } from '~/stores/auth';
import type { ModuleCode, ModuleEntitlement, ModuleState } from '~/types/entitlement.types';

/**
 * Module nào gồm những màn hình nào. Thêm module mới chỉ sửa ở đây (kèm thêm `module` vào mục menu).
 * `CORE` luôn bật nên không có trong bảng.
 */
export const MODULE_ROUTES: Record<Exclude<ModuleCode, 'CORE'>, string[]> = {
	AI_AGENT: ['/assistant', '/agent-usage'],
	REPORTS: ['/management/reports'],
	OVERTIME: ['/management/overtime', '/overtime', '/overtime-requests'],
	ONLINE_WORK: ['/management/online-work', '/online-work', '/online-work-requests'],
	BUSINESS_TRIP: ['/management/business-trips', '/business-trips'],
	CONTRACT_INSURANCE: ['/management/contracts'],
	ANNOUNCEMENT: ['/management/announcements', '/announcements'],
	ASSET: ['/management/assets', '/assets'],
};

/** Route này thuộc module nào, `null` nếu không thuộc module nào bật tắt được. */
export function moduleOfPath(path: string): ModuleCode | null {
	for (const [code, prefixes] of Object.entries(MODULE_ROUTES)) {
		if (prefixes.some(prefix => path === prefix || path.startsWith(`${prefix}/`))) {
			return code as ModuleCode;
		}
	}
	return null;
}

/**
 * Hỏi module của công ty hiện tại dùng được đến đâu. Module không có trong danh sách hoặc danh sách
 * rỗng (chưa nạp được, BE cũ) thì trả về dùng được: FE chỉ ẩn cho gọn, API mới là nơi chặn thật.
 */
export function useModuleAccess() {
	const { modules } = storeToRefs(useAuthStore());

	function moduleEntitlement(code: ModuleCode): ModuleEntitlement | null {
		return modules.value.find(m => m.code === code) ?? null;
	}

	function moduleState(code: ModuleCode): ModuleState {
		return moduleEntitlement(code)?.state ?? 'ENABLED';
	}

	/** Vào xem được: khác `DISABLED`. */
	function canUse(code: ModuleCode): boolean {
		return moduleState(code) !== 'DISABLED';
	}

	/** Tạo, sửa, duyệt được: phải `ENABLED`. */
	function canWrite(code: ModuleCode): boolean {
		return moduleState(code) === 'ENABLED';
	}

	return { modules, moduleEntitlement, moduleState, canUse, canWrite, moduleOfPath };
}
