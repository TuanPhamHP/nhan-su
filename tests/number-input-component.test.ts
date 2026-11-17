/**
 * `UiNumberInput` ở mức thành phần.
 *
 * Mười ba ô số của module Tài sản và module Phê duyệt dùng chung thành phần này, nên những hành
 * vi dưới đây là hợp đồng mà mọi ô đó dựa vào: gõ ra chữ đã nhóm nghìn nhưng `v-model` vẫn là số
 * JSON, ô trống là `undefined` chứ không phải `0`, phím dấu chấm thành dấu thập phân khi ô có số
 * lẻ, và dán chuỗi từ Excel đọc đúng.
 */
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';

import UiNumberInput from '~/components/ui/NumberInput.vue';

/** Gõ bằng cách đặt giá trị rồi phát `input`, giống hành vi thật của ô chữ. */
async function type(wrapper: ReturnType<typeof mount>, value: string) {
	const input = wrapper.find('input');
	(input.element as HTMLInputElement).value = value;
	await input.trigger('input');
}

function lastValue(wrapper: ReturnType<typeof mount>): unknown {
	const events = wrapper.emitted('update:modelValue');
	return events?.at(-1)?.[0];
}

function shown(wrapper: ReturnType<typeof mount>): string {
	return (wrapper.find('input').element as HTMLInputElement).value;
}

describe('UiNumberInput', () => {
	it('gõ 80000 thì hiện 80.000 còn giá trị gửi đi là số 80000', async () => {
		const wrapper = mount(UiNumberInput, { props: { modelValue: undefined, decimals: 0 } });
		await type(wrapper, '80000');
		expect(shown(wrapper)).toBe('80.000');
		expect(lastValue(wrapper)).toBe(80000);
	});

	it('ô tiền hai số lẻ: gõ 1234,59 ra 1.234,59 và giá trị 1234.59', async () => {
		const wrapper = mount(UiNumberInput, { props: { modelValue: undefined, decimals: 2 } });
		await type(wrapper, '1234,59');
		expect(shown(wrapper)).toBe('1.234,59');
		expect(lastValue(wrapper)).toBe(1234.59);
	});

	it('ô tiền cắt phần lẻ dài quá hai chữ số', async () => {
		const wrapper = mount(UiNumberInput, { props: { modelValue: undefined, decimals: 2 } });
		await type(wrapper, '1,2345');
		expect(shown(wrapper)).toBe('1,23');
		expect(lastValue(wrapper)).toBe(1.23);
	});

	it('ô tỷ giá bốn số lẻ giữ đủ bốn chữ số', async () => {
		const wrapper = mount(UiNumberInput, { props: { modelValue: undefined, decimals: 4 } });
		await type(wrapper, '23,4567');
		expect(lastValue(wrapper)).toBe(23.4567);
	});

	it('phím dấu chấm thành dấu thập phân khi ô có số lẻ', async () => {
		const wrapper = mount(UiNumberInput, { props: { modelValue: undefined, decimals: 2 }, attachTo: document.body });
		const input = wrapper.find('input');
		(input.element as HTMLInputElement).value = '1234';
		await input.trigger('input');
		await input.trigger('keydown', { key: '.' });
		expect(shown(wrapper)).toBe('1.234,');
		(input.element as HTMLInputElement).value = '1.234,5';
		await input.trigger('input');
		expect(lastValue(wrapper)).toBe(1234.5);
		wrapper.unmount();
	});

	it('ô số nguyên không nhận dấu phẩy lẫn dấu chấm', async () => {
		const wrapper = mount(UiNumberInput, { props: { modelValue: undefined, decimals: 0 }, attachTo: document.body });
		const input = wrapper.find('input');
		(input.element as HTMLInputElement).value = '12';
		await input.trigger('input');
		await input.trigger('keydown', { key: ',' });
		await input.trigger('keydown', { key: '.' });
		// Hai phím đó bị chặn nên chữ trong ô không đổi và giá trị vẫn là số nguyên.
		expect(shown(wrapper)).toBe('12');
		expect(lastValue(wrapper)).toBe(12);
		wrapper.unmount();
	});

	it('chữ cái không vào ô', async () => {
		const wrapper = mount(UiNumberInput, { props: { modelValue: undefined, decimals: 0 } });
		await type(wrapper, '12a3');
		expect(shown(wrapper)).toBe('123');
	});

	it('xoá hết thì giá trị về undefined, không phải 0', async () => {
		const wrapper = mount(UiNumberInput, { props: { modelValue: 1500, decimals: 0 } });
		expect(shown(wrapper)).toBe('1.500');
		await type(wrapper, '');
		expect(lastValue(wrapper)).toBeUndefined();
		expect(shown(wrapper)).toBe('');
	});

	it('nạp giá trị có sẵn thì hiện đúng kiểu Việt Nam', async () => {
		const wrapper = mount(UiNumberInput, { props: { modelValue: 18500000.5, decimals: 2 } });
		expect(shown(wrapper)).toBe('18.500.000,5');
		await wrapper.setProps({ modelValue: 108000000 });
		expect(shown(wrapper)).toBe('108.000.000');
	});

	it('dán chuỗi từ bảng tính đọc đúng ba kiểu viết', async () => {
		const wrapper = mount(UiNumberInput, { props: { modelValue: undefined, decimals: 2 }, attachTo: document.body });
		const input = wrapper.find('input');

		for (const [pasted, text, value] of [
			['1.234.567,89', '1.234.567,89', 1234567.89],
			['1234567.89', '1.234.567,89', 1234567.89],
			['1.234', '1.234', 1234],
		] as const) {
			await input.trigger('paste', {
				clipboardData: { getData: () => pasted },
			});
			expect(shown(wrapper)).toBe(text);
			expect(lastValue(wrapper)).toBe(value);
		}
		wrapper.unmount();
	});

	it('rời ô thì chuẩn hoá chữ đang gõ dở', async () => {
		const wrapper = mount(UiNumberInput, { props: { modelValue: undefined, decimals: 2 } });
		await type(wrapper, '1234,');
		expect(shown(wrapper)).toBe('1.234,');
		await wrapper.find('input').trigger('blur');
		expect(shown(wrapper)).toBe('1.234');
		expect(lastValue(wrapper)).toBe(1234);
	});

	it('ô là type text với bàn phím số, không phải input number', () => {
		const integer = mount(UiNumberInput, { props: { modelValue: undefined, decimals: 0 } });
		expect(integer.find('input').attributes('type')).toBe('text');
		expect(integer.find('input').attributes('inputmode')).toBe('numeric');

		const money = mount(UiNumberInput, { props: { modelValue: undefined, decimals: 2 } });
		expect(money.find('input').attributes('inputmode')).toBe('decimal');
	});

	it('nhận thuộc tính và trình xử lý sự kiện truyền từ ngoài vào, đặt lên đúng thẻ input', () => {
		const wrapper = mount(UiNumberInput, {
			props: { modelValue: undefined, decimals: 0 },
			attrs: { name: 'cost', 'data-test': 'cost' },
		});
		const input = wrapper.find('input');
		expect(input.attributes('name')).toBe('cost');
		expect(input.attributes('data-test')).toBe('cost');
		// Thẻ bọc ngoài không được nhận các thuộc tính đó.
		expect(wrapper.element.getAttribute('name')).toBeNull();
	});
});
