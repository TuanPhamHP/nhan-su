/**
 * Avatar người dùng dùng chung (`CommonAppAvatar`).
 *
 * Mọi chỗ hiện avatar một người đều đi qua thành phần này, nên đây là hợp đồng chung: có ảnh thì
 * hiện ảnh, chưa có ảnh hoặc ảnh lỗi thì hiện chữ cái đầu của hai từ cuối trong tên, không còn
 * logo app làm ảnh dự phòng.
 */
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';

import { personInitials } from '~/utils/avatar';
import AppAvatar from '~/components/common/AppAvatar.vue';

// Nuxt tự import `utils/`; trong vitest phải gắn tay.
vi.stubGlobal('personInitials', personInitials);

describe('personInitials', () => {
	it('lấy chữ đầu của hai từ cuối — tên gọi người Việt nằm ở cuối', () => {
		expect(personInitials('Đỗ Hồng Hạnh')).toBe('HH');
		expect(personInitials('Nguyễn Văn An')).toBe('VA');
	});

	it('tên một từ thì một chữ, khoảng trắng thừa không sinh chữ rỗng', () => {
		expect(personInitials('Quỳnh')).toBe('Q');
		expect(personInitials('  Lê   Công  Tú ')).toBe('CT');
	});

	it('giữ dấu tiếng Việt kể cả khi chuỗi gõ kiểu tổ hợp (NFD)', () => {
		expect(personInitials('Phạm Ánh'.normalize('NFD'))).toBe('PÁ');
		expect(personInitials('đinh ước')).toBe('ĐƯ');
	});

	it('không có tên thì trả chuỗi rỗng', () => {
		expect(personInitials('')).toBe('');
		expect(personInitials(null)).toBe('');
		expect(personInitials(undefined)).toBe('');
	});
});

describe('CommonAppAvatar', () => {
	it('có ảnh thì hiện ảnh, không hiện chữ cái', () => {
		const w = mount(AppAvatar, { props: { src: 'https://cdn.test/a.jpg', name: 'Đỗ Hồng Hạnh' } });
		expect(w.find('img').attributes('src')).toBe('https://cdn.test/a.jpg');
		expect(w.text()).toBe('');
	});

	it('chưa có ảnh thì hiện chữ cái trên nền accent, không còn logo app', () => {
		const w = mount(AppAvatar, { props: { src: null, name: 'Đỗ Hồng Hạnh' } });
		expect(w.find('img').exists()).toBe(false);
		expect(w.text()).toBe('HH');
		expect(w.attributes('style')).toContain('var(--color-accent)');
	});

	it('ảnh tải lỗi thì lùi về chữ cái', async () => {
		const w = mount(AppAvatar, { props: { src: 'https://cdn.test/expired.jpg', name: 'Vũ Quang Tiệp' } });
		await w.find('img').trigger('error');
		expect(w.find('img').exists()).toBe(false);
		expect(w.text()).toBe('QT');
	});

	it('đổi sang ảnh khác thì thử tải lại ảnh mới', async () => {
		const w = mount(AppAvatar, { props: { src: 'https://cdn.test/old.jpg', name: 'Lê Công Tú' } });
		await w.find('img').trigger('error');
		await w.setProps({ src: 'https://cdn.test/new.jpg' });
		expect(w.find('img').attributes('src')).toBe('https://cdn.test/new.jpg');
	});

	it('không tên, không ảnh thì hiện biểu tượng người', () => {
		const w = mount(AppAvatar, { props: { src: null, name: null } });
		expect(w.find('svg').exists()).toBe(true);
		expect(w.text()).toBe('');
	});

	it('cỡ chữ đi theo cỡ avatar', () => {
		expect(mount(AppAvatar, { props: { name: 'A B', size: 'xs' } }).classes()).toContain('w-6');
		expect(mount(AppAvatar, { props: { name: 'A B', size: 'sm' } }).classes()).toEqual(
			expect.arrayContaining(['w-8', 'text-xs']),
		);
	});

	it('bấm được để phóng to chỉ khi có ảnh thật', async () => {
		const withPhoto = mount(AppAvatar, { props: { src: 'https://cdn.test/a.jpg', name: 'A', clickable: true } });
		await withPhoto.trigger('click');
		expect(withPhoto.emitted('click')?.[0]).toEqual(['https://cdn.test/a.jpg']);

		const noPhoto = mount(AppAvatar, { props: { src: null, name: 'A', clickable: true } });
		expect(noPhoto.element.tagName).toBe('DIV');
	});
});
