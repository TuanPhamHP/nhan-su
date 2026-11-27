/**
 * Hướng dẫn từng bước: lọc bước, đánh số, khoá "đã xem", đặt chỗ hộp, và luồng đi tới, lùi,
 * bỏ bước của `useTour`.
 */
import { describe, expect, it, beforeEach } from 'vitest';
import { markRaw, ref, type Ref } from 'vue';
import type { TourStep } from '~/types/tour.types';
import {
	countSteps,
	hasSeenTour,
	markTourSeen,
	nextStepIndex,
	placeTourBox,
	sheetSide,
	tourCounter,
	tourStorageKey,
	tourTextParts,
	unionRects,
} from '~/utils/tour';

const states: Record<string, Ref<unknown>> = {};
Object.assign(globalThis, {
	markRaw,
	useState: <T>(key: string, init: () => T) => (states[key] ??= ref(init())) as Ref<T>,
});

const { useTour } = await import('~/composables/useTour');

const step = (id: string, extra: Partial<TourStep> = {}): TourStep => ({ id, title: id, body: id, ...extra });

describe('nextStepIndex, countSteps, tourCounter', () => {
	const steps = [step('a'), step('b', { when: () => false }), step('c'), step('d'), step('e', { when: () => true })];

	it('bỏ qua bước có when trả false', () => {
		expect(nextStepIndex(steps, -1, 1)).toBe(0);
		expect(nextStepIndex(steps, 0, 1)).toBe(2);
		expect(nextStepIndex(steps, 2, -1)).toBe(0);
	});

	it('bỏ qua bước đã bị bỏ và trả -1 khi hết', () => {
		expect(nextStepIndex(steps, 2, 1, [3])).toBe(4);
		expect(nextStepIndex(steps, 4, 1)).toBe(-1);
		expect(nextStepIndex(steps, 0, -1)).toBe(-1);
	});

	it('when ném lỗi thì coi như không hiện bước đó', () => {
		const list = [step('a'), step('b', { when: () => { throw new Error('x'); } }), step('c')];
		expect(nextStepIndex(list, 0, 1)).toBe(2);
	});

	it('đếm các bước sẽ hiện; tổng sai thì chỉ ghi số bước', () => {
		expect(countSteps(steps)).toBe(4);
		expect(countSteps(steps, [3])).toBe(3);
		expect(tourCounter(2, 4, true)).toEqual({ number: 2, total: 4 });
		expect(tourCounter(3, 4, false)).toEqual({ number: 3, total: null });
	});
});

describe('khoá đã xem', () => {
	it('gồm công ty, người, tour và phiên bản', () => {
		expect(tourStorageKey('cta', 12, 'asset-list', 1)).toBe('tour:cta:12:asset-list:v1');
		expect(tourStorageKey(null, undefined, 'asset-my', 2)).toBe('tour:-:-:asset-my:v2');
	});

	it('đọc ghi qua storage', () => {
		const map = new Map<string, string>();
		const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
		expect(hasSeenTour('k', storage)).toBe(false);
		markTourSeen('k', storage);
		expect(hasSeenTour('k', storage)).toBe(true);
	});

	it('storage ném lỗi hoặc không có thì không văng, coi như chưa xem', () => {
		const broken = {
			getItem: () => {
				throw new Error('SecurityError');
			},
			setItem: () => {
				throw new Error('QuotaExceededError');
			},
		};
		expect(hasSeenTour('k', broken)).toBe(false);
		expect(() => markTourSeen('k', broken)).not.toThrow();
		expect(hasSeenTour('k', null)).toBe(false);
	});
});

describe('đặt chỗ hộp', () => {
	const view = { width: 1440, height: 900 };
	const box = { width: 352, height: 200 };

	it('không có phần tử thì nằm giữa màn', () => {
		expect(placeTourBox(null, box, view).side).toBe('center');
	});

	it('ưu tiên dưới, hết chỗ thì lên trên, rồi sang phải', () => {
		expect(placeTourBox({ top: 100, left: 600, width: 100, height: 40 }, box, view).side).toBe('bottom');
		expect(placeTourBox({ top: 800, left: 600, width: 100, height: 40 }, box, view).side).toBe('top');
		expect(placeTourBox({ top: 100, left: 20, width: 300, height: 760 }, box, view).side).toBe('right');
	});

	it('hộp không ra ngoài mép màn', () => {
		const pos = placeTourBox({ top: 100, left: 1400, width: 30, height: 30 }, box, view);
		expect(pos.left + box.width).toBeLessThanOrEqual(view.width - 16);
	});

	it('tấm dưới đáy điện thoại lên đỉnh khi che phần tử', () => {
		expect(sheetSide({ top: 100, left: 0, width: 390, height: 60 }, 260, 844)).toBe('bottom');
		expect(sheetSide({ top: 700, left: 0, width: 390, height: 60 }, 260, 844)).toBe('top');
		expect(sheetSide(null, 260, 844)).toBe('bottom');
	});

	it('ô sáng bao trọn các phần tử đang hiện', () => {
		expect(
			unionRects([
				{ top: 10, left: 10, width: 100, height: 20 },
				{ top: 50, left: 200, width: 50, height: 20 },
				{ top: 0, left: 0, width: 0, height: 0 },
			]),
		).toEqual({ top: 10, left: 10, width: 240, height: 60 });
		expect(unionRects([])).toBeNull();
	});
});

describe('useTour', () => {
	let log: string[];
	let formOpen: boolean;

	beforeEach(() => {
		for (const key of Object.keys(states)) delete states[key];
		log = [];
		formOpen = false;
	});

	function setup(canManage = true) {
		const tour = useTour();
		tour.register('t', () => ({
			id: 't',
			version: 1,
			onEnd: () => {
				log.push('end');
				formOpen = false;
			},
			steps: [
				step('welcome'),
				step('add', { mode: 'click', when: () => canManage, onEnter: () => (formOpen = false) }),
				step('form', { when: () => canManage }),
				step('close', { mode: 'click', when: () => canManage }),
				step('done', { onExit: () => log.push('exit-done') }),
			],
		}));
		return tour;
	}

	const id = (tour: ReturnType<typeof useTour>) => tour.currentStep()?.id;

	it('chạy từ đầu và đi hết thì kết thúc', () => {
		const tour = setup();
		expect(tour.start('t')).toBe(true);
		expect(id(tour)).toBe('welcome');
		expect(tour.counter.value).toEqual({ number: 1, total: 5 });
		for (let i = 0; i < 4; i++) tour.move(1);
		expect(id(tour)).toBe('done');
		tour.move(1);
		expect(tour.state.value).toBeNull();
		expect(log).toEqual(['exit-done', 'end']);
	});

	it('không có quyền thì bỏ các bước thêm tài sản và đánh lại số', () => {
		const tour = setup(false);
		tour.start('t');
		tour.move(1);
		expect(id(tour)).toBe('done');
		expect(tour.counter.value).toEqual({ number: 2, total: 2 });
	});

	it('đi tới mà phần tử không có thì bỏ hẳn bước đó', () => {
		const tour = setup();
		tour.start('t');
		tour.move(1);
		tour.move(1);
		tour.skipCurrent();
		expect(id(tour)).toBe('close');
		// Bước bị bỏ không được tính, tổng không đổi giữa chừng mà thôi ghi tổng.
		expect(tour.counter.value).toEqual({ number: 3, total: null });
		tour.move(1);
		expect(tour.counter.value).toEqual({ number: 4, total: null });
	});

	it('số bước không nhảy khi lùi rồi đi tới', () => {
		const tour = setup();
		tour.start('t');
		tour.move(1);
		tour.move(1);
		expect(tour.counter.value).toEqual({ number: 3, total: 5 });
		tour.move(-1);
		expect(tour.counter.value).toEqual({ number: 2, total: 5 });
		tour.move(1);
		expect(tour.counter.value).toEqual({ number: 3, total: 5 });
	});

	it('dữ liệu về làm đổi số bước thì thôi ghi tổng, số vẫn đi đều', () => {
		let manage = true;
		const tour = useTour();
		tour.register('d', () => ({
			id: 'd',
			version: 1,
			steps: [step('a'), step('b', { when: () => manage }), step('c', { when: () => manage }), step('d')],
		}));
		tour.start('d');
		expect(tour.counter.value).toEqual({ number: 1, total: 4 });
		manage = false;
		tour.move(1);
		expect(id(tour)).toBe('d');
		expect(tour.counter.value).toEqual({ number: 2, total: null });
		expect(tour.isLast.value).toBe(true);
	});

	it('lùi qua bước vắng phần tử không làm mất bước đó ở lượt đi tới sau', () => {
		const tour = setup();
		tour.start('t');
		for (let i = 0; i < 4; i++) tour.move(1);
		tour.move(-1); // close: khung đã đóng
		tour.skipCurrent();
		tour.skipCurrent(); // form
		expect(id(tour)).toBe('add');
		expect(tour.counter.value.total).toBe(5);
		formOpen = true;
		tour.move(1);
		expect(id(tour)).toBe('form');
	});

	it('quay lại bước Thêm thì khung nhập đóng', () => {
		const tour = setup();
		tour.start('t');
		tour.move(1);
		formOpen = true;
		tour.move(1);
		tour.move(-1);
		expect(id(tour)).toBe('add');
		expect(formOpen).toBe(false);
	});

	it('bỏ qua giữa chừng thì gọi onEnd, mở tour mới thì tour cũ tắt', () => {
		const tour = setup();
		tour.start('t');
		tour.move(1);
		formOpen = true;
		tour.finish('skip');
		expect(tour.state.value).toBeNull();
		expect(formOpen).toBe(false);
		tour.start('t');
		tour.start('t');
		expect(log.filter(l => l === 'end')).toHaveLength(2);
		expect(id(tour)).toBe('welcome');
	});

	it('chỉ Xong và Bỏ qua mới ghi đã xem; đổi trang, mở tour khác thì không', () => {
		const map = new Map<string, string>();
		const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v) };
		const g = globalThis as { window?: unknown };
		const prevWindow = g.window;
		g.window = { localStorage: storage };
		try {
			const tour = setup();
			const key = () => 'tour:k';
			tour.setSeenKey('t', key);

			tour.start('t');
			tour.finish('route');
			expect(map.has('tour:k')).toBe(false);
			tour.start('t');
			tour.start('t'); // mở lại giữa chừng: tour cũ kết thúc 'replace'
			expect(map.has('tour:k')).toBe(false);

			tour.finish('skip');
			expect(map.get('tour:k')).toBe('1');

			map.clear();
			tour.start('t');
			for (let i = 0; i < 5; i++) tour.move(1);
			expect(tour.state.value).toBeNull();
			expect(map.get('tour:k')).toBe('1');

			// Trang cũ gỡ muộn không xoá khoá của trang mới cùng tour.
			const other = () => 'tour:other';
			tour.setSeenKey('t', other);
			tour.setSeenKey('t', null, key);
			map.clear();
			tour.start('t');
			tour.finish('skip');
			expect(map.get('tour:other')).toBe('1');
		} finally {
			g.window = prevWindow;
		}
	});

	it('trang rời đi thì tour của trang tắt và không chạy lại được', () => {
		const tour = setup();
		tour.start('t');
		tour.unregister('t');
		expect(tour.state.value).toBeNull();
		expect(tour.start('t')).toBe(false);
	});
});

describe('số bước của ba tour Tài sản', () => {
	const ids = (tour: { steps: TourStep[] }) => tour.steps.filter(s => !s.when || s.when()).map(s => s.id);

	it('Quản lý tài sản: có quyền quản lý 5 bước, không quyền hoặc chỉ xem 3 bước', async () => {
		const { assetListTour } = await import('~/tours/asset-list');
		const base = {
			isDepartmentScoped: () => false,
			departmentName: () => null,
			hasAssets: () => true,
			expandOverview: () => {},
			isFormOpen: () => false,
			closeForm: () => {},
		};
		expect(ids(assetListTour({ ...base, canManage: () => true }))).toEqual(['overview', 'search', 'list', 'add', 'form-main']);
		const scoped = assetListTour({ ...base, canManage: () => false, isDepartmentScoped: () => true, departmentName: () => 'Kỹ thuật' });
		expect(ids(scoped)).toEqual(['overview', 'search', 'list']);
		expect(scoped.steps[0]!.body).toContain('phòng Kỹ thuật');
		expect(scoped.steps[1]!.body).not.toContain('phòng ban');
		expect(scoped.steps[2]!.body).not.toContain('thu hồi');
		expect(ids(assetListTour({ ...base, canManage: () => true, hasAssets: () => false }))).toHaveLength(4);
	});

	it('Chi tiết tài sản: có quyền 4 bước, không quyền 2 bước', async () => {
		const { assetDetailTour } = await import('~/tours/asset-detail');
		const base = { isService: () => false, isMenuOpen: () => false, closeMenu: () => {} };
		expect(ids(assetDetailTour({ ...base, canManage: () => true }))).toEqual(['head', 'actions', 'actions-menu', 'tabs']);
		const viewer = assetDetailTour({ ...base, canManage: () => false });
		expect(ids(viewer)).toEqual(['head', 'tabs']);
		expect(viewer.steps.at(-1)!.body).not.toContain('thu hồi');
		expect(assetDetailTour({ ...base, isService: () => true, canManage: () => true }).steps.at(-1)!.body).toContain('mục **Ghế**');
	});

	it('Tài sản của tôi: tối đa 3 bước, chưa giữ gì thì 1 bước', async () => {
		const { assetMyTour } = await import('~/tours/asset-my');
		const base = { showAssetsTab: () => {} };
		expect(ids(assetMyTour({ ...base, hasHolding: () => true, hasPending: () => true, canReport: () => true }))).toEqual(['holding', 'confirm', 'report']);
		expect(ids(assetMyTour({ ...base, hasHolding: () => true, hasPending: () => false, canReport: () => true }))).toEqual(['holding', 'confirm-later', 'report']);
		const empty = assetMyTour({ ...base, hasHolding: () => false, hasPending: () => false, canReport: () => false });
		expect(ids(empty)).toEqual(['confirm-later']);
		expect(empty.steps.find(s => s.id === 'confirm-later')!.body).toMatch(/^Hiện bạn chưa giữ tài sản nào/);
	});
});

describe('tourTextParts: in đậm tên nút trong chữ của bước', () => {
	it('tách đoạn **in đậm** khỏi chữ thường', () => {
		expect(tourTextParts('Bấm **Lưu** rồi **Đóng**.')).toEqual([
			{ text: 'Bấm ', strong: false },
			{ text: 'Lưu', strong: true },
			{ text: ' rồi ', strong: false },
			{ text: 'Đóng', strong: true },
			{ text: '.', strong: false },
		]);
	});

	it('không có dấu ** thì là một đoạn thường; chữ rỗng thì không có đoạn nào', () => {
		expect(tourTextParts('Chữ thường')).toEqual([{ text: 'Chữ thường', strong: false }]);
		expect(tourTextParts('')).toEqual([]);
	});

	it('[EDGE] dấu ** lẻ giữ nguyên, thẻ HTML vẫn chỉ là chữ', () => {
		expect(tourTextParts('a ** b')).toEqual([{ text: 'a ** b', strong: false }]);
		expect(tourTextParts('**<b>x</b>**')).toEqual([{ text: '<b>x</b>', strong: true }]);
	});
});
