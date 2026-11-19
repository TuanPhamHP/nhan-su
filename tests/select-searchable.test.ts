/**
 * ============================================================
 * Test suite: `UiSelect` với ô tìm (`searchable`)
 * ============================================================
 *
 * Vì sao cần: `UiSelect` là ô chọn dùng chung của gần như mọi bộ lọc trong web, nên thêm ô tìm
 * vào nó có hai rủi ro. Một là làm hỏng những ô đang dùng: mặc định phải y như cũ, không ô tìm,
 * không đổi danh sách. Hai là người dùng gõ một từ không khớp rồi mất luôn đường bỏ lọc, vì
 * lựa chọn "Tất cả…" bị lọc mất; nên lựa chọn giá trị rỗng luôn được ghim lại.
 *
 * Danh sách được Teleport ra `body`, nên test tìm nó trong `document.body` chứ không qua wrapper.
 *
 * Ký hiệu: [EDGE] trường hợp biên
 * ============================================================
 */

import { describe, expect, it, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { onMounted, onUnmounted, nextTick } from 'vue';

Object.assign(globalThis, { onMounted, onUnmounted });

import UiSelect from '~/components/ui/Select.vue';

const CATEGORIES = [
	{ value: undefined as number | undefined, label: 'Tất cả loại tài sản' },
	{ value: 1, label: 'Nội thất văn phòng → Ghế' },
	{ value: 2, label: 'Nội thất văn phòng → Ghế làm việc' },
	{ value: 3, label: 'Máy tính → Laptop' },
	{ value: 4, label: 'Máy tính → Màn hình' },
];

const DEPARTMENTS = [
	{ value: undefined as number | undefined, label: 'Tất cả phòng ban' },
	{ value: 7, label: 'Thu chi hộ' },
	{ value: 8, label: 'Kế toán' },
];

/** Khối danh sách đã Teleport ra body; `max-h-60` là lớp riêng của nó. */
function dropdown(): HTMLElement | null {
	return document.body.querySelector('.max-h-60');
}

function searchBox(): HTMLInputElement | null {
	return dropdown()?.querySelector('input') ?? null;
}

function optionLabels(): string[] {
	return Array.from(dropdown()?.querySelectorAll('button') ?? []).map(b => b.textContent?.trim() ?? '');
}

async function type(text: string) {
	const input = searchBox();
	if (!input) throw new Error('Danh sách đang mở nhưng không có ô tìm');
	input.value = text;
	input.dispatchEvent(new Event('input'));
	await nextTick();
}

async function press(key: string) {
	searchBox()?.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));
	await nextTick();
}

type Props = Record<string, unknown>;

/**
 * Các wrapper đã dựng, để `afterEach` tháo hết.
 *
 * `UiSelect` nghe `mousedown` trên `document`, nên một wrapper còn sống sót sang bài sau sẽ
 * nhận luôn cú bấm của bài đó rồi vẽ lại vào DOM đã bị xoá: Vue báo lỗi `insertBefore` của
 * `null` ở một bài trông như không liên quan.
 */
const mounted: ReturnType<typeof mount>[] = [];

async function open(props: Props) {
	const wrapper = mount(UiSelect, { props, attachTo: document.body });
	mounted.push(wrapper);
	await wrapper.find('button').trigger('click');
	await nextTick();
	return wrapper;
}

const searchable = (options = CATEGORIES, extra: Props = {}) => ({
	modelValue: undefined,
	options,
	searchable: true,
	searchPlaceholder: 'Tìm loại tài sản',
	...extra,
});

afterEach(() => {
	while (mounted.length) mounted.pop()?.unmount();
	document.body.innerHTML = '';
});

describe('UiSelect searchable — lọc theo chữ đã gõ', () => {
	it('F1: gõ "ghe" ra hai loại Ghế, "Tất cả loại tài sản" vẫn ở đầu', async () => {
		await open(searchable());
		await type('ghe');
		expect(optionLabels()).toEqual([
			'Tất cả loại tài sản',
			'Nội thất văn phòng → Ghế',
			'Nội thất văn phòng → Ghế làm việc',
		]);
	});

	it('F2: gõ "Máy tính" có dấu ra các loại nhóm Máy tính', async () => {
		await open(searchable());
		await type('Máy tính');
		expect(optionLabels()).toEqual(['Tất cả loại tài sản', 'Máy tính → Laptop', 'Máy tính → Màn hình']);
	});

	it('F3: gõ "zzz" thì hiện "Không tìm thấy kết quả" mà vẫn còn lựa chọn bỏ lọc', async () => {
		await open(searchable());
		await type('zzz');
		expect(optionLabels()).toEqual(['Tất cả loại tài sản']);
		expect(dropdown()?.querySelector('p')?.textContent?.trim()).toBe('Không tìm thấy kết quả');
	});

	it('F7: bộ lọc phòng ban gõ "thu chi" ra "Thu chi hộ"', async () => {
		await open(searchable(DEPARTMENTS, { searchPlaceholder: 'Tìm phòng ban' }));
		await type('thu chi');
		expect(optionLabels()).toEqual(['Tất cả phòng ban', 'Thu chi hộ']);
	});

	it('chưa gõ gì thì hiện đủ danh sách và không có dòng "Không tìm thấy"', async () => {
		await open(searchable());
		expect(optionLabels()).toHaveLength(CATEGORIES.length);
		expect(dropdown()?.textContent).not.toContain('Không tìm thấy');
	});
});

describe('UiSelect searchable — chọn và đóng', () => {
	it('F4: chọn một loại thì phát giá trị của loại đó và đóng danh sách', async () => {
		const wrapper = await open(searchable());
		await type('laptop');
		const option = Array.from(dropdown()?.querySelectorAll('button') ?? []).find(b =>
			b.textContent?.includes('Laptop'),
		);
		option?.click();
		await nextTick();
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([3]);
		expect(dropdown()).toBeNull();
	});

	it('F4: mở lại thì ô tìm trống', async () => {
		const wrapper = await open(searchable());
		await type('laptop');
		await press('Escape');
		expect(dropdown()).toBeNull();
		await wrapper.find('button').trigger('click');
		await nextTick();
		expect(searchBox()?.value).toBe('');
		expect(optionLabels()).toHaveLength(CATEGORIES.length);
	});

	it('F5: chọn "Tất cả loại tài sản" thì phát undefined để bỏ lọc', async () => {
		const wrapper = await open(searchable(CATEGORIES, { modelValue: 3 }));
		dropdown()?.querySelector('button')?.click();
		await nextTick();
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([undefined]);
	});

	it('F6: Esc đóng danh sách', async () => {
		await open(searchable());
		await press('Escape');
		expect(dropdown()).toBeNull();
	});

	it('F6: bấm ra ngoài thì đóng và xoá chữ đã gõ', async () => {
		const wrapper = await open(searchable());
		await type('ghe');
		const outside = document.createElement('div');
		document.body.appendChild(outside);
		outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
		await nextTick();
		expect(dropdown()).toBeNull();

		await wrapper.find('button').trigger('click');
		await nextTick();
		expect(searchBox()?.value).toBe('');
	});

	it('F6: Enter chọn kết quả khớp đầu tiên, không chọn lựa chọn bỏ lọc', async () => {
		const wrapper = await open(searchable());
		await type('ghe');
		await press('Enter');
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([1]);
		expect(dropdown()).toBeNull();
	});

	it('[EDGE] Enter khi chưa gõ gì thì không chọn gì cả', async () => {
		const wrapper = await open(searchable());
		await press('Enter');
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
		expect(dropdown()).not.toBeNull();
	});

	it('[EDGE] Enter khi không có kết quả nào thì không chọn gì cả', async () => {
		const wrapper = await open(searchable());
		await type('zzz');
		await press('Enter');
		expect(wrapper.emitted('update:modelValue')).toBeUndefined();
	});
});

describe('UiSelect mặc định — không có ô tìm', () => {
	it('F8: không khai `searchable` thì danh sách không có ô nhập và hiện đủ lựa chọn', async () => {
		await open({ modelValue: undefined, options: CATEGORIES });
		expect(dropdown()?.querySelector('input')).toBeNull();
		expect(optionLabels()).toHaveLength(CATEGORIES.length);
	});

	it('F8: chọn một dòng vẫn phát giá trị và đóng danh sách như cũ', async () => {
		const wrapper = await open({ modelValue: undefined, options: CATEGORIES });
		Array.from(dropdown()?.querySelectorAll('button') ?? [])[1]?.click();
		await nextTick();
		expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([1]);
		expect(dropdown()).toBeNull();
	});
});
