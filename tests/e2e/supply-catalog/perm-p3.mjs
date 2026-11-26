/**
 * Kiểm quyền trang Chi tiết kỳ (P3) trên sandbox: admin (có `office:supply:manage`) và trưởng phòng Đỗ Hồng Hạnh
 * (MANAGER mặc định, chỉ có `office:supply:report`). Giao diện chỉ đọc; sau đó gọi thẳng các API ghi của trang
 * bằng token trưởng phòng, mong 403. Không ghi gì nếu backend chặn đúng.
 *
 *   node tests/e2e/supply-catalog/perm-p3.mjs <thư mục ảnh>
 */
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const WEB = 'http://127.0.0.1:4999';
const ACC = JSON.parse(readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/p1-accounts.json', 'utf8'));
const PASSWORD = /const PASSWORD\s*=\s*['"`]([^'"`]+)['"`]/.exec(
	readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/drill-p1.cjs', 'utf8'),
)[1];
const SHOTS = process.argv[2] ?? '/tmp/supply-perm-p3';
mkdirSync(SHOTS, { recursive: true });

const results = [];
function check(id, ok, name, detail = '') {
	results.push({ id, ok: !!ok, name, detail });
	console.log(`${ok ? '✓' : '✗'} ${id} ${name}${detail ? ` — ${detail}` : ''}`);
}

async function token(email) {
	const res = await fetch(`${ACC.api}/auth/login`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ identifier: email, password: PASSWORD }),
	});
	return (await res.json()).data.accessToken;
}
async function call(tok, method, url, body) {
	const res = await fetch(`${ACC.api}${url}`, {
		method,
		headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	});
	let json = null;
	try {
		json = await res.json();
	} catch {
		/* file hoặc rỗng */
	}
	return { status: res.status, code: json?.error?.code ?? '' };
}

async function signIn(browser, email) {
	const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
	page.errors = [];
	page.on('pageerror', err => page.errors.push(String(err)));
	await page.goto(`${WEB}/login`);
	await page.locator('#email').first().waitFor({ timeout: 120000 });
	await page.locator('#email').first().fill(email);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 120000 });
	return page;
}

async function inspect(page, id, tag) {
	await page.goto(`${WEB}/management/office/supply-periods/${id}`);
	await page.locator('[aria-busy="true"]').first().waitFor({ state: 'detached', timeout: 60000 }).catch(() => {});
	await page.waitForTimeout(800);
	await page.screenshot({ path: `${SHOTS}/${tag}-period-${id}.png` });
	const barButtons = await page.locator('[data-tour="period-save-bar"] button').allInnerTexts();
	return {
		loaded: await page.locator('[data-tour="period-stage"]').isVisible().catch(() => false),
		deadline: await page.getByRole('button', { name: 'Đổi hạn chót' }).count(),
		menu: await page.getByRole('button', { name: /^Khác/ }).count(),
		primary: await page.locator('[data-tour="period-next-step"]').count(),
		inputs: await page.locator('input[data-cell-col]').count(),
		barButtons: barButtons.filter(t => !/^Xem$/.test(t.trim())).length,
		requestActions: (await page.locator('#period-request-list button').allInnerTexts()).filter(t => /Chốt|Cấp/.test(t)).length,
		exportBtn: await page.getByRole('button', { name: 'Xuất Excel' }).count(),
		chips: await page.locator('[data-dept-chip]').count(),
	};
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });

let page = await signIn(browser, ACC.people.admin);
const admin2 = await inspect(page, 2, 'admin');
const admin3 = await inspect(page, 3, 'admin');
check('admin.2', admin2.deadline === 1 && admin2.menu === 1 && admin2.inputs > 0, 'Admin, kỳ đang mở: Đổi hạn chót, menu Khác, ô nhập', JSON.stringify(admin2));
check('admin.3', admin3.primary === 1 && admin3.requestActions > 0 && admin3.inputs > 0, 'Admin, kỳ đã khoá: nút chính, việc theo phiếu, ô nhập', JSON.stringify(admin3));
await page.context().close();

page = await signIn(browser, ACC.people.hanh);
const mgr2 = await inspect(page, 2, 'manager');
const mgr1 = await inspect(page, 1, 'manager');
for (const [id, s] of [
	['mgr.2', mgr2],
	['mgr.1', mgr1],
]) {
	check(
		id,
		s.loaded && s.deadline === 0 && s.menu === 0 && s.primary === 0 && s.inputs === 0 && s.barButtons === 0 && s.requestActions === 0,
		`Trưởng phòng (chỉ report), kỳ ${id.slice(-1)}: xem được, không nút ghi, không ô nhập, không việc theo phiếu`,
		JSON.stringify(s),
	);
}
check('mgr.err', page.errors.length === 0, 'Không lỗi JS', page.errors.join(' | '));
await page.context().close();
await browser.close();

// Gọi thẳng API ghi bằng token trưởng phòng.
const adminTok = await token(ACC.people.admin);
const mgrTok = await token(ACC.people.hanh);
const s3 = await (await fetch(`${ACC.api}/office/supply-periods/3`, { headers: { authorization: `Bearer ${adminTok}` } })).json();
const reqs = s3.data.departments.flatMap(d => d.requests);
const byStatus = status => reqs.find(r => r.status === status)?.id ?? 999999;
const writes = [
	['PATCH', '/office/supply-periods/2', { deadline: '2026-12-01' }],
	['POST', '/office/supply-periods/2/lock'],
	['PUT', '/office/supply-periods/2/items', { items: [] }],
	['POST', '/office/supply-periods/2/departments', { departmentIds: [3] }],
	['POST', '/office/supply-periods/2/cancel'],
	['POST', '/office/supply-periods/1/close'],
	['POST', '/office/supply-periods/3/supplements', { departmentId: 3, note: 'thử quyền', lines: [{ itemId: 1, requestedQty: 1 }] }],
	['POST', `/office/supply-requests/${byStatus('LOCKED')}/finalize`, { lines: [] }],
	['POST', `/office/supply-requests/${byStatus('FINALIZED')}/issue`],
	['POST', `/office/supply-requests/${byStatus('ISSUED')}/mark-delivered`, { receiverName: 'thử quyền' }],
	['POST', '/office/supply-requests/1/correct-received', { lines: [], reason: 'thử quyền' }],
];
for (const [method, url, body] of writes) {
	const r = await call(mgrTok, method, url, body);
	check(`api ${method} ${url}`, r.status === 403, 'Token chỉ có report bị chặn 403', `${r.status} ${r.code}`);
}
const exp = await call(mgrTok, 'GET', '/office/supply-periods/2/export');
console.log(`(tham khảo) GET /office/supply-periods/2/export bằng token report: ${exp.status} ${exp.code}`);

const bad = results.filter(r => !r.ok);
console.log(`\n=== ${results.length - bad.length}/${results.length} xanh ===`);
process.exit(bad.length ? 1 : 0);
