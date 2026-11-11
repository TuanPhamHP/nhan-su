/**
 * ============================================================
 * Test suite: `UiSelectInput` tô sáng từ khoá mà không chạy HTML
 * ============================================================
 *
 * Vì sao cần: component này vẽ nhãn bằng `v-html` để chèn `<mark>` quanh đoạn khớp từ khoá.
 * Nhãn của nó là dữ liệu người dùng nhập — tên phòng ban, tên vị trí, tên nhân viên, tên nhà
 * cung cấp — nên một cái tên như `<img src=x onerror=...>` sẽ CHẠY trong trình duyệt của mọi
 * người khác mở cùng ô chọn đó. Component đang được dùng ở khoảng mười chỗ, nên lỗi này không
 * nằm trong một màn hình mà nằm trong cả ứng dụng.
 *
 * Nguy hiểm nhất là nó trông vô hại: tên có HTML vẫn hiện ra "đẹp", chỉ là đã chạy.
 *
 * Ký hiệu: [EDGE] trường hợp biên
 * ============================================================
 */

import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, onMounted, onUnmounted, nextTick } from 'vue';

Object.assign(globalThis, { onMounted, onUnmounted });

import SelectInput from '~/components/ui/SelectInput.vue';

const IconStub = defineComponent({ props: { name: String }, template: '<i />' });

const DANGEROUS = '<img src=x onerror="alert(1)">';

async function open(options: { label: string; value: string | number }[], query = '') {
	const wrapper = mount(SelectInput, {
		props: { modelValue: null, options },
		global: { stubs: { Icon: IconStub } },
	});
	// Mở danh sách rồi gõ từ khoá.
	await wrapper.find('[tabindex="0"]').trigger('click');
	await nextTick();
	if (query) {
		await wrapper.find('input').setValue(query);
		await nextTick();
	}
	return wrapper;
}

describe('nhãn chứa HTML', () => {
	it('không tạo thẻ thật khi chưa gõ gì', async () => {
		const w = await open([{ label: DANGEROUS, value: 1 }]);
		expect(w.find('img').exists()).toBe(false);
		expect(w.text()).toContain(DANGEROUS);
	});

	it('không tạo thẻ thật khi đang gõ tìm', async () => {
		const w = await open([{ label: DANGEROUS, value: 1 }], 'img');
		expect(w.find('img').exists()).toBe(false);
		// Vẫn tô sáng đúng đoạn khớp.
		expect(w.find('mark').text()).toBe('img');
		expect(w.text()).toContain(DANGEROUS);
	});

	it('`<b>x</b>` hiện ra dạng chữ, không in đậm', async () => {
		const w = await open([{ label: '<b>x</b> Phòng Kỹ thuật', value: 1 }], 'phòng');
		expect(w.find('b').exists()).toBe(false);
		expect(w.text()).toContain('<b>x</b> Phòng Kỹ thuật');
		expect(w.find('mark').text().toLowerCase()).toBe('phòng');
	});

	it('[EDGE] dấu &, dấu nháy giữ nguyên nghĩa chữ', async () => {
		const w = await open([{ label: `Phòng "R&D" của Tuấn's`, value: 1 }]);
		const span = w.find('span[class*="optionLabel"]');
		// `&` phải ở dạng thực thể trong HTML, nếu không thì `&D` có thể bị đọc thành thực thể khác.
		expect(span.html()).toContain('&amp;');
		// Dấu nháy thì trình duyệt in lại thành ký tự khi serialize text node, nên kiểm bằng
		// nội dung chữ: điều cần đảm bảo là chữ hiện ra đúng y nhãn gốc.
		expect(span.text()).toBe(`Phòng "R&D" của Tuấn's`);
	});

	it('[EDGE] gõ "&" không chèn <mark> vào giữa một thực thể HTML', async () => {
		// Nếu escape cả nhãn TRƯỚC rồi mới dò từ khoá thì "&" khớp vào chữ & của `&amp;`
		// và sinh ra `<mark>&</mark>amp;` — chữ hiện ra sẽ sai.
		const w = await open([{ label: 'R&D', value: 1 }], '&');
		expect(w.find('mark').text()).toBe('&');
		expect(w.text()).toContain('R&D');
	});

	it('[EDGE] từ khoá chứa ký tự regex không làm hỏng việc tô sáng', async () => {
		const w = await open([{ label: 'Phòng (mới) *đặc biệt*', value: 1 }], '(mới)');
		expect(w.find('mark').text()).toBe('(mới)');
	});
});

describe('tìm kiếm vẫn hoạt động như cũ', () => {
	const options = [
		{ label: 'Phòng Kỹ thuật', value: 1 },
		{ label: 'Phòng Kinh doanh', value: 2 },
		{ label: 'Ban giám đốc', value: 3 },
	];

	it('lọc theo chuỗi con, không phân biệt chữ hoa', async () => {
		const w = await open(options, 'kinh');
		const labels = w.findAll('span[class*="optionLabel"]').map(s => s.text());
		expect(labels).toEqual(['Phòng Kinh doanh']);
	});

	it('không khớp gì thì hiện "Không tìm thấy kết quả"', async () => {
		const w = await open(options, 'không có thật');
		expect(w.text()).toContain('Không tìm thấy kết quả');
	});

	it('chọn một dòng thì phát ra value của dòng đó', async () => {
		const w = await open(options, 'giám');
		await w.findAll('div[class*="option"]').at(-1)!.trigger('click');
		expect(w.emitted('update:modelValue')?.[0]).toEqual([3]);
	});
});
