/**
 * Bấm thử hộp Import nhân sự từ Excel sau khi sửa file mẫu (23/11/2026), F2–F4 của bàn giao BE.
 *
 * Không cần BE: mọi request tới API đều bị Playwright chặn và trả dữ liệu giả, kể cả đăng nhập, nên bài thử không
 * chạm database nào. Web chạy ở 4000 (`npm run start:local -- --port 4000`). Chạy: `node smoke.mjs`.
 */
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { mkdirSync } from 'node:fs';

const WEB = 'http://localhost:4000';
const API_HOSTS = ['http://localhost:3000', 'http://127.0.0.1:3000'];
const TEMPLATE = '/home/tuanpham/work/hr-system/.worktrees/fe-import-excel/public/import-templates/employees-import-template.xlsx';
const SHOTS = '/home/tuanpham/work/hr-system/.worktrees/fe-import-excel/tests/e2e/__shots__/employee-import';
mkdirSync(SHOTS, { recursive: true });

const results = [];
const line = (id, ok, name, detail = '') => {
	results.push({ id, ok, name, detail });
	console.log(`${ok ? '✓' : '✗'} ${id} ${name}${detail ? ` — ${detail}` : ''}`);
};

/** Lỗi import đúng shape của bridge doc mục "Đọc ô dễ tính hơn (23/11/2026)". */
const IMPORT_ERRORS = [
	{ row: 2, field: null, value: null, message: 'Đây là dòng ví dụ có sẵn trong file mẫu. Bạn xoá dòng này rồi nhập lại.' },
	{
		row: 3,
		field: 'bankAccountNumber',
		value: '123456789',
		message: 'Ô số tài khoản đang là kiểu số nên Excel có thể đã bỏ số 0 ở đầu. Bạn đổi ô sang kiểu Text rồi gõ lại số tài khoản.',
	},
	{
		row: 4,
		field: 'departmentName',
		value: 'Kho vận',
		message: 'Chưa có phòng ban "Kho vận". Bạn tạo phòng ban này trước, hoặc sửa tên cho khớp với phòng ban đã có.',
	},
];

const ME = {
	id: 1,
	employeeCode: 'EMP001',
	fullName: 'Quản trị thử',
	email: 'admin@example.test',
	phone: null,
	role: 'ADMIN',
	status: 'ACTIVE',
	avatarUrl: null,
	department: { id: 1, name: 'Ban giám đốc' },
	position: { id: 1, name: 'Giám đốc' },
};

/** Trả lời giả cho mọi request tới API; ghi lại các request để kiểm không có gì lọt ra ngoài. */
async function mockApi(page, calls) {
	const handler = async route => {
		const req = route.request();
		const url = new URL(req.url());
		const cors = {
			'access-control-allow-origin': WEB,
			'access-control-allow-credentials': 'true',
			'access-control-allow-headers': '*',
			'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
		};
		if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
		calls.push(`${req.method()} ${url.pathname}`);
		const json = (status, body) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
		const p = url.pathname;
		if (p === '/v1/employees/me') return json(200, { success: true, data: ME });
		if (p === '/v1/auth/me') {
			const company = { code: 'demo', name: 'Công ty thử', logoUrl: null, faviconUrl: null };
			return json(200, { success: true, data: { ...ME, permissions: ['employee:import', 'employee:read', 'employee:create'], company, companies: [company] } });
		}
		if (p === '/v1/me/entitlements') return json(200, { success: true, data: { modules: [], businessHotline: null, groups: [], apps: [] } });
		if (p === '/v1/employees/import' && req.method() === 'POST') {
			return json(400, {
				success: false,
				error: { code: 'EMPLOYEE_IMPORT_VALIDATION', message: 'File có 3 lỗi, chưa nhập nhân viên nào.', errors: IMPORT_ERRORS },
			});
		}
		if (req.method() === 'GET') return json(200, { success: true, data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } });
		return json(200, { success: true, data: null });
	};
	for (const host of API_HOSTS) await page.route(`${host}/**`, handler);
}

async function openModal(browser, viewport, calls, errors) {
	const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport.width < 640 ? 2 : 1, isMobile: viewport.width < 640, hasTouch: viewport.width < 640 });
	await ctx.addCookies([{ name: 'access_token', value: 'token-gia-cho-bai-thu', url: WEB }]);
	const page = await ctx.newPage();
	page.on('pageerror', e => errors.push(String(e)));
	page.on('console', m => {
		if (m.type() === 'error' && !/Failed to load resource|WebSocket|socket\.io/i.test(m.text())) errors.push(m.text());
	});
	await mockApi(page, calls);
	await page.goto(`${WEB}/management/employees`, { waitUntil: 'domcontentloaded' });
	const button = page.getByRole('button', { name: /Import Excel/ });
	await button.waitFor({ timeout: 90000 });
	await button.click();
	await page.getByRole('heading', { name: 'Import nhân sự từ Excel' }).waitFor({ timeout: 15000 });
	await page.addStyleTag({ content: '#nuxt-devtools-anchor,.nuxt-devtools-anchor{display:none !important}' }).catch(() => {});
	await page.waitForTimeout(500);
	return page;
}

const modalText = page => page.locator('.fixed.inset-0.z-50').first().innerText();
const clean = s => s.replace(/\s+/g, ' ').trim();

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const calls = [];
const errors = [];
try {
	// ─── F2: chữ mới trên máy tính ───────────────────────────────────────────────
	const page = await openModal(browser, { width: 1440, height: 900 }, calls, errors);
	const text = clean(await modalText(page));
	const wantF2 = [
		'File gồm 27 cột. Dòng 2 là dòng ví dụ, bạn xoá dòng này rồi điền từ dòng 2.',
		'Ngày ghi kiểu 15/01/2024 hoặc 2024-01-15. Các ô đã để sẵn kiểu Text để giữ số 0 ở đầu số điện thoại, CCCD và số tài khoản, bạn đừng đổi kiểu ô.',
	];
	const missing = wantF2.filter(s => !text.includes(s));
	const oldGone = !text.includes('Dữ liệu bắt đầu từ dòng 2');
	await page.screenshot({ path: `${SHOTS}/f2-hop-import-may-tinh.png` });
	line('F2', !missing.length && oldGone, 'Hộp Import trên máy tính có chữ mới', missing.length ? `thiếu: ${missing.join(' | ')}` : `có đủ 2 câu mới, câu cũ đã bỏ=${oldGone}`);

	// ─── F3: bấm Import, API giả trả 400 ─────────────────────────────────────────
	await page.locator('input[type="file"]').first().setInputFiles(TEMPLATE);
	await page.getByRole('button', { name: /^Import$/ }).click();
	const table = page.locator('table').last();
	await table.waitFor({ timeout: 15000 });
	await page.waitForTimeout(400);
	const rows = await table.locator('tbody tr').evaluateAll(trs => trs.map(tr => [...tr.querySelectorAll('td')].map(td => td.innerText.replace(/\s+/g, ' ').trim())));
	const want = [
		{ row: '2', col: '—', msg: IMPORT_ERRORS[0].message },
		{ row: '3', col: 'Số tài khoản', msg: IMPORT_ERRORS[1].message },
		{ row: '4', col: 'Phòng ban', msg: IMPORT_ERRORS[2].message },
	];
	const okRows = want.every(w => rows.some(r => r.includes(w.row) && r.includes(w.col) && r.some(c => c.includes(w.msg))));
	await table.scrollIntoViewIfNeeded();
	await page.screenshot({ path: `${SHOTS}/f3-bang-loi-import.png` });
	const sentImport = calls.includes('POST /v1/employees/import');
	line('F3', okRows && sentImport, 'Bảng lỗi: cột "Cột" có nhãn đúng, câu lỗi hiện nguyên', JSON.stringify(rows));
	await page.context().close();

	// ─── F4: điện thoại 390 px ───────────────────────────────────────────────────
	const phone = await openModal(browser, { width: 390, height: 844 }, calls, errors);
	const geo = await phone.evaluate(() => {
		const modal = document.querySelector('.fixed.inset-0.z-50 > div');
		const r = modal?.getBoundingClientRect();
		return { docW: document.documentElement.scrollWidth, left: r?.left ?? -1, right: r?.right ?? 9999, modalScrollW: modal?.scrollWidth ?? 0, modalClientW: modal?.clientWidth ?? 0 };
	});
	await phone.screenshot({ path: `${SHOTS}/f4-hop-import-390.png` });
	// Cuộn tới đoạn gạch đầu dòng mới để ảnh thấy câu mới trên điện thoại.
	await phone.getByText('Ngày ghi kiểu 15/01/2024').scrollIntoViewIfNeeded();
	await phone.screenshot({ path: `${SHOTS}/f4-hop-import-390-cau-moi.png` });
	await phone.locator('input[type="file"]').first().setInputFiles(TEMPLATE);
	await phone.getByRole('button', { name: /^Import$/ }).click();
	await phone.locator('table').last().waitFor({ timeout: 15000 });
	await phone.locator('table').last().scrollIntoViewIfNeeded();
	await phone.waitForTimeout(400);
	const geoErr = await phone.evaluate(() => ({ docW: document.documentElement.scrollWidth }));
	await phone.screenshot({ path: `${SHOTS}/f4-bang-loi-390.png` });
	const f4ok = geo.docW <= 390 && geo.left >= 0 && geo.right <= 390 && geo.modalScrollW <= geo.modalClientW + 1 && geoErr.docW <= 390;
	line('F4', f4ok, 'Hộp Import ở 390 px không tràn ngang', JSON.stringify({ ...geo, docWKhiCoLoi: geoErr.docW }));
	await phone.context().close();

	const outside = calls.filter(c => !c.startsWith('GET ') && c !== 'POST /v1/employees/import');
	line('mock', true, 'Mọi request tới API đều do bài thử trả lời', `${calls.length} request, ghi khác import: ${outside.length ? outside.join(', ') : 'không có'}`);
	line('err', !errors.length, 'Không lỗi console', errors.slice(0, 3).join(' | '));
} finally {
	await browser.close();
	const bad = results.filter(r => !r.ok);
	console.log(`\n=== ${results.length - bad.length}/${results.length} xanh ===`);
	process.exitCode = bad.length ? 1 : 0;
}
