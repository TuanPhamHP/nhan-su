/**
 * Kiểm quyền thẻ Văn phòng phẩm của Cài đặt hành chính (P4) trên sandbox. Trang gác bằng `office:manage`
 * (`permission-guard`); admin có quyền này, trưởng phòng Đỗ Hồng Hạnh (MANAGER mặc định) thì không.
 * Giao diện chỉ đọc; sau đó gọi thẳng các API ghi danh mục bằng token trưởng phòng, mong 403.
 *
 *   node tests/e2e/supply-catalog/perm-p4.mjs <thư mục ảnh> <file Excel thử>
 */
import { chromium } from '/home/tuanpham/work/hr-system/nhan-su/node_modules/playwright-core/index.mjs';
import { mkdirSync, readFileSync } from 'node:fs';

const WEB = 'http://127.0.0.1:4999';
const ACC = JSON.parse(readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/p1-accounts.json', 'utf8'));
const PASSWORD = /const PASSWORD\s*=\s*['"`]([^'"`]+)['"`]/.exec(
	readFileSync('/home/tuanpham/work/hr-system/.sandbox-supply/drill-p1.cjs', 'utf8'),
)[1];
const SHOTS = process.argv[2] ?? '/tmp/supply-perm-p4';
const XLSX = process.argv[3];
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

async function visit(browser, email, tag) {
	const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
	await page.goto(`${WEB}/login`);
	await page.locator('#email').first().waitFor({ timeout: 120000 });
	await page.locator('#email').first().fill(email);
	await page.locator('input[type="password"]').first().fill(PASSWORD);
	await page.getByRole('button', { name: /Đăng nhập/i }).first().click();
	await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 120000 });
	await page.goto(`${WEB}/management/office/settings?tab=supplies`);
	await page.waitForTimeout(3000);
	await page.screenshot({ path: `${SHOTS}/${tag}.png` });
	const state = {
		path: new URL(page.url()).pathname,
		toolbar: await page.locator('[data-tour="supply-toolbar"]').count(),
		importBtn: await page.getByRole('button', { name: 'Nhập từ Excel' }).count(),
		addItem: await page.getByRole('button', { name: '+ Thêm mặt hàng' }).count(),
		addGroup: await page.getByRole('button', { name: 'Thêm nhóm' }).count(),
		edit: await page.getByRole('button', { name: /^Sửa / }).count(),
		menu: await page.getByRole('button', { name: /^Thêm việc với/ }).count(),
		price: await page.getByRole('button', { name: /bấm để sửa/ }).count(),
	};
	await page.context().close();
	return state;
}

const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const admin = await visit(browser, ACC.people.admin, 'admin');
check(
	'admin',
	admin.path === '/management/office/settings' && admin.toolbar === 1 && admin.importBtn === 1 && admin.addItem >= 1 && admin.addGroup === 1 && admin.edit > 0 && admin.menu > 0 && admin.price > 0,
	'Admin (office:manage): thấy danh mục và mọi nút ghi',
	JSON.stringify(admin),
);
const mgr = await visit(browser, ACC.people.hanh, 'manager');
check(
	'manager',
	mgr.path !== '/management/office/settings' && mgr.toolbar === 0 && mgr.addItem === 0 && mgr.edit === 0 && mgr.price === 0,
	'Trưởng phòng (không có office:manage): bị đưa khỏi trang, không thấy nút ghi nào',
	JSON.stringify(mgr),
);
await browser.close();

const mgrTok = await token(ACC.people.hanh);
const adminTok = await token(ACC.people.admin);
const items = (await (await fetch(`${ACC.api}/office/supply-items`, { headers: { authorization: `Bearer ${adminTok}` } })).json()).data;
const groups = (await (await fetch(`${ACC.api}/office/supply-groups`, { headers: { authorization: `Bearer ${adminTok}` } })).json()).data;
const json = (method, url, body) =>
	fetch(`${ACC.api}${url}`, {
		method,
		headers: { authorization: `Bearer ${mgrTok}`, 'content-type': 'application/json' },
		body: body ? JSON.stringify(body) : undefined,
	});
const form = new FormData();
form.append('file', new Blob([readFileSync(XLSX)]), 'thu-quyen.xlsx');
const writes = [
	['POST /office/supply-groups', () => json('POST', '/office/supply-groups', { name: 'Nhóm thử quyền' })],
	['PATCH /office/supply-groups/:id', () => json('PATCH', `/office/supply-groups/${groups[0].id}`, { name: groups[0].name })],
	['POST /office/supply-items', () => json('POST', '/office/supply-items', { groupId: groups[0].id, name: 'Mặt hàng thử quyền', unit: 'Cái' })],
	['PATCH /office/supply-items/:id (giá)', () => json('PATCH', `/office/supply-items/${items[0].id}`, { unitPrice: 1 })],
	['PATCH /office/supply-items/:id (ngừng dùng)', () => json('PATCH', `/office/supply-items/${items[0].id}`, { isActive: false })],
	['POST /office/supply-items/import', () => fetch(`${ACC.api}/office/supply-items/import`, { method: 'POST', headers: { authorization: `Bearer ${mgrTok}` }, body: form })],
	['GET /office/supply-items/import-template', () => json('GET', '/office/supply-items/import-template')],
];
for (const [label, run] of writes) {
	const res = await run();
	const body = await res.json().catch(() => null);
	check(`api ${label}`, res.status === 403, 'Token không có office:manage bị chặn 403', `${res.status} ${body?.error?.code ?? ''}`);
}

const bad = results.filter(r => !r.ok);
console.log(`\n=== ${results.length - bad.length}/${results.length} xanh ===`);
process.exit(bad.length ? 1 : 0);
