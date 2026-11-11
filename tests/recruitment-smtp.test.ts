/**
 * ============================================================
 * Test suite: form SMTP công ty của module Tuyển dụng
 * ============================================================
 *
 * Vì sao cần: backend vá bảo mật ngày 11/11/2026 đặt hai luật mà form phải chặn TRƯỚC khi
 * gọi API, và cả hai đều thuộc loại "sai thì không ai thấy ngay":
 *
 *   1. Đổi `host`, `port`, `security` hoặc `username` thì phải nhập lại mật khẩu. Nếu form
 *      quên bắt, mật khẩu hộp thư công ty đang lưu bị gửi sang một máy chủ do người dùng vừa
 *      gõ vào. Backend trả 400, nhưng lúc đó người dùng đã bấm Lưu và không hiểu vì sao hỏng.
 *   2. Cổng chỉ được là 25, 465, 587 hoặc 2525. Gõ tự do thì form thành công cụ dò cổng.
 *
 * Bấm tay trên giao diện chỉ phủ được cấu hình đang có sẵn trên máy chủ thử nghiệm; các tổ
 * hợp "chưa cấu hình", "cổng cũ ngoài danh sách" phải dựng bằng dữ liệu nên kiểm ở đây.
 *
 * Ký hiệu: [EDGE] trường hợp biên
 * ============================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, onMounted, nextTick } from 'vue';

Object.assign(globalThis, {
	onMounted,
	useToast: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() }),
});

const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('~/services/http/auth.fetch', () => ({
	useAuthFetch: () => mockFetch,
	setOnForceLogout: vi.fn(),
}));

import RecruitSettingsSmtp from '~/components/modules/recruitment/RecruitSettingsSmtp.vue';
import type { RecruitmentSmtp } from '~/types/recruitment.types';

/** Ô chọn giả, giữ lại `options` để đếm và cho phép chọn giá trị khác. */
const UiSelectStub = defineComponent({
	props: { modelValue: { type: [String, Number], default: undefined }, options: { type: Array, default: () => [] } },
	emits: ['update:modelValue'],
	template: `<div class="ui-select-stub">
		<button
			v-for="o in options"
			:key="String(o.value)"
			type="button"
			class="opt"
			:data-value="String(o.value)"
			@click="$emit('update:modelValue', o.value)"
		>{{ o.label }}</button>
	</div>`,
});

const AppButtonStub = defineComponent({
	template: '<button type="button"><slot /></button>',
});

const SAVED: RecruitmentSmtp = {
	configured: true,
	secretKeyConfigured: true,
	host: 'smtp.gmail.com',
	port: 587,
	security: 'STARTTLS',
	securityLabel: 'STARTTLS',
	username: 'hr@congty.vn',
	hasPassword: true,
	fromName: 'Phòng Nhân sự',
	fromEmail: 'hr@congty.vn',
	replyTo: null,
	testStatus: 'SUCCESS',
	testStatusLabel: 'Gửi thử thành công',
	testedAt: '2026-11-10T08:05:00.000Z',
	testError: null,
	updatedById: 1,
	updatedAt: '2026-11-10T08:05:00.000Z',
};

const EMPTY: RecruitmentSmtp = {
	configured: false,
	secretKeyConfigured: true,
	host: null,
	port: null,
	security: null,
	securityLabel: null,
	username: null,
	hasPassword: false,
	fromName: null,
	fromEmail: null,
	replyTo: null,
	testStatus: null,
	testStatusLabel: null,
	testedAt: null,
	testError: null,
	updatedById: null,
	updatedAt: null,
};

async function mountForm(initial: RecruitmentSmtp) {
	mockFetch.mockReset();
	mockFetch.mockResolvedValue({ success: true, data: initial });
	const wrapper = mount(RecruitSettingsSmtp, {
		props: { canManage: true },
		global: {
			stubs: { UiSelect: UiSelectStub, CommonAppButton: AppButtonStub },
		},
	});
	// `load()` chạy trong onMounted; chờ promise rồi chờ render.
	await nextTick();
	await nextTick();
	await nextTick();
	return wrapper;
}

/** Ô nhập theo thứ tự trong form: máy chủ, tài khoản, mật khẩu, tên người gửi, email… */
function field(wrapper: ReturnType<typeof mount>, selector: string) {
	return wrapper.find(selector);
}

function putCalls() {
	return mockFetch.mock.calls.filter(c => (c[1] as { method?: string })?.method === 'PUT');
}

async function clickSave(wrapper: ReturnType<typeof mount>) {
	const save = wrapper.findAll('button').find(b => b.text() === 'Lưu cấu hình');
	expect(save, 'phải tìm thấy nút Lưu cấu hình').toBeTruthy();
	await save!.trigger('click');
	await nextTick();
	await nextTick();
}

beforeEach(() => {
	mockFetch.mockReset();
});

describe('Scenario 1: lần đầu cấu hình, không nhập mật khẩu', () => {
	it('form chặn và KHÔNG gọi API', async () => {
		const w = await mountForm(EMPTY);
		await field(w, 'input[type="text"]').setValue('smtp.gmail.com');
		const texts = w.findAll('input[type="text"]');
		await texts[1]!.setValue('hr@congty.vn'); // tài khoản
		await texts[2]!.setValue('Phòng Nhân sự'); // tên người gửi
		await field(w, 'input[type="email"]').setValue('hr@congty.vn');

		await clickSave(w);

		expect(putCalls()).toHaveLength(0);
		expect(w.text()).toContain('Lần đầu cấu hình phải nhập mật khẩu');
	});

	it('ô mật khẩu có dấu bắt buộc và KHÔNG có placeholder "giữ mật khẩu cũ"', async () => {
		const w = await mountForm(EMPTY);
		expect(field(w, 'input[type="password"]').attributes('placeholder')).toBe('');
		// Dấu * nằm trong nhãn ngay trên ô mật khẩu.
		const labels = w.findAll('label').map(l => l.text());
		expect(labels.some(l => l.startsWith('Mật khẩu') && l.includes('*'))).toBe(true);
	});
});

describe('Scenario 2: chỉ đổi tên hiển thị, bỏ trống mật khẩu', () => {
	it('lưu được, và body gửi lên không có password', async () => {
		const w = await mountForm(SAVED);
		const texts = w.findAll('input[type="text"]');
		await texts[2]!.setValue('Phòng Tuyển dụng'); // tên người gửi
		await nextTick();

		expect(field(w, 'input[type="password"]').attributes('placeholder')).toBe(
			'Để trống nếu giữ mật khẩu cũ',
		);

		await clickSave(w);

		const calls = putCalls();
		expect(calls).toHaveLength(1);
		const body = (calls[0]![1] as { body: Record<string, unknown> }).body;
		expect(body.fromName).toBe('Phòng Tuyển dụng');
		expect(body.password).toBeUndefined();
	});
});

describe('Scenario 3: đổi chỗ sẽ gửi tới mà bỏ trống mật khẩu', () => {
	it.each([
		['máy chủ', async (w: ReturnType<typeof mount>) => w.findAll('input[type="text"]')[0]!.setValue('smtp.office365.com')],
		['tài khoản', async (w: ReturnType<typeof mount>) => w.findAll('input[type="text"]')[1]!.setValue('tuyendung@congty.vn')],
		['cổng', async (w: ReturnType<typeof mount>) => w.findAll('.ui-select-stub')[0]!.findAll('.opt')[1]!.trigger('click')],
	])('đổi %s → chặn trước khi gọi API, ô mật khẩu có dấu *', async (_what, change) => {
		const w = await mountForm(SAVED);
		await change(w);
		await nextTick();

		const labels = w.findAll('label').map(l => l.text());
		expect(labels.some(l => l.startsWith('Mật khẩu') && l.includes('*'))).toBe(true);
		expect(field(w, 'input[type="password"]').attributes('placeholder')).toBe('');
		expect(w.text()).toContain('nên phải nhập lại mật khẩu');

		await clickSave(w);
		expect(putCalls()).toHaveLength(0);
	});

	it('nhập mật khẩu kèm theo thì lưu được (scenario 4, phần không cần máy chủ thật)', async () => {
		const w = await mountForm(SAVED);
		await w.findAll('input[type="text"]')[0]!.setValue('smtp.office365.com');
		await field(w, 'input[type="password"]').setValue('mat-khau-moi');
		await clickSave(w);

		const calls = putCalls();
		expect(calls).toHaveLength(1);
		const body = (calls[0]![1] as { body: Record<string, unknown> }).body;
		expect(body.host).toBe('smtp.office365.com');
		expect(body.password).toBe('mat-khau-moi');
	});
});

describe('Scenario 6: ô cổng chỉ cho chọn cổng được phép', () => {
	it('đúng bốn lựa chọn 25, 465, 587, 2525', async () => {
		const w = await mountForm(SAVED);
		const opts = w.findAll('.ui-select-stub')[0]!.findAll('.opt');
		expect(opts.map(o => o.attributes('data-value'))).toEqual(['25', '465', '587', '2525']);
	});

	it('[EDGE] cổng cũ ngoài danh sách vẫn hiện được, nhưng chặn lưu tới khi chọn lại', async () => {
		const w = await mountForm({ ...SAVED, port: 1025 });
		const select = w.findAll('.ui-select-stub')[0]!;
		expect(select.findAll('.opt').map(o => o.attributes('data-value'))).toEqual([
			'1025',
			'25',
			'465',
			'587',
			'2525',
		]);
		expect(select.text()).toContain('không còn được phép');

		await clickSave(w);
		expect(putCalls()).toHaveLength(0);
		expect(w.text()).toContain('Cổng chỉ nhận 25, 465, 587, 2525');

		// Chọn lại một cổng hợp lệ: vì cổng vừa đổi nên mật khẩu thành bắt buộc.
		await select.findAll('.opt')[3]!.trigger('click'); // 587
		await field(w, 'input[type="password"]').setValue('mat-khau-moi');
		await clickSave(w);

		const calls = putCalls();
		expect(calls).toHaveLength(1);
		expect((calls[0]![1] as { body: Record<string, unknown> }).body.port).toBe(587);
	});
});

describe('Gợi ý dưới ô máy chủ', () => {
	it('nói rõ phải là máy chủ trên Internet', async () => {
		const w = await mountForm(SAVED);
		expect(w.text()).toContain('Máy chủ SMTP trên Internet, ví dụ smtp.gmail.com');
	});
});
