/**
 * F10 — mã nhân viên theo công ty: FE hiện mã máy chủ cấp, không tự đoán.
 *
 *   SMOKE_PASSWORD='<mật khẩu sandbox>' node tests/e2e/company-branding/smoke-employee-code.mjs
 *
 * Bài này TẠO một nhân viên thật trên sandbox nên tách khỏi `smoke-branding.mjs`: chạy lại bộ
 * kia bao nhiêu lần cũng không thêm ai, còn bài này mỗi lần chạy là thêm một người.
 */
import { API, PASSWORD, WHO, clean, go, launch, line, shot, signIn, summary, titleWhenReady } from './helper.mjs';

/** Mã nhân viên công ty đang dùng, đọc thẳng từ API để không ghi cứng "STH" vào bài kiểm. */
async function apiEmployees() {
	const login = await fetch(`${API}/v1/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ identifier: WHO.hr.email, password: PASSWORD }),
	});
	const token = (await login.json()).data.accessToken;
	const res = await fetch(`${API}/v1/employees?limit=50`, { headers: { Authorization: `Bearer ${token}` } });
	return { token, list: (await res.json()).data ?? [] };
}

const before = await apiEmployees();
const codes = before.list.map(e => e.employeeCode);
const prefix = codes.find(c => /^[A-Z]+-\d+$/.test(c))?.split('-')[0];
if (!prefix) {
	console.error('Công ty trên sandbox chưa đặt mã nhân viên, không chạy được F10. Mã đang có:', codes);
	process.exit(2);
}
console.log(`Mã nhân viên của công ty: ${prefix}; đang có ${codes.length} người: ${codes.join(', ')}`);

const stamp = Date.now();
const NEW_NAME = `Nhân viên thử mã ${stamp}`;
const NEW_EMAIL = `ma-nv-${stamp}@ctya.drill`;

const browser = await launch();
const page = await signIn(browser, WHO.hr.email);

// ── Tạo nhân viên: biểu mẫu KHÔNG có ô mã nhân viên, mã do máy chủ cấp ──
await go(page, '/management/employees/new', 4000);
line(
	(await page.locator('input[placeholder="Nhập họ và tên"]').count()) === 1,
	'F10 mở được biểu mẫu thêm nhân viên',
);
const codeFields = await page.getByText(/Mã nhân viên/i).count();
line(codeFields === 0, 'F10 biểu mẫu không có ô nhập mã nhân viên, FE không tự đặt mã', `thấy ${codeFields} chỗ`);

await page.locator('input[placeholder="Nhập họ và tên"]').fill(NEW_NAME);
await page.locator('input[type="email"]').first().fill(NEW_EMAIL);
// Ngày vào làm: ô chữ của UiDatePicker nhận dd/mm/yyyy.
await page.locator('input[placeholder="dd/mm/yyyy"]').first().fill('01/11/2026');
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// Vai trò là ô chọn tự vẽ (UiSelect): bấm nút mở rồi bấm đúng dòng, không phải `<select>` trần.
// Nút không có id đoán được nên lần theo nhãn "Vai trò" đứng ngay trước nó.
const roleTrigger = page.locator('xpath=//label[contains(., "Vai trò")]/following-sibling::div[1]//button[1]');
await roleTrigger.first().click();
await page.waitForTimeout(600);
await page.getByRole('button', { name: 'Nhân viên', exact: true }).first().click();
await page.waitForTimeout(500);

await page.getByRole('button', { name: 'Tạo nhân viên' }).first().click();
// Tạo xong thì app đẩy sang trang chi tiết `/management/employees/:id`.
await page.waitForURL(/\/management\/employees\/\d+$/, { timeout: 40000 });
await page.waitForTimeout(3000);

const id = Number(new URL(page.url()).pathname.split('/').pop());
line(Number.isInteger(id) && id > 0, 'F10 tạo xong và sang trang chi tiết', page.url());

// ── Mã máy chủ cấp là mã nào ──
const after = await fetch(`${API}/v1/employees/${id}`, {
	headers: { Authorization: `Bearer ${before.token}` },
});
const served = (await after.json()).data ?? {};
line(
	new RegExp(`^${prefix}-\\d{4}$`).test(served.employeeCode ?? ''),
	`F10 máy chủ cấp mã dạng ${prefix}-000N`,
	`employeeCode = ${served.employeeCode}`,
);
line(!codes.includes(served.employeeCode), 'F10 mã mới chưa từng có', served.employeeCode);

// ── Trang chi tiết hiện đúng mã đó ──
const detail = clean(await page.locator('body').innerText());
line(detail.includes(served.employeeCode), 'F10 trang chi tiết hiện đúng mã máy chủ trả', served.employeeCode);
line((await titleWhenReady(page)).includes('Chi tiết nhân viên'), 'F10 tiêu đề trang chi tiết', await titleWhenReady(page));
await shot(page, 'F10-chi-tiet-ma-nhan-vien');

// ── Danh sách cũng hiện đúng mã đó ──
await go(page, '/management/employees', 4000);
await page.locator('input[placeholder*="Tìm theo tên"]').first().fill(NEW_NAME);
await page.waitForTimeout(3000);
const list = clean(await page.locator('body').innerText());
line(list.includes(served.employeeCode), 'F10 danh sách hiện đúng mã máy chủ trả', served.employeeCode);
line(list.includes(NEW_NAME), 'F10 danh sách tìm thấy người vừa tạo', NEW_NAME);
await shot(page, 'F10-danh-sach-ma-nhan-vien');

line(page.errors.length === 0, 'F10 không lỗi JS', page.errors.slice(0, 3).join(' | '));
const net = [...new Set(page.netFails)];
if (net.length) console.log(`  ⓘ F10: ${net.length} request trả mã lỗi → ${net.join(' | ')}`);

console.log(`\nĐã tạo trên sandbox: ${NEW_NAME} <${NEW_EMAIL}> → ${served.employeeCode} (id ${id})`);
await browser.close();
process.exit(summary() === 0 ? 0 : 1);
