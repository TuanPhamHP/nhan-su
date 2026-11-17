import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { moduleOfPath, MODULE_ROUTES, useModuleAccess } from '~/composables/useModuleAccess';
import { notifyIfModuleDenied, setOnModuleDenied } from '~/services/http/auth.fetch';
import type { ModuleEntitlement } from '~/types/entitlement.types';

const modules = ref<ModuleEntitlement[]>([]);

vi.mock('~/stores/auth', () => ({ useAuthStore: () => ({ modules }) }));

function entitlement(code: string, state: ModuleEntitlement['state']): ModuleEntitlement {
	return { code, label: code, state, reason: null, expiresAt: null } as ModuleEntitlement;
}

beforeEach(() => {
	modules.value = [];
});

describe('moduleOfPath', () => {
	it('khớp đúng route thuộc module, cả màn hình quản lý lẫn nhân viên', () => {
		expect(moduleOfPath('/management/overtime')).toBe('OVERTIME');
		expect(moduleOfPath('/overtime/my')).toBe('OVERTIME');
		expect(moduleOfPath('/overtime-requests/12')).toBe('OVERTIME');
		expect(moduleOfPath('/online-work-requests/3')).toBe('ONLINE_WORK');
		expect(moduleOfPath('/business-trips/7')).toBe('BUSINESS_TRIP');
		expect(moduleOfPath('/management/contracts')).toBe('CONTRACT_INSURANCE');
		expect(moduleOfPath('/assistant')).toBe('AI_AGENT');
		expect(moduleOfPath('/agent-usage')).toBe('AI_AGENT');
		expect(moduleOfPath('/management/reports')).toBe('REPORTS');
		expect(moduleOfPath('/announcements/1')).toBe('ANNOUNCEMENT');
	});

	it('route của lõi nhân sự, hoặc chỉ trùng phần đầu tên, không thuộc module nào', () => {
		expect(moduleOfPath('/')).toBeNull();
		expect(moduleOfPath('/management')).toBeNull();
		expect(moduleOfPath('/management/employees/1')).toBeNull();
		expect(moduleOfPath('/overtimes')).toBeNull();
		expect(moduleOfPath('/management/overtime-x')).toBeNull();
	});

	it('CORE không có trong bảng vì không tắt được', () => {
		expect('CORE' in MODULE_ROUTES).toBe(false);
	});
});

describe('useModuleAccess', () => {
	it('danh sách rỗng (BE cũ, lỗi mạng) thì coi mọi module dùng được', () => {
		const { canUse, canWrite, moduleState } = useModuleAccess();
		expect(moduleState('OVERTIME')).toBe('ENABLED');
		expect(canUse('OVERTIME')).toBe(true);
		expect(canWrite('OVERTIME')).toBe(true);
	});

	it('module không có trong danh sách và mã lạ đều không ảnh hưởng', () => {
		modules.value = [entitlement('MODULE_MOI', 'DISABLED'), entitlement('REPORTS', 'ENABLED')];
		const { canUse, canWrite } = useModuleAccess();
		expect(canUse('OVERTIME')).toBe(true);
		expect(canWrite('OVERTIME')).toBe(true);
	});

	it('READ_ONLY vào xem được nhưng không ghi được', () => {
		modules.value = [entitlement('OVERTIME', 'READ_ONLY')];
		const { canUse, canWrite } = useModuleAccess();
		expect(canUse('OVERTIME')).toBe(true);
		expect(canWrite('OVERTIME')).toBe(false);
	});

	it('DISABLED không vào được, không ghi được', () => {
		modules.value = [entitlement('OVERTIME', 'DISABLED')];
		const { canUse, canWrite } = useModuleAccess();
		expect(canUse('OVERTIME')).toBe(false);
		expect(canWrite('OVERTIME')).toBe(false);
	});
});

describe('notifyIfModuleDenied', () => {
	it('chỉ mã MODULE_* mới tải lại quyền', () => {
		const onDenied = vi.fn();
		setOnModuleDenied(onDenied);

		notifyIfModuleDenied('MODULE_SUSPENDED');
		notifyIfModuleDenied('MODULE_NOT_SUBSCRIBED');
		notifyIfModuleDenied('MODULE_READ_ONLY');
		notifyIfModuleDenied('MODULE_EXPIRED');
		notifyIfModuleDenied('MODULE_LAPSED');
		expect(onDenied).toHaveBeenCalledTimes(5);

		notifyIfModuleDenied('AUTH_TOKEN_EXPIRED');
		notifyIfModuleDenied('TENANT_SUSPENDED');
		notifyIfModuleDenied(undefined);
		expect(onDenied).toHaveBeenCalledTimes(5);
	});
});
