/**
 * ============================================================
 * Test suite: khối Tổng quan tài sản tự cập nhật sau khi lưu hoặc nhập
 * ============================================================
 *
 * Vì sao cần: trước đây khối Tổng quan chỉ gọi API một lần lúc mở trang, nên nhập một file Excel
 * trăm dòng xong người dùng vẫn đọc được "0 thiết bị" cho tới khi F5 — họ tưởng là nhập trượt.
 * Trang danh sách giờ gọi `reload()` của khối này, nên hai điều phải đúng: khối có phơi ra
 * `reload`, và trong lúc tải lại thì số cũ vẫn nằm trên màn chứ không chớp về khung xương. Lần
 * tải lại hỏng cũng không được xoá số đang đúng.
 *
 * Ký hiệu: [EDGE] trường hợp biên
 * ============================================================
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, onMounted, onUnmounted, nextTick } from 'vue';
import type { AssetOverview } from '~/types/asset.types';

const overview = vi.fn();
const openStocktake = vi.fn();

vi.mock('~/services/asset.service', () => ({
	useAssetService: () => ({ overview, openStocktake }),
}));

Object.assign(globalThis, {
	onMounted,
	onUnmounted,
	usePermissions: () => ({ hasPermission: () => true }),
	useAuth: () => ({ user: { value: { role: 'ADMIN' } } }),
});

import AssetOverviewPanel from '~/components/modules/asset/AssetOverviewPanel.vue';

const ButtonStub = defineComponent({ template: '<button><slot /></button>' });
const LinkStub = defineComponent({ props: { to: String }, template: '<a><slot /></a>' });

function fixture(physicalCount: number, costVnd: number): AssetOverview {
	return {
		asOf: '2026-11-18',
		canViewValue: true,
		total: physicalCount,
		physicalCount,
		serviceCount: 0,
		disputedConfirmations: 0,
		byStatus: [],
		byDepartment: [],
		totals: { costVnd, bookValue: costVnd },
		serviceCostThisMonth: 0,
		expiringIn30Days: 0,
		maintenanceDueIn30Days: 0,
		pendingConfirmations: 0,
		openIncidents: 0,
		pendingDisposals: 0,
	};
}

async function mountPanel() {
	const wrapper = mount(AssetOverviewPanel, {
		global: { stubs: { CommonAppButton: ButtonStub, NuxtLink: LinkStub } },
	});
	await nextTick();
	await nextTick();
	return wrapper;
}

/** Hàm `reload` mà trang danh sách gọi. */
function reloadOf(wrapper: Awaited<ReturnType<typeof mountPanel>>): () => Promise<void> {
	const fn = (wrapper.vm as unknown as { reload?: () => Promise<void> }).reload;
	if (!fn) throw new Error('Khối Tổng quan không phơi ra `reload`');
	return fn;
}

beforeEach(() => {
	overview.mockReset();
	openStocktake.mockReset();
	openStocktake.mockResolvedValue(null);
});

describe('AssetOverviewPanel', () => {
	it('F12/F13: gọi `reload()` thì gọi lại API và số trên màn đổi theo', async () => {
		overview.mockResolvedValueOnce(fixture(0, 0));
		const wrapper = await mountPanel();
		expect(wrapper.text()).toContain('Đang quản lý 0 thiết bị');

		overview.mockResolvedValueOnce(fixture(120, 450_000_000));
		await reloadOf(wrapper)();
		await nextTick();

		expect(overview).toHaveBeenCalledTimes(2);
		expect(wrapper.text()).toContain('Đang quản lý 120 thiết bị');
		expect(wrapper.text()).toContain('450.000.000');
	});

	it('đang tải lại thì giữ số cũ trên màn và báo "Đang cập nhật…"', async () => {
		overview.mockResolvedValueOnce(fixture(7, 1_000_000));
		const wrapper = await mountPanel();

		let release: (v: AssetOverview) => void = () => {};
		overview.mockReturnValueOnce(new Promise<AssetOverview>(resolve => (release = resolve)));
		const pending = reloadOf(wrapper)();
		await nextTick();

		// Giữa lúc chờ: vẫn là số cũ, không phải khung xương.
		expect(wrapper.text()).toContain('Đang quản lý 7 thiết bị');
		expect(wrapper.text()).toContain('Đang cập nhật…');

		release(fixture(9, 2_000_000));
		await pending;
		await nextTick();
		expect(wrapper.text()).toContain('Đang quản lý 9 thiết bị');
		expect(wrapper.text()).not.toContain('Đang cập nhật…');
	});

	it('[EDGE] lần tải lại hỏng thì giữ nguyên số cũ, không xoá khối', async () => {
		overview.mockResolvedValueOnce(fixture(7, 1_000_000));
		const wrapper = await mountPanel();

		overview.mockRejectedValueOnce(new Error('mạng rớt'));
		await reloadOf(wrapper)();
		await nextTick();

		expect(wrapper.text()).toContain('Đang quản lý 7 thiết bị');
		expect(wrapper.text()).not.toContain('mạng rớt');
	});

	it('[EDGE] lần đầu hỏng rồi mới gọi `reload()` thì tải lại từ đầu và hiện số', async () => {
		overview.mockRejectedValueOnce(new Error('Chưa tải được tổng quan tài sản'));
		const wrapper = await mountPanel();
		expect(wrapper.text()).toContain('Chưa tải được tổng quan tài sản');

		overview.mockResolvedValueOnce(fixture(3, 500_000));
		await reloadOf(wrapper)();
		await nextTick();
		expect(wrapper.text()).toContain('Đang quản lý 3 thiết bị');
	});
});
